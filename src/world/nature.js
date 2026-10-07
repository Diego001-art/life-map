// Деревья, небо, свет.
import * as THREE from 'three';
import { addWind } from './env.js';
import { pbr } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Мелкие детали: пучки травы, каменные ограды вдоль улиц (у оград есть коллизия — сквозь них не пройти).
export function createDetails(scene, terrain, houses, roads) {
  const dummy = new THREE.Object3D();
  const nearHouse = (x, z, pad) => houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + pad);

  // Трава: три травинки-конуса в пучке.
  // пучок из 7 тонких травинок разной высоты и наклона
  const blades = [];
  for (let b = 0; b < 7; b++) {
    const h = 0.25 + Math.random() * 0.35, bl = new THREE.ConeGeometry(0.018, h, 3, 1, true);
    bl.translate(0, h / 2, 0); bl.rotateZ((Math.random() - 0.5) * 0.7); bl.rotateX((Math.random() - 0.5) * 0.7);
    bl.translate((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12); blades.push(bl);
  }
  const tuftGeo = mergeGeometries(blades);
  const tufts = new THREE.InstancedMesh(tuftGeo, addWind(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), 0.08, 0.5), 14000);
  const gc = ['#4f7f34', '#5f8a3a', '#46752f', '#7a8a44', '#8a9450', '#6a7f3a'].map(c => new THREE.Color(c));
  let n = 0;
  for (let i = 0; i < 30000 && n < 14000; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 650, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roads.distToRoad(x, z) < 0.5 || nearHouse(x, z, 0.5)) continue;
    dummy.position.set(x, terrain.heightAt(x, z), z);
    dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
    const k = 0.6 + Math.random() * 0.9; dummy.scale.set(k, k, k);
    dummy.updateMatrix(); tufts.setMatrixAt(n, dummy.matrix); tufts.setColorAt(n, gc[n % gc.length]); n++;
  }
  tufts.count = n; scene.add(tufts);

  // Каменные ограды вдоль улиц (там, где нет дома).
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.75, 0.45), pbr('rock', { color: '#cfc6b4', normal: 1.6 }), 6000); // ограды из бутового камня
  const colliders = [];
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
        colliders.push({ type: 'box', cx: x, cz: z, ang, w: L, d: 0.45, top: dummy.position.y + 0.5 });
      }
    }
  }
  walls.count = n; scene.add(walls);

  // Деревянные заборы из жердей вокруг части огородов: столбы + две жерди, немного кривые и разной высоты.
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 6), pbr('bark', { color: '#c8b49a' }), 3000);
  const rail = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.045, 1, 6), pbr('planks', { color: '#b8a080' }), 6000);
  post.castShadow = rail.castShadow = true;
  let pn = 0, rn = 0;
  for (const h of houses) {
    if (!h.box || Math.random() > 0.35 || pn > 2900) continue;
    // огород позади дома (со стороны от дороги)
    const { ang, w, d, cx, cz } = h.box, ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux;
    const side = roads.distToRoad(cx + nx * (d / 2 + 3), cz + nz * (d / 2 + 3)) > roads.distToRoad(cx - nx * (d / 2 + 3), cz - nz * (d / 2 + 3)) ? 1 : -1;
    const W = w + 2, D = 6 + Math.random() * 5, ox = cx + nx * side * (d / 2 + 0.6), oz = cz + nz * side * (d / 2 + 0.6);
    const corners = [[-W / 2, 0], [-W / 2, D], [W / 2, D], [W / 2, 0]].map(([a, b]) => ({ x: ox + ux * a + nx * side * b, z: oz + uz * a + nz * side * b }));
    for (let e = 0; e < 3; e++) {
      const A = corners[e], Bc = corners[e + 1], L = Math.hypot(Bc.x - A.x, Bc.z - A.z), k = Math.max(1, Math.round(L / 2.2));
      if (houses.some(o => o !== h && Math.hypot(o.center.x - (A.x + Bc.x) / 2, o.center.z - (A.z + Bc.z) / 2) < o.radius + 1)) continue;
      if (roads.distToRoad((A.x + Bc.x) / 2, (A.z + Bc.z) / 2) < 1) continue;
      let prev = null;
      for (let i = 0; i <= k; i++) {
        const x = A.x + (Bc.x - A.x) * i / k, z = A.z + (Bc.z - A.z) * i / k, y = terrain.heightAt(x, z), hh = 0.9 + Math.random() * 0.4;
        dummy.position.set(x, y + 0.45, z); dummy.rotation.set((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.12); dummy.scale.set(1, hh, 1);
        dummy.updateMatrix(); post.setMatrixAt(pn++, dummy.matrix);
        const cur = { x, y, z };
        if (prev) for (const ry of [0.45, 0.85]) {
          const mx = (prev.x + x) / 2, mz = (prev.z + z) / 2, my = (prev.y + y) / 2 + ry, len = Math.hypot(x - prev.x, z - prev.z, y - prev.y);
          dummy.position.set(mx, my, mz); dummy.scale.set(1, len, 1);
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x - prev.x, y - prev.y, z - prev.z).normalize());
          dummy.updateMatrix(); rail.setMatrixAt(rn++, dummy.matrix); dummy.rotation.set(0, 0, 0);
        }
        prev = cur;
      }
      colliders.push({ type: 'box', cx: (A.x + Bc.x) / 2, cz: (A.z + Bc.z) / 2, ang: Math.atan2(Bc.z - A.z, Bc.x - A.x), w: L, d: 0.3, top: terrain.heightAt(A.x, A.z) + 1.1 });
    }
  }
  post.count = pn; rail.count = rn; scene.add(post, rail);
  return colliders;
}

// Орёл кружит над селом.
export function createEagle(scene) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#3b2a1e', side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 5), m); body.rotation.x = Math.PI / 2;
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, 0, 0, 0.6, 3.2, 0.2, -0.2], 3)); wingGeo.computeVertexNormals();
  const wl = new THREE.Mesh(wingGeo, m), wr = new THREE.Mesh(wingGeo, m); wr.scale.x = -1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 5, 4), new THREE.MeshStandardMaterial({ color: '#e8dcc0' })); head.position.z = 1.1;
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
