// Частицы: дым (из труб и костров) и огонь. Пул частиц переиспользуется — один вызов отрисовки на тип.
import * as THREE from 'three';

function makeSystem(scene, max, { additive, color, grow, rise, life, size, drift }) {
  const pos = new Float32Array(max * 3), age = new Float32Array(max).fill(1e9), lifeA = new Float32Array(max), vel = new Float32Array(max * 3);
  const aAge = new Float32Array(max), aSize = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAge', new THREE.BufferAttribute(aAge, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) }, uGrow: { value: grow }, uScale: { value: innerHeight / 2 }, uDark: { value: 0 } }]),
    vertexShader: `attribute float aAge; attribute float aSize; uniform float uGrow; uniform float uScale; varying float vA;
      #include <fog_pars_vertex>
      void main(){ vec4 mvPosition = modelViewMatrix * vec4(position,1.0); vA = aAge;
        gl_PointSize = aSize * (1.0 + aAge * uGrow) * uScale / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uDark; varying float vA;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r) * (1.0 - vA) * smoothstep(0.0, 0.1, vA);
        vec3 col = ${additive ? 'mix(vec3(1.0,0.9,0.5), uColor, vA)' : 'uColor * (1.0 - uDark * 0.6)'};
        gl_FragColor = vec4(col, a * ${additive ? '0.9' : '0.16'}); // дым — полупрозрачные клубы
        #include <fog_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let cursor = 0;
  return {
    mat,
    emit(x, y, z, n = 1) {
      for (let k = 0; k < n; k++) {
        const i = cursor = (cursor + 1) % max;
        pos[i * 3] = x + (Math.random() - 0.5) * 0.3; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
        vel[i * 3] = (Math.random() - 0.5) * drift; vel[i * 3 + 1] = rise * (0.7 + Math.random() * 0.6); vel[i * 3 + 2] = (Math.random() - 0.5) * drift;
        age[i] = 0; lifeA[i] = life * (0.7 + Math.random() * 0.6); aSize[i] = size * (0.7 + Math.random() * 0.6);
      }
    },
    update(dt, wind) {
      for (let i = 0; i < max; i++) {
        if (age[i] > lifeA[i]) { aAge[i] = 1; continue; }
        age[i] += dt; aAge[i] = Math.min(1, age[i] / lifeA[i]);
        pos[i * 3] += (vel[i * 3] + wind * 0.6 * aAge[i]) * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aAge.needsUpdate = geo.attributes.aSize.needsUpdate = true;
    },
  };
}

export function createEffects(scene) {
  const smoke = makeSystem(scene, 900, { additive: false, color: '#b8b6b2', grow: 5, rise: 1.1, life: 8, size: 2.2, drift: 0.4 });
  const fire = makeSystem(scene, 260, { additive: true, color: '#ff5a1a', grow: -0.6, rise: 1.6, life: 0.9, size: 0.9, drift: 0.25 });
  return { smoke, fire, update(dt, wind, night) { smoke.mat.uniforms.uDark.value = night; smoke.update(dt, wind); fire.update(dt, wind * 0.2); } };
}
