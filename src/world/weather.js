import * as THREE from 'three';
import { rnd, clamp, c3, m3 } from '../core/math.js';
import { SKY, CLD, WH } from '../core/palettes.js';
import { sc, cam, sky, sunL, hemi, fLight } from '../core/renderer.js';
import { S, WI, ST, LT, FX, AN, REF } from '../core/state.js';
import { H, fastH } from '../world/ocean.js';
import { clouds, cm, cloudState, updateCloudsSystem } from '../world/clouds.js';
import { ILHAS } from '../world/archipelago.js';
import { SH } from '../ship/ship.js';
import { Audio } from '../core/audio.js';

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

// Riscos de vento: partículas de ar levadas pelo vento aparente (estilo Sea of Thieves)
const NSK = 65, skA = new Float32Array(NSK * 3), skP = new Float32Array(NSK * 6), skG = new T.BufferGeometry();
for (let i = 0; i < NSK; i++) {
  skA[i * 3] = rnd(-50, 50);
  skA[i * 3 + 1] = rnd(2.0, 22.0); // Mantém as partículas flutuando em uma boa altitude visual
  skA[i * 3 + 2] = rnd(-50, 50);
}
skG.setAttribute('position', new T.BufferAttribute(skP, 3));
export const skM = new T.LineSegments(skG, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12, fog: false }));
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
  const shipRelX = ST.px - (REF ? REF.x : ST.px);
  const shipRelZ = ST.pz - (REF ? REF.z : ST.pz);
  wkT += dt * Math.min(30, Math.abs(ST.v) * 2.2);
  while (wkT > 1) {
    wkT--;
    for (const [lx, lz] of [[0, -5.8], [-1.4, 3.8], [1.4, 3.8]]) {
      const i = wkI++ % NW;
      wkP[i * 3] = shipRelX + lx * ch + lz * sh + rnd(-.4, .4);
      wkP[i * 3 + 2] = shipRelZ - lx * sh + lz * ch + rnd(-.4, .4);
      wkL[i] = 1;
    }
  }
  for (let i = 0; i < NW; i++) {
    const L = wkL[i] = Math.max(0, wkL[i] - dt * .17);
    if (L <= 0) { wkP[i * 3 + 1] = -50; continue; }
    const o = i * 3;
    wkP[o] -= ST.svx * dt;
    wkP[o + 2] -= ST.svz * dt;
    wkP[o + 1] = fastH(wkP[o] + (REF ? REF.x : ST.px), wkP[o + 2] + (REF ? REF.z : ST.pz)) + .15;
    wkC[o] = .1 + .9 * L;
    wkC[o + 1] = .45 + .55 * L;
    wkC[o + 2] = .55 + .45 * L;
  }
  wkG.attributes.position.needsUpdate = true;
  wkG.attributes.color.needsUpdate = true;

  updBowSpray(dt, ch, sh);
  updBirds(dt);
  updAnchorSplash(dt, ch, sh);
}

// Bolhas/Espuma da Âncora ao Lançar
const ANP = 40, anP = new Float32Array(ANP * 3), anV = new Float32Array(ANP * 3), anL = new Float32Array(ANP), anG = new T.BufferGeometry();
anG.setAttribute('position', new T.BufferAttribute(anP, 3));
export const anM = new T.Points(anG, new T.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: .8, fog: false }));
anM.frustumCulled = false;
sc.add(anM);

let anIdx = 0;
export function updAnchorSplash(dt, ch, sh) {
  const shipRelX = ST.px - (REF ? REF.x : ST.px);
  const shipRelZ = ST.pz - (REF ? REF.z : ST.pz);
  if (AN.d > .05 && AN.d < .95 && Math.random() < .6) {
    const i = anIdx++ % ANP;
    const lx = .88 + rnd(-.3, .3), lz = 3.9 + rnd(-.3, .3);
    const gx = lx * ch + lz * sh + ST.px;
    const gz = lz * ch - lx * sh + ST.pz;
    const gy = fastH(gx, gz) + rnd(.05, .3);

    anP[i * 3] = shipRelX + lx * ch + lz * sh;
    anP[i * 3 + 1] = gy;
    anP[i * 3 + 2] = shipRelZ + lz * ch - lx * sh;

    anV[i * 3] = rnd(-.8, .8);
    anV[i * 3 + 1] = rnd(1, 2.5);
    anV[i * 3 + 2] = rnd(-.8, .8);
    anL[i] = rnd(.3, .7);
  }

  for (let i = 0; i < ANP; i++) {
    if (anL[i] <= 0) { anP[i * 3 + 1] = -50; continue; }
    anL[i] -= dt;
    anV[i * 3 + 1] -= 6 * dt;
    anP[i * 3] += anV[i * 3] * dt;
    anP[i * 3 + 1] += anV[i * 3 + 1] * dt;
    anP[i * 3 + 2] += anV[i * 3 + 2] * dt;

    if (anP[i * 3 + 1] <= fastH(anP[i * 3] + (REF ? REF.x : ST.px), anP[i * 3 + 2] + (REF ? REF.z : ST.pz))) {
      anL[i] = 0;
      anP[i * 3 + 1] = -50;
    }
  }
  anG.attributes.position.needsUpdate = true;
}

// Sistema de Partículas de Impacto na Água (Splash) para Pesca e Saltos
const SPN = 120, spP_ = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN), spG_ = new T.BufferGeometry();
spG_.setAttribute('position', new T.BufferAttribute(spP_, 3));
export const spM_ = new T.Points(spG_, new T.PointsMaterial({ color: 0xeefaff, size: 1.2, transparent: true, opacity: 0.85, fog: false }));
spM_.frustumCulled = false;
sc.add(spM_);

let spIdx = 0;
export function spawnSplash(x, z, count = 12, force = 1.0) {
  const y = fastH(x, z);
  for (let k = 0; k < count; k++) {
    const i = spIdx++ % SPN;
    spP_[i * 3] = x + rnd(-0.15, 0.15);
    spP_[i * 3 + 1] = y + rnd(0.05, 0.2);
    spP_[i * 3 + 2] = z + rnd(-0.15, 0.15);
    
    const ang = Math.random() * Math.PI * 2;
    const mag = rnd(0.5, 2.2) * force;
    spV[i * 3] = Math.cos(ang) * mag * 0.6;
    spV[i * 3 + 1] = rnd(1.5, 4.5) * force;
    spV[i * 3 + 2] = Math.sin(ang) * mag * 0.6;
    spL[i] = rnd(0.4, 0.9);
  }
}

export function updSplashes(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spL[i] <= 0) { spP_[i * 3 + 1] = -50; continue; }
    spL[i] -= dt;
    spV[i * 3 + 1] -= 9.8 * dt; // Gravidade
    spP_[i * 3] += spV[i * 3] * dt;
    spP_[i * 3 + 1] += spV[i * 3 + 1] * dt;
    spP_[i * 3 + 2] += spV[i * 3 + 2] * dt;

    if (spV[i * 3 + 1] < 0 && spP_[i * 3 + 1] <= fastH(spP_[i * 3], spP_[i * 3 + 2])) {
      spL[i] = 0;
      spP_[i * 3 + 1] = -50;
    }
  }
  spG_.attributes.position.needsUpdate = true;
}

// Sistema de Ondulações (Expanding Rings) na Superfície
const RPN = 15;
const ripples = [];
export const rippleGroup = new T.Group();
sc.add(rippleGroup);

const ringGeo = new T.RingGeometry(0.95, 1.0, 32);
ringGeo.rotateX(-Math.PI / 2);

for (let i = 0; i < RPN; i++) {
  const mesh = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
  mesh.visible = false;
  rippleGroup.add(mesh);
  ripples.push({ mesh, life: 0, maxLife: 0, baseSize: 0, x: 0, z: 0 });
}

let rpIdx = 0;
export function spawnRipple(x, z, size = 1.0, duration = 1.8) {
  const r = ripples[rpIdx % RPN];
  rpIdx++;
  r.x = x;
  r.z = z;
  r.life = r.maxLife = duration;
  r.baseSize = size;
  r.mesh.visible = true;
}

export function updRipples(dt) {
  for (const r of ripples) {
    if (r.life <= 0) {
      r.mesh.visible = false;
      continue;
    }
    r.life -= dt;
    const t = 1.0 - r.life / r.maxLife;
    const s = r.baseSize * (0.1 + t * 5.5);
    r.mesh.scale.set(s, 1, s);
    r.mesh.position.set(r.x, fastH(r.x, r.z) + 0.05, r.z);
    r.mesh.material.opacity = Math.max(0, 0.35 * (1.0 - t));
  }
}

// Sistema de Micro-Espuma para Trilhas de Pesca (Fishing Wake)
const FWN = 300, fwP = new Float32Array(FWN * 3), fwV = new Float32Array(FWN * 3), fwL = new Float32Array(FWN), fwG = new T.BufferGeometry();
fwG.setAttribute('position', new T.BufferAttribute(fwP, 3));
export const fwM = new T.Points(fwG, new T.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.6, fog: false }));
fwM.frustumCulled = false;
sc.add(fwM);

let fwIdx = 0;
export function spawnLineWake(x, z, vx, vz, strength = 1.0) {
  // Dispara um par de partículas para formar o 'V'
  for (let k = 0; k < 2; k++) {
    const i = fwIdx++ % FWN;
    fwP[i * 3] = x;
    fwP[i * 3 + 1] = fastH(x, z) + 0.02;
    fwP[i * 3 + 2] = z;
    
    // Velocidade lateral oposta (k=0 esquerda, k=1 direita) para abrir o cone
    const side = k === 0 ? -1 : 1;
    const speed = Math.hypot(vx, vz);
    const nx = vx / (speed || 1);
    const nz = vz / (speed || 1);
    
    fwV[i * 3] = vx * 0.4 + (-nz * side * speed * 0.15);
    fwV[i * 3 + 1] = 0; // Mantém na superfície
    fwV[i * 3 + 2] = vz * 0.4 + (nx * side * speed * 0.15);
    fwL[i] = 0.5 + Math.random() * 0.4; // Vida curta
  }
}

export function updLineWakes(dt) {
  for (let i = 0; i < FWN; i++) {
    if (fwL[i] <= 0) { fwP[i * 3 + 1] = -50; continue; }
    fwL[i] -= dt;
    fwP[i * 3] += fwV[i * 3] * dt;
    fwP[i * 3 + 2] += fwV[i * 3 + 2] * dt;
    // Atualiza Y para acompanhar as ondas
    fwP[i * 3 + 1] = fastH(fwP[i * 3], fwP[i * 3 + 2]) + 0.02;
  }
  fwG.attributes.position.needsUpdate = true;
}


// Aves / Gaivotas 3D Low-Poly com Asas Articuladas sobre o arquipélago
function createSeagull() {
  const g = new T.Group();
  const mBody = new T.MeshStandardMaterial({ color: 0xf5f7fa, flatShading: true, roughness: 0.8 });
  const mDark = new T.MeshStandardMaterial({ color: 0x3d434a, flatShading: true, roughness: 0.8 });
  const mBeak = new T.MeshStandardMaterial({ color: 0xf5ab23, flatShading: true, roughness: 0.8 });

  const body = new T.Mesh(new T.IcosahedronGeometry(.26, 1), mBody);
  body.scale.set(.7, .65, 1.6);
  g.add(body);

  const head = new T.Mesh(new T.SphereGeometry(.14, 5, 4), mBody);
  head.position.set(0, .12, .42);
  g.add(head);

  const beak = new T.Mesh(new T.ConeGeometry(.045, .28, 4), mBeak);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, .1, .62);
  g.add(beak);

  const tail = new T.Mesh(new T.ConeGeometry(.12, .45, 3), mDark);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, .05, -.52);
  g.add(tail);

  // Asa Esquerda (Ombro -> Cotovelo)
  const shoulderL = new T.Group();
  shoulderL.position.set(-.14, .08, .05);
  g.add(shoulderL);

  const innerL = new T.Mesh(new T.BoxGeometry(.42, .035, .24), mBody);
  innerL.position.set(-.21, 0, -.02);
  shoulderL.add(innerL);

  const elbowL = new T.Group();
  elbowL.position.set(-.42, 0, -.02);
  shoulderL.add(elbowL);

  const outerL = new T.Mesh(new T.BoxGeometry(.48, .025, .18), mDark);
  outerL.position.set(-.24, 0, -.02);
  elbowL.add(outerL);

  // Asa Direita (Ombro -> Cotovelo)
  const shoulderR = new T.Group();
  shoulderR.position.set(.14, .08, .05);
  g.add(shoulderR);

  const innerR = new T.Mesh(new T.BoxGeometry(.42, .035, .24), mBody);
  innerR.position.set(.21, 0, -.02);
  shoulderR.add(innerR);

  const elbowR = new T.Group();
  elbowR.position.set(.42, 0, -.02);
  shoulderR.add(elbowR);

  const outerR = new T.Mesh(new T.BoxGeometry(.48, .025, .18), mDark);
  outerR.position.set(.24, 0, -.02);
  elbowR.add(outerR);

  g.traverse(o => o.frustumCulled = false);
  return { g, shoulderL, elbowL, shoulderR, elbowR };
}

const BCNT = 16;
const gulls = [];
export const seagullGroup = new T.Group();
sc.add(seagullGroup);

for (let i = 0; i < BCNT; i++) {
  const model = createSeagull();
  seagullGroup.add(model.g);
  gulls.push({
    ...model,
    ang: i * (Math.PI * 2 / BCNT),
    r: 26 + (i % 4) * 14,
    y: 15 + (i % 3) * 5,
    spd: .12 + (i % 3) * .04,
    wing: i * .6
  });
}

let birdSoundTimer = 8 + Math.random() * 12;
let hullWaveTimer = 1.1 + Math.random() * 1.5;
let beachWaveTimer = 6 + Math.random() * 4;

export function updBirds(dt) {
  const now = performance.now();
  
  birdSoundTimer -= dt;
  if (birdSoundTimer <= 0) {
    // 8 a 20 s
    Audio.play(Math.random() < 0.3 ? 'bando' : 'gaivota', { vol: 0.15 });
    birdSoundTimer = 8 + Math.random() * 12;
  }

  for (let i = 0; i < BCNT; i++) {
    const b = gulls[i];
    b.ang += b.spd * dt;
    b.wing += dt * (6 + (i % 3));

    const cx = ST.px + Math.cos(b.ang) * b.r;
    const cz = ST.pz + Math.sin(b.ang) * b.r;
    const cy = b.y + Math.sin(now * .001 + i) * 2;

    b.g.position.set(cx, cy, cz);
    b.g.rotation.y = -b.ang + Math.PI / 2;
    b.g.rotation.z = -.18;
    b.g.rotation.x = Math.sin(b.wing * .5) * .06;

    const flap = Math.sin(b.wing);
    b.shoulderL.rotation.z = flap * .42;
    b.shoulderR.rotation.z = -flap * .42;

    b.elbowL.rotation.z = -Math.abs(flap) * .32;
    b.elbowR.rotation.z = Math.abs(flap) * .32;
  }
}

// Respingos de água na proa (Bow Spray)
const BSP = 240, bsP = new Float32Array(BSP * 3), bsV = new Float32Array(BSP * 3), bsL = new Float32Array(BSP), bsG = new T.BufferGeometry();
bsG.setAttribute('position', new T.BufferAttribute(bsP, 3));
export const bsM = new T.Points(bsG, new T.PointsMaterial({ color: 0xeef8ff, size: 1.2, transparent: true, opacity: .75, fog: false }));
bsM.frustumCulled = false;
sc.add(bsM);

let bsIdx = 0;
export function updBowSpray(dt, ch, sh) {
  const speed = Math.abs(ST.v);
  
  // Som de onda no casco: 1.1 a 2.6 s, só se estiver no barco e em velocidade
  if (speed > .8) {
    hullWaveTimer -= dt;
    if (hullWaveTimer <= 0) {
      Audio.play('onda_casco', { k: Math.min(1, speed / 8), vol: 0.3 });
      hullWaveTimer = 1.1 + Math.random() * 1.5;
    }
  }

  // Som de onda na praia: 6 a 10 s, perto de ilhas
  beachWaveTimer -= dt;
  if (beachWaveTimer <= 0) {
    const ni = ILHAS.nearestIsland(ST.px, ST.pz);
    if (ni) {
      const dist = Math.hypot(ST.px - ni.x, ST.pz - ni.z);
      if (dist < ni.r + 35) {
        Audio.play('onda_praia', { vol: 0.25 });
      }
    }
    beachWaveTimer = 6 + Math.random() * 4;
  }

  if (speed > .8) {
    const shipRelX = ST.px - (REF ? REF.x : ST.px);
    const shipRelZ = ST.pz - (REF ? REF.z : ST.pz);
    const rate = Math.min(8, Math.floor(speed * 3));
    for (let k = 0; k < rate; k++) {
      const i = bsIdx++ % BSP;
      const side = (k % 2 === 0 ? 1 : -1);
      const lx = side * rnd(.4, 1.1), ly = rnd(.2, .6), lz = 4.6 + rnd(0, .8);
      const worldX = lx * ch + lz * sh + ST.px;
      const worldZ = lz * ch - lx * sh + ST.pz;
      bsP[i * 3] = shipRelX + lx * ch + lz * sh;
      bsP[i * 3 + 1] = fastH(worldX, worldZ) + ly;
      bsP[i * 3 + 2] = shipRelZ + lz * ch - lx * sh;

      bsV[i * 3] = (side * rnd(.8, 2.2) * ch + rnd(-.4, .4)) * (speed * .25);
      bsV[i * 3 + 1] = rnd(1.8, 3.8) + speed * .15;
      bsV[i * 3 + 2] = (-side * rnd(.8, 2.2) * sh + rnd(-.4, .4)) * (speed * .25);
      bsL[i] = rnd(.4, .85);
    }
  }

  for (let i = 0; i < BSP; i++) {
    if (bsL[i] <= 0) {
      bsP[i * 3 + 1] = -50;
      continue;
    }
    bsL[i] -= dt;
    bsV[i * 3 + 1] -= 9.8 * dt;
    bsP[i * 3] += bsV[i * 3] * dt;
    bsP[i * 3 + 1] += bsV[i * 3 + 1] * dt;
    bsP[i * 3 + 2] += bsV[i * 3 + 2] * dt;

    if (bsP[i * 3 + 1] <= fastH(bsP[i * 3] + (REF ? REF.x : ST.px), bsP[i * 3 + 2] + (REF ? REF.z : ST.pz))) {
      bsL[i] = 0;
      bsP[i * 3 + 1] = -50;
    }
  }
  bsG.attributes.position.needsUpdate = true;
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
    spP[j + 1] = fastH(x + ST.px, z + ST.pz) + .12;
    spP[j + 2] = z;
    spP[j + 3] = x2;
    spP[j + 4] = fastH(x2 + ST.px, z2 + ST.pz) + .12;
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

// Sol e Lua low poly removidos visualmente (mantidos grupos vazios apenas para evitar erros de referência de imports)
export const sunG = new T.Group(), rays = new T.Group(), SO = [0, 0, 0, 0], sunMat = [
  new T.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  new T.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  new T.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  new T.MeshBasicMaterial({ transparent: true, opacity: 0 })
];
sunG.frustumCulled = false;
sunG.traverse(o => o.frustumCulled = false);
// sc.add(sunG); -- Removido da cena por completo

// Tabela de Keyframes de 24 horas para o tempo limpo
export const CelestialKeyframes = [
  { t: 0.0,  sky: 0x010307, fog: 0x010204, light: 0xa5c5ff, lightInt: 0.12, isMoon: true,  hemiS: 0x050d1a, hemiG: 0x010204, hemiInt: 0.12, fogDens: 0.015 },
  { t: 4.5,  sky: 0x010307, fog: 0x010204, light: 0xa5c5ff, lightInt: 0.12, isMoon: true,  hemiS: 0x050d1a, hemiG: 0x010204, hemiInt: 0.12, fogDens: 0.015 },
  { t: 5.2,  sky: 0x0e0d1f, fog: 0x22132b, light: 0xff6220, lightInt: 0.10, isMoon: true,  hemiS: 0x141026, hemiG: 0x050510, hemiInt: 0.15, fogDens: 0.016 },
  { t: 5.8,  sky: 0x182a4d, fog: 0xd95032, light: 0xff6e30, lightInt: 0.35, isMoon: false, hemiS: 0x3d436b, hemiG: 0x1a0a06, hemiInt: 0.35, fogDens: 0.018 },
  { t: 6.3,  sky: 0x225ea0, fog: 0xff9a45, light: 0xffaa40, lightInt: 0.70, isMoon: false, hemiS: 0x5a7ab3, hemiG: 0x382218, hemiInt: 0.55, fogDens: 0.017 },
  { t: 7.0,  sky: 0x268ee8, fog: 0xc2e0ff, light: 0xfff2ce, lightInt: 0.95, isMoon: false, hemiS: 0xffffff, hemiG: 0x1b5a78, hemiInt: 0.65, fogDens: 0.014 },
  { t: 12.0, sky: 0x268ee8, fog: 0xc2e0ff, light: 0xfffbf0, lightInt: 1.00, isMoon: false, hemiS: 0xffffff, hemiG: 0x1b5a78, hemiInt: 0.65, fogDens: 0.013 },
  { t: 16.5, sky: 0x247ec6, fog: 0xddeeff, light: 0xffeed0, lightInt: 0.95, isMoon: false, hemiS: 0xffffff, hemiG: 0x1b5a78, hemiInt: 0.65, fogDens: 0.013 },
  { t: 17.2, sky: 0x1a4982, fog: 0xff9e3d, light: 0xff9020, lightInt: 0.80, isMoon: false, hemiS: 0x5d7ab8, hemiG: 0x3a251a, hemiInt: 0.55, fogDens: 0.016 },
  { t: 17.8, sky: 0x3b144d, fog: 0xe83b10, light: 0xff4f08, lightInt: 0.50, isMoon: false, hemiS: 0x482b6b, hemiG: 0x290c05, hemiInt: 0.40, fogDens: 0.018 },
  { t: 18.3, sky: 0x19102b, fog: 0x4a1438, light: 0xc02008, lightInt: 0.20, isMoon: false, hemiS: 0x22133b, hemiG: 0x100517, hemiInt: 0.25, fogDens: 0.017 },
  { t: 19.0, sky: 0x050814, fog: 0x0a0c1a, light: 0x88adff, lightInt: 0.10, isMoon: true,  hemiS: 0x0b1329, hemiG: 0x03050d, hemiInt: 0.15, fogDens: 0.015 },
  { t: 21.0, sky: 0x010307, fog: 0x010204, light: 0xa5c5ff, lightInt: 0.12, isMoon: true,  hemiS: 0x050d1a, hemiG: 0x010204, hemiInt: 0.12, fogDens: 0.015 },
  { t: 24.0, sky: 0x010307, fog: 0x010204, light: 0xa5c5ff, lightInt: 0.12, isMoon: true,  hemiS: 0x050d1a, hemiG: 0x010204, hemiInt: 0.12, fogDens: 0.015 }
];

const cTemp1 = new THREE.Color();
const cTemp2 = new THREE.Color();

export function getCelestialFrame(time) {
  let i1 = 0, i2 = 1;
  for (let i = 0; i < CelestialKeyframes.length - 1; i++) {
    if (time >= CelestialKeyframes[i].t && time <= CelestialKeyframes[i + 1].t) {
      i1 = i;
      i2 = i + 1;
      break;
    }
  }

  const k1 = CelestialKeyframes[i1];
  const k2 = CelestialKeyframes[i2];
  const f = (time - k1.t) / (k2.t - k1.t);

  const skyVal = new THREE.Color(k1.sky).lerp(cTemp1.setHex(k2.sky), f);
  const fogVal = new THREE.Color(k1.fog).lerp(cTemp1.setHex(k2.fog), f);
  const lightVal = new THREE.Color(k1.light).lerp(cTemp1.setHex(k2.light), f);
  const lightInt = k1.lightInt + (k2.lightInt - k1.lightInt) * f;
  
  const hemiS = new THREE.Color(k1.hemiS).lerp(cTemp1.setHex(k2.hemiS), f);
  const hemiG = new THREE.Color(k1.hemiG).lerp(cTemp1.setHex(k2.hemiG), f);
  const hemiInt = k1.hemiInt + (k2.hemiInt - k1.hemiInt) * f;
  const fogDens = k1.fogDens + (k2.fogDens - k1.fogDens) * f;
  const isMoon = f < 0.5 ? k1.isMoon : k2.isMoon;

  return { sky: skyVal, fog: fogVal, light: lightVal, lightInt, isMoon, hemiS, hemiG, hemiInt, fogDens };
}

export function updSun(dt, refX = (REF ? REF.x : ST.px), refZ = (REF ? REF.z : ST.pz)) {
  const celestial = getCelestialFrame(S.time);
  const occ = cloudState.sunOcclusion;

  let vis = 0;
  if (!celestial.isMoon) {
    vis = S.time >= 5.0 && S.time <= 19.0 ? (S.time < 6.0 ? (S.time - 5.0) : S.time > 18.0 ? (19.0 - S.time) : 1.0) : 0;
  } else {
    let moonTime = S.time < 6.0 ? S.time + 24.0 : S.time;
    vis = moonTime >= 17.0 && moonTime <= 30.0 ? (moonTime < 18.0 ? (moonTime - 17.0) : moonTime > 29.0 ? (30.0 - moonTime) : 1.0) : 0;
  }

  const finalVis = Math.max(0, vis) * (1 - 0.72 * occ);
  sunG.visible = finalVis > .01;

  let angle = 0;
  let maxAltitude = 70;
  if (!celestial.isMoon) {
    angle = ((S.time - 6.0) / 12.0) * Math.PI;
    maxAltitude = 70;
  } else {
    let moonTime = S.time < 6.0 ? S.time + 24.0 : S.time;
    angle = ((moonTime - 18.0) / 12.0) * Math.PI;
    maxAltitude = 55;
  }

  const sunDist = 90;
  const sunX = (ST.px - refX) - Math.cos(angle) * sunDist;
  const sunY = Math.sin(angle) * maxAltitude;
  const sunZ = (ST.pz - refZ) - 50;

  sunL.position.set(sunX, Math.max(5, sunY), sunZ);
  sunL.target.position.set(ST.px - refX, 0, ST.pz - refZ);
  sunL.target.updateMatrixWorld();

  if (!sunG.visible) return;

  sunG.position.copy(sunL.position).multiplyScalar(3);
  cam.getWorldPosition(wp);
  sunG.lookAt(wp);
  const k = performance.now() * .001;
  rays.rotation.z += dt * .06;

  if (celestial.isMoon) {
    rays.visible = false;
    sunMat[0].color.setHex(0xeef4ff);
    sunMat[0].opacity = 0.9 * finalVis;
    sunMat[1].opacity = 0;
    sunMat[2].color.setHex(0x88adff);
    sunMat[2].opacity = 0.15 * finalVis;
    sunMat[3].color.setHex(0x5588ff);
    sunMat[3].opacity = 0.08 * finalVis;
  } else {
    rays.visible = true;
    const isTwilight = (S.time >= 5.0 && S.time <= 7.0) || (S.time >= 17.0 && S.time <= 19.0);
    if (isTwilight) {
      sunMat[0].color.setRGB(1, 0.55, 0.15);
    } else {
      sunMat[0].color.setRGB(1, 0.95, 0.8);
    }

    sunMat[1].color.setHex(0xffe27a);
    sunMat[2].color.setHex(0xffd86a);
    sunMat[3].color.setHex(0xffd86a);

    for (let i = 0; i < 4; i++) {
      const baseOp = SO[i] * finalVis;
      sunMat[i].opacity = baseOp * (i > 1 ? 1 + .12 * Math.sin(k * 1.7 + i) : 1);
    }
  }

  const occScale = 1 - 0.25 * occ;
  sunG.scale.setScalar((celestial.isMoon ? 0.8 : 1.0) * (1 + .025 * Math.sin(k * 1.3)) * occScale);
}

export function updAtmosphere(s, dt, now, vwx, vwz, avx, avz) {
  const celestial = getCelestialFrame(S.time);

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
  const skyColor = celestial.sky.clone();
  const fogColor = celestial.fog.clone();

  skyColor.lerp(cTemp1.setHex(0x16222a), s);
  fogColor.lerp(cTemp1.setHex(0x121d24), s);

  skyColor.lerp(WH, ff * .4);
  fogColor.lerp(WH, ff * .5);

  sky.copy(skyColor);
  sc.fog.color.copy(fogColor);

  const baseDens = celestial.fogDens + (0.027 - celestial.fogDens) * s;
  const vdFactor = Math.max(1, (ILHAS && ILHAS.vd ? ILHAS.vd() : 2) / 2);
  sc.fog.density = baseDens / vdFactor;

  const occ = cloudState.sunOcclusion;
  const stormLightMultiplier = 1.0 - s * 0.85;

  sunL.color.copy(celestial.light);
  sunL.intensity = celestial.lightInt * (1 - 0.6 * occ) * stormLightMultiplier;
  key.color.copy(celestial.light);
  key.intensity = sunL.intensity * .4;

  hemi.color.copy(celestial.hemiS).lerp(cTemp1.setHex(0x323e46), s);
  hemi.groundColor.copy(celestial.hemiG).lerp(cTemp1.setHex(0x1a2126), s);
  hemi.intensity = (celestial.hemiInt * (1.0 - s * 0.45) + ff * 1.6) * (1 - 0.18 * occ);
  
  fLight.intensity = ff * 2.2;

  // Lanternas quentes do navio acendem no crepúsculo/tempestade/noite se estiverem ativadas
  if (SH.lanterns) {
    const nightLanternFactor = celestial.isMoon ? 0.85 : 0.0;
    const lInt = Math.max(.2, (s - .2) * 1.8) + ff * 1.2 + nightLanternFactor;
    SH.lanterns.forEach(lant => {
      if (lant.on) {
        lant.light.intensity = lInt * (1 + .08 * Math.sin(now * .008));
        lant.mat.emissiveIntensity = 0.95 * (1 + .05 * Math.sin(now * .008));
      } else {
        lant.light.intensity = 0;
        lant.mat.emissiveIntensity = 0;
      }
    });
  }

  // Vibração suave de câmera durante tempestade ou relâmpagos
  if (s > .65 || LT.flash > .05) {
    const shake = (s > .65 ? (s - .65) * .08 : 0) + LT.flash * .12;
    cam.position.x += (Math.random() - .5) * shake;
    cam.position.y += (Math.random() - .5) * shake;
  }

  // Efeito de gotas de chuva na lente da visão/câmera
  const lensEl = document.getElementById('lens-drops');
  if (lensEl) {
    lensEl.style.opacity = Math.max(0, (s - .35) * 1.5).toFixed(2);
  }

  // Sistema Dinâmico de Nuvens
  const wang = Math.atan2(vwx, vwz);
  updateCloudsSystem(dt, now, vwx, vwz, wang, WI.wsp, s);

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

  // Riscos de vento (estilo Sea of Thieves: brisas mais longas, suaves e espaçadas de tempos em tempos)
  const am = Math.hypot(avx, avz) + .001, tl = Math.min(2.5, .35 + am * .08);
  const windWave = 0.4 + 0.6 * Math.sin(now * 0.0006); // Onda senoidal lenta para vinda/ida das brisas
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
  const activeLines = Math.floor(NSK * clamp(0.1 + WI.s * 0.4, 0, 1) * (0.2 + 0.8 * windWave));
  skG.setDrawRange(0, activeLines * 2);
  skG.attributes.position.needsUpdate = true;
  skM.position.set(wp.x, 0, wp.z);
  skM.material.opacity = (0.04 + 0.12 * clamp(WI.wsp / 12, 0, 1)) * windWave;
}
