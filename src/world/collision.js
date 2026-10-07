// Коллизии (невидимые простые формы, которые не рисуются):
//   box    — повёрнутый прямоугольник: дома (стены, двери, окна, цоколь), веранды, ограды, лавки, мечеть, магазин;
//   circle — круг: стволы деревьев, большие камни, колодец, башня, жители.
// Герой «капсула» радиусом 0.4 м: не проходит сквозь препятствия, а скользит вдоль стен.
// Внутрь домов попасть нельзя: у дома нет проёмов — дверь и окна тоже часть сплошной стены.
// Слои: WORLD (дома, ограды, деревья, камни) и NPC (жители). Трава, листва, мелкие камни коллизий не имеют.

const CELL = 12;

export function createCollision({ radiusLimit = 965 } = {}) {
  const grid = new Map(), dynamic = [];
  const key = (i, j) => i * 100003 + j;
  function insert(c) {
    const r = c.type === 'circle' ? c.r : Math.hypot(c.w, c.d) / 2;
    const x = c.type === 'circle' ? c.x : c.cx, z = c.type === 'circle' ? c.z : c.cz;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c);
      }
  }
  function near(x, z, layerNpc = true) {
    const out = new Set(), i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of grid.get(key(i + a, j + b)) || []) out.add(c);
    if (layerNpc) for (const d of dynamic) if (Math.abs(d.x - x) < 20 && Math.abs(d.z - z) < 20) out.add(d);
    return out;
  }
  // Вытолкнуть круг (x, z, r) из препятствия. Возвращает поправку или null.
  function push(c, x, z, r, y) {
    if (y !== undefined && c.top !== undefined && y > c.top) return null; // запрыгнул выше препятствия
    if (c.type === 'circle') {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d >= m) return null;
      if (d < 1e-4) return [m, 0];
      return [dx / d * (m - d), dz / d * (m - d)];
    }
    // прямоугольник: переходим в его систему координат
    const cs = Math.cos(-c.ang), sn = Math.sin(-c.ang), dx = x - c.cx, dz = z - c.cz;
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, hw = c.w / 2, hd = c.d / 2;
    const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
    let px, pz;
    if (qx === lx && qz === lz) { // центр внутри — выталкиваем к ближайшей стороне
      const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz);
      if (ex < ez) { px = Math.sign(lx || 1) * (ex + r); pz = 0; } else { px = 0; pz = Math.sign(lz || 1) * (ez + r); }
    } else {
      const ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
      if (d >= r) return null;
      px = ox / d * (r - d); pz = oz / d * (r - d);
    }
    // обратно в мировые координаты
    const cw = Math.cos(c.ang), sw = Math.sin(c.ang);
    return [px * cw - pz * sw, px * sw + pz * cw];
  }
  return {
    add(list) { for (const c of list) insert(c); },
    addDynamic(c) { dynamic.push(c); return c; },
    // Сдвинуть героя из препятствий (несколько проходов — для углов).
    resolve(pos, r = 0.4, y) {
      for (let it = 0; it < 3; it++) {
        let moved = false;
        for (const c of near(pos.x, pos.z)) {
          if (c.self) continue;
          const p = push(c, pos.x, pos.z, r, y);
          if (p) { pos.x += p[0]; pos.z += p[1]; moved = true; }
        }
        if (!moved) break;
      }
      // естественная граница мира: за кольцом скал не пройти
      const d = Math.hypot(pos.x, pos.z);
      if (d > radiusLimit) { pos.x *= radiusLimit / d; pos.z *= radiusLimit / d; }
      return pos;
    },
    // Точка внутри препятствия? (для камеры)
    blocked(x, y, z, r = 0.25) {
      for (const c of near(x, z, false)) if (push(c, x, z, r, y)) return true;
      return false;
    },
    radiusLimit,
    // какие препятствия в точке (для отладки)
    whoBlocks(x, z, r = 0.4) { return [...near(x, z, false)].filter(c => push(c, x, z, r)); },
  };
}

// Коллизии домов: сплошной прямоугольник по стенам (с цоколем). Проёмов нет — внутрь не попасть.
export function houseColliders(houses) {
  return houses.filter(h => h.box).map(h => ({ type: 'box', cx: h.box.cx, cz: h.box.cz, ang: h.box.ang, w: h.box.w + 0.2, d: h.box.d + 0.2, top: h.top + 3 }));
}
