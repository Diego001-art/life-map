// Дома села: контуры берутся из OpenStreetMap, свои правки — из data/houses/houses.json.
import * as THREE from 'three';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function loadOsm(lat, lon, radius) {
  const q = `[out:json][timeout:25];(way(around:${radius},${lat},${lon})[building];way(around:${radius},${lat},${lon})[highway];);out geom;`;
  // Сначала локальная копия (если её сохранили), потом интернет.
  try { const r = await fetch('data/houses/osm-cache.json'); if (r.ok) return await r.json(); } catch {}
  // оба сервера сразу, ждём не дольше 8 секунд
  try {
    return await Promise.any(OVERPASS.map(async (url) => {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    }));
  } catch {}
  return null;
}

export async function createHouses(scene, terrain, geo) {
  const cfg = await (await fetch('data/houses/houses.json')).json();
  const osm = await loadOsm(terrain.lat, terrain.lon, 900);
  const houses = []; // { id, name, center, radius, mesh }

  // Стена — текстура известняка из фото села (assets/tex/wall.jpg).
  const wallTex = new THREE.TextureLoader().load('assets/tex/wall.jpg');
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(0.25, 0.33);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  // Цвета крыш как на фото: в основном серый металл, иногда красные, синие, зелёные.
  const ROOFS = ['#a8adb1', '#9aa0a4', '#b6babd', '#8d9397', '#a8adb1', '#b5483c', '#3f6f9a', '#4f7a4f', '#7a4a3a'];
  const roofMats = {};
  const roofMat = (c) => roofMats[c] || (roofMats[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide }));

  // Наименьший прямоугольник вокруг контура — по нему строим двускатную крышу.
  function orientedBox(pts) {
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ang = Math.atan2(b.z - a.z, b.x - a.x);
      const c = Math.cos(-ang), s = Math.sin(-ang);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of pts) { const x = p.x * c - p.z * s, z = p.x * s + p.z * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const area = (x1 - x0) * (z1 - z0);
      if (!best || area < best.area) {
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        best = { area, ang, w: x1 - x0, d: z1 - z0, cx: mx * Math.cos(ang) - mz * Math.sin(ang), cz: mx * Math.sin(ang) + mz * Math.cos(ang) };
      }
    }
    return best;
  }
  function gableRoof(box, color) {
    const long = box.w >= box.d, L = (long ? box.w : box.d) + 0.6, W = (long ? box.d : box.w) + 0.6, H = Math.min(2.5, W * 0.3);
    const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, H)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
    g.translate(0, 0, -L / 2);
    const m = new THREE.Mesh(g, roofMat(color));
    m.rotation.y = -box.ang + (long ? Math.PI / 2 : 0);
    return m;
  }

  function addHouse(id, pts, opts = {}) {
    if (pts.length < 3) return;
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.z)));
    let minY = Infinity, cx = 0, cz = 0;
    for (const p of pts) { minY = Math.min(minY, terrain.heightAt(p.x, p.z)); cx += p.x; cz += p.z; }
    cx /= pts.length; cz /= pts.length;
    const radius = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.z - cz)));
    const floors = opts.floors || (Math.random() < 0.6 ? 2 : 1);
    const height = floors * 3 + 1.5; // +1.5 м уходит в склон
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    const wall = new THREE.Color(opts.color || '#ffffff').offsetHSL(0, 0, -Math.random() * 0.12);
    const roofColor = opts.roofColor || ROOFS[Math.floor(Math.random() * ROOFS.length)];
    const mesh = new THREE.Mesh(geom, [roofMat('#8d8478'), new THREE.MeshLambertMaterial({ color: wall, map: wallTex })]);
    mesh.position.y = minY - 1.5;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.houseId = id;
    scene.add(mesh);
    const top = mesh.position.y + height;
    let roof = null;
    if (opts.roof !== 'flat') {
      const box = orientedBox(pts);
      roof = gableRoof(box, roofColor);
      roof.position.set(box.cx, top, box.cz);
      roof.castShadow = true; scene.add(roof);
    }
    houses.push({ id, name: opts.name, photo: opts.photo, center: new THREE.Vector3(cx, minY, cz), radius, top, mesh, roof });
  }

  const roads = [];
  if (osm) {
    for (const el of osm.elements) {
      if (!el.geometry) continue;
      const pts = el.geometry.map(g => geo.toXZ(g.lat, g.lon));
      if (el.tags.building) {
        const o = cfg.houses[el.id] || {};
        const lv = parseInt(el.tags['building:levels']);
        addHouse(String(el.id), pts.slice(0, -1), { floors: lv || undefined, ...o });
      } else if (el.tags.highway) roads.push(pts);
    }
  }
  // Если OpenStreetMap недоступен — строим примерное село, чтобы мир не был пустым.
  if (houses.length < 20) {
    let n = 0, tries = 0;
    while (n < 260 && tries++ < 6000) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 330, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const slope = Math.abs(terrain.heightAt(x + 4, z) - terrain.heightAt(x - 4, z)) + Math.abs(terrain.heightAt(x, z + 4) - terrain.heightAt(x, z - 4));
      if (slope > 6) continue;
      if (houses.some(h => Math.hypot(h.center.x - x, h.center.z - z) < h.radius + 9)) continue;
      // дом вытянут вдоль склона, как в горных сёлах
      const gx = terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z), gz = terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1);
      const ang = Math.atan2(gz, gx) + Math.PI / 2, w = 7 + Math.random() * 6, d = 6 + Math.random() * 3;
      const c = Math.cos(ang), s2 = Math.sin(ang);
      const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => ({ x: x + u * c - v * s2, z: z + u * s2 + v * c }));
      addHouse('gen-' + n++, pts, {});
    }
  }

  for (const e of cfg.extra || []) {
    const { x, z, w, d } = e;
    addHouse(e.id || `extra-${x}-${z}`, [{ x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 }, { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 }], e);
  }

  // Дороги — полосы, лежащие на земле.
  const roadMat = new THREE.MeshLambertMaterial({ color: '#8c7b63' });
  for (const line of roads) {
    const verts = [];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * 2, nz = dx / L * 2;
      const y = (p) => terrain.heightAt(p.x, p.z) + 0.15;
      const A1 = [a.x + nx, y(a), a.z + nz], A2 = [a.x - nx, y(a), a.z - nz];
      const B1 = [b.x + nx, y(b), b.z + nz], B2 = [b.x - nx, y(b), b.z - nz];
      verts.push(...A1, ...A2, ...B1, ...A2, ...B2, ...B1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, roadMat); m.material.side = THREE.DoubleSide; m.receiveShadow = true;
    scene.add(m);
  }

  // Убрать дома, которые стоят на месте мечети, магазина и т.п.
  function clearAround(x, z, r) {
    for (let i = houses.length - 1; i >= 0; i--) {
      const h = houses[i];
      if (Math.hypot(h.center.x - x, h.center.z - z) < r + h.radius) { scene.remove(h.mesh); if (h.roof) scene.remove(h.roof); houses.splice(i, 1); }
    }
  }
  return { houses, loaded: !!osm, clearAround };
}
