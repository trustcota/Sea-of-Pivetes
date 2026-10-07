import * as THREE from 'three';
import { clamp, wrapA, D2 } from '../core/math.js';
import { GC } from '../core/palettes.js';
import { sc, cam, cv } from '../core/renderer.js';
import { ST, INT, PL, CAM, AN, HM, fp, keys, joy, lk, GAME } from '../core/state.js';
import { H } from '../world/ocean.js';
import { ILHAS } from '../world/archipelago.js';
import { SH } from './ship.js';
import { updateRadialOrdersVisibility } from '../radialMenu.js';

const T = THREE;
const _v = new T.Vector3();

export const mk = new T.Mesh(
  new T.TorusGeometry(.2, .025, 6, 20),
  new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .9, fog: false })
);
mk.rotation.x = Math.PI / 2;
mk.visible = false;
SH.ship.add(mk);

// Elementos HUD de interação
const E$ = id => document.getElementById(id);
export const pr = E$('pr'), gg = E$('gg'), gl = E$('gl'), gf = E$('gf'), gv = E$('gv'), gb = E$('gb'), gq = E$('gq'), gj = E$('gj'), gdec = E$('gdec'), ginc = E$('ginc');

if (gb) {
  gb.onpointerdown = e => { if (!GAME.canControl) return; INT.tHold = true; try { gb.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); };
  gb.onpointerup = gb.onpointercancel = () => { INT.tHold = false; };
}
if (gj) {
  gj.onpointerdown = e => { if (!GAME.canControl) return; INT.tJump = true; try { gj.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); };
  gj.onpointerup = gj.onpointercancel = () => { INT.tJump = false; };
}
if (gq) {
  gq.onpointerdown = e => { if (!GAME.canControl) return; INT.tFree = true; try { gq.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); };
  gq.onpointerup = gq.onpointercancel = () => { INT.tFree = false; };
}
if (gdec) {
  gdec.onpointerdown = e => { if (!GAME.canControl) return; INT.tDec = true; try { gdec.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); };
  gdec.onpointerup = gdec.onpointercancel = () => { INT.tDec = false; };
}
if (ginc) {
  ginc.onpointerdown = e => { if (!GAME.canControl) return; INT.tInc = true; try { ginc.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); };
  ginc.onpointerup = ginc.onpointercancel = () => { INT.tInc = false; };
}

export function qD() {
  return !!(keys.KeyQ || INT.tFree);
}

export function hud() {
  const on = CAM.fpv && GAME.canControl && GAME.state === 'PLAY';
  if (!gb) return;
  if (!on) {
    if (gb) gb.classList.remove('on');
    if (gj) gj.classList.remove('on');
    if (pr) pr.classList.remove('on');
    if (gq) gq.classList.remove('on');
    if (gg) gg.classList.remove('on');
    if (gdec) gdec.classList.remove('on');
    if (ginc) ginc.classList.remove('on');
    return;
  }
  gb.textContent = INT.grab ? 'Soltar' : (INT.near && INT.near.t === 'ladder' ? 'Escada' : 'Pegar');
  gj.textContent = 'Pular';
  gj.classList.toggle('on', on && !INT.grab);
  pr.classList.toggle('on', on && !!INT.near && !INT.grab);
  gb.classList.toggle('on', on && !!INT.near);
  gq.classList.toggle('on', on && !!INT.grab);
  gg.classList.toggle('on', on && !!INT.grab);

  const showDecInc = on && (PL.m === 'climb' || (INT.grab && (INT.grab.t === 'hoist' || INT.grab.t === 'rot')));
  if (gdec && ginc) {
    gdec.classList.toggle('on', showDecInc);
    ginc.classList.toggle('on', showDecInc);
    if (showDecInc) {
      if (PL.m === 'climb') {
        gdec.textContent = 'S';
        ginc.textContent = 'W';
      } else if (INT.grab && INT.grab.t === 'hoist') {
        gdec.textContent = '–';
        ginc.textContent = '+';
      } else if (INT.grab && INT.grab.t === 'rot') {
        gdec.textContent = '←';
        ginc.textContent = '→';
      }
    }
  }

  if (on && INT.near && !INT.grab) {
    pr.textContent = INT.near.label;
  }

  if (on && INT.grab) {
    const it = INT.grab;
    gl.textContent = it.label;
    gg.classList.toggle('r', it.t !== 'hoist' && it.t !== 'anchor');
    gg.classList.toggle('lim', INT.limHit);

    if (it.t === 'hoist') {
      const t = it.sail.t;
      gf.style.left = '0';
      gf.style.width = t * 100 + '%';
      gv.textContent = Math.round(t * 100) + '% Aberta';
    } else if (it.t === 'anchor') {
      gf.style.left = '0';
      gf.style.width = (AN.hold > 0 ? AN.hold / 2 : AN.d) * 100 + '%';
      gv.textContent = AN.hold > 0 ? 'Lançando...' : AN.d < .05 && AN.t < .5 ? 'Recolhida' : (AN.set ? 'Fundeada' : Math.round(AN.d * 100) + '% Lançada');
    } else if (it.t === 'helm') {
      const t = HM.t;
      gf.style.left = (t < 0 ? 50 + 50 * t : 50) + '%';
      gf.style.width = Math.abs(t) * 50 + '%';
      gv.textContent = Math.round(Math.abs(t) * 100) + '% ' + (t > .02 ? 'Estibordo' : t < -.02 ? 'Bombordo' : 'Reto');
    } else {
      const t = it.rg.t / it.rg.lim;
      gf.style.left = (t < 0 ? 50 + 50 * t : 50) + '%';
      gf.style.width = Math.abs(t) * 50 + '%';
      gv.textContent = Math.round(it.rg.t / D2) + '°';
    }
  }
}

export function hudMode(msg, gbTxt) {
  if (!pr) return;
  pr.textContent = msg || '';
  pr.classList.toggle('on', !!msg);
  gb.textContent = gbTxt || 'Pegar';
  gb.classList.toggle('on', !!gbTxt);
  gq.classList.remove('on');
  gg.classList.remove('on');
  gj.textContent = PL.m === 'climb' ? 'Soltar' : 'Pular';
  gj.classList.toggle('on', PL.m !== 'swim');

  const showDecInc = CAM.fpv && PL.m === 'climb';
  if (gdec && ginc) {
    gdec.classList.toggle('on', showDecInc);
    ginc.classList.toggle('on', showDecInc);
    if (showDecInc) {
      gdec.textContent = 'S';
      ginc.textContent = 'W';
    }
  }
}

export function setFpv(on) {
  CAM.fpv = on;
  if (on) resetPlayer();
  const fv = document.getElementById('fv');
  const hint = document.getElementById('hint');
  if (fv) {
    fv.classList.toggle('on', on);
    fv.textContent = on ? 'Voltar à visão livre' : 'Entrar no navio (FPV)';
  }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (on) {
    SH.ship.add(cam);
    cam.rotation.order = 'YXZ';
    cam.near = .08;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      try { cv.requestPointerLock(); } catch (_) {}
    }
  } else {
    INT.grab = null;
    INT.near = null;
    mk.visible = false;
    hud();
    sc.add(cam);
    cam.rotation.order = 'XYZ';
    cam.near = .5;
    if (document.pointerLockElement) document.exitPointerLock();
    for (const k in keys) keys[k] = 0;
    joy.id = lk.id = -1;
    joy.dx = joy.dy = 0;
    INT.tFree = false;
  }
  cam.updateProjectionMatrix();
  if (hint) {
    hint.textContent = on
      ? 'Mouse olha ao redor (clique na tela se o cursor estiver solto) · WASD mover · Shift correr · E interagir · Espaço pular · Q Ordens do Capitão · V alterna · Esc libera o cursor'
      : 'Arraste para girar · role para aproximar';
  }
  updateRadialOrdersVisibility();
}

export const aimPt = it => it.t === 'anchor' ? it.pos : it.t === 'hoist' ? it.sail.hr.position : it.t === 'helm' ? it.pos : SH.sails.find(x => x.rg === it.rg).rop[it.k > 0 ? 0 : 1].position;

export function updInter(dt, rows, SL, rrows, hlm) {
  if (!INT.grab) {
    let b = null, bd = 1.0;
    for (const it of SH.inter) {
      const dx = it.pos.x - fp.x, dz = it.pos.z - fp.z;
      const d = Math.hypot(dx, dz);
      // Verifica distância e se o jogador está olhando na direção do objeto (cone de visão de ~130°)
      const dot = -Math.sin(fp.yaw) * (dx / (d || 1)) - Math.cos(fp.yaw) * (dz / (d || 1));
      if (d < bd && Math.abs(it.pos.y - fp.y) < 2 && dot > 0.4) {
        bd = d; b = it;
      }
    }
    let ld = null;
    const s = fp.x < 0 ? -1 : 1;
    const dotL = -Math.sin(fp.yaw) * s;
    if (Math.abs(fp.z - 2.1) < .9 && Math.abs(fp.x) > 0.7 && fp.y < .6 && dotL > 0.4) {
      ld = { t: 'ladder', s, pos: new T.Vector3(s * 1.5, 1, 2.1), label: 'Escada de cordas' };
    }
    INT.near = ld || b;
  }

  const hold = !!(keys.KeyE || INT.tHold);
  if (hold && !INT.ePrev) {
    if (INT.grab) {
      INT.grab = null; INT.pX = INT.pY = 0;
    } else if (INT.near) {
      if (INT.near.t === 'ladder') {
        const ladObj = SH.ladders.find(l => l.side === INT.near.s);
        startClimb(ladObj, false);
        INT.ePrev = hold;
        updClimb(dt);
        return;
      }
      INT.grab = INT.near;
      INT.pX = INT.pY = 0;
    }
  }
  INT.ePrev = hold;
  INT.limHit = false;
  mk.visible = !!INT.near;

  if (INT.near) {
    mk.position.copy(INT.near.pos);
    mk.material.color.set(INT.near.t === 'rot' ? 0xff6a55 : 0xffe08a);
    mk.scale.setScalar(1 + .18 * Math.sin(performance.now() * .008));
  }

  if (INT.grab) {
    const it = INT.grab, K = (a, b) => (keys[a] ? 1 : 0) - (keys[b] ? 1 : 0), f = Math.min(1, dt * 6);
    if (!qD() && it.t !== 'helm' && it.t !== 'anchor') {
      const ap = aimPt(it), dx = ap.x - fp.x, dz = ap.z - fp.z;
      fp.yaw += wrapA(Math.atan2(-dx, -dz) - fp.yaw) * f;
      fp.pit += (Math.atan2(ap.y - (fp.y + 1.65), Math.hypot(dx, dz) + .001) - fp.pit) * f;
    }

    if (it.t === 'hoist') {
      const btnVal = (INT.tDec ? -1 : 0) + (INT.tInc ? 1 : 0);
      const v = INT.pY * .004 + (K('KeyS', 'KeyW') + K('ArrowDown', 'ArrowUp') + btnVal) * .5 * dt, sl2 = it.sail, n = clamp(sl2.t + v, 0, 1);
      INT.limHit = Math.abs(v) > .0005 && Math.abs(n - (sl2.t + v)) > 1e-6;
      sl2.t = n;
      if (rows && SL) {
        const r = rows[SL.indexOf(sl2)];
        if (r) { r.i.value = n * 100; r.b.textContent = Math.round(n * 100) + '%'; }
      }
    } else if (it.t === 'anchor') {
      const dn = keys.KeyS || keys.ArrowDown || joy.dy > .5, up = keys.KeyW || keys.ArrowUp || joy.dy < -.5;
      if (up) {
        AN.t = 0; AN.up = 1; AN.wnow = 1; AN.hold = 0;
      } else if (dn && AN.t < .5 && AN.d < .05) {
        AN.hold += dt;
        if (AN.hold >= 2) { AN.t = 1; AN.hold = 0; }
      } else {
        AN.hold = 0;
      }
    } else if (it.t === 'helm') {
      const v = (K('KeyD', 'KeyA') + K('ArrowRight', 'ArrowLeft') + joy.dx) * .5 * dt, n = clamp(HM.t + v, -1, 1);
      INT.limHit = Math.abs(v) > .0005 && Math.abs(n - (HM.t + v)) > 1e-6;
      HM.t = n;
      if (hlm) hlm.value = n * 100;
    } else {
      const btnVal = (INT.tDec ? -1 : 0) + (INT.tInc ? 1 : 0);
      const g = it.rg, sg = Math.sign(Math.cos(fp.yaw)) || 1, v = sg * (INT.pX * .002 + (K('KeyD', 'KeyA') + K('ArrowRight', 'ArrowLeft') + btnVal) * .5 * dt), n = clamp(g.t + v, -g.lim, g.lim);
      INT.limHit = Math.abs(v) > .0005 && Math.abs(n - (g.t + v)) > 1e-6;
      g.t = n;
      if (rrows) {
        const i = rrows[SH.rigs.indexOf(g)];
        if (i) {
          i.value = n / g.lim * 100;
          if (i.nextSibling) i.nextSibling.textContent = Math.round(n / D2) + '°';
        }
      }
    }
    INT.pX = INT.pY = 0;
  }
  hud();
}

export function updGlow(dt, now) {
  const pu = .55 + .25 * Math.sin(now * .008);
  for (const so of SH.sails) {
    const on = !INT.grab ? 0 : INT.grab.t === 'hoist' ? (INT.grab.sail === so ? 'h' : 0) : (INT.grab.rg === so.rg ? 'r' : 0);
    for (const g of so.gl) {
      const tg = on && (g.t === 's' || g.t === on) ? 1 : 0;
      g.k += (tg - g.k) * Math.min(1, dt * 10);
      if (g.k < .003) g.k = 0;
      const m = g.o.material;
      if (on && tg) m.emissive.copy(GC[on]);
      m.emissiveIntensity = g.k * pu;
      if (g.t !== 's') g.o.scale.x = g.o.scale.z = 1 + 1.4 * g.k;
    }
  }
}

export function updGlowHelm(dt, now) {
  const pu = .55 + .25 * Math.sin(now * .008);
  for (const g of SH.whg) {
    const tg = INT.grab && INT.grab.t === 'helm' ? 1 : 0;
    g.k += (tg - g.k) * Math.min(1, dt * 10);
    if (g.k < .003) g.k = 0;
    const m = g.o.material;
    if (tg) m.emissive.copy(GC.h);
    m.emissiveIntensity = g.k * pu;
  }
}

/* ===== Jogador: pulo, escada de cordas, queda ao mar e nado ===== */
export const eEdge = () => {
  const h = !!(keys.KeyE || INT.tHold), p = h && !INT.ePrev;
  INT.ePrev = h;
  return p;
};

export function resetPlayer() {
  const was = PL.m;
  PL.m = 'ship';
  PL.air = false;
  PL.vy = 0;
  PL.wet = false;
  if (was !== 'ship') {
    fp.x = 0; fp.y = .35; fp.z = .9; fp.yaw = Math.PI; fp.pit = 0;
  }
  if (CAM.fpv) SH.ship.add(cam);
}

export function toWorld() {
  SH.ship.updateMatrixWorld(true);
  _v.set(fp.x, fp.y, fp.z);
  SH.ship.localToWorld(_v);
  PL.wx = ST.px + _v.x;
  PL.wz = ST.pz + _v.z;
  PL.y = _v.y;
}

export function goOverboard(wdx, wdz) {
  toWorld();
  fp.yaw += ST.hd;
  PL.m = 'swim';
  PL.air = true;
  PL.wet = false;
  PL.vx = ST.svx + wdx;
  PL.vz = ST.svz + wdz;
  INT.grab = null;
  sc.add(cam);
  cam.rotation.order = 'YXZ';
}

export function startClimb(ladObj, fromWater) {
  const sh = SH.ship;
  PL.m = 'climb';
  PL.ladder = ladObj;
  PL.s = ladObj.side;
  PL.air = false;
  PL.vy = 0;
  PL.wet = false;
  INT.grab = null;
  if (fromWater) {
    sh.updateMatrixWorld(true);
    _v.set(PL.wx - ST.px, Math.max(PL.y + 1.65, H(PL.wx, PL.wz) + .15), PL.wz - ST.pz);
    sh.worldToLocal(_v);
    PL.cy = clamp(_v.y - .65, ladObj.botY, ladObj.topY - .2);
  } else {
    PL.cy = ladObj.topY - .05;
  }
  fp.yaw = ladObj.side * Math.PI / 2;
  fp.pit = 0;
  sh.add(cam);
  cam.rotation.order = 'YXZ';
}

export function dropLadder(push) {
  const ch = Math.cos(ST.hd), sh = Math.sin(ST.hd), d = PL.s * push;
  PL.vy = 0;
  PL.ladder = null;
  goOverboard(d * ch, -d * sh);
}

export function updClimb(dt) {
  if (!GAME.canControl || !PL.ladder) return;
  const lad = PL.ladder, s = PL.s;
  eEdge();
  const btnVal = (INT.tInc ? 1 : 0) - (INT.tDec ? 1 : 0);
  const up = clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.dy + btnVal, -1, 1);
  PL.cy += up * ((keys.ShiftLeft || keys.ShiftRight) ? 1.8 : 1.1) * dt;
  PL.cy = clamp(PL.cy, lad.botY - .5, lad.topY + .5);

  const t = clamp((lad.topY - PL.cy) / (lad.topY - lad.botY), 0, 1);
  const pt = lad.getPt(t, lad.LZ);
  fp.x = pt.x + s * 0.32;
  fp.z = pt.z;
  fp.y = PL.cy - 1;

  SH.ship.updateMatrixWorld(true);
  _v.set(fp.x, fp.y + 1.65, fp.z);
  SH.ship.localToWorld(_v);
  const wH = H(ST.px + _v.x, ST.pz + _v.z);
  if (keys.Space || INT.tJump) { dropLadder(.9); return updSwim(dt); }
  if (_v.y < wH + .12 && up < -.05) { dropLadder(.3); return updSwim(dt); }
  if (PL.cy > lad.topY + .3) {
    PL.m = 'ship'; PL.ladder = null; fp.x = s * 0.85; fp.z = 2.1; fp.y = .35; PL.air = false; PL.vy = 0;
  }
  cam.position.set(fp.x, fp.y + 1.65, fp.z);
  cam.rotation.set(fp.pit, fp.yaw, 0);
  if (PL.m === 'climb') hudMode('Escada'); else hud();
}

export function updSwim(dt) {
  if (!GAME.canControl) return;
  const sh = SH.ship, WK = SH.walk;
  sh.updateMatrixWorld(true);
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.dy,
    r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.dx;
  const l = Math.hypot(f, r);
  if (l > 1) { f /= l; r /= l; }

  const terH = ILHAS.tH(PL.wx, PL.wz);
  const onLand = terH >= ILHAS.SEA - .4;

  const sp = (keys.ShiftLeft || keys.ShiftRight) ? (onLand ? 3.8 : 3.0) : (onLand ? 2.2 : 1.7),
    sn = Math.sin(fp.yaw), cs = Math.cos(fp.yaw),
    k = PL.wet ? 1 : .25, mvx = (-sn * f + cs * r) * sp * k, mvz = (-cs * f - sn * r) * sp * k;

  if (PL.wet) {
    const d = Math.exp(-1.3 * dt);
    PL.vx *= d; PL.vz *= d;
  }

  PL.wx += (PL.vx + mvx) * dt;
  PL.wz += (PL.vz + mvz) * dt;

  const hw = H(PL.wx, PL.wz);
  const curTerH = ILHAS.tH(PL.wx, PL.wz);
  const targetY = Math.max(curTerH, hw - 1.3);

  if (PL.wet) {
    PL.y += (targetY - PL.y) * Math.min(1, dt * 8);
  } else {
    PL.vy -= 11 * dt;
    PL.y += PL.vy * dt;
    if (PL.y <= targetY) {
      PL.y = targetY;
      PL.wet = true;
      PL.vy = 0;
      PL.vx *= .5;
      PL.vz *= .5;
    }
  }

  // Pulo na praia ou ilha
  if (curTerH >= ILHAS.SEA - .4 && PL.wet && (keys.Space || INT.tJump)) {
    PL.vy = 4.2;
    PL.wet = false;
  }

  // Casco sólido e escadas: o nadador não atravessa
  _v.set(PL.wx - ST.px, PL.y + 1.6, PL.wz - ST.pz);
  sh.worldToLocal(_v);
  const lz = _v.z, ly = _v.y;
  if (lz > -6.4 && lz < 6.1) {
    const yc = clamp(ly, -1.3, WK.rY(lz)), hullEdge = WK.edge(lz, yc);
    let hwd = hullEdge + .3;

    // Colisão extra para as escadas dinâmicas
    if (Math.abs(lz - 2.1) < .8) {
      for (const lad of SH.ladders) {
        const t = clamp((lad.topY - ly) / (lad.topY - lad.botY), 0, 1);
        const pt = lad.getPt(t, lad.LZ);
        if (Math.abs(lz - pt.z) < .4) {
          hwd = Math.max(hwd, Math.abs(pt.x) + .35);
        }
      }
    }

    if (Math.abs(_v.x) < hwd) {
      _v.x = (_v.x < 0 ? -1 : 1) * hwd;
      sh.localToWorld(_v);
      PL.wx = ST.px + _v.x;
      PL.wz = ST.pz + _v.z;
    }
  }

  // Escada ao alcance?
  const ey = Math.max(PL.y + 1.65, hw + .15);
  let nearLad = null;
  _v.set(PL.wx - ST.px, ey, PL.wz - ST.pz);
  sh.worldToLocal(_v);
  if (PL.wet && Math.abs(_v.z - 2.1) < .85 && _v.y > -1.5 && _v.y < 1.5) {
    for (const lad of SH.ladders) {
      const t = clamp((lad.topY - _v.y) / (lad.topY - lad.botY), 0, 1);
      const pt = lad.getPt(t, lad.LZ);
      const dx = Math.abs(_v.x) - Math.abs(pt.x);
      const dz = Math.abs(_v.z - pt.z);
      if (dx > -.3 && dx < .8 && dz < .5) nearLad = lad;
    }
  }
  if (eEdge() && nearLad) {
    startClimb(nearLad, true);
    return updClimb(dt);
  }

  cam.position.set(PL.wx - ST.px, PL.y + 1.65, PL.wz - ST.pz);
  cam.rotation.set(fp.pit, fp.yaw, 0);

  const msg = nearLad
    ? 'Escada [E]'
    : curTerH >= ILHAS.SEA
      ? 'Na ilha'
      : 'Na água';

  hudMode(msg, nearLad ? 'Escada' : null);
}

export function updFPV(dt, rows, SL, rrows, hlm) {
  if (!GAME.canControl) return;
  if (PL.m === 'swim') return updSwim(dt);
  if (PL.m === 'climb') return updClimb(dt);

  const W = SH.walk, sp = (keys.ShiftLeft || keys.ShiftRight) ? 3.4 : 1.9;
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.dy,
    r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.dx;
  if (INT.grab) f = r = 0;
  const l = Math.hypot(f, r);
  if (l > 1) { f /= l; r /= l; }
  const sn = Math.sin(fp.yaw), cs = Math.cos(fp.yaw), mvx = (-sn * f + cs * r) * sp, mvz = (-cs * f - sn * r) * sp,
    nx = fp.x + mvx * dt, nz = fp.z + mvz * dt;

  if (PL.air) {
    const ok = (x, z) => {
      if (z < -5.7 || z > 4.3) return false;
      const y = W.g(x, z);
      if (y - fp.y > .3) return false;
      for (const o of W.ob) if (Math.hypot(x - o[0], z - o[1]) < o[2]) return false;
      return !(Math.abs(x) > W.edge(z, y) - .22 && fp.y <= W.rY(z) + .1);
    };
    if (ok(nx, fp.z)) fp.x = nx;
    if (ok(fp.x, nz)) fp.z = nz;
  } else {
    if (W.ok(nx, fp.z, fp.x, fp.z)) fp.x = nx;
    if (W.ok(fp.x, nz, fp.x, fp.z)) fp.z = nz;
    if (!INT.grab && (keys.Space || INT.tJump)) {
      PL.vy = 4.8;
      PL.air = true;
    }
  }

  if (PL.air) {
    PL.vy -= 11 * dt;
    fp.y += PL.vy * dt;
    const g = W.g(fp.x, fp.z), out = Math.abs(fp.x) - W.wr(fp.z);
    if (out > .08 || (fp.y <= g && out > 0)) {
      const ch = Math.cos(ST.hd), sh = Math.sin(ST.hd);
      goOverboard(mvx * ch + mvz * sh, -mvx * sh + mvz * ch);
      return updSwim(dt);
    }
    if (fp.y <= g && PL.vy <= 0) {
      fp.y = g; PL.vy = 0; PL.air = false;
    }
  } else {
    fp.y += (W.g(fp.x, fp.z) - fp.y) * Math.min(1, dt * 10);
  }

  if (PL.air) {
    INT.near = null;
    mk.visible = false;
    hud();
  } else {
    updInter(dt, rows, SL, rrows, hlm);
  }

  cam.position.set(fp.x, fp.y + 1.65, fp.z);
  cam.rotation.set(fp.pit, fp.yaw, 0);
}
