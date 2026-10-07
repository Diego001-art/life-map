// Рельеф местности из data/terrain/heights.json (реальные высоты Бутри).
// Высоты сглаживаются (кубическая интерполяция), сетка в 2 раза гуще исходной — склоны плавные, без «ступенек».
import * as THREE from 'three';
import { groundMaterial } from './ground.js';
import { env } from './env.js';

export async function createTerrain(scene) {
  const d = await (await fetch('data/terrain/heights.json')).json();
  const { size, n, h } = d;
  const base = d.min;
  const step = size / (n - 1);
  const g = (r, c) => h[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))] - base;
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

  // Высота земли в любой точке (x, z). Все объекты ставятся по ней — поэтому ничего не висит в воздухе.
  function heightAt(x, z) {
    const c = Math.min(n - 1.001, Math.max(0, (x + size / 2) / step));
    const r = Math.min(n - 1.001, Math.max(0, (z + size / 2) / step));
    const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
    const row = (rr) => cr(g(rr, c0 - 1), g(rr, c0), g(rr, c0 + 1), g(rr, c0 + 2), fc);
    return cr(row(r0 - 1), row(r0), row(r0 + 1), row(r0 + 2), fr);
  }

  const SEG = (n - 1) * 2;
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const tint = new THREE.Color(), warm = new THREE.Color('#a8a070'), cool = new THREE.Color('#7c9468'), mid = new THREE.Color('#9a9e78');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    // лёгкий разброс оттенка травы по лугам (сухие и сочные места)
    const k = Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) * Math.cos(z * 0.019 + Math.sin(x * 0.009) * 2);
    tint.copy(mid).lerp(k > 0 ? warm : cool, Math.abs(k) * 0.8);
    colors.push(tint.r, tint.g, tint.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const wet = { value: 0 };
  const mat = groundMaterial({ scale: 0.22, terraces: true, wet });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { heightAt, size, lat: d.lat, lon: d.lon, material: mat, setWet: (v) => wet.value = v };
}
