// Камера от третьего лица: зажать мышь (любую кнопку) и двигать — поворот, колесо — приближение.
// Когда герой идёт, камера сама плавно заходит ему за спину. При беге немного отдаляется.
import * as THREE from 'three';

export function createCamera(dom, terrain, houses = []) {
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 12000);
  const s = { yaw: 0, pitch: 0.32, dist: 7, wantDist: 7, drag: false, lx: 0, ly: 0, idle: 0 };
  const target = new THREE.Vector3();
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('pointerdown', e => { s.drag = true; s.lx = e.clientX; s.ly = e.clientY; });
  addEventListener('pointerup', () => s.drag = false);
  addEventListener('pointermove', e => {
    if (!s.drag) return;
    s.yaw -= (e.clientX - s.lx) * 0.006;
    s.pitch = Math.min(1.25, Math.max(-0.15, s.pitch + (e.clientY - s.ly) * 0.005));
    s.lx = e.clientX; s.ly = e.clientY; s.idle = 0;
  });
  dom.addEventListener('wheel', e => { s.wantDist = Math.min(30, Math.max(2.5, s.wantDist + e.deltaY * 0.01)); }, { passive: true });
  addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

  // точка внутри дома? (по повёрнутому прямоугольнику дома, с запасом 0.4 м)
  function inside(h, q) {
    if (q.y > h.top + 2.5) return false;
    const b = h.box; if (!b) return Math.hypot(h.center.x - q.x, h.center.z - q.z) < h.radius * 0.7;
    const dx = q.x - b.cx, dz = q.z - b.cz, c = Math.cos(-b.ang), s = Math.sin(-b.ang);
    return Math.abs(dx * c - dz * s) < b.w / 2 + 0.4 && Math.abs(dx * s + dz * c) < b.d / 2 + 0.4;
  }
  function update(player, dt) {
    const p = player.object.position;
    s.idle += dt;
    // автоматически заходим за спину, если игрок давно не крутил камеру и герой идёт
    if (player.moving && player.state.fwd > 0 && !s.drag && s.idle > 1.5) {
      const behind = player.state.yaw + Math.PI;
      let d = ((behind - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2;
      s.yaw += d * Math.min(1, dt * 1.2);
    }
    const run = player.state.moving > 1.1;
    s.dist += ((s.wantDist + (run ? 1.5 : 0)) - s.dist) * Math.min(1, dt * 4);
    cam.fov += ((run ? 66 : 60) - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
    target.lerp(new THREE.Vector3(p.x, p.y + 1.7, p.z), Math.min(1, dt * 10));
    const off = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)).multiplyScalar(s.dist);
    const want = target.clone().add(off);
    // не проходим сквозь дома: если между героем и камерой стена — камера подъезжает ближе
    const near = houses.filter(h => Math.abs(h.center.x - p.x) < 45 && Math.abs(h.center.z - p.z) < 45);
    if (near.length) {
      const dir = want.clone().sub(target), L = dir.length(); dir.divideScalar(L);
      for (let d = 0.8; d < L; d += 0.4) {
        const q = target.clone().addScaledVector(dir, d);
        if (near.some(h => inside(h, q))) { want.copy(target).addScaledVector(dir, Math.max(1.8, d - 0.5)); want.y += Math.max(0, 2.2 - (d - 0.5)) * 0.8; break; }
      }
    }
    want.y = Math.max(want.y, terrain.heightAt(want.x, want.z) + 0.6); // не уходим под землю
    cam.position.lerp(want, Math.min(1, dt * 12));
    cam.lookAt(target);
  }
  return { camera: cam, update, get yaw() { return s.yaw; } };
}
