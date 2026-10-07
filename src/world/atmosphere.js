// Небо, солнце, луна, смена дня и ночи, туман и погода (ясно, облачно, туман, дождь).
// Один «купол» неба рисует градиент, солнце, облака и звёзды — это один вызов отрисовки.
import * as THREE from 'three';
import { env } from './env.js';

const C = (h) => new THREE.Color(h);
// Палитры для разного времени суток (небо, свет, туман).
const PAL = {
  day:   { zen: C('#3f72b5'), hor: C('#bcd3e6'), sun: C('#fff1dc'), sunI: 2.3, sky: C('#cfe0f5'), gnd: C('#5a5040'), hemI: 1.0, fog: C('#b9cde0') },
  gold:  { zen: C('#3f4c7a'), hor: C('#f0a870'), sun: C('#ffad62'), sunI: 1.7, sky: C('#f0c8a0'), gnd: C('#4a3a30'), hemI: 0.75, fog: C('#d9a985') },
  night: { zen: C('#0a1430'), hor: C('#2a3c62'), sun: C('#a9c0f0'), sunI: 0.9, sky: C('#5a70a8'), gnd: C('#22283a'), hemI: 1.1, fog: C('#26365a') },
};
const WEATHER = {
  clear:  { cloud: 0.35, dark: 0,    fogNear: 250, fogFar: 6500, rain: 0, wind: 1 },
  cloudy: { cloud: 0.75, dark: 0.35, fogNear: 200, fogFar: 4500, rain: 0, wind: 1.6 },
  fog:    { cloud: 0.6,  dark: 0.3,  fogNear: 10,  fogFar: 420,  rain: 0, wind: 0.6 },
  rain:   { cloud: 0.95, dark: 0.55, fogNear: 40,  fogFar: 1300, rain: 1, wind: 2.2 },
};

export function createAtmosphere(scene, renderer, opts = {}) {
  // --- купол неба ---
  const skyU = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uZen: { value: C('#3f72b5') }, uHor: { value: C('#bcd3e6') },
    uSunCol: { value: C('#fff') }, uCloud: { value: 0.35 }, uDark: { value: 0 }, uNight: { value: 0 }, uTime: env.uTime,
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uSun, uZen, uHor, uSunCol; uniform float uCloud, uDark, uNight, uTime; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHor, uZen, pow(h, 0.55));
        float sd = max(dot(d, uSun), 0.0);
        col += uSunCol * (pow(sd, 6.0) * 0.25 + pow(sd, 60.0) * 0.4) * (1.0 - uDark);   // сияние вокруг солнца
        col += uSunCol * smoothstep(0.9993, 0.9997, sd) * 3.0 * (1.0 - uDark);            // диск солнца / луны
        // звёзды ночью
        vec2 sp = d.xz / (d.y + 0.2) * 220.0;
        float st = step(0.9965, hash(floor(sp))) * smoothstep(0.1, 0.4, h) * uNight * (1.0 - uCloud);
        col += vec3(st);
        // облака: проекция на «потолок», медленно плывут
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(uv) * 0.75 + fbm(uv * 3.0 + 7.0) * 0.25;
          float c = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.35, n) * smoothstep(0.0, 0.18, d.y);
          vec3 cc = mix(vec3(0.92,0.93,0.95), uSunCol, 0.35) * (1.0 - uNight * 0.85) * (1.0 - uDark * 0.55);
          cc = mix(cc, cc * 0.65, smoothstep(0.5, 1.0, n));   // тёмные «брюшки» облаков
          col = mix(col, cc, c * 0.92);
        }
        col = mix(col, col * vec3(0.55,0.58,0.62), uDark * 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);

  // --- свет ---
  const hemi = new THREE.HemisphereLight('#dfefff', '#5a5040', 1);
  const sun = new THREE.DirectionalLight('#fff2d8', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 500 });
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog('#b9cde0', 250, 6500);
  scene.background = null;

  // --- дождь: штрихи вокруг камеры, один вызов отрисовки ---
  const RN = 2200, rpos = new Float32Array(RN * 6), rspd = new Float32Array(RN);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 70, y = Math.random() * 40, z = (Math.random() - 0.5) * 70; rpos.set([x, y, z, x, y - 0.7, z], i * 6); rspd[i] = 22 + Math.random() * 8; }
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rmat = new THREE.LineBasicMaterial({ color: '#aab8c8', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rgeo, rmat); rain.frustumCulled = false; scene.add(rain);

  // --- время и погода ---
  const st = { t: opts.startTime ?? 0.31, dayLen: opts.dayLength ?? 1440, weather: 'clear', w: { ...WEATHER.clear }, next: 150 };
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const blend = (a, b, k, key) => tmp.copy(a[key]).lerp(b[key], k);
  const pickWeather = () => { const r = Math.random(); return r < 0.5 ? 'clear' : r < 0.75 ? 'cloudy' : r < 0.87 ? 'fog' : 'rain'; };

  function update(dt, center, camera) {
    st.t = (st.t + dt / st.dayLen) % 1;
    if ((st.next -= dt) <= 0) { st.weather = pickWeather(); st.next = 180 + Math.random() * 240; }
    // плавный переход погоды
    const target = WEATHER[st.weather], k = Math.min(1, dt * 0.08);
    for (const key in target) st.w[key] += (target[key] - st.w[key]) * k;
    const w = st.w;

    // положение солнца: восход на востоке (+x), закат на западе
    const a = (st.t - 0.25) * Math.PI * 2, elev = Math.sin(a);
    const sunDir = new THREE.Vector3(Math.cos(a), elev * 0.85, 0.35).normalize();
    const dayK = THREE.MathUtils.smoothstep(elev, -0.12, 0.2);         // 0 ночь → 1 день
    const goldK = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.05, 0.35); // закат/рассвет
    const P = (key) => { blend(PAL.night, PAL.day, dayK, key); tmp2.copy(tmp).lerp(PAL.gold[key], goldK * 0.75 * (dayK > 0.05 ? 1 : 0.3)); return tmp2.clone(); };
    const lightDir = dayK > 0.02 ? sunDir : sunDir.clone().negate().setY(Math.abs(sunDir.y) * 0.8 + 0.25).normalize(); // ночью светит луна
    env.night = 1 - dayK;

    skyU.uSun.value.copy(dayK > 0.02 ? sunDir : lightDir);
    skyU.uZen.value.copy(P('zen')); skyU.uHor.value.copy(P('hor')); skyU.uSunCol.value.copy(P('sun'));
    skyU.uCloud.value = w.cloud; skyU.uDark.value = w.dark; skyU.uNight.value = env.night;
    sky.position.copy(camera.position);

    const darkK = 1 - w.dark * 0.6;
    sun.color.copy(P('sun')); sun.intensity = THREE.MathUtils.lerp(PAL.night.sunI, THREE.MathUtils.lerp(PAL.day.sunI, PAL.gold.sunI, goldK), dayK) * darkK * (1 - w.cloud * 0.25);
    hemi.color.copy(P('sky')); hemi.groundColor.copy(P('gnd')); hemi.intensity = THREE.MathUtils.lerp(PAL.night.hemI, PAL.day.hemI, dayK) * (1 - w.dark * 0.3);
    sun.position.copy(center).addScaledVector(lightDir, 200); sun.target.position.copy(center);

    const fogCol = P('fog').lerp(C('#8a95a0'), w.dark * 0.6);
    scene.fog.color.copy(fogCol); scene.fog.near = w.fogNear; scene.fog.far = w.fogFar;

    // дождь
    env.rain = w.rain; env.uWind.value = w.wind;
    rmat.opacity = w.rain * 0.45; rain.visible = w.rain > 0.02;
    if (rain.visible) {
      rain.position.set(camera.position.x, camera.position.y - 15, camera.position.z);
      for (let i = 0; i < RN; i++) {
        let y = rpos[i * 6 + 1] - rspd[i] * dt; if (y < 0) y += 40;
        rpos[i * 6 + 1] = y; rpos[i * 6 + 4] = y - 0.7;
      }
      rgeo.attributes.position.needsUpdate = true;
    }
  }
  return {
    update,
    get time() { return st.t; },
    get weather() { return st.weather; },
    setWeather(name, instant) { if (WEATHER[name]) { st.weather = name; st.next = 300; if (instant) Object.assign(st.w, WEATHER[name]); } },
    setTime(t) { st.t = t; },
  };
}
