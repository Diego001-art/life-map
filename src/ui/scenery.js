// Нарисованные горы для заставки и меню: слои хребтов, туман, облака, солнце и парящий орёл.
// Всё рисуется кодом на <canvas>, без картинок.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Хребет: «острая» шумовая линия — несколько слоёв случайных пиков, сложенных вместе.
function ridge(n, rough) {
  const oct = [];
  for (let o = 0; o < 5; o++) { const k = 3 * 2 ** o + 1; oct.push(Array.from({ length: k + 1 }, rnd)); }
  const h = [];
  for (let i = 0; i <= n; i++) {
    let v = 0, a = 1;
    oct.forEach((arr, o) => {
      const x = i / n * (arr.length - 1), j = Math.floor(x), f = x - j, sm = f * f * (3 - 2 * f);
      const nz = arr[j] * (1 - sm) + arr[Math.min(j + 1, arr.length - 1)] * sm;
      v += (o < 2 ? nz : 1 - Math.abs(nz * 2 - 1)) * a; a *= 0.5 * rough * 0.55; // острые гребни на мелких слоях
    });
    h.push(v);
  }
  const lo = Math.min(...h), hi = Math.max(...h);
  return h.map(v => (v - lo) / (hi - lo)); // 0..1: от подножия до самой высокой вершины
}

export function createScenery(canvas) {
  const ctx = canvas.getContext('2d');
  const LAYERS = [ // далёкие → близкие
    { y: 0.50, amp: 0.36, rough: 2.2, color: '#6a7896', snow: 0.55, par: 0.01 },
    { y: 0.58, amp: 0.30, rough: 2.0, color: '#4d5d7a', snow: 0.65, par: 0.02 },
    { y: 0.66, amp: 0.20, rough: 1.6, color: '#36504c', par: 0.04, mist: true },
    { y: 0.76, amp: 0.15, rough: 1.3, color: '#26403a', par: 0.07 },
    { y: 0.86, amp: 0.10, rough: 1.0, color: '#17291f', par: 0.12, mist: true },
    { y: 0.97, amp: 0.07, rough: 0.8, color: '#0b140e', par: 0.2 },
  ].map(l => ({ ...l, h: ridge(256, l.rough) }));
  const clouds = Array.from({ length: 7 }, () => ({ x: rnd(), y: 0.08 + rnd() * 0.25, w: 0.15 + rnd() * 0.25, s: 0.004 + rnd() * 0.006 }));
  let W, H, mx = 0, t = 0, raf = 0, on = false;
  const resize = () => { W = canvas.width = innerWidth * Math.min(devicePixelRatio, 1.5); H = canvas.height = innerHeight * Math.min(devicePixelRatio, 1.5); };
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => mx = e.clientX / innerWidth - 0.5);

  function eagle(x, y, s, flap) { // силуэт орла
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#0d0d0d';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-20, -10 - flap * 12, -48, -4 - flap * 22); ctx.lineTo(-38, 2 - flap * 6); ctx.lineTo(-44, 6 - flap * 4);
    ctx.quadraticCurveTo(-18, 4, -6, 6); ctx.lineTo(-4, 14); ctx.lineTo(4, 14); ctx.lineTo(6, 6);
    ctx.quadraticCurveTo(18, 4, 44, 6 - flap * 4); ctx.lineTo(38, 2 - flap * 6); ctx.lineTo(48, -4 - flap * 22);
    ctx.quadraticCurveTo(20, -10 - flap * 12, 0, 0); ctx.fill(); ctx.restore();
  }

  function draw() {
    t += 1 / 60;
    // небо: закат над горами
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#141c33'); sky.addColorStop(0.45, '#4b3f5c'); sky.addColorStop(0.62, '#c46f45'); sky.addColorStop(0.75, '#e8a85c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // солнце
    const sx = W * (0.68 - mx * 0.01), sy = H * 0.5;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.35);
    sun.addColorStop(0, '#fff3c8'); sun.addColorStop(0.08, '#ffd98a'); sun.addColorStop(0.3, '#f0a05a55'); sun.addColorStop(1, '#0000');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    // облака
    for (const c of clouds) {
      c.x += c.s / 60; if (c.x > 1.3) c.x = -0.3;
      const g = ctx.createRadialGradient(c.x * W, c.y * H, 0, c.x * W, c.y * H, c.w * W);
      g.addColorStop(0, '#f2b98a33'); g.addColorStop(1, '#0000');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x * W, c.y * H, c.w * W, c.w * W * 0.18, 0, 0, 7); ctx.fill();
    }
    // хребты
    LAYERS.forEach((l, li) => {
      const off = (mx * l.par + t * l.par * 0.02) * W;
      const pts = [];
      for (let i = 0; i <= 256; i++) pts.push([i / 256 * W * 1.2 - W * 0.1 - off, H * (l.y - l.h[i] * l.amp)]);
      ctx.beginPath(); ctx.moveTo(pts[0][0], H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(pts[256][0], H); ctx.closePath();
      const g = ctx.createLinearGradient(0, H * (l.y - l.amp), 0, H);
      g.addColorStop(0, l.color); g.addColorStop(1, '#05080a');
      ctx.fillStyle = g; ctx.fill();
      // подсвеченный солнцем край хребта
      ctx.strokeStyle = li < 2 ? '#ffe2b866' : '#f0b07a22'; ctx.lineWidth = Math.max(1, H / 600);
      ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke();
      if (l.snow) { // снег только на вершинах выше снеговой линии
        ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], H); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(pts[256][0], H); ctx.clip();
        const line = H * (l.y - l.amp * l.snow), sg = ctx.createLinearGradient(0, line - H * 0.12, 0, line + H * 0.02);
        sg.addColorStop(0, '#eef2f8'); sg.addColorStop(0.75, '#c9d2e0cc'); sg.addColorStop(1, '#c9d2e000');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, line + H * 0.02);
        ctx.restore();
      }
      if (l.mist) { // туман в ущельях
        const m = ctx.createLinearGradient(0, H * (l.y - 0.06), 0, H * (l.y + 0.05));
        m.addColorStop(0, '#0000'); m.addColorStop(0.5, `rgba(214,170,140,${0.18 + Math.sin(t * 0.3 + li) * 0.05})`); m.addColorStop(1, '#0000');
        ctx.fillStyle = m; ctx.fillRect(0, H * (l.y - 0.06), W, H * 0.11);
      }
      if (li === 2) { // орёл летит между дальними и ближними горами
        const ex = ((t * 0.025) % 1.4 - 0.2) * W, ey = H * (0.3 + Math.sin(t * 0.4) * 0.04);
        const flap = Math.sin(t * 5) > 0.6 ? Math.sin(t * 10) : -0.1;
        eagle(ex, ey, H / 900, flap);
      }
    });
    // виньетка
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
    v.addColorStop(0, '#0000'); v.addColorStop(1, '#000a'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (on) raf = requestAnimationFrame(draw);
  }
  return {
    start() { if (!on) { on = true; canvas.style.display = ''; draw(); } },
    stop() { on = false; cancelAnimationFrame(raf); canvas.style.display = 'none'; },
  };
}
