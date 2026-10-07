// Главный файл: собирает игру из частей.
import * as THREE from 'three';
import { makeGeo } from './world/geo.js';
import { createTerrain } from './world/terrain.js';
import { loadOsm, osmRoadLines, createHouses } from './world/houses.js';
import { createRoads } from './world/roads.js';
import { createDetails, createEagle } from './world/nature.js';
import { createAtmosphere } from './world/atmosphere.js';
import { createEffects } from './world/effects.js';
import { createVillage } from './world/village.js';
import { createStream } from './world/water.js';
import { env } from './world/env.js';
import { createVillagers } from './npc/villagers.js';
import { createTrees } from './world/trees.js';
import { createRocks, createBoundary } from './world/rocks.js';
import { createCollision, houseColliders } from './world/collision.js';
import { createPost } from './world/post.js';
import { createCombat, createDummies } from './combat/combat.js';
import { createMountains } from './world/mountains.js';
import { createPlaces } from './world/places.js';
import { sectorOf, createMapView } from './world/sectors.js';
import { createNpcs } from './npc/npcs.js';
import { createPlayer } from './player/player.js';
import { createCamera } from './player/camera.js';
import { createInput } from './player/input.js';
import { createInventory } from './systems/inventory.js';
import { createGathering } from './systems/gathering.js';
import { createQuests } from './systems/quests.js';
import { loadLang, t, tr, toggleLang } from './systems/i18n.js';
import { hud, setHeroName } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createScenery } from './ui/scenery.js';
import { createHero } from './systems/hero.js';
import { settings } from './systems/settings.js';
import { createAudio } from './systems/audio.js';
import { createAnimals } from './world/animals.js';

// Заставка с нарисованными горами крутится, пока грузится мир.
const scenery = createScenery(document.getElementById('scenery'));
scenery.start();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // мягкие тени
renderer.toneMapping = THREE.ACESFilmicToneMapping; // «киношные» цвета
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

const scene = new THREE.Scene();
// Полоса загрузки в процентах.
let pct = 0;
const step = (txt, to) => {
  pct = to ?? pct;
  const f = document.getElementById('ldFill'), x = document.getElementById('ldText');
  if (f) f.style.width = pct + '%';
  if (x) x.textContent = `${txt}… ${pct}%`;
};
const frame = () => new Promise(r => setTimeout(r, 0)); // дать экрану обновиться между тяжёлыми шагами
// пока ждём сервер карт — проценты медленно ползут, чтобы было видно, что игра не зависла
const creep = (from, to) => { pct = from; const id = setInterval(() => { if (pct < to) step('Загрузка карты села', pct + 1); }, 250); return () => clearInterval(id); };
step('Тексты', 5);
await loadLang();
hud.refresh();
const itemsCfg = await (await fetch('data/items.json')).json();

// Мир
step('Рельеф гор', 12); await frame();
const terrain = await createTerrain(scene);
const geo = makeGeo(terrain.lat, terrain.lon);
const stopCreep = creep(18, 40);
const osm = await loadOsm(terrain.lat, terrain.lon);
stopCreep();
step('Пещера, мечеть, родник', 42); await frame();
const places = await createPlaces(scene, terrain);
step('Дороги и тропинки', 50); await frame();
const roads = createRoads(scene, terrain, places, osmRoadLines(osm, geo));
step('Дома села', 60); await frame();
const { houses, clearAround, bake: bakeHouses } = await createHouses(scene, terrain, geo, osm, roads);
if (!osm) hud.toast(t('noHouses'));
for (const pl of Object.values(places)) if (pl.type !== 'stone') clearAround(pl.pos.x, pl.pos.z, pl.type === 'pasture' ? 16 : 9);
step('Небо и горы', 68); await frame();
const atmo = createAtmosphere(scene, renderer, { startTime: 0.29 }); // начинаем ранним утром, в золотом свете
createMountains(scene, terrain);
step('Село: окна, веранды, дым', 71); await frame();
const effects = createEffects(scene);
clearAround(18, 14, 15); // площадь-годекан
const npcs = await createNpcs(scene, terrain);
clearAround(0, 0, 8); // место появления героя
for (const n of npcs.list) clearAround(n.object.position.x, n.object.position.z, 3);
bakeHouses(); // все дома — в несколько больших мешей
const village = createVillage(scene, terrain, houses, roads, effects);
const stream = places.spring ? createStream(scene, terrain, places.spring.pos) : null;
const eagle = createEagle(scene);
step('Деревья, трава, ограды', 74); await frame();
// Коллизии: дома, детали села, места, деревья, камни, ограды. Граница — кольцо скал.
const collision = createCollision({ radiusLimit: 965 });
collision.add(houseColliders(houses));
collision.add(village.colliders);
for (const pl of Object.values(places)) collision.add(pl.colliders);
collision.add(createTrees(scene, terrain, { houses, roads }));
collision.add(createRocks(scene, terrain, { houses, roads }));
collision.add(createDetails(scene, terrain, houses, roads));
createBoundary(scene, terrain);
step('Жители', 82); await frame();
const animals = createAnimals(scene, terrain, places, { houses, square: village.square });
const villagers = createVillagers(scene, terrain, roads, village.square, collision);
// жители — тоже препятствия (слой NPC): сквозь них не пройти
for (const n of npcs.list) collision.addDynamic({ type: 'circle', get x() { return n.object.position.x; }, get z() { return n.object.position.z; }, r: 0.4 });

// Герой и системы
const inventory = createInventory(itemsCfg, () => hud.renderInventory());
hud.inv = inventory;
const audio = createAudio();
// Бой: цели (чучела на площади, Горный змей), хитбоксы, урон
const combat = createCombat(scene, terrain, effects, audio, hud);
const dummies = createDummies(scene, terrain, combat, village.square, collision);
const ladders = Object.values(places).filter(p => p.ladder).map(p => p.ladder);
const platforms = Object.values(places).filter(p => p.platform).map(p => p.platform);
step('Герой', 86); await frame();
const player = await createPlayer({ scene, terrain, collision, inventory, combat, audio, hud, ladders, platforms });
hud.onDress = () => player.dress();
const cam = createCamera(renderer.domElement, terrain, collision);
player.onHitLanded = (a) => cam.kick(a);
const post = createPost(renderer, scene, cam.camera);
const hero = createHero((lvl) => hud.toast(t('levelUp', { lvl })));
setHeroName(() => hero.name);
// Змей: по нему можно бить, но каменную чешую не пробить — нужен меч нартов (сюжет не меняется)
const serpent = places.cave && places.cave.serpent;
let serpentNoted = false;
if (serpent) combat.addTarget({ id: 'serpent', radius: 1.6, active: () => serpent.awake && serpent.object.visible, pos: () => serpent.headWorld(),
  onHit(info) { combat.impact(info.at, 'spark'); cam.kick(0.3); if (!serpentNoted) { serpentNoted = true; hud.toast(t('serpentImmune')); } } });
player.onDeath = () => setTimeout(() => { cam.unlock(); hud.showDeath(() => player.respawn(village.square)); }, 2600);
const events = {
  serpentWakes(silent) { const s = places.cave && places.cave.serpent; if (s) { s.object.visible = true; s.wake(); } if (!silent) { hud.toast(t('serpentWakes')); audio.eagle(); } },
  fastRun(silent) { player.state.speedBoost = 1.5; if (!silent) hud.toast(t('fastRun')); },
};
step('Квесты', 90); await frame();
const quests = await createQuests({
  inventory, places, hero,
  onItems: (take, give) => { player.dress(); if (give) hud.toast(Object.keys(give).map(id => t('received', { item: t('item.' + id) })).join(', ')); },
  onDialog: (lines) => hud.dialog(lines),
  onChange: () => hud.quests(quests),
  onEvent: (name, silent) => events[name] && events[name](silent),
});
quests.restoreEvents();
hud.quests(quests);
const gathering = await createGathering(scene, terrain, houses, places, inventory, (id) => {
  hud.toast(t('picked', { item: t('item.' + id) }));
  hero.addXp(1);
});
const map = createMapView(terrain, houses, () => [
  ...Object.values(places).map(p => ({ x: p.pos.x, z: p.pos.z, color: p.type === 'cave' ? '#e33' : '#fff' })),
  ...npcs.list.map(n => ({ x: n.object.position.x, z: n.object.position.z, color: quests.npcHasTask(n.id) ? '#ffd23a' : '#9cf' })),
], roads);

const menu = createMenu({
  hero, scenery, audio,
  onStart: () => { hud.quests(quests); const f = document.getElementById('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 250); },
  onNewHero: () => { inventory.reset(); inventory.giveStart(); player.dress(); },
  onSettingsChange: () => { hud.applySettings(settings); audio.enable(settings.get('sound')); },
});
hud.applySettings(settings);

let nearNpc = null, talkNpc = null;
const input = createInput({
  Escape: () => { if (performance.now() - lastUnlock < 400) return; menu.toggle(); },
  KeyH: () => hud.toggleHero(hero),
  KeyE: () => {
    if (menu.open || player.dead) return;
    if (hud.inDialog) return hud.nextLine();
    if (player.state.mode === 'climb' || player.startClimb()) return; // лестница
    if (nearNpc) {
      talkNpc = nearNpc; player.act('Interact');
      hud.setSpeaker(tr(nearNpc.name), nearNpc.object);
      if (!quests.talk(nearNpc.id)) hud.dialog([{ ru: 'Салам алейкум!', dargin: '' }]);
      return;
    }
    const r = gathering.pick();
    if (r === 'full') hud.toast(t('full'));
    else if (r === 'ok') player.act('Pickup');
  },
  KeyI: () => hud.toggleInventory(),
  KeyB: () => hud.toggleInventory(),
  KeyJ: () => hud.toggleJournal(),
  KeyM: () => map.toggle(),
});
// Мышь управляет боем, только когда курсор захвачен игрой и не открыто ни одно окно.
input.setEnabled(() => cam.locked && !hud.panelOpen && !menu.open);
cam.allowLock = () => !hud.panelOpen && !menu.open && !document.getElementById('gate');
let wasLocked = false, unlockByUs = false, lastUnlock = -1e9;
const freeMouse = () => { if (cam.locked) { unlockByUs = true; cam.unlock(); } };
document.addEventListener('pointerlockchange', () => {
  if (cam.locked) { wasLocked = true; return; }
  lastUnlock = performance.now();
  if (wasLocked && !unlockByUs && !hud.panelOpen && !menu.open && !player.dead) menu.show(); // Esc отпустил курсор → меню
  wasLocked = false; unlockByUs = false;
});
document.getElementById('langBtn').onclick = () => { toggleLang(); hud.refresh(); menu.labels(); hud.quests(quests); hud.renderInventory(); };
step('Готово', 100);
await new Promise(r => setTimeout(r, 400));
hud.done();
window.game = { player, quests, inventory, hero, npcs, places, roads, atmo, houses, collision, combat, cam }; // для отладки в консоли браузера

// «Нажмите, чтобы войти» — после нажатия браузер разрешает звук.
const gate = document.getElementById('gate');
gate.classList.remove('hidden');
const enter = () => {
  removeEventListener('keydown', enter); gate.removeEventListener('pointerdown', enter);
  gate.remove();
  audio.enable(settings.get('sound')); audio.eagle();
  menu.show();
};
addEventListener('keydown', enter); gate.addEventListener('pointerdown', enter);

const clock = new THREE.Clock();
let time = 0, slow = 0, lastStep = 0;
// Авто-качество: если кадров мало — уменьшаем чёткость, чтобы игра шла плавно.
let fpsAcc = 0, fpsN = 0, quality = 0;
const RATIOS = [Math.min(devicePixelRatio, 1.75), 1.25, 1, 0.8];
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  if (menu.open || document.getElementById('gate')) { input.endFrame(); return; } // пока открыто меню — мир не рисуем (горы рисует заставка)
  env.uTime.value = time;
  if (hud.panelOpen) freeMouse(); // окно открыто — мышь для интерфейса
  if (!hud.inDialog) player.update(dt, input, cam.yaw);
  else talkNpc && (talkNpc.object.userData.talking = true);
  if (!hud.inDialog) talkNpc = null;
  const p = player.object.position;
  cam.update(player, dt);
  atmo.update(dt, p, cam.camera);
  effects.update(dt, env.uWind.value, env.night);
  village.update(dt, p);
  if (stream) stream.update();
  eagle(dt, p);
  if (serpent) serpent.update(dt, player.dead ? null : p,
    (headPos) => { const r = player.takeHit(22, headPos, true); if (r === 'hit') cam.kick(0.6); return r; },
    () => audio.hiss && audio.hiss());
  dummies(dt);
  animals(dt);
  villagers(dt, p);
  nearNpc = npcs.update(p, quests.npcHasTask, time, talkNpc, dt);
  const near = nearNpc ? null : gathering.update(p, dt);
  const ladderNear = player.state.mode === 'loco' && player.nearLadder();
  hud.hint(hud.inDialog ? '' : ladderNear ? t('climb') : nearNpc ? t('talk', { name: tr(nearNpc.name) }) : near ? t('pickup', { item: t('item.' + near.id) }) : '');
  hud.vitals(player.state);
  hud.lockHint(!cam.locked && !hud.panelOpen && !player.dead);
  // шаги: звук на каждом шаге, по дороге — хруст щебня
  const stepN = Math.floor(player.state.walk / Math.PI);
  if (stepN !== lastStep && player.moving && player.state.onGround) { lastStep = stepN; audio.footstep(roads.distToRoad(p.x, p.z) < 0 ? 'road' : 'grass', player.state.moving > 1.1); }
  if ((slow += dt) > 0.2) { // редкие проверки, чтобы не тормозило
    slow = 0;
    quests.update(p);
    hud.quests(quests);
    hud.sector(sectorOf(p.x, p.z));
    hud.house(houses.find(h => Math.hypot(h.center.x - p.x, h.center.z - p.z) < h.radius + 4));
    map.update(p);
    if (!document.getElementById('heroPanel').classList.contains('hidden')) hud.heroPanel(hero);
    // мокрая земля в дождь, звук дождя и костра
    terrain.setWet(env.rain);
    audio.setRain(env.rain);
    const fd = Math.min(...village.fires.map(f => Math.hypot(f.x - p.x, f.z - p.z)));
    audio.setFire(Math.max(0, 1 - fd / 25));
  }
  post.render();
  input.endFrame();
  // авто-качество
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 3) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    // сначала выключаем свечение, потом снижаем чёткость
    if (fps < 38 && quality < RATIOS.length) { quality++; if (quality === 1) post.enabled = false; else renderer.setPixelRatio(RATIOS[quality - 1]); post.resize(); }
  }
});
