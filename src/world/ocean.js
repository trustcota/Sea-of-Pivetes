import * as THREE from 'three';
import { rnd, clamp, c3 } from '../core/math.js';
import { DEEP, SHAL, CREST, FOAM } from '../core/palettes.js';
import { sc, sunL, cam } from '../core/renderer.js';
import { SEAS, ST } from '../core/state.js';
import { ILHAS } from './archipelago.js';
import { cloudState } from './clouds.js';

const T = THREE;
const cD = new T.Color(), cS = new T.Color(), cCr = new T.Color(), q = new T.Color();
const sunDir = new T.Vector3();
const vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3();
const vCB = new T.Vector3(), vAB = new T.Vector3(), norm = new T.Vector3();
const viewDir = new T.Vector3(), halfVec = new T.Vector3(), facePos = new T.Vector3();

// Oceano: malha alta resolução com flat shading facetado estilizado
const N = 120, SZ = 260, cl = SZ / N, bx = [], bz = [], ix = [];
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { bx.push((i / N - .5) * SZ); bz.push((j / N - .5) * SZ); }
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; ix.push(a, c, b, b, c, d); }
const NV = bx.length, P = new Float32Array(NV * 3), pos = new Float32Array(ix.length * 3), col = new Float32Array(ix.length * 3), jit = [];
for (let f = 0; f < ix.length / 3; f++) jit.push(rnd(.988, 1.012));
const og = new T.BufferGeometry();
og.setAttribute('position', new T.BufferAttribute(pos, 3));
og.setAttribute('color', new T.BufferAttribute(col, 3));
export const sea = new T.Mesh(og, new T.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: .08,
  metalness: .12,
  transparent: true,
  opacity: .92,
  depthWrite: true
}));
sea.frustumCulled = false;
sc.add(sea);

// Ondas de Gerstner estilizadas (Sea of Thieves: grande ondulação tropical + vagas secundárias + micro-cristas)
export const WV = [
  [0, 52, 1.0, 0.90],       // Grande ondulação principal (swell)
  [0.65, 30, 0.58, 0.78],  // Onda secundária transversal
  [-0.95, 19, 0.38, 0.68], // Vaga diagonal
  [1.70, 11.5, 0.24, 0.55],// Ondulação média
  [-2.20, 6.8, 0.16, 0.45],// Chop médio
  [0.35, 4.0, 0.10, 0.35], // Micro-crista frontal
  [-0.75, 2.4, 0.06, 0.25] // Micro-textura cintilante
].map(([a, L, f, st]) => ({ a, dx: 0, dz: 1, k: 6.2832 / L, f, st: st || 0.5, o: 0 }));

export const setWaveDir = a => { for (const w of WV) { w.dx = Math.sin(a + w.a); w.dz = Math.cos(a + w.a); } };
setWaveDir(.45);

export function H(x, z) {
  let y = SEAS.chop * Math.sin(x * .8 + SEAS.wt * 1.9) * Math.cos(z * .7 - SEAS.wt * 1.5);
  for (const w of WV) y += SEAS.amp * w.f * Math.sin(w.k * (w.dx * x + w.dz * z) - Math.sqrt(9.8 * w.k) * SEAS.wt);
  return y;
}

// Perfil geométrico do casco do navio para evitar invasão de água no convés
const HULL_W = [1.5, 1.9, 2.1, 2.2, 2.2, 2.1, 1.85, 1.4, 0.9, 0.4, 0];
const HULL_B = [-0.8, -1.1, -1.3, -1.35, -1.35, -1.3, -1.2, -1.0, -0.7, -0.3, 0.1];

export function updSea(s) {
  const vd = ILHAS && ILHAS.vd ? ILHAS.vd() : 2;
  const cs = ILHAS && ILHAS.CS ? ILHAS.CS : 48;
  const targetRadius = (vd + 2.5) * cs;
  const scale = Math.max(1, (targetRadius * 2) / SZ);

  for (const w of WV) w.o = Math.sqrt(9.8 * w.k) * SEAS.wt;

  const ch = Math.cos(ST.hd), sh = Math.sin(ST.hd);
  const shipVy = ST.vy !== undefined ? ST.vy : 0.4;
  const shipPt = ST.pt !== undefined ? ST.pt : 0;
  const shipRoll = (ST.rl !== undefined ? ST.rl : 0) + (ST.heel !== undefined ? ST.heel : 0);
  const sinPt = Math.sin(shipPt);
  const sinRoll = Math.sin(shipRoll);
  const shipSpeed = Math.abs(ST.v || 0);

  for (let i = 0, n = 0; i < NV; i++) {
    const sx = bx[i] * scale, sz = bz[i] * scale;
    const x = sx + ST.px, z = sz + ST.pz;
    let y = SEAS.chop * Math.sin(x * .8 + SEAS.wt * 1.9) * Math.cos(z * .7 - SEAS.wt * 1.5), ox = 0, oz = 0;
    for (const w of WV) {
      const p = w.k * (w.dx * x + w.dz * z) - w.o, A = SEAS.amp * w.f;
      y += A * Math.sin(p);
      const k = SEAS.st * w.st * A * Math.cos(p);
      ox += k * w.dx;
      oz += k * w.dz;
    }

    // Depressão suave da água dentro do casco do barco
    const rx = sx + ox;
    const rz = sz + oz;
    if (Math.abs(rx) < 8.0 && Math.abs(rz) < 8.0) {
      const lx = rx * ch - rz * sh;
      const lz = rx * sh + rz * ch;

      if (lz >= -6.2 && lz <= 6.2 && Math.abs(lx) < 2.4) {
        const f = (lz + 6.0) / 1.2;
        if (f >= 0 && f <= 10) {
          const idx = Math.min(9, Math.floor(f));
          const t = f - idx;
          const halfW = HULL_W[idx] * (1 - t) + HULL_W[idx + 1] * t;
          const absLx = Math.abs(lx);

          if (halfW > 0.05 && absLx < halfW) {
            let endTaper = 1.0;
            if (lz < -5.0) endTaper = Math.max(0, (lz + 6.2) / 1.2);
            else if (lz > 5.0) endTaper = Math.max(0, (6.2 - lz) / 1.2);

            const normX = absLx / halfW;
            const lateralFactor = 1.0 - normX * normX;
            const factor = lateralFactor * endTaper;

            if (factor > 0) {
              const botY = HULL_B[idx] * (1 - t) + HULL_B[idx + 1] * t;
              const hullBottomWorld = shipVy + botY - 0.25 - lz * sinPt + lx * sinRoll;
              if (y > hullBottomWorld) {
                y = y * (1 - factor) + hullBottomWorld * factor;
              }
            }
          }
        }
      }
    }

    P[n++] = sx + ox;
    P[n++] = y;
    P[n++] = sz + oz;
  }

  for (let f = 0; f < ix.length; f++) {
    const v = ix[f] * 3, o = f * 3;
    pos[o] = P[v];
    pos[o + 1] = P[v + 1];
    pos[o + 2] = P[v + 2];
  }

  c3(DEEP, s, cD);
  c3(SHAL, s, cS);
  c3(CREST, s, cCr);

  if (sunL && sunL.position) {
    sunDir.copy(sunL.position).normalize();
  } else {
    sunDir.set(-0.5, 0.7, -0.5).normalize();
  }

  const th = .68 - .16 * s;
  const fa = .25 + .75 * Math.min(1, s * 1.5);
  const hs = 1 / (SEAS.amp * 2.5 + SEAS.chop + .01);
  const ct = .5 * (.45 + .55 * s);

  for (let f = 0; f < ix.length; f += 3) {
    const o = f * 3;
    vA.set(pos[o], pos[o + 1], pos[o + 2]);
    vB.set(pos[o + 3], pos[o + 4], pos[o + 5]);
    vC.set(pos[o + 6], pos[o + 7], pos[o + 8]);

    const avgY = (vA.y + vB.y + vC.y) / 3;
    const avgX = (vA.x + vB.x + vC.x) / 3;
    const avgZ = (vA.z + vB.z + vC.z) / 3;
    facePos.set(avgX, avgY, avgZ);

    vCB.subVectors(vC, vB);
    vAB.subVectors(vA, vB);
    norm.crossVectors(vCB, vAB).normalize();

    const dotSun = clamp(norm.dot(sunDir), -1, 1);
    const steepness = 1 - clamp(norm.y, 0, 1);
    const heightNorm = clamp(.5 + ct * avgY * hs, 0, 1);

    // Vetor de visão da câmera para efeito Fresnel e reflexo especular
    viewDir.subVectors(cam.position, facePos).normalize();
    const NdotV = Math.max(0, norm.dot(viewDir));

    // 1. Cor base: Profundo (Safira Caribenha) -> Raso (Turquesa Vibrante)
    q.copy(cD).lerp(cS, Math.pow(heightNorm, 1.15));

    // 2. Subsurface Scattering (luz translúcida passando pelo corpo e crista da onda)
    if (heightNorm > 0.22) {
      const sssFactor = clamp((heightNorm - 0.22) * 1.7 + dotSun * 0.35 + steepness * 0.45, 0, 1);
      q.lerp(cCr, sssFactor * 0.78);
    }

    // 3. Fresnel estilizado (reflexo translúcido do horizonte em ângulos rasos)
    const fresnel = Math.pow(1.0 - NdotV, 3.2) * 0.35;
    q.lerp(cCr, fresnel);

    // 4. Brilho solar especular (Sun Glint / caminho dourado de luz)
    halfVec.addVectors(sunDir, viewDir).normalize();
    const NdotH = Math.max(0, norm.dot(halfVec));
    if (NdotH > 0.6) {
      const spec = Math.pow((NdotH - 0.6) / 0.4, 16) * 0.45 * (0.6 + 0.4 * s);
      q.r = Math.min(1, q.r + spec * 1.05);
      q.g = Math.min(1, q.g + spec * 0.98);
      q.b = Math.min(1, q.b + spec * 0.88);
    }

    // 5. Espuma dinâmica nas cristas das ondas
    let totalFoam = 0;
    const foamThreshold = th - steepness * 0.2;
    if (heightNorm > foamThreshold) {
      totalFoam += clamp((heightNorm - foamThreshold) / (1 - foamThreshold) * fa, 0, 1);
    }

    // 6. Espuma de contato com o casco do navio e rastro de popa (Wake Foam)
    if (Math.abs(avgX) < 18.0 && Math.abs(avgZ) < 18.0) {
      const flx = avgX * ch - avgZ * sh;
      const flz = avgX * sh + avgZ * ch;

      // Espuma ao longo das amuradas externas
      if (flz >= -5.8 && flz <= 5.8 && Math.abs(flx) >= 1.2 && Math.abs(flx) <= 3.4) {
        const hullFoam = Math.min(1, shipSpeed / 3.5 + 0.25) * (1 - (Math.abs(flx) - 1.2) / 2.2) * 0.75;
        totalFoam = Math.max(totalFoam, hullFoam);
      }
      // Rastro de espuma na esteira de popa
      if (flz < -5.8 && flz > -16.0 && Math.abs(flx) < 3.8 && shipSpeed > 0.4) {
        const wakeTaper = (flz + 16.0) / 10.2;
        const wakeSpread = 1.0 - Math.abs(flx) / 3.8;
        const sternWake = Math.min(1, shipSpeed / 4.0) * wakeTaper * wakeSpread * 0.8;
        totalFoam = Math.max(totalFoam, sternWake);
      }
    }

    if (totalFoam > 0.02) {
      q.lerp(FOAM, Math.min(1, totalFoam * 0.95));
    }

    // 7. Sombra das nuvens projetada no oceano
    let shadowFactor = 1.0;
    const shadows = cloudState.shadows;
    const nShadows = shadows.length;
    for (let si = 0; si < nShadows; si++) {
      const shw = shadows[si];
      const dx = avgX - shw.x;
      const dz = avgZ - shw.z;
      const distSq = dx * dx + dz * dz;
      const rSq = shw.r * shw.r;
      if (distSq < rSq) {
        const falloff = 1 - (distSq / rSq);
        shadowFactor = Math.min(shadowFactor, 1 - falloff * shw.strength);
      }
    }
    q.multiplyScalar(shadowFactor);

    // 8. Modulação facetada sutil (estética low-poly polida)
    q.multiplyScalar(jit[f / 3]);

    for (let k = 0; k < 9; k += 3) {
      col[o + k] = q.r;
      col[o + k + 1] = q.g;
      col[o + k + 2] = q.b;
    }
  }

  og.attributes.position.needsUpdate = true;
  og.attributes.color.needsUpdate = true;
}
