import * as THREE from 'three';
import { clamp, wrapA } from './core/math.js';
import { R, sc, cam, cv } from './core/renderer.js';
import { S, WI, ST, SEAS, CAM, UIS, FX, FL, AN, INT, fp, keys, joy, lk, GAME, PL } from './core/state.js';
import { setWaveDir, H, updSea } from './world/ocean.js';
import { ILHAS } from './world/archipelago.js';
import { updExtras, updSpeedFx, vn, updSun, updAtmosphere } from './world/weather.js';
import { ship, fl } from './ship/ship.js';
import { updShipPhysics } from './ship/physics.js';
import { setFpv, resetPlayer, updFPV, updGlow, updGlowHelm, qD } from './ship/player.js';
import { setupUI, updWindHud, updAnchor } from './ui.js';
import { isRadialMenuOpen, updateRadialSelectionByDirection, executeSelectedRadialAction } from './radialMenu.js';
import './pwa.js';

let vy = 0, pt = 0, rl = 0;
let vyv = 0, ptv = 0, rlv = 0;
const so2 = (x, v, tg, w, z, dt) => {
  v += (w * w * (tg - x) - 2 * z * w * v) * dt;
  return [x + v * dt, v];
};

// Variáveis e vetores de interpolação da transição para FPV
let transStart = 0;
const TRANS_DURATION = 0.8; // Transição rápida de 0.8s sincronizada com o fade-out do menu
const startCamPos = new THREE.Vector3();
const startCamQuat = new THREE.Quaternion();
const targetWorldPos = new THREE.Vector3();
const targetWorldQuat = new THREE.Quaternion();
const dummyHead = new THREE.Object3D();
dummyHead.rotation.order = 'YXZ';

export function startPlayTransition() {
  if (GAME.state !== 'MENU') return;
  GAME.state = 'TRANSITION';
  GAME.canControl = false;

  // Garante que a posição/estado do player está limpa antes da interpolação
  fp.x = 0;
  fp.y = .35;
  fp.z = .9;
  fp.yaw = Math.PI;
  fp.pit = 0;
  PL.m = 'ship';
  PL.air = false;
  PL.vy = 0;
  PL.wet = false;

  // Fade out na tela inicial
  const titleScreen = document.getElementById('title-screen');
  if (titleScreen) {
    titleScreen.classList.add('fade-out');
  }

  // Desativa interação do jogador e travas de ponteiro
  INT.grab = null;
  INT.near = null;
  INT.tHold = INT.tFree = INT.tJump = INT.tDec = INT.tInc = false;
  for (const k in keys) keys[k] = 0;
  joy.id = lk.id = -1;
  joy.dx = joy.dy = 0;

  // Garante que a câmera está no cenário global para interpolação limpa
  sc.add(cam);
  cam.rotation.order = 'XYZ';
  startCamPos.copy(cam.position);
  startCamQuat.copy(cam.quaternion);
  transStart = performance.now();
}

export function returnToMenu() {
  GAME.state = 'MENU';
  GAME.canControl = false;
  CAM.fpv = false;
  CAM.auto = true;
  setFpv(false);
  CAM.dist = 28;
  CAM.pit = 0.22;
  CAM.yaw = 0.8;

  const titleScreen = document.getElementById('title-screen');
  if (titleScreen) {
    titleScreen.style.display = 'flex';
    titleScreen.classList.remove('fade-out');
  }

  const ingameBtn = document.getElementById('btn-ingame-menu');
  if (ingameBtn) ingameBtn.style.display = 'none';

  document.querySelectorAll('.in-game-hud').forEach(el => el.classList.add('game-hud-hidden'));
}

// Câmera orbital, FPV e controles de toque do ponteiro com joystick visual
const isTouchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;
if (isTouchCapable) {
  document.body.classList.add('touch-device');
}

const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const showJoystick = (x, y) => {
  if (joyBase && isTouchCapable) {
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
  if (GAME.state === 'MENU') {
    CAM.drag = true;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    return;
  }
  if (GAME.state === 'TRANSITION' || !GAME.canControl) {
    return;
  }
  const isTouch = e.pointerType !== 'mouse' || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (CAM.fpv && !isTouch && e.button === 0) {
    if (document.pointerLockElement !== cv) {
      try { cv.requestPointerLock(); } catch (_) {}
    }
  }
  if (CAM.fpv && isTouch) {
    if (e.clientX < window.innerWidth * 0.5 && joy.id < 0) {
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
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
};

window.addEventListener('pointerup', e => {
  CAM.drag = false;
  if (e.pointerId === joy.id) {
    joy.id = -1;
    joy.dx = joy.dy = 0;
    hideJoystick();
  }
  if (e.pointerId === lk.id) {
    lk.id = -1;
  }
});

window.addEventListener('pointercancel', e => {
  CAM.drag = false;
  if (e.pointerId === joy.id) {
    joy.id = -1;
    joy.dx = joy.dy = 0;
    hideJoystick();
  }
  if (e.pointerId === lk.id) {
    lk.id = -1;
  }
});

window.addEventListener('pointermove', e => {
  if (isRadialMenuOpen()) {
    return;
  }

  if (GAME.state === 'MENU') {
    if (CAM.drag) {
      CAM.yaw -= e.movementX * .006;
      CAM.pit = clamp(CAM.pit + e.movementY * .004, .02, 1.15);
    }
    return;
  }
  if (GAME.state === 'TRANSITION' || !GAME.canControl) return;
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
});
cv.onwheel = e => {
  if (GAME.state === 'MENU' || !CAM.fpv) {
    CAM.dist = clamp(CAM.dist + e.deltaY * .03, 10, 70);
    e.preventDefault();
  }
};

// Inicializa a interface e captura refs para o loop
const ui = setupUI({
  onPlay: startPlayTransition,
  onReturnMenu: returnToMenu
});
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

  // Câmera FPV, Orbital ou Transição
  if (GAME.state === 'MENU') {
    // Menu: rotação lenta e suave ao redor do galeão
    if (!CAM.drag && CAM.auto) CAM.yaw += dt * .04;
    const cx = Math.sin(CAM.yaw) * Math.cos(CAM.pit) * CAM.dist;
    const cz = Math.cos(CAM.yaw) * Math.cos(CAM.pit) * CAM.dist;
    cam.position.set(cx, Math.max(2.5 + Math.sin(CAM.pit) * CAM.dist, H(cx + ST.px, cz + ST.pz) + 2), cz);
    cam.lookAt(0, 4.2, 0);
    cam.rotateZ(Math.sin(now * .0008) * .035 * s);
  } else if (GAME.state === 'TRANSITION') {
    const elapsed = (now - transStart) / 1000;
    const t = Math.min(elapsed / TRANS_DURATION, 1);
    // Curva cúbica suave (ease-in-out)
    const ease = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Garante que a matriz global de transformação do navio está 100% atualizada
    ship.updateMatrixWorld(true);

    // Converte posição dos olhos do jogador para o espaço global
    targetWorldPos.set(fp.x, fp.y + 1.65, fp.z);
    ship.localToWorld(targetWorldPos);

    // Converte orientação FPV para o espaço global
    dummyHead.rotation.set(fp.pit, fp.yaw, 0);
    dummyHead.position.set(fp.x, fp.y + 1.65, fp.z);
    dummyHead.updateMatrix();
    const worldMat = ship.matrixWorld.clone().multiply(dummyHead.matrix);
    targetWorldQuat.setFromRotationMatrix(worldMat);

    cam.position.lerpVectors(startCamPos, targetWorldPos, ease);
    cam.quaternion.slerpQuaternions(startCamQuat, targetWorldQuat, ease);

    if (t >= 1) {
      // Transição completamente concluída! Ativa o FPV
      GAME.state = 'PLAY';
      GAME.canControl = true;
      setFpv(true);

      const titleScreen = document.getElementById('title-screen');
      if (titleScreen) titleScreen.style.display = 'none';

      document.querySelectorAll('.in-game-hud').forEach(el => el.classList.remove('game-hud-hidden'));

      const ingameBtn = document.getElementById('btn-ingame-menu');
      if (ingameBtn) ingameBtn.style.display = 'flex';
    }
  } else if (CAM.fpv) {
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

// Inicialização no Menu Inicial com câmera livre orbitando
GAME.state = 'MENU';
GAME.canControl = false;
CAM.fpv = false;
CAM.auto = true;
CAM.dist = 28;
CAM.pit = 0.22;
CAM.yaw = 0.8;
sc.add(cam);
cam.rotation.order = 'XYZ';
cam.near = .5;
cam.updateProjectionMatrix();

// Oculta HUD de jogo enquanto estiver no menu
document.querySelectorAll('.in-game-hud').forEach(el => el.classList.add('game-hud-hidden'));

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
