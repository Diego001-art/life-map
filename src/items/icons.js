// Картинки предметов для рюкзака: модель предмета фотографируется один раз отдельной маленькой камерой.
import * as THREE from 'three';
import { makeMesh } from './models.js';

let renderer, scene, cam;
const cache = {};
export function iconFor(def) {
  if (!def) return '';
  const key = def.shape + def.color;
  if (cache[key]) return cache[key];
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(96, 96);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#554433', 1.4));
    const d = new THREE.DirectionalLight('#fff', 1.6); d.position.set(2, 3, 2); scene.add(d);
    cam = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  }
  const m = makeMesh(def.shape, def.color);
  m.rotation.set(0.35, 0.7, 0);
  scene.add(m);
  // подогнать камеру под размер предмета
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  cam.position.set(c.x, c.y + r * 0.3, c.z + r / Math.tan(17 * Math.PI / 180) * 1.05);
  cam.lookAt(c);
  renderer.render(scene, cam);
  scene.remove(m);
  return cache[key] = renderer.domElement.toDataURL();
}

// Портрет жителя для окна диалога: «фотографируем» голову модели.
const portraits = new WeakMap();
export function portraitFor(npcObject) {
  if (!npcObject) return '';
  if (portraits.has(npcObject)) return portraits.get(npcObject);
  iconFor({ shape: 'stone', color: '#000' }); // создаёт маленький рендерер, если его ещё нет
  const clone = npcObject.clone(true);
  clone.position.set(0, 0, 0); clone.rotation.set(0, -0.35, 0);
  clone.traverse(o => { if (o.userData && o.userData.marker) o.visible = false; }); // без «!» над головой
  scene.add(clone);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#2a2018' })); bg.position.set(0, 1.7, -1.2); scene.add(bg);
  const hy = 1.72 * clone.scale.y;
  cam.position.set(0.12, hy + 0.03, 0.62); cam.lookAt(0, hy - 0.01, 0);
  renderer.render(scene, cam);
  scene.remove(clone, bg);
  const url = renderer.domElement.toDataURL();
  portraits.set(npcObject, url);
  return url;
}
