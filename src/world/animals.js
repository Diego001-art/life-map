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

function dog() {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }), c = ['#6b4a2e', '#2b2622', '#c9b48a'][Math.floor(Math.random() * 3)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.3), m(c)); b.position.y = 0.5;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.26), m(c)); h.position.set(0.52, 0.7, 0);
  const sn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), m('#1a1a1a')); sn.position.set(0.72, 0.64, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), m(c)); tail.position.set(-0.52, 0.62, 0); tail.rotation.z = 0.6;
  g.add(b, h, sn, tail);
  for (const [x, z] of [[0.3, 0.1], [0.3, -0.1], [-0.3, 0.1], [-0.3, -0.1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), m(c)); l.position.set(x, 0.18, z); g.add(l); }
  g.userData.tail = tail; return g;
}
function goat() {
  const g = sheep(); g.scale.setScalar(0.85);
  g.children[0].material = new THREE.MeshLambertMaterial({ color: Math.random() < 0.5 ? '#5a4a3a' : '#d8d0c0', flatShading: true });
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), new THREE.MeshLambertMaterial({ color: '#8a7a60' })); horn.position.set(0.68, 1.1, 0.08); horn.rotation.z = -0.6;
  const horn2 = horn.clone(); horn2.position.z = -0.08; g.add(horn, horn2); return g;
}
function horse() {
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }), c = ['#5a3a24', '#2b2220', '#8a6a4a'][Math.floor(Math.random() * 3)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.7), m(c)); b.position.y = 1.45;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.35), m(c)); neck.position.set(1.05, 2, 0); neck.rotation.z = -0.5;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.3), m(c)); h.position.set(1.45, 2.35, 0); h.rotation.z = -0.3;
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.1), m('#1a1410')); mane.position.set(0.95, 2.1, 0); mane.rotation.z = -0.5;
  g.add(b, neck, h, mane);
  for (const [x, z] of [[0.75, 0.22], [0.75, -0.22], [-0.75, 0.22], [-0.75, -0.22]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.1, 0.17), m(c)); l.position.set(x, 0.55, z); g.add(l); }
  return g;
}

export function createAnimals(scene, terrain, places, extra = {}) {
  const herd = [];
  const center = places.pasture ? places.pasture.pos : new THREE.Vector3(150, 0, 150);
  for (let i = 0; i < 18; i++) {
    const isCow = i % 4 === 0, o = isCow ? cow() : sheep();
    o.traverse(c => c.castShadow = true);
    const home = isCow ? new THREE.Vector3(center.x + (Math.random() - 0.5) * 120, 0, center.z + (Math.random() - 0.5) * 120) : center.clone();
    o.position.set(home.x + (Math.random() - 0.5) * 20, 0, home.z + (Math.random() - 0.5) * 20);
    scene.add(o);
    herd.push({ o, home, target: o.position.clone(), wait: Math.random() * 5, range: isCow ? 30 : 12, speed: 0.8 });
  }
  // собаки у домов, козы на склонах, лошади у площади
  const addHerd = (make, n, home, range, speed) => {
    for (let i = 0; i < n; i++) {
      const o = make(); o.traverse(c => c.castShadow = true);
      o.position.set(home.x + (Math.random() - 0.5) * range, 0, home.z + (Math.random() - 0.5) * range); scene.add(o);
      herd.push({ o, home: new THREE.Vector3(home.x, 0, home.z), target: o.position.clone(), wait: Math.random() * 4, range, speed });
    }
  };
  for (const h of (extra.houses || []).filter(() => Math.random() < 0.04).slice(0, 10)) addHerd(dog, 1, h.center, 14, 1.8);
  for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28; addHerd(goat, 5, { x: Math.cos(a) * 480, z: Math.sin(a) * 480 }, 40, 0.6); }
  if (extra.square) addHerd(horse, 2, { x: extra.square.x - 16, z: extra.square.z + 6 }, 6, 0.5);
  return (dt) => {
    for (const a of herd) {
      const p = a.o.position;
      if ((a.wait -= dt) > 0) { p.y = terrain.heightAt(p.x, p.z); continue; }
      const d = new THREE.Vector3(a.target.x - p.x, 0, a.target.z - p.z);
      if (d.length() < 0.3) { a.wait = 2 + Math.random() * 6; a.target.set(a.home.x + (Math.random() - 0.5) * a.range * 2, 0, a.home.z + (Math.random() - 0.5) * a.range * 2); continue; }
      d.normalize(); p.x += d.x * dt * a.speed; p.z += d.z * dt * a.speed;
      if (a.o.userData.tail) a.o.userData.tail.rotation.y = Math.sin(performance.now() / 90) * 0.6;
      p.y = terrain.heightAt(p.x, p.z);
      a.o.rotation.y = Math.atan2(-d.z, d.x);
    }
  };
}
