// Герой: имя, уровень, опыт, характеристики. Сохраняется в браузере.
// Позже: очки навыков, снаряжение, и отправка на сервер для онлайна.
export function createHero(onLevelUp) {
  let h = null;
  try { h = JSON.parse(localStorage.getItem('hero')); } catch {}
  const save = () => { try { localStorage.setItem('hero', JSON.stringify(h)); } catch {} };
  const need = (lvl) => 100 * lvl; // сколько опыта нужно до следующего уровня
  return {
    get exists() { return !!h; },
    create(name) { h = { name, level: 1, xp: 0, strength: 5, stamina: 5 }; save(); },
    get data() { return h; },
    get name() { return h ? h.name : ''; },
    need: () => need(h.level),
    addXp(n) {
      h.xp += n;
      while (h.xp >= need(h.level)) { h.xp -= need(h.level); h.level++; h.strength += 2; h.stamina += 2; onLevelUp(h.level); }
      save();
    },
  };
}
