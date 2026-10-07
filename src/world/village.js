// Детали села: окна (вечером светятся), двери, деревянные застеклённые веранды (как на фото Бутри),
// трубы с дымом, площадь-годекан с колодцем, костры, фонари, бочки, ящики, дрова, стога, телеги.
// Всё одинаковое рисуется «пачками» (InstancedMesh) — так село остаётся лёгким для браузера.
import * as THREE from 'three';
import { env } from './env.js';
import { pbr } from './textures.js';

const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });

// Помощник: копит матрицы, потом создаёт InstancedMesh — по одному на участок мира 256×256 м.
// Так работают отсечение невидимого (frustum culling) и уровни детализации (LOD): мелкие детали дальних участков скрываются.
const CH = 256, CHUNKS = new Map(); // ключ участка → { cx, cz, meshes: [] }
const chunkKey = (x, z) => Math.floor((x + 1024) / CH) + ':' + Math.floor((z + 1024) / CH);
function batch(scene, geo, material, { shadow = true, lod = 380 } = {}) {
  const lists = new Map(), v = new THREE.Vector3();
  return {
    add(m, color) { v.setFromMatrixPosition(m); const k = chunkKey(v.x, v.z); if (!lists.has(k)) lists.set(k, []); lists.get(k).push([m.clone(), color]); },
    build() {
      for (const [k, list] of lists) {
        const im = new THREE.InstancedMesh(geo, material, list.length);
        list.forEach(([m, c], i) => { im.setMatrixAt(i, m); if (c) im.setColorAt(i, c); });
        im.computeBoundingSphere();
        im.castShadow = shadow; im.receiveShadow = true; im.userData.lod = lod; scene.add(im);
        const [i, j] = k.split(':').map(Number);
        if (!CHUNKS.has(k)) CHUNKS.set(k, { cx: i * CH - 1024 + CH / 2, cz: j * CH - 1024 + CH / 2, meshes: [] });
        CHUNKS.get(k).meshes.push(im);
      }
    },
  };
}

export function createVillage(scene, terrain, houses, roads, effects) {
  const o = new THREE.Object3D();
  const put = (b, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, color) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); b.add(o.matrix, color); };
  const rnd = Math.random;

  // --- окна, двери, веранды, трубы ---
  const glassLit = new THREE.MeshStandardMaterial({ color: '#2a3340', emissive: '#ffb057', emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 });
  const glassDark = new THREE.MeshStandardMaterial({ color: '#1e252c', roughness: 0.1, metalness: 0.3 }); // тёмная глубина окна, без интерьера
  const verandaGlass = new THREE.MeshStandardMaterial({ color: '#5f7482', emissive: '#ffb057', emissiveIntensity: 0, roughness: 0.08, metalness: 0.45 }); // стекло веранды отражает небо
  const B = {
    frame: batch(scene, new THREE.BoxGeometry(1.3, 1.45, 0.14), pbr('planks', { color: '#6a5444' }), { lod: 450 }),
    lit: batch(scene, new THREE.PlaneGeometry(1.05, 1.2), glassLit, { shadow: false , lod: 2000 }),
    dark: batch(scene, new THREE.PlaneGeometry(1.05, 1.2), glassDark, { shadow: false , lod: 450 }),
    shutter: batch(scene, new THREE.BoxGeometry(0.5, 1.4, 0.06), pbr('planks', { color: '#ffffff' }), { lod: 300 }),
    door: batch(scene, new THREE.BoxGeometry(1.15, 2.15, 0.16), pbr('planks', { color: '#9a7656' }), { lod: 350 }),
    hinge: batch(scene, new THREE.BoxGeometry(0.5, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.5, metalness: 0.8 }), { shadow: false , lod: 120 }),
    step: batch(scene, new THREE.BoxGeometry(1.5, 0.3, 0.7), pbr('rock', { color: '#d0c8b8' }), { lod: 200 }),
    slab: batch(scene, new THREE.BoxGeometry(1, 0.18, 1.7), pbr('planks', { color: '#a08060' }), { lod: 700 }),
    rail: batch(scene, new THREE.BoxGeometry(1, 0.9, 0.08), pbr('plaster'), { lod: 700 }),        // нижняя часть веранды (побелка)
    vglass: batch(scene, new THREE.BoxGeometry(1, 1.3, 0.05), verandaGlass, { shadow: false , lod: 900 }), // остеклённая веранда
    mullion: batch(scene, new THREE.BoxGeometry(0.08, 1.35, 0.1), pbr('plaster'), { lod: 400 }),          // белые переплёты рам
    post: batch(scene, new THREE.BoxGeometry(0.14, 2.6, 0.14), pbr('planks', { color: '#8a6a4a' }), { lod: 450 }),
    chimney: batch(scene, new THREE.BoxGeometry(0.7, 1.6, 0.7), pbr('masonry', { color: '#c8bfae' }), { lod: 900 }),
  };
  const shutterCols = ['#3f6f9a', '#4f7a4f', '#7a4a3a', '#5b3b22', '#6a7d8c'].map(c => new THREE.Color(c));
  const chimneys = [], colliders = [];
  const circ = (x, z, r, top = 1e9) => colliders.push({ type: 'circle', x, z, r, top });
  const boxc = (cx, cz, ang, w, d, top = 1e9) => colliders.push({ type: 'box', cx, cz, ang, w, d, top });
  for (const h of houses) {
    if (!h.box || h.shed) continue;
    const { ang, w, d, cx, cz } = h.box, long = w >= d, L = long ? w : d, D = long ? d : w;
    const dirA = long ? ang : ang + Math.PI / 2;               // вдоль длинной стены
    const ux = Math.cos(dirA), uz = Math.sin(dirA), nx = -uz, nz = ux; // u — вдоль стены, n — наружу
    const ry = -dirA;                                          // поворот так, чтобы «лицо» смотрело по n
    const shCol = shutterCols[Math.floor(rnd() * shutterCols.length)];
    const litChance = 0.55 + rnd() * 0.3;
    for (const side of [1, -1]) {
      const fx = cx + nx * (D / 2 + 0.03) * side, fz = cz + nz * (D / 2 + 0.03) * side;
      const faceRy = ry + (side > 0 ? 0 : Math.PI);
      const n = Math.max(1, Math.floor((L - 1.5) / 3));
      for (let f = 0; f < h.floors; f++) {
        for (let k = 0; k < n; k++) {
          const t = (k - (n - 1) / 2) * (L - 1.5) / n;
          const x = fx + ux * t, z = fz + uz * t, y = h.ground + f * 3 + 1.6;
          if (y - 0.8 < terrain.heightAt(x, z) + 0.2) continue;  // окно ушло бы в склон
          if (f === 0 && k === Math.floor(n / 2) && side === 1) { // дверь на первом этаже
            const dy = Math.max(h.ground, terrain.heightAt(x, z));
            put(B.door, x, dy + 1.12, z, faceRy);
            for (const hy of [0.5, 1.7]) put(B.hinge, x - ux * 0.3, dy + hy, z - uz * 0.3, faceRy); // кованые петли
            put(B.step, x + nx * 0.4, dy + 0.1, z + nz * 0.4, faceRy);                              // каменная ступенька
            continue;
          }
          put(B.frame, x, y, z, faceRy);
          put(rnd() < litChance ? B.lit : B.dark, x + nx * 0.08 * side, y, z + nz * 0.08 * side, faceRy);
          if (rnd() < 0.5) for (const s of [-1, 1]) put(B.shutter, x + ux * s * 0.92, y, z + uz * s * 0.92, faceRy, 1, 1, 1, shCol);
        }
      }
      // застеклённая веранда на втором этаже (типично для Бутри)
      const vx0 = cx + nx * (D / 2 + 0.85), vz0 = cz + nz * (D / 2 + 0.85);
      if (side === 1 && h.floors >= 2 && rnd() < 0.65 && roads.distToRoad(vx0, vz0) > 1.5 && roads.distToRoad(vx0 + ux * L / 2, vz0 + uz * L / 2) > 1 && roads.distToRoad(vx0 - ux * L / 2, vz0 - uz * L / 2) > 1) { // веранда не нависает над дорогой
        const y = h.ground + 3, vx = vx0, vz = vz0;
        put(B.slab, vx, y, vz, faceRy, L, 1, 1);
        boxc(vx, vz, dirA, L + 0.3, 1.9, y + 3); // веранда со столбами — не пройти насквозь
        const ox = nx * 0.8, oz = nz * 0.8;
        put(B.rail, vx + ox, y + 0.55, vz + oz, faceRy, L, 1, 1);
        put(B.vglass, vx + ox, y + 1.65, vz + oz, faceRy, L, 1, 1);
        for (let k = 0; k <= Math.floor(L / 2); k++) { const t = -L / 2 + k * L / Math.floor(L / 2); put(B.post, vx + ox + ux * t, y + 1.3, vz + oz + uz * t, faceRy); }
        for (let k = 1; k < Math.floor(L / 0.9); k++) { const t = -L / 2 + k * 0.9; put(B.mullion, vx + ox * 1.03 + ux * t, y + 1.65, vz + oz * 1.03 + uz * t, faceRy); }
        if (h.ground + 1 > terrain.heightAt(vx, vz)) for (const t of [-L / 2 + 0.2, L / 2 - 0.2]) put(B.post, vx + ox + ux * t, y - 1.3, vz + oz + uz * t, faceRy, 1, 1, 1);
      }
    }
    // труба на крыше
    if (rnd() < 0.75) {
      const t = (rnd() - 0.5) * L * 0.5, x = cx + ux * t + nx * D * 0.15, z = cz + uz * t + nz * D * 0.15, y = h.top + 1.2;
      put(B.chimney, x, y, z, ry);
      chimneys.push({ x, y: y + 0.9, z, rate: 0.5 + rnd() * 0.8, acc: rnd() });
    }
  }
  for (const k in B) B[k].build();

  // --- площадь-годекан в центре: брусчатка, лавки, колодец ---
  const sq = { x: 18, z: 14 };
  const sy = terrain.heightAt(sq.x, sq.z);
  const paving = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.5, 0.6, 28), pbr('masonry', { color: '#b8b0a2', repeat: 4 }));
  paving.position.set(sq.x, sy - 0.15, sq.z); paving.receiveShadow = true; scene.add(paving);
  const well = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 14, 1, true), pbr('masonry', { color: '#c9c0b0', side: THREE.DoubleSide }));
  ring.position.y = 0.45; well.add(ring);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 10), new THREE.MeshLambertMaterial({ color: '#2a4a5a' })); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; well.add(water);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.15), pbr('planks', { color: '#8a6a4a' })); p.position.set(s * 1.05, 1, 0); well.add(p); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.3, 6), mat('#5a3d26')); beam.rotation.z = Math.PI / 2; beam.position.y = 1.85; well.add(beam);
  const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), pbr('roof', { color: '#9aa0a4', metalness: 0.3, roughness: 0.6 })); wroof.position.y = 2.45; wroof.rotation.y = Math.PI / 4; well.add(wroof);
  well.position.set(sq.x, sy, sq.z); circ(sq.x, sq.z, 1.35); well.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(well);
  const bench = batch(scene, new THREE.BoxGeometry(2.4, 0.5, 0.6), pbr('planks', { color: '#9a7656' }));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, bx = sq.x + Math.cos(a) * 10, bz = sq.z + Math.sin(a) * 10; put(bench, bx, sy + 0.25, bz, -a + Math.PI / 2); boxc(bx, bz, a + Math.PI / 2, 2.5, 0.7, sy + 0.6); }
  bench.build();

  // --- костры (настоящий тёплый свет только у двух, чтобы не тормозило) ---
  const fires = [];
  const addFire = (x, z, light) => {
    const y = terrain.heightAt(x, z), g = new THREE.Group();
    for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), pbr('rock')); const a = k / 7 * 6.28; s.position.set(Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75); g.add(s); }
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), pbr('bark', { color: '#5a4a3a' })); l.rotation.set(Math.PI / 2 - 0.5, k * 1.57, 0); l.position.y = 0.25; g.add(l); }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4) })); // ярче 1 — светится (bloom) glow.position.y = 0.35; g.add(glow);
    g.position.set(x, y, z); scene.add(g); circ(x, z, 0.9, y + 1);
    let pl = null;
    if (light) { pl = new THREE.PointLight('#ff9a40', 0, 26, 1.6); pl.position.set(x, y + 1.4, z); scene.add(pl); }
    fires.push({ x, y: y + 0.4, z, light: pl, glow, acc: 0 });
  };
  addFire(sq.x + 6.5, sq.z - 5, true);

  // --- фонари вдоль главной дороги в селе (стекло светится ночью) ---
  const lampGlass = new THREE.MeshStandardMaterial({ color: '#3a3326', emissive: '#ffc070', emissiveIntensity: 0 });
  const lpost = batch(scene, new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.55, metalness: 0.7 }), { lod: 500 });
  const lglass = batch(scene, new THREE.BoxGeometry(0.32, 0.42, 0.32), lampGlass, { shadow: false, lod: 2000 });
  const inVillage = (x, z) => roads.layout && roads.layout.has ? roads.layout.village(x, z) > 0.3 : Math.hypot(x, z) < 330;
  for (const { kind, pts } of roads.lines) {
    if (kind !== 'main' && kind !== 'street') continue;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]; if (!inVillage(p.x, p.z)) continue;
      if ((acc += 3) < 36) continue; acc = 0;
      const a = pts[i - 1], ang = Math.atan2(p.z - a.z, p.x - a.x), off = (kind === 'main' ? 2.75 : 1.8) + 0.5;
      const x = p.x - Math.sin(ang) * off, z = p.z + Math.cos(ang) * off;
      if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 0.5)) continue;
      const y = terrain.heightAt(x, z);
      put(lpost, x, y + 1.6, z); put(lglass, x, y + 3.3, z); circ(x, z, 0.15);
    }
  }
  lpost.build(); lglass.build();

  // --- хозяйство у домов: бочки, ящики, дрова, стога, телеги ---
  const P = {
    barrel: batch(scene, new THREE.CylinderGeometry(0.42, 0.42, 1, 12), pbr('planks', { color: '#a07a56' }), { lod: 220 }),
    hoop: batch(scene, new THREE.CylinderGeometry(0.435, 0.435, 0.07, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide }), { shadow: false , lod: 120 }),
    crate: batch(scene, new THREE.BoxGeometry(0.8, 0.8, 0.8), pbr('planks', { color: '#c8a880' }), { lod: 220 }),
    wood: batch(scene, new THREE.CylinderGeometry(0.11, 0.11, 0.9, 7), pbr('bark', { color: '#c8b090' }), { lod: 180 }),   // поленья (кладутся в поленницу)
    hay: batch(scene, new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), pbr('wool', { color: '#d2b468', normal: 2 }), { lod: 500 }),
    cart: batch(scene, new THREE.BoxGeometry(2.2, 0.5, 1.3), pbr('planks', { color: '#9a7656' }), { lod: 260 }),
    wheel: batch(scene, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14), pbr('planks', { color: '#6a5444' }), { lod: 200 }),
  };
  for (const h of houses) {
    const n = Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.28, r = h.radius + 1.3 + rnd() * 1.5, x = h.center.x + Math.cos(a) * r, z = h.center.z + Math.sin(a) * r;
      if (roads.distToRoad(x, z) < 3) continue; // бочки, дрова, стога, телеги — не на дороге
      const y = terrain.heightAt(x, z), t = rnd(), ry = rnd() * 6;
      if (t < 0.3) { put(P.barrel, x, y + 0.48, z, ry); put(P.hoop, x, y + 0.2, z, ry); put(P.hoop, x, y + 0.78, z, ry); circ(x, z, 0.45, y + 1); }
      else if (t < 0.5) { circ(x, z, 0.55, y + 1.6); put(P.crate, x, y + 0.4, z, ry); if (rnd() < 0.5) put(P.crate, x, y + 1.2, z, ry + 0.4, 0.8, 0.8, 0.8); }
      else if (t < 0.75) { // поленница: поленья рядами
        const ang = -Math.atan2(h.center.z - z, h.center.x - x) + Math.PI / 2, cx2 = Math.cos(-ang), sz2 = Math.sin(-ang);
        boxc(x, z, -ang, 1.9, 1.0, y + 0.9);
        for (let r = 0; r < 4; r++) for (let q = 0; q < 8 - r; q++) {
          const off = (q - (7 - r) / 2) * 0.23;
          o.position.set(x + cx2 * off, y + 0.12 + r * 0.21, z + sz2 * off); o.rotation.set(Math.PI / 2, ang, 0, 'YXZ'); o.scale.set(1, 1, 1); o.updateMatrix(); P.wood.add(o.matrix);
        }
      }
      else if (t < 0.9) { put(P.hay, x, y - 0.1, z, ry); circ(x, z, 1.4); }
      else {
        put(P.cart, x, y + 0.8, z, ry); circ(x, z, 1.2, y + 1.2);
        for (const s of [-1, 1]) { o.position.set(x + Math.sin(ry) * 0.72 * s, y + 0.55, z + Math.cos(ry) * 0.72 * s); o.rotation.set(Math.PI / 2, ry, 0, 'YXZ'); o.scale.set(1, 1, 1); o.updateMatrix(); P.wheel.add(o.matrix); }
      }
    }
  }
  for (const k in P) P[k].build();

  // --- обновление: дым, огонь, свет окон и фонарей ---
  let t = 0;
  return {
    fires, square: sq, colliders,
    // LOD: мелкие детали (окна, двери, бочки, дрова…) видны только на ближних участках
    updateLOD(player) {
      for (const c of CHUNKS.values()) {
        const d = Math.hypot(c.cx - player.x, c.cz - player.z) - CH * 0.7;
        for (const m of c.meshes) m.visible = d < m.userData.lod;
      }
    },
    update(dt, player) {
      t += dt;
      const night = env.night;
      glassLit.emissiveIntensity = THREE.MathUtils.smoothstep(night, 0.25, 0.8) * 3.2;
      verandaGlass.emissiveIntensity = THREE.MathUtils.smoothstep(night, 0.3, 0.85) * 0.7;
      lampGlass.emissiveIntensity = THREE.MathUtils.smoothstep(night, 0.3, 0.8) * 6;
      // дым только из ближайших труб (экономим частицы)
      for (const c of chimneys) {
        if (Math.abs(c.x - player.x) > 160 || Math.abs(c.z - player.z) > 160) continue;
        if ((c.acc += dt * c.rate) > 1) { c.acc = 0; effects.smoke.emit(c.x, c.y, c.z); }
      }
      for (const f of fires) {
        const near = Math.hypot(f.x - player.x, f.z - player.z) < 200;
        if (near && (f.acc += dt) > 0.05) { f.acc = 0; effects.fire.emit(f.x, f.y, f.z, 2); if (Math.random() < 0.3) effects.smoke.emit(f.x, f.y + 1.2, f.z); }
        const flick = 0.75 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7.3) * 0.1 + Math.random() * 0.08;
        if (f.light) f.light.intensity = (8 + night * 30) * flick;
        f.glow.scale.setScalar(0.8 + flick * 0.4);
      }
    },
  };
}
