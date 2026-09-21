/**
 * ui.js
 * Giao diện: palette, toast, modal, tutorial.
 */

class UI {
  constructor(simulation) {
    this.sim = simulation;
    this.selectedAtom = null;

    this._initPalette();
    this._initControls();
    this._initTutorial();

    this.sim.onMoleculeDetected = (mol) => this._renderMoleculeInfo(mol);
    this.sim.onToast = (msg, type) => this.showToast(msg, type);
    this.sim.onAtomSelected = (atom) => { this.selectedAtom = atom; };
    this.sim.onWorkspaceClick = () => { this.selectedAtom = null; };
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

    const toggleInfoBtn = document.getElementById('toggle-info-btn');
    if (toggleInfoBtn) {
      toggleInfoBtn.addEventListener('click', () => {
        const infoPanel = document.getElementById('info-content-panel');
        const icon = document.getElementById('info-icon');
        infoPanel.classList.toggle('collapsed');
        icon.textContent = infoPanel.classList.contains('collapsed') ? '▶' : '▼';
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

    // ✅ Toggle electron animation
    const electronAnimEl = document.getElementById('toggle-electron-anim');
    if (electronAnimEl) {
      electronAnimEl.addEventListener('change', (e) => {
        this.sim.setAnimating(e.target.checked);
      });
    }

    // ✅ Anim speed
    const animSpeedEl = document.getElementById('anim-speed');
    if (animSpeedEl) {
      animSpeedEl.addEventListener('input', (e) => {
        this.sim.setAnimSpeed(e.target.value / 100);
      });
    }

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
      }
    });
  }

  _renderMoleculeInfo(mol) {
    this.selectedAtom = null;

    const elFormula = document.getElementById('info-formula');
    const elName = document.getElementById('info-name');
    const elStructural = document.getElementById('info-structural');

    if (mol && this.sim.atoms.length > 0) {
      if (elFormula) elFormula.textContent = mol.formula || '—';
      if (elName) elName.textContent = mol.vietnameseName || mol.name || 'Chưa xác định';
      
      // Lấy trực tiếp giá trị tự động tính toán từ hệ thống
      if (elStructural) elStructural.textContent = mol.structural || (mol.singleAtom ? mol.formula : '—');

      if (mol && mol.stable && !mol.unknown && mol.formula && this.sim.atoms.length > 1) {
        const stateKey = mol.formula + '_' + this.sim.atoms.length;
        if (this.lastCelebratedKey !== stateKey) {
          this._celebrate(mol);
          this.lastCelebratedKey = stateKey;
        }
      }
    } else {
      if (elFormula) elFormula.textContent = '—';
      if (elName) elName.textContent = '—';
      if (elStructural) elStructural.textContent = '—';
      this.lastCelebratedKey = null;
    }
  }

  _celebrate(mol) {
    const el = document.getElementById('celebrate');
    if (!el) return;
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
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  _initTutorial() {
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        document.getElementById('tutorial-modal').classList.add('hidden');
      });
    }
  }
}

window.UI = UI;f