// Герой: модель (rig.js или assets/models/player.glb), анимации (AnimationMixer, clips.js) и машина состояний.
//
// Управление:  WASD — движение · Shift — спринт · Z — шаг/бег · Пробел — прыжок · C — присесть · Q — уклонение/перекат
//              ЛКМ — удар (серия из 3), зажать ЛКМ — тяжёлый удар, ЛКМ в спринте — удар с разворота, R — укол кинжалом
//              ПКМ — блок, ЛКМ во время блока — парирование · E — взаимодействие (лестница, предметы, жители)
//
// Анимации «на месте»: перемещает героя код — поэтому работают коллизии, скорость и физика прыжка.
import * as THREE from 'three';
import { makeMesh } from '../items/models.js';
import { createCharacter, papakha, dagger, daggerSheath, saber } from '../character/rig.js';
import { createAnimator, tryLoadGLB } from '../character/controller.js';
import { ATTACKS } from '../character/clips.js';
import { pbr } from '../world/textures.js';

function backpack() {
  const g = new THREE.Group(), leather = pbr('cloth', { color: '#5a4430', roughness: 0.8 });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.12), leather); g.add(bag);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.11, 0.135), pbr('cloth', { color: '#3e2e20' })); flap.position.y = 0.11; g.add(flap);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), pbr('wool', { color: '#3a2a20' })); roll.rotation.z = Math.PI / 2; roll.position.set(0, -0.18, 0.02); g.add(roll);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const angDiff = (a, b) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return d; };

export async function createPlayer({ scene, terrain, collision, inventory, combat, audio, hud, ladders = [], platforms = [] }) {
  const g = new THREE.Group(); g.name = 'Player'; scene.add(g);
  const glb = await tryLoadGLB();
  let rig = null, anim = null, model = null;
  const weapons = {}; // main, dagger — объекты оружия

  // --- модель и экипировка ---
  function dress() {
    const eq = inventory.equipped, defs = inventory.defs;
    const prevState = anim && anim.current;
    if (model) g.remove(model);
    if (glb) { // настоящая модель из файла: свои кости и материалы; оружие крепится к сокетам
      model = glb.scene;
      rig = { bones: {}, sockets: {}, setExpression() {}, updateFace() {}, clothFollow() {}, grip() {} };
      model.traverse(o => { if (o.isBone || o.type === 'Object3D' || o.isGroup) rig.bones[o.name] = o; if (o.isMesh) o.castShadow = true; });
      for (const [name, bone, pos] of [['RightHandSocket', 'RightHand', [0, -0.075, 0.015]], ['BeltWeaponSocket', 'Spine', [0.04, -0.02, 0.135]], ['BackWeaponSocket', 'Spine2', [0.02, 0, -0.16]]]) {
        let sk = model.getObjectByName(name);
        if (!sk && rig.bones[bone]) { sk = new THREE.Group(); sk.name = name; sk.position.fromArray(pos); rig.bones[bone].add(sk); }
        rig.sockets[name] = sk;
      }
      anim = anim || createAnimator(model, glb.animations);
    } else {
      const coat = eq.body ? defs[eq.body].color : null;
      rig = createCharacter({ coat, papakha: null, boots: eq.feet ? defs[eq.feet].color : '#3a2e24' });
      model = rig.root;
      if (eq.head) { const d = defs[eq.head]; model.getObjectByName('HeadSocket').add(d.shape === 'papakha' ? papakha(d.id === 'papakha' ? '#e8e2d6' : d.color) : makeMesh(d.shape, d.color)); }
      if (eq.neck) { const d = defs[eq.neck], m = makeMesh(d.shape, d.color); m.scale.setScalar(0.5); m.position.set(0, 0.08, 0.165); rig.bones.Spine2.add(m); }
      if (eq.belt) { const d = defs[eq.belt], m = makeMesh(d.shape, d.color); m.scale.setScalar(0.6); m.rotation.z = 0.6; m.position.set(-0.18, 0.0, 0.05); rig.bones.Spine.add(m); }
      const pack = backpack(); pack.position.set(0.05, 0.02, -0.2); rig.bones.Spine2.add(pack);
      anim = createAnimator(model);
    }
    // оружие
    weapons.main = null; weapons.dagger = null;
    if (eq.hand) { const d = defs[eq.hand]; weapons.main = d.shape === 'saber' ? saber() : makeMesh(d.shape, d.color); weapons.main.userData.kind = d.shape; }
    if (eq.dagger) { weapons.dagger = dagger(); if (rig.sockets.BeltWeaponSocket) rig.sockets.BeltWeaponSocket.add(daggerSheath()); }
    placeWeapons();
    g.add(model);
    if (prevState) anim.play(prevState === 'Death' ? 'Death' : 'Idle', { fade: 0 });
    else anim.play('Idle', { fade: 0 });
  }
  // Где оружие: в руке (обнажено) или в ножнах/за спиной.
  function placeWeapons() {
    const S = rig.sockets;
    if (weapons.main) {
      if (st.drawn && !st.useDagger) attach(weapons.main, S.RightHandSocket, weapons.main.userData.kind === 'staff' ? [0, -0.75, 0] : [0, 0, 0]);
      else if (weapons.main.userData.kind === 'staff') attach(weapons.main, S.BackWeaponSocket, [0, -0.85, 0]);
      else attach(weapons.main, S.BackWeaponSocket, [0, -0.45, 0]);
    }
    if (weapons.dagger) {
      if (st.drawn && (st.useDagger || !weapons.main)) attach(weapons.dagger, S.RightHandSocket, [0, 0, 0]);
      else attach(weapons.dagger, S.BeltWeaponSocket, [0, 0.0, 0]);
    }
    rig.grip('Right', st.drawn ? 1 : 0.25);
  }
  function attach(obj, socket, pos) { if (!socket) return; if (obj.parent !== socket) socket.add(obj); obj.position.fromArray(pos); }

  // --- состояние ---
  const st = {
    mode: 'loco', vel: new THREE.Vector3(), onGround: true, yaw: 0, time: 0, walk: 0, moving: 0, fwd: 0, speedBoost: 1,
    hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, staminaWait: 0,
    crouch: false, walkMode: false, drawn: false, sheathTimer: 0, useDagger: false,
    attack: null, hitSet: new Set(), queued: false, lmbDown: 0, heavyStarted: false,
    iframes: 0, dodgeCd: 0, modeTime: 0, blockTime: 0, climb: null, deadTime: 0, airTime: 0,
  };
  dress();
  g.position.set(0, terrain.heightAt(0, 0), 0);
  let onHitLanded = () => {}, onDeath = () => {};

  const groundAt = (x, z, y) => { // земля или площадка (верх башни), если герой над ней
    let h = terrain.heightAt(x, z);
    for (const p of platforms) if (Math.hypot(x - p.x, z - p.z) < p.r && y >= p.y - 0.7) h = Math.max(h, p.y);
    return h;
  };
  const setMode = (m) => { st.mode = m; st.modeTime = 0; };
  const spend = (n) => { if (st.stamina < n * 0.5) return false; st.stamina = Math.max(0, st.stamina - n); st.staminaWait = 0.8; return true; };
  const draw = () => { st.drawn = true; st.sheathTimer = 8; placeWeapons(); };

  function startAttack(name) {
    const a = ATTACKS[name];
    if (!spend(a.stamina)) return false;
    st.useDagger = name === 'DaggerAttack';
    draw();
    st.attack = name; st.hitSet.clear(); st.queued = false;
    setMode('attack');
    anim.play(name, { restart: true });
    rig.setExpression('anger');
    audio.swing && audio.swing(a.heavy);
    return true;
  }

  function update(dt, input, camYaw) {
    st.time += dt; st.modeTime += dt; st.fwd = input.fwd;
    st.iframes = Math.max(0, st.iframes - dt); st.dodgeCd = Math.max(0, st.dodgeCd - dt);
    const camFace = camYaw + Math.PI; // направление «куда смотрит камера» для героя
    // выносливость
    st.staminaWait -= dt;
    if (st.staminaWait <= 0 && st.mode !== 'block') st.stamina = Math.min(st.maxStamina, st.stamina + 24 * dt);
    if (st.drawn && st.mode === 'loco' && (st.sheathTimer -= dt) <= 0) { st.drawn = false; st.useDagger = false; placeWeapons(); }

    // направление движения по камере
    const dir = new THREE.Vector3(input.right, 0, -input.fwd);
    const wantsMove = dir.lengthSq() > 0;
    if (wantsMove) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
    if (input.pressed('KeyC')) st.crouch = !st.crouch;
    if (input.pressed('KeyZ')) st.walkMode = !st.walkMode;

    let speed = 0, move = null;
    const M = st.mode;
    if (M === 'dead') {
      st.deadTime += dt;
    } else if (M === 'climb') {
      updateClimb(dt, input);
    } else {
      // ---- ввод боя ----
      const lmbPress = input.pressed('Mouse0'), rmb = input.held('Mouse2');
      if (input.held('Mouse0')) st.lmbDown += dt; else st.lmbDown = 0;
      if (M === 'loco' || M === 'block') {
        if (M === 'block' && lmbPress && spend(10)) { setMode('parry'); anim.play('Parry', { restart: true }); }
        else if (input.pressed('KeyR') && (weapons.dagger || !weapons.main)) startAttack('DaggerAttack');
        else if (lmbPress && st.onGround && input.sprint && wantsMove && st.stamina > 20) startAttack('SpinAttack');
        else if (lmbPress && st.onGround) { st.heavyStarted = false; startAttack('LightAttack1'); }
        else if (rmb && st.onGround && M === 'loco') { setMode('block'); st.blockTime = 0; draw(); anim.play('Block'); rig.setExpression('focus'); }
      }
      if (M === 'attack') {
        const a = ATTACKS[st.attack], p = anim.progress();
        // зажатая кнопка в начале первого удара превращается в тяжёлый удар
        if (st.attack === 'LightAttack1' && st.lmbDown > 0.25 && !st.heavyStarted && p < 0.65) { st.heavyStarted = true; st.stamina += ATTACKS.LightAttack1.stamina; startAttack('HeavyAttack'); }
        if (lmbPress) st.queued = true;
        if (st.queued && a.combo && p >= a.combo[0] && p <= a.combo[1] && a.next) startAttack(a.next);
        // хитбокс только в фазе удара
        if (st.mode === 'attack') {
          const A = ATTACKS[st.attack], pp = anim.progress();
          if (pp >= A.hit[0] && pp <= A.hit[1]) {
            const fwd = new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw));
            const center = g.position.clone().add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(fwd, A.reach * 0.65);
            const reach = (st.useDagger || !weapons.main) ? A.reach * 0.8 : A.reach;
            if (combat.sweep(center, reach * 0.55, { dmg: A.dmg, heavy: !!A.heavy, from: g.position.clone(), attack: st.attack }, st.hitSet)) onHitLanded(A.heavy ? 0.5 : 0.25);
          }
          if (pp >= 1) { setMode('loco'); st.attack = null; rig.setExpression('neutral'); }
        }
        speed = st.mode === 'attack' ? 0.6 : 0; // во время удара почти стоим (небольшой шаг вперёд)
        st.yaw = lerpAngle(st.yaw, camFace, Math.min(1, dt * 12)); // бьём туда, куда смотрит камера
        if (speed) move = new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw));
      } else if (M === 'parry') {
        st.yaw = lerpAngle(st.yaw, camFace, Math.min(1, dt * 12));
        if (anim.progress() >= 1) { setMode(input.held('Mouse2') ? 'block' : 'loco'); if (st.mode === 'block') anim.play('Block'); }
      } else if (M === 'block') {
        st.blockTime += dt; st.staminaWait = 0.4;
        st.yaw = lerpAngle(st.yaw, camFace, Math.min(1, dt * 10));
        if (!rmb) { setMode('loco'); rig.setExpression('neutral'); }
        else if (wantsMove) { speed = 1.3; move = dir; }
      } else if (M === 'dodge' || M === 'roll') {
        const dur = M === 'roll' ? 0.7 : 0.45, sp = M === 'roll' ? 6.2 : 5.5;
        const k = 1 - st.modeTime / dur;
        speed = sp * Math.max(0.15, k); move = st.dodgeDir;
        if (st.modeTime >= dur) setMode('loco');
      } else if (M === 'hit') {
        if (st.modeTime >= st.hitDur) { setMode('loco'); rig.setExpression('neutral'); }
      } else if (M === 'interact' || M === 'pickup') {
        if (st.modeTime >= (M === 'pickup' ? 0.9 : 0.7)) setMode('loco');
      } else if (M === 'land') {
        if (st.modeTime >= 0.22) setMode('loco');
        if (wantsMove) { speed = 2; move = dir; }
      }

      // ---- уклонение / перекат ----
      if (input.pressed('KeyQ') && (st.mode === 'loco' || st.mode === 'block') && st.onGround && st.dodgeCd <= 0) {
        const roll = wantsMove && input.fwd > 0 && !input.right;
        if (spend(roll ? 30 : 22)) {
          st.dodgeDir = wantsMove ? dir.clone() : new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
          setMode(roll ? 'roll' : 'dodge'); st.iframes = roll ? 0.5 : 0.35; st.dodgeCd = 0.9;
          if (roll) st.yaw = Math.atan2(st.dodgeDir.x, st.dodgeDir.z);
          anim.play(roll ? 'Roll' : 'Dodge', { restart: true });
        }
      }
      // ---- передвижение ----
      if (st.mode === 'loco' || st.mode === 'air') {
        if (wantsMove) {
          const sprint = input.sprint && !st.crouch && st.stamina > 1 && input.fwd >= 0;
          speed = st.crouch ? 1.6 : sprint ? 7.2 : st.walkMode ? 1.8 : 4.2;
          speed *= st.speedBoost;
          if (sprint) { st.stamina = Math.max(0, st.stamina - 14 * dt); st.staminaWait = 0.6; }
          move = dir;
          st.yaw = lerpAngle(st.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 10)); // плавный поворот
        }
        // прыжок
        if (input.pressed('Space') && st.onGround && st.mode === 'loco' && spend(10)) {
          st.vel.y = 5.6; st.onGround = false; setMode('air'); st.airTime = 0; st.crouch = false;
          anim.play('JumpStart', { restart: true });
        }
      }
    }

    // ---- перемещение с коллизиями ----
    if (move && speed > 0) {
      const p = collision.resolve({ x: g.position.x + move.x * speed * dt, z: g.position.z + move.z * speed * dt }, 0.4, g.position.y);
      g.position.x = p.x; g.position.z = p.z;
      for (const pl of platforms) if (g.position.y > pl.y - 0.5 && Math.hypot(g.position.x - pl.x, g.position.z - pl.z) > pl.r - 0.5) { // парапет на башне
        const k = (pl.r - 0.5) / Math.hypot(g.position.x - pl.x, g.position.z - pl.z); g.position.x = pl.x + (g.position.x - pl.x) * k; g.position.z = pl.z + (g.position.z - pl.z) * k;
      }
      st.walk += dt * speed * 2.1;
    }
    g.rotation.y = st.yaw;

    // ---- гравитация, земля, прыжок/падение/приземление ----
    if (st.mode !== 'climb') {
      const ground = groundAt(g.position.x, g.position.z, g.position.y);
      st.vel.y -= 18 * dt;
      g.position.y += st.vel.y * dt;
      if (g.position.y <= ground) { // на земле — не проваливаемся
        const fallSpeed = -st.vel.y;
        g.position.y = ground; st.vel.y = 0;
        if (!st.onGround) {
          st.onGround = true;
          if (st.mode === 'air') { setMode('land'); anim.play('Land', { restart: true }); if (fallSpeed > 14) takeDamage((fallSpeed - 14) * 6, null); }
        }
      } else if (g.position.y > ground + 0.35 && st.onGround && st.mode !== 'roll') { // шагнул с обрыва
        st.onGround = false; if (st.mode === 'loco') { setMode('air'); st.airTime = 0; }
      }
      if (st.mode === 'air') {
        st.airTime += dt;
        if (st.airTime > 0.15) anim.play(st.vel.y > 0 ? 'JumpLoop' : 'JumpFall');
      }
    }

    // ---- выбор анимации передвижения ----
    const moving = !!move && speed > 0.1;
    st.moving += ((moving ? Math.min(1.5, speed / 4.2) : 0) - st.moving) * Math.min(1, dt * 8);
    if (st.mode === 'loco') {
      let clip = 'Idle';
      if (st.crouch) clip = moving ? 'CrouchWalk' : 'Crouch';
      else if (moving) clip = speed > 6 ? 'Sprint' : speed > 3 ? 'Run' : 'Walk';
      anim.play(clip, { speed: clip === 'Walk' || clip === 'CrouchWalk' ? Math.max(0.6, speed / 1.8) : 1 });
    }
    anim.update(dt);
    rig.clothFollow(); rig.updateFace(dt, st.time);
  }

  // ---- лестница ----
  function nearLadder() {
    for (const l of ladders) {
      const atBottom = Math.hypot(g.position.x - l.x, g.position.z - l.z) < 1.6 && Math.abs(g.position.y - l.y0) < 1.5;
      const atTop = Math.hypot(g.position.x - l.topX, g.position.z - l.topZ) < 1.6 && Math.abs(g.position.y - l.y1) < 0.8;
      if (atBottom || atTop) return { l, atTop };
    }
    return null;
  }
  function startClimb() {
    const n = nearLadder(); if (!n || st.mode !== 'loco') return false;
    st.climb = { l: n.l, y: n.atTop ? n.l.y1 - 0.2 : g.position.y };
    setMode('climb'); st.drawn = false; placeWeapons();
    g.position.set(n.l.x, st.climb.y, n.l.z); st.yaw = n.l.yaw;
    anim.play(n.atTop ? 'ClimbDown' : 'Climb', { restart: true });
    return true;
  }
  function updateClimb(dt, input) {
    const c = st.climb, l = c.l, v = input.fwd * 1.6;
    c.y += v * dt;
    anim.play(v < 0 ? 'ClimbDown' : 'Climb', { speed: v === 0 ? 0 : 1 });
    if (c.y >= l.y1) { g.position.set(l.topX, l.y1, l.topZ); st.onGround = true; st.vel.y = 0; setMode('loco'); return; } // вылез наверх
    if (c.y <= l.y0) { g.position.set(l.x, l.y0, l.z); setMode('loco'); return; }                                      // спустился
    g.position.set(l.x, c.y, l.z); g.rotation.y = st.yaw = l.yaw;
  }

  // ---- урон ----
  function takeDamage(n, from) {
    if (st.mode === 'dead') return;
    st.hp = Math.max(0, st.hp - n);
    audio.hurt && audio.hurt();
    if (st.hp <= 0) die();
  }
  // Удар по герою: возвращает 'dodged' | 'parry' | 'blocked' | 'hit'
  function takeHit(dmg, fromPos, heavy = false) {
    if (st.mode === 'dead') return 'none';
    if (st.iframes > 0) { hud.toast && hud.toast('Уклонение!'); return 'dodged'; }
    const toAttacker = Math.atan2(fromPos.x - g.position.x, fromPos.z - g.position.z);
    const rel = angDiff(st.yaw, toAttacker); // 0 — враг впереди
    const facing = Math.abs(rel) < 1.3;
    if (facing && (st.mode === 'parry' || (st.mode === 'block' && st.blockTime < 0.2))) { // парирование
      combat.impact(g.position.clone().add(new THREE.Vector3(Math.sin(st.yaw) * 0.6, 1.4, Math.cos(st.yaw) * 0.6)), 'spark');
      hud.toast && hud.toast('Парирование!'); return 'parry';
    }
    if (facing && st.mode === 'block') {
      st.stamina -= 18; st.staminaWait = 1;
      combat.impact(g.position.clone().add(new THREE.Vector3(Math.sin(st.yaw) * 0.6, 1.4, Math.cos(st.yaw) * 0.6)), 'spark');
      if (st.stamina > 0) { takeDamage(dmg * 0.15); return 'blocked'; }
      st.stamina = 0; // защита пробита
    }
    takeDamage(dmg);
    if (st.mode === 'dead') return 'hit';
    const clip = Math.abs(rel) < Math.PI / 4 ? 'HitFront' : Math.abs(rel) > Math.PI * 3 / 4 ? 'HitBack' : rel > 0 ? 'HitLeft' : 'HitRight';
    setMode('hit'); st.hitDur = heavy ? 0.75 : 0.4; // сильный удар — оглушение (stagger)
    anim.play(clip, { restart: true, speed: heavy ? 0.55 : 1 });
    rig.setExpression('anger');
    return 'hit';
  }
  function die() {
    setMode('dead'); st.deadTime = 0; st.drawn = false;
    anim.play('Death', { restart: true });
    onDeath();
  }
  function respawn(pos) {
    st.hp = st.maxHp; st.stamina = st.maxStamina; setMode('loco'); st.vel.set(0, 0, 0);
    g.position.set(pos.x, terrain.heightAt(pos.x, pos.z), pos.z);
    anim.play('Idle', { fade: 0, restart: true }); rig.setExpression('neutral');
  }
  function act(name) { // взаимодействие / подбор предмета
    if (st.mode !== 'loco') return;
    setMode(name === 'Pickup' ? 'pickup' : 'interact'); anim.play(name, { restart: true });
  }

  return {
    object: g, update, state: st, dress, takeHit, takeDamage, respawn, act, nearLadder, startClimb,
    get moving() { return st.moving > 0.2; },
    get dead() { return st.mode === 'dead'; },
    get busy() { return !['loco', 'land'].includes(st.mode); },
    set onHitLanded(f) { onHitLanded = f; }, set onDeath(f) { onDeath = f; },
    get bones() { return rig.bones; },
    usingGLB: !!glb,
  };
}
