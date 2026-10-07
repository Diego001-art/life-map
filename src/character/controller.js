// Контроллер анимаций: AnimationMixer + плавные переходы (crossfade) между состояниями.
// Плюс загрузчик модели: если есть assets/models/player.glb — берём его (и его анимации с такими же именами клипов),
// иначе используем модель героя, собранную кодом (rig.js), и анимации из clips.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeClips, CLIP_NAMES } from './clips.js';

// Длительность перехода (сек) из состояния в состояние, как в ТЗ.
const FADE = { default: 0.18, Walk: 0.2, Run: 0.18, Sprint: 0.15, JumpStart: 0.1, JumpLoop: 0.12, JumpFall: 0.15, Land: 0.08, Idle: 0.22, Block: 0.12, Parry: 0.06, Roll: 0.08, Dodge: 0.08, Death: 0.15 };
const LOOPED = new Set(['Idle', 'Walk', 'Run', 'Sprint', 'JumpLoop', 'JumpFall', 'Crouch', 'CrouchWalk', 'Block', 'Climb', 'ClimbDown']);

export function createAnimator(root, extraClips = []) {
  const mixer = new THREE.AnimationMixer(root);
  const clips = makeClips();
  // клипы из GLB с теми же именами заменяют встроенные
  for (const c of extraClips) { const i = clips.findIndex(x => x.name === c.name); if (i >= 0) clips[i] = c; else clips.push(c); }
  const actions = {};
  for (const c of clips) {
    const a = mixer.clipAction(c);
    if (!LOOPED.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[c.name] = a;
  }
  let current = null;
  const listeners = [];
  mixer.addEventListener('finished', (e) => { for (const f of listeners) f(e.action.getClip().name); });

  return {
    mixer, actions,
    get current() { return current; },
    // Перейти в состояние. once-клипы (атаки, прыжок…) проигрываются с начала.
    play(name, { fade, speed = 1, restart = false } = {}) {
      const next = actions[name]; if (!next) return;
      if (current === name && !restart) { next.timeScale = speed; return; }
      const prev = current && actions[current];
      next.reset(); next.timeScale = speed; next.setEffectiveWeight(1); next.play();
      if (prev && prev !== next) prev.crossFadeTo(next, fade ?? FADE[name] ?? FADE.default, false);
      current = name;
    },
    // Нормализованное время текущего клипа (0..1)
    progress() { const a = current && actions[current]; return a ? Math.min(1, a.time / a.getClip().duration) : 0; },
    onFinished(f) { listeners.push(f); },
    update(dt) { mixer.update(dt); },
  };
}

// Загрузить GLB, если он есть. Возвращает { scene, animations } или null.
export async function tryLoadGLB(url = 'assets/models/player.glb') {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    const gltf = await new GLTFLoader().loadAsync(url);
    const names = gltf.animations.map(a => a.name);
    console.info('player.glb загружен. Клипы:', names.join(', '), '\nНет клипов:', CLIP_NAMES.filter(n => !names.includes(n)).join(', ') || '—');
    return gltf;
  } catch (e) { console.warn('player.glb не загрузился, используется модель из кода:', e); return null; }
}
