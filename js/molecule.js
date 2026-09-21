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

function detectMolecule(atoms) {
  if (!atoms || atoms.length === 0) return null;

  // 1. Phân chia các nguyên tử thành các cụm liên kết độc lập
  const components = getConnectedComponents(atoms);
  
  // 2. Tìm cụm nguyên tử nào có chứa liên kết (kích thước cụm > 1 và có ít nhất 1 liên kết)
  const bondedComponent = components.find(comp => comp.length > 1 && comp.some(a => a.bonds.length > 0));

  if (!bondedComponent) {
    // Nếu màn hình chỉ có 1 nguyên tử duy nhất
    if (atoms.length === 1) {
      const a = atoms[0];
      return {
        formula: a.element,
        name: a.data.name,
        vietnameseName: a.data.vietnameseName,
        stable: a.isStable(),
        atomCounts: { [a.element]: 1 },
        bondCount: 0,
        structural: generateStructuralFormula([a]), 
        singleAtom: true
      };
    }
    // Nếu có nhiều nguyên tử nhưng tất cả đều đứng rời rạc
    return null; 
  }

  // 3. Chỉ nhận diện phân tử trên cụm đang được liên kết với nhau (bỏ qua các nguyên tử đứng ngoài)
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

  // So khớp 1: Khớp hoàn toàn cả công thức lẫn số lượng liên kết
  for (const mol of MOLECULE_DB) {
    if (mol.formula === sortedFormula && mol.bonds === bondOrders.length) {
      const dbOrders = [...mol.bondOrders].sort((x, y) => y - x);
      if (arraysEqual(dbOrders, sortedBondOrders)) {
        return {
          formula: mol.formula, name: mol.name, vietnameseName: mol.vietnameseName,
          stable: true, atomCounts, bondCount: bondOrders.length,
          structural: mol.structural || generateStructuralFormula(compAtoms)
        };
      }
    }
  }
  // So khớp 3: Hoàn toàn chưa xác định
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
  if (formula === 'H3N') {
    return 'NH3';
  }

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

  // Nếu là phân tử 2 nguyên tử (như O2, HCl, Cl2, H2...)
  if (atoms.length === 2) {
    const a = atoms[0], b = atoms[1];
    const bond = a.bonds.find(bnd => bnd.partnerId === b.id);
    const order = bond ? bond.order : 1;
    const line = order === 3 ? '≡' : order === 2 ? '=' : '—';
    return `${a.element}${line}${b.element}`;
  }

  // Đối với các phân tử phổ biến khác
  const atomCounts = {};
  for (const a of atoms) {
    atomCounts[a.element] = (atomCounts[a.element] || 0) + 1;
  }

  const formula = buildFormula(atomCounts);
  
  if (formula === 'CO2') return 'O=C=O';
  if (formula === 'H2O') return 'H—O—H';
  if (formula === 'NH3') return 'H—N(H)—H';
  if (formula === 'CH4') return 'C—(H)₄';
  if (formula === 'HCl') return 'H—Cl';
  if (formula === 'CH3Cl') return 'CH₃—Cl';

  return formula;
}

window.detectMolecule = detectMolecule;
window.MOLECULE_DB = MOLECULE_DB;