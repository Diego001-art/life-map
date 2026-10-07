// Настройки (Esc → Настройки). Сохраняются в браузере.
const defaults = { help: true, quests: true, minimap: true, hints: true, sound: true };
let s = { ...defaults };
try { Object.assign(s, JSON.parse(localStorage.getItem('settings'))); } catch {}
export const settings = {
  get: (k) => s[k],
  set(k, v) { s[k] = v; try { localStorage.setItem('settings', JSON.stringify(s)); } catch {} },
  keys: Object.keys(defaults),
};
