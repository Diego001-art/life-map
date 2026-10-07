// Ввод: клавиатура и мышь. held(code) — зажата ли кнопка, pressed(code) — нажата в этом кадре (одно срабатывание).
// Кнопки мыши: Mouse0 — левая, Mouse2 — правая. Мышь управляет боем, только когда курсор «захвачен» игрой.
export function createInput(actions = {}, dom) {
  const held = {}, pressed = new Set();
  let enabled = () => true;
  addEventListener('keydown', e => {
    if (e.repeat) { return; }
    held[e.code] = true; pressed.add(e.code);
    if (actions[e.code]) actions[e.code](e);
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  });
  addEventListener('keyup', e => { held[e.code] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });
  if (dom) {
    dom.addEventListener('mousedown', e => { if (!enabled()) return; held['Mouse' + e.button] = true; pressed.add('Mouse' + e.button); });
    addEventListener('mouseup', e => { held['Mouse' + e.button] = false; });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  return {
    get fwd() { return (held.KeyW || held.ArrowUp ? 1 : 0) - (held.KeyS || held.ArrowDown ? 1 : 0); },
    get right() { return (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0); },
    get run() { return !!(held.ShiftLeft || held.ShiftRight); },
    get sprint() { return !!(held.ShiftLeft || held.ShiftRight); },
    get jump() { return !!held.Space; },
    held: (c) => !!held[c],
    pressed: (c) => pressed.has(c),
    endFrame() { pressed.clear(); },
    setEnabled(f) { enabled = f; },
  };
}
