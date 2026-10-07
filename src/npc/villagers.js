// Фоновые жители (без заданий): днём гуляют по улицам и сидят на площади, ночью уходят по домам.
// На сюжет и квесты не влияют — только оживляют село.
import * as THREE from 'three';
import { env } from '../world/env.js';
import { person, animatePerson, setHumanoidDetail } from './npcs.js';

const LOOKS = [
  { color: '#3b3b44', beard: '#2a1d14' }, { color: '#5a4636' }, { color: '#2f3d4a', beard: true }, { color: '#4a2e22', hat: '#eeeeee' },
  { color: '#2a2a30', female: true }, { color: '#5a2a35', female: true, hat: '#6a1f2a' }, { color: '#3a3f2a', female: true, hat: '#2b3a5a' },
  { color: '#6b5a44', hat: '#2b2b2b' }, { color: '#28323a', female: true }, { color: '#4b3b2b', beard: '#3a2a1a' },
];

export function createVillagers(scene, terrain, roads, square, collision) {
  const inVillage = (p) => roads.layout && roads.layout.has ? roads.layout.village(p.x, p.z) > 0.3 && Math.hypot(p.x, p.z) < 450 : Math.hypot(p.x, p.z) < 330;
  const routes = roads.lines.filter(l => ['main', 'street', 'lane'].includes(l.kind)).map(l => l.pts.filter(inVillage)).filter(r => r.length > 8);
  const people = [];
  for (let i = 0; i < 16 && routes.length; i++) {
    const g = person(LOOKS[i % LOOKS.length]);
    scene.add(g);
    if (collision) collision.addDynamic({ type: 'circle', get x() { return g.visible ? g.position.x : 1e6; }, get z() { return g.position.z; }, r: 0.4 });
    if (i < 4) { // сидят/стоят на площади-годекане и беседуют
      const a = i / 4 * Math.PI * 2 + 0.3, x = square.x + Math.cos(a) * 8.5, z = square.z + Math.sin(a) * 8.5;
      g.position.set(x, terrain.heightAt(x, z), z); g.rotation.y = Math.atan2(square.x - x, square.z - z);
      people.push({ g, still: true });
    } else {
      const route = routes[i % routes.length], at = Math.floor(Math.random() * route.length);
      const side = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8);
      people.push({ g, route, at, dir: Math.random() < 0.5 ? 1 : -1, side, speed: 1 + Math.random() * 0.5, wait: 0, f: 0 });
    }
  }
  let t = 0;
  return (dt, player) => {
    t += dt;
    const home = env.night > 0.65; // ночью все по домам
    for (const p of people) {
      p.g.visible = !home && Math.abs(p.g.position.x - player.x) < 220 && Math.abs(p.g.position.z - player.z) < 220;
      if (!p.g.visible) continue;
      setHumanoidDetail(p.g, Math.abs(p.g.position.x - player.x) + Math.abs(p.g.position.z - player.z) < 40);
      if (p.still) { animatePerson(p.g, t, 0, Math.sin(t * 0.5 + p.g.position.x) > 0.3 ? 1 : 0, dt); continue; }
      if (p.wait > 0) { p.wait -= dt; animatePerson(p.g, t, 0, 0, dt); continue; }
      const r = p.route, a = r[p.at], nb = r[p.at + p.dir];
      if (!nb) { p.dir *= -1; p.wait = 2 + Math.random() * 5; continue; }
      p.f += dt * p.speed / Math.max(0.1, Math.hypot(nb.x - a.x, nb.z - a.z));
      if (p.f >= 1) { p.f = 0; p.at += p.dir; if (Math.random() < 0.03) p.wait = 3 + Math.random() * 6; continue; }
      const dx = nb.x - a.x, dz = nb.z - a.z, L = Math.hypot(dx, dz) || 1;
      const x = a.x + dx * p.f - dz / L * p.side, z = a.z + dz * p.f + dx / L * p.side;
      p.g.position.set(x, terrain.heightAt(x, z), z);
      const want = Math.atan2(dx, dz); let df = ((want - p.g.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI; if (df < -Math.PI) df += Math.PI * 2;
      p.g.rotation.y += df * Math.min(1, dt * 5);
      animatePerson(p.g, t * p.speed * 0.7, 1, 0, dt);
    }
  };
}
