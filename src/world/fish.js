import * as THREE from 'three';
import { rnd, clamp, wrapA } from '../core/math.js';
import { sc } from '../core/renderer.js';
import { H } from './ocean.js';
import { ST } from '../core/state.js';
import { spawnSplash, spawnRipple } from './weather.js';

const T = THREE;

// ============================================================================
// DEFINIÇÕES ANATÔMICAS PROCEDURAIS DAS 15 ESPÉCIES (NOVO SISTEMA LOW POLY)
// ============================================================================
export const SPC = [
  { id: 'atum', nm: 'Atum-azul', lt: 'Thunnus thynnus', L: 4.2, H: .62, W: .5, pk: .38, tp: .9, c: [0x1c3f66, 0xdfe9ee], ac: 0x2a5aa0, t: [.95, .8, .8, .55], d: [[.34, .52, .38], [.62, .8, .2]], an: [[.62, .8, .2]], p: [.55, .55, .5], am: .07, st: 1.8, sp: 5.5, cat: 'Pelágico Veloz', hab: 'Águas Profundas', desc: 'Torpedo marinho de dorso azul-cobalto e ventre prateado, nadador incansável de alta velocidade.' },
  { id: 'espada', nm: 'Peixe-espada', lt: 'Xiphias gladius', L: 4.4, H: .55, W: .45, pk: .4, tp: .9, c: [0x2c3e5c, 0xc9d3dc], ac: 0x34465f, bill: 1.5, t: [.9, .85, .85, .5], d: [[.34, .52, .8]], an: [[.7, .82, .25]], p: [.6, .5, .7], am: .07, st: 1.8, cat: 'Predador Oceânico', hab: 'Mar Aberto', desc: 'Rostro pontiagudo em forma de espada e dorso metálico, um dos caçadores mais velozes dos mares.' },
  { id: 'tubarao_martelo', nm: 'Tubarão-martelo', lt: 'Sphyrna lewini', L: 4.4, H: .5, W: .4, pk: .3, c: [0x6d7b86, 0xe6ebee], ac: 0x5b6975, ham: 1, j: 1, t: [1.2, 1, .4, .35], d: [[.3, .5, .85]], an: [[.72, .82, .2]], p: [.9, 1, .7], am: .1, st: 1.3, cat: 'Predador Especializado', hab: 'Canais e Fendas', desc: 'Cabeça larga característica em formato de martelo, permitindo visão e campo sensorial em 360 graus.' },
  { id: 'tubarao_branco', nm: 'Tubarão-branco', lt: 'Carcharodon carcharias', L: 4.6, H: .62, W: .5, c: [0x66727c, 0xf2f5f6], ac: 0x56626c, j: 1, t: [1.1, .95, .5, .45], d: [[.34, .5, .8]], an: [[.74, .82, .18]], p: [.9, .95, .7], am: .1, st: 1.3, cat: 'Superpredador', hab: 'Alto-mar e Costões', desc: 'O maior predador carnívoro dos oceanos modernos, com dentes triangulares afiados e dorso cinza.' },
  { id: 'arraia', nm: 'Raia-manta', lt: 'Mobula birostris', L: 2.6, H: .18, W: .55, pk: .45, tp: 1, c: [0x1f2a36, 0xf1f1f1], ac: 0x26323f, j: .6, t: [1.8, .05, .05, 0], d: [[.55, .8, .18]], p: [1.5, 2.4, .9], px: 1, dr: .05, fl: .6, am: .03, sp: 2.6, cat: 'Planctófago Gigante', hab: 'Arrecifes e Canais', desc: 'Navega majestosamente abrindo suas grandes asas peitorais em ondas suaves e sincronizadas.' },
  { id: 'peixe_lua', nm: 'Peixe-lua', lt: 'Mola mola', n: 6, L: 2.6, H: 1.2, W: .32, pk: .5, tp: .5, c: [0x8a9aa6, 0xd9e0e5], ac: 0x76868f, j: .5, t: [.35, .75, .75, -.1], d: [[.4, .95, 1.3]], an: [[.4, .95, 1.3]], p: [.35, .4, .5], am: .08, st: 1.4, sp: 2.8, cat: 'Gigante Pelágico', hab: 'Oceano Profundo', desc: 'Corpo circular e plano com grandes barbatanas dorsal e anal que atuam como remos verticais.' },
  { id: 'baiacu', nm: 'Baiacu', lt: 'Tetraodontidae', n: 6, L: 2, H: .8, W: .75, pk: .5, tp: .6, c: [0xc2a15b, 0xf5ecd0], bc: 0x6b5326, b: [2, 4], ac: 0xa88742, j: .4, t: [.55, .5, .5, 0], d: [[.62, .85, .35]], an: [[.62, .85, .3]], p: [.35, .35, .5], am: .14, st: .6, sp: 6.5, cat: 'Defensivo de Arrecife', hab: 'Águas Rasas', desc: 'Corpo robusto e amarelado capaz de se inflar com água para afugentar qualquer predador.' },
  { id: 'peixe_palhaco', nm: 'Peixe-palhaço', lt: 'Amphiprion ocellaris', n: 7, L: 1.6, H: .42, W: .3, pk: .45, tp: .8, c: [0xff7a1a, 0xff9a3c], bc: 0xffffff, b: [1, 4], ac: 0xff6a00, j: .3, t: [.4, .35, .35, -.15], d: [[.3, .9, .3]], an: [[.65, .85, .18]], p: [.35, .35, .5], am: .13, st: .8, sp: 7.5, cat: 'Coralino Ornamental', hab: 'Anêmonas e Arrecifes', desc: 'Coloração laranja viva com três faixas brancas brilhantes, nada em pequenos movimentos ondulantes.' },
  { id: 'peixe_anjo', nm: 'Peixe-anjo', lt: 'Pomacanthus imperator', L: 2.2, H: .95, W: .22, pk: .45, tp: .7, c: [0x2155a8, 0x4a82d4], bc: 0xf6d13a, b: [2, 3, 5], ac: 0x1b3f86, j: .3, t: [.55, .5, .5, 0], d: [[.32, .95, 1.15]], an: [[.4, .95, 1]], p: [.45, .5, .5], am: .1, st: .8, cat: 'Coralino Tropical', hab: 'Arrecifes Rasos', desc: 'Corpo achatado lateralmente em disco com listras amarelas e azuis cyan exuberantes.' },
  { id: 'moreia', nm: 'Moreia', lt: 'Gymnothorax javanicus', n: 14, L: 6.2, H: .24, W: .2, pk: .12, tp: .3, c: [0x7a7a2e, 0xd8cf7a], bc: 0x3a3a14, b: [3, 6, 9, 12], ac: 0x5c5c22, j: 1.3, t: [.45, .3, .3, 0], d: [[.12, 1, .3]], an: [[.45, 1, .25]], am: .13, st: .5, sp: 4.5, cat: 'Bêntico Serpentiforme', hab: 'Fendas e Rochas', desc: 'Longo corpo serpenteante com 14 nós articulados que desliza por fendas e cavernas marinhas.' },
  { id: 'peixe_leao', nm: 'Peixe-leão', lt: 'Pterois volitans', L: 2.4, H: .55, W: .34, pk: .4, tp: .9, c: [0x8f2f22, 0xf4e6d2], bc: 0xf4e6d2, b: [1, 3, 5, 7], ac: 0xb4513a, j: .5, t: [.6, .5, .5, .1], d: [[.2, .85, .95, 1]], an: [[.65, .85, .4]], p: [1, 1.1, .4], am: .1, sp: 4, cat: 'Predador Exótico', hab: 'Recifes e Cavernas', desc: 'Magníficas nadadeiras peitorais abertas em leque e espinhos dorsais finos com listras vermelhas e creme.' },
  { id: 'barracuda', nm: 'Barracuda', lt: 'Sphyraena barracuda', L: 4.2, H: .38, W: .3, pk: .5, tp: .9, c: [0x4a5d6b, 0xe8eef0], ac: 0x3e5260, j: 1.5, t: [.75, .55, .55, .35], d: [[.52, .64, .28], [.82, .9, .22]], an: [[.82, .9, .2]], p: [.35, .35, .5], am: .09, st: 1.1, cat: 'Predador Voraz', hab: 'Costões e Mar Aberto', desc: 'Corpo afiado prateado com mandíbula pronunciada e dentes caninos afiados, dispara em emboscadas.' },
  { id: 'cirurgiao', nm: 'Cirurgião-azul', lt: 'Paracanthurus hepatus', L: 2.2, H: .8, W: .24, pk: .45, tp: .8, c: [0x1769d8, 0x3b8cf0], bc: 0x0b1a3a, b: [3, 4], ac: 0xf2cf27, j: .3, t: [.7, .55, .55, .35], d: [[.3, .95, .6]], an: [[.5, .95, .5]], p: [.45, .5, .5], am: .1, st: .9, sp: 5.5, cat: 'Coralino Herbívoro', hab: 'Arrecifes de Corais', desc: 'Azul cobalto intenso com cauda amarelo ouro e marcas escuras no dorso.' },
  { id: 'garoupa', nm: 'Garoupa', lt: 'Epinephelus marginatus', L: 3.2, H: .85, W: .6, pk: .45, tp: .8, c: [0x7a5c3f, 0xc9ae8a], bc: 0x4a3523, b: [2, 4, 6], ac: 0x6b4f35, j: 1.3, t: [.8, .7, .7, -.12], d: [[.22, .9, .5]], an: [[.62, .85, .3]], p: [.65, .65, .4], am: .08, sp: 4, cat: 'Bêntico Territorial', hab: 'Fundos Rochosos', desc: 'Peixe robusto de fundo com manchas camufladas em tons de marrom e boca ampla e poderosa.' },
  { id: 'dourado', nm: 'Dourado', lt: 'Coryphaena hippurus', L: 3.6, H: .62, W: .32, pk: .25, tp: .95, c: [0x23b27a, 0xf4d85c], ac: 0x2a9fb8, j: .8, t: [.85, .8, .8, .5], d: [[.12, .88, .55]], an: [[.5, .88, .4]], p: [.45, .45, .5], am: .09, st: 1.2, sp: 5.5, cat: 'Superfície Tropical', hab: 'Oceano Aberto', desc: 'Cores elétricas esmeralda e dourado metálico, com crista frontal imponente e alta velocidade de salto.' }
];

export const FISH_SPECIES = SPC.map(s => ({
  id: s.id,
  name: s.nm,
  scientificName: s.lt,
  category: s.cat,
  sizeRange: `${(s.L * 0.45).toFixed(1)}m - ${(s.L * 0.85).toFixed(1)}m`,
  habitat: s.hab,
  speedText: s.sp > 6 ? `Extrema (${Math.round(s.sp * 10)} km/h)` : s.sp > 4.5 ? `Alta (${Math.round(s.sp * 9)} km/h)` : `Moderada (${Math.round(s.sp * 8)} km/h)`,
  jointsCount: s.n || 8,
  colorTheme: '#' + s.c[0].toString(16).padStart(6, '0'),
  desc: s.desc,
  raw: s
}));

// Parâmetros anatômicos padrão
const DEF = { n: 8, tp: .85, pk: .38, st: 1, sp: 5, ph: .55, am: .09, fl: .25, dr: .35, px: 0, t: [.6, .5, .5, .1] };

/**
 * Constrói o modelo 3D low poly articulado com cadeia de juntas, nadadeiras,
 * cores de vértices e detalhes anatômicos (martelo, bico/espada, mandíbula, etc.)
 */
export function buildFish(S_in) {
  const S = Object.assign({}, DEF, S_in);
  const { n, L, H, W, pk, tp } = S;
  const l = L / n;
  const g = new T.Group();
  const pv = [], rip = [], pf = [], hh = [], ww = [];
  const f = t => t < pk ? Math.pow(t / pk, .55) : Math.max(.09, Math.pow((1 - t) / (1 - pk), tp));
  
  for (let i = 0; i <= n; i++) {
    const v = f(i / n);
    hh.push(H * v);
    ww.push(W * v);
  }

  const cB = new T.Color(S.c[0]);
  const cV = new T.Color(S.c[1]);
  const cX = new T.Color(S.bc || 0);
  const tc = new T.Color();
  const fm = new T.MeshStandardMaterial({
    color: S.ac,
    flatShading: true,
    side: T.DoubleSide,
    roughness: .4,
    metalness: .2,
    transparent: true,
    opacity: .95
  });

  const bodyMat = new T.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: .5,
    metalness: .2,
    side: T.DoubleSide
  });

  let par = g;
  for (let i = 0; i < n; i++) {
    const p = new T.Object3D();
    p.position.x = i ? -l : L / 2;
    par.add(p);
    par = p;
    pv.push(p);

    const ps = [], cs = [], ix = [], bd = (S.b || []).includes(i);
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, s = Math.sin(a), c = Math.cos(a);
      [[0, i], [-l, i + 1]].forEach(([x, j]) => {
        ps.push(x, hh[j] * s, ww[j] * c);
        tc.copy(cB).lerp(cV, (1 - s) / 2);
        if (bd) tc.lerp(cX, .9);
        cs.push(tc.r, tc.g, tc.b);
      });
      const A = 2 * k, B = 2 * ((k + 1) % 6);
      ix.push(A, B, A + 1, B, B + 1, A + 1);
    }
    const bg = new T.BufferGeometry();
    bg.setAttribute('position', new T.Float32BufferAttribute(ps, 3));
    bg.setAttribute('color', new T.Float32BufferAttribute(cs, 3));
    bg.setIndex(ix);
    bg.computeVertexNormals();
    bg.computeBoundingSphere();
    const bMesh = new T.Mesh(bg, bodyMat);
    bMesh.frustumCulled = true;
    p.add(bMesh);
  }

  const poly = (p, ix, m) => {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const pm = new T.Mesh(geo, m);
    pm.frustumCulled = true;
    return pm;
  };

  // Nadadeiras dorsal e anal
  const fin = (arr, sg) => (arr || []).forEach(([t0, t1, h, sk]) => {
    const hf = u => h * Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, u)), .6));
    for (let i = 0; i < n; i++) {
      const u0 = (i / n - t0) / (t1 - t0);
      const u1 = ((i + 1) / n - t0) / (t1 - t0);
      const uc = (u0 + u1) / 2;
      if (uc <= 0 || uc >= 1) continue;
      const b0 = sg * (hh[i] * .87 - .02);
      const b1 = sg * (hh[i + 1] * .87 - .02);
      const h0 = sg * hf(u0);
      const h1 = sg * hf(u1);
      const m = sk
        ? poly([0, b0, 0, -l, b1, 0, -l * .7, (b0 + b1) / 2 + (h0 + h1) * .6, 0], [0, 1, 2], fm)
        : poly([0, b0, 0, -l, b1, 0, -l, b1 + h1, 0, 0, b0 + h0, 0], [0, 1, 2, 0, 2, 3], fm);
      pv[i].add(m);
      rip.push([m, i]);
    }
  });

  fin(S.d, 1);
  fin(S.an, -1);

  // Nadadeira caudal
  const tl = new T.Object3D();
  tl.position.x = -l;
  pv[n - 1].add(tl);
  const [Tl, Tt, Tb, Tf] = S.t;
  const hp = hh[n] * .87;
  tl.add(poly([0, hp, 0, -Tl, Tt, 0, -Tl * (1 - Tf), 0, 0, -Tl, -Tb, 0, 0, -hp, 0], [0, 1, 2, 0, 2, 4, 2, 3, 4], fm));

  // Nadadeiras peitorais articuladas
  if (S.p) {
    const [bw, sp, sw] = S.p;
    const j = Math.min(S.px, n - 1);
    [1, -1].forEach(sg => {
      const h = new T.Object3D();
      h.position.set(-l * .9, -hh[j + 1] * .2, sg * ww[j + 1] * .85);
      pv[j].add(h);
      h.add(poly([0, 0, 0, -bw * .25, sp * .6, 0, -bw * (.5 + .4 * sw), sp, 0, -bw * .9, sp * .45, 0, -bw, 0, 0], [0, 1, 2, 0, 2, 3, 0, 3, 4], fm));
      pf.push([h, sg]);
    });
  }

  // Olhos
  const er = Math.max(.05, H * .2);
  const eyeW = new T.MeshStandardMaterial({ color: 0xf4f4f0, flatShading: true });
  const eyeB = new T.MeshStandardMaterial({ color: 0x0a0a0a, flatShading: true });
  const eye = (x, y, z) => {
    const e = new T.Group();
    e.position.set(x, y, z);
    e.add(new T.Mesh(new T.IcosahedronGeometry(er, 0), eyeW));
    const q = new T.Mesh(new T.IcosahedronGeometry(er * .6, 0), eyeB);
    q.position.set(er * .25, 0, Math.sign(z) * er * .55);
    e.add(q);
    pv[0].add(e);
  };
  [1, -1].forEach(s => S.ham ? eye(-l * .5, 0, s * S.ham) : eye(-l * .7, hh[1] * .25, s * ww[1] * .62));

  // Martelo, Espada/Bico e Mandíbula
  if (S.ham) {
    const hg = new T.CylinderGeometry(.15, .15, S.ham * 2, 5);
    hg.rotateX(Math.PI / 2);
    hg.scale(1.8, 1, 1);
    const m = new T.Mesh(hg, new T.MeshStandardMaterial({ color: S.c[0], flatShading: true }));
    m.position.set(-l * .5, -.02, 0);
    pv[0].add(m);
  }
  if (S.bill) {
    const bg = new T.ConeGeometry(.07, S.bill, 4);
    bg.rotateZ(-Math.PI / 2);
    bg.translate(S.bill / 2, 0, 0);
    pv[0].add(new T.Mesh(bg, new T.MeshStandardMaterial({ color: S.ac, flatShading: true })));
  }
  let jv = null;
  if (S.j) {
    jv = new T.Object3D();
    jv.position.set(-l * .8, -hh[1] * .45, 0);
    const jl = l * .8 * S.j;
    const jg = new T.ConeGeometry(hh[1] * .3 + .03, jl, 4);
    jg.rotateZ(-Math.PI / 2);
    jg.translate(jl / 2, 0, 0);
    jv.add(new T.Mesh(jg, new T.MeshStandardMaterial({ color: S.c[1], flatShading: true })));
    pv[0].add(jv);
  }

  return { g, pv, tl, rip, pf, jv, S };
}

/**
 * Propaga a onda senoidal através da espinha, nadadeiras e mandíbula.
 * Na curva, a cabeça (junta 0) lidera a nova direção e o corpo segue com propagação de onda hidrodinâmica.
 */
export function swim(o, T, x = 1, a = 1, turnRate = 0) {
  if (!o || !o.S) return 1.0;
  const S = Object.assign({}, DEF, o.S);
  const n = S.n || 8;
  const sp = S.sp || 5;
  const w = T * sp * x;
  const am = S.am || 0.09;
  const st = S.st || 1;
  const ph = S.ph || 0.55;
  const dr = S.dr !== undefined ? S.dr : 0.35;
  const fl = S.fl !== undefined ? S.fl : 0.25;

  if (o.pv && o.pv.length) {
    const totalSegs = o.pv.length;
    o.pv.forEach((p, i) => {
      const segRatio = totalSegs > 1 ? i / (totalSegs - 1) : 0;
      
      // Na cadeia hierárquica de juntas: a cabeça (i=0) vira primeiro liderando a curva,
      // e os segmentos seguintes atenuam a rotação acumulada para o corpo seguir a cabeça
      let turnFlex = 0;
      if (i === 0) {
        turnFlex = turnRate * 0.18; // Cabeça aponta para a direção da curva
      } else {
        turnFlex = -turnRate * 0.035; // Corpo e cauda acompanham em onda suave
      }

      p.rotation.y = turnFlex + a * am * Math.pow(segRatio, st) * Math.sin(w - i * ph);
    });
  }
  if (o.tl) {
    const turnTailOffset = -turnRate * 0.08;
    o.tl.rotation.y = turnTailOffset + a * am * 2.2 * Math.sin(w - n * ph);
  }
  if (o.rip) {
    o.rip.forEach(([m, i]) => {
      m.rotation.x = .12 * Math.sin(w - i * ph * 1.4);
    });
  }
  if (o.pf) {
    o.pf.forEach(([h, s]) => {
      // Nadadeira peitoral do lado interno da curva abre para atuar como leme/freio hidrodinâmico
      const innerFinDrag = (s * turnRate > 0) ? Math.abs(turnRate) * 0.22 : 0;
      h.rotation.x = s * (Math.PI / 2 + dr + fl * Math.sin(w * .6) + innerFinDrag);
    });
  }
  if (o.jv) {
    o.jv.rotation.z = -(.1 + .09 * Math.sin(w * .5));
  }

  // Fator de impulso procedural (pulse) gerado pelo batimento da cauda
  const thrustPulse = 0.75 + 0.5 * Math.pow(Math.abs(Math.cos(w)), 1.5);
  return thrustPulse;
}

/**
 * Constrói malha compatível para inspeção e ecosistema
 */
export function createArticulatedFishMesh(speciesIdOrObj) {
  let sObj = typeof speciesIdOrObj === 'object' ? speciesIdOrObj : SPC.find(s => s.id === speciesIdOrObj);
  if (!sObj) sObj = SPC[0];

  const fishObj = buildFish(sObj);
  const root = new T.Group();
  root.name = `fish_root_${sObj.id}`;
  root.add(fishObj.g);

  return {
    group: root,
    fishObj,
    joints: fishObj.pv,
    species: sObj,
    speciesId: sObj.id
  };
}

// ============================================================================
// SIMULADOR DE COMPORTAMENTO & ECOSSISTEMA DE PEIXES POR BIOMA
// ============================================================================

const BIOME_SPECIES_MAP = {
  // Biomas Tropicais e Arrecifais (Águas Claras e Rasas)
  'Campina florida': ['peixe_palhaco', 'peixe_anjo', 'cirurgiao', 'baiacu', 'peixe_leao', 'dourado'],
  'Jardim de cerejeiras': ['peixe_palhaco', 'peixe_anjo', 'cirurgiao', 'baiacu', 'peixe_leao'],
  
  // Biomas Rochosos e Costões (Canais, Falésias e Fendas)
  'Costão rochoso': ['moreia', 'garoupa', 'tubarao_martelo', 'barracuda', 'arraia'],
  'Pinheiral': ['moreia', 'garoupa', 'tubarao_martelo', 'barracuda', 'arraia'],
  
  // Biomas Frios e Temperados (Águas Profundas e Oceano Aberto)
  'Tundra nevada': ['atum', 'espada', 'peixe_lua', 'tubarao_branco'],
  'Bosque de outono': ['dourado', 'atum', 'arraia', 'peixe_lua', 'barracuda'],
  
  // Alto-mar / Oceano Pelágico
  'Mar Aberto': ['tubarao_branco', 'espada', 'atum', 'dourado', 'barracuda', 'arraia', 'tubarao_martelo', 'peixe_lua']
};

export function disposeFish(group) {
  if (!group) return;
  group.traverse(child => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

export class FishWorldManager {
  constructor() {
    this.fishList = [];
    this.container = new T.Group();
    this.container.name = 'fish_world_container';
    sc.add(this.container);
  }

  getSpeciesForLocation(wx, wz) {
    let biomeName = 'Mar Aberto';
    let isShallow = false;

    if (window.MAP) {
      if (typeof window.MAP.biome === 'function') {
        biomeName = window.MAP.biome(wx, wz) || 'Mar Aberto';
      }
      if (typeof window.MAP.depth === 'function') {
        const d = window.MAP.depth(wx, wz);
        isShallow = d < 4.0;
      }
    }

    if (isShallow && (biomeName === 'Campina florida' || biomeName === 'Jardim de cerejeiras')) {
      const shallowList = ['peixe_palhaco', 'peixe_anjo', 'cirurgiao', 'baiacu'];
      return shallowList[Math.floor(Math.random() * shallowList.length)];
    }

    const available = BIOME_SPECIES_MAP[biomeName] || BIOME_SPECIES_MAP['Mar Aberto'];
    return available[Math.floor(Math.random() * available.length)];
  }

  spawnEcosystem(centerX = 0, centerZ = 0) {
    this.clearAll();

    const totalFish = 14;
    for (let i = 0; i < totalFish; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = rnd(25, 140);
      const wx = centerX + Math.cos(angle) * dist;
      const wz = centerZ + Math.sin(angle) * dist;

      const speciesId = this.getSpeciesForLocation(wx, wz);
      this.spawnFish(speciesId, wx, wz, centerX, centerZ);
    }
  }

  spawnFish(speciesId, wx, wz, playerX = 0, playerZ = 0) {
    const articulated = createArticulatedFishMesh(speciesId);
    this.container.add(articulated.group);

    const baseDepth = speciesId === 'arraia' ? 0.75 :
                      speciesId === 'tubarao_branco' || speciesId === 'tubarao_martelo' ? 0.65 :
                      speciesId === 'moreia' || speciesId === 'garoupa' ? 0.85 : 0.45;

    const waterY = H(wx, wz);
    articulated.group.position.set(wx - playerX, waterY - baseDepth, wz - playerZ);

    const fishData = {
      ...articulated,
      wx,
      wz,
      baseDepth,
      heading: Math.random() * Math.PI * 2,
      speed: rnd(2.5, 4.5),
      currentSpeed: rnd(2.5, 4.5),
      animPhase: Math.random() * 100,
      isFlying: false,
      flyTime: 0,
      jumpVy: 0,
      jumpY: 0,
      jumpCooldown: rnd(20, 60),
      jumpDuration: rnd(1.2, 2.0)
    };

    // Ajusta escala natural
    const scaleFactor = 0.55;
    articulated.group.scale.setScalar(scaleFactor);

    this.fishList.push(fishData);
    return fishData;
  }

  clearAll() {
    this.fishList.forEach(f => {
      this.container.remove(f.group);
      disposeFish(f.group);
    });
    this.fishList = [];
  }

  update(dt, now, playerX, playerZ) {
    const timeSec = now * 0.001;

    for (let i = 0; i < this.fishList.length; i++) {
      const f = this.fishList[i];
      const { group, fishObj, speciesId } = f;

      // 1. Manutenção de distância do jogador
      const distToPlayer = Math.hypot(f.wx - playerX, f.wz - playerZ);
      if (distToPlayer > 175) {
        const reAngle = ST.hd + rnd(-1.4, 1.4);
        const reDist = rnd(45, 120);
        f.wx = playerX + Math.sin(reAngle) * reDist;
        f.wz = playerZ + Math.cos(reAngle) * reDist;
        f.heading = reAngle + rnd(-0.5, 0.5);

        const newSpecies = this.getSpeciesForLocation(f.wx, f.wz);
        if (newSpecies !== f.speciesId && Math.random() < 0.4) {
          this.container.remove(f.group);
          disposeFish(f.group);
          const newArticulated = createArticulatedFishMesh(newSpecies);
          newArticulated.group.scale.setScalar(0.55);
          this.container.add(newArticulated.group);
          f.group = newArticulated.group;
          f.fishObj = newArticulated.fishObj;
          f.species = newArticulated.species;
          f.speciesId = newSpecies;
        }
      }

      // Taxa de giro da direção (turnRate)
      const turnRate = Math.sin(timeSec * 0.35 + f.animPhase);
      f.heading += turnRate * dt * 0.22;

      // 2. Animação de natação com curvatura da espinha e impulso da cauda
      let thrustPulse = 1.0;
      if (distToPlayer < 120) {
        thrustPulse = swim(fishObj, timeSec * f.speed, 1, 1, turnRate);
      }

      // 3. Saltos balísticos físicos com gravidade de peixes velozes
      const canJump = (speciesId === 'dourado' || speciesId === 'atum' || speciesId === 'espada');
      if (canJump) {
        f.jumpCooldown -= dt;
        if (!f.isFlying && f.jumpCooldown <= 0) {
          f.isFlying = true;
          f.jumpVy = rnd(3.8, 5.2);
          f.jumpY = 0;
          f.jumpCooldown = rnd(25, 70);
          spawnSplash(f.wx, f.wz, 15, 1.2);
          spawnRipple(f.wx, f.wz, 1.5);
          if (window.fishingSystem && window.fishingSystem.playSfx && distToPlayer < 80) {
            window.fishingSystem.playSfx('splash');
          }
        }

        if (f.isFlying) {
          f.jumpVy -= 9.81 * dt;
          f.jumpY += f.jumpVy * dt;
          const waterY = H(f.wx, f.wz);

          group.position.y = waterY + Math.max(0, f.jumpY);
          group.rotation.x = -Math.atan2(f.jumpVy, Math.max(1, f.currentSpeed || f.speed));

          if (f.jumpY <= 0 && f.jumpVy < 0) {
            f.isFlying = false;
            f.jumpY = 0;
            group.rotation.x = 0;
            spawnSplash(f.wx, f.wz, 15, 1.0);
            spawnRipple(f.wx, f.wz, 1.2);
            if (window.fishingSystem && window.fishingSystem.playSfx && distToPlayer < 80) {
              window.fishingSystem.playSfx('splash');
            }
          }
        }
      }

      // 4. Dinâmica no mar e alinhamento com a inclinação (normal) das ondas
      if (!f.isFlying) {
        const waterY = H(f.wx, f.wz);
        const targetY = waterY - f.baseDepth;
        group.position.y += (targetY - group.position.y) * dt * 5.0;

        // Amostragem de altura nas proximidades para calcular inclinação da onda
        const sampleDist = 0.8;
        const hFwd = H(f.wx + Math.sin(f.heading) * sampleDist, f.wz + Math.cos(f.heading) * sampleDist);
        const hRight = H(f.wx + Math.cos(f.heading) * sampleDist, f.wz - Math.sin(f.heading) * sampleDist);
        const wavePitch = Math.atan2(hFwd - waterY, sampleDist);
        const waveRoll = Math.atan2(hRight - waterY, sampleDist);

        // Inclinação hidrodinâmica (banking/roll) ao fazer curvas
        const turnBanking = -turnRate * 0.18;

        group.rotation.y = f.heading - Math.PI / 2;
        group.rotation.x = wavePitch * 0.45;
        group.rotation.z = waveRoll * 0.45 + turnBanking + Math.sin(timeSec * 3 + f.animPhase) * 0.04;
      }

      // Acoplamento da velocidade linear com o impulso procedural da cauda
      const targetSpeed = f.isFlying ? f.speed * 1.5 : f.speed * thrustPulse;
      if (!f.currentSpeed) f.currentSpeed = f.speed;
      f.currentSpeed += (targetSpeed - f.currentSpeed) * Math.min(1, dt * 5.0);

      f.wx += Math.sin(f.heading) * f.currentSpeed * dt;
      f.wz += Math.cos(f.heading) * f.currentSpeed * dt;

      group.position.x = f.wx - playerX;
      group.position.z = f.wz - playerZ;
    }
  }
}

export const fishManager = new FishWorldManager();
