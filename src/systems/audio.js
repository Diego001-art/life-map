// Звуки природы без файлов: ветер в горах и редкие птицы (генерируются браузером).
export function createAudio() {
  let ctx, master, on = false;
  function start() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ctx.destination);
    // ветер: шум через плавающий фильтр
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 250; lfo.connect(lg).connect(f.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.25;
    src.connect(f).connect(g).connect(master); src.start();
    // птицы
    const bird = () => {
      const o = ctx.createOscillator(), bg = ctx.createGain(), t = ctx.currentTime, base = 2000 + Math.random() * 1500;
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.3, t + 0.08); o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.16);
      bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.05, t + 0.02); bg.gain.linearRampToValueAtTime(0, t + 0.18);
      o.connect(bg).connect(master); o.start(t); o.stop(t + 0.2);
      setTimeout(bird, 3000 + Math.random() * 9000);
    };
    setTimeout(bird, 2000);
  }
  return {
    enable(v) { on = v; if (v) start(); if (master) master.gain.value = v ? 0.5 : 0; },
  };
}
