// Герой: модель, ходьба, бег, прыжок. Позже сюда добавятся меч и анимации боя.
import * as THREE from 'three';

export function createPlayer(scene, terrain, houses) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 6), mat('#6b3a2a')); body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), mat('#e0b48c')); head.position.y = 1.85;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.3, 6), mat('#eee')); hat.position.y = 2.1; // папаха
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), mat('#2e2e2e')); legL.position.set(-0.15, 0.3, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  g.add(body, head, hat, legL, legR);
  g.traverse(o => o.castShadow = true);
  scene.add(g);

  const state = { vel: new THREE.Vector3(), onGround: true, walk: 0, speedBoost: 1 };
  g.position.set(0, terrain.heightAt(0, 0), 0);

  function update(dt, input, camYaw) {
    const speed = (input.run ? 9 : 4) * state.speedBoost;
    const dir = new THREE.Vector3(input.right, 0, -input.fwd);
    if (dir.lengthSq() > 0) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
      const nx = g.position.x + dir.x * speed * dt, nz = g.position.z + dir.z * speed * dt;
      // Столкновение с домами (простое: по кругу вокруг дома).
      const blocked = houses.some(h => g.position.y < h.top && Math.hypot(h.center.x - nx, h.center.z - nz) < h.radius * 0.8);
      const lim = terrain.size / 2 - 5;
      if (!blocked && Math.abs(nx) < lim && Math.abs(nz) < lim) { g.position.x = nx; g.position.z = nz; }
      g.rotation.y = Math.atan2(dir.x, dir.z);
      state.walk += dt * speed * 2;
    }
    const sw = Math.sin(state.walk) * (dir.lengthSq() ? 0.6 : 0);
    legL.rotation.x = sw; legR.rotation.x = -sw;

    const ground = terrain.heightAt(g.position.x, g.position.z);
    if (input.jump && state.onGround) { state.vel.y = 6; state.onGround = false; }
    state.vel.y -= 20 * dt;
    g.position.y += state.vel.y * dt;
    if (g.position.y <= ground) { g.position.y = ground; state.vel.y = 0; state.onGround = true; }
  }
  return { object: g, update, state };
}
