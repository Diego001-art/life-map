// Жители села из data/npcs.json. Стоят, поворачиваются к герою, над головой «!» если есть дело.
import * as THREE from 'three';
import { sectorPos } from '../world/sectors.js';

function person(color, beard, female) {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.3, 6), m(color)); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), m('#d9ab84')); head.position.y = 1.85;
  g.add(body, head);
  if (beard) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 5), m('#ddd')); b.position.set(0, 1.62, 0.18); b.rotation.x = Math.PI; g.add(b); }
  if (female) { // платок и длинное платье с узором
    const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 6), m('#1d1d22')); scarf.position.y = 1.85; g.add(scarf);
    body.scale.set(1.15, 1.25, 1.15); body.position.y = 0.8;
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.12, 6), m('#c9a24a')); trim.position.y = 0.2; g.add(trim);
  } else { // папаха
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.27, 0.3, 7), m(beard ? '#eee' : '#3a3a3a')); hat.position.y = 2.12; g.add(hat);
  }
  g.traverse(o => o.castShadow = true);
  return g;
}

export async function createNpcs(scene, terrain) {
  const cfg = await (await fetch('data/npcs.json')).json();
  const mark = new THREE.MeshBasicMaterial({ color: '#ffd23a' });
  const list = cfg.npcs.map(n => {
    const { x, z } = sectorPos(n.sector, n.dx, n.dz);
    const obj = person(n.color, n.beard, n.female);
    obj.position.set(x, terrain.heightAt(x, z), z);
    const ex = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), mark); ex.rotation.x = Math.PI; ex.position.y = 2.8;
    obj.add(ex);
    scene.add(obj);
    return { ...n, object: obj, marker: ex };
  });
  return {
    list,
    byId: (id) => list.find(n => n.id === id),
    update(p, hasTask, t) {
      let near = null;
      for (const n of list) {
        const d = n.object.position.distanceTo(p);
        if (d < 12) n.object.rotation.y = Math.atan2(p.x - n.object.position.x, p.z - n.object.position.z);
        n.marker.visible = hasTask(n.id);
        n.marker.position.y = 2.8 + Math.sin(t * 3) * 0.1;
        if (d < 3 && (!near || d < near.d)) near = { npc: n, d };
      }
      return near && near.npc;
    },
  };
}
