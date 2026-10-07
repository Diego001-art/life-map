// Особые места из data/places.json: пещера со змеем, камень нарта, башня, родник.
import * as THREE from 'three';
import { sectorPos } from './sectors.js';

const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

function cave() {
  const g = new THREE.Group();
  const rock = mat('#6e665c');
  for (let i = 0; i < 14; i++) { // скалы вокруг входа
    const a = Math.PI * (0.1 + 0.8 * i / 13), r = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random() * 2), rock);
    r.position.set(Math.cos(a) * 6, Math.sin(a) * 5, 0); g.add(r);
  }
  const hill = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), rock); hill.position.z = -9; g.add(hill);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(5, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050505' }));
  hole.position.set(0, 0, 0.6); g.add(hole);
  return g;
}

export function createSerpent() {
  const g = new THREE.Group(), segs = [];
  const skin = mat('#3d5a3a'), belly = mat('#8a9a5a');
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 - i * 0.04), i % 3 ? skin : belly);
    g.add(s); segs.push(s);
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff5a1a' });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), eyeM), e2 = e1.clone();
  e1.position.set(0.6, 0.5, 1.1); e2.position.set(-0.6, 0.5, 1.1); segs[0].add(e1, e2);
  g.traverse(o => o.castShadow = true);
  let awake = 0, t = 0;
  return {
    object: g,
    wake() { awake = 1; },
    update(dt) {
      t += dt;
      segs.forEach((s, i) => {
        const a = i * 0.45 + t * (awake ? 1.5 : 0.2);
        const rise = awake ? Math.max(0, 6 - i * 0.6) : 0;
        s.position.set(Math.cos(a) * (2 + i * 0.12), 1 + rise + Math.sin(t * 2 + i) * 0.1 * awake, Math.sin(a) * (2 + i * 0.12));
      });
    },
  };
}

function stone() {
  const s = new THREE.Mesh(new THREE.DodecahedronGeometry(4, 0), mat('#7f7a70'));
  s.scale.set(1, 1.6, 0.8); s.position.y = 4; s.rotation.set(0.2, 0.5, 0.1);
  const g = new THREE.Group(); g.add(s); return g;
}
function tower() {
  const g = new THREE.Group(), m = mat('#9d8f78');
  const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 16, 4), m); t.position.y = 7; t.rotation.y = Math.PI / 4;
  const top = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3, 4), mat('#5c5048')); top.position.y = 16.5; top.rotation.y = Math.PI / 4;
  g.add(t, top); return g;
}
function spring() {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 10), new THREE.MeshLambertMaterial({ color: '#4a8ac0' })); w.position.y = 0.1;
  for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mat('#8d877c')); r.position.set(Math.cos(i * 0.63) * 2.8, 0.3, Math.sin(i * 0.63) * 2.8); g.add(r); }
  g.add(w); return g;
}

function mosque() { // мечеть с минаретом
  const g = new THREE.Group(), w = mat('#e9e2d2'), r = mat('#3f7a5a');
  const hall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), w); hall.position.y = 3;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), r); dome.position.y = 6;
  const min = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 18, 8), w); min.position.set(7, 9, -4);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), r); cap.position.set(7, 19.5, -4);
  const moon = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 4, 10, Math.PI * 1.4), mat('#e8c872')); moon.position.set(7, 21.6, -4);
  g.add(hall, dome, min, cap, moon); return g;
}
function shop() { // «Магазин у Братухи» — как на фото
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load('assets/tex/wall.jpg'); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 6), new THREE.MeshLambertMaterial({ map: tex })); body.position.y = 1.75;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 6.6), mat('#a8adb1')); roof.position.y = 3.6; roof.rotation.x = 0.08;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d'); c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#333'; c.lineWidth = 6; c.strokeRect(3, 3, 250, 122);
  c.fillStyle = '#222'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('МАГАЗИН', 128, 44); c.fillText('У', 128, 82); c.fillText('БРАТУХИ', 128, 118);
  const signTex = new THREE.CanvasTexture(cv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(0, 2.6, 3.02);
  g.add(body, roof, sign); return g;
}
function pasture() { // пастбище: каменная ограда
  const g = new THREE.Group(), m = mat('#8a8274');
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.8), m); r.position.set(Math.cos(a) * 14, 0.4, Math.sin(a) * 14); r.rotation.y = -a; if (i % 13) g.add(r); }
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
    obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    scene.add(obj);
    out[p.id] = { ...p, pos: new THREE.Vector3(x, y, z), object: obj };
    if (p.type === 'cave') {
      obj.lookAt(0, y, 0); // вход смотрит на село
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
