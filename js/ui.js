/**
 * ui.js
 * Giao diện: palette, info panel, toast, modal, tutorial.
 */

class UI {
  constructor(simulation) {
    this.sim = simulation;
    this.selectedAtom = null;
    this.infoContent = null;  // ✅ Khởi tạo null vì không dùng info panel nữa

    this._initPalette();
    this._initControls();
    //this._initInfoPanel();
    this._initTutorial();

    this.sim.onMoleculeDetected = (mol) => this._renderMoleculeInfo(mol);
    this.sim.onToast = (msg, type) => this.showToast(msg, type);
    this.sim.onAtomSelected = (atom) => this._renderAtomInfo(atom);
    this.sim.onWorkspaceClick = () => this._renderMoleculeInfo(this.sim.getMoleculeInfo());
  }

  _initPalette() {
    const container = document.getElementById('element-palette');
    container.innerHTML = '';

    for (const [symbol, data] of Object.entries(ELEMENTS)) {
      const card = document.createElement('div');
      card.className = 'element-card';
      card.draggable = true;
      card.dataset.element = symbol;
      card.innerHTML = `
        <div class="atom-preview" style="background:${data.color}; border-color:${data.glow}; color:${symbol === 'H' ? '#0a1128' : '#fff'}">${symbol}</div>
        <div class="name">${data.name}</div>
        <div class="valence">Valence: ${data.valenceElectrons}</div>
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', symbol);
        e.dataTransfer.effectAllowed = 'copy';
      });

      card.addEventListener('click', () => {
        const rect = this.sim.svg.getBoundingClientRect();
        const x = (rect.width  / 2 - this.sim.panX) / this.sim.zoom + (Math.random() - 0.5) * 100;
        const y = (rect.height / 2 - this.sim.panY) / this.sim.zoom + (Math.random() - 0.5) * 100;
        this.sim.addAtom(symbol, x, y);
        this.sim.saveState();
        this._hideHint();
      });

      container.appendChild(card);
    }

    const workspace = document.getElementById('workspace');
    workspace.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    workspace.addEventListener('drop', (e) => {
      e.preventDefault();
      const symbol = e.dataTransfer.getData('text/plain');
      if (!symbol || !ELEMENTS[symbol]) return;
      const { x, y } = this.sim.screenToWorld(e.clientX, e.clientY);
      this.sim.addAtom(symbol, x, y);
      this.sim.saveState();
      this._hideHint();
    });
  }

  _hideHint() {
    const hint = document.getElementById('workspace-hint');
    if (hint) hint.classList.add('hidden');
  }

  _initControls() {
    const toggleBtn = document.getElementById('toggle-palette-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const palette = document.getElementById('element-palette');
        const icon = document.getElementById('palette-icon');
        palette.classList.toggle('collapsed');
        icon.textContent = palette.classList.contains('collapsed') ? '▶' : '▼';
      });
    }
    const toggleControlsBtn = document.getElementById('toggle-controls-btn');
    if (toggleControlsBtn) {
      toggleControlsBtn.addEventListener('click', () => {
        const content = document.getElementById('controls-content');
        const icon = document.getElementById('controls-icon');
        content.classList.toggle('collapsed');
        icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
      });
    }
    document.getElementById('btn-undo').addEventListener('click', () => {
      if (this.sim.undo()) this.showToast('↶ Đã hoàn tác', 'success');
    });
    document.getElementById('btn-redo').addEventListener('click', () => {
      if (this.sim.redo()) this.showToast('↷ Đã làm lại', 'success');
    });
    document.getElementById('btn-clear').addEventListener('click', () => {
      document.getElementById('confirm-modal').classList.remove('hidden');
    });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
      document.getElementById('confirm-modal').classList.add('hidden');
    });
    document.getElementById('btn-confirm-clear').addEventListener('click', () => {
      this.sim.clearAll();
      this.sim.saveState();
      document.getElementById('confirm-modal').classList.add('hidden');
      this.showToast('🗑 Đã xóa toàn bộ', 'success');
    });
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.sim.setZoom(this.sim.zoom + 0.15, this.sim.svg.clientWidth / 2, this.sim.svg.clientHeight / 2);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.sim.setZoom(this.sim.zoom - 0.15, this.sim.svg.clientWidth / 2, this.sim.svg.clientHeight / 2);
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', () => this.sim.resetZoom());

    document.getElementById('toggle-electron-anim').addEventListener('change', (e) => {
      this.sim.setAnimating(e.target.checked);
    });
    document.getElementById('anim-speed').addEventListener('input', (e) => {
      this.sim.setAnimSpeed(e.target.value / 100);
    });
    document.getElementById('toggle-config').addEventListener('change', () => {
      if (this.selectedAtom) this._renderAtomInfo(this.selectedAtom);
      else this._renderMoleculeInfo(this.sim.getMoleculeInfo());
    });

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (this.sim.undo()) this.showToast('↶ Đã hoàn tác', 'success');
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        if (this.sim.redo()) this.showToast('↷ Đã làm lại', 'success');
      }
      if (e.key === 'Delete' && this.selectedAtom) {
        this.sim.removeAtom(this.selectedAtom.id);
        this.sim.saveState();
        this.selectedAtom = null;
        this._renderMoleculeInfo(this.sim.getMoleculeInfo());
      }
    });
  }

  _initInfoPanel() {
    this.infoContent = document.getElementById('info-content');
    if (!this.infoContent) this.infoContent = null;
  }

  _renderAtomInfo(atom) {
    if (!this.infoContent) return;
    this.selectedAtom = atom;
    const showConfig = document.getElementById('toggle-config').checked;
    const d = atom.data;

    const valenceDots = Array.from({ length: d.valenceElectrons }, (_, i) => {
      const e = atom.electrons[i];
      let cls = 'electron-dot';
      if (e.state === ElectronState.BONDED || e.state === ElectronState.SHARED) cls += ' bonded';
      if (e.state === ElectronState.LONE_PAIR) cls += ' lone';
      if (e.state === ElectronState.SHARED) cls = 'electron-dot shared';
      return `<span class="${cls}" title="${e.state}"></span>`;
    }).join('');

    const target = atom.element === 'H' ? 2 : 8;
    const totalAround = d.valenceElectrons + atom.totalBonds * 2;
    const stable = totalAround >= target;

    let html = `
      <div class="info-card">
        <h3>${d.name} (${d.symbol})</h3>
        <div class="info-row"><span class="label">Số hiệu nguyên tử:</span><span class="value">${d.atomicNumber}</span></div>
        <div class="info-row"><span class="label">Proton:</span><span class="value">${d.atomicNumber}</span></div>
        <div class="info-row"><span class="label">Electron:</span><span class="value">${d.atomicNumber}</span></div>
        <div class="info-row"><span class="label">Electron hóa trị:</span><span class="value">${d.valenceElectrons}</span></div>
        <div class="info-row"><span class="label">Liên kết điển hình:</span><span class="value">${d.typicalBonds}</span></div>
        <div class="info-row"><span class="label">Liên kết hiện tại:</span><span class="value">${atom.totalBonds} / ${d.typicalBonds}</span></div>
        <div class="info-row"><span class="label">Cặp electron tự do:</span><span class="value">${atom.lonePairs}</span></div>
      </div>

      <div class="info-card">
        <h3>Electron hóa trị</h3>
        <div class="electron-dots">${valenceDots}</div>
        <div class="info-row"><span class="label">Cần thêm:</span><span class="value">${atom.neededElectrons()} electron</span></div>
        <div class="status-badge ${stable ? 'ok' : 'warn'}">
          ${stable ? '✓ Đạt ' + (atom.element === 'H' ? 'Duet' : 'Octet') : '⚠ Chưa đạt ' + (atom.element === 'H' ? 'Duet' : 'Octet')}
        </div>
      </div>
    `;

    if (showConfig) html += this._buildConfigDiagram(d);
    html += `<p style="font-size:0.7rem;color:var(--text-dim);margin-top:8px;">Nhấn phím Delete để xóa nguyên tử này.</p>`;

    this.infoContent.innerHTML = html;
  }

  _buildConfigDiagram(data) {
    let rows = '';
    for (const item of data.orbitalDiagram) {
      rows += `<div class="orbital"><span>${item.orbital}</span><span class="arrows">[${item.arrows.map(a => a || ' ').join(' ')}]</span></div>`;
    }
    return `
      <div class="info-card">
        <h3>Cấu hình electron</h3>
        <div class="config-diagram">
          <div>${data.configuration}</div>
          <div style="margin-top:8px;">${rows}</div>
        </div>
      </div>
    `;
  }

  _renderMoleculeInfo(mol) {
    this.selectedAtom = null;

    // ✅ Chạy hiệu ứng chúc mừng TRƯỚC (không phụ thuộc infoContent)
    if (mol && mol.stable && !mol.unknown && mol.formula && this.sim.atoms.length > 1) {
      const stateKey = mol.formula + '_' + this.sim.atoms.length;
      if (this.lastCelebratedKey !== stateKey) {
        this._celebrate(mol);
        this.lastCelebratedKey = stateKey;
      }
    } else {
      this.lastCelebratedKey = null;
    }

    // ✅ Nếu không có info panel thì dừng ở đây
    if (!this.infoContent) return;

    // Đặt lại trạng thái nếu không có phân tử nào
    if (!mol || this.sim.atoms.length === 0) {
      this.infoContent.innerHTML = '<p class="info-placeholder">Nhấp vào nguyên tử hoặc không gian làm việc để xem thông tin chi tiết.</p>';
      return;
    }

    // Đặt lại trạng thái nếu chỉ có 1 nguyên tử lẻ
    if (mol.singleAtom) {
      this._renderAtomInfo(this.sim.atoms[0]);
      return;
    }

    const bondTypes = this._getBondTypeSummary();
    let html = `
      <div class="info-card">
        <h3>Thông tin phân tử</h3>
        <div class="info-row"><span class="label">Công thức:</span><span class="value">${mol.formula}</span></div>
        <div class="info-row"><span class="label">Tên:</span><span class="value">${mol.name}</span></div>
        <div class="info-row"><span class="label">Tên tiếng Việt:</span><span class="value">${mol.vietnameseName}</span></div>
        <div class="info-row"><span class="label">Số nguyên tử:</span><span class="value">${this.sim.atoms.length}</span></div>
        <div class="info-row"><span class="label">Số liên kết:</span><span class="value">${mol.bondCount}</span></div>
        <div class="info-row"><span class="label">Loại liên kết:</span><span class="value">${bondTypes}</span></div>
        <div class="status-badge ${mol.stable ? 'ok' : 'warn'}">
          ${mol.stable ? 'Bền vững' : 'Chưa bền vững'}
        </div>
      </div>
    `;

    html += `<div class="info-card"><h3>Electron hóa trị</h3>`;
    for (const atom of this.sim.atoms) {
      const target = atom.element === 'H' ? 2 : 8;
      const total = atom.valenceElectrons + atom.totalBonds * 2;
      const ok = total >= target;
      html += `<div class="info-row"><span class="label">${atom.element} #${atom.id}</span><span class="value">${total} e ${ok ? '✅' : '❌'}</span></div>`;
    }
    html += `</div>`;

    this.infoContent.innerHTML = html;
  }

  _getBondTypeSummary() {
    const orders = new Set();
    const drawn = new Set();
    for (const atom of this.sim.atoms) {
      for (const b of atom.bonds) {
        const key = [Math.min(atom.id, b.partnerId), Math.max(atom.id, b.partnerId)].join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);
        orders.add(b.order);
      }
    }
    if (orders.size === 0) return 'Chưa có';
    const parts = [];
    if (orders.has(1)) parts.push('Đơn');
    if (orders.has(2)) parts.push('Đôi');
    if (orders.has(3)) parts.push('Ba');
    return parts.join(', ');
  }

  _celebrate(mol) {
    const el = document.getElementById('celebrate');
    el.innerHTML = `
      ✨ Molecule Created! ✨
      <span class="formula">${mol.formula}</span>
      <span class="name">${mol.name} / ${mol.vietnameseName}</span>
    `;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 2600);
  }

  showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  _initTutorial() {
    document.getElementById('btn-start').addEventListener('click', () => {
      document.getElementById('tutorial-modal').classList.add('hidden');
    });
  }
}

window.UI = UI;