// Овцы и коровы бродят по пастбищу и у села.
import * as THREE from 'three';

function sheep() {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), m('#f1ede4')); b.scale.set(1.3, 0.9, 0.9); b.position.y = 0.7;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.35), m('#2b2522')); h.position.set(0.7, 0.85, 0);
  g.add(b, h);
  for (const [x, z] of [[0.35, 0.2], [0.35, -0.2], [-0.35, 0.2], [-0.35, -0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), m('#2b2522')); l.position.set(x, 0.2, z); g.add(l); }
  return g;
}
function cow() {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), m('#6b4a32')); b.position.y = 1.1;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), m('#5a3a28')); h.position.set(1.1, 1.4, 0);
  g.add(b, h);
  for (const [x, z] of [[0.7, 0.3], [0.7, -0.3], [-0.7, 0.3], [-0.7, -0.3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), m('#4a3020')); l.position.set(x, 0.35, z); g.add(l); }
  return g;
}

export function createAnimals(scene, terrain, places) {
  const herd = [];
  const center = places.pasture ? places.pasture.pos : new THREE.Vector3(150, 0, 150);
  for (let i = 0; i < 18; i++) {
    const isCow = i % 4 === 0, o = isCow ? cow() : sheep();
    o.traverse(c => c.castShadow = true);
    const home = isCow ? new THREE.Vector3(center.x + (Math.random() - 0.5) * 120, 0, center.z + (Math.random() - 0.5) * 120) : center.clone();
    o.position.set(home.x + (Math.random() - 0.5) * 20, 0, home.z + (Math.random() - 0.5) * 20);
    scene.add(o);
    herd.push({ o, home, target: o.position.clone(), wait: Math.random() * 5, range: isCow ? 30 : 12 });
  }
  return (dt) => {
    for (const a of herd) {
      const p = a.o.position;
      if ((a.wait -= dt) > 0) { p.y = terrain.heightAt(p.x, p.z); continue; }
      const d = new THREE.Vector3(a.target.x - p.x, 0, a.target.z - p.z);
      if (d.length() < 0.3) { a.wait = 2 + Math.random() * 6; a.target.set(a.home.x + (Math.random() - 0.5) * a.range * 2, 0, a.home.z + (Math.random() - 0.5) * a.range * 2); continue; }
      d.normalize(); p.x += d.x * dt * 0.8; p.z += d.z * dt * 0.8;
      p.y = terrain.heightAt(p.x, p.z);
      a.o.rotation.y = Math.atan2(-d.z, d.x);
    }
  };
}
