// Языки: русский и даргинский. Тексты лежат в data/i18n/.
const dict = {};
let lang = localStorage.getItem('lang') || 'ru';
export async function loadLang() {
  dict.ru = await (await fetch('data/i18n/ru.json')).json();
  dict.dargin = await (await fetch('data/i18n/dargin.json')).json();
}
export function t(key, vars = {}) {
  let s = (dict[lang] && dict[lang][key]) || dict.ru[key] || key;
  for (const v in vars) s = s.replace(`{${v}}`, vars[v]);
  return s;
}
export function toggleLang() { lang = lang === 'ru' ? 'dargin' : 'ru'; try { localStorage.setItem('lang', lang); } catch {} }
// Для текстов вида { "ru": "...", "dargin": "..." } из data/*.json
export function tr(o) { return (o && (o[lang] || o.ru)) || ''; }
