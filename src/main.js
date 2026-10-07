// Главный файл: собирает игру из частей.
import * as THREE from 'three';
import { makeGeo } from './world/geo.js';
import { createTerrain } from './world/terrain.js';
import { createHouses } from './world/houses.js';
import { createSky, createTrees } from './world/nature.js';
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
import { createHero } from './systems/hero.js';
import { settings } from './systems/settings.js';
import { createAudio } from './systems/audio.js';
import { createAnimals } from './world/animals.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
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
// пока ждём сервер карт — проценты медленно ползут, чтобы было видно, что игра не зависла
const creep = (from, to) => { pct = from; const id = setInterval(() => { if (pct < to) step('Загрузка домов села', pct + 1); }, 250); return () => clearInterval(id); };
step('Тексты', 5);
await loadLang();
hud.refresh();

// Мир
step('Рельеф гор', 15);
const terrain = await createTerrain(scene);
const geo = makeGeo(terrain.lat, terrain.lon);
const stopCreep = creep(25, 60);
const { houses, loaded, clearAround } = await createHouses(scene, terrain, geo);
stopCreep();
step('Деревья и горы', 65);
if (!loaded) hud.toast(t('noHouses'));
const sunFollow = createSky(scene);
createMountains(scene, terrain);
step('Пещера, мечеть, родник', 75);
const places = await createPlaces(scene, terrain);
for (const pl of Object.values(places)) if (pl.type !== 'stone') clearAround(pl.pos.x, pl.pos.z, pl.type === 'pasture' ? 16 : 9);
createTrees(scene, terrain, houses);
const npcs = await createNpcs(scene, terrain);
clearAround(0, 0, 8); // место появления героя
for (const n of npcs.list) clearAround(n.object.position.x, n.object.position.z, 3);
const animals = createAnimals(scene, terrain, places);

// Герой и системы
const player = createPlayer(scene, terrain, houses);
const cam = createCamera(renderer.domElement, terrain);
const inventory = createInventory();
const hero = createHero((lvl) => hud.toast(t('levelUp', { lvl })));
setHeroName(() => hero.name);
const audio = createAudio();
const events = {
  serpentWakes(silent) { const s = places.cave && places.cave.serpent; if (s) { s.object.visible = true; s.wake(); } if (!silent) hud.toast(t('serpentWakes')); },
  fastRun(silent) { player.state.speedBoost = 1.5; if (!silent) hud.toast(t('fastRun')); },
};
step('Жители и квесты', 85);
const quests = await createQuests({
  inventory, places, hero,
  onItems: (take, give) => { hud.renderInventory(inventory.all()); if (give) hud.toast(Object.keys(give).map(id => t('received', { item: t('item.' + id) })).join(', ')); },
  onDialog: (lines) => hud.dialog(lines),
  onChange: () => hud.quests(quests),
  onEvent: (name, silent) => events[name] && events[name](silent),
});
quests.restoreEvents();
hud.quests(quests);
const gathering = await createGathering(scene, terrain, houses, places, inventory, (id) => {
  hud.toast(t('picked', { item: t('item.' + id) }));
  hero.addXp(1);
  hud.renderInventory(inventory.all());
});
const map = createMapView(terrain, houses, () => [
  ...Object.values(places).map(p => ({ x: p.pos.x, z: p.pos.z, color: p.type === 'cave' ? '#e33' : '#fff' })),
  ...npcs.list.map(n => ({ x: n.object.position.x, z: n.object.position.z, color: quests.npcHasTask(n.id) ? '#ffd23a' : '#9cf' })),
]);

const menu = createMenu({
  hero,
  onStart: () => { audio.enable(settings.get('sound')); hud.quests(quests); },
  onSettingsChange: () => { hud.applySettings(settings); audio.enable(settings.get('sound')); },
});
hud.applySettings(settings);

let nearNpc = null;
createInput({
  Escape: () => menu.toggle(),
  KeyC: () => hud.toggleHero(hero),
  KeyE: () => {
    if (menu.open) return;
    if (hud.inDialog) return hud.nextLine();
    if (nearNpc) {
      hud.dialog([], tr(nearNpc.name));
      if (!quests.talk(nearNpc.id)) hud.dialog([{ ru: 'Салам алейкум!', dargin: '' }]);
      hud.renderInventory(inventory.all());
      return;
    }
    gathering.pick();
  },
  KeyI: () => hud.toggleInventory(inventory.all()),
  KeyJ: () => hud.toggleJournal(),
  KeyM: () => map.toggle(),
});
const input = createInput({});
document.getElementById('langBtn').onclick = () => { toggleLang(); hud.refresh(); menu.labels(); hud.quests(quests); hud.renderInventory(inventory.all()); };
step('Готово', 100);
await new Promise(r => setTimeout(r, 300));
hud.done();
window.game = { player, quests, inventory, hero, npcs, places }; // для отладки в консоли браузера
menu.show(true);

const clock = new THREE.Clock();
let time = 0, slow = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  if (!hud.inDialog && !menu.open) player.update(dt, input, cam.yaw);
  const p = player.object.position;
  cam.update(p);
  sunFollow(p);
  for (const pl of Object.values(places)) if (pl.serpent) pl.serpent.update(dt);
  animals(dt);
  nearNpc = npcs.update(p, quests.npcHasTask, time);
  const near = nearNpc ? null : gathering.update(p, dt);
  hud.hint(hud.inDialog ? '' : nearNpc ? t('talk', { name: tr(nearNpc.name) }) : near ? t('pickup', { item: t('item.' + near.id) }) : '');
  if ((slow += dt) > 0.2) { // редкие проверки, чтобы не тормозило
    slow = 0;
    quests.update(p);
    hud.quests(quests);
    hud.sector(sectorOf(p.x, p.z));
    hud.house(houses.find(h => Math.hypot(h.center.x - p.x, h.center.z - p.z) < h.radius + 4));
    map.update(p);
    if (!document.getElementById('heroPanel').classList.contains('hidden')) hud.heroPanel(hero);
  }
  renderer.render(scene, cam.camera);
});
