// Текстуры, которые игра рисует сама при загрузке (без чужих картинок):
// известняковая кладка, доски, кровельная жесть, щебёнка с колеями, трава, земля, скала, снег, кора, листва, ткань.
// К каждой — карта рельефа (normal map), чтобы свет «цеплялся» за неровности. Все текстуры бесшовные.
import * as THREE from 'three';

// --- бесшовный шум ---
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const h = (x, y) => perm[(perm[x & 255] + (y & 255)) & 511] / 255;
  // значение шума в точке (x, y) с периодом p клеток (поэтому текстура бесшовная)
  const n = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(xi % p, yi % p), b = h((xi + 1) % p, yi % p), c = h(xi % p, (yi + 1) % p), d = h((xi + 1) % p, (yi + 1) % p);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const fbm = (x, y, p, oct = 4) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += a * n(x * f, y * f, p * f); a *= 0.5; f *= 2; } return v / (1 - 0.5 ** oct); };
  return { n, fbm, rnd };
}

// Рисуем попиксельно: fn(u, v) → [r, g, b, height(0..1), alpha?]
function paint(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size), H = new Float32Array(size * size);
  let alpha = false;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b, h, a = 1] = fn(x / size, y / size, x, y);
    const i = y * size + x;
    img.data[i * 4] = r * 255; img.data[i * 4 + 1] = g * 255; img.data[i * 4 + 2] = b * 255; img.data[i * 4 + 3] = a * 255;
    if (a < 1) alpha = true;
    H[i] = h;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, H, size, alpha };
}

// Карта рельефа из высот (оператор Собеля, с заворотом краёв — тоже бесшовная).
function normalFrom({ H, size }, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// --- рецепты текстур ---
const RECIPES = {
  // Известняковая кладка (как на фото «Магазин у Братухи»): блоки разной длины, раствор в швах.
  masonry: { size: 512, normal: 3, fn(N) {
    const rows = 8, cols = 4, blocks = [];
    for (let r = 0; r < rows; r++) { let x = N.rnd() * 0.2; const row = []; while (x < 1 + 0.2) { const w = (0.7 + N.rnd() * 0.6) / cols; row.push([x, w, N.rnd()]); x += w; } blocks.push(row); }
    const base = [hex('#d8c49a'), hex('#cbb68a'), hex('#e0d0ac'), hex('#bfae8c'), hex('#d4bf92')];
    return (u, v) => {
      const r = Math.floor(v * rows), fy = v * rows - r;
      const uu = (u + 1) % 1; let b = blocks[r].find(([x, w]) => ((uu - x + 2) % 1) < w) || blocks[r][0];
      const fx = ((uu - b[0] + 2) % 1) / b[1];
      const edge = Math.min(fx, 1 - fx) * b[1] * cols * 2.2, edgeY = Math.min(fy, 1 - fy) * 2.2;
      const m = clamp(Math.min(edge, edgeY) * 9 - 0.15 + (N.n(u * 64, v * 64, 64) - 0.5) * 0.6);
      const grain = N.fbm(u * 24, v * 24, 24), pit = N.n(u * 160, v * 160, 160);
      let col = base[Math.floor(b[2] * base.length)].slice();
      col = mix3(col, hex('#9b8a6c'), grain * 0.35 + (pit > 0.8 ? 0.25 : 0));
      col = mix3(col, hex('#6f6656'), clamp(N.fbm(u * 4, v * 4, 4) - 0.55) * 1.2); // грязь и старость
      const mortar = hex('#8e8576');
      const c = mix3(mortar, col, m);
      return [c[0], c[1], c[2], m * 0.7 + grain * 0.25 - (pit > 0.85 ? 0.15 : 0)];
    };
  } },
  // Побелённая штукатурка (низ веранд, мечеть).
  plaster: { size: 256, normal: 1.5, fn(N) { return (u, v) => { const g = N.fbm(u * 8, v * 8, 8), s = N.fbm(u * 2, v * 2, 2); const c = mix3(hex('#efeadf'), hex('#c9c0ae'), clamp(s - 0.45) * 1.6 + g * 0.15); return [c[0], c[1], c[2], g]; }; } },
  // Доски: волокна, сучки, щели.
  planks: { size: 512, normal: 2.5, fn(N) {
    const n = 6, tones = Array.from({ length: n }, () => N.rnd());
    return (u, v) => {
      const k = Math.floor(u * n), fx = u * n - k, gap = fx < 0.04 || fx > 0.96 ? 1 : 0;
      const w = N.fbm(u * 6, v * 2, 2) * 6;
      const grain = Math.sin((fx * 30 + w * 4 + N.n(u * 30, v * 120, 30) * 2) * 1.0) * 0.5 + 0.5;
      const knot = N.n(u * 12 + k * 3, v * 6, 6) > 0.86 ? 1 : 0;
      let c = mix3(hex('#7a5a3c'), hex('#5a3f28'), tones[k] * 0.6 + grain * 0.35);
      c = mix3(c, hex('#3a2818'), knot * 0.6 + gap * 0.85);
      c = mix3(c, hex('#8a8478'), clamp(N.fbm(u * 3, v * 3, 3) - 0.6) * 1.2); // посеревшее старое дерево
      return [c[0], c[1], c[2], 0.6 + grain * 0.2 - gap * 0.6 - knot * 0.2];
    };
  } },
  // Кровельная жесть: волны, ржавые пятна.
  roof: { size: 256, normal: 4, fn(N) {
    return (u, v) => {
      const wave = Math.sin(u * Math.PI * 2 * 12) * 0.5 + 0.5;
      const rust = clamp((N.fbm(u * 5, v * 5, 5) - 0.58) * 3) * (0.5 + N.n(u * 40, v * 40, 40) * 0.5);
      const streak = clamp(N.n(u * 24, v * 3, 3) - 0.5) * 0.4;
      let c = mix3([1, 1, 1], [0.78, 0.78, 0.78], wave * 0.25 + streak);
      c = mix3(c, hex('#8a4a26'), rust);
      return [c[0], c[1], c[2], wave * 0.8 + rust * 0.1];
    };
  } },
  // Щебёнка с двумя колеями (u — поперёк дороги), мягкие края.
  road: { size: 256, normal: 3, fn(N) {
    return (u, v) => {
      const peb = N.n(u * 48, v * 48, 48), peb2 = N.n(u * 96 + 7, v * 96, 96);
      const rut = Math.exp(-((u - 0.3) ** 2) / 0.004) + Math.exp(-((u - 0.7) ** 2) / 0.004);
      const crown = 1 - Math.abs(u - 0.5) * 2;
      let c = mix3(hex('#8a8070'), hex('#6e655a'), peb * 0.5 + rut * 0.35);
      if (peb2 > 0.78) c = mix3(c, hex('#a59d90'), 0.6);
      c = mix3(c, hex('#5a4a36'), clamp(N.fbm(u * 3, v * 3, 3) - 0.55) * 1.5); // грязь
      const edge = clamp(Math.min(u, 1 - u) * 7 - (N.n(u * 20, v * 20, 20)) * 0.6);
      const grassy = clamp(1 - edge * 1.6);
      c = mix3(c, hex('#5d7a3a'), grassy * 0.55);
      return [c[0], c[1], c[2], peb * 0.5 + peb2 * 0.2 - rut * 0.4 + crown * 0.1, clamp(edge * 1.3)];
    };
  } },
  // Земля для смешивания на рельефе.
  grass: { size: 256, normal: 1.8, fn(N) {
    return (u, v) => {
      const g = N.fbm(u * 6, v * 6, 6), b = N.n(u * 128, v * 128, 128), b2 = N.n(u * 64 + 3, v * 64, 64);
      let c = mix3(hex('#4f7a34'), hex('#6a8a3e'), g);
      c = mix3(c, hex('#3a5e28'), b > 0.7 ? 0.5 : 0);
      c = mix3(c, hex('#8a9450'), b2 > 0.82 ? 0.45 : 0);
      return [c[0], c[1], c[2], b * 0.6 + g * 0.4];
    };
  } },
  dirt: { size: 256, normal: 2.5, fn(N) {
    return (u, v) => {
      const g = N.fbm(u * 8, v * 8, 8), p = N.n(u * 80, v * 80, 80);
      let c = mix3(hex('#6e5a42'), hex('#8a7356'), g);
      if (p > 0.78) c = mix3(c, hex('#9a9282'), 0.7);
      return [c[0], c[1], c[2], g * 0.5 + (p > 0.78 ? 0.5 : 0)];
    };
  } },
  rock: { size: 256, normal: 4, fn(N) {
    return (u, v) => {
      const g = N.fbm(u * 4, v * 4, 4), r = 1 - Math.abs(N.fbm(u * 12, v * 6, 6) * 2 - 1), d = N.n(u * 100, v * 100, 100);
      let c = mix3(hex('#857e74'), hex('#a39b8e'), g);
      c = mix3(c, hex('#4e4a45'), clamp((r - 0.85) * 6));          // трещины
      c = mix3(c, hex('#6b7a4a'), clamp((N.fbm(u * 5 + 9, v * 5, 5) - 0.62) * 3) * 0.7); // мох и лишайник
      return [c[0] * (0.9 + d * 0.2), c[1] * (0.9 + d * 0.2), c[2] * (0.9 + d * 0.2), g * 0.6 + d * 0.2 - clamp((r - 0.85) * 6) * 0.5];
    };
  } },
  snow: { size: 256, normal: 1.2, fn(N) { return (u, v) => { const g = N.fbm(u * 6, v * 6, 6); const c = mix3(hex('#f4f7fb'), hex('#cdd8e6'), g * 0.6); return [c[0], c[1], c[2], g]; }; } },
  bark: { size: 256, normal: 4, fn(N) {
    return (u, v) => {
      const f = 1 - Math.abs(N.fbm(u * 12, v * 2, 2) * 2 - 1), d = N.n(u * 60, v * 60, 60);
      const c = mix3(hex('#4a3a2c'), hex('#6e5b48'), f * 0.7 + d * 0.3);
      return [c[0], c[1], c[2], f];
    };
  } },
  birch: { size: 256, normal: 2, fn(N) {
    return (u, v) => {
      const mark = N.n(u * 6, v * 30, 6) > 0.72 ? 1 : 0, g = N.n(u * 50, v * 50, 50);
      const c = mix3(hex('#e8e4da'), hex('#2a2622'), mark * 0.85 + g * 0.08);
      return [c[0], c[1], c[2], 0.6 - mark * 0.4];
    };
  } },
  leaves: { size: 256, normal: 3, fn(N) {
    return (u, v) => {
      const l = N.n(u * 40, v * 40, 40), l2 = N.n(u * 80 + 5, v * 80, 80), g = N.fbm(u * 4, v * 4, 4);
      let c = mix3(hex('#ffffff'), hex('#b8c8a8'), g * 0.4);       // цвет задаёт само дерево (оттенки на экземплярах)
      c = mix3(c, hex('#6a7a5a'), l < 0.3 ? 0.55 : 0);              // тени между листьями
      if (l2 > 0.8) c = mix3(c, hex('#fffbe0'), 0.35);               // блики на листьях
      return [c[0], c[1], c[2], l * 0.7 + l2 * 0.3];
    };
  } },
  cloth: { size: 128, normal: 1.4, fn(N) {
    return (u, v) => { const w = (Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64)) * 0.5 + 0.5, g = N.fbm(u * 4, v * 4, 4); const k = 0.82 + w * 0.12 + g * 0.08; return [k, k, k, w * 0.5 + g * 0.5]; };
  } },
  wool: { size: 128, normal: 3, fn(N) { return (u, v) => { const c = N.n(u * 40, v * 40, 40), g = N.n(u * 80, v * 80, 80); const k = 0.8 + c * 0.15 + g * 0.08; return [k, k, k, c * 0.7 + g * 0.3]; }; } },
};

const cache = {};
// Получить текстуру: { map, normalMap }. repeat — сколько раз повторить на 1 единицу UV.
export function tex(name, repeat = 1) {
  if (!cache[name]) {
    const r = RECIPES[name], N = makeNoise(Object.keys(RECIPES).indexOf(name) + 3);
    const p = paint(r.size, r.fn(N));
    const map = new THREE.CanvasTexture(p.canvas), normalMap = new THREE.CanvasTexture(normalFrom(p, r.normal));
    for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    map.colorSpace = THREE.SRGBColorSpace;
    cache[name] = { map, normalMap, alpha: p.alpha };
  }
  const c = cache[name];
  if (repeat === 1) return c;
  // копии с другим повтором (картинка в памяти общая)
  const m = c.map.clone(), n = c.normalMap.clone();
  m.repeat.set(repeat, repeat); n.repeat.set(repeat, repeat); m.needsUpdate = n.needsUpdate = true;
  return { map: m, normalMap: n, alpha: c.alpha };
}

// Готовый материал: PBR (шероховатость, рельеф), без пластикового блеска.
export function pbr(name, { color = '#ffffff', roughness = 0.9, metalness = 0, normal = 1, repeat = 1, ...rest } = {}) {
  const t = tex(name, repeat);
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(normal, normal), color, roughness, metalness, ...rest });
}

export const TEXTURE_NAMES = Object.keys(RECIPES);
