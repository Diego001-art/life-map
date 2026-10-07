// Модель героя по главному референсу (IMAGE 1): суровый горец — чёрная меховая папаха, чёрная черкеска (чоха) с газырями,
// тёмный бешмет со стойкой, широкий кожаный пояс с серебряной пряжкой, кинжал в ножнах, кожаные наручи и перчатки,
// высокие сапоги, перевязь через плечо, густая борода.
//
// Скелет — настоящие кости THREE.Bone с именами как в ТЗ (Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, LeftArm,
// LeftForeArm, LeftHand, ..., LeftUpLeg, LeftLeg, LeftFoot). Анимации (clips.js) двигают именно эти кости через AnimationMixer,
// поэтому их можно применить и к настоящей GLB-модели с такими же именами костей.
// Каждая часть тела и одежды — отдельный меш со своим материалом (skin, hair, beard, fur, cloth, leather, metal, weapon),
// прикреплён к своей кости (сегментный риг): одежда двигается вместе с телом и не проходит сквозь него.
// Персонаж смотрит вдоль +Z, его правая сторона — это −X.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { tex } from '../world/textures.js';

// --- материалы ---
const cache = {};
export function material(kind, color) {
  const key = kind + color;
  if (cache[key]) return cache[key];
  let m;
  const T = (n, r = 1) => tex(n, r);
  switch (kind) {
    case 'skin': m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 }); break;
    case 'hair': m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: T('wool', 4).map, normalMap: T('wool', 4).normalMap }); break;
    case 'fur': m = new THREE.MeshStandardMaterial({ color, roughness: 1, map: T('wool', 2).map, normalMap: T('wool', 2).normalMap, normalScale: new THREE.Vector2(2.2, 2.2) }); break;
    case 'cloth': m = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0, map: T('cloth', 3).map, normalMap: T('cloth', 3).normalMap, normalScale: new THREE.Vector2(0.6, 0.6) }); break;
    case 'leather': m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, normalMap: T('rock', 4).normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }); break;
    case 'metal': m = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.95 }); break;
    case 'dark_metal': m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.85 }); break;
    case 'wood': m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, map: T('planks', 2).map }); break;
    case 'cloth2': m = new THREE.MeshStandardMaterial({ color, roughness: 0.93, side: THREE.DoubleSide, map: T('cloth', 3).map, normalMap: T('cloth', 3).normalMap, normalScale: new THREE.Vector2(0.6, 0.6) }); break; // полы видны с обеих сторон
    default: m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  }
  m.name = kind;
  return cache[key] = m;
}

const mesh = (g, m, shadow = true) => { const x = new THREE.Mesh(g, m); x.castShadow = shadow; x.receiveShadow = false; return x; };
function bone(name, x, y, z, parent) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; }
function lathe(profile, seg = 18, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLen);
  g.scale(1.12, 1, 0.74); return g;
}
// «Помятая» сфера: для бороды и меховой папахи (кудри).
function lumpy(r, detail, amp, seed = 1) {
  let g = new THREE.IcosahedronGeometry(r, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, uv = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 61 + seed) * Math.sin(y * 57 + seed * 2) * Math.sin(z * 53 + seed * 3);
    const k = 1 + n * amp; p.setXYZ(i, x * k, y * k, z * k);
    uv.push(Math.atan2(z, x) / Math.PI + 1, y / r + 1);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

// Папаха из курчавой овчины (как на референсе).
export function papakha(color = '#1b1714') {
  const g = new THREE.Group(), fur = material('fur', color);
  const body = mesh(lumpy(1, 3, 0.08, 3), fur); body.scale.set(0.145, 0.105, 0.15); body.position.y = 0.075; g.add(body);
  const top = mesh(new THREE.CylinderGeometry(0.128, 0.14, 0.04, 20), fur); top.position.y = 0.16; g.add(top);
  return g;
}

// Кинжал (кама) и шашка — отдельные объекты, крепятся к сокетам.
export function dagger() {
  const g = new THREE.Group(), steel = material('metal', '#c9c6be'), wood = material('leather', '#2a1d14'), silver = material('metal', '#d8cfb8');
  const blade = mesh(new THREE.BoxGeometry(0.038, 0.36, 0.008), steel); blade.position.y = 0.2; g.add(blade);
  const tip = mesh(new THREE.ConeGeometry(0.019, 0.07, 4), steel); tip.scale.z = 0.25; tip.position.y = 0.415; g.add(tip);
  const grip = mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.11, 8), wood); grip.position.y = -0.03; g.add(grip);
  const guard = mesh(new THREE.BoxGeometry(0.06, 0.016, 0.024), silver); guard.position.y = 0.025; g.add(guard);
  const pommel = mesh(new THREE.SphereGeometry(0.022, 10, 8), silver); pommel.scale.y = 0.6; pommel.position.y = -0.09; g.add(pommel);
  g.userData.length = 0.45; return g;
}
export function daggerSheath() {
  const g = new THREE.Group();
  const s = mesh(new THREE.BoxGeometry(0.05, 0.34, 0.02), material('leather', '#1e1510')); s.position.y = 0.17; g.add(s);
  for (const y of [0.02, 0.33]) { const c = mesh(new THREE.BoxGeometry(0.056, 0.035, 0.026), material('metal', '#cfc4a8')); c.position.y = y; g.add(c); }
  return g;
}
export function saber() {
  const g = new THREE.Group(), steel = material('metal', '#cfccc4');
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(0.03, 0.45, -0.02, 0.86); shape.lineTo(-0.035, 0.84); shape.quadraticCurveTo(0.0, 0.45, -0.03, 0); shape.lineTo(0, 0);
  const b = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }); b.translate(0.015, 0.06, -0.003);
  g.add(mesh(b, steel));
  const grip = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.14, 8), material('leather', '#3a2618')); grip.position.y = -0.02; grip.rotation.z = 0.15; g.add(grip);
  const head = mesh(new THREE.SphereGeometry(0.026, 10, 8), material('metal', '#d8cfb8')); head.scale.set(1.3, 0.7, 0.8); head.position.set(-0.012, -0.095, 0); g.add(head);
  g.userData.length = 0.95; return g;
}

/**
 * Собрать героя. opts: { coat, beshmet, papakha (цвет или null), boots, belt, beard, skin }
 * Возвращает { root, bones, sockets, setExpression(name), clothFollow() }.
 */
export function createCharacter(o = {}) {
  const C = { skin: '#c8956e', coat: '#24211f', beshmet: '#171513', pants: '#1e1c1a', boots: '#241a14', belt: '#4f3220', bracer: '#2e2018', glove: '#1e1712', beard: '#1d1612', hair: '#1d1612', papakha: '#1b1714', ...o };
  const root = new THREE.Group(); root.name = 'Root';
  const B = {};
  B.Hips = bone('Hips', 0, 0.97, 0); root.add(B.Hips);
  B.Spine = bone('Spine', 0, 0.06, 0, B.Hips);
  B.Spine1 = bone('Spine1', 0, 0.17, 0, B.Spine);
  B.Spine2 = bone('Spine2', 0, 0.17, 0, B.Spine1);
  B.Neck = bone('Neck', 0, 0.2, 0, B.Spine2);
  B.Head = bone('Head', 0, 0.08, 0, B.Neck);
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    B[side + 'Shoulder'] = bone(side + 'Shoulder', 0.07 * s, 0.14, 0, B.Spine2);
    B[side + 'Arm'] = bone(side + 'Arm', 0.125 * s, 0, 0, B[side + 'Shoulder']);
    B[side + 'ForeArm'] = bone(side + 'ForeArm', 0, -0.29, 0, B[side + 'Arm']);
    B[side + 'Hand'] = bone(side + 'Hand', 0, -0.26, 0, B[side + 'ForeArm']);
    B[side + 'UpLeg'] = bone(side + 'UpLeg', 0.095 * s, -0.03, 0, B.Hips);
    B[side + 'Leg'] = bone(side + 'Leg', 0, -0.45, 0, B[side + 'UpLeg']);
    B[side + 'Foot'] = bone(side + 'Foot', 0, -0.43, 0, B[side + 'Leg']);
  }
  const M = {
    skin: material('skin', C.skin), coat: material('cloth', C.coat), beshmet: material('cloth', C.beshmet), pants: material('cloth', C.pants),
    boots: material('leather', C.boots), belt: material('leather', C.belt), bracer: material('leather', C.bracer), glove: material('leather', C.glove),
    beard: material('hair', C.beard), hair: material('hair', C.hair), silver: material('metal', '#c9c2b0'), dark: material('dark_metal', '#3a3530'),
  };
  const face = {};

  // --- таз и туловище ---
  B.Hips.add(mesh(new THREE.SphereGeometry(0.16, 16, 10).scale(1.1, 0.62, 0.78), M.pants));
  const abd = mesh(lathe([[0.001, 0], [0.142, 0], [0.145, 0.12], [0.152, 0.3], [0.001, 0.3]]), M.beshmet); B.Spine.add(abd);
  const chest = mesh(lathe([[0.001, -0.14], [0.152, -0.14], [0.168, 0.0], [0.172, 0.1], [0.158, 0.18], [0.1, 0.235], [0.001, 0.24]]), M.beshmet); B.Spine2.add(chest);
  const collar = mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.07, 14, 1, true), M.beshmet); collar.position.y = 0.25; B.Spine2.add(collar); // стойка бешмета
  // черкеска (чоха): верх с V-вырезом, низ, длинные полы с разрезом спереди
  const hasCoat = !!o.coat || o.coat === undefined;
  if (!hasCoat) M.coat = M.beshmet; // без черкески рукава — от бешмета
  const coatChest = mesh(lathe([[0.16, -0.15], [0.18, 0.0], [0.184, 0.1], [0.17, 0.18], [0.11, 0.235]], 20, 0.42, Math.PI * 2 - 0.84), M.coat);
  if (hasCoat) B.Spine2.add(coatChest);
  const coatAbd = mesh(lathe([[0.154, -0.01], [0.157, 0.12], [0.163, 0.31]], 20, 0.3, Math.PI * 2 - 0.6), M.coat); if (hasCoat) B.Spine.add(coatAbd);
  // полы: две половины, каждая слегка следует за своей ногой (не проходит сквозь ноги при ходьбе)
  const skirts = [];
  for (const s of hasCoat ? [1, -1] : []) {
    const half = new THREE.Group(); half.position.y = 0.0; B.Hips.add(half);
    const start = s > 0 ? 0.42 : Math.PI, len = Math.PI - 0.42;
    const g = new THREE.CylinderGeometry(0.17, 0.33, 0.8, 14, 4, true, start, len); g.translate(0, -0.4, 0); g.scale(1, 1, 0.78);
    const p = mesh(g, material('cloth2', C.coat)); half.add(p);
    skirts.push({ half, leg: s > 0 ? B.LeftUpLeg : B.RightUpLeg });
  }
  // газыри: по 6 на каждой стороне груди, тёмные гнёзда и серебряные головки
  const gz = new THREE.Group(); B.Spine2.add(gz);
  for (const s of hasCoat ? [1, -1] : []) {
    const pocket = mesh(new THREE.BoxGeometry(0.11, 0.1, 0.012), M.coat); pocket.position.set(0.085 * s, 0.03, 0.142); pocket.rotation.y = 0.32 * s; gz.add(pocket);
    for (let i = 0; i < 6; i++) {
      const x = (0.04 + i * 0.016) * s, z = 0.148 - i * 0.004;
      const tube = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.075, 6), M.dark, false); tube.position.set(x, 0.07, z); gz.add(tube);
      const cap = mesh(new THREE.SphereGeometry(0.009, 8, 6), M.silver, false); cap.position.set(x, 0.11, z); gz.add(cap);
    }
  }
  // широкий кожаный пояс с пряжкой и подвесками
  const belt = mesh(new THREE.CylinderGeometry(0.163, 0.163, 0.06, 22, 1, true), M.belt); belt.scale.z = 0.76; belt.position.y = 0.04; B.Spine.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.012), M.silver); buckle.position.set(0, 0.04, 0.126); B.Spine.add(buckle);
  for (const x of [-0.09, 0.1]) { const pend = mesh(new THREE.BoxGeometry(0.014, 0.07, 0.008), M.silver, false); pend.position.set(x, -0.01, 0.12); B.Spine.add(pend); }
  // перевязь через плечо (на спине — ремень для шашки)
  const strap = mesh(new THREE.BoxGeometry(0.035, 0.62, 0.012), M.belt); strap.position.set(0, -0.08, -0.135); strap.rotation.z = 0.62; B.Spine2.add(strap);
  const strapF = mesh(new THREE.BoxGeometry(0.035, 0.3, 0.012), M.belt); strapF.position.set(-0.09, 0.08, 0.152); strapF.rotation.z = -0.5; B.Spine2.add(strapF);

  // --- голова ---
  const neck = mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.12, 12), M.skin); neck.position.y = 0.03; B.Neck.add(neck);
  const H = B.Head;
  const skull = mesh(new THREE.SphereGeometry(0.104, 22, 16), M.skin); skull.scale.set(0.92, 1.12, 1.02); skull.position.y = 0.1; H.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.082, 16, 10), M.skin); jaw.scale.set(0.98, 0.72, 0.95); jaw.position.set(0, 0.035, 0.02); H.add(jaw);
  for (const s of [1, -1]) { const cheek = mesh(new THREE.SphereGeometry(0.03, 10, 8), M.skin); cheek.position.set(0.052 * s, 0.078, 0.07); H.add(cheek); }
  const nose = mesh(new THREE.ConeGeometry(0.019, 0.05, 8), M.skin); nose.rotation.x = Math.PI / 2 + 0.3; nose.position.set(0, 0.088, 0.112); H.add(nose);
  const bridge = mesh(new THREE.BoxGeometry(0.018, 0.04, 0.02), M.skin); bridge.position.set(0, 0.115, 0.1); H.add(bridge);
  face.brows = []; face.lids = [];
  for (const s of [1, -1]) {
    const ear = mesh(new THREE.SphereGeometry(0.022, 8, 6), M.skin); ear.scale.set(0.45, 1, 0.8); ear.position.set(0.097 * s, 0.098, -0.004); H.add(ear);
    const sock = mesh(new THREE.SphereGeometry(0.019, 10, 8), material('skin', '#a8754f'), false); sock.scale.set(1.1, 0.8, 0.6); sock.position.set(0.034 * s, 0.112, 0.088); H.add(sock); // мягкая тень глазницы
    const eye = mesh(new THREE.SphereGeometry(0.0105, 10, 8), material('', '#d8d0c2'), false); eye.scale.set(1.2, 0.75, 1); eye.position.set(0.034 * s, 0.111, 0.095); H.add(eye);
    const iris = mesh(new THREE.SphereGeometry(0.0065, 8, 6), material('', '#22170e'), false); iris.position.set(0.034 * s, 0.111, 0.103); H.add(iris);
    const lid = mesh(new THREE.SphereGeometry(0.0145, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.skin, false); lid.position.set(0.035 * s, 0.11, 0.094); lid.rotation.x = -0.35; lid.scale.y = 0.4; H.add(lid); face.lids.push(lid);
    const brow = mesh(new THREE.BoxGeometry(0.042, 0.011, 0.016), M.beard, false); brow.position.set(0.037 * s, 0.135, 0.103); brow.rotation.z = -0.1 * s; H.add(brow); face.brows.push({ m: brow, s });
  }
  face.mouth = mesh(new THREE.BoxGeometry(0.034, 0.006, 0.01), material('', '#5a2a24'), false); face.mouth.position.set(0, 0.055, 0.103); H.add(face.mouth);
  // густая борода и усы
  const beard = mesh(lumpy(1, 3, 0.07, 7), M.beard); beard.scale.set(0.088, 0.085, 0.07); beard.position.set(0, 0.025, 0.04); H.add(beard);
  const moust = mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), M.beard, false); moust.rotation.z = Math.PI; moust.position.set(0, 0.066, 0.1); H.add(moust);
  const hair = mesh(new THREE.SphereGeometry(0.108, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair); hair.scale.set(0.95, 1.1, 1.06); hair.position.set(0, 0.1, -0.008); H.add(hair);
  const hatSocket = new THREE.Group(); hatSocket.name = 'HeadSocket'; hatSocket.position.y = 0.17; H.add(hatSocket);
  if (C.papakha) hatSocket.add(papakha(C.papakha));

  // --- руки: рукав черкески, кожаный наруч, перчатка, пальцы ---
  const fingers = {};
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const up = mesh(new THREE.CapsuleGeometry(0.054, 0.22, 4, 10), M.coat); up.position.y = -0.14; B[side + 'Arm'].add(up);
    const shoulderPad = mesh(new THREE.SphereGeometry(0.062, 12, 8), M.coat); shoulderPad.scale.set(1, 0.8, 0.9); B[side + 'Arm'].add(shoulderPad);
    const fore = mesh(new THREE.CapsuleGeometry(0.046, 0.2, 4, 10), M.coat); fore.position.y = -0.11; B[side + 'ForeArm'].add(fore);
    const cuff = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 12, 1, true), M.coat); cuff.position.y = -0.06; B[side + 'ForeArm'].add(cuff);
    const bracer = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.13, 12), M.bracer); bracer.position.y = -0.18; B[side + 'ForeArm'].add(bracer);
    for (const y of [-0.13, -0.23]) { const lace = mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 14), M.silver, false); lace.rotation.x = Math.PI / 2; lace.position.y = y; B[side + 'ForeArm'].add(lace); }
    const palm = mesh(new THREE.BoxGeometry(0.075, 0.085, 0.035), M.glove); palm.position.y = -0.045; B[side + 'Hand'].add(palm);
    const fg = new THREE.Group(); fg.position.y = -0.09; B[side + 'Hand'].add(fg); fingers[side] = fg;
    for (let i = 0; i < 4; i++) { // пальцы в беспалой перчатке: кончики — кожа
      const f = mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 3, 6), M.glove, false); f.position.set((-0.026 + i * 0.0175) * s, -0.022, 0.004); fg.add(f);
      const tip = mesh(new THREE.SphereGeometry(0.0095, 6, 5), M.skin, false); tip.position.set((-0.026 + i * 0.0175) * s, -0.045, 0.004); fg.add(tip);
    }
    const thumb = mesh(new THREE.CapsuleGeometry(0.01, 0.035, 3, 6), M.skin, false); thumb.position.set(0.04 * s, -0.035, 0.02); thumb.rotation.z = 0.6 * s; B[side + 'Hand'].add(thumb);
  }
  // --- ноги: штаны, высокие сапоги ---
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    const th = mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 12), M.pants); th.position.y = -0.22; B[side + 'UpLeg'].add(th);
    const shin = mesh(new THREE.CapsuleGeometry(0.056, 0.3, 4, 10), M.pants); shin.position.y = -0.2; B[side + 'Leg'].add(shin);
    const boot = mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.38, 14, 1, true), M.boots); boot.position.y = -0.24; B[side + 'Leg'].add(boot);
    const top = mesh(new THREE.TorusGeometry(0.069, 0.007, 4, 16), M.boots, false); top.rotation.x = Math.PI / 2; top.position.y = -0.05; B[side + 'Leg'].add(top);
    const foot = mesh(new THREE.BoxGeometry(0.095, 0.075, 0.25), M.boots); foot.position.set(0, -0.025, 0.05); B[side + 'Foot'].add(foot);
    const toe = mesh(new THREE.SphereGeometry(0.048, 10, 8), M.boots); toe.scale.set(1, 0.78, 1.1); toe.position.set(0, -0.03, 0.17); B[side + 'Foot'].add(toe);
    const sole = mesh(new THREE.BoxGeometry(0.1, 0.018, 0.27), material('leather', '#120d0a')); sole.position.set(0, -0.06, 0.06); B[side + 'Foot'].add(sole);
  }

  // --- сокеты оружия ---
  const sockets = {};
  sockets.RightHandSocket = new THREE.Group(); sockets.RightHandSocket.name = 'RightHandSocket';
  sockets.RightHandSocket.position.set(0, -0.075, 0.015); sockets.RightHandSocket.rotation.x = Math.PI / 2; B.RightHand.add(sockets.RightHandSocket); // клинок смотрит вперёд из кулака
  sockets.BeltWeaponSocket = new THREE.Group(); sockets.BeltWeaponSocket.name = 'BeltWeaponSocket';
  sockets.BeltWeaponSocket.position.set(0.04, -0.02, 0.135); sockets.BeltWeaponSocket.rotation.set(0.1, 0, Math.PI - 0.25); B.Spine.add(sockets.BeltWeaponSocket); // кинжал на поясе спереди, рукоятью вверх
  sockets.BackWeaponSocket = new THREE.Group(); sockets.BackWeaponSocket.name = 'BackWeaponSocket';
  sockets.BackWeaponSocket.position.set(0.02, 0.0, -0.16); sockets.BackWeaponSocket.rotation.set(0, 0, 0.62 + Math.PI); B.Spine2.add(sockets.BackWeaponSocket); // шашка за спиной по диагонали

  root.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = false; } });

  // Выражения лица: neutral, anger (бой), focus (концентрация), look (взгляд в сторону)
  let expr = 'neutral', blinkAt = 3;
  function setExpression(name) { expr = name; }
  function updateFace(dt, t) {
    const k = { neutral: [0, 0, 1], anger: [0.35, -0.008, 3.2], focus: [0.18, -0.005, 0.6], look: [0.05, 0, 1] }[expr] || [0, 0, 1];
    for (const b of face.brows) { b.m.rotation.z += ((-0.1 * b.s - k[0] * b.s) - b.m.rotation.z) * Math.min(1, dt * 10); b.m.position.y += ((0.135 + k[1]) - b.m.position.y) * Math.min(1, dt * 10); }
    face.mouth.scale.y += (k[2] - face.mouth.scale.y) * Math.min(1, dt * 10);
    blinkAt -= dt;
    const closed = blinkAt < 0.12 && blinkAt > 0;
    for (const l of face.lids) l.scale.y = closed ? 1.05 : 0.4;
    if (blinkAt < 0) blinkAt = 2 + Math.random() * 4;
  }
  // Полы черкески слегка следуют за бёдрами — ткань не проходит сквозь ноги.
  function clothFollow() {
    for (const s of skirts) { s.half.rotation.x = s.leg.rotation.x * 0.55; s.half.rotation.z = s.leg.rotation.z * 0.5; }
  }
  // Пальцы: сжать в кулак (держит оружие) или расслабить.
  function grip(side, amount) { fingers[side].rotation.x = -amount * 1.3; }

  return { root, bones: B, sockets, setExpression, updateFace, clothFollow, grip };
}
