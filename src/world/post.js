// Постобработка кадра:
//  - свечение (bloom) — только у очень ярких вещей: огонь, окна и фонари ночью, солнце. Обычные предметы не светятся;
//  - лёгкая «киношная» цветокоррекция: холодные тени, тёплый свет, чуть контраста;
//  - почти незаметная виньетка (затемнение по краям).
// На слабых компьютерах отключается автоматически (см. авто-качество в main.js).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.22 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 cool = c.rgb * vec3(0.94, 0.99, 1.07), warm = c.rgb * vec3(1.05, 1.0, 0.92);
      c.rgb = mix(cool, warm, smoothstep(0.05, 0.8, l));          // тени холоднее, свет теплее
      c.rgb = mix(vec3(l), c.rgb, 0.92);                           // чуть приглушить насыщенность
      float v = smoothstep(0.85, 0.2, distance(vUv, vec2(0.5)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);                       // виньетка
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.5, 1.4);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(Grade));
  composer.addPass(new OutputPass());
  let on = true;
  const resize = () => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth / 2, innerHeight / 2); };
  addEventListener('resize', resize); resize();
  return {
    render() { if (on) composer.render(); else renderer.render(scene, camera); },
    set enabled(v) { on = v; },
    get enabled() { return on; },
    resize,
  };
}
