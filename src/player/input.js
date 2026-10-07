// Клавиатура. Сюда же потом добавятся атака мечом, блок и т.д.
export function createInput(actions) {
  const k = {};
  addEventListener('keydown', e => {
    k[e.code] = true;
    if (actions[e.code]) actions[e.code]();
  });
  addEventListener('keyup', e => k[e.code] = false);
  return {
    get fwd() { return (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); },
    get right() { return (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); },
    get run() { return !!(k.ShiftLeft || k.ShiftRight); },
    get jump() { return !!k.Space; },
  };
}
