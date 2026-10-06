import { clamp, wrapA } from '../core/math.js';
import { SEAS, ST, WI, HM, AN } from '../core/state.js';
import { H } from '../world/ocean.js';
import { ILHAS } from '../world/archipelago.js';
import { SH } from './ship.js';

// Matrizes de características e posições das velas
const SP = {
  Grande: [5.1, 3.65, .5],
  'Gávea': [7.9, 6.75, .5],
  Joanete: [9.6, 9, .5],
  Bujarrona: [7.5, 4.6, 4.5],
  Mezena: [7.2, 5.3, -4.2]
};

const SDm = {
  Grande: [.2, 6.2, 1.45],
  'Gávea': [.2, 4.8, 1.15],
  Joanete: [.2, 3.2, .6],
  Bujarrona: [4.8, 1.5, 2.2],
  Mezena: [-4.3, 1.5, 1.9]
};

const ycOf = o => {
  const p = SP[o.name];
  return p[0] - (p[0] - p[1]) * o.d;
};

const shade = (x, wx, wz, yc) => {
  const W = Math.hypot(wx, wz) + .001, ux = wx / W, uz = wz / W, me = SDm[x.name];
  if (!me || Math.abs(uz) < .1) return 1;
  let k = 1;
  for (const o of SH.sails) {
    const ot = SDm[o.name];
    if (o === x || o.d < .2 || !ot) continue;
    const dz = me[0] - ot[0];
    if (Math.abs(dz) < 1 || dz * uz <= 0) continue;
    const ds = Math.abs(dz), miss = Math.abs(dz * ux / uz), half = ot[1] / 2 + me[1] / 2 + .3 * ds,
      fl = clamp(1 - (miss / half) ** 2, 0, 1), ho = clamp(1 - Math.abs(ycOf(o) - yc) / (ot[2] + me[2]), 0, 1);
    k *= 1 - .4 * Math.exp(-ds / 9) * fl * ho * o.d;
  }
  return k;
};

/**
 * Atualiza toda a hidrodinâmica, aerodinâmica e dinâmica de casco do navio
 */
export function updShipPhysics(dt, sw, gu, wang, vwx, vwz) {
  // Rotação suave das vergas e abertura das velas
  for (const g of SH.rigs) {
    g.a += (g.t - g.a) * (1 - Math.exp(-dt * 2.2));
    if (g.piv) g.piv.rotation.y = g.a;
  }
  for (const x of SH.sails) {
    x.d += (x.t - x.d) * (1 - Math.exp(-dt * 2.4));
    if (Math.abs(x.t - x.d) < .002) x.d = x.t;
  }

  // Ondas sob o casco (referencial girado pelo rumo)
  const ch = Math.cos(ST.hd), sh = Math.sin(ST.hd);
  const hw = (lx, lz) => H(ST.px + lx * ch + lz * sh, ST.pz - lx * sh + lz * ch);
  const hb = hw(0, 5), hs = hw(0, -5), hp = hw(-2.2, 0), ht = hw(2.2, 0);

  // Vento + dinâmica: vento por altura, sustentação, estol, deriva, leme, banda
  HM.a += (HM.t - HM.a) * (1 - Math.exp(-dt * 3));
  SH.wh.rotation.z = HM.a * 1.6;

  const wlx = vwx * ch - vwz * sh, wlz = vwx * sh + vwz * ch;
  const ax = wlx - ST.sw, az = wlz - ST.v;

  let Fx = 0, Fz = 0, Mh = 0, Ty = 0, AT = 0, lf = 0;
  for (const x of SH.sails) {
    const sp = SP[x.name] || [6, 4, 0], yc = sp[0] - (sp[0] - sp[1]) * x.d;
    const hs2 = clamp(Math.pow(yc / 10, .11), .8, 1.05);
    const gst = 1; // Fator normalizado de rajada na altura da vela
    const bxx = hs2 * gst * wlx - ST.sw, bzz = hs2 * gst * wlz - ST.v;
    const shk = shade(x, bxx, bzz, yc), wx = bxx * shk, wz = bzz * shk, W = Math.hypot(wx, wz) + .001;
    const a = x.rg.a, Ar = x.ar * x.d;

    let nx, nz, fx, fz, fn;
    if (x.sq) {
      nx = Math.sin(a); nz = Math.cos(a);
    } else {
      nx = Math.cos(a); nz = -Math.sin(a);
    }

    const q = wx * nx + wz * nz, s = q < 0 ? -1 : 1, sn = Math.min(1, Math.abs(q) / W);
    if (!x.sq && -wx * Math.sin(a) - wz * Math.cos(a) < 0) {
      const pr = .6 * q * Math.abs(q);
      fx = pr * nx; fz = pr * nz; fn = pr;
    } else {
      const al = Math.asin(sn), cA = Math.max(.05, Math.cos(al)),
        CL = (x.sq ? 1.25 : 1.6) * Math.sin(2 * Math.min(al, .35)) * (al < .5 ? 1 : Math.max(.25, 1 - (al - .5) * 1.4)),
        CD = (x.sq ? .3 : .28) + 1.1 * sn * sn,
        ux = wx / W, uz = wz / W,
        lx = (s * nx - ux * sn) / cA, lz = (s * nz - uz * sn) / cA,
        k = x.sq ? (q < 0 ? .1 : .8) : .55;
      fx = k * W * W * (CL * lx + CD * ux);
      fz = k * W * W * (CL * lz + CD * uz);
      fn = fx * nx + fz * nz;
    }

    x.pt = clamp(fn / 60, -1, 1);
    x.fl = .12 + .9 * clamp(1 - Math.abs(wx * nx + wz * nz) / (W * .4), 0, 1) * clamp(W / 5, .25, 1.2) + .3 * WI.s;
    Fx += Ar * fx; Fz += Ar * fz; Mh += Ar * fx * yc; Ty += Ar * fx * (sp[2] - .3); AT += x.ar;
    if (x.d > .2 && Math.abs(x.pt) < .1) lf++;
    x.ps += (x.pt - x.ps) * (1 - Math.exp(-dt * 2.2));
    x.upd(SEAS.wt, x.ps, x.fl);
  }
  ST.fl = lf;

  const spl = Math.abs(ST.heel) > .35 ? Math.max(.03, 1 - (Math.abs(ST.heel) - .35) * 4) : 1;
  const eff = Math.cos(clamp(ST.heel * 1.6, -1.2, 1.2)) * spl;
  const kF = .0052, ar0 = Math.abs(ST.v), Vw2 = ST.v * ST.v + ST.sw * ST.sw, al = Math.atan2(Math.abs(ST.sw), ar0 + .3);
  const CLk = 3.2 * Math.sin(al) * (al < .35 ? 1 : Math.max(.3, 1 - (al - .35) * 1.8));
  const Fk = .02 * Vw2 * CLk;

  const acc = kF * Fz * eff / AT - (.003 * ar0 + .001 * (1 + .6 * sw) * ar0 * ar0 + .09 * Math.pow(Math.max(0, ar0 - 6), 2) + .22 * Math.pow(Math.max(0, ar0 - 7.5), 3) + .01 * Math.abs(HM.a) * ar0 * ar0) * Math.sign(ST.v) - Fk * Math.sin(al) * Math.sign(ST.v) - (hb - hs) / 10 * .22 - .004 * SEAS.amp * SEAS.amp * .5 * (1 - (sh * Math.sin(wang) + ch * Math.cos(wang))) * ar0 * Math.sign(ST.v);
  ST.v = clamp(ST.v + (acc + ST.sw * ST.r) * dt, -1.5, 12);
  ST.sw += (kF * Fx * eff / AT - (ST.sw > 0 ? 1 : -1) * Fk * Math.cos(al) - .1 * ST.sw - .25 * ST.sw * Math.abs(ST.sw) - ST.v * ST.r) * dt;

  const rud = -Math.sin(HM.a * .6) * (1 - .2 * Math.max(0, Math.abs(HM.a) - .7) / .3) * .02 * ST.v * Math.abs(ST.v);
  ST.r += ((3e-4 * Ty / AT + .008 * SEAS.amp * Math.sin(SEAS.wt * .35) + rud - (1.1 + .12 * ar0) * ST.r) / 7) * dt;
  ST.hd += ST.r * dt;

  // Arrasto e retenção da âncora
  if (AN.d > .97) {
    const k = AN.set ? .8 : .25;
    ST.v *= Math.exp(-k * dt);
    ST.sw *= Math.exp(-k * dt);
    ST.r *= Math.exp(-(AN.set ? 1.5 : .6) * dt);
    if (!AN.set && Math.abs(ST.v) < .9 && Math.abs(ST.sw) < .9) {
      AN.set = 1;
      AN.ax = ST.px + sh * 5;
      AN.az = ST.pz + ch * 5;
    }
  } else {
    AN.set = 0;
  }

  // Deslocamento no mundo
  const sx = ST.v * sh + ST.sw * ch, sz = ST.v * ch - ST.sw * sh;
  let vx = sx, vz = sz;
  const ox = ST.px, oz = ST.pz;
  const cvx = .025 * vwx + .06 * SEAS.amp * Math.sin(wang), cvz = .025 * vwz + .06 * SEAS.amp * Math.cos(wang);
  ST.px += (sx + cvx) * dt;
  ST.pz += (sz + cvz) * dt;
  ST.svx = vx + cvx;
  ST.svz = vz + cvz;

  // Colisão com as ilhas
  if (ILHAS.hit(ST.px, ST.pz, ST.hd)) {
    const nx = ST.px, nz = ST.pz;
    ST.px = ox; ST.pz = nz;
    if (ILHAS.hit(ST.px, ST.pz, ST.hd)) {
      ST.px = nx; ST.pz = oz;
      if (ILHAS.hit(ST.px, ST.pz, ST.hd)) {
        ST.px = ox; ST.pz = oz;
      }
    }
    const kk = Math.exp(-2.5 * dt);
    ST.v *= kk;
    ST.sw *= kk;
    ST.svx = (ST.px - ox) / dt;
    ST.svz = (ST.pz - oz) / dt;
  }

  // Cabo e raio da âncora fundeada
  if (AN.set) {
    const tx = ST.px + sh * 5 - AN.ax, tz = ST.pz + ch * 5 - AN.az, tr = Math.hypot(tx, tz), Lc = 9;
    if (tr > Lc) {
      const tnx = tx / tr, tnz = tz / tr;
      ST.px -= tnx * (tr - Lc);
      ST.pz -= tnz * (tr - Lc);
      let wx2 = ST.v * sh + ST.sw * ch, wz2 = ST.v * ch - ST.sw * sh;
      const out = wx2 * tnx + wz2 * tnz;
      if (out > 0) {
        wx2 -= out * tnx; wz2 -= out * tnz;
        ST.v = wx2 * sh + wz2 * ch;
        ST.sw = wx2 * ch - wz2 * sh;
        ST.svx = wx2; ST.svz = wz2;
      }
    }
    if (tr > Lc * .6) ST.r += wrapA(Math.atan2(AN.ax - ST.px, AN.az - ST.pz) - ST.hd) * .5 * dt;
  }

  // Banda e momento restaurador
  const Hm = Mh / AT * .0012 * spl - .16 * ST.v * ST.r, ph = ST.heel;
  const R = Math.abs(ph) <= .58 ? Math.sin(ph) * (1 - Math.pow(ph / 1.1, 2)) : Math.sign(ph) * .396 * Math.max(.25, 1 - (Math.abs(ph) - .58) * 1.1);
  ST.hr += ((-Hm - R) - (.55 + 16 * Math.abs(Hm) / Math.max(2, Math.hypot(ax, az))) * ST.hr) / 2.2 * dt;
  ST.heel = clamp(ph + ST.hr * dt, -1.2, 1.2);

  // Retorna dados para o balanceio do casco
  return { hb, hs, hp, ht, hw0: hw(0, 0), ax, az };
}
