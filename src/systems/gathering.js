// Собирательство: предметы из data/items.json разбросаны по селу, E — подобрать.
import * as THREE from 'three';
import { makeMesh } from '../items/models.js';

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
      if (!inventory.canAdd(near.id)) return 'full'; // рюкзак полон
      scene.remove(near.mesh); list.splice(list.indexOf(near), 1);
      inventory.add(near.id); onPick(near.id); near = null;
      return 'ok';
    },
  };
}
