// Рельеф местности из data/terrain/heights.json (реальные высоты Бутри).
// Высоты сглаживаются (кубическая интерполяция), сетка в 2 раза гуще исходной — склоны плавные, без «ступенек».
import * as THREE from 'three';
import { groundMaterial } from './ground.js';
import { env } from './env.js';
import { makeRoadCarve } from './layout.js';

export async function createTerrain(scene, layout = null) {
  const d = await (await fetch('data/terrain/heights.json')).json();
  const { size, n, h } = d;
  const base = d.min;
  const step = size / (n - 1);
  const g = (r, c) => h[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))] - base;
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

  // Высота земли в любой точке (x, z). Все объекты ставятся по ней — поэтому ничего не висит в воздухе.
  function rawHeightAt(x, z) {
    const c = Math.min(n - 1.001, Math.max(0, (x + size / 2) / step));
    const r = Math.min(n - 1.001, Math.max(0, (z + size / 2) / step));
    const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
    const row = (rr) => cr(g(rr, c0 - 1), g(rr, c0), g(rr, c0 + 1), g(rr, c0 + 2), fc);
    return cr(row(r0 - 1), row(r0), row(r0 + 1), row(r0 + 2), fr);
  }

  // дороги со спутниковой карты врезаны в склон (полотно ровное поперёк, по краям откосы)
  const carve = layout && layout.lines.length ? makeRoadCarve(layout.lines, rawHeightAt) : null;
  const smoothHeight = carve ? (x, z) => carve(x, z, rawHeightAt(x, z)) : rawHeightAt;

  const SEG = (n - 1) * 3; // сетка ~4 м — видны врезки дорог и уступы
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const tint = new THREE.Color(), warm = new THREE.Color('#a8a070'), cool = new THREE.Color('#7c9468'), mid = new THREE.Color('#9a9e78');
  // высоты в узлах сетки; heightAt ниже повторяет ровно ту же поверхность из треугольников, что видна на экране —
  // поэтому дороги, дома, герой и предметы стоят точно на видимой земле (не висят и не утопают)
  const NV = SEG + 1, cellM = size / SEG, G = new Float32Array(NV * NV);
  for (let iy = 0; iy < NV; iy++) for (let ix = 0; ix < NV; ix++) G[iy * NV + ix] = smoothHeight(-size / 2 + ix * cellM, -size / 2 + iy * cellM);
  function heightAt(x, z) {
    const fx = Math.min(SEG - 1e-4, Math.max(0, (x + size / 2) / cellM)), fz = Math.min(SEG - 1e-4, Math.max(0, (z + size / 2) / cellM));
    const ix = Math.floor(fx), iy = Math.floor(fz), u = fx - ix, v = fz - iy;
    const a = G[iy * NV + ix], d = G[iy * NV + ix + 1], b = G[(iy + 1) * NV + ix], c = G[(iy + 1) * NV + ix + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v); // как треугольники PlaneGeometry
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, G[Math.round((z + size / 2) / cellM) * NV + Math.round((x + size / 2) / cellM)]);
    // лёгкий разброс оттенка травы по лугам (сухие и сочные места)
    const k = Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) * Math.cos(z * 0.019 + Math.sin(x * 0.009) * 2);
    tint.copy(mid).lerp(k > 0 ? warm : cool, Math.abs(k) * 0.8);
    colors.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const wet = { value: 0 };
  const mat = groundMaterial({ scale: 0.22, terraces: true, wet, zones: layout && layout.zonesTexture });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { heightAt, size, lat: d.lat, lon: d.lon, material: mat, setWet: (v) => wet.value = v };
}
