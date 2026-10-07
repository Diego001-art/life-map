// Дороги и тропинки. Прокладываются по рельефу (по самым пологим местам), как настоящие горные дороги:
//  - главная дорога проходит через центр села от края до края карты;
//  - улицы расходятся от неё по селу;
//  - тропинки ведут к особым местам (пещера, камень нарта, башня, родник, пастбище).
// Если есть планировка со спутниковой карты (data/layout) — главные дороги, улицы и переулки берутся с неё,
// а тропинки к особым местам прокладываются по склонам до ближайшей дороги. Если OpenStreetMap загрузился — его улицы рисуются тоже.
import * as THREE from 'three';
import { tex } from './textures.js';

const N = 161;            // размер сетки поиска пути (как карта высот)
const STYLES = {
  main:   { width: 5.5, color: '#8f8676' },  // главная дорога — серый щебень
  street: { width: 4, color: '#9d917c' },    // улицы села
  lane:   { width: 3, color: '#a69a86' },    // переулки
  path:   { width: 1.5, color: '#a88d63' },  // тропинки — утоптанная земля
};

// Поиск самого «лёгкого» пути по склонам (Дейкстра). Идёт от start, пока не дойдёт до любой клетки из goal.
function findPath(H, step, start, goal, slopeCost) {
  const dist = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1);
  const heap = [[0, start]]; dist[start] = 0;
  const push = (v) => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    if (goal(u)) { const path = []; for (let v = u; v !== -1; v = prev[v]) path.push(v); return path.reverse(); }
    const r = Math.floor(u / N), c = u % N;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const v = rr * N + cc, len = Math.hypot(dr, dc) * step, slope = Math.abs(H[v] - H[u]) / len;
      const nd = d + len * (1 + slopeCost * slope * slope * 40);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); }
    }
  }
  return null;
}

// Сгладить ломаную (метод Чайкина) и разбить на точки через ~3 м.
function smooth(pts, iters = 3) {
  for (let k = 0; k < iters; k++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  const out = [pts[0]];
  for (const p of pts) { const l = out[out.length - 1]; if (Math.hypot(p.x - l.x, p.z - l.z) >= 3) out.push(p); }
  if (out.length > 1) out.push(pts[pts.length - 1]);
  return out;
}

export function createRoads(scene, terrain, places, osmLines = [], layout = null) {
  const size = terrain.size, step = size / (N - 1);
  const H = new Float32Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) H[r * N + c] = terrain.heightAt(-size / 2 + c * step, -size / 2 + r * step);
  const cell = (x, z) => Math.round((z + size / 2) / step) * N + Math.round((x + size / 2) / step);
  const toXZ = (i) => ({ x: -size / 2 + (i % N) * step, z: -size / 2 + Math.floor(i / N) * step });

  const onRoad = new Uint8Array(N * N);
  const lines = []; // { kind, pts }
  const add = (kind, cells) => { if (!cells || cells.length < 2) return; cells.forEach(i => onRoad[i] = 1); lines.push({ kind, pts: smooth(cells.map(toXZ)) }); };

  if (layout && layout.lines.length) {
    // планировка по спутниковой карте
    for (const l of layout.lines) {
      lines.push({ kind: l.kind, pts: l.pts });
      if (l.kind !== 'river') for (const p of l.pts) onRoad[cell(p.x, p.z)] = 1;
    }
  } else {
  // 1) Главная дорога: от самой низкой точки края карты (вход из долины) через центр к другому краю.
  const edge = [];
  for (let i = 4; i < N - 4; i += 2) edge.push(i, (N - 1) * N + i, i * N, i * N + N - 1);
  edge.sort((a, b) => H[a] - H[b]);
  const entry = edge[0];
  const exit = edge.find(e => { const a = toXZ(e), b = toXZ(entry); return Math.hypot(a.x - b.x, a.z - b.z) > size * 0.8; });
  const center = cell(0, 0);
  const m1 = findPath(H, step, entry, (u) => u === center, 1.5);
  add('main', m1);
  add('main', findPath(H, step, exit, (u) => onRoad[u], 1.5));

  // 2) Улицы: от разных концов села к главной дороге.
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + 0.3, r = 160 + (k % 3) * 70;
    add('street', findPath(H, step, cell(Math.cos(a) * r, Math.sin(a) * r), (u) => onRoad[u], 2.5));
  }
  }
  // 3) Тропинки к особым местам.
  for (const p of Object.values(places)) {
    if (!onRoad[cell(p.pos.x, p.pos.z)]) add('path', findPath(H, step, cell(p.pos.x, p.pos.z), (u) => onRoad[u], 3));
  }
  // 4) Улицы из OpenStreetMap (если загрузились).
  for (const l of osmLines) if (l.length > 1) lines.push({ kind: 'street', pts: l });

  // --- Рисуем полосы, лежащие на земле: текстура щебня с колеями, мягкие травянистые края ---
  // Каждая точка ленты кладётся по высоте земли (поэтому дорога не висит и не уходит в склон).
  const samples = []; // точки дорог для быстрых проверок «далеко ли до дороги»
  const roadTex = tex('road');
  for (const kind of ['path', 'lane', 'street', 'main']) {
    const st = STYLES[kind], verts = [], uvs = [], idx = [];
    const ACROSS = 4; // поперёк ленты 5 точек — лента повторяет изгибы склона
    for (const { kind: k, pts } of lines) {
      if (k !== kind) continue;
      let len = 0;
      const base = verts.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
        const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
        if (i) len += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
        for (let j = 0; j <= ACROSS; j++) {
          const t = j / ACROSS - 0.5, w = t * st.width * 1.25; // чуть шире — края растворяются в траве
          const x = p.x - dz / L * w, z = p.z + dx / L * w;
          verts.push(x, terrain.heightAt(x, z) + 0.06, z);
          uvs.push(j / ACROSS, len / (st.width * 1.6));
        }
        if (i) for (let j = 0; j < ACROSS; j++) {
          const r0 = base + (i - 1) * (ACROSS + 1) + j, r1 = base + i * (ACROSS + 1) + j;
          idx.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1) // лицевой стороной вверх;
        }
        samples.push({ x: p.x, z: p.z, w: st.width / 2, kind });
      }
    }
    if (!verts.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const tint = kind === 'path' ? '#c9ae86' : kind === 'lane' ? '#d8cbb4' : kind === 'street' ? '#e8e0d4' : '#ffffff';
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: roadTex.map, normalMap: roadTex.normalMap, color: tint, roughness: 0.95, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2 - (kind === 'main' ? 3 : kind === 'street' ? 2 : kind === 'lane' ? 1 : 0), polygonOffsetUnits: -4,
    }));
    m.receiveShadow = true; m.renderOrder = 1;
    scene.add(m);
  }

  // речка тоже «занята»: дома, деревья и ограды держатся от неё подальше
  for (const { kind, pts } of lines) if (kind === 'river') for (const p of pts) samples.push({ x: p.x, z: p.z, w: 2.5, kind });

  // Сетка для быстрых проверок расстояния до дороги.
  const grid = new Map(), G = 20, key = (x, z) => Math.floor(x / G) + ',' + Math.floor(z / G);
  for (const s of samples) { const k = key(s.x, s.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
  function distToRoad(x, z) { // расстояние до края ближайшей дороги
    let best = Infinity;
    const gx = Math.floor(x / G), gz = Math.floor(z / G);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of grid.get((gx + i) + ',' + (gz + j)) || []) best = Math.min(best, Math.hypot(s.x - x, s.z - z) - s.w);
    return best;
  }
  return { lines, distToRoad, layout };
}
