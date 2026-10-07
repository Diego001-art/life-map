// Анимации героя (по референсу движений IMAGE 2). Все анимации «на месте» (in-place):
// тело двигают кости, а перемещает героя по миру код (player.js) — так работают скорость, коллизии и прыжки.
// Клипы названы точно как в ТЗ: Idle, Walk, Run, Sprint, JumpStart, JumpLoop, JumpFall, Land, Crouch, CrouchWalk,
// Dodge, Roll, LightAttack1..3, HeavyAttack, SpinAttack, DaggerAttack, Block, Parry, HitFront/Back/Left/Right,
// Death, Interact, Pickup, Climb, ClimbDown.
//
// Знаки поворотов (персонаж смотрит вдоль +Z, правая рука — на −X):
//   бедро/плечо X < 0 — вперёд;  колено X > 0 — сгиб;  локоть X < 0 — сгиб;  корпус X > 0 — наклон вперёд;
//   корпус Y > 0 — поворот влево;  правое плечо Z < 0 — рука в сторону, левое Z > 0.
import * as THREE from 'three';

const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const D = Math.PI / 180;
const HIPS_Y = 0.97;

// Поза: { Bone: [x, y, z] в градусах, pos: [x, y, z] — сдвиг таза }. Пропущенные кости — в покое.
function clip(name, duration, keys) {
  const times = keys.map(k => k.t * duration), tracks = [];
  const used = new Set(); keys.forEach(k => Object.keys(k.p).forEach(b => b !== 'pos' && used.add(b)));
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const b of used) {
    const v = [];
    for (const k of keys) { const r = k.p[b] || [0, 0, 0]; e.set(r[0] * D, r[1] * D, r[2] * D); q.setFromEuler(e); v.push(q.x, q.y, q.z, q.w); }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, v));
  }
  if (keys.some(k => k.p.pos)) {
    const v = []; for (const k of keys) { const p = k.p.pos || [0, 0, 0]; v.push(p[0], HIPS_Y + p[1], p[2]); }
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, v));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}
const over = (...ps) => Object.assign({}, ...ps); // поздняя поза перекрывает раннюю
const merge = (...ps) => { const o = {}; for (const p of ps) for (const k in p) o[k] = o[k] ? o[k].map((v, i) => v + p[k][i]) : p[k].slice(); return o; };

// Цикл шага: a — размах бёдер, k — сгиб колена, arm — размах рук, el — сгиб локтей, lean — наклон, bob — подпрыгивание.
function gait(name, dur, { a, k, arm, el, lean = 0, bob = 0.02, base = {}, low = 0 }) {
  const keys = [];
  for (let i = 0; i <= 8; i++) {
    const ph = i / 8, s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
    keys.push({ t: ph, p: merge(base, {
      LeftUpLeg: [-a * s, 0, 0], RightUpLeg: [a * s, 0, 0],
      LeftLeg: [6 + k * Math.max(0, c), 0, 0], RightLeg: [6 + k * Math.max(0, -c), 0, 0],
      LeftFoot: [-a * 0.3 * s, 0, 0], RightFoot: [a * 0.3 * s, 0, 0],
      LeftArm: [arm * s, 0, 6], RightArm: [-arm * s, 0, -6],
      LeftForeArm: [-el - 12 * Math.max(0, -s), 0, 0], RightForeArm: [-el - 12 * Math.max(0, s), 0, 0],
      Spine: [lean, 5 * s, 0], Spine2: [lean * 0.4, 6 * s, 0], Hips: [0, -5 * s, 0],
      pos: [0, -bob * Math.abs(s) - low, 0],
    }) });
  }
  return clip(name, dur, keys);
}
// Одиночное действие из нескольких поз (t от 0 до 1).
const act = (name, dur, ...keys) => clip(name, dur, keys.map(([t, p]) => ({ t, p })));

const REST_ARMS = { LeftArm: [0, 0, 6], RightArm: [0, 0, -6], LeftForeArm: [-10, 0, 0], RightForeArm: [-10, 0, 0] };
const GUARD = over(REST_ARMS, { RightArm: [-35, 0, -8], RightForeArm: [-55, 0, 0], LeftArm: [-10, 0, 10], LeftForeArm: [-40, 0, 0], LeftUpLeg: [-12, 0, 0], RightUpLeg: [10, 0, 0], LeftLeg: [16, 0, 0], RightLeg: [12, 0, 0], Spine: [6, -10, 0], pos: [0, -0.04, 0] });
const BLOCK = { RightArm: [-75, 25, -15], RightForeArm: [-85, 0, 0], LeftArm: [-55, 0, 25], LeftForeArm: [-95, 0, 0], Spine: [10, 8, 0], LeftUpLeg: [-15, 0, 0], RightUpLeg: [12, 0, 0], LeftLeg: [22, 0, 0], RightLeg: [18, 0, 0], Head: [8, 0, 0], pos: [0, -0.07, 0] };
const CROUCH = { pos: [0, -0.34, 0], LeftUpLeg: [-75, 0, 4], RightUpLeg: [-55, 0, -4], LeftLeg: [110, 0, 0], RightLeg: [95, 0, 0], LeftFoot: [-35, 0, 0], RightFoot: [-40, 0, 0], Spine: [24, 0, 0], Spine2: [8, 0, 0], Head: [-20, 0, 0], LeftArm: [-25, 0, 12], RightArm: [-25, 0, -12], LeftForeArm: [-50, 0, 0], RightForeArm: [-50, 0, 0] };

export function makeClips() {
  const clips = [
    // --- ожидание и передвижение ---
    act('Idle', 3.2,
      [0, over(REST_ARMS, { Spine1: [0, 0, 0], Head: [0, 0, 0] })],
      [0.5, over(REST_ARMS, { Spine1: [-2.5, 0, 0], Head: [-2, 8, 0], LeftArm: [0, 0, 2], RightArm: [0, 0, -2] })],
      [1, over(REST_ARMS, { Spine1: [0, 0, 0], Head: [0, 0, 0] })]),
    gait('Walk', 1.05, { a: 24, k: 38, arm: 18, el: 12, lean: 2, bob: 0.025 }),
    gait('Run', 0.66, { a: 40, k: 75, arm: 38, el: 65, lean: 10, bob: 0.05 }),
    gait('Sprint', 0.5, { a: 55, k: 100, arm: 55, el: 85, lean: 20, bob: 0.07 }),
    gait('CrouchWalk', 1.1, { a: 22, k: 30, arm: 10, el: 40, lean: 24, bob: 0.02, low: 0.3, base: { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-55, 0, 0], LeftLeg: [80, 0, 0], RightLeg: [80, 0, 0], LeftFoot: [-25, 0, 0], RightFoot: [-25, 0, 0], Head: [-20, 0, 0] } }),
    act('Crouch', 2, [0, CROUCH], [0.5, over(CROUCH, { Spine1: [3, 0, 0] })], [1, CROUCH]),
    // --- прыжок ---
    act('JumpStart', 0.18, [0, {}], [0.5, over(CROUCH, { pos: [0, -0.18, 0] })], [1, { LeftUpLeg: [-20, 0, 0], RightUpLeg: [10, 0, 0], LeftArm: [-60, 0, 20], RightArm: [-60, 0, -20], Spine: [-5, 0, 0], pos: [0, 0.05, 0] }]),
    act('JumpLoop', 0.6,
      [0, { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-20, 0, 0], LeftLeg: [80, 0, 0], RightLeg: [60, 0, 0], LeftArm: [-70, 0, 30], RightArm: [-50, 0, -30], LeftForeArm: [-40, 0, 0], RightForeArm: [-40, 0, 0], Spine: [8, 0, 0] }],
      [0.5, { LeftUpLeg: [-50, 0, 0], RightUpLeg: [-25, 0, 0], LeftLeg: [85, 0, 0], RightLeg: [65, 0, 0], LeftArm: [-75, 0, 32], RightArm: [-55, 0, -32], LeftForeArm: [-45, 0, 0], RightForeArm: [-45, 0, 0], Spine: [10, 0, 0] }],
      [1, { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-20, 0, 0], LeftLeg: [80, 0, 0], RightLeg: [60, 0, 0], LeftArm: [-70, 0, 30], RightArm: [-50, 0, -30], LeftForeArm: [-40, 0, 0], RightForeArm: [-40, 0, 0], Spine: [8, 0, 0] }]),
    act('JumpFall', 0.5,
      [0, { LeftUpLeg: [-25, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [30, 0, 0], RightLeg: [25, 0, 0], LeftArm: [-30, 0, 55], RightArm: [-30, 0, -55], Spine: [-4, 0, 0] }],
      [0.5, { LeftUpLeg: [-28, 0, 0], RightUpLeg: [8, 0, 0], LeftLeg: [34, 0, 0], RightLeg: [28, 0, 0], LeftArm: [-35, 0, 60], RightArm: [-35, 0, -60], Spine: [-5, 0, 0] }],
      [1, { LeftUpLeg: [-25, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [30, 0, 0], RightLeg: [25, 0, 0], LeftArm: [-30, 0, 55], RightArm: [-30, 0, -55], Spine: [-4, 0, 0] }]),
    act('Land', 0.3, [0, { LeftUpLeg: [-25, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [30, 0, 0] }], [0.35, over(CROUCH, { pos: [0, -0.22, 0], Spine: [18, 0, 0] })], [1, REST_ARMS]),
    // --- уклонение и перекат ---
    act('Dodge', 0.45, [0, GUARD], [0.35, over(GUARD, { Spine: [8, 0, 18], Hips: [0, 0, -10], LeftUpLeg: [-5, 0, 25], RightUpLeg: [5, 0, 10], pos: [0, -0.12, 0] })], [1, GUARD]),
    act('Roll', 0.7,
      [0, { pos: [0, 0, 0] }],
      [0.15, over(CROUCH, { pos: [0, -0.35, 0] })],
      [0.35, over(CROUCH, { Hips: [120, 0, 0], pos: [0, -0.55, 0], Head: [30, 0, 0] })],
      [0.55, over(CROUCH, { Hips: [240, 0, 0], pos: [0, -0.6, 0], Head: [30, 0, 0] })],
      [0.8, over(CROUCH, { Hips: [345, 0, 0], pos: [0, -0.35, 0] })],
      [1, over(REST_ARMS, { Hips: [360, 0, 0] })]),
    // --- атаки (оружие в правой руке) ---
    act('LightAttack1', 0.55, // горизонтальный удар справа налево
      [0, GUARD],
      [0.28, over(GUARD, { RightArm: [-40, -30, -80], RightForeArm: [-70, 0, 0], Spine: [8, -35, 0], Spine2: [0, -15, 0] })],
      [0.45, over(GUARD, { RightArm: [-85, 40, -15], RightForeArm: [-10, 0, 0], Spine: [10, 35, 0], Spine2: [0, 15, 0], RightUpLeg: [-20, 0, 0], LeftUpLeg: [15, 0, 0] })],
      [1, GUARD]),
    act('LightAttack2', 0.55, // обратный удар слева направо
      [0, GUARD],
      [0.28, over(GUARD, { RightArm: [-75, 40, 25], RightForeArm: [-95, 0, 0], Spine: [6, 30, 0], Spine2: [0, 12, 0] })],
      [0.45, over(GUARD, { RightArm: [-70, -35, -70], RightForeArm: [-10, 0, 0], Spine: [10, -35, 0], Spine2: [0, -15, 0], LeftUpLeg: [-25, 0, 0] })],
      [1, GUARD]),
    act('LightAttack3', 0.7, // удар сверху вниз
      [0, GUARD],
      [0.35, over(GUARD, { RightArm: [-165, 0, -10], RightForeArm: [-40, 0, 0], LeftArm: [-120, 0, 10], Spine: [-12, 0, 0], Head: [-10, 0, 0] })],
      [0.55, over(GUARD, { RightArm: [-45, 0, -10], RightForeArm: [-5, 0, 0], Spine: [28, 0, 0], RightUpLeg: [-35, 0, 0], RightLeg: [40, 0, 0], LeftUpLeg: [20, 0, 0], pos: [0, -0.12, 0] })],
      [1, GUARD]),
    act('HeavyAttack', 1.1, // широкий замах двумя руками и сильный удар
      [0, GUARD],
      [0.42, over(GUARD, { RightArm: [-160, -20, -25], LeftArm: [-155, 20, 25], RightForeArm: [-60, 0, 0], LeftForeArm: [-60, 0, 0], Spine: [-15, -25, 0], Spine2: [-5, -10, 0], pos: [0, 0.02, 0] })],
      [0.6, over(GUARD, { RightArm: [-30, 10, -5], LeftArm: [-35, -10, 5], RightForeArm: [-5, 0, 0], LeftForeArm: [-10, 0, 0], Spine: [38, 15, 0], RightUpLeg: [-45, 0, 0], RightLeg: [55, 0, 0], LeftUpLeg: [25, 0, 0], pos: [0, -0.2, 0] })],
      [0.8, over(GUARD, { RightArm: [-30, 10, -5], Spine: [30, 10, 0], pos: [0, -0.18, 0] })],
      [1, GUARD]),
    act('SpinAttack', 0.9, // удар с разворота
      [0, GUARD],
      ...[[0.2, -40], [0.35, 60], [0.5, 160], [0.65, 260], [0.8, 350]].map(([t, a]) => [t, over(GUARD, { RightArm: [-20, 0, -86], RightForeArm: [-5, 0, 0], Hips: [0, a, 0], pos: [0, -0.11, 0] })]),
      [1, over(GUARD, { Hips: [0, 360, 0] })]),
    act('DaggerAttack', 0.45, // укол кинжалом
      [0, GUARD],
      [0.3, over(GUARD, { RightArm: [-20, 0, -15], RightForeArm: [-115, 0, 0], Spine: [0, -15, 0] })],
      [0.5, over(GUARD, { RightArm: [-85, 5, -5], RightForeArm: [-3, 0, 0], Spine: [12, 20, 0], RightUpLeg: [-30, 0, 0], RightLeg: [30, 0, 0], pos: [0, -0.08, 0.12] })],
      [1, GUARD]),
    // --- защита ---
    act('Block', 0.8, [0, BLOCK], [0.5, over(BLOCK, { Spine1: [2, 0, 0] })], [1, BLOCK]),
    act('Parry', 0.4, [0, BLOCK], [0.35, over(BLOCK, { RightArm: [-80, -30, -65], RightForeArm: [-40, 0, 0], Spine: [8, -25, 0] })], [1, GUARD]),
    // --- получение урона ---
    act('HitFront', 0.4, [0, GUARD], [0.3, over(GUARD, { Spine: [-20, 0, 0], Head: [-18, 0, 0], LeftArm: [-30, 0, 35], RightArm: [-30, 0, -35], pos: [0, -0.04, -0.1] })], [1, GUARD]),
    act('HitBack', 0.4, [0, GUARD], [0.3, over(GUARD, { Spine: [25, 0, 0], Head: [15, 0, 0], pos: [0, -0.06, 0.1] })], [1, GUARD]),
    act('HitLeft', 0.4, [0, GUARD], [0.3, over(GUARD, { Spine: [0, -10, 22], Head: [0, 0, 15], pos: [-0.08, -0.04, 0] })], [1, GUARD]),
    act('HitRight', 0.4, [0, GUARD], [0.3, over(GUARD, { Spine: [0, 10, -22], Head: [0, 0, -15], pos: [0.08, -0.04, 0] })], [1, GUARD]),
    act('Death', 1.6,
      [0, GUARD],
      [0.25, over(GUARD, { Spine: [-25, 0, 10], Head: [-25, 0, 0], LeftArm: [-40, 0, 50], RightArm: [-40, 0, -50], pos: [0, -0.05, 0] })],
      [0.5, { Spine: [-10, 0, 5], LeftUpLeg: [-60, 0, 0], RightUpLeg: [-40, 0, 0], LeftLeg: [100, 0, 0], RightLeg: [80, 0, 0], LeftArm: [-60, 0, 60], RightArm: [-60, 0, -60], pos: [0, -0.45, 0] }],
      [0.8, { Hips: [-80, 0, 0], Spine: [-5, 0, 0], LeftUpLeg: [-15, 0, 0], RightUpLeg: [-35, 0, 0], LeftLeg: [30, 0, 0], RightLeg: [50, 0, 0], LeftArm: [-150, 0, 40], RightArm: [-150, 0, -40], Head: [-10, 0, 0], pos: [0, -0.8, -0.3] }],
      [1, { Hips: [-90, 0, 0], LeftUpLeg: [-5, 0, 5], RightUpLeg: [-20, 0, -5], LeftLeg: [15, 0, 0], RightLeg: [35, 0, 0], LeftArm: [-160, 0, 50], RightArm: [-170, 0, -45], Head: [0, 20, 0], pos: [0, -0.84, -0.4] }]),
    // --- взаимодействие ---
    act('Interact', 0.8, [0, REST_ARMS], [0.4, over(REST_ARMS, { RightArm: [-70, 10, -5], RightForeArm: [-30, 0, 0], Spine: [8, 0, 0], Head: [10, 0, 0] })], [1, REST_ARMS]),
    act('Pickup', 1.0, [0, REST_ARMS], [0.45, { Spine: [40, 0, 0], Spine2: [15, 0, 0], LeftUpLeg: [-60, 0, 0], RightUpLeg: [-20, 0, 0], LeftLeg: [85, 0, 0], RightLeg: [40, 0, 0], RightArm: [-55, 0, -8], RightForeArm: [-10, 0, 0], LeftArm: [-20, 0, 15], pos: [0, -0.3, 0] }], [1, REST_ARMS]),
    // --- лестница ---
    act('Climb', 0.9,
      [0, { LeftArm: [-170, 0, 12], RightArm: [-120, 0, -12], LeftForeArm: [-20, 0, 0], RightForeArm: [-60, 0, 0], LeftUpLeg: [-20, 0, 0], RightUpLeg: [-65, 0, 0], LeftLeg: [30, 0, 0], RightLeg: [90, 0, 0], Spine: [-5, 0, 0] }],
      [0.5, { LeftArm: [-120, 0, 12], RightArm: [-170, 0, -12], LeftForeArm: [-60, 0, 0], RightForeArm: [-20, 0, 0], LeftUpLeg: [-65, 0, 0], RightUpLeg: [-20, 0, 0], LeftLeg: [90, 0, 0], RightLeg: [30, 0, 0], Spine: [-5, 0, 0] }],
      [1, { LeftArm: [-170, 0, 12], RightArm: [-120, 0, -12], LeftForeArm: [-20, 0, 0], RightForeArm: [-60, 0, 0], LeftUpLeg: [-20, 0, 0], RightUpLeg: [-65, 0, 0], LeftLeg: [30, 0, 0], RightLeg: [90, 0, 0], Spine: [-5, 0, 0] }]),
  ];
  // спуск — та же поза в обратном порядке (голова смотрит вниз)
  const climb = clips.find(c => c.name === 'Climb');
  const down = climb.clone(); down.name = 'ClimbDown';
  for (const t of down.tracks) { const n = t.times.length, sz = t.getValueSize(), v = t.values.slice(); for (let i = 0; i < n; i++) for (let j = 0; j < sz; j++) t.values[i * sz + j] = v[(n - 1 - i) * sz + j]; }
  clips.push(down);
  return clips;
}

// Окна атак: когда «клинок опасен» (hitbox включён) и когда можно продолжить серию (combo window). В долях длины клипа.
export const ATTACKS = {
  LightAttack1: { hit: [0.3, 0.5], combo: [0.45, 0.95], dmg: 12, stamina: 12, next: 'LightAttack2', reach: 1.5 },
  LightAttack2: { hit: [0.3, 0.5], combo: [0.45, 0.95], dmg: 12, stamina: 12, next: 'LightAttack3', reach: 1.5 },
  LightAttack3: { hit: [0.42, 0.6], combo: null, dmg: 18, stamina: 14, next: null, reach: 1.6 },
  HeavyAttack: { hit: [0.5, 0.68], combo: null, dmg: 34, stamina: 28, next: null, reach: 1.8, heavy: true },
  SpinAttack: { hit: [0.2, 0.75], combo: null, dmg: 20, stamina: 30, next: null, reach: 1.9 },
  DaggerAttack: { hit: [0.38, 0.55], combo: null, dmg: 10, stamina: 8, next: null, reach: 1.2 },
};
export const CLIP_NAMES = ['Idle', 'Walk', 'Run', 'Sprint', 'JumpStart', 'JumpLoop', 'JumpFall', 'Land', 'Crouch', 'CrouchWalk', 'Dodge', 'Roll', 'LightAttack1', 'LightAttack2', 'LightAttack3', 'HeavyAttack', 'SpinAttack', 'DaggerAttack', 'Block', 'Parry', 'HitFront', 'HitBack', 'HitLeft', 'HitRight', 'Death', 'Interact', 'Pickup', 'Climb', 'ClimbDown'];
export { BONES };
