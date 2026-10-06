import * as THREE from 'three';
import { rnd, clamp, c3 } from '../core/math.js';
import { DEEP, SHAL, FOAM } from '../core/palettes.js';
import { sc } from '../core/renderer.js';
import { SEAS, ST } from '../core/state.js';

const T = THREE;
const cD = new T.Color(), cS = new T.Color(), q = new T.Color();

// Oceano: malha jitterizada, triângulos não indexados (cor chapada por face)
const N = 90, SZ = 240, cl = SZ / N, bx = [], bz = [], ix = [];
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { bx.push((i / N - .5) * SZ); bz.push((j / N - .5) * SZ); }
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; ix.push(a, c, b, b, c, d); }
const NV = bx.length, P = new Float32Array(NV * 3), pos = new Float32Array(ix.length * 3), col = new Float32Array(ix.length * 3), jit = [];
for (let f = 0; f < ix.length / 3; f++) jit.push(rnd(.93, 1.06));
const og = new T.BufferGeometry();
og.setAttribute('position', new T.BufferAttribute(pos, 3));
og.setAttribute('color', new T.BufferAttribute(col, 3));
export const sea = new T.Mesh(og, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .35, metalness: .1 }));
sea.frustumCulled = false;
sc.add(sea);

// Ondas de Gerstner (direção, comprimento, fator de amplitude)
export const WV = [[0, 38, 1], [.85, 24, .6], [-1.05, 15, .35], [1.95, 9, .2]].map(([a, L, f]) => ({ a, dx: 0, dz: 1, k: 6.2832 / L, f, o: 0 }));
export const setWaveDir = a => { for (const w of WV) { w.dx = Math.sin(a + w.a); w.dz = Math.cos(a + w.a); } };
setWaveDir(.45);

export function H(x, z) {
  let y = SEAS.chop * Math.sin(x * .8 + SEAS.wt * 1.9) * Math.cos(z * .7 - SEAS.wt * 1.5);
  for (const w of WV) y += SEAS.amp * w.f * Math.sin(w.k * (w.dx * x + w.dz * z) - Math.sqrt(9.8 * w.k) * SEAS.wt);
  return y;
}

export function updSea(s) {
  for (const w of WV) w.o = Math.sqrt(9.8 * w.k) * SEAS.wt;
  for (let i = 0, n = 0; i < NV; i++) {
    const x = bx[i] + ST.px, z = bz[i] + ST.pz;
    let y = SEAS.chop * Math.sin(x * .8 + SEAS.wt * 1.9) * Math.cos(z * .7 - SEAS.wt * 1.5), ox = 0, oz = 0;
    for (const w of WV) {
      const p = w.k * (w.dx * x + w.dz * z) - w.o, A = SEAS.amp * w.f;
      y += A * Math.sin(p);
      const k = SEAS.st * A * Math.cos(p);
      ox += k * w.dx;
      oz += k * w.dz;
    }
    P[n++] = bx[i] + ox;
    P[n++] = Math.round(y / .35) * .35;
    P[n++] = bz[i] + oz;
  }
  for (let f = 0; f < ix.length; f++) {
    const v = ix[f] * 3, o = f * 3;
    pos[o] = P[v];
    pos[o + 1] = P[v + 1];
    pos[o + 2] = P[v + 2];
  }
  c3(DEEP, s, cD);
  c3(SHAL, s, cS);
  const th = .8 - .2 * s, fa = .15 + .85 * Math.min(1, s * 1.6), hs = 1 / (SEAS.amp * 2.2 + SEAS.chop + .01), ct = .5 * (.45 + .55 * s);
  for (let f = 0; f < ix.length; f += 3) {
    const o = f * 3, y = (pos[o + 1] + pos[o + 4] + pos[o + 7]) / 3, n = clamp(.5 + ct * y * hs, 0, 1);
    q.copy(cD).lerp(cS, n);
    if (n > th) q.lerp(FOAM, (n - th) / (1 - th) * fa);
    q.multiplyScalar(jit[f / 3]);
    for (let k = 0; k < 9; k += 3) {
      col[o + k] = q.r;
      col[o + k + 1] = q.g;
      col[o + k + 2] = q.b;
    }
  }
  og.attributes.position.needsUpdate=true;
  og.attributes.color.needsUpdate=true;
}
