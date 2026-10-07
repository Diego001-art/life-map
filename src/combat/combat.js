// Боевая система: цели, хитбоксы, урон, эффекты попадания.
// Хитбокс оружия — сфера у клинка; он включается ТОЛЬКО в фазе удара (окно hit из clips.js ATTACKS),
// и каждую цель за один взмах можно задеть один раз.
// Цели: тренировочные чучела на площади и Горный змей (его каменную чешую не пробить без меча нартов — сюжет не меняется).
import * as THREE from 'three';
import { pbr } from '../world/textures.js';

export function createCombat(scene, terrain, effects, audio, hud) {
  const targets = []; // { id, pos: () => Vector3, radius, onHit(info) }
  return {
    targets,
    addTarget(t) { targets.push(t); return t; },
    // Проверить удар: сфера (center, r). hitSet — кого уже задели этим взмахом.
    sweep(center, r, info, hitSet) {
      let any = false;
      for (const t of targets) {
        if (hitSet.has(t) || (t.active && !t.active())) continue;
        const p = t.pos();
        if (p.distanceTo(center) < r + t.radius) { hitSet.add(t); t.onHit({ ...info, at: center.clone() }); any = true; }
      }
      return any;
    },
    // Эффект попадания: искры (металл/камень) или пыль и солома (чучело)
    impact(at, kind = 'spark') {
      if (kind === 'spark') { effects.sparks.emit(at.x, at.y, at.z, 14); audio.clang && audio.clang(); }
      else { effects.dust.emit(at.x, at.y, at.z, 10); audio.thud && audio.thud(); }
    },
  };
}

// Тренировочные чучела (на площади-годекане): качаются от ударов, сыпят солому. На сюжет не влияют.
export function createDummies(scene, terrain, combat, square, collision) {
  const list = [];
  const straw = pbr('wool', { color: '#c8a85a', normal: 2 }), wood = pbr('bark', { color: '#b8a080' }), cloth = pbr('cloth', { color: '#8a7a5a' });
  for (let i = 0; i < 3; i++) {
    const a = -0.6 + i * 0.5, x = square.x + Math.cos(a) * 17, z = square.z + Math.sin(a) * 17, y = terrain.heightAt(x, z);
    const g = new THREE.Group(), pivot = new THREE.Group(); g.add(pivot);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 8), wood); post.position.y = 1.05; g.add(post);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.85, 12), cloth); body.position.y = 1.35; pivot.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), straw); head.position.y = 1.95; pivot.add(head);
    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), wood); arms.rotation.z = Math.PI / 2; arms.position.y = 1.62; pivot.add(arms);
    for (const s of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), straw); tuft.position.set(0.58 * s, 1.62, 0); tuft.rotation.z = s * Math.PI / 2; pivot.add(tuft); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, y, z); g.rotation.y = Math.atan2(square.x - x, square.z - z); scene.add(g);
    collision.add([{ type: 'circle', x, z, r: 0.35, top: y + 2 }]);
    const d = { g, pivot, swing: 0, vel: 0, dir: new THREE.Vector3() };
    combat.addTarget({ id: 'dummy' + i, radius: 0.35, pos: () => new THREE.Vector3(x, y + 1.4, z),
      onHit(info) { d.vel += (info.heavy ? 5 : 2.5); d.dir.set(x - info.from.x, 0, z - info.from.z).normalize(); combat.impact(info.at, 'dust'); } });
    list.push(d);
  }
  return (dt) => {
    for (const d of list) { // пружина: чучело качается и возвращается
      d.vel += -d.swing * 40 * dt; d.vel *= 1 - 4 * dt; d.swing += d.vel * dt;
      d.pivot.rotation.x = d.swing * 0.4 * d.dir.z; d.pivot.rotation.z = -d.swing * 0.4 * d.dir.x;
    }
  };
}
