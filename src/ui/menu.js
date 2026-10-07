// Главное меню (Esc): имя героя, продолжить, настройки → интерфейс.
// Фон — нарисованные горы (scenery.js), звучит ветер и орёл.
import { t } from '../systems/i18n.js';
import { settings } from '../systems/settings.js';
const $ = (id) => document.getElementById(id);

export function createMenu({ hero, scenery, audio, onStart, onNewHero, onSettingsChange }) {
  const labels = () => {
    $('mNameLbl').textContent = t('namePrompt');
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
    show() {
      labels(); $('menu').classList.remove('hidden'); scenery.start(); audio.menuMusic(true); m.open = true;
      if (!hero.exists) setTimeout(() => $('mName').focus(), 50);
    },
    hide() { $('menu').classList.add('hidden'); $('settingsPanel').classList.add('hidden'); scenery.stop(); audio.menuMusic(false); m.open = false; },
    toggle() { m.open ? (hero.exists && m.hide()) : m.show(); },
    labels,
  };
  $('mStart').onclick = () => {
    if (!hero.exists) { const n = $('mName').value.trim(); if (!n) return $('mName').focus(); hero.create(n); onNewHero(); }
    m.hide(); onStart();
  };
  $('mName').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('mStart').click(); };
  $('mSettings').onclick = () => { labels(); $('settingsPanel').classList.remove('hidden'); };
  $('sClose').onclick = () => $('settingsPanel').classList.add('hidden');
  $('mNew').onclick = () => { if (confirm('Начать заново? Прогресс будет удалён.')) { ['hero', 'quests', 'inventory', 'backpack'].forEach(k => localStorage.removeItem(k)); location.reload(); } };
  return m;
}
