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
  
  // Log de depuração (limitado para evitar inundar o console)
  if (Math.random() < 0.01) {
    const wlx = vwx * Math.cos(ST.hd) - vwz * Math.sin(ST.hd);
    const wlz = vwx * Math.sin(ST.hd) + vwz * Math.cos(ST.hd);
    console.log('--- Debug Velas ---');
    console.log('Vento Relativo (dir):', Math.atan2(wlx, wlz) * 180 / Math.PI);
    SH.rigs.forEach(r => console.log(`Rig ${r.name}: angulo ${ (r.a * 180 / Math.PI).toFixed(1) }`));
  }

  for (const x of SH.sails) {
    x.d += (x.t - x.d) * (1 - Math.exp(-dt * 2.4));
    if (Math.abs(x.t - x.d) < .002) x.d = x.t;
  }
  for (const l of SH.ladders) {
    l.upd(dt, SEAS.wt, ST.heel, ST.pt, ST.svx, ST.svz, vwx, vwz);
  }

  // Ondas sob o casco (referencial girado pelo rumo)
  const ch = Math.cos(ST.hd), sh = Math.sin(ST.hd);
  const hw = (lx, lz) => H(ST.px + lx * ch + lz * sh, ST.pz - lx * sh + lz * ch);
  const hb = hw(0, 5), hs = hw(0, -5), hp = hw(-2.2, 0), ht = hw(2.2, 0);

  // Vento + dinâmica: vento por altura, sustentação, estol, deriva, leme, banda
  HM.a += (HM.t - HM.a) * (1 - Math.exp(-dt * 3));
  SH.wh.rotation.z = -HM.a * 1.6;

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
    const ux = wx / W, uz = wz / W; // Vetor unitário do vento aparente
    let thrustEfficiency = 0;
    let lateralFactor = 0;
    let pressure = 0;

    if (x.sq) {
      // Velas Redondas / Vergas (Mastro Grande, Gávea, Joanete)
      nx = Math.sin(a); nz = Math.cos(a);
      // Produto escalar: >0 vento batendo por trás da vela (empurrando para frente)
      // <0 vento batendo de frente contra a vela (empurrando para trás contra o mastro)
      const alignment = ux * nx + uz * nz;
      const tanFlow = ux * nz - uz * nx;

      if (alignment >= 0) {
        // Vento favorável (vento soprando pelas costas da vela):
        // Empurra a lona para FRENTE (+Z)
        const catchBonus = Math.pow(alignment, 1.2);
        thrustEfficiency = 0.55 + 0.65 * catchBonus; // Varia de 0.55 a 1.20
        lateralFactor = tanFlow * 0.35;
        // Pressão normal POSITIVA: estufa a vela para a frente
        pressure = 0.30 + 0.70 * catchBonus;
      } else {
        // Vento desfavorável / de proa (vento batendo DE FRENTE contra a vela):
        // Empurra a lona para TRÁS (-Z, contra o mastro)
        const tackingAlignment = Math.abs(tanFlow);
        thrustEfficiency = 0.42 + 0.42 * Math.pow(tackingAlignment, 1.3);
        lateralFactor = -Math.sign(a || 1) * 0.25;
        // Pressão normal NEGATIVA: deforma a lona para trás em direção ao mastro
        // alignment é negativo (ex: -1.0 com vento de proa puro)
        pressure = alignment * (0.35 + 0.55 * Math.abs(alignment));
      }
      x.tanTarget = clamp(tanFlow, -1, 1);
    } else {
      // Velas Triangulares / Estais (Bujarrona na proa e Mezena na popa)
      nx = Math.cos(a); nz = -Math.sin(a);
      // Fluxo transversal ao pano longitudinal da vela
      const crossFlow = ux * Math.cos(a) + uz * Math.sin(a);
      const absCross = Math.abs(crossFlow);
      const headwindForward = uz < 0 ? 0.48 : (0.55 + 0.45 * Math.max(0, uz));
      thrustEfficiency = headwindForward * (0.6 + 0.5 * absCross);
      lateralFactor = (ux * nz - uz * nx) * 0.4;
      
      // A lona estufa para bombordo ou estibordo de acordo com o lado de onde o vento sopra
      const side = absCross > 0.05 ? Math.sign(crossFlow) : (a !== 0 ? Math.sign(a) : 1);
      pressure = side * (0.30 + 0.70 * Math.min(1, absCross * 1.5));
      x.tanTarget = 0;
    }

    // Força para frente (fz) e lateral (fx): sempre positiva para frente com velas abertas (estilo SoT)
    const dynPressure = W * W;
    fz = dynPressure * thrustEfficiency * 0.75;
    fx = dynPressure * lateralFactor * 0.45;
    fn = dynPressure * pressure;

    x.pt = clamp(pressure, -1, 1);
    // Bater de panos (flapping): aumenta fortemente quando o vento bate contra a vela ou desfavorável
    const windAlignmentFactor = x.sq ? (ux * nx + uz * nz) : 0;
    const isLuffing = windAlignmentFactor < 0.2;
    x.fl = .10 + .75 * clamp(1 - Math.max(0, windAlignmentFactor), 0, 1) * clamp(W / 5, .25, 1.2) + (isLuffing ? .25 : 0) + .2 * WI.s;
    Fx += Ar * fx; Fz += Ar * fz; Mh += Ar * fx * yc; Ty += Ar * fx * (sp[2] - .3); AT += x.ar;
    if (x.d > .2 && Math.abs(x.pt) < .1) lf++;
    x.ps += (x.pt - x.ps) * (1 - Math.exp(-dt * 2.8));
    if (x.tan === undefined) x.tan = 0;
    x.tan += ((x.tanTarget || 0) - x.tan) * (1 - Math.exp(-dt * 2.8));
    x.upd(SEAS.wt, x.ps, x.fl, x.tan);
  }
  ST.fl = lf;

  const spl = Math.abs(ST.heel) > .35 ? Math.max(.03, 1 - (Math.abs(ST.heel) - .35) * 4) : 1;
  const eff = Math.cos(clamp(ST.heel * 1.6, -1.2, 1.2)) * spl;
  const kF = .0085, ar0 = Math.abs(ST.v), Vw2 = ST.v * ST.v + ST.sw * ST.sw, al = Math.atan2(Math.abs(ST.sw), ar0 + .3);
  const CLk = 3.2 * Math.sin(al) * (al < .35 ? 1 : Math.max(.3, 1 - (al - .35) * 1.8));
  const Fk = .02 * Vw2 * CLk;

  // Resistência hidrodinâmica do casco rebalanceada:
  // Permite velocidades naturais entre 8 e 15 nós sem travar em 5-6 nós
  const waveDrag = .015 * Math.pow(Math.max(0, ar0 - 7.5), 2) + .03 * Math.pow(Math.max(0, ar0 - 9.0), 3);
  const hullDrag = (.0025 * ar0 + .0008 * (1 + .4 * sw) * ar0 * ar0 + waveDrag + .008 * Math.abs(HM.a) * ar0 * ar0) * Math.sign(ST.v);
  const waveResist = (hb - hs) / 10 * .18 + .003 * SEAS.amp * SEAS.amp * .5 * (1 - (sh * Math.sin(wang) + ch * Math.cos(wang))) * ar0 * Math.sign(ST.v);

  const forwardThrust = (AT > 0.1) ? (kF * Fz * eff / AT) : 0;
  const acc = forwardThrust - hullDrag - Fk * Math.sin(al) * Math.sign(ST.v) - waveResist;

  // Com velas abertas gerando propulsão e âncora recolhida, o navio sempre avança
  let newV = ST.v + (acc + ST.sw * ST.r) * dt;
  if (forwardThrust > 0 && newV < 0 && AN.d < 0.5) {
    newV = Math.max(0, newV + dt * 0.8);
  }
  ST.v = clamp(newV, -1.0, 16.0);
  ST.sw += (kF * Fx * eff / AT - (ST.sw > 0 ? 1 : -1) * Fk * Math.cos(al) - .1 * ST.sw - .25 * ST.sw * Math.abs(ST.sw) - ST.v * ST.r) * dt;

  // Arrasto e retenção da âncora
  if (AN.d > .97) {
    const k = AN.set ? 3.0 : 1.0;
    ST.v *= Math.exp(-k * dt);
    ST.sw *= Math.exp(-k * dt);
    if (!AN.set && Math.abs(ST.v) < 1.0 && Math.abs(ST.sw) < 1.0) {
      AN.set = 1;
      AN.ax = ST.px + sh * 4.8;
      AN.az = ST.pz + ch * 4.8;
    }
  } else {
    AN.set = 0;
  }

  // Dinâmica de rotação do leme e proa (com ancoragem estável)
  if (AN.set) {
    // Navio fundeado: alinhamento calmo com o ferro sem oscilação ou giro perpétuo
    const targetHeading = Math.atan2(AN.ax - ST.px, AN.az - ST.pz);
    const hDiff = wrapA(targetHeading - ST.hd);
    if (Math.abs(hDiff) > 0.002) {
      ST.hd += hDiff * (1 - Math.exp(-dt * 2.5));
    }
    ST.r = 0;
  } else {
    const rud = -Math.sin(HM.a * .6) * (1 - .2 * Math.max(0, Math.abs(HM.a) - .7) / .3) * .02 * ST.v * Math.abs(ST.v);
    ST.r += ((3e-4 * Ty / AT + .008 * SEAS.amp * Math.sin(SEAS.wt * .35) + rud - (1.1 + .12 * ar0) * ST.r) / 7) * dt;
    ST.hd += ST.r * dt;
  }

  // Deslocamento no mundo
  const sx = ST.v * sh + ST.sw * ch, sz = ST.v * ch - ST.sw * sh;
  let vx = sx, vz = sz;
  const ox = ST.px, oz = ST.pz;
  const driftDamp = AN.set ? 0.05 : (AN.d > 0.9 ? 0.25 : 1.0);
  const cvx = (.025 * vwx + .06 * SEAS.amp * Math.sin(wang)) * driftDamp;
  const cvz = (.025 * vwz + .06 * SEAS.amp * Math.cos(wang)) * driftDamp;
  ST.px += (sx + cvx) * dt;
  ST.pz += (sz + cvz) * dt;
  ST.svx = vx + cvx;
  ST.svz = vz + cvz;

  // Colisão com as ilhas e mecânica de raspagem de fundo para desencalhar
  if (ILHAS.hit(ST.px, ST.pz, ST.hd)) {
    const helmHard = Math.abs(HM.a);
    if (helmHard > 0.3) {
      // Raspagem do fundo: gira o casco lentamente e aplica recuo para desencalhar
      const scrapeRate = -Math.sign(HM.a) * 0.22 * helmHard;
      ST.r += (scrapeRate - ST.r) * Math.min(1, dt * 3);
      const pushSpeed = -0.35 * helmHard;
      const pushSx = pushSpeed * sh, pushSz = pushSpeed * ch;
      const tryPx = ox + pushSx * dt, tryPz = oz + pushSz * dt;
      if (!ILHAS.hit(tryPx, tryPz, ST.hd)) {
        ST.px = tryPx;
        ST.pz = tryPz;
      } else {
        ST.px = ox;
        ST.pz = oz;
      }
      ST.v = pushSpeed * 0.4;
      // Vibração tátil do casco raspando no banco de areia
      ST.hr += Math.sin(performance.now() * 0.02) * 0.08 * helmHard;
    } else {
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
    }
    ST.svx = (ST.px - ox) / dt;
    ST.svz = (ST.pz - oz) / dt;
  }

  // Cabo e raio da âncora fundeada
  if (AN.set) {
    const tx = ST.px + sh * 4.8 - AN.ax, tz = ST.pz + ch * 4.8 - AN.az, tr = Math.hypot(tx, tz), Lc = 3.5;
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
  }

  // Banda e momento restaurador
  const Hm = Mh / AT * .00015 * spl - .16 * ST.v * ST.r, ph = ST.heel;
  const R = Math.abs(ph) <= .58 ? Math.sin(ph) * (1 - Math.pow(ph / 1.1, 2)) : Math.sign(ph) * .396 * Math.max(.25, 1 - (Math.abs(ph) - .58) * 1.1);
  ST.hr += ((-Hm - R) - (.55 + 16 * Math.abs(Hm) / Math.max(2, Math.hypot(ax, az))) * ST.hr) / 2.2 * dt;
  ST.heel = clamp(ph + ST.hr * dt, -1.2, 1.2);

  // Retorna dados para o balanceio do casco
  return { hb, hs, hp, ht, hw0: hw(0, 0), ax, az };
}
