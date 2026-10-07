// Сумка героя. Сохраняется в браузере, чтобы не терялась после перезагрузки.
export function createInventory() {
  let items = {};
  try { items = JSON.parse(localStorage.getItem('inventory')) || {}; } catch {}
  const save = () => { try { localStorage.setItem('inventory', JSON.stringify(items)); } catch {} };
  return {
    add(id, n = 1) { items[id] = (items[id] || 0) + n; save(); },
    remove(id, n = 1) { if ((items[id] || 0) < n) return false; items[id] -= n; if (!items[id]) delete items[id]; save(); return true; },
    all: () => ({ ...items }),
  };
}
