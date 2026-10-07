// Герой: модель с руками и ногами на шарнирах, анимации (стоит, идёт, бежит, прыгает),
// плавный поворот и надетые вещи (папаха, черкеска, сапоги, посох, оберег, рог на поясе, рюкзак).
import * as THREE from 'three';
import { makeMesh } from '../items/models.js';

const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

function limb(w, h, d, color) { // конечность вращается от верхнего края (плечо/бедро)
  const pivot = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = -h / 2; pivot.add(m); pivot.userData.mesh = m; return pivot;
}

export function createPlayer(scene, terrain, houses, inventory) {
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root); // root качается при ходьбе
  const shirt = mat('#d9d2c2'), skin = mat('#e0b48c');
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt); torso.position.y = 1.32;
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.25, 0.32), mat('#2e2a26')); hips.position.y = 0.88;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin); head.position.y = 1.92;
  const beard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), mat('#2a1d14')); beard.position.set(0, 1.8, 0.18);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.02), mat('#1a1a1a')); eyes.position.set(0, 1.95, 0.175);
  const armL = limb(0.17, 0.68, 0.17, '#d9d2c2'), armR = limb(0.17, 0.68, 0.17, '#d9d2c2');
  armL.position.set(-0.41, 1.66, 0); armR.position.set(0.41, 1.66, 0);
  const legL = limb(0.22, 0.8, 0.22, '#2e2a26'), legR = limb(0.22, 0.8, 0.22, '#2e2a26');
  legL.position.set(-0.15, 0.82, 0); legR.position.set(0.15, 0.82, 0);
  // рюкзак на спине
  const pack = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.24), mat('#6b5233')); pack.add(bag);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.26), mat('#5a4228')); flap.position.y = 0.2; pack.add(flap);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), mat('#8a2f2a')); roll.rotation.z = Math.PI / 2; roll.position.y = 0.34; pack.add(roll);
  pack.position.set(0, 1.35, -0.3);
  root.add(torso, hips, head, beard, eyes, armL, armR, legL, legR, pack);

  // Места для надетых вещей.
  const slots = {
    head: new THREE.Group(), body: new THREE.Group(), hand: new THREE.Group(), neck: new THREE.Group(), belt: new THREE.Group(),
  };
  slots.head.position.set(0, 2.08, 0); root.add(slots.head);
  slots.body.position.set(0, 0.82, 0); root.add(slots.body);
  slots.neck.position.set(0, 1.42, 0.18); root.add(slots.neck);
  slots.belt.position.set(0.32, 0.95, 0.05); slots.belt.rotation.z = -0.5; root.add(slots.belt);
  slots.hand.position.set(0, -0.62, 0.05); armR.add(slots.hand);

  function dress() {
    const eq = inventory.equipped, defs = inventory.defs;
    for (const k in slots) slots[k].clear();
    for (const k in slots) {
      const id = eq[k]; if (!id) continue;
      const d = defs[id], m = makeMesh(d.shape, d.color);
      if (k === 'body') { m.scale.set(1.45, 0.95, 0.85); }        // черкеска поверх рубахи
      if (k === 'hand') { m.position.y = -0.8; }                   // посох в руке
      if (k === 'neck') { m.scale.setScalar(0.9); m.position.y = -0.2; }
      slots[k].add(m);
    }
    const boots = eq.feet ? defs[eq.feet].color : '#2e2a26';
    legL.userData.mesh.material = legR.userData.mesh.material = mat(eq.feet ? boots : '#2e2a26');
    const sleeve = eq.body ? defs[eq.body].color : '#d9d2c2';
    armL.userData.mesh.material = armR.userData.mesh.material = mat(sleeve);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  dress();
  scene.add(g);

  const state = { vel: new THREE.Vector3(), onGround: true, walk: 0, speedBoost: 1, moving: 0, yaw: 0, time: 0 };
  g.position.set(0, terrain.heightAt(0, 0), 0);
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

  function update(dt, input, camYaw) {
    state.time += dt; state.fwd = input.fwd;
    const running = input.run;
    const speed = (running ? 9 : 4) * state.speedBoost;
    const dir = new THREE.Vector3(input.right, 0, -input.fwd);
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
      const nx = g.position.x + dir.x * speed * dt, nz = g.position.z + dir.z * speed * dt;
      const blocked = houses.some(h => g.position.y < h.top && Math.hypot(h.center.x - nx, h.center.z - nz) < h.radius * 0.8);
      const lim = terrain.size / 2 - 5;
      if (!blocked && Math.abs(nx) < lim && Math.abs(nz) < lim) { g.position.x = nx; g.position.z = nz; }
      state.yaw = lerpAngle(state.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 12)); // плавный поворот
      state.walk += dt * speed * 1.7;
    }
    g.rotation.y = state.yaw;
    // плавный переход между «стоит» и «идёт»
    state.moving += ((moving ? (running ? 1.4 : 1) : 0) - state.moving) * Math.min(1, dt * 8);
    const m = state.moving, sw = Math.sin(state.walk);
    legL.rotation.x = sw * 0.7 * m; legR.rotation.x = -sw * 0.7 * m;
    armL.rotation.x = -sw * 0.6 * m; armR.rotation.x = sw * 0.5 * m * (inventory.equipped.hand ? 0.4 : 1);
    root.position.y = Math.abs(Math.cos(state.walk)) * 0.07 * m + Math.sin(state.time * 2) * 0.01; // покачивание и дыхание
    root.rotation.x = m > 1.1 ? (m - 1) * 0.35 : 0; // наклон при беге
    pack.rotation.x = -Math.abs(sw) * 0.08 * m;

    const ground = terrain.heightAt(g.position.x, g.position.z);
    if (input.jump && state.onGround) { state.vel.y = 6.5; state.onGround = false; }
    state.vel.y -= 20 * dt;
    g.position.y += state.vel.y * dt;
    if (g.position.y <= ground) { g.position.y = ground; state.vel.y = 0; state.onGround = true; }
    if (!state.onGround) { legL.rotation.x = 0.5; legR.rotation.x = -0.3; armL.rotation.x = armR.rotation.x = -0.8; } // поза прыжка
  }
  return { object: g, update, state, dress, get moving() { return state.moving > 0.2; } };
}
