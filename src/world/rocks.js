// Камни: несколько разных форм (сфера, «помятая» шумом), три размера.
// Большие камни мешают пройти (коллизия), мелкие — просто украшение.
// Камни немного утоплены в землю — чтобы не «висели».
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from './textures.js';

function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = x - i, g = y - j, h = z - k;
  const u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), w = h * h * (3 - 2 * h);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(i, j, k), hash(i + 1, j, k), u), L(hash(i, j + 1, k), hash(i + 1, j + 1, k), u), v),
    L(L(hash(i, j, k + 1), hash(i + 1, j, k + 1), u), L(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), u), v), w);
}

const geoCache = {};
// Форма камня: seed — вариант, size — размер, flat — насколько приплюснут.
export function rockGeometry(seed = 0, size = 1, flat = 0.6) {
  const key = seed % 8 + ':' + flat;
  if (!geoCache[key]) {
    let g = new THREE.IcosahedronGeometry(1, 3);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position, uv = [];
    const o = (seed % 8) * 13.7;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let d = 0.75 + noise3(x * 1.6 + o, y * 1.6, z * 1.6) * 0.45 + noise3(x * 4 + o, y * 4, z * 4) * 0.12;
      const cut = Math.max(0, noise3(x * 0.9 + o + 5, y * 0.9, z * 0.9) - 0.55) * 1.2; d -= cut; // сколы, плоские грани
      p.setXYZ(i, x * d, y * d * flat, z * d);
      uv.push(Math.atan2(z, x) / Math.PI + 1, y + 1);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    geoCache[key] = g;
  }
  const out = geoCache[key].clone();
  out.scale(size, size, size);
  return out;
}

// Разбросать камни по склонам. Возвращает коллизии больших камней.
export function createRocks(scene, terrain, { houses, roads, count = 900 }) {
  const mat = pbr('rock', { color: '#bdb4a6', normal: 1.6 }), mossy = pbr('rock', { color: '#9aa088', normal: 1.6 });
  const VARIANTS = 4, colliders = [];
  const lists = Array.from({ length: VARIANTS * 2 }, () => []);
  const o = new THREE.Object3D();
  const nearHouse = (x, z, pad) => houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + pad);
  for (let i = 0; i < count * 3 && lists.flat().length < count; i++) {
    const a = Math.random() * 6.28, r = 40 + Math.random() * 900, x = Math.cos(a) * r, z = Math.sin(a) * r;
    // камни чаще на крутых склонах и у дорог (обочины)
    const sl = Math.abs(terrain.heightAt(x + 3, z) - terrain.heightAt(x - 3, z)) + Math.abs(terrain.heightAt(x, z + 3) - terrain.heightAt(x, z - 3));
    const dr = roads.distToRoad(x, z);
    if (Math.random() > sl * 0.25 + (dr < 3 && dr > 0.4 ? 0.5 : 0) + 0.05) continue;
    const big = Math.random() < 0.12, k = big ? 1.4 + Math.random() * 2.2 : Math.random() < 0.6 ? 0.15 + Math.random() * 0.35 : 0.5 + Math.random() * 0.8;
    if (dr < k + 0.3 || nearHouse(x, z, k + 0.5)) continue;
    o.position.set(x, terrain.heightAt(x, z) - k * 0.25, z); // утоплен в землю на четверть
    o.rotation.set(Math.random() * 0.4, Math.random() * 6.28, Math.random() * 0.4);
    o.scale.set(k * (0.8 + Math.random() * 0.4), k, k * (0.8 + Math.random() * 0.4));
    o.updateMatrix();
    lists[Math.floor(Math.random() * VARIANTS) + (Math.random() < 0.3 ? VARIANTS : 0)].push(o.matrix.clone());
    if (big) colliders.push({ type: 'circle', x, z, r: k * 0.85, top: o.position.y + k * 0.6 });
  }
  lists.forEach((list, i) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(rockGeometry(i % VARIANTS, 1, 0.6), i < VARIANTS ? mat : mossy, list.length);
    list.forEach((m, j) => im.setMatrixAt(j, m));
    im.castShadow = im.receiveShadow = true; scene.add(im);
  });
  return colliders;
}

// Граница мира: кольцо больших скал и обвалов (дороги за край карты завалены камнями).
// Игрок видит естественное препятствие, а не невидимую стену посреди поля.
export function createBoundary(scene, terrain, R = 985) {
  const mat = pbr('rock', { color: '#a59c8e', normal: 1.8 });
  const lists = [[], [], [], []], o = new THREE.Object3D();
  for (let a = 0; a < Math.PI * 2; a += 0.0055) {
    for (let layer = 0; layer < 2; layer++) {
      const r = R + 6 + layer * 9 + (Math.random() - 0.5) * 6, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const k = 3.5 + Math.random() * 5 + layer * 2;
      o.position.set(x, terrain.heightAt(x, z) - k * 0.2, z);
      o.rotation.set(Math.random() * 0.5, Math.random() * 6.28, Math.random() * 0.5);
      o.scale.set(k * (0.8 + Math.random() * 0.5), k * (1 + Math.random() * 0.6), k * (0.8 + Math.random() * 0.5));
      o.updateMatrix(); lists[Math.floor(Math.random() * 4)].push(o.matrix.clone());
    }
  }
  lists.forEach((list, i) => {
    const im = new THREE.InstancedMesh(rockGeometry(i + 4, 1, 0.8), mat, list.length);
    list.forEach((m, j) => im.setMatrixAt(j, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im);
  });
}
