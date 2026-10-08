import * as THREE from 'three';
import { clamp, D2 } from '../core/math.js';
import { HM, AN } from '../core/state.js';
import { sc } from '../core/renderer.js';

const T = THREE;

// Navio pirata
export const SH = (() => {
  const mats = [], ship = new T.Group(), inter = [];
  const M = (c, o = {}) => {
    const m = new T.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .9, metalness: 0, side: T.DoubleSide }, o));
    mats.push(m);
    return m;
  };
  const wood = M('#6d4325'), dark = M('#3a2413'), gold = M('#dcab3b', { roughness: .6 }), iron = M('#2b2e35', { roughness: .6 }),
    rp = M('#cdb68a'), sailM = M('#f0e4c6'), blk = M('#17171b'), wht = M('#f1ece0'), vc = M('#ffffff', { vertexColors: true }),
    winMat = M('#251b14', { roughness: .5 }), glow = M('#ffd36a', { emissive: '#ffb43a', emissiveIntensity: .9 });
  const add = (g, m, x = 0, y = 0, z = 0, p = ship) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o };
  const box = (w, h, d, m, x, y, z, p) => add(new T.BoxGeometry(w, h, d), m, x, y, z, p);
  const cyl = (a, b, h, s, m, x, y, z, p) => add(new T.CylinderGeometry(a, b, h, s), m, x, y, z, p);
  const rope = (a, b, r = .03, m = rp, s = 5, sag = 0) => {
    const A = new T.Vector3(...a), B2 = new T.Vector3(...b), c = A.clone().lerp(B2, .5);
    c.y -= sag;
    return add(new T.TubeGeometry(sag ? new T.QuadraticBezierCurve3(A, c, B2) : new T.LineCurve3(A, B2), sag ? 10 : 1, r, s, false), m);
  };
  const lp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  /* material próprio por corda/vela (para poder brilhar quando selecionada) */
  const own = o => { o.material = o.material.clone(); mats.push(o.material); return o }, G = (o, t) => ({ o, t, k: 0 });

  /* Casco: estações ao longo do comprimento (popa -> proa) */
  const N = 10, K = 6, W = [1.5, 1.9, 2.1, 2.2, 2.2, 2.1, 1.85, 1.4, .9, .4, 0], B = [-.8, -1.1, -1.3, -1.35, -1.35, -1.3, -1.2, -1, -.7, -.3, .1], S = [2.5, 2.2, 1.9, 1.6, 1.1, .95, .95, 1.2, 1.5, 1.8, 2.1];
  const Z = i => -6 + 1.2 * i, hx = (i, u) => W[i] * (.2 + .8 * Math.pow(u, .6)), hy = (i, u) => B[i] + (S[i] - B[i]) * u;
  const L = (a, z) => { const f = (z + 6) / 1.2, i = Math.min(N - 1, Math.floor(f)), t = f - i; return a[i] * (1 - t) + a[i + 1] * t };
  const edge = (z, y) => { const u = Math.max(0, Math.min(1, (y - L(B, z)) / (L(S, z) - L(B, z)))); return L(W, z) * (.2 + .8 * Math.pow(u, .6)) };
  const Bd = () => {
    const p = [], c = [];
    return {
      q(a, b, d, e, col, l = 0) {
        const k = new T.Color(col).offsetHSL(0, 0, l);
        [a, b, d, a, d, e].forEach(v => { p.push(...v); c.push(k.r, k.g, k.b) });
      },
      mesh() {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
        g.computeVertexNormals();
        return add(g, vc);
      }
    };
  };

  const H = Bd(), bc = ['#7a4a28', '#8d5a33', '#7a4a28', '#8d5a33', '#a63530', '#3f2616'];
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) for (const s of [1, -1]) {
    const a = k / K, b = (k + 1) / K;
    H.q([s * hx(i, a), hy(i, a), Z(i)], [s * hx(i + 1, a), hy(i + 1, a), Z(i + 1)], [s * hx(i + 1, b), hy(i + 1, b), Z(i + 1)], [s * hx(i, b), hy(i, b), Z(i)], bc[k], ((i + k) % 3) * .012);
  }
  for (let i = 0; i < N; i++) H.q([-hx(i, 0), B[i], Z(i)], [hx(i, 0), B[i], Z(i)], [hx(i + 1, 0), B[i + 1], Z(i + 1)], [-hx(i + 1, 0), B[i + 1], Z(i + 1)], '#33200f');
  for (let k = 0; k < K; k++) {
    const a = k / K, b = (k + 1) / K;
    H.q([-hx(0, a), hy(0, a), -6], [hx(0, a), hy(0, a), -6], [hx(0, b), hy(0, b), -6], [-hx(0, b), hy(0, b), -6], k == 4 ? '#a63530' : '#654023', (k % 2) * .02);
  }
  H.mesh();
  for (const s of [1, -1]) for (let i = 0; i < N; i++) rope([s * hx(i, 1), S[i] + .03, Z(i)], [s * hx(i + 1, 1), S[i + 1] + .03, Z(i + 1)], .07, dark);
  rope([-hx(0, 1), S[0] + .03, -6], [hx(0, 1), S[0] + .03, -6], .07, dark);

  /* Conveses de tábuas: convés principal e castelo de popa */
  const deck = (y, i0, i1) => {
    const D = Bd(), n = 8, h = j => hx(j, Math.max(0, Math.min(1, (y - B[j]) / (S[j] - B[j])))) * .985;
    for (let i = i0; i < i1; i++) for (let m = 0; m < n; m++) {
      const f = -1 + 2 * m / n, g = -1 + 2 * (m + 1) / n, a = h(i), b = h(i + 1);
      D.q([a * f, y, Z(i)], [b * f, y, Z(i + 1)], [b * g, y, Z(i + 1)], [a * g, y, Z(i)], m % 2 ? '#c99b60' : '#b98a52', ((i + m) % 3) * .015);
    }
    D.mesh();
  };
  deck(.35, 0, N); deck(1.2, 0, 3);
  box(3.3, .85, .12, wood, 0, .775, Z(3));
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) box(.9, .28 * (k + 1), .3, wood, s * .9, .35 + .14 * (k + 1), Z(3) + .9 - .3 * k);
  box(1.2, .12, 1.2, dark, 0, .41, -.9); box(1.2, .04, .12, wood, 0, .49, -.9); box(.12, .04, 1.2, wood, 0, .49, -.9);

  /* Popa: janelas, frisos, leme, lanternas e timão */
  for (const x of [-.95, 0, .95]) box(.5, .5, .1, winMat, x, 1.6, -6.02);
  box(2.6, .12, .14, gold, 0, 2.2, -6.04); box(2.2, .12, .14, gold, 0, 1.1, -6.04);
  box(.14, 1.7, .55, dark, 0, -.35, -6.3);
  const lanterns = [];
  const addLantern = (lx, ly, lz, s, nameSuffix) => {
    const idx = lanterns.length;
    // Plaqueta de ferro de assentamento na borda
    box(.16, .02, .16, iron, lx, ly - .17, lz, ship);
    // Base metálica dourada da lanterna assentada sobre a placa
    cyl(.14, .08, .06, 6, gold, lx, ly - .14, lz, ship);
    cyl(.12, .12, .02, 6, iron, lx, ly - .10, lz, ship);
    
    // Vidro brilhante hexagonal (com material exclusivo clonado para poder apagar individualmente)
    const lanternGlow = glow.clone();
    mats.push(lanternGlow);
    box(.16, .24, .16, lanternGlow, lx, ly, lz, ship);
    
    // Molduras horizontais de metal (topo e base do vidro)
    cyl(.12, .12, .02, 6, iron, lx, ly + .12, lz, ship);
    // Teto cônico dourado com esfera decorativa
    cyl(0, .14, .12, 6, gold, lx, ly + .18, lz, ship);
    add(new T.SphereGeometry(.04, 4, 4), gold, lx, ly + .25, lz, ship);

    // Ponto de luz quente dinâmico
    const l = new T.PointLight(0xffaa44, 1.2, 14);
    l.position.set(lx, ly, lz);
    ship.add(l);

    // Registra a lanterna na nossa lista estruturada
    lanterns.push({
      light: l,
      mat: lanternGlow,
      on: false,
      index: idx,
      pos: new T.Vector3(lx, ly, lz)
    });

    // Registra o ponto de interação em Primeira Pessoa (E)
    inter.push({
      t: 'lantern',
      index: idx,
      pos: new T.Vector3(lx, ly, lz),
      label: 'Lanterna ' + nameSuffix
    });
  };

  for (const s of [1, -1]) {
    const sideName = s > 0 ? 'Estibordo' : 'Bombordo';
    // Lanternas de Popa (traseiras, assentadas diretamente sobre as quinas traseiras em Y = 2.5)
    addLantern(s * 1.42, 2.66, -5.9, s, 'Popa (' + sideName + ')');
    // Lanternas Laterais (atrás das escadas, assentadas diretamente sobre a amurada lateral em Y = 0.95)
    addLantern(s * 1.82, 1.11, 1.2, s, 'Lateral (' + sideName + ')');
  }
  const wh = new T.Group(), whm = []; wh.position.set(0, 2.05, -4.12); ship.add(wh);
  // Pedestal de suporte do leme localizado à frente do timão (em direção aos mastros)
  box(.32, .95, .22, dark, 0, 1.68, -3.85);
  // Eixo metálico conector do leme ao suporte
  cyl(.07, .07, .32, 8, iron, 0, 2.05, -3.98).rotation.x = Math.PI / 2;
  whm.push(own(add(new T.TorusGeometry(.5, .06, 4, 12), wood, 0, 0, 0, wh)));
  const hub = own(cyl(.12, .12, .2, 8, gold, 0, 0, 0, wh)); hub.rotation.x = Math.PI / 2; whm.push(hub);
  for (let k = 0; k < 4; k++) { const sp = own(box(.07, 1.4, .07, wood, 0, 0, 0, wh)); sp.rotation.z = k * Math.PI / 4; whm.push(sp) }

  /* Mastros: dois segmentos afilados, anéis de ferro, calcês e ponteira */
  const masts = [[.2, 10, .24, .35], [-3.3, 6.4, .17, 1.2]];
  masts.forEach(([z, h, r, y0]) => {
    cyl(r * .78, r, h * .62, 10, wood, 0, y0 + h * .31, z); cyl(r * .45, r * .78, h * .42, 8, wood, 0, y0 + h * .79, z);
    for (const t of [.1, .3, .5]) add(new T.TorusGeometry(r * (1 - .35 * t) + .02, .025, 4, 10), iron, 0, y0 + h * t, z).rotation.x = Math.PI / 2;
    add(new T.TorusGeometry(r * .74, .035, 4, 10), gold, 0, y0 + h * .62, z).rotation.x = Math.PI / 2;
    box(r * 3.4, .1, r * 3.4, dark, 0, y0 + h * .62, z); add(new T.IcosahedronGeometry(r * .5, 0), gold, 0, y0 + h + .05, z)
  });

  /* Sistema de velas: içar (d), rotacionar (ângulo limitado por mastro), cordas dinâmicas */
  const sails = [], rigs = [], NX = 18, NY = 12, V = (x, y, z) => new T.Vector3(x, y, z);
  const gR = M('#d9b24a', { roughness: .7 }), rR = M('#52321b', { roughness: .7 });
  const grid = (nx, ny) => {
    const g = new T.PlaneGeometry(1, 1, nx, ny), uv = g.attributes.uv, n = uv.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = uv.getX(i), t = 1 - uv.getY(i);
      let k = .94 + .06 * (Math.floor(u * 6) % 2) - .12 * t;
      if (Math.abs(t - .33) < .03 || Math.abs(t - .66) < .03) k -= .07;
      c.set([.97 * k, .92 * k, .8 * k], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    return g;
  };
  const dr = (r, m) => { const o = add(new T.CylinderGeometry(r, r, 1, 4), m || rp); o.frustumCulled = false; return o },
    setR = (o, a, b) => { const d = b.clone().sub(a), l = d.length() || .001; o.position.copy(a).addScaledVector(d, .5); o.scale.y = l; o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(l)) };
  /* ponto de amarração na borda superior da amurada, com cunho de ferro */
  const rc = {}, rail = (k, q) => { const key = k + ':' + q.toFixed(2); if (!rc[key]) { const y = L(S, q) + .05, x = k * edge(q, y - .05); box(.2, .1, .14, iron, x, y, q); rc[key] = V(x, y + .06, q) } return rc[key] };
  const rig = (name, z, lim, grp) => { const piv = grp ? new T.Group() : null; if (piv) { piv.position.set(0, 0, z); ship.add(piv) } const r = { name, z, piv, a: 0, t: 0, lim: lim * D2 }; rigs.push(r); return r };
  const sq = (name, rg, y, w, h, top, yb, ix) => {
    if (!rg.ri) { rg.ri = 1; [1, -1].forEach(k => inter.push({ t: 'rot', rg, k, pos: rail(k, rg.z - 2.2), label: 'Braço · mastro ' + rg.name })) }
    const z = rg.z, P2 = rg.piv, g = grid(NX, NY), p = g.attributes.position, uv = g.attributes.uv, n = p.count, m = add(g, M('#ffffff', { vertexColors: true, flatShading: false }), 0, 0, .3, P2), hl = w / 2 + .4; m.frustumCulled = false;
    [1, -1].forEach(k => { cyl(.1, .05, hl, 8, wood, k * hl / 2, y, .3, P2).rotation.z = k * Math.PI / 2; box(.16, .16, .16, gold, k * hl, y, .3, P2) });
    box(.22, .22, .4, dark, 0, y, .14, P2);
    const bun = add(new T.CylinderGeometry(1, 1, 1, 10), sailM, 0, y, .46, P2); bun.rotation.z = Math.PI / 2;
    const mt = Math.min(top, y + 1.5), bk = V(0, Math.min(top - .05, y + 1.1), z), cx = [-.45, 0, .45][ix];
    box(.14, .14, .14, iron, 0, bk.y, z + .26);
    
    // Mesa de Malaguetas (Suporte elevado de sustentação das cordas)
    if (ix === 0) {
      box(1.15, 0.06, 0.22, dark, 0, 1.25, z - .28);
    }
    // Pino metálico (malagueta) fixado na mesa para prender as cordas de içamento
    box(.05, .18, .05, iron, cx, 1.34, z - .30);
    
    // Prancha de madeira escura (suporte longo) transversal completa, idêntica à mesa de malaguetas
    box(1.15, 0.06, 0.22, dark, 0, bk.y - 0.4, z - .28);
    // Suporte metálico (ferrolho) fixado no suporte de madeira
    box(.04, .04, .06, iron, cx, bk.y - 0.4, z - .26);
    // Argola dourada de passagem de cabo na ponta do suporte
    add(new T.TorusGeometry(.04, .012, 4, 8), gold, cx, bk.y - 0.4, z - .30).rotation.x = Math.PI / 2;
    
    // Segmento superior da corda de içamento (da polia até a argola de guia)
    const hs = own(dr(.02, gR));
    setR(hs, V(0, bk.y, z + .05), V(cx, bk.y - 0.4, z - .30));
    
    // Segmento inferior da corda de içamento (da argola de guia descendo reta até a malagueta)
    const hsBot = own(dr(.02, gR));
    setR(hsBot, V(cx, bk.y - 0.4, z - .30), V(cx, 1.34, z - .30));
    
    const LF = [dr(.022), dr(.022)], BR = (ix === 0) ? [own(dr(.026, rR)), own(dr(.026, rR))] : [], CL = [own(dr(.022, gR)), own(dr(.022, gR))], SS = [dr(.03), dr(.03)], BU = own(dr(.022, gR)), HY = own(dr(.02, gR));
    const so = {
      name, d: 0, t: 0, upd(tt, wd, fs, tan = 0) {
        const d = this.d, a = rg.a, c = Math.cos(a), s2 = Math.sin(a), W2 = (x, y, zl) => V(x * c + zl * s2, y, -x * s2 + zl * c + z);
        const hh = Math.max(.001, h * d);
        // Direção e magnitude da deformação pelo vento (reduzida pela metade):
        // wd > 0: vento batendo pelas costas -> estufa para a FRENTE (+Z)
        // wd < 0: vento batendo de frente -> empurra a lona para TRÁS (-Z, contra o mastro)
        const isInflated = Math.abs(wd) > 0.35;
        const billowBoost = isInflated ? (1.0 + (Math.abs(wd) - 0.35) * 0.9) : (0.4 + 0.6 * Math.abs(wd));
        const bl = Math.sign(wd || 1) * (0.12 * w) * Math.pow(d, 0.72) * billowBoost;
        const fa = (.012 + .06 * fs) * Math.min(1, d * 1.5), ph = z * 1.7 + y, on = d > .015;
        m.visible = on; [BU, ...CL, ...SS].forEach(o => o.visible = on);
        for (let i = 0; i < n; i++) {
          const u = uv.getX(i), t = 1 - uv.getY(i);
          // O pico do bojo desloca lateralmente de acordo com o vento incidente angular (tan)
          const uShifted = clamp(u - tan * 0.07 * (1 - t * 0.4), 0, 1);
          const belly = Math.sin(Math.PI * uShifted) * Math.sin(Math.PI * (0.04 + 0.88 * t)) * (0.35 + 0.85 * Math.pow(t, 0.65));
          // Tensão do pano nas laterais ao inflar
          const widthPull = 1 - 0.04 * Math.pow(belly, 1.4);
          const vx = (u - .5) * w * (.8 + .2 * t) * widthPull;
          // Ondulação / flapping de lona tesa ou batendo solta no vento contrário
          const flutter = fa * t * Math.sin(u * 9 + t * 6 - tt * 3.4 + ph);
          let vz = bl * belly + flutter;
          
          // Colisão com o mastro: se o vento empurra a lona para trás (vz < 0), ela encosta e amassa no mastro
          const rCol = 0.22 * (1 - 0.3 * t);
          const zRel = vz + 0.3;
          if (Math.abs(vx) < rCol) {
            const zLimit = Math.sqrt(Math.max(0, rCol * rCol - vx * vx));
            if (zRel < zLimit) {
              vz = zLimit - 0.3;
            }
          }
          p.setXYZ(i, vx, y - t * hh, vz);
        }
        p.needsUpdate = true;
        g.computeVertexNormals();
        const rr = .09 + .11 * (1 - d) * h / 1.5; bun.visible = d < .985; bun.scale.set(rr, w * .88, rr); bun.position.y = y - rr * .7;
        const yc = W2(0, y, .3), ib = n - 1 - NX / 2;
        [1, -1].forEach((k, j) => {
          const i = k > 0 ? n - 1 : n - 1 - NX, cr = W2(p.getX(i), p.getY(i), p.getZ(i) + .3);
          setR(LF[j], W2(k * (hl - .1), y, .3), V(0, mt, z)); if (BR[j]) setR(BR[j], W2(k * hl, y, .3), rail(k, z - 2.2));
          setR(CL[j], cr, W2(k * (hl - .7), y, .3)); setR(SS[j], cr, rail(k, z - .6))
        });
        setR(BU, W2(p.getX(ib), p.getY(ib), p.getZ(ib) + .3), yc); setR(HY, yc, bk)
      }
    }; so.rg = rg; so.rop = BR; so.hr = hs; so.sq = 1; so.ar = w * h * .9; so.ps = 0; so.pt = 0; so.fl = .1; so.gl = [G(m, 's'), G(hs, 'h'), G(hsBot, 'h'), G(BU, 'h'), G(HY, 'h'), ...CL.map(o => G(o, 'h')), ...BR.map(o => G(o, 'r'))]; sails.push(so); inter.push({ t: 'hoist', sail: so, pos: V(cx, 1.34, z - .30), label: 'Talha · ' + name })
  };
  const tr = (name, rg, tk, hd, cw, ph, o) => {
    if (!rg.ri) { rg.ri = 1; [1, -1].forEach(k => inter.push({ t: 'rot', rg, k, pos: rail(k, o.az), label: 'Escota · ' + rg.name })) }
    const g = grid(14, 14), p = g.attributes.position, uv = g.attributes.uv, n = p.count, m = add(g, M('#ffffff', { vertexColors: true, flatShading: false })); m.frustumCulled = false;
    const a = V(...tk), mastTop = o.mastTop ? V(...o.mastTop) : V(...o.bk), bk = V(...o.bk);
    if (o.mastTop) {
      const tStay = (a.z - bk.z) / (a.z - mastTop.z);
      bk.copy(a).lerp(mastTop, tStay);
    }
    const hF = o.mastTop ? bk.clone() : V(...hd), cF = V(...cw), h2 = V(), c2 = V(), cb = V(), Lp = V(), Rp = V();
    const SS = [1, -1].map(() => own(dr(.026, rR))), HY = own(dr(.028, rp)), BM = o.boom ? dr(.065, wood) : null;
    const GR = [0.2, 0.45, 0.7, 0.9].map(() => own(add(new T.TorusGeometry(.045, .012, 4, 8), iron)));
    const bun = own(dr(.06, sailM));
    box(.14, .14, .14, iron, bk.x, bk.y, bk.z); box(.18, .1, .12, iron, ...o.ck); const hs = own(dr(.02, gR)); setR(hs, bk, V(...o.ck));
    const so = {
      name, d: 0, t: 0, upd(tt, wd, fs) {
        const d = this.d;
        const isInflated = Math.abs(wd) > 0.4;
        const billowBoost = isInflated ? (1.0 + (Math.abs(wd) - 0.4) * 0.8) : (0.5 + 0.6 * Math.abs(wd));
        const bl = Math.sign(wd || 1) * 0.675 * Math.pow(d, 0.7) * billowBoost;
        const fa = (.015 + .05 * fs) * Math.min(1, d * 1.5), cs = Math.cos(rg.a), sn = Math.sin(rg.a), on = d > .015;
        const dx = cF.x - a.x, dz = cF.z - a.z; cb.set(a.x + dx * cs - dz * sn, cF.y, a.z + dx * sn + dz * cs);
        if (!o.boom) {
          const yBowsprit = a.y - (a.z - cb.z) * 0.39 + 0.14;
          cb.y = cF.y * d + yBowsprit * (1 - d);
        }
        h2.copy(a).lerp(hF, d); c2.copy(cb); m.visible = on; SS.forEach(r => r.visible = true);
        HY.visible = true;
        setR(HY, a, mastTop);
        const rr = .025 + .055 * (1 - d);
        bun.visible = d < .985;
        setR(bun, a, cb);
        bun.scale.x = rr / .06;
        bun.scale.z = rr / .06;
        GR.forEach((ring, idx) => {
          const tf = [0.2, 0.45, 0.7, 0.9][idx];
          ring.visible = true;
          ring.position.copy(a).lerp(h2, tf);
          ring.rotation.x = Math.PI / 2;
        });
        for (let i = 0; i < n; i++) {
          const u = uv.getX(i), t = uv.getY(i); Lp.copy(a).lerp(h2, t); Rp.copy(c2).lerp(h2, t); Lp.lerp(Rp, u);
          const belly = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.08 + 0.84 * t));
          const flutter = fa * u * Math.sin(u * 8 + t * 5 - tt * 3.6 + ph);
          p.setXYZ(i, Lp.x + bl * belly + flutter, Lp.y, Lp.z);
        }
        p.needsUpdate = true;
        g.computeVertexNormals();
        [1, -1].forEach((k, j) => setR(SS[j], c2, rail(k, o.az))); if (BM) setR(BM, a, cb)
      }
    }; so.rg = rg; so.rop = SS; so.hr = hs; so.sq = 0; so.ar = .5 * V().crossVectors(hF.clone().sub(a), cF.clone().sub(a)).length(); so.ps = 0; so.pt = 0; so.fl = .1; so.gl = [G(m, 's'), G(bun, 's'), G(hs, 'h'), G(HY, 'h'), ...GR.map(o => G(o, 'h')), ...SS.map(o => G(o, 'r'))]; sails.push(so); inter.push({ t: 'hoist', sail: so, pos: V(...o.ck), label: 'Talha · ' + name })
  };
  const rM = rig('Principal', .2, 60, 1), rZ = rig('Mezena', -3.3, 32, 0), rJ = rig('Bujarrona', 0, 25, 0);
  tr('Bujarrona', rJ, [0, 3.1, 9], [0, 7.1, 3.9], [0, 3.2, 5.9], 0, { bk: [0, 7.1, 3.9], ck: [0, 1.48, 4.7], az: 4.7, mastTop: [0, 9.8, .2] });
  // Suporte de madeira interligando as duas cordas de rotação da vela frontal (Bujarrona)
  box(1.68, 0.07, 0.18, dark, 0, 1.48, 4.7);
  box(0.08, 0.75, 0.08, wood, -0.72, 1.10, 4.7);
  box(0.08, 0.75, 0.08, wood, 0.72, 1.10, 4.7);
  // Pino metálico/malagueta no centro do suporte para prender a corda de hastear a vela frontal
  box(.05, .16, .05, iron, 0, 1.57, 4.7);
  box(.04, .04, .06, iron, 0, 1.48, 4.7);
  add(new T.TorusGeometry(.04, .012, 4, 8), gold, 0, 1.48, 4.7).rotation.x = Math.PI / 2;
  sq('Grande', rM, 5.1, 6.2, 2.9, 10.3, .35, 0); sq('Gávea', rM, 7.9, 4.8, 2.3, 10.3, .35, 1); sq('Joanete', rM, 9.6, 3.2, 1.2, 10.3, .35, 2);
  // Suporte de madeira do mastro da mezena (Mesa de malaguetas e amarração das cordas)
  box(0.95, 0.06, 0.20, dark, 0, 2.02, -3.52);
  box(0.08, 0.82, 0.08, wood, -0.38, 1.61, -3.52);
  box(0.08, 0.82, 0.08, wood, 0.38, 1.61, -3.52);
  for (const px of [-.28, 0, .28]) box(.04, .16, .04, iron, px, 2.11, -3.52);
  box(.04, .04, .06, iron, .42, 2.02, -3.50);
  add(new T.TorusGeometry(.04, .012, 4, 8), gold, .42, 2.02, -3.52).rotation.x = Math.PI / 2;

  tr('Mezena', rZ, [0, 3.4, -3.45], [0, 7.2, -3.45], [0, 3.4, -5.2], 1.3, { bk: [0, 7.6, -3.3], ck: [.42, 2.02, -3.52], az: -5, boom: 1 });
  rope([0, 1.6, 5.2], [0, 3.1, 9.3], .13, wood, 6);
  // Suporte de madeira e braçadeira de ferro do gurupés na proa
  box(.36, .32, .45, dark, 0, 1.48, 5.25);
  add(new T.TorusGeometry(.2, .04, 4, 10), iron, 0, 1.62, 5.25).rotation.x = Math.PI / 2;

  // Ferragens e anéis de metal na ponta do gurupés (nariz do navio)
  add(new T.TorusGeometry(.16, .035, 4, 10), iron, 0, 3.1, 9.2).rotation.x = Math.PI / 2;
  add(new T.TorusGeometry(.05, .015, 4, 8), gold, 0, 3.14, 9.2).rotation.x = Math.PI / 2;

  // Barba do Gurupés / Estai Inferior (suporte em cabo de ferro que prende a ponta do gurupés para baixo ao bico da proa)
  rope([0, 3.1, 9.2], [0, 1.0, 5.8], .038, iron, 6, 0);

  add(new T.IcosahedronGeometry(.22, 0), gold, 0, 2.1, 6.02);
  cyl(.5, .38, .5, 8, wood, 0, 10.1, .2); cyl(.58, .58, .07, 8, dark, 0, 10.38, .2);

  /* Cordame: enxárcias, escadas de cordas e estais */
  masts.forEach(([z, h, r, y0]) => {
    if (z === 0.2) return; // Pula o mastro central para remover suas enxárcias
    for (const s of [1, -1]) {
      const top = [0, y0 + h * .66, z], P = [-.9, -.4, .1].map(d => { const q = z + d, y = L(S, q); return [s * edge(q, y), y, q] });
      P.forEach(p => { rope(top, p); add(new T.TorusGeometry(.1, .035, 4, 8), iron, p[0], p[1] + .05, p[2]).rotation.x = Math.PI / 2 });
      for (const t of [.2, .32, .44, .56, .68, .8]) rope(lp(top, P[0], t), lp(top, P[2], t), .022)
    }
  });
  const T2 = [0, 10.35, .2], T3 = [0, 7.6, -3.3];

  /* Bandeira Jolly Roger */
  const jolly = () => {
    const g = new T.Group(), pl = (w, h, m, x, y, z, rz = 0) => { const o = add(new T.PlaneGeometry(w, h), m, x, y, z, g); o.rotation.z = rz };
    pl(.95, .1, wht, 0, 0, .004, Math.PI / 4); pl(.95, .1, wht, 0, 0, .004, -Math.PI / 4); pl(.22, .14, wht, 0, -.17, .008);
    add(new T.CircleGeometry(.26, 7), wht, 0, .05, .008, g);
    for (const x of [-.1, .1]) add(new T.CircleGeometry(.07, 5), blk, x, .08, .012, g);
    return g;
  };
  cyl(.03, .03, 1.4, 4, wood, 0, 11.05, .2);
  const fl = new T.Group(), cl = new T.Group(), j1 = jolly(), j2 = jolly();
  fl.position.set(0, 10.85, .2); cl.rotation.y = Math.PI / 2; cl.position.z = -.95; j2.rotation.y = Math.PI;
  cl.add(new T.Mesh(new T.PlaneGeometry(1.9, 1.2), blk), j1, j2); fl.add(cl); ship.add(fl);
  /* Escadas de cordas nas laterais (z=2.1): fixas na borda superior e soltas com física abaixo */
  const cz = z => Math.max(-5.99, Math.min(5.99, z)), LZ = 2.1, LD = { top: L(S, LZ) + .05, bot: -1.05 };
  const ladders = [];
  for (const s of [1, -1]) {
    const nR = 10, xRail = s * L(W, LZ);
    box(.16, .1, .7, iron, xRail, LD.top - .02, LZ);
    const zOffsets = [LZ - .24, LZ + .24];
    const ropeSegs = zOffsets.map(zz => {
      const segs = [];
      for (let k = 0; k < nR; k++) segs.push(own(dr(.032, rp)));
      return { zz, segs };
    });
    const rungs = [];
    for (let k = 0; k <= nR; k++) rungs.push(box(.07, .07, .6, wood, 0, 0, 0));

    const ladderObj = {
      side: s, xRail, topY: LD.top, botY: LD.bot, nR, zOffsets, ropeSegs, rungs, LZ,
      swingX: 0, swingZ: 0, velX: 0, velZ: 0,
      waveX: 0, waveZ: 0,
      unroll: AN.d || 0,
      getPt(t, zz) {
        const y = this.topY - t * (this.topY - this.botY);
        const inf = t * t;
        const x = this.xRail + this.side * .08 + inf * (this.swingX + this.waveX);
        const z = zz + inf * (this.swingZ + this.waveZ);
        return V(x, y, z);
      },
      upd(dt, tt, roll, pitch, svx, svz, wx, wz) {
        const targetUnroll = Math.max(0, Math.min(1, AN.d));
        this.unroll += (targetUnroll - this.unroll) * Math.min(1, dt * 5);

        const targetX = this.side * (.2 + Math.abs(roll) * .7) + wx * .12 - svx * .06;
        const targetZ = wz * .12 - svz * .06;
        this.velX += ((targetX - this.swingX) * 10 - this.velX * 2.5) * dt;
        this.velZ += ((targetZ - this.swingZ) * 10 - this.velZ * 2.5) * dt;
        this.swingX += this.velX * dt;
        this.swingZ += this.velZ * dt;

        this.waveX = Math.sin(tt * 3.5 + this.side * 2) * (.05 + Math.abs(roll) * .1);
        this.waveZ = Math.cos(tt * 2.8) * (.05 + Math.abs(pitch) * .1);

        const uVal = this.unroll;

        this.ropeSegs.forEach(({ zz, segs }) => {
          for (let k = 0; k < this.nR; k++) {
            const t1 = k / this.nR;
            const t2 = (k + 1) / this.nR;
            if (t2 <= uVal) {
              const p1 = this.getPt(t1, zz);
              const p2 = this.getPt(t2, zz);
              setR(segs[k], p1, p2);
              segs[k].visible = true;
            } else if (t1 < uVal) {
              const p1 = this.getPt(t1, zz);
              const p2 = this.getPt(uVal, zz);
              setR(segs[k], p1, p2);
              segs[k].visible = true;
            } else {
              segs[k].visible = false;
            }
          }
        });

        for (let k = 0; k <= this.nR; k++) {
          const t = k / this.nR;
          const rung = this.rungs[k];
          if (t <= uVal) {
            const p1 = this.getPt(t, this.zOffsets[0]);
            const p2 = this.getPt(t, this.zOffsets[1]);
            rung.position.copy(p1).add(p2).multiplyScalar(.5);
            rung.rotation.y = this.side * (this.swingX * .2);
            rung.rotation.z = 0;
            rung.rotation.x = 0;
            rung.scale.set(1, 1, 1);
          } else {
            const rollIndex = k - uVal * this.nR;
            const rollAngle = rollIndex * 0.85;
            const rollRad = 0.06 + rollIndex * 0.01;
            const rx = this.xRail + this.side * (0.04 + Math.cos(rollAngle) * rollRad * 0.5);
            const ry = this.topY + 0.08 + Math.sin(rollAngle) * rollRad * 0.5;
            const rz = LZ + (k % 2 === 0 ? 0.03 : -0.03);
            rung.position.set(rx, ry, rz);
            rung.rotation.y = 0;
            rung.rotation.z = rollAngle;
            rung.rotation.x = 0.1;
            rung.scale.set(0.8, 0.8, 0.8);
          }
        }
      }
    };
    ladders.push(ladderObj);
  }
  /* Caminhada: altura do chão, degraus, amurada e obstáculos */
  const gy = (x, z) => {
    if (z < -2.3) return 1.2; const ax = Math.abs(x);
    if (ax > .45 && ax < 1.35 && z < -1.35) return .35 + .28 * (Math.min(2, Math.floor((-1.35 - z) / .3)) + 1);
    if (ax < .6 && Math.abs(z + .9) < .6) return .49; return .35
  };
  const ob = [[0, 2.2, .34], [0, .2, .36], [0, -3.3, .29], [0, -4.0, .55], [-1.2, -5.7, .22], [1.2, -5.7, .22], [1.25, 2.1, .3], [-1.25, 2.1, .3]];
  const walk = {
    g: gy, ok: (x, z, px, pz) => {
      if (z < -5.7 || z > 4.3) return 0; const y = gy(x, z); if (y - gy(px, pz) > .45 || Math.abs(x) > edge(z, y) - .22) return 0;
      for (const o of ob) if (Math.hypot(x - o[0], z - o[1]) < o[2]) return 0; return 1
    }, ob, edge: (z, y) => edge(cz(z), y), rY: z => L(S, cz(z)), wr: z => L(W, cz(z))
  };
  const cap = new T.Group(); cap.position.set(0, .35, 2.2); ship.add(cap);
  cyl(.3, .34, .7, 8, wood, 0, .35, 0, cap); cyl(.37, .37, .07, 8, gold, 0, .73, 0, cap); box(1.3, .07, .07, dark, 0, .58, 0, cap); box(.07, .07, 1.3, dark, 0, .58, 0, cap);
  const anc = new T.Group(); anc.position.set(.88, .85, 3.9); ship.add(anc);
  add(new T.TorusGeometry(.14, .04, 4, 8), iron, 0, .82, 0, anc); box(.14, 1.5, .14, iron, 0, 0, 0, anc); box(.1, .1, .9, iron, 0, .5, 0, anc);
  for (const k of [1, -1]) { const a = box(.75, .12, .12, iron, k * .3, -.62, 0, anc); a.rotation.z = -k * .6; box(.2, .2, .14, iron, k * .62, -.38, 0, anc) }
  const arope = cyl(.04, .04, 1, 5, rp, .88, 1, 3.9); arope.frustumCulled = false;
  inter.push({ t: 'anchor', pos: V(0, .35, 2.2), label: 'Âncora (cabrestante)' });
  inter.push({ t: 'helm', pos: V(0, 2.05, -4.12), label: 'Leme' });
  return { ship, fl, mats, sails, rigs, walk, inter, wh, helm: HM, anc, arope, cap, lad: LD, ladders, whg: whm.map(o => G(o, 'h')), lanterns }
})();

export const ship = SH.ship;
export const fl = SH.fl;
ship.rotation.order = 'YXZ';
sc.add(ship);
