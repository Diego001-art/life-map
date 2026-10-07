// Жители села из data/npcs.json. Стоят на своих местах, поворачиваются к герою, над головой «!» если есть дело.
// Модель с подвижными головой, руками и ногами: дышат, оглядываются, жестикулируют.
import * as THREE from 'three';
import { sectorPos } from '../world/sectors.js';

import { createHumanoid, animateHumanoid, setHumanoidDetail } from './humanoid.js';

const SKINS = ['#d6a882', '#c99a74', '#e0b48e', '#b8865e', '#d2a07a'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Житель (используется и для квестовых, и для фоновых жителей). Внешность слегка разная у каждого.
export function person({ color = '#4a3a30', beard = false, female = false, hat, skin } = {}) {
  const old = beard === true;                              // белая борода — старейшина
  return createHumanoid({
    skin: skin || pick(SKINS), female,
    shirt: female ? color : pick(['#d9d2c2', '#cfc8b8', '#b8b0a0']),
    pants: female ? '#2a2622' : pick(['#2e2a26', '#3a342e', '#2a2e30']),
    coat: color, coatLen: 0.45 + Math.random() * 0.2,
    hat: female ? 'scarf' : 'papakha', hatColor: female ? (hat || '#1d1d22') : (hat || (old ? '#eeeeee' : pick(['#3a3a3a', '#2b2622', '#5a4a3a']))),
    beard: female ? 'none' : old ? 'full' : beard ? 'short' : pick(['none', 'none', 'short']),
    beardColor: old ? '#dcdcdc' : (typeof beard === 'string' ? beard : pick(['#2a1d14', '#3a2a1a', '#1a1410'])),
    hair: old ? '#bdbdbd' : pick(['#2a1d14', '#1a1410', '#3a2a1a']),
    height: 0.94 + Math.random() * 0.1, width: 0.95 + Math.random() * 0.12,
  });
}

// Анимация жителя: стоит (дышит, оглядывается, моргает), идёт или разговаривает.
export function animatePerson(g, t, walk = 0, talk = 0, dt) { animateHumanoid(g, t, { walk, talk, dt }); }
export { setHumanoidDetail };

export async function createNpcs(scene, terrain) {
  const cfg = await (await fetch('data/npcs.json')).json();
  const mark = new THREE.MeshBasicMaterial({ color: '#ffd23a' });
  const list = cfg.npcs.map(n => {
    const { x, z } = sectorPos(n.sector, n.dx, n.dz);
    const obj = person({ color: n.color, beard: n.beard, female: n.female });
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    obj.position.set(x, terrain.heightAt(x, z), z);
    const ex = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), mark); ex.rotation.x = Math.PI; ex.position.y = 2.25; ex.userData.marker = true;
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
        if (d < 80) animatePerson(n.object, t, 0, talkingTo === n ? 1 : 0, dt);
        setHumanoidDetail(n.object, d < 30); // LOD: вдали без мелких деталей лица
        n.marker.visible = hasTask(n.id);
        n.marker.position.y = 2.25 + Math.sin(t * 3) * 0.08;
        n.marker.rotation.y = t * 2;
        if (d < 3 && (!near || d < near.d)) near = { npc: n, d };
      }
      return near && near.npc;
    },
  };
}
