// Квесты из data/quests.json. Прогресс сохраняется в браузере.
export async function createQuests({ inventory, places, hero, onDialog, onChange, onEvent, onItems }) {
  const cfg = await (await fetch('data/quests.json')).json();
  let st = {};
  try { st = JSON.parse(localStorage.getItem('quests')) || {}; } catch {}
  const save = () => { try { localStorage.setItem('quests', JSON.stringify(st)); } catch {} };
  const step = (q) => q.steps[st[q.id] || 0];

  function advance(q) {
    const s = step(q);
    if (s.take) for (const id in s.take) inventory.remove(id, s.take[id]);
    if (s.give) for (const id in s.give) inventory.add(id, s.give[id]);
    if (s.take || s.give) onItems(s.take, s.give);
    if (s.xp) hero.addXp(s.xp);
    if (s.reward) onEvent(s.reward);
    st[q.id] = (st[q.id] || 0) + 1; save();
    const next = step(q);
    if (next && next.type === 'event') { onEvent(next.event); if (next.dialog) onDialog(next.dialog); advance(q); return; }
    if (next && next.type === 'collect' && next.dialog) onDialog(next.dialog);
    onChange();
  }
  const hasItems = (s) => !s.take || Object.entries(s.take).every(([id, n]) => (inventory.all()[id] || 0) >= n);

  return {
    list: cfg.quests,
    current: (q) => step(q),
    done: (q) => !step(q),
    progress(q) { const s = step(q); return s && s.type === 'collect' ? `${Math.min(inventory.all()[s.item] || 0, s.count)}/${s.count}` : ''; },
    // Есть ли у жителя дело для героя (для «!» над головой).
    npcHasTask(id) { return cfg.quests.some(q => { const s = step(q); return s && s.type === 'talk' && s.npc === id; }); },
    talk(id) {
      for (const q of cfg.quests) {
        const s = step(q);
        if (s && s.type === 'talk' && s.npc === id && hasItems(s)) { onDialog(s.dialog || []); advance(q); return true; }
      }
      return false;
    },
    update(p) {
      for (const q of cfg.quests) {
        const s = step(q);
        if (!s) continue;
        if (s.type === 'collect' && (inventory.all()[s.item] || 0) >= s.count) {
          // предметы забираются позже (take), здесь только переход дальше
          advance(q);
        } else if (s.type === 'reach' && places[s.place] && places[s.place].pos.distanceTo(p) < s.radius && hasItems(s)) {
          if (s.dialog) onDialog(s.dialog);
          advance(q);
        }
      }
    },
    restoreEvents() { // после перезагрузки: если змей уже проснулся — показать его
      for (const q of cfg.quests) q.steps.slice(0, st[q.id] || 0).forEach(s => s.type === 'event' && onEvent(s.event, true));
      for (const q of cfg.quests) q.steps.slice(0, st[q.id] || 0).forEach(s => s.reward && onEvent(s.reward, true));
    },
  };
}
