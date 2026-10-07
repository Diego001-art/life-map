// Деревья, небо, свет.
import * as THREE from 'three';

export function createSky(scene) {
  scene.background = new THREE.Color('#8fbde6');
  scene.fog = new THREE.Fog('#b8d2e6', 300, 7000);
  scene.add(new THREE.HemisphereLight('#dfefff', '#5a5040', 0.9));
  const sun = new THREE.DirectionalLight('#fff2d8', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 400 });
  scene.add(sun, sun.target);
  // Солнце следует за игроком, чтобы тени были рядом.
  return (p) => { sun.position.set(p.x + 80, p.y + 150, p.z + 40); sun.target.position.copy(p); };
}

// Фруктовые деревья — в основном в селе и в овраге; на голых склонах редко.
export function createTrees(scene, terrain, houses, count = 500) {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 2, 5), new THREE.MeshLambertMaterial({ color: '#5a4030' }), count);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), count);
  trunk.castShadow = crown.castShadow = true;
  const greens = ['#4f8a34', '#5e9a3a', '#3f7a2e', '#6aa444', '#86b04e'].map(c => new THREE.Color(c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let i = 0, tries = 0;
  while (i < count && tries++ < count * 30) {
    const inVillage = Math.random() < 0.8, r = inVillage ? Math.sqrt(Math.random()) * 380 : 380 + Math.random() * 500, a = Math.random() * 6.28;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 2)) continue;
    const y = terrain.heightAt(x, z), k = 0.7 + Math.random() * 0.7;
    q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
    s.set(k, k, k); m.compose(new THREE.Vector3(x, y + 1 * k, z), q, s); trunk.setMatrixAt(i, m);
    s.set(k * 1.1, k * 0.9, k * 1.1); m.compose(new THREE.Vector3(x, y + 3 * k, z), q, s); crown.setMatrixAt(i, m);
    crown.setColorAt(i, greens[Math.floor(Math.random() * greens.length)]);
    i++;
  }
  trunk.count = crown.count = i;
  scene.add(trunk, crown);
}
