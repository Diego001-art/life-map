// Рюкзак героя: ячейки (сейчас 20, число задаётся в data/items.json → backpack.slots)
// и надетые вещи (голова, тело, ноги, рука, шея, пояс). Сохраняется в браузере.
export const EQUIP_SLOTS = ['head', 'neck', 'body', 'belt', 'hand', 'dagger', 'feet'];

export function createInventory(cfg, onChange = () => {}) {
  const defs = cfg.defs;
  const stackOf = (id) => (defs[id] && defs[id].stack) || 20;
  let st = null;
  try { st = JSON.parse(localStorage.getItem('backpack')); } catch {}
  if (!st) {
    st = { size: cfg.backpack.slots, slots: Array(cfg.backpack.slots).fill(null), equip: {} };
    // перенос старой «сумки» (прошлые версии игры)
    try { const old = JSON.parse(localStorage.getItem('inventory')) || {}; for (const id in old) addRaw(id, old[id]); } catch {}
  }
  st.size = Math.max(st.size, cfg.backpack.slots);
  // старые сохранения: выдать кинжал, если его ещё нет
  if (st.equip && Object.keys(st.equip).length && !st.equip.dagger && !st.slots.some(x => x && x.id === 'kinjal')) st.equip.dagger = 'kinjal';
  while (st.slots.length < st.size) st.slots.push(null);
  const save = () => { try { localStorage.setItem('backpack', JSON.stringify(st)); } catch {} onChange(); };

  // Положить предметы; возвращает, сколько не поместилось.
  function addRaw(id, n) {
    for (const s of st.slots) if (n > 0 && s && s.id === id && s.n < stackOf(id)) { const k = Math.min(n, stackOf(id) - s.n); s.n += k; n -= k; }
    for (let i = 0; i < st.slots.length && n > 0; i++) if (!st.slots[i]) { const k = Math.min(n, stackOf(id)); st.slots[i] = { id, n: k }; n -= k; }
    return n;
  }
  const inv = {
    defs,
    get slots() { return st.slots; },
    get equipped() { return st.equip; },
    // Новый герой получает стартовые вещи.
    giveStart() { st.equip = { ...cfg.start.equip }; for (const id in cfg.start.items) addRaw(id, cfg.start.items[id]); save(); },
    reset() { st = { size: cfg.backpack.slots, slots: Array(cfg.backpack.slots).fill(null), equip: {} }; save(); },
    canAdd(id, n = 1) { let room = 0; for (const s of st.slots) room += !s ? stackOf(id) : s.id === id ? stackOf(id) - s.n : 0; return room >= n; },
    add(id, n = 1) { const left = addRaw(id, n); save(); return left; },
    remove(id, n = 1) {
      if ((inv.all()[id] || 0) < n) return false;
      for (let i = st.slots.length - 1; i >= 0 && n > 0; i--) { const s = st.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) st.slots[i] = null; } }
      save(); return true;
    },
    // Сколько каждого предмета всего (в рюкзаке + надето) — для квестов.
    all() { const o = {}; for (const s of st.slots) if (s) o[s.id] = (o[s.id] || 0) + s.n; for (const k in st.equip) if (st.equip[k]) o[st.equip[k]] = (o[st.equip[k]] || 0) + 1; return o; },
    // Нажали на ячейку рюкзака: надеть вещь (старая вернётся в рюкзак).
    useSlot(i) {
      const s = st.slots[i], d = s && defs[s.id]; if (!d || !d.equip) return false;
      const old = st.equip[d.equip]; st.equip[d.equip] = s.id; st.slots[i] = old ? { id: old, n: 1 } : null; save(); return true;
    },
    // Снять вещь в рюкзак.
    unequip(slot) {
      const id = st.equip[slot]; if (!id) return false;
      const i = st.slots.findIndex(x => !x); if (i < 0) return false;
      st.slots[i] = { id, n: 1 }; delete st.equip[slot]; save(); return true;
    },
  };
  return inv;
}
