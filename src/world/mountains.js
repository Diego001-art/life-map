// Горы вокруг села: кольцо хребтов, которое плавно продолжает настоящий рельеф Бутри.
// Ближе — зелёные склоны и лес, выше — скалы, на вершинах — снег. Дальние хребты тонут в дымке.
// Дойти туда нельзя (край карты), но видно, что мир продолжается.
import * as THREE from 'three';
import { groundMaterial } from './ground.js';

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v;
}
// «Хребтовый» шум: острые гребни и долины между ними.
function ridged(x, y) {
  let v = 0, a = 0.55, f = 1;
  for (let o = 0; o < 6; o++) { const n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1); v += n * n * a; a *= 0.5; f *= 2.05; }
  return v;
}

export function createMountains(scene, terrain) {
  const HALF = terrain.size / 2;
  const R0 = 950, R1 = 8600, RINGS = 90, SEG = 300;
  const pos = [], col = [], idx = [];
  const cGrass = new THREE.Color('#5d8a3e'), cForest = new THREE.Color('#2f4f2a'), cRock = new THREE.Color('#7d776d'),
    cRock2 = new THREE.Color('#5c5a58'), cSnow = new THREE.Color('#eef2f7'), c = new THREE.Color();
  const heightOf = (x, z, r) => {
    const out = Math.max(Math.abs(x), Math.abs(z)) - HALF; // сколько метров за краем карты
    if (out < 0) return terrain.heightAt(x, z) - 40;       // внутри карты — прячем под землю
    const base = terrain.heightAt(Math.max(-HALF, Math.min(HALF, x)), Math.max(-HALF, Math.min(HALF, z)));
    const env = THREE.MathUtils.smoothstep(out, 0, 900) * (0.45 + 0.55 * THREE.MathUtils.smoothstep(r, 1600, 5200));
    return base + ridged(x / 1900, z / 1900) * 2300 * env + ridged(x / 520 + 9, z / 520) * 140 * THREE.MathUtils.smoothstep(out, 0, 300);
  };
  for (let i = 0; i <= RINGS; i++) {
    const r = R0 + (R1 - R0) * Math.pow(i / RINGS, 1.7); // кольца гуще возле села
    for (let j = 0; j < SEG; j++) {
      const a = j / SEG * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, heightOf(x, z, r), z);
    }
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
    const a = i * SEG + j, b = i * SEG + (j + 1) % SEG, c2 = a + SEG, d = b + SEG;
    idx.push(a, b, c2, b, d, c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // базовый оттенок (детали — траву, скалы, снег — рисует материал земли сам по крутизне и высоте)
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], z = pos[v * 3 + 2], n = noise(x / 300, z / 300);
    c.set('#8e9670').lerp(cForest.clone().multiplyScalar(2.2), THREE.MathUtils.smoothstep(pos[v * 3 + 1], 150, 450) * (1 - THREE.MathUtils.smoothstep(pos[v * 3 + 1], 600, 800)) * (0.5 + n * 0.5));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, groundMaterial({ scale: 0.03, snowLine: 1150, rockLine: 620 }));
  mesh.receiveShadow = false;
  scene.add(mesh);

  // Лес на ближних склонах гор: ели и сосны, без теней (далеко) — один вызов отрисовки.
  const TREES = 3500;
  const tgeo = new THREE.ConeGeometry(1, 3.2, 5); tgeo.translate(0, 1.6, 0);
  const forest = new THREE.InstancedMesh(tgeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), TREES);
  const dummy = new THREE.Object3D(), fc = ['#2c4a2a', '#34552e', '#263f25', '#3d5f34'].map(h => new THREE.Color(h));
  let n = 0;
  for (let k = 0; k < TREES * 4 && n < TREES; k++) {
    const a = Math.random() * Math.PI * 2, r = 1050 + Math.random() ** 1.5 * 2300, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 30) continue;
    const y = heightOf(x, z, r), yx = heightOf(x + 8, z, r), yz = heightOf(x, z + 8, r);
    if (y > 520 || Math.hypot(yx - y, yz - y) > 9 || noise(x / 160, z / 160) < 0.42) continue; // рощами, не на крутых скалах
    const s = 5 + Math.random() * 6;
    dummy.position.set(x, y - 1, z); dummy.scale.set(s * 0.45, s, s * 0.45); dummy.rotation.y = Math.random() * 6;
    dummy.updateMatrix(); forest.setMatrixAt(n, dummy.matrix); forest.setColorAt(n, fc[n % fc.length]); n++;
  }
  forest.count = n; scene.add(forest);
}
