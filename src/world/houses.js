// Дома села: контуры берутся из OpenStreetMap, свои правки — из data/houses/houses.json.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from './textures.js';

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

export async function createHouses(scene, terrain, geo, osm, roads) { // roads.layout — планировка со спутника
  const cfg = await (await fetch('data/houses/houses.json')).json();
  const houses = []; // { id, name, center, radius, mesh }

  // Стены — известняковая кладка (текстура рисуется кодом, см. textures.js), несколько оттенков камня.
  const WALLS = ['#ffffff', '#f2e9d8', '#e6dccb', '#fbf3e4', '#d9d2c4'].map(c => pbr('masonry', { color: c, repeat: 0.3, roughness: 0.92, normal: 1.2 }));
  // Крыши — гофрированная жесть: в основном серая, иногда красная, синяя, зелёная; кое-где ржавчина.
  const ROOFS = ['#b4b9bd', '#a5abaf', '#c2c6c9', '#9aa0a4', '#b4b9bd', '#a8443a', '#3f6f9a', '#4f7a4f', '#7a4a3a'];
  const roofMats = {};
  const roofMat = (c) => {
    if (roofMats[c]) return roofMats[c];
    const m = pbr('roof', { color: c, repeat: 0.5, roughness: 0.55, metalness: 0.35, normal: 1.4, side: THREE.DoubleSide });
    for (const t of [m.map, m.normalMap]) { t.rotation = Math.PI / 2; } // волны жести идут вниз по скату
    return roofMats[c] = m;
  };
  const capMat = pbr('plaster', { color: '#8d8478' });
  const plinthMat = pbr('rock', { color: '#c9c0b0', repeat: 0.35, normal: 1.5 });

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
    const height = opts.shed ? 3.9 : floors * 3 + 1.5; // +1.5 м уходит в склон (сарай ниже дома)
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    const roofColor = opts.roofColor || ROOFS[Math.floor(Math.random() * ROOFS.length)];
    if (opts.shed) opts.floors = 1;
    const wallMat = opts.color ? pbr('masonry', { color: opts.color, repeat: 0.3, roughness: 0.92 }) : WALLS[Math.floor(Math.random() * WALLS.length)];
    const mesh = new THREE.Mesh(geom, [capMat, wallMat]);
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
    // каменный цоколь: на склоне снизу виден фундамент из бутового камня
    let plinth = null;
    if (pts.length === 4) {
      const maxY = Math.max(...pts.map(p => terrain.heightAt(p.x, p.z)));
      const ph = maxY - minY + 2.1, pg = new THREE.BoxGeometry(box.w + 0.16, ph, box.d + 0.16);
      const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (box.w + box.d) / 2, uv.getY(i) * ph); // камни нормального размера
      plinth = new THREE.Mesh(pg, plinthMat);
      plinth.position.set(box.cx, minY - 1.5 + ph / 2, box.cz); plinth.rotation.y = -box.ang;
      plinth.castShadow = plinth.receiveShadow = true; scene.add(plinth);
    }
    houses.push({ roofColor, shed: !!opts.shed, plinth, id, name: opts.name, photo: opts.photo, center: new THREE.Vector3(cx, minY, cz), radius, top, mesh, roof, box, floors, ground: minY, maxY: Math.max(...pts.map(p => terrain.heightAt(p.x, p.z))), gen: id.startsWith('gen-') });
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
  // Если OpenStreetMap недоступен — строим село по планировке спутниковой карты (data/layout):
  // дома стоят вдоль улиц и переулков там, где на карте застройка, с той же плотностью; между ними — дворы и сады.
  // Внешний вид — прежний, по фото села: модули домов комбинируются (размер, этажность, крыша, пристройка, сарай во дворе).
  // проверяем не только углы, а сетку точек по всей площади дома — чтобы переулок не прошёл сквозь середину
  const inner = (pts) => { const o = []; for (let k = 0; k + 3 < pts.length; k += 4) { const [a, b, , d] = pts.slice(k, k + 4); for (let u = 0; u <= 1.001; u += 0.25) for (let v = 0; v <= 1.001; v += 0.25) o.push({ x: a.x + (b.x - a.x) * u + (d.x - a.x) * v, z: a.z + (b.z - a.z) * u + (d.z - a.z) * v }); } return o; };
  const free = (pts, gap, ignore = null) => inner(pts).every(p => roads.distToRoad(p.x, p.z) > gap) &&
    !houses.some(h => h !== ignore && pts.some(p => Math.hypot(h.center.x - p.x, h.center.z - p.z) < h.radius + 1.2));
  const rect = (x, z, ang, w, d) => { const c = Math.cos(ang), s2 = Math.sin(ang); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => ({ x: x + u * c - v * s2, z: z + u * s2 + v * c })); };
  const R = (a, b) => a + Math.random() * (b - a);
  // Модули домов (House_A..D) — комбинации размеров, этажности и крыши
  const TYPES = [
    { id: 'A', w: [9, 13], d: [7, 9], floors: 2, roof: 'gable', p: 0.38 },   // двухэтажный, двускатная жестяная крыша
    { id: 'B', w: [7, 10], d: [6, 8], floors: 1, roof: 'gable', p: 0.24 },   // одноэтажный
    { id: 'C', w: [10, 14], d: [8, 11], floors: 2, roof: 'flat', p: 0.16 },  // плоская крыша (старые дома)
    { id: 'D', w: [9, 12], d: [7, 9], floors: 2, roof: 'gable', wing: true, p: 0.22 }, // с пристройкой (Г-образный)
  ];
  const pickType = () => { let r = Math.random(); for (const t of TYPES) if ((r -= t.p) <= 0) return t; return TYPES[0]; };
  const villageAt = (x, z) => roads.layout && roads.layout.has ? roads.layout.village(x, z) : Math.max(0, 1 - Math.hypot(x, z) / 380);
  const slopeOk = (pts) => { const hs = pts.map(p => terrain.heightAt(p.x, p.z)); return Math.max(...hs) - Math.min(...hs) < 5.5; };
  let n = 0;
  function placeHouse(x, z, ang, type, gap = 1.0) {
    const w = R(...type.w), d = R(...type.d), main = rect(x, z, ang, w, d);
    let wing = null;
    if (type.wing) { // пристройка сбоку-сзади
      const ww = R(4.5, 6.5), wd = R(4, 6), side = Math.random() < 0.5 ? 1 : -1, c = Math.cos(ang), s2 = Math.sin(ang);
      const u = side * (w / 2 + ww / 2 - 0.05), v = d / 2 - wd / 2 + R(1.5, 3);
      wing = rect(x + u * c - v * s2, z + u * s2 + v * c, ang, ww, wd);
    }
    const all = wing ? main.concat(wing) : main;
    if (!free(all, gap) || !slopeOk(all)) return null;
    addHouse('gen-' + n++, main, { floors: type.floors, roof: type.roof });
    const h = houses[houses.length - 1];
    if (wing) addHouse('gen-' + n++, wing, { floors: 1, roof: Math.random() < 0.5 ? 'flat' : 'gable', roofColor: h.roofColor });
    return h;
  }
  if (houses.length < 20) {
    // 1) вдоль улиц и переулков — по обе стороны, фасадом к дороге
    for (const { kind, pts } of roads.lines) {
      if (!['main', 'street', 'lane'].includes(kind)) continue;
      const half = { main: 2.75, street: 2, lane: 1.5 }[kind];
      let next = Math.random() * 6;
      for (let i = 1; i < pts.length - 1; i++) {
        if ((next -= 3) > 0) continue;
        const p = pts[i], a = pts[i - 1], b = pts[i + 1], ang = Math.atan2(b.z - a.z, b.x - a.x);
        for (const side of [1, -1]) {
          const t = pickType(), d = t.d[1], off = half + 1.6 + d / 2 + Math.random() * 1.5;
          const x = p.x - Math.sin(ang) * off * side, z = p.z + Math.cos(ang) * off * side;
          const dens = villageAt(x, z);
          if (dens < 0.15 || Math.random() > Math.pow(dens, 0.6)) continue;   // плотность — как на карте
          placeHouse(x, z, ang + R(-0.05, 0.05), t);
        }
        next = 9 + Math.random() * 4;
      }
    }
    // 2) внутри кварталов — дома во второй линии (на склонах выше и ниже улиц)
    for (let tries = 0; tries < 30000 && n < 1000; tries++) {
      const x = R(-1000, 1000), z = R(-1000, 1000), dens = villageAt(x, z);
      if (dens < 0.35 || Math.random() > dens) continue;
      const dr = roads.distToRoad(x, z);
      if (dr < 6 || dr > 45) continue;
      const gx = terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z), gz = terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1);
      placeHouse(x, z, Math.atan2(gz, gx) + Math.PI / 2 + R(-0.15, 0.15), pickType(), 1.5); // длинной стороной вдоль склона
    }
    // 3) хозяйственные постройки (сараи, хлева) во дворах — позади домов
    const owners = houses.slice();
    for (const h of owners) {
      if (Math.random() > 0.35 || !h.box) continue;
      const { ang, d, cx, cz } = h.box, nx = -Math.sin(ang), nz = Math.cos(ang);
      const back = roads.distToRoad(cx + nx * (d / 2 + 4), cz + nz * (d / 2 + 4)) > roads.distToRoad(cx - nx * (d / 2 + 4), cz - nz * (d / 2 + 4)) ? 1 : -1;
      const sw = R(3.5, 5.5), sd = R(3, 4), off = d / 2 + sd / 2 + R(2.5, 5), along = R(-3, 3);
      const x = cx + nx * back * off + Math.cos(ang) * along, z = cz + nz * back * off + Math.sin(ang) * along;
      const r = rect(x, z, ang + R(-0.1, 0.1), sw, sd);
      if (free(r, 1.2, h) && slopeOk(r)) addHouse('shed-' + n++, r, { floors: 1, roof: 'flat', shed: true });
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
      if (Math.hypot(h.center.x - x, h.center.z - z) < r + h.radius) { scene.remove(h.mesh); if (h.roof) scene.remove(h.roof); if (h.plinth) scene.remove(h.plinth); houses.splice(i, 1); }
    }
  }
  // Объединить все стены, цоколи и крыши в несколько больших мешей — так браузеру намного легче рисовать.
  function bake() {
    const groups = new Map();
    // каждый участок мира 256×256 м — отдельные меши: невидимые за камерой участки не рисуются (frustum culling)
    const CH = 256, chunkOf = (h) => Math.floor((h.center.x + 1024) / CH) + ':' + Math.floor((h.center.z + 1024) / CH);
    let chunk = '';
    const take = (mesh) => {
      if (!mesh) return;
      mesh.updateMatrixWorld(true);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (geo.index) geo = geo.toNonIndexed();
      if (mats.length > 1 && geo.groups.length) {
        for (const gr of geo.groups) { // разрезаем по материалам (стены отдельно, торцы отдельно)
          const sub = new THREE.BufferGeometry();
          for (const name of ['position', 'normal', 'uv']) {
            const at = geo.attributes[name];
            sub.setAttribute(name, new THREE.BufferAttribute(at.array.slice(gr.start * at.itemSize, (gr.start + gr.count) * at.itemSize), at.itemSize));
          }
          add(mats[gr.materialIndex], sub);
        }
      } else add(mats[0], geo);
      scene.remove(mesh);
    };
    const add = (mat, geo) => { for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); geo.clearGroups(); const key = chunk + '|' + mat.uuid; if (!groups.has(key)) groups.set(key, { mat, list: [] }); groups.get(key).list.push(geo); };
    for (const h of houses) { chunk = chunkOf(h); take(h.mesh); take(h.roof); take(h.plinth); }
    let count = 0;
    for (const { mat, list } of groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.castShadow = m.receiveShadow = true; scene.add(m); count++;
    }
    console.info('Дома:', houses.length, '· мешей после объединения по участкам:', count);
  }
  return { houses, loaded: !!osm, clearAround, bake };
}
