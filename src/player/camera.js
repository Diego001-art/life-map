// Камера от третьего лица. Щелчок по игре «захватывает» курсор: мышь поворачивает камеру, ЛКМ/ПКМ — бой.
// Esc отпускает курсор. Если захват курсора недоступен — поворот камеры зажатой кнопкой мыши (как раньше).
// Колесо — приближение. Камера плавно следует за героем, не проходит сквозь стены, в бою чуть ближе, при ударе слегка вздрагивает.
// Когда герой идёт, камера сама плавно заходит ему за спину. При беге немного отдаляется.
import * as THREE from 'three';

export function createCamera(dom, terrain, collision) {
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 12000);
  const s = { yaw: 0, pitch: 0.28, dist: 5.5, wantDist: 5.5, drag: false, lx: 0, ly: 0, idle: 0, shake: 0 };
  const target = new THREE.Vector3();
  let allowLock = () => true;
  const locked = () => document.pointerLockElement === dom;
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('pointerdown', e => {
    if (!locked() && allowLock() && dom.requestPointerLock && e.pointerType === 'mouse') { try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} return; }
    if (!locked()) { s.drag = true; s.lx = e.clientX; s.ly = e.clientY; }
  });
  addEventListener('pointerup', () => s.drag = false);
  const look = (dx, dy) => { s.yaw -= dx * 0.0042; s.pitch = Math.min(1.2, Math.max(-0.35, s.pitch + dy * 0.0035)); s.idle = 0; }; // вертикаль ограничена
  addEventListener('pointermove', e => {
    if (locked()) return look(e.movementX, e.movementY);
    if (!s.drag) return;
    look((e.clientX - s.lx) * 1.4, (e.clientY - s.ly) * 1.4);
    s.lx = e.clientX; s.ly = e.clientY;
  });
  dom.addEventListener('wheel', e => { s.wantDist = Math.min(30, Math.max(2.5, s.wantDist + e.deltaY * 0.01)); }, { passive: true });
  addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

  function update(player, dt) {
    const p = player.object.position;
    s.idle += dt;
    // автоматически заходим за спину, если игрок давно не крутил камеру и герой идёт
    if (!locked() && player.moving && player.state.fwd > 0 && !s.drag && s.idle > 1.5) {
      const behind = player.state.yaw + Math.PI;
      let d = ((behind - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2;
      s.yaw += d * Math.min(1, dt * 1.2);
    }
    const run = player.state.moving > 1.1, fight = ['attack', 'block', 'parry'].includes(player.state.mode);
    s.dist += ((s.wantDist * (fight ? 0.85 : 1) + (run ? 1.2 : 0)) - s.dist) * Math.min(1, dt * 4);
    s.shake = Math.max(0, s.shake - dt * 2.5);
    cam.fov += ((run ? 66 : 60) - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
    target.lerp(new THREE.Vector3(p.x, p.y + 1.6, p.z), Math.min(1, dt * 10));
    const off = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)).multiplyScalar(s.dist);
    const want = target.clone().add(off);
    // не проходим сквозь дома: если между героем и камерой стена — камера подъезжает ближе
    // луч от героя к камере: если по пути стена, дерево или склон — камера подъезжает ближе (не проходит сквозь)
    {
      const dir = want.clone().sub(target), L = dir.length(); dir.divideScalar(L);
      for (let d = 0.8; d < L; d += 0.35) {
        const q = target.clone().addScaledVector(dir, d);
        if (collision.blocked(q.x, q.y, q.z) || q.y < terrain.heightAt(q.x, q.z) + 0.3) {
          want.copy(target).addScaledVector(dir, Math.max(1.6, d - 0.45)); want.y += Math.max(0, 2.2 - (d - 0.45)) * 0.7; break;
        }
      }
    }
    want.y = Math.max(want.y, terrain.heightAt(want.x, want.z) + 0.6); // не уходим под землю
    cam.position.lerp(want, Math.min(1, dt * 12));
    cam.lookAt(target);
    if (s.shake > 0) { cam.rotation.x += (Math.random() - 0.5) * s.shake * 0.03; cam.rotation.y += (Math.random() - 0.5) * s.shake * 0.03; }
  }
  return {
    camera: cam, update, get yaw() { return s.yaw; },
    kick(a) { s.shake = Math.min(1, s.shake + a); },          // вздрагивание при ударе
    get locked() { return locked(); },
    unlock() { if (locked()) document.exitPointerLock(); },
    set allowLock(f) { allowLock = f; },
  };
}
