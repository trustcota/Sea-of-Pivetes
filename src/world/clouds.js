import * as THREE from 'three';
import { rnd, clamp, c3 } from '../core/math.js';
import { sc, cam, sunL } from '../core/renderer.js';
import { S, WI, ST } from '../core/state.js';
import { CLD } from '../core/palettes.js';

const T = THREE;

// Estado global de oclusão do sol (0 = Sol desobstruído, 1 = Sol completamente bloqueado)
export const cloudState = {
  sunOcclusion: 0,
  shadows: [] // [{ x, z, r, strength }]
};

// Materiais das nuvens
export const cm = new T.MeshStandardMaterial({
  flatShading: true,
  roughness: 0.95,
  metalness: 0.02,
  vertexColors: true,
  transparent: true,
  opacity: 0.96,
  fog: false,
  depthWrite: true
});

// Geometrias de "Puffs" com base plana (Flat-bottomed cumulus) e topos volumétricos
function createPuffGeometry(subdivisions = 1, flatness = 0.28, noiseScale = 0.22) {
  const g = new T.IcosahedronGeometry(1, subdivisions);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const v = new T.Vector3();

  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Base achatada (lifted condensation level)
    if (v.y < 0) {
      v.y *= flatness;
    }
    // Deformação orgânica e fofa nos topos
    const noise = (Math.sin(v.x * 4.2 + v.y * 3.1) * Math.cos(v.z * 3.7 + v.y * 2.5) * 0.5 + 0.5) * noiseScale;
    v.multiplyScalar(1 + noise);
    p.setXYZ(i, v.x, v.y, v.z);

    // Gradiente de cor por vértice (Topo iluminado e base em penumbra atmosférica)
    const heightFactor = clamp((v.y + 0.5) / 1.5, 0, 1);
    const shade = 0.78 + 0.22 * heightFactor;
    col[i * 3] = shade;
    col[i * 3 + 1] = shade * (0.97 + 0.03 * heightFactor);
    col[i * 3 + 2] = shade * (0.95 + 0.05 * heightFactor);
  }

  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const puffGeometries = [
  createPuffGeometry(1, 0.22, 0.2),
  createPuffGeometry(1, 0.3, 0.25),
  createPuffGeometry(2, 0.18, 0.16),
  createPuffGeometry(1, 0.4, 0.3)
];

export const clouds = new T.Group();

// Tipos de formações de nuvem:
// 1. Cumulus Médio (Cúmulo fofo tradicional de bom tempo)
// 2. Cumulus Congestus (Torre majestosa com múltiplos domos)
// 3. Stratus Band (Faixa longa de nuvens alinhadas ao vento)
// 4. Cumulonimbus (Massa densa de tempestade)
function buildCloudCluster(type = 'cumulus') {
  const c = new T.Group();
  const meshes = [];
  let boundRadius = 15;

  if (type === 'cumulus') {
    // 6 a 10 puffs sobrepostos com centro elevado
    const count = 7 + Math.floor(rnd(0, 4));
    boundRadius = count * 2.8;
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1) - 0.5; // -0.5 a 0.5
      const isCenter = Math.abs(t) < 0.25;
      const r = rnd(4.2, 7.0) * (1 - 0.4 * Math.abs(t));
      const geom = puffGeometries[k % puffGeometries.length];
      const m = new T.Mesh(geom, cm);

      const px = t * count * 4.2 + rnd(-1.5, 1.5);
      const py = isCenter ? rnd(1.5, 4.0) : rnd(-0.5, 1.2);
      const pz = rnd(-3.5, 3.5);

      m.position.set(px, py, pz);
      m.scale.set(r * 1.3, r * (isCenter ? 1.0 : 0.65), r * 1.15);
      m.rotation.y = rnd(0, Math.PI * 2);
      m.rotation.z = rnd(-0.08, 0.08);
      c.add(m);
      meshes.push(m);
    }
  } else if (type === 'tower') {
    // Torre de cúmulo com 3 andares de elevação
    const count = 12 + Math.floor(rnd(0, 4));
    boundRadius = 32;
    for (let k = 0; k < count; k++) {
      const tier = k < 6 ? 0 : k < 10 ? 1 : 2; // Base, Meio, Topo
      const r = (tier === 0 ? rnd(6.0, 9.5) : tier === 1 ? rnd(5.0, 7.5) : rnd(4.0, 6.0));
      const geom = puffGeometries[k % puffGeometries.length];
      const m = new T.Mesh(geom, cm);

      const ang = rnd(0, Math.PI * 2);
      const spread = (2 - tier) * 6.5;
      const px = Math.cos(ang) * rnd(0, spread) + rnd(-2, 2);
      const py = tier * 4.8 + rnd(-0.5, 1.5);
      const pz = Math.sin(ang) * rnd(0, spread) + rnd(-2, 2);

      m.position.set(px, py, pz);
      m.scale.set(r * 1.25, r * (tier === 2 ? 1.1 : 0.8), r * 1.25);
      m.rotation.y = rnd(0, Math.PI * 2);
      c.add(m);
      meshes.push(m);
    }
  } else if (type === 'stratus') {
    // Faixa longa esticada horizontalmente
    const count = 8 + Math.floor(rnd(0, 4));
    boundRadius = count * 3.5;
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1) - 0.5;
      const r = rnd(5.5, 8.5);
      const geom = puffGeometries[k % puffGeometries.length];
      const m = new T.Mesh(geom, cm);

      m.position.set(t * 45 + rnd(-2, 2), rnd(-0.5, 0.8), rnd(-4, 4));
      m.scale.set(r * 1.6, r * 0.45, r * 1.2);
      m.rotation.y = rnd(0, Math.PI * 2);
      c.add(m);
      meshes.push(m);
    }
  } else { // Storm Cumulonimbus
    const count = 16 + Math.floor(rnd(0, 6));
    boundRadius = 45;
    for (let k = 0; k < count; k++) {
      const tier = k < 8 ? 0 : k < 14 ? 1 : 2;
      const r = rnd(8.0, 14.0);
      const geom = puffGeometries[k % puffGeometries.length];
      const m = new T.Mesh(geom, cm);

      const px = rnd(-28, 28);
      const py = tier * 6.5 + rnd(-1, 2);
      const pz = rnd(-28, 28);

      m.position.set(px, py, pz);
      m.scale.set(r * 1.4, r * (tier === 0 ? 0.7 : 1.1), r * 1.4);
      m.rotation.y = rnd(0, Math.PI * 2);
      c.add(m);
      meshes.push(m);
    }
  }

  c.userData = {
    type,
    boundRadius,
    meshes,
    baseY: rnd(54, 78),
    vSpeed: rnd(0.85, 1.25),
    baseRot: rnd(0, Math.PI * 2),
    shearFactor: rnd(0.08, 0.22),
    phase: rnd(0, Math.PI * 2)
  };

  return c;
}

// Criação do ecossistema de nuvens (22 nuvens distribuídas em um grande raio)
const NUM_CLOUDS = 22;
const types = ['cumulus', 'cumulus', 'tower', 'cumulus', 'stratus', 'tower', 'cumulus', 'storm'];

for (let i = 0; i < NUM_CLOUDS; i++) {
  const type = types[i % types.length];
  const cloud = buildCloudCluster(type);
  const ang = (i / NUM_CLOUDS) * Math.PI * 2 + rnd(-0.2, 0.2);
  const dist = rnd(50, 320);

  cloud.position.set(Math.cos(ang) * dist, cloud.userData.baseY, Math.sin(ang) * dist);
  clouds.add(cloud);
}

sc.add(clouds);

// Vetores temporários para cálculos de oclusão e vento
const vSunDir = new T.Vector3();
const vCamPos = new T.Vector3();
const vToCloud = new T.Vector3();
const vCloudPos = new T.Vector3();
const vCloudDir = new T.Vector3();
const cldColor = new T.Color();

// Atualiza todas as nuvens: vento, deformação, clima e cálculo de oclusão solar
export function updateCloudsSystem(dt, now, vwx, vwz, wang, wsp, weatherState) {
  const s = weatherState; // 0 = calmo/sol, 0.5 = ondas/nublado, 1 = tempestade
  c3(CLD, s, cldColor);
  cm.color.copy(cldColor);

  // Escala e altitude global com o clima
  clouds.scale.setScalar(1.0 + 0.75 * s);
  const targetAltitudeOffset = -18 * s;
  clouds.position.y += (targetAltitudeOffset - clouds.position.y) * (1 - Math.exp(-dt * 2.0));

  // Pega posição da câmera e direção do Sol
  cam.getWorldPosition(vCamPos);
  if (sunL && sunL.position) {
    vSunDir.copy(sunL.position).normalize();
  } else {
    vSunDir.set(-0.5, 0.7, -0.5).normalize();
  }

  let maxOcclusion = 0;
  cloudState.shadows.length = 0;

  const windSpeedMag = Math.hypot(vwx, vwz);
  const windDirX = windSpeedMag > 0.01 ? vwx / windSpeedMag : Math.sin(wang);
  const windDirZ = windSpeedMag > 0.01 ? vwz / windSpeedMag : Math.cos(wang);

  const wrapRadius = 340;
  const wrapSize = wrapRadius * 2;

  for (let i = 0; i < clouds.children.length; i++) {
    const c = clouds.children[i];
    const u = c.userData;

    // 1. Movimento impulsionado pelo vento e pela velocidade do navio
    const driftMult = u.vSpeed * (0.45 + 0.05 * wsp);
    c.position.x += (vwx * driftMult - ST.svx) * dt;
    c.position.z += (vwz * driftMult - ST.svz) * dt;

    // Respawn / Toroidal Wrap suave ao redor do navio
    if (c.position.x > wrapRadius) c.position.x -= wrapSize;
    else if (c.position.x < -wrapRadius) c.position.x += wrapSize;
    if (c.position.z > wrapRadius) c.position.z -= wrapSize;
    else if (c.position.z < -wrapRadius) c.position.z += wrapSize;

    // 2. Alinhamento e esticamento dinâmico pelo vento (Wind Shear / Stretch)
    const stretchZ = 1.0 + clamp(wsp * 0.035, 0, 0.6);
    const stretchX = 1.0 - clamp(wsp * 0.012, 0, 0.2);
    c.rotation.y = wang + u.baseRot * 0.15;
    c.scale.set(stretchX, 1.0 + (u.type === 'storm' ? s * 0.5 : 0), stretchZ);

    // Oscilação suave dos puffs individuais (billowing effect)
    const billowTime = now * 0.0008 + u.phase;
    for (let k = 0; k < u.meshes.length; k++) {
      const m = u.meshes[k];
      const puffOffset = Math.sin(billowTime + k * 1.3) * 0.35;
      m.position.y += (m.position.y + puffOffset - m.position.y) * 0.02;
    }

    // 3. Projeção de Sombras na Água
    c.getWorldPosition(vCloudPos);
    const shadowDist = vCloudPos.y / Math.max(0.15, vSunDir.y);
    const shadowX = vCloudPos.x - vSunDir.x * shadowDist;
    const shadowZ = vCloudPos.z - vSunDir.z * shadowDist;
    const shadowRadius = u.boundRadius * (1.2 + 0.4 * s);

    cloudState.shadows.push({
      x: shadowX,
      z: shadowZ,
      r: shadowRadius,
      strength: 0.28 + 0.42 * s
    });

    // 4. Detecção de Bloqueio Solar (Sun Occlusion Raycast)
    // Vetor da câmera para a nuvem
    vToCloud.subVectors(vCloudPos, vCamPos);
    const distToCloud = vToCloud.length();

    if (distToCloud > 10) {
      vCloudDir.copy(vToCloud).normalize();
      // Cosseno do ângulo entre a direção para o Sol e a direção para a Nuvem
      const dotSunCloud = vCloudDir.dot(vSunDir);

      if (dotSunCloud > 0.85) {
        // A nuvem está no cone de visão do sol!
        // Calcula distância perpendicular do centro da nuvem até o raio do Sol
        const projLength = vToCloud.dot(vSunDir);
        if (projLength > 0) {
          const perpDist = Math.sqrt(Math.max(0, distToCloud * distToCloud - projLength * projLength));
          const effectiveRadius = u.boundRadius * (1 + 0.5 * s);

          if (perpDist < effectiveRadius) {
            const coverage = clamp(1.0 - (perpDist / effectiveRadius), 0, 1);
            maxOcclusion = Math.max(maxOcclusion, coverage);
          }
        }
      }
    }
  }

  // Interpolação suave do fator de oclusão solar
  cloudState.sunOcclusion += (maxOcclusion - cloudState.sunOcclusion) * (1 - Math.exp(-dt * 3.5));
}
