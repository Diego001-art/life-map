// Общие значения окружения для всех шейдеров: время (для ветра и воды), сила ветра, ночь, дождь.
// Любой материал может подключить ветер через addWind(material).
export const env = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  night: 0,   // 0 — день, 1 — глубокая ночь
  rain: 0,    // 0..1
};

// Покачивание на ветру: верх объекта (по высоте модели) двигается сильнее, чем низ.
export function addWind(material, strength = 0.15, height = 1) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = env.uTime; sh.uniforms.uWind = env.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp;
          float k = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0); k *= k;
          float w = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.21) + 0.5 * sin(uTime * 3.1 + wp.x * 0.9);
          transformed.x += w * ${strength.toFixed(3)} * uWind * k;
          transformed.z += cos(uTime * 1.3 + wp.z * 0.4) * ${(strength * 0.6).toFixed(3)} * uWind * k;
        }`);
  };
  // у каждой силы ветра свой шейдер (иначе three.js переиспользует первый)
  material.customProgramCacheKey = () => `wind-${strength}-${height}`;
  return material;
}
