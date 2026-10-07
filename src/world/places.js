// Особые места из data/places.json: пещера со змеем, камень нарта, башня, родник.
import * as THREE from 'three';
import { sectorPos } from './sectors.js';

import { pbr } from './textures.js';
import { rockGeometry } from './rocks.js';
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });

function cave() {
  const g = new THREE.Group();
  const rock = pbr('rock', { color: '#a49a8c', normal: 1.6 });
  for (let i = 0; i < 14; i++) { // скалы вокруг входа
    const a = Math.PI * (0.1 + 0.8 * i / 13), r = new THREE.Mesh(rockGeometry(i, 2 + Math.random() * 2), rock);
    r.position.set(Math.cos(a) * 6, Math.sin(a) * 5, 0); g.add(r);
  }
  const hill = new THREE.Mesh(rockGeometry(99, 14, 0.35), rock); hill.scale.y = 0.75; hill.position.z = -9; g.add(hill);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(5, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050505' }));
  hole.position.set(0, 0, 0.6); g.add(hole);
  return g;
}

export function createSerpent() {
  const g = new THREE.Group(), segs = [];
  const skin = pbr('rock', { color: '#6f8a5e', roughness: 0.6, normal: 2.5 }), belly = pbr('rock', { color: '#b8b080', roughness: 0.7 }); // каменная чешуя
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 - i * 0.04, 1), i % 3 ? skin : belly);
    g.add(s); segs.push(s);
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff5a1a' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), eyeM), e2 = e1.clone();
  e1.position.set(0.6, 0.5, 1.1); e2.position.set(-0.6, 0.5, 1.1); segs[0].add(e1, e2);
  g.traverse(o => o.castShadow = true);
  let awake = 0, t = 0;
  // Бой: змей бодрствует → замечает героя → поднимает голову и шипит (предупреждение) → бросок → отходит.
  // Если герой парировал — змей отшатывается и «оглушён». Убить его нельзя (нужен меч нартов — по сюжету).
  const st = { mode: 'coil', time: 0, cd: 2, from: new THREE.Vector3(), to: new THREE.Vector3(), struck: false };
  const local = new THREE.Vector3();
  return {
    object: g,
    wake() { awake = 1; },
    get awake() { return awake > 0; },
    headWorld() { return g.localToWorld(segs[0].position.clone()); },
    update(dt, player, onStrike, onTelegraph) {
      t += dt; st.time += dt;
      segs.forEach((s, i) => { // обычное покачивание кольцами
        const a = i * 0.45 + t * (awake ? 1.5 : 0.2);
        const rise = awake ? Math.max(0, 6 - i * 0.6) : 0;
        s.position.set(Math.cos(a) * (2 + i * 0.12), 1 + rise + Math.sin(t * 2 + i) * 0.1 * awake, Math.sin(a) * (2 + i * 0.12));
      });
      eyeM.color.setRGB(1, 0.35, 0.1).multiplyScalar(st.mode === 'warn' ? 3 + Math.sin(t * 30) : 1.2); // глаза разгораются перед броском
      if (!awake || !player) return;
      local.copy(player).add(new THREE.Vector3(0, 1.3, 0)); g.worldToLocal(local);
      const dist = Math.hypot(local.x, local.z);
      const head = segs[0].position;
      if (st.mode === 'coil') {
        st.cd -= dt;
        if (dist < 11 && st.cd <= 0) { st.mode = 'warn'; st.time = 0; onTelegraph && onTelegraph(); }
      } else if (st.mode === 'warn') { // 0.8 c — время среагировать
        head.y += Math.sin(Math.min(1, st.time / 0.8) * Math.PI / 2) * 1.5;
        if (st.time > 0.8) { st.mode = 'strike'; st.time = 0; st.from.copy(head); st.to.copy(local); st.struck = false; }
      } else if (st.mode === 'strike') { // бросок 0.25 с, затем возврат 0.45 с
        const k = st.time < 0.25 ? st.time / 0.25 : Math.max(0, 1 - (st.time - 0.25) / 0.45);
        const reachK = Math.min(1, 9 / Math.max(1, st.from.distanceTo(st.to)));
        head.lerpVectors(st.from, st.from.clone().lerp(st.to, reachK), k * k * (3 - 2 * k));
        for (let i = 1; i < 6; i++) segs[i].position.lerp(head, (6 - i) / 9 * k);
        if (!st.struck && st.time >= 0.22) {
          st.struck = true;
          const hw = g.localToWorld(head.clone());
          if (hw.distanceTo(player.clone().add(new THREE.Vector3(0, 1.2, 0))) < 2.6) {
            const r = onStrike(hw);
            if (r === 'parry') { st.mode = 'recoil'; st.time = 0; return; }
          }
        }
        if (st.time > 0.7) { st.mode = 'coil'; st.cd = 1.8 + Math.random() * 1.2; }
      } else if (st.mode === 'recoil') { // отшатнулся после парирования
        head.y += 1.5; head.x += Math.sin(t * 40) * 0.3 * (1 - st.time / 1.4);
        if (st.time > 1.4) { st.mode = 'coil'; st.cd = 1.5; }
      }
    },
  };
}

function stone() {
  const s = new THREE.Mesh(rockGeometry(7, 4, 0.25), pbr('rock', { color: '#b0a898', normal: 2 }));
  s.scale.set(1, 1.6, 0.8); s.position.y = 4; s.rotation.set(0.2, 0.5, 0.1);
  const g = new THREE.Group(); g.add(s); return g;
}
// Старая сторожевая башня: на верх ведёт деревянная лестница (E — залезть), наверху площадка с зубцами.
function tower() {
  const g = new THREE.Group(), m = pbr('masonry', { color: '#d6ccb8', repeat: 2 });
  const t = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 15, 4, 1), m); t.position.y = 7.5; t.rotation.y = Math.PI / 4;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 4.5), pbr('planks', { color: '#a08060' })); floor.position.y = 14.9; g.add(floor);
  for (let i = 0; i < 4; i++) for (let k = -2; k <= 2; k++) { // зубцы
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4), m), a = i * Math.PI / 2;
    c.position.set(Math.cos(a) * 2.25 + Math.sin(a) * k * 1.05, 15.5, Math.sin(a) * 2.25 - Math.cos(a) * k * 1.05); c.rotation.y = -a; if ((k + 2) % 2 === 0) g.add(c);
  }
  // лестница на стороне +Z
  const wood = pbr('bark', { color: '#b89a78' });
  for (const s of [-0.28, 0.28]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 15.6, 6), wood); r.position.set(s, 7.8, 2.85); g.add(r); }
  for (let y = 0.4; y < 15.4; y += 0.38) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), wood); r.rotation.z = Math.PI / 2; r.position.set(0, y, 2.85); g.add(r); }
  g.add(t); return g;
}
function spring() {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 10), new THREE.MeshStandardMaterial({ color: '#2a4a5a', roughness: 0.05, metalness: 0.3 })); w.position.y = 0.1;
  for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(rockGeometry(i + 20, 0.6), pbr('rock')); r.position.set(Math.cos(i * 0.63) * 2.8, 0.3, Math.sin(i * 0.63) * 2.8); g.add(r); }
  g.add(w); return g;
}

function mosque() { // мечеть с минаретом
  const g = new THREE.Group(), w = pbr('plaster', { repeat: 2 }), r = pbr('roof', { color: '#3f7a5a', metalness: 0.4, roughness: 0.5 });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), w); hall.position.y = 3;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), r); dome.position.y = 6;
  const min = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 18, 8), w); min.position.set(7, 9, -4);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), r); cap.position.set(7, 19.5, -4);
  const moon = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 4, 10, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: '#e8c872', metalness: 0.9, roughness: 0.3 })); moon.position.set(7, 21.6, -4);
  g.add(hall, dome, min, cap, moon); return g;
}
function shop() { // «Магазин у Братухи» — как на фото
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 6), pbr('masonry', { repeat: 2.5 })); body.position.y = 1.75;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 6.6), pbr('roof', { color: '#a8adb1', metalness: 0.35, roughness: 0.55 })); roof.position.y = 3.6; roof.rotation.x = 0.08;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d'); c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#333'; c.lineWidth = 6; c.strokeRect(3, 3, 250, 122);
  c.fillStyle = '#222'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('МАГАЗИН', 128, 44); c.fillText('У', 128, 82); c.fillText('БРАТУХИ', 128, 118);
  const signTex = new THREE.CanvasTexture(cv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(0, 2.6, 3.02);
  g.add(body, roof, sign); return g;
}
function pasture() { // пастбище: каменная ограда
  const g = new THREE.Group(), m = pbr('masonry', { color: '#c8bfae' });
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.8), m); r.position.set(Math.cos(a) * 14, 0.4, Math.sin(a) * 14); r.rotation.y = -a + Math.PI / 2; if (i % 13) g.add(r); }
  return g;
}

export async function createPlaces(scene, terrain) {
  const cfg = await (await fetch('data/places.json')).json();
  const out = {};
  const makers = { cave, stone, tower, spring, pasture, mosque, shop };
  for (const p of cfg.places) {
    const { x, z } = sectorPos(p.sector, p.dx, p.dz);
    const y = terrain.heightAt(x, z);
    const obj = (makers[p.type] || stone)();
    obj.position.set(x, y - 0.5, z);
    if (p.type === 'shop' || p.type === 'mosque') obj.lookAt(0, y - 0.5, 0); // фасадом к центру села
    if (p.type === 'cave') obj.lookAt(0, y, 0); // вход смотрит на село
    obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    scene.add(obj);
    out[p.id] = { ...p, pos: new THREE.Vector3(x, y, z), object: obj, colliders: [] };
    obj.updateMatrixWorld(true);
    // невидимые коллизии по типу места (в здания не войти)
    const W = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyMatrix4(obj.matrixWorld);
    const xAxis = new THREE.Vector3(1, 0, 0).transformDirection(obj.matrixWorld), C = out[p.id].colliders, ang = Math.atan2(xAxis.z, xAxis.x);
    const box = (lx, lz, w, d) => { const c = W(lx, lz); C.push({ type: 'box', cx: c.x, cz: c.z, ang, w, d, top: 1e9 }); };
    const circle = (lx, lz, r) => { const c = W(lx, lz); C.push({ type: 'circle', x: c.x, z: c.z, r, top: 1e9 }); };
    if (p.type === 'mosque') { box(0, 0, 12.3, 10.3); circle(7, -4, 1.2); }
    else if (p.type === 'shop') box(0, 0, 8.3, 6.3);
    else if (p.type === 'tower') { // стены башни сплошные; верх — площадка, на неё ведёт лестница
      const by = y - 0.5;
      C.push({ type: 'box', cx: x, cz: z, ang: 0, w: 5.2, d: 5.2, top: by + 14.3 });
      out[p.id].ladder = { x, z: z + 3.25, y0: terrain.heightAt(x, z + 3.25), y1: by + 15.05, topX: x, topZ: z + 1.2, yaw: Math.PI };
      out[p.id].platform = { x, z, r: 2.2, y: by + 15.05 };
    }
    else if (p.type === 'stone') circle(0, 0, 3.4);
    else if (p.type === 'cave') { circle(0, -9, 13.5); for (let i = 0; i < 14; i++) { const a = Math.PI * (0.1 + 0.8 * i / 13); if (Math.abs(Math.cos(a)) > 0.45) circle(Math.cos(a) * 6, 0, 2.2); } }
    else if (p.type === 'pasture') for (let i = 0; i < 40; i++) { if (i % 13) { const a = i / 40 * Math.PI * 2, c = W(Math.cos(a) * 14, Math.sin(a) * 14); C.push({ type: 'box', cx: c.x, cz: c.z, ang: a + Math.PI / 2 + ang, w: 2.3, d: 0.9, top: y + 0.9 }); } }
    if (p.type === 'cave') {
      const serpent = createSerpent();
      const front = new THREE.Vector3(0, 0, 8).applyQuaternion(obj.quaternion);
      serpent.object.position.set(x + front.x, terrain.heightAt(x + front.x, z + front.z), z + front.z);
      serpent.object.visible = false;
      scene.add(serpent.object);
      out[p.id].serpent = serpent;
    }
  }
  return out;
}
