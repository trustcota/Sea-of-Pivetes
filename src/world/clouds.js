import * as THREE from 'three';
import { sc, cam, sky, sunL } from '../core/renderer.js';
import { ST } from '../core/state.js';

const T = THREE;
const wp = new T.Vector3();

// Estado global de oclusão do sol e sombras das nuvens
export const cloudState = {
  sunOcclusion: 0,
  shadows: []
};

// Material vazio para retrocompatibilidade de imports (caso seja usado em outro lugar)
export const cm = new T.MeshStandardMaterial({
  transparent: true,
  opacity: 0
});

// Uniforms do shader de nuvens volumétricas
const uniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new T.Vector3(0, 1, 0) },
  uSunColor: { value: new T.Color(0xffffff) },
  uSkyColor: { value: new T.Color(0x268ee8) },
  uFogColor: { value: new T.Color(0xc2e0ff) },
  uStorm: { value: 0 },
  uSnow: { value: 0 },
  uFogLevel: { value: 0 },
  uCamPos: { value: new T.Vector3() }
};

// Shaders GLSL de altíssima fidelidade e leveza
const vertexShader = `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uFogColor;
  uniform float uStorm;
  uniform float uSnow;
  uniform float uFogLevel;
  uniform vec3 uCamPos;

  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.15 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 V = normalize(vWorldPos - uCamPos);
    if (V.y <= 0.001) {
      discard;
    }

    float H = 82.0;
    float t = (H - uCamPos.y) / V.y;
    if (t > 1500.0) {
      t = 1500.0;
    }

    vec3 P = uCamPos + V * t;
    vec2 uv = P.xz * 0.0045;
    vec2 wind = vec2(uTime * 0.006, uTime * 0.0035);
    uv += wind;

    float density = 0.0;
    float lightTrans = 0.0;
    float stepSize = 4.0;

    for (int i = 0; i < 6; i++) {
      vec2 samplePos = uv + V.xz * (float(i) * stepSize * 0.004);
      float d = fbm(samplePos + sin(uTime * 0.02 + float(i) * 1.5) * 0.04);
      float effectiveStorm = max(uStorm, uSnow * 0.75);
      float layerDensity = smoothstep(0.38 - effectiveStorm * 0.22 - uFogLevel * 0.16, 0.76, d);
      density += layerDensity * (1.0 - density);

      vec2 lightSamplePos = samplePos + uSunDir.xz * 0.07;
      float dLight = fbm(lightSamplePos);
      float shadowDensity = smoothstep(0.38, 0.76, dLight);
      lightTrans += shadowDensity * (1.0 - lightTrans);
    }

    if (density < 0.01) {
      discard;
    }

    float transmittance = exp(-density * 3.5);
    float cosTheta = dot(V, uSunDir);
    float silverLining = pow(max(0.0, cosTheta), 5.0) * 0.75 * (1.0 - uStorm * 0.5);

    vec3 skyBase = uSkyColor;
    vec3 fogBase = uFogColor;

    vec3 cloudShadow = mix(vec3(0.07, 0.11, 0.16), fogBase * 0.35, 1.0 - uStorm);
    vec3 cloudAlbedo = mix(fogBase, vec3(0.95, 0.95, 0.98), 0.45);

    vec3 cloudColor = mix(cloudAlbedo, cloudShadow, density);
    vec3 directLight = uSunColor * (1.0 - lightTrans) * mix(1.0, 0.25, uStorm);
    cloudColor += directLight * 0.5;
    cloudColor += uSunColor * silverLining * mix(1.2, 0.3, uStorm);

    if (uStorm > 0.01) {
      vec3 stormColor = vec3(0.09, 0.12, 0.16);
      cloudColor = mix(cloudColor, stormColor, uStorm * 0.85);
    }

    if (uSnow > 0.01) {
      vec3 snowCloudColor = vec3(0.18, 0.22, 0.28);
      cloudColor = mix(cloudColor, snowCloudColor, uSnow * 0.75);
    }

    if (uFogLevel > 0.01) {
      cloudColor = mix(cloudColor, fogBase * 0.95, uFogLevel * 0.82);
    }

    float horizonFade = clamp((1200.0 - t) / 450.0, 0.0, 1.0);
    float alpha = density * horizonFade * (1.0 - uStorm * 0.12);

    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

// Criação do plano horizontal do céu
const geo = new T.PlaneGeometry(3000, 3000);
geo.rotateX(-Math.PI / 2);

const cloudMaterial = new T.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  transparent: true,
  depthWrite: false,
  fog: false
});

export const clouds = new T.Mesh(geo, cloudMaterial);
clouds.frustumCulled = false;
sc.add(clouds);

// Ruído simples em JS para variação de oclusão solar
const h1 = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
const vn = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return (h1(i, j) * (1 - a) + h1(i + 1, j) * a) * (1 - b) + (h1(i, j + 1) * (1 - a) + h1(i + 1, j + 1) * a) * b;
};

// Atualiza todas as nuvens: vento, deformação, clima e cálculo de oclusão solar
export function updateCloudsSystem(dt, now, vwx, vwz, wang, wsp, weatherState, snowFactor = 0, fogLevel = 0) {
  uniforms.uTime.value += dt;

  // Direção do Sol/Lua (relativa ao navio)
  if (sunL && sunL.position) {
    uniforms.uSunDir.value.set(sunL.position.x - ST.px, sunL.position.y, sunL.position.z - ST.pz).normalize();
  } else {
    uniforms.uSunDir.value.set(-0.5, 0.7, -0.5).normalize();
  }

  // Copia cores do ambiente para iluminar as nuvens de acordo com o ciclo de 24h
  uniforms.uSunColor.value.copy(sunL.color);
  uniforms.uSkyColor.value.copy(sky);
  if (sc.fog && sc.fog.color) {
    uniforms.uFogColor.value.copy(sc.fog.color);
  }
  uniforms.uStorm.value = weatherState;
  uniforms.uSnow.value = snowFactor;
  uniforms.uFogLevel.value = fogLevel;

  // Pega posição do jogador e centra as nuvens sobre ele
  cam.getWorldPosition(wp);
  uniforms.uCamPos.value.copy(wp);
  clouds.position.set(wp.x, 0, wp.z);

  // Variação orgânica e determinística de oclusão do sol conforme nuvens passam por ele
  const driftX = uniforms.uTime.value * 0.007;
  const driftZ = uniforms.uTime.value * 0.004;
  const sampleX = uniforms.uSunDir.value.x * 3.5 + driftX;
  const sampleZ = uniforms.uSunDir.value.z * 3.5 + driftZ;
  
  const baseNoise = vn(sampleX, sampleZ);
  const rawOcc = T.MathUtils.clamp((baseNoise - 0.38) / 0.45, 0, 1);
  const totalWeatherOcc = Math.max(weatherState, snowFactor * 0.7, fogLevel * 0.8);
  cloudState.sunOcclusion = T.MathUtils.lerp(rawOcc * 0.45, 0.98, totalWeatherOcc);

  // Nuvens volumétricas no shader cobrem as sombras diretamente de forma integrada
  cloudState.shadows.length = 0;
}
