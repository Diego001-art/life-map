// Высокие горы на горизонте — их видно, но дойти нельзя (край карты).
import * as THREE from 'three';

export function createMountains(scene, terrain) {
  // Земля до гор.
  const ground = new THREE.Mesh(new THREE.RingGeometry(1000, 9000, 48, 1), new THREE.MeshLambertMaterial({ color: '#6f7f45' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; scene.add(ground);
  // Склоны-"юбка" от края карты к горам.
  const rock = new THREE.MeshLambertMaterial({ color: '#7d7466', flatShading: true });
  const green = new THREE.MeshLambertMaterial({ color: '#5f7a42', flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: '#f2f4f7', flatShading: true });
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rnd(-0.04, 0.04);
    const near = i % 2 === 0;
    const dist = near ? rnd(1500, 1900) : rnd(2600, 3800);
    const hgt = near ? rnd(350, 700) : rnd(900, 1700);
    const rad = near ? rnd(450, 650) : rnd(700, 1100);
    const geo = new THREE.ConeGeometry(rad, hgt, 7, 3);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      if (pos.getY(v) < hgt / 2 - 1) { pos.setX(v, pos.getX(v) + rnd(-60, 60)); pos.setZ(v, pos.getZ(v) + rnd(-60, 60)); pos.setY(v, pos.getY(v) + rnd(-30, 30)); }
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, near ? green : rock);
    m.position.set(Math.cos(a) * dist, hgt / 2 + 40, Math.sin(a) * dist);
    m.rotation.y = rnd(0, 6);
    scene.add(m);
    if (!near) { // снежная шапка
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.3, hgt * 0.3, 7), snow);
      cap.position.set(m.position.x, 40 + hgt * 0.86, m.position.z); cap.rotation.y = m.rotation.y; scene.add(cap);
    }
  }
}
