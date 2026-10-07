// Собирательство: предметы из data/items.json разбросаны по селу, E — подобрать.
import * as THREE from 'three';

function makeMesh(shape, color) {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const g = new THREE.Group();
  if (shape === 'stone') g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), m));
  else if (shape === 'stick') { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), m); s.rotation.z = Math.PI / 2; s.position.y = 0.05; g.add(s); }
  else if (shape === 'mushroom') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 5), new THREE.MeshLambertMaterial({ color: '#eee' })); st.position.y = 0.12;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 6), m); cap.position.y = 0.3; g.add(st, cap);
  } else if (shape === 'flower') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), new THREE.MeshLambertMaterial({ color: '#3a7a2a' })); st.position.y = 0.2;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1), m); fl.position.y = 0.42; g.add(st, fl);
  } else if (shape === 'horn') {
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05 - i * 0.01, 0.07 - i * 0.01, 0.2, 5), m); c.position.set(i * 0.12, 0.15 + i * 0.07, 0); c.rotation.z = -0.4 - i * 0.25; g.add(c); }
  } else if (shape === 'hoof') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 6, 1, false, 0, Math.PI * 1.7), m); h.position.y = 0.07; g.add(h);
  } else if (shape === 'arrowhead') {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 3), m); a.rotation.z = Math.PI / 2; a.position.y = 0.08; g.add(a);
  } else { for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 3), m); b.position.set((i % 2 - 0.5) * 0.15, 0.25, (i >> 1) * 0.15 - 0.07); b.rotation.z = (i - 1.5) * 0.2; g.add(b); } }
  g.traverse(o => o.castShadow = true);
  return g;
}

export async function createGathering(scene, terrain, houses, places, inventory, onPick) {
  const cfg = await (await fetch('data/items.json')).json();
  const list = [];
  const area = 350; // радиус разброса предметов вокруг центра села (м)
  for (const it of cfg.items) {
    for (let i = 0; i < it.count; i++) {
      let x, z, n = 0;
      const near = it.near || 'village';
      do {
        if (near === 'houses' && houses.length) { // у дворов: рядом со стеной дома
          const h = houses[Math.floor(Math.random() * houses.length)], a = Math.random() * 6.28, r = h.radius + 1.5 + Math.random() * 2;
          x = h.center.x + Math.cos(a) * r; z = h.center.z + Math.sin(a) * r;
        } else if (near.startsWith('place:') && places[near.slice(6)]) { // вокруг особого места
          const c = places[near.slice(6)].pos, a = Math.random() * 6.28, r = 6 + Math.random() * 30;
          x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r;
        } else { x = (Math.random() - 0.5) * area * 2; z = (Math.random() - 0.5) * area * 2; }
      } while (n++ < 20 && houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 1));
      const mesh = makeMesh(it.shape, it.color);
      mesh.position.set(x, terrain.heightAt(x, z), z);
      mesh.rotation.y = Math.random() * 6;
      scene.add(mesh);
      list.push({ id: it.id, mesh, glow: !!it.quest });
    }
  }
  let near = null;
  return {
    update(p, dt = 0) {
      for (const o of list) if (o.glow) o.mesh.rotation.y += dt * 1.5; // квестовые предметы крутятся — их легче заметить
      near = null; let best = 2.5;
      for (const o of list) { const d = o.mesh.position.distanceTo(p); if (d < best) { best = d; near = o; } }
      return near;
    },
    pick() {
      if (!near) return;
      scene.remove(near.mesh); list.splice(list.indexOf(near), 1);
      inventory.add(near.id); onPick(near.id); near = null;
    },
  };
}
