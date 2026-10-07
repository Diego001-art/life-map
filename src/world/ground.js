// Материал земли: трава, земля, скала и снег смешиваются сами —
// по крутизне склона (крутое → скала), по высоте (высоко → снег) и по пятнам шума (проплешины земли).
// Переходы мягкие, без видимых квадратов. Используется для рельефа села и для гор вокруг.
import * as THREE from 'three';
import { tex } from './textures.js';

export function groundMaterial({ scale = 0.25, snowLine = 1e9, rockLine = 1e9, terraces = false, wet = { value: 0 } } = {}) {
  const T = { grass: tex('grass'), dirt: tex('dirt'), rock: tex('rock'), snow: tex('snow') };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, vertexColors: true });
  const uniforms = {
    tGrass: { value: T.grass.map }, tDirt: { value: T.dirt.map }, tRock: { value: T.rock.map }, tSnow: { value: T.snow.map },
    nGrass: { value: T.grass.normalMap }, nRock: { value: T.rock.normalMap }, nDirt: { value: T.dirt.normalMap },
    uScale: { value: scale }, uSnow: { value: snowLine }, uRockLine: { value: rockLine }, uWet: wet,
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWp; varying vec3 vWn;
        uniform sampler2D tGrass, tDirt, tRock, tSnow, nGrass, nRock, nDirt;
        uniform float uScale, uSnow, uRockLine, uWet;
        vec4 wG, nB; float wR, wS, wD;
        // две выборки с разным масштабом и поворотом — чтобы не было видно повторяющихся квадратов
        vec3 tri(sampler2D t, vec2 p) { vec3 a = texture2D(t, p).rgb, b = texture2D(t, mat2(0.8,-0.6,0.6,0.8) * p * 0.37 + 0.31).rgb; return mix(a, b, 0.35); }`)
      .replace('#include <map_fragment>', `
        vec2 p = vWp.xz * uScale;
        float slope = 1.0 - clamp(vWn.y, 0.0, 1.0);
        float big = texture2D(tDirt, vWp.xz * 0.0021).r;                    // крупные пятна
        float nz = texture2D(tGrass, vWp.xz * 0.011).g;
        wR = smoothstep(0.22, 0.42, slope + (nz - 0.5) * 0.12) + smoothstep(uRockLine, uRockLine + 220.0, vWp.y + nz * 120.0);
        wR = clamp(wR, 0.0, 1.0);
        wS = smoothstep(uSnow - 60.0, uSnow + 40.0, vWp.y + (nz - 0.5) * 220.0) * (1.0 - smoothstep(0.45, 0.65, slope));
        wD = smoothstep(0.52, 0.66, big) * (1.0 - wR) * 0.85;
        vec3 col = tri(tGrass, p) * vColor.rgb * 2.5;
        col = mix(col, tri(tDirt, p * 1.3), wD);
        col = mix(col, tri(tRock, p * 0.6), wR);
        col = mix(col, tri(tSnow, p * 0.5), wS);
        ${terraces ? `
        float far = smoothstep(280.0, 420.0, length(vWp.xz));
        float band = smoothstep(0.0, 0.12, fract(vWp.y / 3.2)) * (1.0 - smoothstep(0.75, 0.9, fract(vWp.y / 3.2)));
        col *= mix(1.0, mix(0.8, 1.04, band), far * (1.0 - wR));` : ''}
        col *= 1.0 - uWet * 0.3 * (1.0 - wS);  // мокрая земля в дождь темнее
        diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.95, 0.7, wS) - uWet * 0.35 * (1.0 - wS);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nm = mix(texture2D(nGrass, p).xyz, texture2D(nDirt, p * 1.3).xyz, wD);
          nm = mix(nm, texture2D(nRock, p * 0.6).xyz, wR) * 2.0 - 1.0;
          vec3 tX = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz), tZ = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          normal = normalize(normal + (tX * nm.x - tZ * nm.y) * (0.25 + wR * 0.5)); // трава — едва заметный рельеф, скала — сильный
        }`);
  };
  mat.customProgramCacheKey = () => `ground-${scale}-${snowLine}-${rockLine}-${terraces}`;
  return mat;
}
