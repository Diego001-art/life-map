// Надписи и окна на экране: подсказки, сумка, диалоги, квесты, сектор.
import { t, tr } from '../systems/i18n.js';
const $ = (id) => document.getElementById(id);
let toastTimer, lines = [], speaker = '', heroName = () => '';
export const setHeroName = (f) => heroName = f;
export const hud = {
  refresh() { $('help').textContent = t('help'); $('langBtn').textContent = t('lang'); $('invTitle').textContent = t('inventory'); $('jTitle').textContent = t('journal'); },
  hintsOn: true,
  hint(text) { if (!this.hintsOn) text = ''; $('hint').style.display = text ? 'block' : 'none'; $('hint').textContent = text || ''; },
  house(h) { $('houseInfo').style.display = h ? 'block' : 'none'; if (h) $('houseInfo').textContent = h.name || `${t('house')} №${h.id}`; },
  sector(s) { $('sector').textContent = `${t('sector')} ${s}`; },
  toast(text) { $('toast').textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').textContent = '', 2500); },
  toggleInventory(items) { $('inventory').classList.toggle('hidden'); this.renderInventory(items); },
  renderInventory(items) {
    const rows = Object.entries(items).map(([id, n]) => `<div class="row"><span>${t('item.' + id)}</span><b>${n}</b></div>`);
    $('invList').innerHTML = rows.join('') || t('empty');
  },
  // Диалоги: очередь реплик, E — следующая.
  dialog(list, who = '') { lines.push(...list); if (who) speaker = who; this._show(); },
  get inDialog() { return !$('dialog').classList.contains('hidden'); },
  nextLine() { lines.shift(); this._show(); },
  _show() {
    if (!lines.length) { $('dialog').classList.add('hidden'); speaker = ''; return; }
    $('dialog').classList.remove('hidden');
    $('dlgText').innerHTML = (speaker ? `<b>${speaker}:</b> ` : '') + tr(lines[0]).replaceAll('{name}', heroName());
    $('dlgNext').textContent = t('next');
  },
  quests(q) {
    const active = q.list.filter(x => !q.done(x));
    $('questTrack').innerHTML = active.map(x => `<b>${tr(x.title)}</b>: ${tr(q.current(x).text)} ${q.progress(x)}`).join('<br>');
    $('jList').innerHTML = q.list.map(x => `<div class="q ${q.done(x) ? 'done' : ''}"><b>${tr(x.title)}</b>${x.main ? ' (' + t('main') + ')' : ''}<br>${q.done(x) ? '✔' : '→ ' + tr(q.current(x).text) + ' ' + q.progress(x)}</div>`).join('');
  },
  toggleJournal() { $('journal').classList.toggle('hidden'); },
  // Применить настройки интерфейса (видимость панелей).
  applySettings(st) {
    $('help').style.display = st.get('help') ? '' : 'none';
    $('questTrack').style.display = st.get('quests') ? '' : 'none';
    $('minimap').style.display = $('sector').style.display = st.get('minimap') ? '' : 'none';
    this.hintsOn = st.get('hints');
  },
  heroPanel(h) {
    const d = h.data; if (!d) return;
    $('hName').textContent = d.name;
    $('hStats').innerHTML = `${t('level')}: <b>${d.level}</b><br>${t('xp')}: ${d.xp} / ${h.need()}<div class="bar"><i style="width:${d.xp / h.need() * 100}%"></i></div>${t('strength')}: ${d.strength}<br>${t('stamina')}: ${d.stamina}`;
  },
  toggleHero(h) { $('heroPanel').classList.toggle('hidden'); this.heroPanel(h); },
  done() { $('loading').remove(); },
};
