/**
 * simulation.js
 * Core engine: quản lý trạng thái, render SVG, drag & drop, snap, tạo liên kết, undo/redo.
 */

class Simulation {
  constructor(svgElement, workspaceElement) {
    this.svg = svgElement;
    this.workspace = workspaceElement;
    this.atoms = [];
    this.atomMap = new Map();

    this.history = [];
    this.historyIndex = -1;

    this.dragState = null;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;

    this.animating = true;
    this.animSpeed = 1;
    this.time = 0;
    this.showShared = true;

    this.onStateChange = null;
    this.onMoleculeDetected = null;
    this.onToast = null;
    this.onAtomSelected = null;
    this.onWorkspaceClick = null;

    this.SNAP_DISTANCE = 95;
    this.BOND_LENGTH = 65;

    this._initLayers();
    this._initEvents();
    this._startLoop();
    this.saveState();
  }

  _initLayers() {
    this.svg.innerHTML = '';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    `;
    this.svg.appendChild(defs);

    this.orbitalLayer = this._createGroup('orbital-layer');
    this.atomLayer    = this._createGroup('atom-layer');
    this.bondLayer    = this._createGroup('bond-layer');
  }

  _createGroup(id) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', id);
    this.svg.appendChild(g);
    return g;
  }

  _initEvents() {
    this.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup',   (e) => this._onMouseUp(e));

    this.svg.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    window.addEventListener('touchmove',  (e) => this._onTouchMove(e),  { passive: false });
    window.addEventListener('touchend',   (e) => this._onTouchEnd(e));

    this.workspace.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.svg.addEventListener('click', (e) => this._onClick(e));
  }

  screenToWorld(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.panX) / this.zoom,
      y: (clientY - rect.top  - this.panY) / this.zoom
    };
  }

  _startLoop() {
    const loop = (timestamp) => {
      this.time = timestamp;
      if (this.animating) this._updateElectrons();
      this._render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _updateSharedElectronTargets() {
    const drawn = new Set();
    for (const atom of this.atoms) {
      for (const bond of atom.bonds) {
        const key = [Math.min(atom.id, bond.partnerId), Math.max(atom.id, bond.partnerId)].join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);

        const partner = this.atomMap.get(bond.partnerId);
        if (!partner) continue;

        const dx = partner.x - atom.x;
        const dy = partner.y - atom.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;

        // Vector đơn vị dọc theo trục liên kết (ux, uy) và vuông góc (px, py)
        const ux = dx / dist;
        const uy = dy / dist;
        const px = -uy; 
        const py =  ux; 

        const sharedA = atom.electrons.filter(e => e.state === ElectronState.SHARED && e.partnerId === partner.id);
        const sharedB = partner.electrons.filter(e => e.state === ElectronState.SHARED && e.partnerId === atom.id);
        const pairCount = Math.min(bond.order, sharedA.length, sharedB.length);
        
        // Xác định chính xác trung điểm vùng giao nhau
        const midX = atom.x + dx / 2;
        const midY = atom.y + dy / 2;
        
        const spacingY = 12; // Khoảng cách giãn dọc giữa 2 electron trong CÙNG 1 cặp
        const spacingX = 14; // Khoảng cách giãn ngang GIỮA CÁC CẶP với nhau (cho liên kết đôi, ba)

        for (let i = 0; i < pairCount; i++) {
          const eA = sharedA[i];
          const eB = sharedB[i];
          if (!eA || !eB) break;

          // Tính toán độ lệch (dịch dọc theo trục liên kết) cho từng cặp để chúng không đè lên nhau
          const pairOffsetX = ux * (i - (pairCount - 1) / 2) * spacingX;
          const pairOffsetY = uy * (i - (pairCount - 1) / 2) * spacingX;

          // Vị trí tâm của cặp thứ i
          const pairCenterX = midX + pairOffsetX;
          const pairCenterY = midY + pairOffsetY;

          // Xếp 2 electron của cặp này giãn ra theo chiều vuông góc
          eA.targetX = pairCenterX + px * (spacingY / 2);
          eA.targetY = pairCenterY + py * (spacingY / 2);
          eB.targetX = pairCenterX - px * (spacingY / 2);
          eB.targetY = pairCenterY - py * (spacingY / 2);
        }
      }
    }
  }

  _updateElectrons() {
    const speed = this.animSpeed;
    this._updateSharedElectronTargets();

    for (const atom of this.atoms) {
      let vx = 0, vy = 0;
      if (atom.bonds.length > 0) {
        vx = Math.sin(this.time * 0.005 + atom.vibrationPhase) * 0.8;
        vy = Math.cos(this.time * 0.005 + atom.vibrationPhase) * 0.8;
      }

      for (const e of atom.electrons) {
        // Ép bán kính quay khớp với viền đen quỹ đạo
        e.radius = 45; 

        if (e.state === ElectronState.SHARED) {
          if (e.targetX !== undefined && e.targetY !== undefined) {
            // Electron trượt mượt mà vào vị trí mục tiêu
            e.x += (e.targetX - e.x) * 0.05 * speed; 
            e.y += (e.targetY - e.y) * 0.05 * speed;
          }
        } else if (e.state === ElectronState.BONDED) {
          e.angle += e.speed * speed * 0.3;
          e.x = atom.x + Math.cos(e.angle) * e.radius + vx * 0.5;
          e.y = atom.y + Math.sin(e.angle) * e.radius + vy * 0.5;
        } else if (e.state === ElectronState.LONE_PAIR) {
          e.update(atom.x + vx, atom.y + vy, this.time, speed * 0.5);
        } else {
          e.update(atom.x + vx, atom.y + vy, this.time, speed);
        }
      }
    }
  }

  _render() {
    const w = this.svg.clientWidth;
    const h = this.svg.clientHeight;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const t = `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
    this.orbitalLayer.setAttribute('transform', t);
    this.atomLayer.setAttribute('transform', t);
    this.bondLayer.setAttribute('transform', t);

    this._renderOrbitals();
    this._renderAtoms();
    this._renderBonds();
  }

  _renderOrbitals() {
    this.orbitalLayer.innerHTML = '';
    for (const atom of this.atoms) {
      // Vẽ vòng quỹ đạo nét liền màu đen
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', atom.x);
      ring.setAttribute('cy', atom.y);
      ring.setAttribute('r', 45); // Bán kính vòng ngoài
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#000'); // Màu viền
      ring.setAttribute('stroke-width', '2.5');
      this.orbitalLayer.appendChild(ring);
    }
  }

  _renderAtoms() {
    this.atomLayer.innerHTML = '';
    for (const atom of this.atoms) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'atom-group');
      g.setAttribute('data-atom-id', atom.id);

      // Hạt nhân màu đỏ đô
      const nucleus = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      nucleus.setAttribute('cx', atom.x);
      nucleus.setAttribute('cy', atom.y);
      nucleus.setAttribute('r', 8);
      nucleus.setAttribute('fill', '#8b0000');
      g.appendChild(nucleus);

      // Ký hiệu nguyên tố (H, O, C,...) nằm bên dưới vòng tròn
      const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      symbol.setAttribute('x', atom.x);
      symbol.setAttribute('y', atom.y + 70); 
      symbol.setAttribute('text-anchor', 'middle');
      symbol.setAttribute('fill', '#000');
      symbol.setAttribute('font-size', '26');
      symbol.setAttribute('font-family', 'serif');
      symbol.textContent = atom.element;
      g.appendChild(symbol);

      // Render các hạt electron màu đỏ tươi
      for (const e of atom.electrons) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', e.x);
        dot.setAttribute('cy', e.y);
        dot.setAttribute('r', 4);
        let color = '#0284c7'; 
        if (e.state === ElectronState.SHARED) {
           color = '#ef4444';

        }
        dot.setAttribute('fill', color);
        g.appendChild(dot);
      } 
      this.atomLayer.appendChild(g);
    }
  }

  _renderBonds() {
    // Để trống: Liên kết đã được thể hiện bằng sự giao nhau của 2 quỹ đạo.
    this.bondLayer.innerHTML = '';
  }

  addAtom(element, x, y) {
    const atom = new Atom(element, x, y);
    this.atoms.push(atom);
    this.atomMap.set(atom.id, atom);
    this._checkMolecule();
    return atom;
  }

  removeAtom(atomId) {
    const atom = this.atomMap.get(atomId);
    if (!atom) return;
    for (const b of [...atom.bonds]) {
      const partner = this.atomMap.get(b.partnerId);
      if (partner) partner.removeBond(atomId);
    }
    this.atoms = this.atoms.filter(a => a.id !== atomId);
    this.atomMap.delete(atomId);
    this._checkMolecule();
  }

  clearAll() {
    this.atoms = [];
    this.atomMap.clear();
    this._checkMolecule();
  }

  _findSnapCandidate(atom) {
    let best = null, bestDist = this.SNAP_DISTANCE;
    for (const other of this.atoms) {
      if (other.id === atom.id) continue;
      const dist = Math.hypot(other.x - atom.x, other.y - atom.y);
      if (dist < bestDist) {
        const check = atom.canBondWith(other, 1);
        if (check.ok) { bestDist = dist; best = other; }
      }
    }
    return best;
  }

  trySnapAndBond(atom) {
    const partner = this._findSnapCandidate(atom);
    if (!partner) return false;

    let order = 1;
    const maxThis  = atom.data.typicalBonds  - atom.totalBonds;
    const maxOther = partner.data.typicalBonds - partner.totalBonds;
    const maxOrder = Math.min(maxThis, maxOther, 3);
    
    if (maxOrder >= 2) {
      const aNeeds = atom.neededElectrons();
      const bNeeds = partner.neededElectrons();
      if (aNeeds >= 2 && bNeeds >= 2) order = Math.min(2, maxOrder);
      if (aNeeds >= 3 && bNeeds >= 3 && maxOrder >= 3) order = 3;
    }

    const check = atom.canBondWith(partner, order);
    if (!check.ok) {
      if (this.onToast) this.onToast(check.reason, 'error');
      return false;
    }

    atom.addBond(partner, order);
    this._snapPositions(atom, partner, order);
    atom.addBond(partner, order);
    this._assignSharedElectrons(atom, partner, order);
    this._checkMolecule();
    this.saveState();
    return true;
  }

  _snapPositions(atomA, atomB, order) {
    const dist = this.BOND_LENGTH - (order - 1) * 10;
    const angle = Math.atan2(atomB.y - atomA.y, atomB.x - atomA.x);
    
    const midX = (atomA.x + atomB.x) / 2;
    const midY = (atomA.y + atomB.y) / 2;
    const half = dist / 2;
    
    const aTarget = { x: midX - Math.cos(angle) * half, y: midY - Math.sin(angle) * half };
    const bTarget = { x: midX + Math.cos(angle) * half, y: midY + Math.sin(angle) * half };

    this._moveAtomWithAttached(atomA, aTarget.x - atomA.x, aTarget.y - atomA.y);
    this._moveAtomWithAttached(atomB, bTarget.x - atomB.x, bTarget.y - atomB.y);
  }

  _moveAtomWithAttached(atom, dx, dy) {
    const visited = new Set();
    const stack = [atom];
    
    while (stack.length) {
      const a = stack.pop();
      if (visited.has(a.id)) continue;
      visited.add(a.id);
      
      a.x += dx; a.y += dy;
      
      for (const b of a.bonds) {
        const partner = this.atomMap.get(b.partnerId);
        if (partner && !visited.has(partner.id)) stack.push(partner);
      }
    }
  }

  _assignSharedElectrons(atomA, atomB, order) {
    const candidateA = atomA.electrons.filter(
      e => e.state === ElectronState.AVAILABLE || e.state === ElectronState.BONDED
    );
    const candidateB = atomB.electrons.filter(
      e => e.state === ElectronState.AVAILABLE || e.state === ElectronState.BONDED
    );
    
    const n = Math.min(order, candidateA.length, candidateB.length);
    for (let i = 0; i < n; i++) {
      candidateA[i].state = ElectronState.SHARED;
      candidateA[i].partnerId = atomB.id;
      candidateB[i].state = ElectronState.SHARED;
      candidateB[i].partnerId = atomA.id;
    }
  }

  _checkMolecule() {
    if (this.atoms.length === 0) {
      if (this.onMoleculeDetected) this.onMoleculeDetected(null);
      return;
    }
    const mol = detectMolecule(this.atoms);
    if (this.onMoleculeDetected) this.onMoleculeDetected(mol);
  }

  saveState() {
    const state = {
      atoms: this.atoms.map(a => a.serialize()),
      zoom: this.zoom, panX: this.panX, panY: this.panY
    };
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(state);
    this.historyIndex = this.history.length - 1;
    if (this.history.length > 50) { this.history.shift(); this.historyIndex--; }
  }

  undo() {
    if (this.historyIndex <= 0) return false;
    this.historyIndex--;
    this._restoreState(this.history[this.historyIndex]);
    return true;
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex++;
    this._restoreState(this.history[this.historyIndex]);
    return true;
  }

  _restoreState(state) {
    this.atoms = state.atoms.map(d => Atom.deserialize(d));
    this.atomMap.clear();
    for (const a of this.atoms) this.atomMap.set(a.id, a);
    this.zoom = state.zoom;
    this.panX = state.panX;
    this.panY = state.panY;
    this._checkMolecule();
  }

  setZoom(newZoom, centerX, centerY) {
    newZoom = Math.max(0.4, Math.min(2.5, newZoom));
    if (centerX !== undefined && centerY !== undefined) {
      this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
      this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
    }
    this.zoom = newZoom;
  }

  resetZoom() { this.zoom = 1; this.panX = 0; this.panY = 0; }

  _getAtomAt(clientX, clientY) {
    const { x, y } = this.screenToWorld(clientX, clientY);
    for (let i = this.atoms.length - 1; i >= 0; i--) {
      const a = this.atoms[i];
      if (Math.hypot(a.x - x, a.y - y) <= 45) return a;
    }
    return null;
  }

  _onMouseDown(e) {
    const atom = this._getAtomAt(e.clientX, e.clientY);
    if (atom) {
      const { x, y } = this.screenToWorld(e.clientX, e.clientY);
      this.dragState = { type: 'atom', atom, offsetX: atom.x - x, offsetY: atom.y - y, startX: x, startY: y, moved: false };
      e.preventDefault();
      return;
    }
    this.dragState = {
      type: 'pan', startX: e.clientX, startY: e.clientY,
      startPanX: this.panX, startPanY: this.panY
    };
  }

  _onMouseMove(e) {
    if (!this.dragState) return;
    
    if (this.dragState.type === 'atom') {
      const { x, y } = this.screenToWorld(e.clientX, e.clientY);
      const atom = this.dragState.atom;
      
      const dx = x - this.dragState.startX;
      const dy = y - this.dragState.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.dragState.moved = true;
      
      let targetX = x + this.dragState.offsetX;
      let targetY = y + this.dragState.offsetY;

      
      const padding = 50; 
      const minX = -this.panX / this.zoom + padding;
      const maxX = (this.svg.clientWidth - this.panX) / this.zoom - padding;
      const minY = -this.panY / this.zoom + padding;
      const maxY = (this.svg.clientHeight - this.panY) / this.zoom - padding;
      targetX = Math.max(minX, Math.min(maxX, targetX));
      targetY = Math.max(minY, Math.min(maxY, targetY));

      this._moveAtomWithAttached(atom, targetX - atom.x, targetY - atom.y);
      this._renderSnapPreview(atom);
      
    } else if (this.dragState.type === 'pan') {
      this.panX = this.dragState.startPanX + (e.clientX - this.dragState.startX);
      this.panY = this.dragState.startPanY + (e.clientY - this.dragState.startY);
    }
  }

  _onMouseUp(e) {
    if (!this.dragState) return;
    if (this.dragState.type === 'atom' && this.dragState.moved) {
      const atom = this.dragState.atom;
      const bonded = this.trySnapAndBond(atom);
      if (bonded) {
        this.onToast && this.onToast('Tạo liên kết thành công!', 'success');
      } else {
        this.saveState();
      }
    }
    this.dragState = null;
    this._clearSnapPreview();
  }

  _onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    this._onMouseDown({ clientX: t.clientX, clientY: t.clientY, target: e.target, preventDefault: () => e.preventDefault() });
  }

  _onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    this._onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    if (this.dragState) e.preventDefault();
  }

  _onTouchEnd(e) { this._onMouseUp(e); }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.svg.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.setZoom(this.zoom + delta, e.clientX - rect.left, e.clientY - rect.top);
  }

  _onClick(e) {
    const atom = this._getAtomAt(e.clientX, e.clientY);
    if (atom && this.onAtomSelected) this.onAtomSelected(atom);
    else if (!atom && this.onWorkspaceClick) this.onWorkspaceClick();
  }

  _renderSnapPreview(atom) {
    this._clearSnapPreview();
    const partner = this._findSnapCandidate(atom);
    if (!partner) return;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', 'snap-preview');
    line.setAttribute('x1', atom.x);
    line.setAttribute('y1', atom.y);
    line.setAttribute('x2', partner.x);
    line.setAttribute('y2', partner.y);
    line.setAttribute('stroke', '#000');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '5 5');
    line.setAttribute('opacity', '0.5');
    this.bondLayer.appendChild(line);
  }

  _clearSnapPreview() {
    const el = this.bondLayer.querySelector('#snap-preview');
    if (el) el.remove();
  }

  getMoleculeInfo() { return detectMolecule(this.atoms); }
  setAnimating(on)  { this.animating = on; }
  setAnimSpeed(s)   { this.animSpeed = s; }
  setShowShared(on) { this.showShared = on; }
}

window.Simulation = Simulation;