/**
 * molecule.js
 * Nhận diện phân tử dựa trên danh sách nguyên tử + liên kết.
 */

let MOLECULE_DB = [];

// Tải dữ liệu phân tử từ file JSON
fetch('data/molecule.json?v=' + new Date().getTime())
  .then(response => {
    if (!response.ok) throw new Error("Không thể tải file JSON");
    return response.json();
  })
  .then(data => {
    MOLECULE_DB = data;
    console.log(`Đã tải thành công ${MOLECULE_DB.length} phân tử từ JSON!`);
  })
  .catch(error => console.error("Lỗi tải dữ liệu JSON:", error));

// Hàm phụ trợ: Tách các nguyên tử thành các cụm có liên kết với nhau
function getConnectedComponents(atoms) {
  const visited = new Set();
  const components = [];
  const atomMap = new Map(atoms.map(a => [a.id, a]));

  for (const atom of atoms) {
    if (!visited.has(atom.id)) {
      const component = [];
      const queue = [atom];
      visited.add(atom.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        component.push(curr);

        for (const b of curr.bonds) {
          const neighbor = atomMap.get(b.partnerId);
          if (neighbor && !visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        }
      }
      components.push(component);
    }
  }
  return components;
}

/**
 * So khớp 2 object đếm nguyên tử.
 * Hỗ trợ cả dạng {H:1, C:1, N:1} và dạng mảng ["H","C","N"].
 */
function sameAtomCounts(a, b) {
  if (!a || !b) return false;

  const normalize = (obj) => {
    if (Array.isArray(obj)) {
      const result = {};
      for (const el of obj) result[el] = (result[el] || 0) + 1;
      return result;
    }
    return obj;
  };

  const na = normalize(a);
  const nb = normalize(b);
  const ka = Object.keys(na);
  const kb = Object.keys(nb);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (na[k] !== nb[k]) return false;
  }
  return true;
}

function detectMolecule(atoms) {
  if (!atoms || atoms.length === 0) return null;

  const components = getConnectedComponents(atoms);
  const bondedComponent = components.find(comp => comp.length > 1 && comp.some(a => a.bonds.length > 0));

  if (!bondedComponent) {
    if (atoms.length === 1) {
      const a = atoms[0];
      return {
        formula: a.element,
        name: a.data.name,
        vietnameseName: a.data.vietnameseName,
        stable: a.isStable(),
        atomCounts: { [a.element]: 1 },
        bondCount: 0,
        structural: a.element,
        singleAtom: true
      };
    }
    return null;
  }

  const compAtoms = bondedComponent;
  const atomCounts = {};
  for (const a of compAtoms) atomCounts[a.element] = (atomCounts[a.element] || 0) + 1;

  const bondSet = new Set();
  const bondOrders = [];
  for (const a of compAtoms) {
    for (const b of a.bonds) {
      const key = [Math.min(a.id, b.partnerId), Math.max(a.id, b.partnerId)].join('-');
      if (!bondSet.has(key)) {
        bondSet.add(key);
        bondOrders.push(b.order);
      }
    }
  }

  const sortedFormula = buildFormula(atomCounts);
  const sortedBondOrders = [...bondOrders].sort((x, y) => y - x);

  // So khớp theo TẬP NGUYÊN TỬ (không dùng mol.formula vì Hill khác JSON)
  for (const mol of MOLECULE_DB) {
    if (!sameAtomCounts(mol.atoms, atomCounts)) continue;
    if (mol.bonds !== bondOrders.length) continue;

    const dbOrders = [...(mol.bondOrders || [])].sort((x, y) => y - x);
    if (arraysEqual(dbOrders, sortedBondOrders)) {
      return {
        formula: mol.formula,
        name: mol.name,
        vietnameseName: mol.vietnameseName || mol.name,
        stable: true,
        atomCounts,
        bondCount: bondOrders.length,
        structural: mol.structural || generateStructuralFormula(compAtoms)
      };
    }
  }

  // Fallback
  return {
    formula: sortedFormula,
    name: 'Chưa xác định',
    vietnameseName: 'Chưa xác định',
    stable: compAtoms.every(a => a.isStable()),
    atomCounts,
    bondCount: bondOrders.length,
    structural: generateStructuralFormula(compAtoms),
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
  if (formula === 'H3N') return 'NH3';
  return formula;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function generateStructuralFormula(atoms) {
  if (!atoms || atoms.length === 0) return '—';
  if (atoms.length === 1) return atoms[0].element;

  const atomMap = new Map(atoms.map(a => [a.id, a]));
  const visited = new Set();

  if (atoms.length === 2) {
    const a = atoms[0], b = atoms[1];
    const bond = a.bonds.find(bnd => bnd.partnerId === b.id);
    const order = bond ? bond.order : 1;
    const line = order === 3 ? '≡' : order === 2 ? '=' : '—';
    const [first, second] = a.element === 'H' ? [a, b] : [b, a];
    return `${first.element}${line}${second.element}`;
  }

  const sortedAtoms = [...atoms].sort((a, b) => b.bonds.length - a.bonds.length);
  const root = sortedAtoms[0];

  function buildBranch(atom) {
    visited.add(atom.id);
    const symbol = atom.element;

    const neighbors = [];
    for (const b of atom.bonds) {
      const nb = atomMap.get(b.partnerId);
      if (nb && !visited.has(nb.id)) {
        neighbors.push({ atom: nb, order: b.order });
      }
    }

    if (neighbors.length === 0) return symbol;

    const hCount = neighbors.filter(n => n.atom.element === 'H').length;
    const nonHNeighbors = neighbors.filter(n => n.atom.element !== 'H');

    let base = symbol;
    if (hCount > 0) base += 'H' + (hCount > 1 ? sub(hCount) : '');

    if (nonHNeighbors.length === 0) return base;

    let result = base;
    for (const n of nonHNeighbors) {
      const line = n.order === 3 ? '≡' : n.order === 2 ? '=' : '—';
      result += line + buildBranch(n.atom);
    }
    return result;
  }

  return buildBranch(root);
}

function sub(n) {
  const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
                '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(n).split('').map(c => map[c] || c).join('');
}

window.detectMolecule = detectMolecule;
window.MOLECULE_DB = MOLECULE_DB;