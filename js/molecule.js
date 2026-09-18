/**
 * molecule.js
 * Nhận diện phân tử dựa trên danh sách nguyên tử + liên kết.
 */

const MOLECULE_DB = [
  { formula: 'H2', name: 'Hydrogen', vietnameseName: 'Hydro', atoms: { H: 2 }, bonds: 1, bondOrders: [1] },
  { formula: 'O2', name: 'Oxygen', vietnameseName: 'Oxy', atoms: { O: 2 }, bonds: 1, bondOrders: [2] },
  { formula: 'N2', name: 'Nitrogen', vietnameseName: 'Nitơ', atoms: { N: 2 }, bonds: 1, bondOrders: [3] },
  { formula: 'F2', name: 'Fluorine', vietnameseName: 'Flo', atoms: { F: 2 }, bonds: 1, bondOrders: [1] },
  { formula: 'HF', name: 'Hydrogen fluoride', vietnameseName: 'Hydro florua', atoms: { H: 1, F: 1 }, bonds: 1, bondOrders: [1] },
  { formula: 'H2O', name: 'Water', vietnameseName: 'Nước', atoms: { H: 2, O: 1 }, bonds: 2, bondOrders: [1, 1] },
  { formula: 'NH3', name: 'Ammonia', vietnameseName: 'Amoniac', atoms: { N: 1, H: 3 }, bonds: 3, bondOrders: [1, 1, 1] },
  { formula: 'CH4', name: 'Methane', vietnameseName: 'Metan', atoms: { C: 1, H: 4 }, bonds: 4, bondOrders: [1, 1, 1, 1] },
  { formula: 'CO2', name: 'Carbon dioxide', vietnameseName: 'Cacbon đioxit', atoms: { C: 1, O: 2 }, bonds: 2, bondOrders: [2, 2] },
  { formula: 'CF4', name: 'Carbon tetrafluoride', vietnameseName: 'Cacbon tetraflorua', atoms: { C: 1, F: 4 }, bonds: 4, bondOrders: [1, 1, 1, 1] },
  { formula: 'CH3F', name: 'Methyl fluoride', vietnameseName: 'Metyl florua', atoms: { C: 1, H: 3, F: 1 }, bonds: 4, bondOrders: [1, 1, 1, 1] },
  { formula: 'CH2F2', name: 'Difluoromethane', vietnameseName: 'Điflorometan', atoms: { C: 1, H: 2, F: 2 }, bonds: 4, bondOrders: [1, 1, 1, 1] },
  { formula: 'CHF3', name: 'Fluoroform', vietnameseName: 'Floroform', atoms: { C: 1, H: 1, F: 3 }, bonds: 4, bondOrders: [1, 1, 1, 1] },
  { formula: 'C2H6', name: 'Ethane', vietnameseName: 'Etan', atoms: { C: 2, H: 6 }, bonds: 7, bondOrders: [1, 1, 1, 1, 1, 1, 1] },
  { formula: 'C2H4', name: 'Ethene', vietnameseName: 'Eten', atoms: { C: 2, H: 4 }, bonds: 5, bondOrders: [2, 1, 1, 1, 1] },
  { formula: 'C2H2', name: 'Ethyne', vietnameseName: 'Etin', atoms: { C: 2, H: 2 }, bonds: 3, bondOrders: [3, 1, 1] }
];

function detectMolecule(atoms) {
  if (!atoms || atoms.length === 0) return null;

  const atomCounts = {};
  for (const a of atoms) atomCounts[a.element] = (atomCounts[a.element] || 0) + 1;

  const bondSet = new Set();
  const bondOrders = [];
  for (const a of atoms) {
    for (const b of a.bonds) {
      const key = [Math.min(a.id, b.partnerId), Math.max(a.id, b.partnerId)].join('-');
      if (!bondSet.has(key)) {
        bondSet.add(key);
        bondOrders.push(b.order);
      }
    }
  }

  if (atoms.length === 1) {
    const a = atoms[0];
    return {
      formula: a.element,
      name: a.data.name,
      vietnameseName: a.data.vietnameseName,
      stable: a.isStable(),
      atomCounts,
      bondCount: 0,
      singleAtom: true
    };
  }

  const sortedFormula = buildFormula(atomCounts);
  const sortedBondOrders = [...bondOrders].sort((x, y) => y - x);

  for (const mol of MOLECULE_DB) {
    if (mol.formula === sortedFormula && mol.bonds === bondOrders.length) {
      const dbOrders = [...mol.bondOrders].sort((x, y) => y - x);
      if (arraysEqual(dbOrders, sortedBondOrders)) {
        return {
          formula: mol.formula, name: mol.name, vietnameseName: mol.vietnameseName,
          stable: true, atomCounts, bondCount: bondOrders.length
        };
      }
    }
  }

  return {
    formula: sortedFormula,
    name: 'Chưa xác định',
    vietnameseName: 'Chưa xác định',
    stable: atoms.every(a => a.isStable()),
    atomCounts,
    bondCount: bondOrders.length,
    unknown: true
  };
}

function buildFormula(counts) {
  const c = { ...counts };
  let formula = '';
  if (c.C) { formula += 'C' + (c.C > 1 ? c.C : ''); delete c.C; }
  if (c.H) { formula += 'H' + (c.H > 1 ? c.H : ''); delete c.H; }
  for (const el of Object.keys(c).sort()) {
    formula += el + (c[el] > 1 ? c[el] : '');
  }
  return formula;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

window.detectMolecule = detectMolecule;
window.MOLECULE_DB = MOLECULE_DB;