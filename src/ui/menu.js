// Главное меню (Esc): имя героя, продолжить, настройки → интерфейс.
import { t } from '../systems/i18n.js';
import { settings } from '../systems/settings.js';
const $ = (id) => document.getElementById(id);

// Фон меню — фото села из assets/menu (меняются по кругу).
const BG = ['selo-1', 'selo-2', 'terrasy', 'selo-3', 'selo-4', 'luga', 'selo-5', 'selo-6', 'selo-7'];
let bgI = 0, bgTimer;
function startBg() { const f = () => { $('menuBg').style.backgroundImage = `url(assets/menu/${BG[bgI++ % BG.length]}.jpg)`; }; f(); bgTimer = setInterval(f, 6000); }

export function createMenu({ hero, onStart, onSettingsChange }) {
  const labels = () => {
    $('mTitle').textContent = t('menuTitle'); $('mNameLbl').textContent = t('namePrompt');
    $('mStart').textContent = hero.exists ? t('continue') : t('start');
    $('mSettings').textContent = t('settings'); $('mNew').textContent = t('newGame');
    $('sTitle').textContent = t('settings'); $('sIface').textContent = t('interface'); $('sClose').textContent = t('close');
    $('newHero').style.display = hero.exists ? 'none' : '';
    $('mNew').style.display = hero.exists ? '' : 'none';
    $('sList').innerHTML = settings.keys.map(k => `<label>${t('set.' + k)}<input type="checkbox" data-k="${k}" ${settings.get(k) ? 'checked' : ''}></label>`).join('');
    $('sList').querySelectorAll('input').forEach(i => i.onchange = () => { settings.set(i.dataset.k, i.checked); onSettingsChange(); });
  };
  const m = {
    open: false,
    show(first) { labels(); $('menu').classList.remove('hidden'); if (first) { $('menuBg').classList.remove('hidden'); startBg(); } m.open = true; if (!hero.exists) setTimeout(() => $('mName').focus(), 50); },
    hide() { $('menu').classList.add('hidden'); $('menuBg').classList.add('hidden'); clearInterval(bgTimer); $('settingsPanel').classList.add('hidden'); m.open = false; },
    toggle() { m.open ? (hero.exists && m.hide()) : m.show(); },
    labels,
  };
  $('mStart').onclick = () => {
    if (!hero.exists) { const n = $('mName').value.trim(); if (!n) return $('mName').focus(); hero.create(n); }
    m.hide(); onStart();
  };
  $('mName').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('mStart').click(); };
  $('mSettings').onclick = () => { labels(); $('settingsPanel').classList.remove('hidden'); };
  $('sClose').onclick = () => $('settingsPanel').classList.add('hidden');
  $('mNew').onclick = () => { if (confirm('Начать заново? Прогресс будет удалён.')) { ['hero', 'quests', 'inventory'].forEach(k => localStorage.removeItem(k)); location.reload(); } };
  return m;
}
