// Звуки гор без файлов (браузер сам их синтезирует): ветер, крик орла, тихий низкий гул-«музыка».
// Браузер разрешает звук только после нажатия игрока — поэтому старт по клику.
export function createAudio() {
  let ctx, master, music, on = false;
  const noiseBuf = () => { const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };

  function wind(gainV, freq) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05 + Math.random() * 0.08; lg.gain.value = freq * 0.6; lfo.connect(lg).connect(f.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = gainV;
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.07; lg2.gain.value = gainV * 0.7; lfo2.connect(lg2).connect(g.gain); lfo2.start(); // порывы
    src.connect(f).connect(g).connect(master); src.start();
  }
  function eagleCry() { // крик орла: высокий свист, падающий вниз с дрожанием
    const t = ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.55, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 3;
      o.frequency.setValueAtTime(3100, t0); o.frequency.exponentialRampToValueAtTime(1900, t0 + 0.45);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 38; vg.gain.value = 90; vib.connect(vg).connect(o.frequency); vib.start(t0); vib.stop(t0 + 0.5);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.09, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
      o.connect(f).connect(g).connect(master); o.start(t0); o.stop(t0 + 0.5);
    }
  }
  function bird() {
    const o = ctx.createOscillator(), bg = ctx.createGain(), t = ctx.currentTime, base = 2200 + Math.random() * 1500;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.3, t + 0.08); o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.16);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.03, t + 0.02); bg.gain.linearRampToValueAtTime(0, t + 0.18);
    o.connect(bg).connect(master); o.start(t); o.stop(t + 0.2);
  }
  function drone() { // тихий низкий гул, как далёкий горный напев (для меню)
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    for (const [fq, v] of [[55, 0.05], [82.4, 0.035], [110, 0.02], [164.8, 0.012]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq; o.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain(); g.gain.value = v; const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = 0.03 + Math.random() * 0.05; lg.gain.value = v * 0.6; lf.connect(lg).connect(g.gain); lf.start();
      o.connect(g).connect(music); o.start();
    }
  }
  function start() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = on ? 0.6 : 0; master.connect(ctx.destination);
    wind(0.22, 380); wind(0.1, 900); drone();
    const loopEagle = () => { if (on) eagleCry(); setTimeout(loopEagle, 14000 + Math.random() * 20000); };
    setTimeout(loopEagle, 2500);
    const loopBird = () => { if (on) bird(); setTimeout(loopBird, 3000 + Math.random() * 8000); };
    setTimeout(loopBird, 4000);
  }
  return {
    enable(v) { on = v; if (v) start(); if (master) master.gain.setTargetAtTime(v ? 0.6 : 0, ctx.currentTime, 0.3); },
    menuMusic(v) { if (music) music.gain.setTargetAtTime(v ? 1 : 0.15, ctx.currentTime, 1.5); },
    eagle() { if (ctx && on) eagleCry(); },
  };
}
