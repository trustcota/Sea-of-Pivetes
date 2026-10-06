import * as THREE from 'three';
import { rnd, clamp, c3, m3 } from '../core/math.js';
import { SKY, CLD, WH } from '../core/palettes.js';
import { sc, cam, sky, sunL, hemi, fLight } from '../core/renderer.js';
import { S, WI, ST, LT, FX } from '../core/state.js';
import { H } from '../world/ocean.js';
import { clouds, cm } from '../world/clouds.js';

const T = THREE;
const wp = new T.Vector3();

// Luz secundária do navio
export const key = new T.DirectionalLight(0xfff0d0, .4);
key.position.set(40, 30, 50);
sc.add(key);

// Chuva
const RN = 2200, rp = new Float32Array(RN * 6), rg = new T.BufferGeometry();
for (let i = 0; i < RN; i++) {
  rp[i * 6] = rnd(-60, 60);
  rp[i * 6 + 1] = rnd(0, 50);
  rp[i * 6 + 2] = rnd(-60, 60);
}
rg.setAttribute('position', new T.BufferAttribute(rp, 3));
export const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xbfd4e2, transparent: true, opacity: .4, fog: false }));
rain.frustumCulled = false;
sc.add(rain);

// Riscos de vento: partículas de ar levadas pelo vento aparente
const NSK = 260, skA = new Float32Array(NSK * 3), skP = new Float32Array(NSK * 6), skG = new T.BufferGeometry();
for (let i = 0; i < NSK; i++) {
  skA[i * 3] = rnd(-50, 50);
  skA[i * 3 + 1] = rnd(.8, 26);
  skA[i * 3 + 2] = rnd(-50, 50);
}
skG.setAttribute('position', new T.BufferAttribute(skP, 3));
export const skM = new T.LineSegments(skG, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25, fog: false }));
skM.frustumCulled = false;
sc.add(skM);

// Relâmpagos
export const bolt = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xeaf3ff, fog: false }));
bolt.visible = false;
bolt.frustumCulled = false;
sc.add(bolt);

export function strike() {
  const a = rnd(0, 6.28), r = rnd(30, 100), x = Math.cos(a) * r, z = Math.sin(a) * r, p = [];
  for (let i = 0; i <= 10; i++) {
    const j = i > 0 && i < 10 ? 4 : 0;
    p.push(new T.Vector3(x + rnd(-j, j), 62 - i * 6.2, z + rnd(-j, j)));
  }
  bolt.geometry.dispose();
  bolt.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(p), 30, .35, 4);
  bolt.visible = true;
  LT.flash = 1;
}

// Esteira de espuma e boias de referência
const NW = 520, wkP = new Float32Array(NW * 3), wkC = new Float32Array(NW * 3), wkL = new Float32Array(NW), wkG = new T.BufferGeometry();
wkG.setAttribute('position', new T.BufferAttribute(wkP, 3));
wkG.setAttribute('color', new T.BufferAttribute(wkC, 3));
export const wkM = new T.Points(wkG, new T.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: .85 }));
wkM.frustumCulled = false;
sc.add(wkM);
let wkI = 0, wkT = 0;
wkP.fill(0);
for (let i = 0; i < NW; i++) wkP[i * 3 + 1] = -50;

export function updExtras(dt, ch, sh) {
  wkT += dt * Math.min(30, Math.abs(ST.v) * 2.2);
  while (wkT > 1) {
    wkT--;
    for (const [lx, lz] of [[0, -5.8], [-1.4, 3.8], [1.4, 3.8]]) {
      const i = wkI++ % NW;
      wkP[i * 3] = lx * ch + lz * sh + rnd(-.4, .4);
      wkP[i * 3 + 2] = -lx * sh + lz * ch + rnd(-.4, .4);
      wkL[i] = 1;
    }
  }
  for (let i = 0; i < NW; i++) {
    const L = wkL[i] = Math.max(0, wkL[i] - dt * .17);
    if (L <= 0) { wkP[i * 3 + 1] = -50; continue; }
    const o = i * 3;
    wkP[o] -= ST.svx * dt;
    wkP[o + 2] -= ST.svz * dt;
    wkP[o + 1] = H(wkP[o] + ST.px, wkP[o + 2] + ST.pz) + .15;
    wkC[o] = .1 + .9 * L;
    wkC[o + 1] = .45 + .55 * L;
    wkC[o + 2] = .55 + .45 * L;
  }
  wkG.attributes.position.needsUpdate = true;
  wkG.attributes.color.needsUpdate = true;
}

// Riscos de velocidade na água (fixos no mundo): passam pelo casco e dão noção de deslocamento
const NSP = 380, spP = new Float32Array(NSP * 6), spA = new Float32Array(NSP * 2), spG = new T.BufferGeometry();
for (let i = 0; i < NSP; i++) {
  spA[i * 2] = rnd(-70, 70);
  spA[i * 2 + 1] = rnd(-70, 70);
}
spG.setAttribute('position', new T.BufferAttribute(spP, 3));
export const spM = new T.LineSegments(spG, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
spM.frustumCulled = false;
sc.add(spM);

export function updSpeedFx(dt) {
  const sp = Math.hypot(ST.svx, ST.svz);
  FX.SPD += (clamp((sp - 1.2) / 6, 0, 1) - FX.SPD) * (1 - Math.exp(-dt * 2));
  const L = .6 + sp * .55, ux = sp > .01 ? ST.svx / sp : 0, uz = sp > .01 ? ST.svz / sp : 1;
  for (let i = 0; i < NSP; i++) {
    let x = spA[i * 2] - ST.svx * dt, z = spA[i * 2 + 1] - ST.svz * dt;
    if (x > 70) x -= 140; else if (x < -70) x += 140;
    if (z > 70) z -= 140; else if (z < -70) z += 140;
    spA[i * 2] = x;
    spA[i * 2 + 1] = z;
    const j = i * 6, x2 = x + ux * L, z2 = z + uz * L;
    spP[j] = x;
    spP[j + 1] = H(x + ST.px, z + ST.pz) + .12;
    spP[j + 2] = z;
    spP[j + 3] = x2;
    spP[j + 4] = H(x2 + ST.px, z2 + ST.pz) + .12;
    spP[j + 5] = z2;
  }
  spG.attributes.position.needsUpdate = true;
  spM.material.opacity = .55 * FX.SPD;
}

// Ruído de valor (usado nas rajadas de vento)
const h1 = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
export const vn = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return (h1(i, j) * (1 - a) + h1(i + 1, j) * a) * (1 - b) + (h1(i, j + 1) * (1 - a) + h1(i + 1, j + 1) * a) * b;
};

// Sol low poly: núcleo facetado + raios triangulares + halos poligonais; alinhado à luz direcional (sunL)
export const sunG = new T.Group(), rays = new T.Group(), SO = [1, .95, .3, .13], sunMat = [];
{
  const g = new T.IcosahedronGeometry(22, 1), p = g.attributes.position, col = new Float32Array(p.count * 3), n = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    a.fromBufferAttribute(p, f * 3 + 1).sub(b.fromBufferAttribute(p, f * 3));
    n.fromBufferAttribute(p, f * 3 + 2).sub(b).cross(a).normalize();
    const sh = clamp(.86 + .14 * Math.abs(n.z) + .05 * Math.sin(f * 7.3), .7, 1);
    for (let v = 0; v < 3; v++) col.set([sh, .95 * sh, .62 * sh], (f * 3 + v) * 3);
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  sunMat.push(new T.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true }));
  sunG.add(new T.Mesh(g, sunMat[0]));
}
sunMat.push(new T.MeshBasicMaterial({ color: 0xffe27a, fog: false, transparent: true }));
for (let i = 0; i < 12; i++) {
  const r = new T.Group(), o = i % 2, c = new T.Mesh(new T.ConeGeometry(o ? 3.4 : 4.6, o ? 15 : 24, 3), sunMat[1]);
  c.position.y = o ? 36 : 40;
  r.add(c);
  r.rotation.z = i * Math.PI / 6;
  rays.add(r);
}
sunG.add(rays);
for (const [rad, seg, z] of [[62, 12, -1], [110, 10, -2]]) {
  const m = new T.MeshBasicMaterial({ color: 0xffd86a, fog: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  sunMat.push(m);
  const h = new T.Mesh(new T.CircleGeometry(rad, seg), m);
  h.position.z = z;
  sunG.add(h);
}
sunG.frustumCulled = false;
sunG.traverse(o => o.frustumCulled = false);
sc.add(sunG);

export function updSun(dt) {
  const s = S.c, v = clamp(1 - (s - .3) / .35, 0, 1);
  sunG.visible = v > .01;
  if (!sunG.visible) return;
  sunG.position.copy(sunL.position).multiplyScalar(5);
  cam.getWorldPosition(wp);
  sunG.lookAt(wp);
  const k = performance.now() * .001;
  rays.rotation.z += dt * .06;
  sunMat[0].color.setRGB(1, 1 - .2 * s, 1 - .5 * s);
  for (let i = 0; i < 4; i++) sunMat[i].opacity = SO[i] * v * (i > 1 ? 1 + .12 * Math.sin(k * 1.7 + i) : 1);
  sunG.scale.setScalar(1 + .025 * Math.sin(k * 1.3));
}

export function updAtmosphere(s, dt, now, vwx, vwz, avx, avz) {
  // Raios e tempestade
  LT.flash = Math.max(0, LT.flash - dt * 2.6);
  const ff = LT.flash * (.65 + .35 * Math.sin(now * .07));
  if (s > .72) {
    LT.nl -= dt;
    if (LT.nl < 0) {
      strike();
      LT.nl = Math.random() < .3 ? rnd(.15, .4) : rnd(2, 7);
    }
  }
  if (LT.flash < .02) bolt.visible = false;

  // Céu, neblina e luzes
  c3(SKY, s, sky);
  sky.lerp(WH, ff * .5);
  sc.fog.color.copy(sky);
  sc.fog.density = m3([.013, .017, .027], s);
  sunL.intensity = m3([.95, .55, .1], s);
  key.intensity = sunL.intensity * .4;
  hemi.intensity = m3([.62, .5, .32], s) + ff * 1.6;
  fLight.intensity = ff * 2.2;

  // Nuvens
  c3(CLD, s, cm.color);
  clouds.scale.setScalar(1 + .6 * s);
  clouds.position.y = -12 * s;
  for (const c of clouds.children) {
    const u = c.userData.v * .35, q = c.position;
    q.x += (vwx * u - ST.svx) * dt;
    q.z += (vwz * u - ST.svz) * dt;
    if (q.x > 240) q.x -= 480; else if (q.x < -240) q.x += 480;
    if (q.z > 240) q.z -= 480; else if (q.z < -240) q.z += 480;
  }

  // Chuva
  const k = clamp((s - .4) / .5, 0, 1), cnt = Math.floor(RN * k);
  rg.setDrawRange(0, cnt * 2);
  rain.material.opacity = .12 + .38 * k;
  for (let i = 0; i < cnt; i++) {
    const o = i * 6;
    let y = rp[o + 1] - 48 * dt;
    if (y < 0) {
      y += 50;
      rp[o] = rnd(-60, 60);
      rp[o + 2] = rnd(-60, 60);
    }
    rp[o] += avx * dt * .5;
    rp[o + 2] += avz * dt * .5;
    rp[o + 1] = y;
    rp[o + 3] = rp[o] - avx * .07;
    rp[o + 4] = y + 1.9;
    rp[o + 5] = rp[o + 2] - avz * .07;
  }
  rg.attributes.position.needsUpdate = true;

  // Câmera e partículas ao redor
  cam.getWorldPosition(wp);
  rain.position.set(wp.x, 0, wp.z);

  // Riscos de vento
  const am = Math.hypot(avx, avz) + .001, tl = Math.min(1.8, .25 + am * .07);
  for (let i = 0; i < NSK; i++) {
    const o = i * 3;
    let x = skA[o] + avx * dt, z = skA[o + 2] + avz * dt;
    if (x > 50) x -= 100; else if (x < -50) x += 100;
    if (z > 50) z -= 100; else if (z < -50) z += 100;
    skA[o] = x;
    skA[o + 2] = z;
    const y = skA[o + 1], j = i * 6;
    skP[j] = x;
    skP[j + 1] = y;
    skP[j + 2] = z;
    skP[j + 3] = x - avx / am * tl;
    skP[j + 4] = y;
    skP[j + 5] = z - avz / am * tl;
  }
  skG.setDrawRange(0, Math.floor(NSK * clamp(.3 + WI.s, 0, 1)) * 2);
  skG.attributes.position.needsUpdate = true;
  skM.position.set(wp.x, 0, wp.z);
  skM.material.opacity = .1 + .28 * clamp(WI.wsp / 12, 0, 1);
}
