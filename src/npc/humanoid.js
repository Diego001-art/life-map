// Человек: реалистичные пропорции (голова ≈ 1/7 роста), суставы (плечо, локоть, бедро, колено),
// лицо (глаза, веки — моргает, брови, нос, уши, рот, борода/усы), одежда отдельными слоями.
// Одежда всегда чуть больше тела и крепится к той же кости, что и часть тела — поэтому не проходит сквозь тело.
// Используется и для героя, и для всех жителей.
import * as THREE from 'three';
import { tex } from '../world/textures.js';

const matCache = {};
function M(kind, color, extra = {}) {
  const key = kind + color + JSON.stringify(extra);
  if (matCache[key]) return matCache[key];
  let m;
  if (kind === 'skin') m = new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
  else if (kind === 'cloth') { const t = tex('cloth'); m = new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.92 }); }
  else if (kind === 'wool') { const t = tex('wool', 3); m = new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 }); }
  else if (kind === 'leather') m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
  else if (kind === 'metal') m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.9 });
  else m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  return matCache[key] = m;
}
const capsule = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, len, 4, seg);
// люди отбрасывают тень, но сами её не принимают — иначе на мелких деталях появляются полосы (shadow acne)
const mesh = (g, m, shadow = true) => { const x = new THREE.Mesh(g, m); x.castShadow = shadow; x.receiveShadow = false; return x; };

// Сустав с костью: pivot вращается, кость висит вниз от него.
function bone(len, r, material, rEnd = r) {
  const pivot = new THREE.Group();
  const g = new THREE.CylinderGeometry(r, rEnd, len, 10, 1); g.translate(0, -len / 2, 0); // у сустава толще
  const m = mesh(g, material); pivot.add(m);
  const cap = mesh(new THREE.SphereGeometry(r, 10, 8), material); pivot.add(cap); // круглый сустав
  pivot.userData.mesh = m; pivot.userData.cap = cap;
  return pivot;
}

// Профиль туловища (талия → грудь → плечи) для LatheGeometry.
function torsoGeo(scale = 1) {
  const pts = [[0.001, 0], [0.135, 0.0], [0.14, 0.08], [0.15, 0.2], [0.165, 0.32], [0.17, 0.42], [0.155, 0.5], [0.09, 0.56], [0.001, 0.57]]
    .map(([r, y]) => new THREE.Vector2(r * scale, y));
  const g = new THREE.LatheGeometry(pts, 16); g.scale(1.15, 1, 0.72); return g;
}
// Юбка/полы одежды: конус от талии вниз; gap — разрез спереди (радианы).
function skirtGeo(top, bottom, len, gap = 0) {
  const g = new THREE.CylinderGeometry(top, bottom, len, 18, 3, true, gap / 2, Math.PI * 2 - gap); // угол 0 — это перёд
  g.translate(0, -len / 2, 0); g.scale(1, 1, 0.8); return g;
}

export function createHumanoid(o = {}) {
  const opt = {
    skin: '#d6a882', shirt: '#d9d2c2', pants: '#2e2a26', coat: null, coatLen: 0.62, female: false,
    hat: 'papakha', hatColor: '#efece6', beard: 'none', beardColor: '#2a1d14', hair: '#2a1d14', boots: '#1f1b18',
    height: 1, width: 1, ...o,
  };
  const skin = M('skin', opt.skin), shirt = M('cloth', opt.shirt), pants = M('cloth', opt.pants);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  root.scale.set(opt.width, opt.height, opt.width);
  const details = []; // мелкие детали лица — прячутся вдали (LOD)

  // таз и туловище
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  hips.add(mesh(new THREE.SphereGeometry(0.15, 12, 8).scale(1.15, 0.7, 0.8), pants));
  const chest = new THREE.Group(); chest.position.y = 0.04; hips.add(chest);
  const torso = mesh(torsoGeo(), shirt); chest.add(torso);
  // шея и голова
  const neck = mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.1, 10), skin); neck.position.y = 0.58; chest.add(neck);
  const head = new THREE.Group(); head.position.y = 0.62; chest.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.105, 18, 14), skin); skull.scale.set(0.92, 1.16, 1.02); skull.position.y = 0.1; head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.08, 14, 10), skin); jaw.scale.set(0.95, 0.75, 0.95); jaw.position.set(0, 0.035, 0.022); head.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(0.017, 0.045, 8), skin); nose.rotation.x = Math.PI / 2 + 0.25; nose.position.set(0, 0.09, 0.112); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.022, 8, 6), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(0.098 * s, 0.1, 0); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.014, 10, 8), M('', '#eeeae2', { roughness: 0.3 }), false); eye.position.set(0.036 * s, 0.112, 0.092); head.add(eye);
    const iris = mesh(new THREE.SphereGeometry(0.008, 8, 6), M('', ['#3a2a1a', '#2a3a2a', '#3a3020'][Math.floor(Math.random() * 3)], { roughness: 0.2 }), false); iris.position.set(0.036 * s, 0.112, 0.104); head.add(iris);
    const lid = mesh(new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), skin, false); lid.position.set(0.036 * s, 0.112, 0.092); lid.rotation.x = -0.4; lid.scale.y = 0.35; head.add(lid);
    const brow = mesh(new THREE.BoxGeometry(0.036, 0.008, 0.012), M('', opt.beard !== 'none' ? opt.beardColor : opt.hair), false); brow.position.set(0.037 * s, 0.137, 0.1); brow.rotation.z = -0.12 * s; head.add(brow);
    details.push(eye, iris, lid, brow);
    (head.userData.lids = head.userData.lids || []).push(lid);
  }
  const mouth = mesh(new THREE.BoxGeometry(0.035, 0.006, 0.01), M('', '#7a3a32'), false); mouth.position.set(0, 0.052, 0.1); head.add(mouth); details.push(mouth);
  // волосы под шапкой
  const hair = mesh(new THREE.SphereGeometry(0.108, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M('', opt.hair, { roughness: 0.95 })); hair.scale.set(0.95, 1.12, 1.06); hair.position.set(0, 0.11, -0.006); head.add(hair);
  // борода / усы
  const bm = M('wool', opt.beardColor);
  if (opt.beard === 'full' || opt.beard === 'short') {
    const b = mesh(new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), bm);
    b.scale.set(1, opt.beard === 'full' ? 1.3 : 0.8, 1.05); b.position.set(0, 0.06, 0.018); head.add(b);
  }
  if (opt.beard !== 'none') { const m = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), bm, false); m.position.set(0, 0.066, 0.105); head.add(m); details.push(m); }

  // руки: плечо → локоть → кисть
  const sleeve = opt.coat ? M('cloth', opt.coat) : shirt;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = bone(0.29, 0.052, sleeve, 0.045); sh.position.set(0.19 * s, 0.5, 0); sh.rotation.z = 0.06 * s; chest.add(sh);
    const el = bone(0.26, 0.044, sleeve, 0.036); el.position.y = -0.29; sh.add(el);
    const hand = mesh(capsule(0.035, 0.05, 6), skin); hand.scale.set(1, 1, 0.55); hand.position.y = -0.3; el.add(hand);
    arms.push({ sh, el, hand });
  }
  // ноги: бедро → колено → стопа; сапоги чуть шире голени (не проникают в ногу)
  const legs = [];
  for (const s of [-1, 1]) {
    const th = bone(0.44, 0.075, pants, 0.058); th.position.set(0.09 * s, 0, 0); hips.add(th);
    const kn = bone(0.42, 0.056, pants, 0.045); kn.position.y = -0.44; th.add(kn);
    const boot = mesh(new THREE.CylinderGeometry(0.064, 0.056, 0.32, 10, 1, true), M('leather', opt.boots)); boot.position.y = -0.26; kn.add(boot);
    const foot = mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), M('leather', opt.boots)); foot.position.set(0, -0.43, 0.04); kn.add(foot);
    legs.push({ th, kn });
  }
  // верхняя одежда
  if (opt.coat && !opt.female) { // черкеска: отдельный слой поверх рубахи, полы с разрезом спереди
    const cm = M('cloth', opt.coat);
    const shell = mesh(torsoGeo(1.07), cm); shell.position.y = -0.01; chest.add(shell);
    const skirt = mesh(skirtGeo(0.17, 0.27, opt.coatLen, 0.9), cm); skirt.position.y = 0.04; hips.add(skirt);
    // газыри на груди
    const gz = M('', '#d9cba6', { roughness: 0.5 });
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const c = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 6), gz, false); c.position.set(0.1 * s, 0.42 - i * 0.032, 0.125 - Math.abs(s) * 0.004); chest.add(c); details.push(c); }
    const belt = mesh(new THREE.TorusGeometry(0.162, 0.016, 6, 24), M('leather', '#2a1d14')); belt.rotation.x = Math.PI / 2; belt.scale.set(1.15, 0.75, 1); belt.position.y = 0.06; chest.add(belt);
    const buckle = mesh(new THREE.BoxGeometry(0.045, 0.035, 0.012), M('metal', '#c9b27a'), false); buckle.position.set(0, 0.06, 0.125); chest.add(buckle);
  }
  if (opt.female) { // длинное платье, платок
    const dm = M('cloth', opt.coat || opt.shirt);
    const dress = mesh(skirtGeo(0.17, 0.36, 0.92), dm); dress.position.y = 0.06; hips.add(dress);
    const hem = mesh(new THREE.CylinderGeometry(0.362, 0.365, 0.05, 18, 1, true), M('cloth', '#b8923a')); hem.scale.z = 0.8; hem.position.y = -0.84; hips.add(hem);
    legs.forEach(l => { l.th.visible = true; });
  }
  // головной убор
  const hatHolder = new THREE.Group(); hatHolder.position.y = 0.19; head.add(hatHolder);
  if (opt.hat === 'scarf') {
    const sc = M('cloth', opt.hatColor);
    const shell = mesh(new THREE.SphereGeometry(0.122, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), sc); shell.scale.set(0.98, 1.15, 1.08); shell.position.set(0, 0.1, -0.012); head.add(shell);
    const tail = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.3, 14, 1, true, Math.PI * 0.25, Math.PI * 1.5), sc); tail.position.set(0, -0.03, -0.01); head.add(tail);
    hair.visible = false;
  } else if (opt.hat === 'papakha') hatHolder.add(papakha(opt.hatColor));

  root.traverse(x => { if (x.isMesh) x.userData.baseScale = x.scale.clone(); });
  root.userData = { body, hips, chest, head, arms, legs, details, hatHolder, phase: Math.random() * 10, blinkAt: 2 + Math.random() * 4, female: opt.female };
  return root;
}

// Папаха из овчины.
export function papakha(color = '#efece6') {
  const g = new THREE.Group(), m = M('wool', color);
  const p = mesh(new THREE.CylinderGeometry(0.135, 0.125, 0.15, 18), m); p.position.y = 0.0; g.add(p);
  const top = mesh(new THREE.SphereGeometry(0.135, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), m); top.position.y = 0.035; g.add(top);
  return g;
}

// Анимация: стоит (дышит, оглядывается, моргает), идёт/бежит (колени и локти сгибаются), разговаривает (жесты).
export function animateHumanoid(h, t, { walk = 0, talk = 0, look = true, dt = 0.016, phase } = {}) {
  const u = h.userData, ph = phase ?? t * (walk > 1.1 ? 1.45 : 1) * 5.6 + u.phase;
  const s = Math.sin(ph), c = Math.cos(ph), w = Math.min(walk, 1.5);
  // ноги
  u.legs[0].th.rotation.x = s * 0.55 * w; u.legs[1].th.rotation.x = -s * 0.55 * w;
  u.legs[0].kn.rotation.x = Math.max(0, -c) * 0.9 * w + 0.02; u.legs[1].kn.rotation.x = Math.max(0, c) * 0.9 * w + 0.02;
  // руки
  u.arms[0].sh.rotation.x = -s * 0.45 * w; u.arms[1].sh.rotation.x = s * 0.45 * w;
  u.arms[0].el.rotation.x = -(0.15 + Math.max(0, s) * 0.5 * w); u.arms[1].el.rotation.x = -(0.15 + Math.max(0, -s) * 0.5 * w);
  // корпус
  u.body.position.y = Math.abs(c) * 0.045 * w + Math.sin(t * 1.7 + u.phase) * 0.006 * (1 - Math.min(1, w)); // шаги / дыхание
  u.chest.rotation.y = s * 0.06 * w;
  u.chest.scale.setScalar(1 + Math.sin(t * 1.7 + u.phase) * 0.008);                                         // грудь «дышит»
  u.body.rotation.x = walk > 1.1 ? 0.15 : 0;
  if (w < 0.1) {
    u.head.rotation.y = look ? Math.sin(t * 0.37 + u.phase) * 0.45 * (Math.sin(t * 0.11 + u.phase) > 0 ? 1 : 0.15) : 0;
    u.head.rotation.x = Math.sin(t * 0.6 + u.phase) * 0.04;
    u.arms[0].sh.rotation.z = -0.06 + Math.sin(t * 0.9 + u.phase) * 0.02;
    if (talk) { u.arms[1].sh.rotation.x = -0.5 - Math.sin(t * 2.6) * 0.25; u.arms[1].el.rotation.x = -0.9 - Math.sin(t * 3.1) * 0.2; u.head.rotation.x = Math.sin(t * 4) * 0.05; }
  } else u.head.rotation.y *= 0.9;
  // моргание
  u.blinkAt -= dt;
  const closed = u.blinkAt < 0.12 && u.blinkAt > 0;
  for (const lid of u.head.userData.lids) lid.scale.y = closed ? 1.05 : 0.35;
  if (u.blinkAt < 0) u.blinkAt = 2 + Math.random() * 4;
}

// LOD: вдали мелкие детали лица не рисуются.
export function setHumanoidDetail(h, near) {
  if (h.userData.detailNear === near) return;
  h.userData.detailNear = near;
  for (const d of h.userData.details) d.visible = near;
}
