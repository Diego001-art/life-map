// Ручей: начинается у родника и стекает вниз по оврагу (по самому крутому спуску), до края карты.
// Вода — полупрозрачная лента с бегущей рябью и бликами (лёгкий шейдер).
import * as THREE from 'three';
import { env } from './env.js';

export function createStream(scene, terrain, start) {
  const pts = [{ x: start.x, z: start.z }];
  let x = start.x, z = start.z, prevA = null;
  const lim = terrain.size / 2 - 8;
  for (let i = 0; i < 500 && Math.abs(x) < lim && Math.abs(z) < lim; i++) {
    let best = null;
    for (let k = 0; k < 16; k++) { // ищем направление вниз; резко не поворачиваем
      const a = k / 16 * Math.PI * 2;
      if (prevA !== null && Math.cos(a - prevA) < 0.2) continue;
      const nx = x + Math.cos(a) * 5, nz = z + Math.sin(a) * 5, h = terrain.heightAt(nx, nz);
      if (!best || h < best.h) best = { a, h, nx, nz };
    }
    if (!best) break;
    prevA = prevA === null ? best.a : Math.atan2(Math.sin(prevA) * 0.4 + Math.sin(best.a) * 0.6, Math.cos(prevA) * 0.4 + Math.cos(best.a) * 0.6);
    x += Math.cos(prevA) * 5; z += Math.sin(prevA) * 5;
    pts.push({ x, z });
  }
  // лента воды
  const verts = [], uvs = [], idx = [];
  let len = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, w = Math.min(3.2, 1.2 + i * 0.02);
    if (i) len += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    for (const s of [-1, 1]) {
      const vx = p.x - dz / L * w * s, vz = p.z + dx / L * w * s;
      verts.push(vx, Math.min(terrain.heightAt(vx, vz), terrain.heightAt(p.x, p.z)) + 0.12, vz);
      uvs.push(s * 0.5 + 0.5, len / 6);
    }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: env.uTime, uNight: { value: 0 } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float flow = vUv.y * 3.0 - uTime * 1.6;
        float r = sin(flow * 6.0 + sin(vUv.x * 9.0 + uTime) * 1.5) * 0.5 + 0.5;
        float r2 = sin(flow * 11.0 - vUv.x * 7.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 deep = vec3(0.16, 0.30, 0.34), light = vec3(0.62, 0.78, 0.82);
        vec3 col = mix(deep, light, r * r2 * 0.6 + (1.0 - edge) * 0.35);
        col += vec3(1.0) * pow(r * r2, 8.0) * 0.6;                // блики
        col *= 1.0 - uNight * 0.7;
        gl_FragColor = vec4(pow(col, vec3(2.2)), 0.55 + (1.0 - edge) * 0.3); // цвета заданы в sRGB → в линейные
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2; scene.add(mesh);
  // камни по берегам
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.45), new THREE.MeshLambertMaterial({ color: '#8b8579', flatShading: true }), 400);
  const o = new THREE.Object3D(); let n = 0;
  for (let i = 0; i < pts.length && n < 400; i++) for (const s of [-1, 1]) {
    if (Math.random() < 0.55) continue;
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], a = Math.atan2(q.z - p.z, q.x - p.x), off = 1.6 + Math.random() * 1.8;
    const x = p.x - Math.sin(a) * off * s, z = p.z + Math.cos(a) * off * s, k = 0.5 + Math.random() * 1.2;
    o.position.set(x, terrain.heightAt(x, z) + 0.1, z); o.rotation.set(Math.random() * 3, Math.random() * 3, 0); o.scale.set(k, k * 0.6, k);
    o.updateMatrix(); rocks.setMatrixAt(n++, o.matrix);
  }
  rocks.count = n; rocks.castShadow = true; scene.add(rocks);
  return { pts, update() { mat.uniforms.uNight.value = env.night; } };
}
