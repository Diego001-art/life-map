// 3D-модели предметов: на земле, в руках героя и для картинок в рюкзаке.
import * as THREE from 'three';
import { dagger, saber } from '../character/rig.js';

export function makeMesh(shape, color) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const g = new THREE.Group();
  if (shape === 'stone') g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), m));
  else if (shape === 'stick') { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), m); s.rotation.z = Math.PI / 2; s.position.y = 0.05; g.add(s); }
  else if (shape === 'mushroom') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 5), new THREE.MeshStandardMaterial({ color: '#eee', roughness: 0.8 })); st.position.y = 0.12;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 6), m); cap.position.y = 0.3; g.add(st, cap);
  } else if (shape === 'flower') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), new THREE.MeshStandardMaterial({ color: '#3a7a2a', roughness: 0.8 })); st.position.y = 0.2;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1), m); fl.position.y = 0.42; g.add(st, fl);
  } else if (shape === 'horn') {
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05 - i * 0.01, 0.07 - i * 0.01, 0.2, 5), m); c.position.set(i * 0.12, 0.15 + i * 0.07, 0); c.rotation.z = -0.4 - i * 0.25; g.add(c); }
  } else if (shape === 'hoof') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 6, 1, false, 0, Math.PI * 1.7), m); h.position.y = 0.07; g.add(h);
  } else if (shape === 'arrowhead') {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 3), m); a.rotation.z = Math.PI / 2; a.position.y = 0.08; g.add(a);
  } else if (shape === 'dagger') { const d = dagger(); d.rotation.z = Math.PI / 2; d.position.y = 0.05; g.add(d);
  } else if (shape === 'saber') { const d = saber(); d.rotation.z = Math.PI / 2; d.position.set(0.4, 0.05, 0); g.add(d);
  } else if (shape === 'amulet') {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 10), m); r.position.y = 0.2; g.add(r);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshStandardMaterial({ color: '#c0302a', roughness: 0.8 })); st.position.y = 0.08; g.add(st);
  } else if (shape === 'potion') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 5), m); b.position.y = 0.15;
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 6), new THREE.MeshStandardMaterial({ color: '#c8d8d0', roughness: 0.8 })); n.position.y = 0.33;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), new THREE.MeshStandardMaterial({ color: '#7a5532', roughness: 0.8 })); c.position.y = 0.42; g.add(b, n, c);
  } else if (shape === 'papakha') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.32, 9), m); h.position.y = 0.16; g.add(h);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.05, 9), m); t.position.y = 0.34; g.add(t);
  } else if (shape === 'coat') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1, 6), m); b.position.y = 0.5; g.add(b);
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) { const gz = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 4), new THREE.MeshStandardMaterial({ color: '#d8c9a0', roughness: 0.8 })); gz.position.set(0.18 * s, 0.75 - i * 0.05, 0.26); g.add(gz); }
  } else if (shape === 'boots') {
    for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), m); b.position.set(0.12 * s, 0.2, 0); const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), m); f.position.set(0.12 * s, 0.05, 0.08); g.add(b, f); }
  } else if (shape === 'staff') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 5), m); s.position.y = 0.85; g.add(s);
    const k = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), m); k.position.y = 1.72; g.add(k);
  } else { for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 3), m); b.position.set((i % 2 - 0.5) * 0.15, 0.25, (i >> 1) * 0.15 - 0.07); b.rotation.z = (i - 1.5) * 0.2; g.add(b); } }
  g.traverse(o => o.castShadow = true);
  return g;
}

