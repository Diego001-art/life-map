// Жители села из data/npcs.json. Стоят на своих местах, поворачиваются к герою, над головой «!» если есть дело.
// Модель с подвижными головой, руками и ногами: дышат, оглядываются, жестикулируют.
import * as THREE from 'three';
import { sectorPos } from '../world/sectors.js';

const M = {};
const m = (c) => M[c] || (M[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
function limb(w, h, d, color) { const p = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(color)); b.position.y = -h / 2; p.add(b); return p; }

// Житель (используется и для квестовых, и для фоновых жителей).
export function person({ color = '#4a3a30', beard = false, female = false, hat, skin = '#d9ab84' } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.78, 0.34), m(color)); torso.position.y = 1.32; body.add(torso);
  const head = new THREE.Group(); head.position.y = 1.78; body.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.36, 0.33), m(skin)); face.position.y = 0.16; head.add(face);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.02), m('#1a1a1a')); eyes.position.set(0, 0.2, 0.17); head.add(eyes);
  const armL = limb(0.16, 0.68, 0.16, color), armR = limb(0.16, 0.68, 0.16, color);
  armL.position.set(-0.39, 1.66, 0); armR.position.set(0.39, 1.66, 0); body.add(armL, armR);
  const legL = limb(0.21, 0.8, 0.21, female ? color : '#2b2622'), legR = limb(0.21, 0.8, 0.21, female ? color : '#2b2622');
  legL.position.set(-0.14, 0.82, 0); legR.position.set(0.14, 0.82, 0); body.add(legL, legR);
  if (beard) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.08), m(beard === true ? '#dcdcdc' : beard)); b.position.set(0, 0.0, 0.17); head.add(b); }
  if (female) { // платок, длинное платье с золотой каймой
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), m(hat || '#1d1d22')); scarf.position.set(0, 0.2, -0.03); head.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.1), m(hat || '#1d1d22')); tail.position.set(0, -0.1, -0.2); head.add(tail);
    face.position.z = 0.04;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.55, 0.95, 7), m(color)); skirt.position.y = 0.5; body.add(skirt);
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.57, 0.1, 7), m('#c9a24a')); trim.position.y = 0.08; body.add(trim);
    legL.visible = legR.visible = false;
  } else { // папаха
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.3, 8), m(hat || (beard === true ? '#eeeeee' : '#3a3a3a'))); p.position.y = 0.48; head.add(p);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { body, head, armL, armR, legL, legR, phase: Math.random() * 10 };
  return g;
}

// Анимация жителя: стоит (дышит, оглядывается) или идёт.
export function animatePerson(g, t, walk = 0, talk = 0) {
  const u = g.userData, ph = t + u.phase;
  if (walk > 0) {
    const s = Math.sin(ph * 6);
    u.legL.rotation.x = s * 0.6 * walk; u.legR.rotation.x = -s * 0.6 * walk;
    u.armL.rotation.x = -s * 0.45 * walk; u.armR.rotation.x = s * 0.45 * walk;
    u.body.position.y = Math.abs(Math.cos(ph * 6)) * 0.05 * walk;
    u.head.rotation.y = 0;
  } else {
    u.legL.rotation.x = u.legR.rotation.x = 0;
    u.body.position.y = Math.sin(ph * 1.8) * 0.012;                         // дыхание
    u.head.rotation.y = Math.sin(ph * 0.4) * 0.5 * (1 - talk) * (Math.sin(ph * 0.13) > 0 ? 1 : 0.2); // оглядывается
    u.head.rotation.x = Math.sin(ph * 0.7) * 0.05;
    u.armL.rotation.x = Math.sin(ph * 1.8) * 0.03;
    u.armR.rotation.x = talk ? -0.6 - Math.sin(ph * 3) * 0.35 : Math.sin(ph * 1.8 + 1) * 0.03; // жест при разговоре
    u.armR.rotation.z = talk ? 0.2 : 0;
  }
}

export async function createNpcs(scene, terrain) {
  const cfg = await (await fetch('data/npcs.json')).json();
  const mark = new THREE.MeshBasicMaterial({ color: '#ffd23a' });
  const list = cfg.npcs.map(n => {
    const { x, z } = sectorPos(n.sector, n.dx, n.dz);
    const obj = person({ color: n.color, beard: n.beard, female: n.female });
    obj.position.set(x, terrain.heightAt(x, z), z);
    const ex = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), mark); ex.rotation.x = Math.PI; ex.position.y = 2.8;
    obj.add(ex);
    scene.add(obj);
    return { ...n, object: obj, marker: ex, yaw: Math.random() * 6 };
  });
  return {
    list,
    byId: (id) => list.find(n => n.id === id),
    update(p, hasTask, t, talkingTo, dt = 0.016) {
      let near = null;
      for (const n of list) {
        const d = n.object.position.distanceTo(p);
        // плавно поворачивается к герою, когда он рядом
        if (d < 12) {
          const want = Math.atan2(p.x - n.object.position.x, p.z - n.object.position.z);
          let df = ((want - n.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (df < -Math.PI) df += Math.PI * 2;
          n.yaw += df * Math.min(1, dt * 4);
        }
        n.object.rotation.y = n.yaw;
        if (d < 80) animatePerson(n.object, t, 0, talkingTo === n ? 1 : 0);
        n.marker.visible = hasTask(n.id);
        n.marker.position.y = 2.8 + Math.sin(t * 3) * 0.1;
        n.marker.rotation.y = t * 2;
        if (d < 3 && (!near || d < near.d)) near = { npc: n, d };
      }
      return near && near.npc;
    },
  };
}
