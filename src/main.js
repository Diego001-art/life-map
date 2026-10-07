// Главный файл: собирает игру из частей.
import * as THREE from 'three';
import { makeGeo } from './world/geo.js';
import { createTerrain } from './world/terrain.js';
import { loadOsm, osmRoadLines, createHouses } from './world/houses.js';
import { createRoads } from './world/roads.js';
import { createTrees, createDetails, createEagle } from './world/nature.js';
import { createAtmosphere } from './world/atmosphere.js';
import { createEffects } from './world/effects.js';
import { createVillage } from './world/village.js';
import { createStream } from './world/water.js';
import { env } from './world/env.js';
import { createVillagers } from './npc/villagers.js';
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
const { houses, clearAround } = await createHouses(scene, terrain, geo, osm, roads);
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
const village = createVillage(scene, terrain, houses, roads, effects);
const stream = places.spring ? createStream(scene, terrain, places.spring.pos) : null;
const eagle = createEagle(scene);
step('Деревья, трава, ограды', 74); await frame();
createTrees(scene, terrain, houses, roads);
createDetails(scene, terrain, houses, roads);
step('Жители', 82); await frame();
const animals = createAnimals(scene, terrain, places, { houses, square: village.square });
const villagers = createVillagers(scene, terrain, roads, village.square);

// Герой и системы
const inventory = createInventory(itemsCfg, () => hud.renderInventory());
hud.inv = inventory;
const player = createPlayer(scene, terrain, houses, inventory);
hud.onDress = () => player.dress();
const cam = createCamera(renderer.domElement, terrain, houses);
const hero = createHero((lvl) => hud.toast(t('levelUp', { lvl })));
setHeroName(() => hero.name);
const audio = createAudio();
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
createInput({
  Escape: () => menu.toggle(),
  KeyC: () => hud.toggleHero(hero),
  KeyE: () => {
    if (menu.open) return;
    if (hud.inDialog) return hud.nextLine();
    if (nearNpc) {
      talkNpc = nearNpc;
      hud.setSpeaker(tr(nearNpc.name), nearNpc.object);
      if (!quests.talk(nearNpc.id)) hud.dialog([{ ru: 'Салам алейкум!', dargin: '' }]);
      return;
    }
    if (gathering.pick() === 'full') hud.toast(t('full'));
  },
  KeyI: () => hud.toggleInventory(),
  KeyB: () => hud.toggleInventory(),
  KeyJ: () => hud.toggleJournal(),
  KeyM: () => map.toggle(),
});
const input = createInput({});
document.getElementById('langBtn').onclick = () => { toggleLang(); hud.refresh(); menu.labels(); hud.quests(quests); hud.renderInventory(); };
step('Готово', 100);
await new Promise(r => setTimeout(r, 400));
hud.done();
window.game = { player, quests, inventory, hero, npcs, places, roads, atmo }; // для отладки в консоли браузера

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
  if (menu.open || document.getElementById('gate')) return; // пока открыто меню — мир не рисуем (горы рисует заставка)
  env.uTime.value = time;
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
  for (const pl of Object.values(places)) if (pl.serpent) pl.serpent.update(dt);
  animals(dt);
  villagers(dt, p);
  nearNpc = npcs.update(p, quests.npcHasTask, time, talkNpc, dt);
  const near = nearNpc ? null : gathering.update(p, dt);
  hud.hint(hud.inDialog ? '' : nearNpc ? t('talk', { name: tr(nearNpc.name) }) : near ? t('pickup', { item: t('item.' + near.id) }) : '');
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
    terrain.material.color.setScalar(1 - env.rain * 0.25);
    audio.setRain(env.rain);
    const fd = Math.min(...village.fires.map(f => Math.hypot(f.x - p.x, f.z - p.z)));
    audio.setFire(Math.max(0, 1 - fd / 25));
  }
  renderer.render(scene, cam.camera);
  // авто-качество
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 3) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (fps < 38 && quality < RATIOS.length - 1) { quality++; renderer.setPixelRatio(RATIOS[quality]); }
  }
});
