// Дома села: контуры берутся из OpenStreetMap, свои правки — из data/houses/houses.json.
import * as THREE from 'three';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function loadOsm(lat, lon, radius = 900) {
  const q = `[out:json][timeout:25];(way(around:${radius},${lat},${lon})[building];way(around:${radius},${lat},${lon})[highway];);out geom;`;
  // Сначала локальная копия (если её сохранили), потом интернет.
  try { const r = await fetch('data/houses/osm-cache.json'); if (r.ok) return await r.json(); } catch {}
  // оба сервера сразу, ждём не дольше 8 секунд
  try {
    return await Promise.any(OVERPASS.map(async (url) => {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    }));
  } catch {}
  return null;
}

// Улицы из OpenStreetMap в координатах игры (для roads.js).
export function osmRoadLines(osm, geo) {
  if (!osm) return [];
  return osm.elements.filter(e => e.geometry && e.tags.highway).map(e => e.geometry.map(g => geo.toXZ(g.lat, g.lon)));
}

export async function createHouses(scene, terrain, geo, osm, roads) {
  const cfg = await (await fetch('data/houses/houses.json')).json();
  const houses = []; // { id, name, center, radius, mesh }

  // Стена — текстура известняка из фото села (assets/tex/wall.jpg).
  const wallTex = new THREE.TextureLoader().load('assets/tex/wall.jpg');
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(0.42, 0.55);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  // Цвета крыш как на фото: в основном серый металл, иногда красные, синие, зелёные.
  const ROOFS = ['#a8adb1', '#9aa0a4', '#b6babd', '#8d9397', '#a8adb1', '#b5483c', '#3f6f9a', '#4f7a4f', '#7a4a3a'];
  const roofMats = {};
  const roofMat = (c) => roofMats[c] || (roofMats[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide }));

  // Наименьший прямоугольник вокруг контура — по нему строим двускатную крышу.
  function orientedBox(pts) {
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ang = Math.atan2(b.z - a.z, b.x - a.x);
      const c = Math.cos(-ang), s = Math.sin(-ang);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of pts) { const x = p.x * c - p.z * s, z = p.x * s + p.z * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const area = (x1 - x0) * (z1 - z0);
      if (!best || area < best.area) {
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        best = { area, ang, w: x1 - x0, d: z1 - z0, cx: mx * Math.cos(ang) - mz * Math.sin(ang), cz: mx * Math.sin(ang) + mz * Math.cos(ang) };
      }
    }
    return best;
  }
  function gableRoof(box, color) {
    const long = box.w >= box.d, L = (long ? box.w : box.d) + 0.6, W = (long ? box.d : box.w) + 0.6, H = Math.min(2.5, W * 0.3);
    const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, H)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
    g.translate(0, 0, -L / 2);
    const m = new THREE.Mesh(g, roofMat(color));
    m.rotation.y = -box.ang + (long ? Math.PI / 2 : 0);
    return m;
  }

  function addHouse(id, pts, opts = {}) {
    if (pts.length < 3) return;
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.z)));
    let minY = Infinity, cx = 0, cz = 0;
    for (const p of pts) { minY = Math.min(minY, terrain.heightAt(p.x, p.z)); cx += p.x; cz += p.z; }
    cx /= pts.length; cz /= pts.length;
    const radius = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.z - cz)));
    const floors = opts.floors || (Math.random() < 0.6 ? 2 : 1);
    const height = floors * 3 + 1.5; // +1.5 м уходит в склон
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    const wall = new THREE.Color(opts.color || '#ffffff').offsetHSL(0, 0, -Math.random() * 0.12);
    const roofColor = opts.roofColor || ROOFS[Math.floor(Math.random() * ROOFS.length)];
    const mesh = new THREE.Mesh(geom, [roofMat('#8d8478'), new THREE.MeshLambertMaterial({ color: wall, map: wallTex })]);
    mesh.position.y = minY - 1.5;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.houseId = id;
    scene.add(mesh);
    const top = mesh.position.y + height;
    let roof = null;
    const box = orientedBox(pts);
    if (opts.roof !== 'flat') {
      roof = gableRoof(box, roofColor);
      roof.position.set(box.cx, top, box.cz);
      roof.castShadow = true; scene.add(roof);
    }
    houses.push({ id, name: opts.name, photo: opts.photo, center: new THREE.Vector3(cx, minY, cz), radius, top, mesh, roof, box, floors, ground: minY, maxY: Math.max(...pts.map(p => terrain.heightAt(p.x, p.z))), gen: id.startsWith('gen-') });
  }

  if (osm) {
    for (const el of osm.elements) {
      if (!el.geometry || !el.tags.building) continue;
      const pts = el.geometry.map(g => geo.toXZ(g.lat, g.lon));
      const o = cfg.houses[el.id] || {};
      const lv = parseInt(el.tags['building:levels']);
      addHouse(String(el.id), pts.slice(0, -1), { floors: lv || undefined, ...o });
    }
  }
  // Если OpenStreetMap недоступен — строим село вдоль улиц, как в Бутри: дома стоят рядами по обе стороны.
  const free = (pts, gap) => pts.every(p => roads.distToRoad(p.x, p.z) > gap) &&
    !houses.some(h => pts.some(p => Math.hypot(h.center.x - p.x, h.center.z - p.z) < h.radius + 1.5));
  const rect = (x, z, ang, w, d) => { const c = Math.cos(ang), s2 = Math.sin(ang); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => ({ x: x + u * c - v * s2, z: z + u * s2 + v * c })); };
  if (houses.length < 20) {
    let n = 0;
    for (const { kind, pts } of roads.lines) {
      if (kind === 'path') continue;
      let next = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i]; if (Math.hypot(p.x, p.z) > 380) continue;
        if ((next -= 3) > 0) continue; // шаг вдоль улицы
        const a = pts[i - 1], b = pts[i + 1], ang = Math.atan2(b.z - a.z, b.x - a.x);
        for (const side of [1, -1]) {
          if (Math.random() < 0.15) continue; // кое-где пустыри и огороды
          const w = 8 + Math.random() * 5, d = 6 + Math.random() * 3, off = (kind === 'main' ? 2.75 : 1.8) + 2.5 + d / 2 + Math.random() * 2;
          const x = p.x - Math.sin(ang) * off * side, z = p.z + Math.cos(ang) * off * side;
          const r = rect(x, z, ang, w, d);
          if (free(r, 1.2)) addHouse('gen-' + n++, r, {});
        }
        next = 14 + Math.random() * 6;
      }
    }
    // Ещё немного домов между улицами (на склонах выше и ниже).
    for (let tries = 0; tries < 3000 && n < 330; tries++) {
      const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * 300, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (roads.distToRoad(x, z) > 40) continue; // не слишком далеко от улицы
      const gx = terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z), gz = terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1);
      const r = rect(x, z, Math.atan2(gz, gx) + Math.PI / 2, 7 + Math.random() * 5, 6 + Math.random() * 3);
      if (free(r, 2)) addHouse('gen-' + n++, r, {});
    }
  }

  for (const e of cfg.extra || []) {
    const { x, z, w, d } = e;
    addHouse(e.id || `extra-${x}-${z}`, [{ x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 }, { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 }], e);
  }

  // Убрать дома, которые стоят на месте мечети, магазина и т.п.
  function clearAround(x, z, r) {
    for (let i = houses.length - 1; i >= 0; i--) {
      const h = houses[i];
      if (Math.hypot(h.center.x - x, h.center.z - z) < r + h.radius) { scene.remove(h.mesh); if (h.roof) scene.remove(h.roof); houses.splice(i, 1); }
    }
  }
  return { houses, loaded: !!osm, clearAround };
}
