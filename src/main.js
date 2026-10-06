import * as THREE from 'three';
import { clamp, wrapA } from './core/math.js';
import { R, sc, cam, cv } from './core/renderer.js';
import { S, WI, ST, SEAS, CAM, UIS, FX, FL, AN, INT, fp, keys, joy, lk } from './core/state.js';
import { setWaveDir, H, updSea } from './world/ocean.js';
import { ILHAS } from './world/archipelago.js';
import { updExtras, updSpeedFx, vn, updSun, updAtmosphere } from './world/weather.js';
import { ship, fl } from './ship/ship.js';
import { updShipPhysics } from './ship/physics.js';
import { setFpv, resetPlayer, updFPV, updGlow, updGlowHelm, qD } from './ship/player.js';
import { setupUI, updWindHud, updAnchor } from './ui.js';
import './pwa.js';

let vy = 0, pt = 0, rl = 0;
let vyv = 0, ptv = 0, rlv = 0;
const so2 = (x, v, tg, w, z, dt) => {
  v += (w * w * (tg - x) - 2 * z * w * v) * dt;
  return [x + v * dt, v];
};

// Câmera orbital, FPV e controles de toque do ponteiro com joystick visual
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const showJoystick = (x, y) => {
  if (joyBase) {
    joyBase.style.left = x + 'px';
    joyBase.style.top = y + 'px';
    joyBase.style.display = 'block';
  }
};
const updateJoystickKnob = (dx, dy) => {
  if (joyKnob) {
    joyKnob.style.transform = `translate(calc(-50% + ${dx * 25}px), calc(-50% + ${dy * 25}px))`;
  }
};
const hideJoystick = () => {
  if (joyBase) joyBase.style.display = 'none';
  if (joyKnob) joyKnob.style.transform = 'translate(-50%, -50%)';
};

cv.onpointerdown = e => {
  if (CAM.fpv && e.pointerType !== 'mouse') {
    if (e.clientX < window.innerWidth * .4 && joy.id < 0) {
      joy.id = e.pointerId;
      joy.x0 = e.clientX;
      joy.y0 = e.clientY;
      joy.dx = joy.dy = 0;
      showJoystick(joy.x0, joy.y0);
    } else if (lk.id < 0) {
      lk.id = e.pointerId;
      lk.x = e.clientX;
      lk.y = e.clientY;
    }
  } else {
    CAM.drag = true;
    if (CAM.fpv && !document.pointerLockElement && cv.requestPointerLock) cv.requestPointerLock();
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
};
cv.onpointerup = cv.onpointercancel = e => {
  CAM.drag = false;
  if (e.pointerId === joy.id) {
    joy.id = -1;
    joy.dx = joy.dy = 0;
    hideJoystick();
  }
  if (e.pointerId === lk.id) {
    lk.id = -1;
  }
};
cv.onpointermove = e => {
  if (CAM.fpv) {
    if (e.pointerId === joy.id) {
      joy.dx = clamp((e.clientX - joy.x0) / 50, -1, 1);
      joy.dy = clamp((e.clientY - joy.y0) / 50, -1, 1);
      updateJoystickKnob(joy.dx, joy.dy);
    } else if (e.pointerId === lk.id) {
      const ax = e.clientX - lk.x, ay = e.clientY - lk.y;
      if (INT.grab && INT.grab.t !== 'helm' && INT.grab.t !== 'anchor' && !qD()) {
        INT.pX += ax * 1.5;
        INT.pY += ay * 1.5;
      } else {
        fp.yaw -= ax * .005;
        fp.pit = clamp(fp.pit - ay * .005, -1.4, 1.4);
      }
      lk.x = e.clientX;
      lk.y = e.clientY;
    } else if (e.pointerType === 'mouse' && (document.pointerLockElement === cv || CAM.drag)) {
      if (INT.grab && INT.grab.t !== 'helm' && INT.grab.t !== 'anchor' && !qD()) {
        INT.pX += e.movementX;
        INT.pY += e.movementY;
      } else {
        fp.yaw -= e.movementX * .0025;
        fp.pit = clamp(fp.pit - e.movementY * .0025, -1.4, 1.4);
      }
    }
  } else if (CAM.drag) {
    CAM.yaw -= e.movementX * .006;
    CAM.pit = clamp(CAM.pit + e.movementY * .004, .02, 1.15);
  }
};
cv.onwheel = e => {
  CAM.dist = clamp(CAM.dist + e.deltaY * .03, 10, 70);
  e.preventDefault();
};

// Inicializa a interface e captura refs para o loop
const ui = setupUI();
const { rows, SL, rrows, hlm, btn, stx, mapTick } = ui;

let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000 || .016, .05);
  last = now;

  S.c += (S.t - S.c) * (1 - Math.exp(-dt * 1.1));
  const s = S.c;

  // Vento: direção/força suavizadas + rajadas
  WI.a += wrapA(WI.dir - WI.a) * (1 - Math.exp(-dt * .7));
  WI.s += (WI.str - WI.s) * (1 - Math.exp(-dt * .8));
  const bw = 3 + 16 * WI.s;
  const gustAt = (x, z) => clamp(1 + (.12 + .5 * WI.s) * 1.4 * (2 * vn((x - bw * Math.sin(WI.a) * now * .0006) * .035, (z - bw * Math.cos(WI.a) * now * .0006) * .035) - 1), .6, 1.7);
  const gu = gustAt(ST.px, ST.pz);
  const wang = WI.a + (.08 + .18 * WI.s) * Math.sin(now * .00011) + .1 * WI.s * Math.sin(now * .00037 + 2) + .12 * (gu - 1);
  WI.wsp = (3 + 16 * WI.s) * gu;
  const vwx = WI.wsp * Math.sin(wang), vwz = WI.wsp * Math.cos(wang);

  const sw = clamp(.55 * s + .6 * WI.s, 0, 1);
  SEAS.amp = .1 + 1.5 * Math.pow(sw, 1.6);
  SEAS.st = .2 + .18 * sw;
  SEAS.chop = .04 + .45 * sw;
  SEAS.wt += dt * (.5 + .6 * sw);
  setWaveDir(wang);
  updSea(sw);

  // Física do navio e dinâmica do casco
  const { hb, hs, hp, ht, hw0, ax, az } = updShipPhysics(dt, sw, gu, wang, vwx, vwz);
  const avx = vwx - ST.svx, avz = vwz - ST.svz;
  FL.a += wrapA(Math.atan2(-ax, -az) - FL.a) * (1 - Math.exp(-dt * 3));

  updGlow(dt, now);
  updGlowHelm(dt, now);
  updExtras(dt, Math.cos(ST.hd), Math.sin(ST.hd));
  updSpeedFx(dt);
  updAnchor(dt);
  updSun(dt);
  updAtmosphere(s, dt, now, vwx, vwz, avx, avz);

  // Balanço dinâmico do casco
  [vy, vyv] = so2(vy, vyv, (hb + hs + hp + ht + hw0) / 5 + .4, 1.6, .6, dt);
  [pt, ptv] = so2(pt, ptv, -Math.atan((hb - hs) / 10) * .8, 1.4, .5, dt);
  [rl, rlv] = so2(rl, rlv, Math.atan((ht - hp) / 4.4) * .55, 1.26, .4, dt);
  ship.position.y = vy;
  ship.rotation.set(pt, ST.hd, rl + ST.heel);
  fl.rotation.y = FL.a + Math.sin(SEAS.wt * 3) * (.12 + .2 * clamp(WI.wsp / 14, 0, 1));

  // Câmera FPV ou Orbital
  if (CAM.fpv) {
    updFPV(dt, rows, SL, rrows, hlm);
  } else {
    if (!CAM.drag && CAM.auto) CAM.yaw += dt * .04;
    const cx = Math.sin(CAM.yaw) * Math.cos(CAM.pit) * CAM.dist;
    const cz = Math.cos(CAM.yaw) * Math.cos(CAM.pit) * CAM.dist;
    cam.position.set(cx, Math.max(2.5 + Math.sin(CAM.pit) * CAM.dist, H(cx + ST.px, cz + ST.pz) + 2), cz);
    cam.lookAt(0, 4.5, 0);
    cam.rotateZ(Math.sin(now * .0008) * .035 * s);
  }

  // Efeito FOV de velocidade
  const f = 60 + 13 * FX.SPD * FX.SPD;
  if (Math.abs(cam.fov - f) > .05) {
    cam.fov = f;
    cam.updateProjectionMatrix();
  }

  updWindHud(wang);

  const mi = s < .25 ? 0 : s < .72 ? 1 : 2;
  if (mi !== UIS.mode) {
    UIS.mode = mi;
    if (stx) stx.textContent = ['Mar calmo', 'Ondas', 'Tempestade'][mi];
    btn.forEach((b, i) => b.classList.toggle('on', i === mi));
  }

  ILHAS.update(ST.px, ST.pz, dt);
  mapTick(dt);
  R.render(sc, cam);
}

// Inicialização de partida
setFpv(true);
const mn = document.getElementById('mn');
if (mn) mn.onclick();

const s0 = ILHAS.startPos();
ST.px = s0.x;
ST.pz = s0.z;
AN.ax = ST.px;
AN.az = ST.pz + 5;
ILHAS.update(ST.px, ST.pz, 0);
ILHAS.prime();

requestAnimationFrame(loop);
