// Деревья, небо, свет.
import * as THREE from 'three';
import { addWind } from './env.js';

// Фруктовые деревья — в основном в селе и в овраге; на голых склонах редко.
export function createTrees(scene, terrain, houses, roads, count = 500) {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 2, 5), new THREE.MeshLambertMaterial({ color: '#5a4030' }), count);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.8, 0), addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 0.18, 1.8), count);
  trunk.castShadow = crown.castShadow = true;
  const greens = ['#4f8a34', '#5e9a3a', '#3f7a2e', '#6aa444', '#86b04e'].map(c => new THREE.Color(c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3();
  let i = 0, tries = 0;
  while (i < count && tries++ < count * 30) {
    const inVillage = Math.random() < 0.8, r = inVillage ? Math.sqrt(Math.random()) * 380 : 380 + Math.random() * 500, a = Math.random() * 6.28;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 2) || roads.distToRoad(x, z) < 2) continue;
    const y = terrain.heightAt(x, z), k = 0.7 + Math.random() * 0.7;
    q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
    s.set(k, k, k); m.compose(new THREE.Vector3(x, y + 1 * k, z), q, s); trunk.setMatrixAt(i, m);
    s.set(k * 1.1, k * 0.9, k * 1.1); m.compose(new THREE.Vector3(x, y + 3 * k, z), q, s); crown.setMatrixAt(i, m);
    crown.setColorAt(i, greens[Math.floor(Math.random() * greens.length)]);
    i++;
  }
  trunk.count = crown.count = i;
  scene.add(trunk, crown);

  // Тополя — высокие и узкие, растут рядами у дорог и в овраге (как на фото села).
  const PN = 160;
  const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 3, 5), new THREE.MeshLambertMaterial({ color: '#6a5a48' }), PN);
  const pGeo = new THREE.IcosahedronGeometry(1, 1); pGeo.scale(1.3, 5, 1.3); pGeo.translate(0, 5, 0);
  const pCrown = new THREE.InstancedMesh(pGeo, addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 0.35, 10), PN);
  pTrunk.castShadow = pCrown.castShadow = true;
  const pc = ['#4a7a34', '#557f38', '#3f6c30'].map(c => new THREE.Color(c));
  let pn = 0;
  for (const { kind, pts } of roads.lines) {
    if (kind === 'path') continue;
    for (let j = 0; j < pts.length && pn < PN; j += 4) {
      const p = pts[j]; if (Math.hypot(p.x, p.z) > 420 || Math.random() < 0.6) continue;
      const q = pts[Math.min(pts.length - 1, j + 1)], a = Math.atan2(q.z - p.z, q.x - p.x), side = Math.random() < 0.5 ? 1 : -1, off = 5 + Math.random() * 3;
      const x = p.x - Math.sin(a) * off * side, z = p.z + Math.cos(a) * off * side;
      if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 2) || roads.distToRoad(x, z) < 1.5) continue;
      const y = terrain.heightAt(x, z), k = 0.8 + Math.random() * 0.5;
      q2.identity(); s.set(k, k, k);
      m.compose(new THREE.Vector3(x, y + 1.5 * k, z), q2, s); pTrunk.setMatrixAt(pn, m);
      m.compose(new THREE.Vector3(x, y + 1 * k, z), q2, s); pCrown.setMatrixAt(pn, m); pCrown.setColorAt(pn, pc[pn % 3]);
      pn++;
    }
  }
  pTrunk.count = pCrown.count = pn; scene.add(pTrunk, pCrown);

  // Кусты: группами по склонам и у оград.
  const BN = 700;
  const bush = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 0.08, 0.9), BN);
  bush.castShadow = true;
  const bc = ['#4d7a33', '#5f8a3a', '#6b7f3a', '#3f6a2e'].map(c => new THREE.Color(c));
  let bn = 0;
  for (let k = 0; k < BN * 4 && bn < BN; k++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 750, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 1) || roads.distToRoad(x, z) < 1) continue;
    for (let c = 0; c < 1 + Math.floor(Math.random() * 3) && bn < BN; c++) { // кусты растут кучками
      const bx = x + (Math.random() - 0.5) * 3, bz = z + (Math.random() - 0.5) * 3, kk = 0.6 + Math.random() * 0.9;
      q2.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); s.set(kk * 1.2, kk * 0.8, kk);
      m.compose(new THREE.Vector3(bx, terrain.heightAt(bx, bz) + 0.3 * kk, bz), q2, s); bush.setMatrixAt(bn, m); bush.setColorAt(bn, bc[bn % 4]); bn++;
    }
  }
  bush.count = bn; scene.add(bush);
}

// Мелкие детали: пучки травы, камни, каменные ограды вдоль улиц.
export function createDetails(scene, terrain, houses, roads) {
  const dummy = new THREE.Object3D();
  const nearHouse = (x, z, pad) => houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + pad);

  // Трава: три травинки-конуса в пучке.
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.7, 3); tuftGeo.translate(0, 0.35, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, addWind(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.12, 0.7), 9000);
  const gc = ['#5d9a3a', '#6faa44', '#4f8a32', '#89a84a', '#a2b25a'].map(c => new THREE.Color(c));
  let n = 0;
  for (let i = 0; i < 20000 && n < 9000; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 650, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roads.distToRoad(x, z) < 0.5 || nearHouse(x, z, 0.5)) continue;
    dummy.position.set(x, terrain.heightAt(x, z), z);
    dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
    const k = 0.6 + Math.random() * 0.9; dummy.scale.set(k, k, k);
    dummy.updateMatrix(); tufts.setMatrixAt(n, dummy.matrix); tufts.setColorAt(n, gc[n % gc.length]); n++;
  }
  tufts.count = n; scene.add(tufts);

  // Камни.
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshLambertMaterial({ color: '#9a9488', flatShading: true }), 700);
  rocks.castShadow = rocks.receiveShadow = true; n = 0;
  for (let i = 0; i < 3000 && n < 700; i++) {
    const a = Math.random() * 6.28, r = 50 + Math.random() * 850, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roads.distToRoad(x, z) < 1 || nearHouse(x, z, 1)) continue;
    const k = 0.3 + Math.random() ** 3 * 2.5;
    dummy.position.set(x, terrain.heightAt(x, z) + k * 0.15, z);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); dummy.scale.set(k, k * 0.7, k);
    dummy.updateMatrix(); rocks.setMatrixAt(n++, dummy.matrix);
  }
  rocks.count = n; scene.add(rocks);

  // Каменные ограды вдоль улиц (там, где нет дома).
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.7, 0.35), new THREE.MeshLambertMaterial({ color: '#b3a68c', flatShading: true }), 6000);
  walls.castShadow = walls.receiveShadow = true; n = 0;
  for (const { kind, pts } of roads.lines) {
    if (kind === 'path') continue;
    const off = (kind === 'main' ? 2.75 : 1.8) + 0.9;
    for (let i = 0; i < pts.length - 1 && n < 6000; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.hypot(a.x, a.z) > 360) continue;
      const ang = Math.atan2(b.z - a.z, b.x - a.x), L = Math.hypot(b.x - a.x, b.z - a.z);
      for (const side of [1, -1]) {
        const x = (a.x + b.x) / 2 - Math.sin(ang) * off * side, z = (a.z + b.z) / 2 + Math.cos(ang) * off * side;
        const ex = Math.cos(ang) * L / 2, ez = Math.sin(ang) * L / 2; // концы ограды не должны заходить на другую дорогу
        if (nearHouse(x, z, 1.5) || roads.distToRoad(x, z) < 0.3 || roads.distToRoad(x + ex, z + ez) < 0.3 || roads.distToRoad(x - ex, z - ez) < 0.3) continue;
        dummy.position.set(x, terrain.heightAt(x, z) + 0.2, z);
        dummy.rotation.set(0, -ang, 0); dummy.scale.set(L / 2.15, 0.8 + Math.random() * 0.4, 1);
        dummy.updateMatrix(); walls.setMatrixAt(n++, dummy.matrix);
      }
    }
  }
  walls.count = n; scene.add(walls);
}

// Орёл кружит над селом.
export function createEagle(scene) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: '#3b2a1e', side: THREE.DoubleSide, flatShading: true });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 5), m); body.rotation.x = Math.PI / 2;
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, 0, 0, 0.6, 3.2, 0.2, -0.2], 3)); wingGeo.computeVertexNormals();
  const wl = new THREE.Mesh(wingGeo, m), wr = new THREE.Mesh(wingGeo, m); wr.scale.x = -1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 5, 4), new THREE.MeshLambertMaterial({ color: '#e8dcc0' })); head.position.z = 1.1;
  g.add(body, wl, wr, head); g.scale.setScalar(1.6); scene.add(g);
  let t = Math.random() * 10;
  return (dt, around) => {
    t += dt;
    const a = t * 0.06, r = 140;
    g.position.set(around.x + Math.cos(a) * r, around.y + 90 + Math.sin(t * 0.3) * 10, around.z + Math.sin(a) * r);
    g.rotation.set(0, -a, 0.35);
    const flap = Math.sin(t * 6) > 0.7 ? Math.sin(t * 12) * 0.4 : 0.05; // в основном парит, иногда взмахивает
    wl.rotation.z = flap; wr.rotation.z = -flap;
  };
}
