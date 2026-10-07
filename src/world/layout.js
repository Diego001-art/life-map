// Планировка села по спутниковой карте (data/layout/, делается скриптом tools/layout_from_map.py).
// Карта задаёт только «где что»: дороги, плотность застройки, лес, голые склоны. Внешний вид — по фото села.
//   layout.lines      — дороги {kind: main|street|lane|river, pts:[{x,z}]} (сглаженные, точки через ~3 м)
//   layout.village(x,z), forest(x,z), bare(x,z) — зоны 0..1
//   layout.zonesTexture — те же зоны для шейдера земли
import * as THREE from 'three';

export const WIDTH = { main: 5.5, street: 4, lane: 3, path: 1.5, river: 3 };

// Сгладить ломаную (метод Чайкина) и разбить на точки через ~step м.
export function smoothLine(pts, iters = 2, step = 3) {
  for (let k = 0; k < iters; k++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    o.push(pts[pts.length - 1]); pts = o;
  }
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let t = step; t < L; t += step) out.push({ x: a.x + (b.x - a.x) * t / L, z: a.z + (b.z - a.z) * t / L });
    out.push(b);
  }
  return out;
}

export async function loadLayout(R = 990) {
  const layout = { lines: [], village: () => 0, forest: () => 0, bare: () => 0, zonesTexture: null, has: false,
    covered: (x, z) => x > -1258 && x < 988 && z > -772 && z < 574 }; // какую часть мира видно на спутниковой карте
  try {
    const r = await fetch('data/layout/roads.json');
    if (r.ok) {
      const d = await r.json();
      for (const l of d.lines) {
        // обрезать по краю мира (кольцо скал)
        let cur = [];
        const flush = () => { if (cur.length > 1) layout.lines.push({ kind: l.kind, pts: smoothLine(cur, l.kind === 'lane' ? 1 : 2) }); cur = []; };
        for (const [x, z] of l.pts) { if (Math.hypot(x, z) < R) cur.push({ x, z }); else flush(); }
        flush();
      }
      layout.has = true;
    }
  } catch {}
  try {
    const img = new Image(); img.src = 'data/layout/zones.png'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const D = ctx.getImageData(0, 0, c.width, c.height).data, N = c.width, cell = 2000 / N;
    const at = (x, z, ch) => { // билинейная выборка
      const fx = Math.max(0, Math.min(N - 1.001, (x + 1000) / cell - 0.5)), fz = Math.max(0, Math.min(N - 1.001, (z + 1000) / cell - 0.5));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, g = (a, b) => D[((j + b) * N + i + a) * 4 + ch];
      return ((g(0, 0) * (1 - u) + g(1, 0) * u) * (1 - v) + (g(0, 1) * (1 - u) + g(1, 1) * u) * v) / 255;
    };
    layout.village = (x, z) => at(x, z, 0); layout.forest = (x, z) => at(x, z, 1); layout.bare = (x, z) => at(x, z, 2);
    const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    layout.zonesTexture = t;
  } catch {}
  return layout;
}

// Врезка дорог в рельеф: поперёк полотна земля ровная (по высоте оси дороги), по краям — плавный откос.
// Возвращает функцию (x, z, rawHeight) → высота с учётом дорог.
export function makeRoadCarve(lines, rawHeightAt) {
  const N = 1000, cell = 2, A = new Float32Array(N * N), Wt = new Float32Array(N * N);
  for (const { kind, pts } of lines) {
    if (kind === 'river') continue;
    const half = WIDTH[kind] / 2 + 0.6, shoulder = 3.5;
    // высота оси дороги: сглаживаем вдоль дороги, чтобы не было ступенек
    const hc = pts.map(p => rawHeightAt(p.x, p.z));
    const hs = hc.map((_, i) => { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const v = hc[i + k]; if (v !== undefined) { s += v; n++; } } return s / n; });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      for (let t = 0; t <= L; t += 1) {
        const x = a.x + (b.x - a.x) * t / L, z = a.z + (b.z - a.z) * t / L, h = hs[i] + (hs[i + 1] - hs[i]) * t / L;
        const R = half + shoulder, ci = Math.round((x + 1000) / cell), cj = Math.round((z + 1000) / cell), r = Math.ceil(R / cell);
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
          const d = Math.hypot(ii * cell - 1000 - x, jj * cell - 1000 - z);
          const w = d <= half ? 1 : d >= R ? 0 : 1 - (d - half) / shoulder;
          const k = jj * N + ii;
          if (w > Wt[k]) { Wt[k] = w; A[k] = h; }
        }
      }
    }
  }
  return (x, z, raw) => {
    const fx = (x + 1000) / cell, fz = (z + 1000) / cell;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return raw;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    let w = 0, h = 0;
    for (const [di, dj, k] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
      const q = (j + dj) * N + i + di, ww = Wt[q] * k; w += ww; h += A[q] * ww;
    }
    if (w < 1e-4) return raw;
    const wn = Math.min(1, w), target = h / w, s = wn * wn * (3 - 2 * wn);
    return raw * (1 - s) + target * s;
  };
}

// Речка вдоль долины: по каждой точке главной дороги ищем самое низкое место поперёк (±40 м) — это русло.
export function riverAlong(line, heightAt, side = 40) {
  const out = [];
  for (let i = 0; i < line.length; i += 3) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L, p = line[i];
    let best = null;
    for (let d = -side; d <= side; d += 2) {
      if (Math.abs(d) < 7) continue; // не по самой дороге
      const x = p.x + nx * d, z = p.z + nz * d, h = heightAt(x, z);
      if (!best || h < best.h) best = { x, z, h };
    }
    out.push(best);
  }
  // сгладить, чтобы русло не прыгало с одной стороны дороги на другую
  for (let k = 0; k < 4; k++) for (let i = 1; i < out.length - 1; i++) { out[i].x = (out[i - 1].x + out[i].x * 2 + out[i + 1].x) / 4; out[i].z = (out[i - 1].z + out[i].z * 2 + out[i + 1].z) / 4; }
  return smoothLine(out, 1, 3);
}
