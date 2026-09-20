/**
 * atom.js
 * Định nghĩa dữ liệu nguyên tố, cấu hình electron và lớp Atom.
 */

// ==================== DỮ LIỆU NGUYÊN TỐ ====================
const ELEMENTS = {
  H: {
    symbol: 'H', name: 'Hydrogen', vietnameseName: 'Hydro',
    atomicNumber: 1, valenceElectrons: 1, typicalBonds: 1,
    color: '#e2e8f0', glow: 'rgba(226, 232, 240, 0.6)', radius: 18,
    configuration: '1s¹',
    orbitalDiagram: [{ orbital: '1s', arrows: ['↑'] }]
  },
  C: {
    symbol: 'C', name: 'Carbon', vietnameseName: 'Cacbon',
    atomicNumber: 6, valenceElectrons: 4, typicalBonds: 4,
    color: '#4b5563', glow: 'rgba(107, 114, 128, 0.6)', radius: 24,
    configuration: '1s² 2s² 2p²',
    orbitalDiagram: [
      { orbital: '1s', arrows: ['↑', '↓'] },
      { orbital: '2s', arrows: ['↑', '↓'] },
      { orbital: '2p', arrows: ['↑', '↑', ''] }
    ]
  },
  N: {
    symbol: 'N', name: 'Nitrogen', vietnameseName: 'Nitơ',
    atomicNumber: 7, valenceElectrons: 5, typicalBonds: 3,
    color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)', radius: 23,
    configuration: '1s² 2s² 2p³',
    orbitalDiagram: [
      { orbital: '1s', arrows: ['↑', '↓'] },
      { orbital: '2s', arrows: ['↑', '↓'] },
      { orbital: '2p', arrows: ['↑', '↑', '↑'] }
    ]
  },
  O: {
    symbol: 'O', name: 'Oxygen', vietnameseName: 'Oxy',
    atomicNumber: 8, valenceElectrons: 6, typicalBonds: 2,
    color: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)', radius: 22,
    configuration: '1s² 2s² 2p⁴',
    orbitalDiagram: [
      { orbital: '1s', arrows: ['↑', '↓'] },
      { orbital: '2s', arrows: ['↑', '↓'] },
      { orbital: '2p', arrows: ['↑↓', '↑', '↑'] }
    ]
  },
  F: {
    symbol: 'F', name: 'Fluorine', vietnameseName: 'Flo',
    atomicNumber: 9, valenceElectrons: 7, typicalBonds: 1,
    color: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)', radius: 21,
    configuration: '1s² 2s² 2p⁵',
    orbitalDiagram: [
      { orbital: '1s', arrows: ['↑', '↓'] },
      { orbital: '2s', arrows: ['↑', '↓'] },
      { orbital: '2p', arrows: ['↑↓', '↑↓', '↑'] }
    ]
  }
};

// ==================== LỚP ATOM ====================
let ATOM_ID_COUNTER = 1;

class Atom {
  constructor(elementSymbol, x, y) {
    const data = ELEMENTS[elementSymbol];
    if (!data) throw new Error(`Nguyên tố không hợp lệ: ${elementSymbol}`);

    this.id = ATOM_ID_COUNTER++;
    this.element = elementSymbol;
    this.x = x;
    this.y = y;
    this.data = data;

    this.valenceElectrons = data.valenceElectrons;
    this.bonds = [];
    this.lonePairs = 0;
    this.bondedElectrons = 0;

    this.electrons = [];
    for (let i = 0; i < this.valenceElectrons; i++) {
      const e = new Electron(`${this.id}-e${i}`);
      e.state = ElectronState.AVAILABLE;
      e.partnerId = null;
      this.electrons.push(e);
    }

    this.radius = data.radius;
    this.isDragging = false;
    this.vibrationPhase = Math.random() * Math.PI * 2;
  }

  get totalBonds() {
    return this.bonds.reduce((sum, b) => sum + b.order, 0);
  }

  get availableValence() {
    return this.valenceElectrons - this.totalBonds;
  }

  isStable() {
    const target = this.element === 'H' ? 2 : 8;
    return (this.valenceElectrons + this.totalBonds * 2) >= target;
  }

  neededElectrons() {
    const target = this.element === 'H' ? 2 : 8;
    return Math.max(0, target - this.valenceElectrons);
  }

  canBondWith(other, order = 1) {
    if (other.id === this.id) return { ok: false, reason: 'Không thể liên kết chính nó.' };
    
    // Kiểm tra xem đã kết nối với nguyên tử này chưa và số liên kết đã đạt tối đa chưa
    const existing = this.bonds.find(b => b.partnerId === other.id);
    const currentBondWithPartner = existing ? existing.order : 0;
    
    if (currentBondWithPartner + order > 3) {
      return { ok: false, reason: `${this.data.name} đã đạt giới hạn với ${other.data.name}.` };
    }
    
    // Tổng số liên kết của nguyên tử này không được vượt quá typicalBonds
    if (this.totalBonds + order > this.data.typicalBonds) {
      return { ok: false, reason: `${this.data.name} đã đạt ${this.data.typicalBonds} liên kết tối đa.` };
    }
    
    if (other.totalBonds + order > other.data.typicalBonds) {
      return { ok: false, reason: `${other.data.name} đã đạt ${other.data.typicalBonds} liên kết tối đa.` };
    }
    
    return { ok: true };
  }
  addBond(other, order) {
  const existing = this.bonds.find(b => b.partnerId === other.id);
  if (existing) {
    existing.order = order;
  } else {
    this.bonds.push({ partnerId: other.id, order });
  }

  const otherExisting = other.bonds.find(b => b.partnerId === this.id);
  if (otherExisting) {
    otherExisting.order = order;
  } else {
    other.bonds.push({ partnerId: this.id, order });
  }

  this.bondedElectrons = this.totalBonds;
  other.bondedElectrons = other.totalBonds;
  
  this._updateElectronStates();
  other._updateElectronStates();
}

  /**
   * Cập nhật trạng thái electron dựa trên số liên kết.
   * - Electron SHARED → giữ nguyên.
   * - Electron chưa SHARED:
   *     + Chưa đạt max bond → AVAILABLE.
   *     + Đã đạt max bond → LONE_PAIR; lẻ 1 → AVAILABLE.
   */
  _updateElectronStates() {
    const sharedSet = new Set(this.electrons.filter(e => e.state === ElectronState.SHARED));

    const nonSharedIdx = [];
    for (let i = 0; i < this.electrons.length; i++) {
      if (!sharedSet.has(this.electrons[i])) nonSharedIdx.push(i);
    }

    const remaining = this.valenceElectrons - this.totalBonds;
    if (remaining < 0) return;

    const reachedMaxBonds = this.totalBonds >= this.data.typicalBonds;

    let lonePairCount = 0;
    if (reachedMaxBonds && remaining >= 2) {
      lonePairCount = Math.floor(remaining / 2) * 2;
    }

    for (let k = 0; k < nonSharedIdx.length; k++) {
      const e = this.electrons[nonSharedIdx[k]];
      e.state = (k < lonePairCount) ? ElectronState.LONE_PAIR : ElectronState.AVAILABLE;
      e.partnerId = null;
    }

    this.lonePairs = this.electrons.filter(e => e.state === ElectronState.LONE_PAIR).length / 2;
  }

  removeBond(partnerId) {
    this.bonds = this.bonds.filter(b => b.partnerId !== partnerId);
    this.bondedElectrons = this.totalBonds;

    for (const e of this.electrons) {
      if (e.state === ElectronState.SHARED && e.partnerId === partnerId) {
        e.state = ElectronState.AVAILABLE;
        e.partnerId = null;
      }
    }
    this._updateElectronStates();
  }

  clearBonds() {
    this.bonds = [];
    this.bondedElectrons = 0;
    for (const e of this.electrons) {
      e.state = ElectronState.AVAILABLE;
      e.partnerId = null;
    }
    this.lonePairs = 0;
  }

  serialize() {
    return {
      id: this.id, element: this.element, x: this.x, y: this.y,
      bonds: this.bonds.map(b => ({ ...b })),
      lonePairs: this.lonePairs,
      bondedElectrons: this.bondedElectrons,
      electronStates: this.electrons.map(e => ({ state: e.state, partnerId: e.partnerId }))
    };
  }

  static deserialize(data) {
    const atom = new Atom(data.element, data.x, data.y);
    atom.id = data.id;
    atom.bonds = data.bonds.map(b => ({ ...b }));
    atom.bondedElectrons = data.bondedElectrons;
    atom.lonePairs = data.lonePairs;

    if (data.electronStates) {
      for (let i = 0; i < atom.electrons.length; i++) {
        const s = data.electronStates[i];
        if (s) {
          atom.electrons[i].state = s.state;
          atom.electrons[i].partnerId = s.partnerId;
        }
      }
    } else {
      atom._updateElectronStates();
    }

    if (data.id >= ATOM_ID_COUNTER) ATOM_ID_COUNTER = data.id + 1;
    return atom;
  }
}

window.ELEMENTS = ELEMENTS;
window.Atom = Atom;