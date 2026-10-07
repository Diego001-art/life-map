// Герой: модель человека (src/npc/humanoid.js), ходьба, бег, прыжок, плавный поворот.
// Надетые вещи видны на теле: папаха, черкеска (отдельный слой одежды), сапоги, посох в руке, оберег, рог на поясе, рюкзак.
// Коллизии (src/world/collision.js) не дают пройти сквозь дома, ограды, деревья, камни и жителей.
import * as THREE from 'three';
import { makeMesh } from '../items/models.js';
import { createHumanoid, animateHumanoid, papakha } from '../npc/humanoid.js';
import { pbr } from '../world/textures.js';

function backpack() {
  const g = new THREE.Group(), leather = pbr('cloth', { color: '#7a5a3a', roughness: 0.8 });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.13), leather); g.add(bag);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.12, 0.145), pbr('cloth', { color: '#5a4228' })); flap.position.y = 0.13; g.add(flap);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), pbr('wool', { color: '#5a3a2a' })); roll.rotation.z = Math.PI / 2; roll.position.set(0, -0.2, 0.02); g.add(roll);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.02), pbr('cloth', { color: '#3a2a1a' })); st.position.set(0.1 * s, 0.02, 0.075); g.add(st); } // лямки
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

export function createPlayer(scene, terrain, collision, inventory) {
  const g = new THREE.Group(); scene.add(g);
  let hero = null;

  // Собрать модель по надетым вещам.
  function dress() {
    const eq = inventory.equipped, defs = inventory.defs;
    if (hero) g.remove(hero);
    const coat = eq.body ? defs[eq.body].color : null;
    hero = createHumanoid({ skin: '#d4a47c', shirt: '#d9d2c2', pants: '#2e2a26', coat, hat: 'none', beard: 'short', beardColor: '#2a1d14', hair: '#2a1d14', boots: eq.feet ? defs[eq.feet].color : '#4a3a2a' });
    const u = hero.userData;
    if (eq.head) { const d = defs[eq.head]; u.hatHolder.add(d.shape === 'papakha' ? papakha(d.color) : makeMesh(d.shape, d.color)); }
    if (eq.hand) { // посох в правой руке: рука согнута, посох стоит вертикально перед героем и не проходит сквозь тело
      const d = defs[eq.hand], m = makeMesh(d.shape, d.color), grip = new THREE.Group();
      m.position.y = -1.0; grip.add(m); grip.position.set(0, -0.3, 0.02); grip.rotation.x = 1.2; u.arms[1].el.add(grip); u.holding = true;
    }
    if (eq.neck) { const d = defs[eq.neck], m = makeMesh(d.shape, d.color); m.scale.setScalar(0.6); m.position.set(0, 0.36, 0.12); u.chest.add(m); }
    if (eq.belt) { const d = defs[eq.belt], m = makeMesh(d.shape, d.color); m.scale.setScalar(0.7); m.rotation.z = -0.6; m.position.set(0.21, -0.02, 0.04); u.hips.add(m); }
    const pack = backpack(); pack.position.set(0, 0.3, -0.165); u.chest.add(pack); u.pack = pack;
    hero.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(hero);
  }
  dress();

  const state = { vel: new THREE.Vector3(), onGround: true, walk: 0, speedBoost: 1, moving: 0, yaw: 0, time: 0, fwd: 0 };
  g.position.set(0, terrain.heightAt(0, 0), 0);
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

  function update(dt, input, camYaw) {
    state.time += dt; state.fwd = input.fwd;
    const running = input.run;
    const speed = (running ? 7.5 : 3.6) * state.speedBoost;
    const dir = new THREE.Vector3(input.right, 0, -input.fwd);
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
      // шаг вперёд, затем коллизии выталкивают из препятствий (герой скользит вдоль стены, а не застревает)
      const p = collision.resolve({ x: g.position.x + dir.x * speed * dt, z: g.position.z + dir.z * speed * dt }, 0.4, g.position.y);
      g.position.x = p.x; g.position.z = p.z;
      state.yaw = lerpAngle(state.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 10)); // плавный поворот
      state.walk += dt * speed * 2.1;   // фаза шага (по ней же звучат шаги)
    }
    g.rotation.y = state.yaw;
    state.moving += ((moving ? (running ? 1.4 : 1) : 0) - state.moving) * Math.min(1, dt * 8);
    animateHumanoid(hero, state.time, { walk: state.moving, phase: state.walk, look: false, dt });
    if (hero.userData.holding) { hero.userData.arms[1].sh.rotation.x = 0.05 + Math.sin(state.walk) * 0.08 * state.moving; hero.userData.arms[1].el.rotation.x = -1.2; }
    if (hero.userData.pack) hero.userData.pack.rotation.x = -Math.abs(Math.sin(state.walk)) * 0.06 * state.moving;

    const ground = terrain.heightAt(g.position.x, g.position.z);
    if (input.jump && state.onGround) { state.vel.y = 5.5; state.onGround = false; }
    state.vel.y -= 18 * dt;
    g.position.y += state.vel.y * dt;
    if (g.position.y <= ground) { g.position.y = ground; state.vel.y = 0; state.onGround = true; } // не проваливается в землю
    if (!state.onGround) { // поза прыжка
      const u = hero.userData; u.legs[0].th.rotation.x = -0.5; u.legs[0].kn.rotation.x = 1.0; u.legs[1].th.rotation.x = 0.2; u.legs[1].kn.rotation.x = 0.5;
      u.arms[0].sh.rotation.x = u.arms[1].sh.rotation.x = -0.5;
    }
  }
  return { object: g, update, state, dress, get moving() { return state.moving > 0.2; } };
}
