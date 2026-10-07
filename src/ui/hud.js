// Надписи и окна на экране: подсказки, сумка, диалоги, квесты, сектор.
import { t, tr } from '../systems/i18n.js';
import { iconFor, portraitFor } from '../items/icons.js';
import { EQUIP_SLOTS } from '../systems/inventory.js';
const $ = (id) => document.getElementById(id);
let toastTimer, lines = [], speaker = '', portrait = '', heroName = () => '', typing = null, full = '';
export const setHeroName = (f) => heroName = f;
export const hud = {
  refresh() { $('help').textContent = t('help'); $('langBtn').textContent = t('lang'); $('invTitle').textContent = t('inventory'); $('eqTitle').textContent = t('equipment'); $('jTitle').textContent = t('journal'); },
  hintsOn: true,
  hint(text) { if (!this.hintsOn) text = ''; $('hint').style.display = text ? 'block' : 'none'; $('hint').textContent = text || ''; },
  house(h) { $('houseInfo').style.display = h ? 'block' : 'none'; if (h) $('houseInfo').textContent = h.name || `${t('house')} №${h.id}`; },
  sector(s) { $('sector').textContent = `${t('sector')} ${s}`; },
  toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); },
  // Рюкзак: ячейки с картинками; клик по вещи — надеть, по надетой — снять.
  inv: null, onDress: () => {},
  toggleInventory() { $('inventory').classList.toggle('hidden'); this.renderInventory(); },
  renderInventory() {
    const inv = this.inv; if (!inv || $('inventory').classList.contains('hidden')) return;
    const cell = (id, n, extra = '') => {
      const d = inv.defs[id];
      return `<img src="${iconFor(d)}" alt="">${n > 1 ? `<span class="n">${n}</span>` : ''}${extra}`;
    };
    $('invGrid').innerHTML = inv.slots.map((s, i) => `<div class="slot" data-i="${i}" title="${s ? t('item.' + s.id) : ''}">${s ? cell(s.id, s.n) : ''}</div>`).join('');
    $('equipList').innerHTML = EQUIP_SLOTS.map(k => { const id = inv.equipped[k]; return `<div class="slot equip" data-eq="${k}" title="${id ? t('item.' + id) : t('slot.' + k)}">${id ? cell(id, 1) : ''}<span class="lbl">${t('slot.' + k)}</span></div>`; }).join('');
    $('invInfo').textContent = t('invHint');
    const info = (e) => { const el = e.target.closest('.slot'); if (el && el.title) $('invInfo').textContent = el.title; };
    for (const el of $('inventory').querySelectorAll('.slot')) {
      el.onmouseenter = info;
      el.onclick = () => {
        if (el.dataset.eq) inv.unequip(el.dataset.eq); else inv.useSlot(+el.dataset.i);
        this.onDress(); this.renderInventory();
      };
    }
  },
  // Диалоги: очередь реплик, E — следующая.
  // Текст печатается плавно; E во время печати — сразу показать всю реплику.
  setSpeaker(who, npcObject) { speaker = who; portrait = portraitFor(npcObject); },
  dialog(list) { if (!list || !list.length) return; const was = lines.length; lines.push(...list); if (!was) this._show(); },
  get inDialog() { return !$('dialog').classList.contains('hidden'); },
  nextLine() { if (typing) { clearInterval(typing); typing = null; $('dlgBody').textContent = full; return; } lines.shift(); this._show(); },
  _show() {
    clearInterval(typing); typing = null;
    if (!lines.length) { $('dialog').classList.add('hidden'); speaker = ''; portrait = ''; return; }
    $('dialog').classList.remove('hidden');
    $('dlgPortrait').style.display = portrait ? '' : 'none'; if (portrait) $('dlgPortrait').src = portrait;
    $('dlgText').innerHTML = (speaker ? `<b>${speaker}</b>` : '') + '<span id="dlgBody"></span>';
    full = tr(lines[0]).replaceAll('{name}', heroName());
    let i = 0;
    typing = setInterval(() => { i += 2; $('dlgBody').textContent = full.slice(0, i); if (i >= full.length) { clearInterval(typing); typing = null; } }, 22);
    $('dlgNext').textContent = t('next');
  },
  quests(q) {
    const active = q.list.filter(x => !q.done(x));
    // на экране — только одна цель (главный квест первым), остальные в журнале (J)
    const main = active.find(x => x.main) || active[0];
    $('questTrack').innerHTML = main ? `<b>${tr(main.title)}</b><span>◆ ${tr(q.current(main).text)} ${q.progress(main)}</span>${active.length > 1 ? `<small>+${active.length - 1} · J</small>` : ''}` : '';
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
  vitals(st) {
    $('hpFill').style.width = (st.hp / st.maxHp * 100) + '%';
    $('stFill').style.width = (st.stamina / st.maxStamina * 100) + '%';
  },
  lockHint(show) { $('lockHint').style.display = show ? 'block' : 'none'; $('lockHint').textContent = t('clickToPlay'); },
  showDeath(onRespawn) {
    $('deathTitle').textContent = t('died'); $('respawnBtn').textContent = t('respawn');
    $('deathScreen').classList.remove('hidden');
    $('respawnBtn').onclick = () => { $('deathScreen').classList.add('hidden'); onRespawn(); };
  },
  // Открыто ли какое-нибудь окно (тогда мышь нужна для интерфейса, а не для боя)
  get panelOpen() { return ['inventory', 'journal', 'heroPanel', 'bigmap', 'settingsPanel'].some(id => !$(id).classList.contains('hidden')) || this.inDialog || !$('deathScreen').classList.contains('hidden'); },
  done() { $('loading').remove(); },
};
