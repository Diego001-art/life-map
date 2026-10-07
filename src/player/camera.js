// Камера от третьего лица: зажать мышь и двигать — поворот, колесо — приближение.
import * as THREE from 'three';

export function createCamera(dom, terrain) {
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 12000);
  const s = { yaw: 0, pitch: 0.35, dist: 8, drag: false, lx: 0, ly: 0 };
  dom.addEventListener('pointerdown', e => { s.drag = true; s.lx = e.clientX; s.ly = e.clientY; });
  addEventListener('pointerup', () => s.drag = false);
  addEventListener('pointermove', e => {
    if (!s.drag) return;
    s.yaw -= (e.clientX - s.lx) * 0.005;
    s.pitch = Math.min(1.3, Math.max(-0.2, s.pitch + (e.clientY - s.ly) * 0.005));
    s.lx = e.clientX; s.ly = e.clientY;
  });
  dom.addEventListener('wheel', e => { s.dist = Math.min(30, Math.max(3, s.dist + e.deltaY * 0.01)); });
  addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

  function update(target) {
    const t = target.clone().add(new THREE.Vector3(0, 1.8, 0));
    const off = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)).multiplyScalar(s.dist);
    const p = t.clone().add(off);
    p.y = Math.max(p.y, terrain.heightAt(p.x, p.z) + 0.5); // не уходим под землю
    cam.position.lerp(p, 0.25);
    cam.lookAt(t);
  }
  return { camera: cam, update, get yaw() { return s.yaw; } };
}
