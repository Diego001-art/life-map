// Деревья: 6 видов, каждый собран из ствола, веток и нескольких «облаков» листвы.
//  fruit — фруктовые (абрикос, яблоня) в садах села;  walnut — большой орех;  poplar — тополь у дорог;
//  pine — сосна на верхних склонах;  birch — берёза;  bush — куст.
// Каждый вид рисуется одним вызовом для ствола и одним для листвы (InstancedMesh) — лес дешёвый для браузера.
// Ствол — препятствие (коллизия), листва — нет.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from './textures.js';
import { addWind } from './env.js';

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// «Облако» листвы: сфера, помятая шумом.
function blob(r, sx = 1, sy = 1, sz = 1) {
  let g = new THREE.IcosahedronGeometry(r, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, uv = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.82 + rnd() * 0.3;
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    uv.push(Math.atan2(z, x) * 0.6 + 2, y * 0.6 / r + 2);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// Ветка/ствол: сужающийся цилиндр от точки a к точке b.
function limb(a, b, r0, r1) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, 7, 3);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * L * 0.8); // кора нормального масштаба
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Построить один вид дерева: { wood, leaves } — две геометрии.
function build(kind) {
  const wood = [], leaves = [];
  if (kind === 'fruit' || kind === 'walnut') {
    const H = kind === 'walnut' ? 3.4 : 2.1, R = kind === 'walnut' ? 0.32 : 0.18;
    const top = V((rnd() - 0.5) * 0.4, H, (rnd() - 0.5) * 0.4);
    wood.push(limb(V(0, -0.3, 0), top, R, R * 0.7));
    const nb = kind === 'walnut' ? 5 : 4;
    for (let i = 0; i < nb; i++) {
      const a = i / nb * 6.28 + rnd(), l = (kind === 'walnut' ? 2.6 : 1.6) * (0.7 + rnd() * 0.4);
      const end = V(top.x + Math.cos(a) * l, top.y + l * (0.5 + rnd() * 0.4), top.z + Math.sin(a) * l);
      wood.push(limb(top.clone().add(V(0, -0.3, 0)), end, R * 0.55, R * 0.2));
      const s = kind === 'walnut' ? 1.7 : 1.15;
      leaves.push(blob(s * (0.8 + rnd() * 0.4), 1.15, 0.85, 1.1).translate(end.x, end.y + 0.2, end.z));
    }
    const s = kind === 'walnut' ? 2.3 : 1.4;
    leaves.push(blob(s, 1.2, 0.9, 1.2).translate(top.x, top.y + s * 0.8, top.z));
  } else if (kind === 'poplar') {
    wood.push(limb(V(0, -0.3, 0), V(0, 7, 0), 0.26, 0.08));
    for (let i = 0; i < 5; i++) leaves.push(blob(1.25 - i * 0.12, 1, 1.9, 1).translate((rnd() - 0.5) * 0.4, 3.2 + i * 1.9, (rnd() - 0.5) * 0.4));
  } else if (kind === 'pine') {
    wood.push(limb(V(0, -0.3, 0), V(0, 9, 0), 0.28, 0.06));
    for (let i = 0; i < 6; i++) {
      let c = new THREE.ConeGeometry(2.6 - i * 0.38, 2.6, 9, 2); c = c.toNonIndexed(); c.deleteAttribute('normal');
      const p = c.attributes.position; for (let j = 0; j < p.count; j++) { if (p.getY(j) < 1) { p.setX(j, p.getX(j) * (0.85 + rnd() * 0.3)); p.setZ(j, p.getZ(j) * (0.85 + rnd() * 0.3)); p.setY(j, p.getY(j) - rnd() * 0.3); } }
      c.computeVertexNormals();
      leaves.push(c.translate(0, 2.4 + i * 1.15, 0));
    }
  } else if (kind === 'birch') {
    wood.push(limb(V(0, -0.3, 0), V(0.2, 6.5, 0), 0.17, 0.06));
    for (let i = 0; i < 4; i++) { const a = rnd() * 6.28, y = 3.4 + i * 0.9; leaves.push(blob(0.95, 1.1, 1.3, 1.1).translate(Math.cos(a) * 0.7, y, Math.sin(a) * 0.7)); }
  } else { // bush
    for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; leaves.push(blob(0.6 + rnd() * 0.3, 1.2, 0.8, 1.2).translate(Math.cos(a) * 0.5, 0.45, Math.sin(a) * 0.5)); }
  }
  return { wood: wood.length ? mergeGeometries(wood) : null, leaves: mergeGeometries(leaves.map(g => { const n = g.index ? g.toNonIndexed() : g; return n; })) };
}

const KINDS = {
  fruit:  { greens: ['#5f8f3c', '#6e9a42', '#58843a'], bark: 'bark', barkColor: '#d8c8b8', wind: 0.12 },
  walnut: { greens: ['#4c7a34', '#567f38', '#47703a'], bark: 'bark', barkColor: '#c8b8a8', wind: 0.1 },
  poplar: { greens: ['#4a7a34', '#557f38', '#3f6c30'], bark: 'birch', barkColor: '#8a8a7a', wind: 0.22 },
  pine:   { greens: ['#2e4a2a', '#34552e', '#29432a'], bark: 'bark', barkColor: '#a08070', wind: 0.06 },
  birch:  { greens: ['#7aa24a', '#88aa50', '#6e9a46'], bark: 'birch', barkColor: '#ffffff', wind: 0.18 },
  bush:   { greens: ['#4d7a33', '#5f8a3a', '#6b7f3a'], bark: 'bark', barkColor: '#ffffff', wind: 0.05 },
};

// Расставить деревья по зонам. Возвращает коллизии стволов.
export function createTrees(scene, terrain, { houses, roads }) {
  const nearHouse = (x, z, pad) => houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + pad);
  const spots = Object.fromEntries(Object.keys(KINDS).map(k => [k, []]));
  const colliders = [];
  const add = (kind, x, z, k) => {
    if (nearHouse(x, z, kind === 'bush' ? 1 : 2.5) || roads.distToRoad(x, z) < (kind === 'bush' ? 0.8 : 1.6)) return false;
    spots[kind].push({ x, y: terrain.heightAt(x, z), z, k, rot: rnd() * 6.28 });
    if (kind !== 'bush') colliders.push({ type: 'circle', x, z, r: (kind === 'walnut' ? 0.4 : 0.28) * k, top: 1e9 });
    return true;
  };
  const N = (x, z) => Math.sin(x * 0.013 + Math.sin(z * 0.009) * 3) * Math.cos(z * 0.011 + Math.sin(x * 0.007) * 3); // рощи и поляны
  const L = roads.layout && roads.layout.has ? roads.layout : null;
  const village = (x, z) => L ? L.village(x, z) : Math.max(0, 1 - Math.hypot(x, z) / 400);
  // сады в селе (во дворах, между домами) — по плотности застройки с карты
  for (let i = 0; i < 20000 && spots.fruit.length + spots.walnut.length < 650; i++) {
    const x = (rnd() - 0.5) * 1960, z = (rnd() - 0.5) * 1960, v = village(x, z);
    if (v < 0.15 || rnd() > v) continue;
    add(rnd() < 0.8 ? 'fruit' : 'walnut', x, z, 0.8 + rnd() * 0.5);
  }
  // лес в оврагах — там, где он на спутниковой карте (густо, разные породы)
  if (L) for (let i = 0; i < 60000 && spots.pine.length + spots.birch.length < 2600; i++) {
    const x = (rnd() - 0.5) * 1960, z = (rnd() - 0.5) * 1960, f = L.forest(x, z);
    if (f < 0.35 || rnd() > f) continue;
    const r = rnd(), kind = r < 0.4 ? 'pine' : r < 0.65 ? 'birch' : r < 0.85 ? 'walnut' : 'bush';
    add(kind, x, z, 0.8 + rnd() * 0.7);
  }
  // тополя вдоль улиц
  for (const { kind, pts } of roads.lines) {
    if (kind !== 'main' && kind !== 'street' && kind !== 'river') continue;   // тополя — вдоль дорог и речки
    for (let j = 0; j < pts.length; j += 3) {
      const p = pts[j]; if (village(p.x, p.z) < 0.08 && kind !== 'river' || rnd() < (kind === 'river' ? 0.55 : 0.7)) continue;
      const q = pts[Math.min(pts.length - 1, j + 1)], a = Math.atan2(q.z - p.z, q.x - p.x), s = rnd() < 0.5 ? 1 : -1, off = 5 + rnd() * 3;
      add('poplar', p.x - Math.sin(a) * off * s, p.z + Math.cos(a) * off * s, 0.85 + rnd() * 0.45);
    }
  }
  // луга и склоны: орехи, берёзы, кусты; выше — сосновые рощи
  // (на террасированных склонах, видных на карте, деревьев почти нет — там луга; рощи — за краем карты)
  for (let i = 0; i < 9000; i++) {
    const a = rnd() * 6.28, r = 300 + rnd() * 660, x = Math.cos(a) * r, z = Math.sin(a) * r, n = N(x, z), h = terrain.heightAt(x, z);
    if (L && L.covered(x, z) && rnd() < 0.92) continue;
    if (village(x, z) > 0.1) continue;
    if (n < 0.1) { if (rnd() < 0.04) add('bush', x, z, 0.7 + rnd() * 0.8); continue; }
    const kind = h > 150 && rnd() < 0.75 ? 'pine' : rnd() < 0.3 ? 'birch' : rnd() < 0.5 ? 'walnut' : 'bush';
    if (rnd() < n * 0.35) add(kind, x, z, 0.75 + rnd() * 0.6);
  }
  for (let i = 0; i < 700; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 700; add('bush', Math.cos(a) * r, Math.sin(a) * r, 0.6 + rnd() * 0.8); }

  // по 2 варианта формы на вид — деревья не одинаковые
  const o = new THREE.Object3D();
  for (const kind in KINDS) {
    const K = KINDS[kind], list = spots[kind];
    if (!list.length) continue;
    const barkMat = pbr(K.bark, { color: K.barkColor, normal: 1.5 });
    const leafMat = addWind(pbr('leaves', { roughness: 0.85, normal: 1.2 }), K.wind, kind === 'poplar' || kind === 'pine' ? 8 : 4);
    const greens = K.greens.map(c => new THREE.Color(c));
    for (let v = 0; v < 2; v++) {
      const part = list.filter((_, i) => i % 2 === v);
      if (!part.length) continue;
      const { wood, leaves } = build(kind);
      const lm = new THREE.InstancedMesh(leaves, leafMat, part.length);
      const wm = wood ? new THREE.InstancedMesh(wood, barkMat, part.length) : null;
      part.forEach((s, i) => {
        o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.rot, 0); o.scale.setScalar(s.k); o.updateMatrix();
        lm.setMatrixAt(i, o.matrix); lm.setColorAt(i, greens[i % greens.length].clone().offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08));
        if (wm) wm.setMatrixAt(i, o.matrix);
      });
      lm.castShadow = true; lm.receiveShadow = true; scene.add(lm);
      if (wm) { wm.castShadow = true; scene.add(wm); }
    }
  }
  return colliders;
}
