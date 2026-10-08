import * as THREE from 'three';
import { clamp, wrapA } from '../core/math.js';
import { cam, sc, cv } from '../core/renderer.js';
import { S, WI, ST, CAM, GAME, fp } from '../core/state.js';
import { H } from './ocean.js';
import { spawnSplash, spawnRipple, spawnLineWake } from './weather.js';
import { ILHAS } from './archipelago.js';
import { SPC, buildFish, swim, createArticulatedFishMesh } from './fish.js';
import { Audio } from '../core/audio.js';

const T = THREE;
const PI = Math.PI;

// ============================================================================
// AS 10 VARAS DE PESCA PROCEDURAIS
// ============================================================================
export const RODS = [
  { n: 'Cana crua', N: 5, L: .36, b: .0165, w: [0xb59b5a, 0xa08a4c], g: 0, r: 0, q: 0, gm: 0, f: 4, bn: 0, k: 0, fl: 0 },
  { n: 'Vara de aveleira', N: 5, L: .34, b: .0185, w: [0x7b5a3a, 0x6b4c30], g: 1, r: 0, q: 0, gm: 0, f: 1, bn: 0, k: 0, fl: 0 },
  { n: 'Bambu das Índias', N: 6, L: .3, b: .0165, w: [0xc9b45e, 0xb89f4a], g: 1, r: 0, q: 2, gm: 0, f: 1, bn: 0, k: 0, fl: 0 },
  { n: 'Freixo emendado', N: 6, L: .3, b: .0175, w: [0x8a5a32, 0x9a6a3c], g: 2, r: 0, q: 3, gm: 0, f: 1, bn: 1, k: 0, fl: 1 },
  { n: 'Carretel de mão', N: 7, L: .26, b: .0175, w: [0x8a5a32, 0x74492a], g: 2, r: 1, q: 3, gm: 0, f: 1, bn: 1, k: 1, fl: 1 },
  { n: 'Molinete de madeira', N: 9, L: .2, b: .0185, w: [0x8a5a32, 0x74492a, 0x9a6a3c], g: 2, r: 2, q: 4, gm: 0, f: 1, bn: 1, k: 1, fl: 1 },
  { n: 'Vara do contramestre', N: 8, L: .24, b: .0185, w: [0x5a3a22, 0x4b2e18, 0x6a4528], g: 3, r: 3, q: 5, gm: 1, f: 2, bn: 1, k: 1, fl: 1 },
  { n: 'Vara de oficial', N: 9, L: .22, b: .019, w: [0x3b2a20, 0x2f2019, 0x4a3428], g: 3, r: 4, q: 5, gm: 2, f: 2, bn: 1, k: 1, fl: 1 },
  { n: 'Vara do imediato', N: 9, L: .22, b: .019, w: [0x211a17, 0x2a201b, 0x33261f], g: 3, r: 5, q: 5, gm: 2, f: 3, bn: 1, k: 1, fl: 1 },
  { n: 'Vara do capitão', N: 10, L: .2, b: .02, w: [0x5b1f17, 0x3a1612, 0x6b2a1f], g: 3, r: 5, q: 5, gm: 2, f: 3, bn: 1, k: 2, fl: 1 }
];

export const CAP = [1.5, 4, 8, 15, 30, 60, 120, 250, 500, 1000];

// Tabela de pesca: [índice_espécie, peso_probabilidade, peso_min_kg, peso_max_kg, forca_luta]
const FS = [
  [6, 12, .3, 1.5, .6],   // Baiacu
  [7, 12, .05, .15, .5],  // Peixe-palhaço
  [12, 12, .1, .4, .6],   // Cirurgião-azul
  [8, 12, .3, 1.5, .6],   // Peixe-anjo
  [10, 12, .3, 1.2, .7],  // Peixe-leão
  [11, 6, 2, 15, 1.3],    // Barracuda
  [14, 6, 3, 20, 1.4],    // Dourado
  [13, 6, 4, 40, 1.1],    // Garoupa
  [9, 6, 1, 10, 1.2],     // Moreia
  [0, 3, 60, 250, 1.5],   // Atum-azul
  [1, 3, 50, 300, 1.5],   // Peixe-espada
  [2, 1, 40, 150, 1.2],   // Tubarão-martelo
  [3, 1, 250, 1000, 1.4], // Tubarão-branco
  [4, 1, 200, 900, .9],   // Raia-manta
  [5, 1, 100, 1000, .6]   // Peixe-lua
];

const TIER = { 12: 0, 6: 1, 3: 2, 1: 3 };
const fmtWeight = w => w < 1 ? (w * 1000).toFixed(0) + ' g' : w.toFixed(1) + ' kg';

// Materiais reutilizáveis para construção da vara e boia
const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .85, metalness: 0 }, o));
const matHemp = M(0xc9b27c, { roughness: 1 });
const matNode = M(0x4b2e18);
const matLeather = M(0x4a2c1a);
const matIron = M(0x2d2d31, { roughness: .6, metalness: .5 });
const matBrass = M(0xc29a3e, { roughness: .4, metalness: .6 });
const matBone = M(0xe4d6b0);
const matRed = M(0x9c2a1f);
const matCork = M(0xc79f66);

// Gerador pseudoaleatório determinístico para características da vara
let sd = 7;
const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;

const mesh = (g, m, x = 0, y = 0, z = 0, p = null) => {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  if (p) p.add(o);
  return o;
};
export class FishingSystem {
  constructor() {
    this.equipped = false;
    this.currentRodIdx = 0; // Cana crua por padrão
    this.rod = null;
    this.segs = [];
    this.guides = [];
    this.tip = null;
    this.spool = null;
    this.crank = null;

    // Linha de pesca curva
    this.GMAX = 5;
    this.NL = 22;
    this.lp = new Float32Array((this.GMAX + 2 + this.NL) * 3);
    this.lg = new T.BufferGeometry();
    this.lg.setAttribute('position', new T.BufferAttribute(this.lp, 3));
    this.line = new T.Line(this.lg, new T.LineBasicMaterial({ color: 0xe3d2a2, linewidth: 1.5 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    sc.add(this.line);

    // Boia de cortiça, pena e anzol
    this.bob = new T.Group();
    this.bob.name = 'fishing_bobber';
    this.bob.visible = false;
    this.quill = null;
    this.hang = null;
    this.hk = null;
    this.buildBobber();
    sc.add(this.bob);

    // Vetores de cálculo da linha
    this.V = new T.Vector3();
    this.T = new T.Vector3();
    this.E = new T.Vector3();
    this.from = new T.Vector3();
    this.to = new T.Vector3();
    this.bp = new T.Vector3();
    this.pbp = new T.Vector3();
    this.castDir = new T.Vector3();
    this.camWorldPos = new T.Vector3();
    this.fishPos = new T.Vector3();
    this.localFishPos = new T.Vector3();

    // Cache de modelos de peixes para a ponta do anzol
    this.fishCache = {};

    // Estados do minigame
    this.state = 'idle'; // idle, charge, cast, wait, bite, reel, catch
    this.hold = 0;
    this.pressed = 0;
    this.power = 0;
    this.pdir = 1;
    this.timer = 0;
    this.progress = 0;
    this.tension = 0;
    this.snap = 0;
    this.flick = 0;
    this.rodAngle = .62;
    this.bend = 0;
    this.bendVelocity = 0;
    this.lag = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.mx = 0;
    this.my = 0;
    this.nibbles = 0; // Número de beliscadas restantes

    // Peixe atual no anzol
    this.fish = null;
    this.showObj = null;
    this.showTime = 0;
    this.castTimer = 0;
    this.castDuration = 1;
    this.castDist = 10;
    this.lineLength = 10;
    this.dx = 0;
    this.dz = -1;
    this.counterControl = 0;
    this.fishYaw = 0;
    this.lateral = 0;
    this.heat = 0;
    this.lineOffset = 0;
    this.shake = 0;
    this.animProg = 0;
    this.hangVert = 0;
    this.lastArrowKey = '';

    // Estatísticas da sessão
    this.totalCaught = 0;
    this.speciesSeen = new Set();
    this.bestWeight = 0;
    this.bestName = '';
    this.statusMsg = '';
    this.statusTimer = 0;

    this.btnLeftHold = false;
    this.btnRightHold = false;

    // Cache de referências de UI
    this.ui = {
      hud: null,
      top: null,
      sel: null,
      rn: null,
      log: null,
      hint: null,
      arw: null,
      pwb: null,
      pwf: null,
      tnb: null,
      tnf: null,
      sbb: null,
      sbf: null,
      btnToggle: null,
      btnLeft: null,
      btnRight: null
    };

    // Áudio Web Audio procedural sintetizado
    this.audioCtx = null;
  }

  init() {
    this.bindUI();
    this.setupInputs();
  }

  playSfx(type, params = {}) {
    switch (type) {
      case 'cast_whistle': Audio.play('linha_assobio'); break;
      case 'splash': Audio.play('splash', params); break;
      case 'bite': Audio.play('plop'); break;
      case 'catch': Audio.play('peixe_convez'); break;
      case 'snap': Audio.play('carretel_freada'); break;
    }
  }

  buildBobber() {
    mesh(new T.SphereGeometry(.055, 6, 4), matCork, 0, 0, 0, this.bob).scale.y = 1.25;
    mesh(new T.CylinderGeometry(.0095, .0095, .012, 5), matHemp, 0, .055, 0, this.bob);

    this.quill = new T.Group();
    this.bob.add(this.quill);
    mesh(new T.CylinderGeometry(.0065, .0065, .2, 4), matBone, 0, .14, 0, this.quill);
    mesh(new T.CylinderGeometry(.0072, .0072, .05, 4), M(0x7a2a1c), 0, .215, 0, this.quill);

    mesh(new T.CylinderGeometry(.0015, .0015, .26, 3), matHemp, 0, -.13, 0, this.bob);
    mesh(new T.SphereGeometry(.017, 4, 3), M(0x5a5f66), 0, -.17, 0, this.bob);
    mesh(new T.TorusGeometry(.016, .0032, 4, 6, 4.4), matIron, 0, -.28, 0, this.bob).rotation.z = PI * .8;

    this.hang = new T.Group();
    this.hang.position.y = -.28;
    this.hang.rotation.order = 'YZX';
    this.hk = new T.Group();
    this.hk.rotation.z = PI / 2;
    this.hang.add(this.hk);
    this.bob.add(this.hang);
    this.hang.visible = false;
  }

  buildRod(k) {
    const S = RODS[k];
    const W = S.w.map(c => M(c));
    const b0 = S.b, N = S.N, SL = S.L, sum = N * (N + 1) / 2;
    sd = 11 + k * 7;

    if (this.rod) {
      cam.remove(this.rod);
      this.rod = null;
    }

    this.rod = new T.Group();
    this.rod.name = 'fishing_rod';
    this.rod.rotation.order = 'YXZ';
    this.rod.position.set(.3, S.r ? -.14 : -.22, -.68);
    cam.add(this.rod);

    this.segs = [];
    this.guides = [];
    this.spool = null;
    this.crank = null;

    const cyl = (a, b, h, s, m, y, p = this.rod) => mesh(new T.CylinderGeometry(a, b, h, s), m, 0, y, 0, p);
    const hr = y => b0 * (.98 - y) + .0015;

    // Cabo
    cyl(b0, b0 * 1.3, .3, 7, W[0], -.17);
    if (S.g < 3) cyl(b0 * 1.03, b0 * 1.03, .03, 7, W[1 % W.length], -.01);
    if (S.g) for (const y of [-.29, -.245, -.2, -.06]) cyl(hr(y), hr(y), .036, 7, S.g === 1 ? matHemp : matLeather, y);
    if (S.g === 3) cyl(hr(-.015) + .004, hr(-.015) + .004, .016, 7, matBrass, -.015);
    if (S.k) cyl(b0 * 1.45, b0 * 1.35, .03, 7, matBrass, -.33);
    if (S.k === 2) {
      cyl(hr(-.235) + .003, hr(-.235) + .003, .04, 7, matRed, -.235);
      for (const x of [-.012, .012]) mesh(new T.BoxGeometry(.012, .07, .004), matRed, x, -.285, -hr(-.28) - .003, this.rod);
    }

    // Molinete
    if (S.r) {
      for (const y of [-.115, -.165]) cyl(hr(y) + .001, hr(y) + .001, .014, 7, matHemp, y);
      const R = S.r, rg = new T.Group();
      rg.position.set(0, -.14, -.058);
      this.rod.add(rg);

      const drum = R >= 4 ? matBrass : W[2 % W.length];
      const fl = R >= 3 ? matBrass : W[1 % W.length];
      const fr = R >= 5 ? .054 : R === 1 ? .036 : .044;
      cyl(.01, .01, .11, 6, matIron, 0, rg).rotation.z = PI / 2;

      this.spool = new T.Group();
      rg.add(this.spool);
      cyl(.03, .03, .04, 8, drum, 0, this.spool).rotation.z = PI / 2;
      cyl(.036, .036, .036, 8, matHemp, 0, this.spool).rotation.z = PI / 2;
      for (const s of [-1, 1]) mesh(new T.CylinderGeometry(fr, fr, .006, 8), fl, s * .024, 0, 0, this.spool).rotation.z = PI / 2;
      mesh(new T.BoxGeometry(.034, .05, .05), W[0], 0, 0, .032, rg);

      if (R >= 1) {
        this.crank = new T.Group();
        // Inverte o lado da manivela para as varas de nível superior (4-9)
        const side = k >= 4 ? -1 : 1;
        this.crank.position.x = .057 * side;
        rg.add(this.crank);
        mesh(new T.BoxGeometry(.006, .065, .008), matIron, 0, .03, 0, this.crank);
        mesh(new T.CylinderGeometry(.011, .011, .03, 5), R === 5 ? matBone : W[2 % W.length], .014 * side, .064, 0, this.crank).rotation.z = PI / 2;
      } else {
        this.crank = this.spool;
      }
    } else if (S.q && S.r) {
      this.spool = new T.Object3D();
      this.spool.position.set(0, -.1, -b0 * 1.25);
      this.rod.add(this.spool);
      mesh(new T.SphereGeometry(.008, 4, 3), matHemp, 0, 0, 0, this.spool);
    }

    const gi = [];
    if (S.r) {
      for (let q = 1; q <= S.q; q++) gi.push(Math.floor(q * N / (S.q + 1)));
    }

    let par = this.rod;
    for (let i = 0; i < N; i++) {
      const j = new T.Group();
      j.position.y = i ? SL : 0;
      j.userData.w = (i + 1) / sum;
      j.rotation.y = (rnd() - .5) * .02;
      j.rotation.z = (rnd() - .5) * .02;
      par.add(j);
      this.segs.push(j);
      par = j;

      const b = b0 * (1 - .8 * i / N), bt = b0 * (1 - .8 * (i + 1) / N);
      mesh(new T.CylinderGeometry(bt, b, SL, 6), i === N - 1 && S.bn ? matBone : W[i % W.length], 0, SL / 2, 0, j);

      if (i && (S.f === 1 || S.f === 4)) {
        mesh(new T.CylinderGeometry(b + .002, b + .002, .016, 6), i % 3 === 0 && S.f === 1 ? matHemp : matNode, 0, .008, 0, j);
      }
      if (i && S.f > 1 && S.f < 4) {
        mesh(new T.CylinderGeometry(b + .0025, b + .0025, .022, 6), matBrass, 0, .011, 0, j);
        if (S.f === 3) mesh(new T.CylinderGeometry(bt * 1.1 + .0015, bt * 1.1 + .0015, .01, 6), matBone, 0, SL * .5, 0, j);
      }
      if (gi.includes(i)) {
        const gr = Math.max(.005, .0135 - i * .0009) * (S.gm ? 1.1 : 1);
        const g = mesh(new T.TorusGeometry(gr, S.gm ? .0016 : .0022, 4, S.gm ? 8 : 6), [matHemp, matIron, matBrass][S.gm], 0, SL * .5, -(b + gr * .8), j);
        g.rotation.x = PI / 2;
        this.guides.push(g);
      }
    }

    this.tip = new T.Object3D();
    this.tip.position.y = SL;
    par.add(this.tip);
    mesh(new T.SphereGeometry(S.q && S.r ? .006 : .009, 4, 3), matHemp, 0, SL, 0, par);
    if (!S.r) {
      // Amarração tradicional do cordel na ponta da vara de caniço
      mesh(new T.CylinderGeometry(.004, .005, .03, 5), matHemp, 0, SL - .015, 0, par);
    }
  }

  setLine(sag) {
    let k = 0;
    const put = v => {
      this.lp[k++] = v.x;
      this.lp[k++] = v.y;
      this.lp[k++] = v.z;
    };

    if (this.spool) {
      this.spool.getWorldPosition(this.V);
      put(this.V);
    }
    this.guides.forEach(g => {
      g.getWorldPosition(this.V);
      put(this.V);
    });
    this.tip.getWorldPosition(this.T);
    put(this.T);

    // Influência do vento na curvatura da linha (catenária horizontal e vertical)
    const windEffect = WI.wsp * 0.012;
    const windDirX = Math.sin(WI.a);
    const windDirZ = Math.cos(WI.a);

    for (let i = 1; i <= this.NL; i++) {
      const u = i / this.NL;
      this.V.lerpVectors(this.T, this.E, u);
      
      const arch = 4 * u * (1 - u);
      this.V.y -= sag * arch;
      
      // Deflexão lateral pelo vento (mais visível em linhas frouxas/sag alto)
      const windDrift = windEffect * (0.5 + sag * 1.5) * arch;
      this.V.x += windDirX * windDrift;
      this.V.z += windDirZ * windDrift;
      
      put(this.V);
    }

    this.lg.setDrawRange(0, k / 3);
    this.lg.attributes.position.needsUpdate = true;
  }

  getFishModel(speciesIdx) {
    if (!this.fishCache[speciesIdx]) {
      const DEF = { n: 8, tp: .85, pk: .38, st: 1, sp: 5, ph: .55, am: .09, fl: .25, dr: .35, px: 0, t: [.6, .5, .5, .1] };
      const S = Object.assign({}, DEF, SPC[speciesIdx]);
      const o = buildFish(S);
      o.S = S;
      this.fishCache[speciesIdx] = o;
    }
    return this.fishCache[speciesIdx];
  }

  pickFish() {
    const rodCap = CAP[this.currentRodIdx];
    // Filtra espécies compatíveis com o porte da vara atual
    // Varas leves pegam peixes costeiros e médios; gigantes exigem varas pesadas de alto mar
    const candidates = FS.filter(x => {
      const minW = x[2];
      return minW <= rodCap * 2.2;
    });
    const pool = candidates.length > 0 ? candidates : FS.slice(0, 5);

    const totalWeight = pool.reduce((a, x) => a + x[1], 0);
    let r = Math.random() * totalWeight;
    let e = pool[0];
    for (const x of pool) {
      if ((r -= x[1]) < 0) {
        e = x;
        break;
      }
    }
    const u = Math.pow(Math.random(), 1.6);
    const S = SPC[e[0]];
    const weight = e[2] + (e[3] - e[2]) * u;
    return {
      k: e[0],
      t: TIER[e[1]] || 0,
      str: e[4],
      n: S.nm,
      l: S.lt,
      w: weight,
      u,
      s: Math.random() * 20,
      sta: 1.0,
      ph: 1, // Inicia imediatamente em alerta de briga
      tm: 0.6 + Math.random() * 0.4,
      fd: Math.random() < 0.5 ? -1 : 1
    };
  }

  attach(f) {
    const o = this.getFishModel(f.k);
    if (this.showObj && this.showObj !== o.g) {
      this.detach();
    }
    this.showObj = o.g;
    this.showObj.userData.o = o;
    // Escala proporcional e bem visível no mar e na captura
    const baseLength = o.S.L || 3.0;
    this.showObj.userData.s = Math.max(0.45, Math.min(0.4 + 0.35 * Math.cbrt(f.w), 2.6)) / baseLength;
    this.showObj.scale.setScalar(.001);
    this.showObj.position.set(0, 0, 0);
    this.showObj.rotation.set(0, 0, 0);
    this.showObj.traverse(child => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.visible = true;
      }
    });
    this.showObj.visible = true;
    this.hk.add(this.showObj);
    this.hang.visible = true;
    this.animProg = 0;
    this.hangVert = 0;
    this.fishYaw = Math.atan2(this.dz, -this.dx);
  }

  detach() {
    if (this.showObj) {
      this.hk.remove(this.showObj);
      this.showObj = null;
    }
    this.hang.visible = false;
  }

  cast() {
    Audio.reelStart(80);
    this.playSfx('cast_whistle');
    this.state = 'cast';
    this.castTimer = 0;
    this.progress = 0;
    this.tension = 0;
    this.snap = 0;
    const S = RODS[this.currentRodIdx];
    if (S.r) {
      // Varas com carretel (4 a 9): lançamento longo
      this.castDist = 10 + this.power * 24;
    } else {
      // Varas de linha fixa (0 a 3): alcance curto limitado pelo comprimento da linha presa na ponta
      const rodLen = S.N * S.L * 3.4;
      this.castDist = Math.max(5.0, Math.min(7.8, rodLen * 0.95 + this.power * 2.0));
    }
    this.castDuration = .5 + this.castDist * .02;
    this.flick = 1.2;

    cam.getWorldPosition(this.camWorldPos);
    cam.getWorldDirection(this.castDir);
    this.castDir.y = 0;
    this.castDir.normalize();

    this.dx = this.castDir.x;
    this.dz = this.castDir.z;

    this.tip.getWorldPosition(this.from);
    this.to.set(this.camWorldPos.x + this.dx * this.castDist, 0, this.camWorldPos.z + this.dz * this.castDist);
    this.fishPos.copy(this.to);
    this.lineLength = this.castDist;
    this.landedType = 'water';
    this.landedY = 0;
  }

  startReel(f) {
    Audio.reelStart(0);
    this.fish = f;
    this.state = 'reel';
    this.progress = 0;
    this.tension = 0;
    this.snap = 0;
    this.heat = 0;
    this.lineOffset = 0;
    this.lineLength = Math.max(5.0, this.castDist);
    this.fishPos.copy(this.to);
    this.bp.copy(this.to);
    if (f) {
      if (!this.showObj) this.attach(f);
      this.say('BRIGUE COM O PEIXE!', 1.5);
    } else {
      this.timer = 2 + Math.random() * 4;
    }
  }

  escape() {
    Audio.reelStop(false);
    this.fish = null;
    this.detach();
    this.state = 'idle';
    this.tension = 0;
    this.flick = 1.2;
    this.say('O peixe escapou!', 2.4);
  }

  lose() {
    Audio.reelStop(true);
    this.playSfx('snap');
    this.detach();
    this.state = 'idle';
    this.fish = null;
    this.tension = 0;
    this.flick = 1.5;
    this.say('A linha arrebentou! Lance novamente.', 2.4);
  }

  finish() {
    Audio.reelStop(false);
    this.tension = 0;
    if (!this.fish) {
      this.state = 'idle';
      this.say('Linha recolhida. Lance de novo.', 1.8);
      return;
    }
    this.playSfx('catch');
    
    // Dispara partículas de respingo na saída do peixe
    spawnSplash(this.bp.x, this.bp.z, 25, 1.4);
    spawnRipple(this.bp.x, this.bp.z, 2.0, 2.5);
    
    // Armazena a posição inicial para a parábola de içamento
    this.catchFrom = this.bp.clone();
    
    this.state = 'catch';
    this.showTime = 0;
    this.totalCaught++;
    this.fish.nw = !this.speciesSeen.has(this.fish.k);
    this.speciesSeen.add(this.fish.k);
    if (this.fish.w > this.bestWeight) {
      this.bestWeight = this.fish.w;
      this.bestName = this.fish.n;
    }
    this.say('FISGADO! Clique para coletar.', 5);
  }

  collectFish() {
    if (!this.fish) return;
    
    if (GAME.backpack.length >= 8) {
      this.say('⚠️ MOCHILA CHEIA!', 2.5);
      return;
    }

    const item = {
      id: Date.now(),
      speciesId: this.fish.k,
      name: this.fish.n,
      weight: this.fish.w,
      tier: this.fish.t,
      icon: '🐟'
    };

    GAME.backpack.push(item);
    
    // Registra no Bestiário se for nova espécie
    if (!GAME.discoveredSpecies.includes(item.speciesId)) {
      GAME.discoveredSpecies.push(item.speciesId);
      this.say(`✨ NOVO REGISTRO: ${item.name}!`, 3.5);
    } else {
      this.say(`${item.name} (${fmtWeight(item.weight)}) guardado!`, 2.5);
    }
    
    this.playSfx('catch');
    
    this.detach();
    this.fish = null;
    this.state = 'idle';
  }

  say(msg, dur = 2) {
    this.statusMsg = msg;
    this.statusTimer = dur;
  }

  equipRod(k) {
    if (!CAM.fpv) return;
    if (k === this.currentRodIdx && this.equipped) {
      this.unequip();
      return;
    }
    this.equipped = true;
    this.currentRodIdx = k;
    this.buildRod(k);

    if (this.quill) this.quill.visible = !!RODS[k].fl;
    this.state = 'idle';
    this.fish = null;
    this.tension = 0;
    this.power = 0;
    this.flick = 0;
    this.bend = 0;
    this.bendVelocity = 0;
    this.statusTimer = 0;
    this.detach();
    this.line.visible = true;
    this.bob.visible = true;

    if (this.ui.hud) this.ui.hud.style.display = 'block';
  }

  unequip() {
    this.equipped = false;
    Audio.reelStop(false);
    if (this.rod) this.rod.visible = false;
    this.detach();
    this.fish = null;
    this.state = 'idle';
    this.tension = 0;
    this.power = 0;
    this.bend = 0;
    this.bendVelocity = 0;
    this.statusTimer = 0;
    this.btnLeftHold = false;
    this.btnRightHold = false;
    this.line.visible = false;
    this.bob.visible = false;

    if (this.ui.btnLeft) this.ui.btnLeft.classList.remove('visible', 'pulse', 'active');
    if (this.ui.btnRight) this.ui.btnRight.classList.remove('visible', 'pulse', 'active');
    if (this.ui.hud) this.ui.hud.style.display = 'none';
  }

  toggleFishing() {
    if (!CAM.fpv) {
      if (this.equipped) this.unequip();
      return;
    }
    if (this.equipped) {
      this.unequip();
    } else {
      this.equipRod(this.currentRodIdx);
    }
  }

  bindUI() {
    this.ui.hud = document.getElementById('fishing-hud');
    this.ui.pwb = document.getElementById('fishing-pwb');
    this.ui.pwf = document.getElementById('fishing-pwf');
    this.ui.tnb = document.getElementById('fishing-tnb');
    this.ui.tnf = document.getElementById('fishing-tnf');
    this.ui.btnAction = document.getElementById('fishing-btn-action');
    this.ui.btnLabel = document.getElementById('fishing-btn-label');
    this.ui.btnIcon = document.getElementById('fishing-btn-icon');
    this.ui.btnLeft = document.getElementById('fishing-btn-left');
    this.ui.btnRight = document.getElementById('fishing-btn-right');
  }

  setupInputs() {
    const look = e => {
      if (document.pointerLockElement) {
        this.mx = Math.max(-1, Math.min(1, this.mx + (e.movementX || 0) * 0.005));
        this.my = Math.max(-1, Math.min(1, this.my + (e.movementY || 0) * 0.005));
      } else {
        this.mx = (e.clientX / window.innerWidth) * 2 - 1;
        this.my = (e.clientY / window.innerHeight) * 2 - 1;
      }
    };

    window.addEventListener('pointermove', look);

    if (this.ui.btnAction) {
      const onActionDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.equipped || GAME.state !== 'PLAY' || !CAM.fpv) return;

        if (this.state === 'catch') {
          this.collectFish();
          return;
        }
        this.hold = this.pressed = 1;
        this.ui.btnAction.classList.add('active');
      };

      const onActionUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hold = 0;
        if (this.ui.btnAction) {
          this.ui.btnAction.classList.remove('active');
        }
      };

      this.ui.btnAction.addEventListener('pointerdown', onActionDown);
      this.ui.btnAction.addEventListener('pointerup', onActionUp);
      this.ui.btnAction.addEventListener('pointercancel', onActionUp);
      this.ui.btnAction.addEventListener('pointerleave', onActionUp);
    }

    if (this.ui.btnLeft) {
      const onLeftDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.btnLeftHold = true;
        this.mx = -1.0;
        if (this.ui.btnLeft) this.ui.btnLeft.classList.add('active');
      };
      const onLeftUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.btnLeftHold = false;
        if (this.ui.btnLeft) this.ui.btnLeft.classList.remove('active');
      };
      this.ui.btnLeft.addEventListener('pointerdown', onLeftDown);
      this.ui.btnLeft.addEventListener('pointerup', onLeftUp);
      this.ui.btnLeft.addEventListener('pointercancel', onLeftUp);
      this.ui.btnLeft.addEventListener('pointerleave', onLeftUp);
    }

    if (this.ui.btnRight) {
      const onRightDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.btnRightHold = true;
        this.mx = 1.0;
        if (this.ui.btnRight) this.ui.btnRight.classList.add('active');
      };
      const onRightUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.btnRightHold = false;
        if (this.ui.btnRight) this.ui.btnRight.classList.remove('active');
      };
      this.ui.btnRight.addEventListener('pointerdown', onRightDown);
      this.ui.btnRight.addEventListener('pointerup', onRightUp);
      this.ui.btnRight.addEventListener('pointercancel', onRightUp);
      this.ui.btnRight.addEventListener('pointerleave', onRightUp);
    }

    window.addEventListener('pointerdown', e => {
      if (!this.equipped || GAME.state !== 'PLAY' || !CAM.fpv) return;
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest('#fishing-btn-action') || e.target.closest('.fishing-action-btn') || e.target.closest('#fishing-sel') || e.target.closest('#settings-modal') || e.target.closest('#controls-modal') || e.target.closest('#radial-orders-overlay') || e.target.closest('.modal-overlay')) return;
      look(e);
      this.hold = this.pressed = 1;
    });

    window.addEventListener('pointerup', () => {
      this.hold = 0;
    });
    window.addEventListener('pointercancel', () => {
      this.hold = 0;
    });
    window.addEventListener('blur', () => {
      this.hold = 0;
    });

    window.addEventListener('keydown', e => {
      if (GAME.state !== 'PLAY' || !CAM.fpv) return;
      if (e.target.tagName === 'INPUT') return;

      if (e.code === 'KeyF') {
        e.preventDefault();
        this.toggleFishing();
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        this.equipRod(+e.key);
        return;
      }

      if (e.code === 'Space' && this.equipped) {
        e.preventDefault();
        if (!e.repeat) this.hold = this.pressed = 1;
      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'Space' && this.equipped) {
        this.hold = 0;
      }
    });
  }

  update(dt, t) {
    if (!this.equipped) return;

    const S = RODS[this.currentRodIdx];
    const ld = this.fish ? this.fish.w / CAP[this.currentRodIdx] : 0;
    const k5 = Math.min(1, dt * 5);

    this.yaw += (.7 * Math.tanh(-this.mx * 1.3 / .7) - this.yaw) * k5;
    this.pitch += (-this.my * .3 - .04 - this.pitch) * k5;
    this.lag += (this.yaw - this.lag) * Math.min(1, dt * 6);

    // MÁQUINA DE ESTADOS DE PESCA
    if (this.state === 'idle') {
      if (this.pressed && this.equipped) {
        this.state = 'charge';
        this.power = 0;
        this.pdir = 1;
      }
    } else if (this.state === 'charge') {
      this.power += this.pdir * dt * .9;
      if (this.power > 1) { this.power = 1; this.pdir = -1; }
      if (this.power < 0) { this.power = 0; this.pdir = 1; }
      if (!this.hold) this.cast();
    } else if (this.state === 'cast') {
      this.castTimer += dt;

      // Som de carretel e linha assobiando contínuo durante o lançamento (blocos de 1s)
      if (!this.lastCastSfx || t - this.lastCastSfx > 1.0) {
        this.playSfx('cast_whistle');
        this.lastCastSfx = t;
      }
      
      const u = Math.min(1, this.castTimer / this.castDuration);
      const cps = Math.min(90, 10 + (1 - u) * 80);
      Audio.reelSpeed(cps);

      // Gira a manivela durante o lançamento para realismo (linha saindo)
      if (this.crank && S.r) {
        const rotSpeed = 15 + this.castDist * 0.4;
        this.crank.rotation.x -= dt * rotSpeed;
        if (this.spool !== this.crank) this.spool.rotation.x -= dt * rotSpeed;
      }

      if (this.castTimer >= this.castDuration) {
        Audio.reelStop(false);
        this.playSfx('splash', { k: Math.min(1.7, 0.5 + this.power * 1.2) });
        spawnSplash(this.bp.x, this.bp.z, 12, 1.0);
        spawnRipple(this.bp.x, this.bp.z, 1.0);
        this.state = 'wait';
        this.timer = 4.5 + Math.random() * 6.5;
      }
    } else if (this.state === 'wait') {
      this.timer -= dt;
      this.preHeld = false; // Reset da trava de segurança
      if (this.pressed) {
        // O player decidiu recolher a linha. Se houver um peixe beliscando, ele foge.
        if (this.fish) {
          this.say('Você puxou antes da hora!', 1.5);
          this.fish = null;
          this.detach();
        }
        this.startReel(null);
      } else if (this.timer <= 0) {
        if (!this.fish) {
          // Início da sequência: sorteia peixe e define entre 2 e 5 beliscadas
          this.fish = this.pickFish();
          this.nibbles = Math.floor(rnd(2, 5.9)); 
          this.nibbleCount = 0;
        }

        // Inicia uma beliscada (bite)
        this.attach(this.fish);
        this.playSfx('bite');
        spawnRipple(this.to.x, this.to.z, 0.8, 1.2);
        this.state = 'bite';
        
        // A primeira beliscada é sempre mais rápida e difícil (teste de reflexo puro)
        const isFirst = this.nibbleCount === 0;
        this.timer = isFirst ? 0.38 : rnd(0.5, 0.65);
        this.flick = isFirst ? 0.3 : 0.5;
        this.nibbleCount++;
      }
    } else if (this.state === 'bite') {
      this.timer -= dt;
      // SÓ FISGA SE FOR UM NOVO CLIQUE (pressed), não se já estiver segurando (hold) antes da beliscada
      if (this.pressed) {
        if (!this.preHeld) {
          // Sucesso! Fisgou no momento exato da vibração
          this.startReel(this.fish);
        } else {
          // Falhou pois já estava segurando o botão antes do peixe beliscar
          this.say('Você já estava segurando!', 1.5);
          this.fish = null;
          this.detach();
          this.startReel(null);
        }
      } else if (this.timer <= 0) {
        if (this.nibbleCount < this.nibbles) {
          // Peixe ainda não mordeu de vez, volta a espreitar
          this.state = 'wait';
          this.timer = rnd(0.8, 2.4);
        } else {
          // Acabaram as beliscadas, o peixe desistiu mas a linha fica na água (como solicitado)
          this.fish = null;
          this.detach();
          this.state = 'wait';
          this.timer = rnd(3.0, 8.0); // Espera por um novo peixe
          this.say('O peixe desistiu...', 2.0);
        }
      }
      
      // Ao entrar no estado de bite, registramos se o player já estava segurando
      // Se ele já estava segurando, invalidamos a fisgada automática
      if (this.timer > 0 && this.hold && !this.pressed) {
        this.preHeld = true;
      }
    } else if (this.state === 'reel') {
      cam.getWorldPosition(this.camWorldPos);
      cam.getWorldDirection(this.castDir);
      this.castDir.y = 0;
      this.castDir.normalize();

      const targetBoatX = this.camWorldPos.x + this.castDir.x * 2.2;
      const targetBoatZ = this.camWorldPos.z + this.castDir.z * 2.2;
      const dx = this.fishPos.x - targetBoatX;
      const dz = this.fishPos.z - targetBoatZ;
      const dist = Math.hypot(dx, dz) || 0.001;
      const dirToFishX = dx / dist;
      const dirToFishZ = dz / dist;
      const perpX = -dirToFishZ; // Direita relativo à linha de visão
      const perpZ = dirToFishX;

      const f = this.fish;
      const isRunning = f && f.ph === 2;
      let ld = 0;
      if (f) {
        // Armazena a posição anterior para calcular a velocidade do rastro
        const oldX = this.fishPos.x, oldZ = this.fishPos.z;

        // Eficácia do contra-ataque da vara contra a arrancada lateral do peixe
        let rodCounter = 0;
        if (f.fd === -1) {
          // Peixe puxa para a ESQUERDA -> mover vara para a DIREITA (mx > 0)
          rodCounter = Math.max(0, this.mx * 2.2);
        } else if (f.fd === 1) {
          // Peixe puxa para a DIREITA -> mover vara para a ESQUERDA (mx < 0)
          rodCounter = Math.max(0, -this.mx * 2.2);
        } else {
          rodCounter = 0.7;
        }

        // Contra-ataque é perfeito quando o jogador solta o carretel e inclina a vara na direção oposta
        this.counterControl = isRunning ? (this.hold ? 0 : Math.min(1.0, rodCounter)) : 0;

        if (f.ph === undefined) {
          f.ph = 0;
          f.tm = .9 + Math.random() * 1.1;
          f.sta = 1;
          f.fd = 0;
        }

        if (f.ph === 0) {
          f.tm -= dt;
          f.sta = Math.min(1, f.sta + dt * .025);
          if (f.tm <= 0) {
            if (f.sta > .12) {
              const r = Math.random();
              f.fd = r < .35 ? -1 : r < .7 ? 1 : 0;
              f.ph = 1;
              f.tm = .7;
            } else f.tm = 1;
          }
        } else if (f.ph === 1) {
          f.tm -= dt;
          if (f.tm <= 0) {
            f.ph = 2;
            f.tm = (1.6 + Math.random() * 1.6) * (.5 + .5 * f.sta) * (1 + .12 * f.t);
          }
        } else {
          f.tm -= dt;
          // Mover a vara para o lado oposto cansa o peixe muito mais rápido
          if (this.counterControl > .25) {
            f.sta = Math.max(0, f.sta - dt * (0.60 + 0.40 * this.counterControl) / (1 + .15 * f.t));
          } else {
            f.sta = Math.max(0, f.sta - dt * .12 / (1 + .15 * f.t));
          }
          if (f.tm <= 0 || f.sta <= .05) {
            f.ph = 0;
            f.tm = (.9 + Math.random() * 1.6) * (.5 + f.sta);
          }
        }

        ld = f.w / CAP[this.currentRodIdx];
        const sq = Math.sqrt(ld);

        if (isRunning) {
          // --- REGIME 1: PEIXE BRIGANDO (O PEIXE FAZ A FORÇA) ---
          let escX = dirToFishX;
          let escZ = dirToFishZ;
          if (f.fd === -1) {
            escX = -perpX * 0.88 + dirToFishX * 0.42;
            escZ = -perpZ * 0.88 + dirToFishZ * 0.42;
          } else if (f.fd === 1) {
            escX = perpX * 0.88 + dirToFishX * 0.42;
            escZ = perpZ * 0.88 + dirToFishZ * 0.42;
          }
          const el = Math.hypot(escX, escZ) || 1;
          escX /= el; escZ /= el;

          const fishSpeed = (3.2 + 2.0 * f.str) * (0.45 + 0.55 * f.sta);

          // Resistência hidrodinâmica e contra-ataque vetorial:
          // Em vez de congelar a posição do peixe ao contra-atacar, a linha retém o avanço radial
          // enquanto o arrasto da água deflete o peixe num arco dinâmico e vivo
          const counterEff = clamp(this.counterControl, 0, 1);
          const outwardFactor = Math.max(0.06, 1.0 - 0.92 * counterEff);
          const lateralFactor = Math.max(0.18, 1.0 - 0.60 * counterEff);

          const radialSpeed = (escX * dirToFishX + escZ * dirToFishZ) * fishSpeed * outwardFactor;
          const tangSpeed = (escX * perpX + escZ * perpZ) * fishSpeed * lateralFactor;

          const effVx = (dirToFishX * radialSpeed + perpX * tangSpeed);
          const effVz = (dirToFishZ * radialSpeed + perpZ * tangSpeed);

          this.fishPos.x += effVx * dt;
          this.fishPos.z += effVz * dt;

          // Salto ocasional de peixes pelágicos durante a luta
          const isPelagic = (f.k === 0 || f.k === 1 || f.k === 14); // Atum, Espada, Dourado
          if (isPelagic && f.sta > 0.3) {
            if (f.jumpVy === undefined) { f.jumpVy = 0; f.jumpY = 0; f.jumpT = rnd(2, 6); }
            f.jumpT -= dt;
            if (f.jumpT <= 0 && f.jumpY <= 0) {
              f.jumpVy = rnd(3.5, 5.0);
              f.jumpT = rnd(4, 10);
              spawnSplash(this.fishPos.x, this.fishPos.z, 12, 1.0);
              spawnRipple(this.fishPos.x, this.fishPos.z, 1.4);
              this.playSfx('splash', { k: 1.5 });
            }
          }

          if (f.jumpVy !== undefined && (f.jumpY > 0 || f.jumpVy > 0)) {
            f.jumpVy -= 9.8 * dt;
            f.jumpY += f.jumpVy * dt;
            if (f.jumpY <= 0) {
              f.jumpY = 0; f.jumpVy = 0;
              spawnSplash(this.fishPos.x, this.fishPos.z, 12, 0.8);
              spawnRipple(this.fishPos.x, this.fishPos.z, 1.2);
              this.playSfx('splash');
            }
          }

          // Orientação orgânica da cabeça na direção do vetor efetivo de nado
          const escYaw = Math.atan2(-effVz, effVx);
          this.fishYaw += wrapA(escYaw - this.fishYaw) * Math.min(1, dt * 8);

          // Modelo vetorial de tensão da linha:
          // Tração direta do peixe ponderada pelo peso e vigor
          const fishPullForce = (0.50 + 0.35 * f.str) * (0.40 + 0.60 * f.sta) * Math.min(1.6, 0.7 + 0.5 * sq);
          if (this.hold) {
            // O jogador puxa o carretel contra o peixe brigando (choque de vetores opostos)
            const targetTension = clamp(0.60 + 0.35 * fishPullForce + 0.15 * Math.max(0, ld - 1), 0.78, 1.0);
            this.tension += (targetTension - this.tension) * Math.min(1, dt * 2.8);

            // Ruptura por impacto instantâneo (Shock Snap):
            // Peixe significativamente acima da capacidade da vara arrancando com carretel travado
            if (ld > 1.25 && f.sta > 0.45 && this.tension > 0.94) {
              this.snap += dt * 3.5;
            }
          } else {
            // Soltar o carretel e contra-atacar alivia a tensão e absorve a arrancada
            const targetTension = this.counterControl > 0.3
              ? clamp(0.35 + 0.12 * sq, 0.25, 0.52)
              : clamp(0.48 + 0.14 * sq, 0.35, 0.65);
            this.tension += (targetTension - this.tension) * Math.min(1, dt * 3.5);
          }
        } else {
          // --- REGIME 2: PEIXE NÃO BRIGA (O PESCADOR FAZ A FORÇA) ---
          if (this.hold && this.tension < 0.85) {
            // O peixe cansado cede e se aproxima
            const pullSpeed = (3.8 / (1 + 0.35 * Math.min(1.5, sq))) * (0.3 + 0.7 * (1 - f.sta));
            this.fishPos.x -= dirToFishX * pullSpeed * dt;
            this.fishPos.z -= dirToFishZ * pullSpeed * dt;

            // Cabeça do peixe aponta para o pescador que o está puxando (+X local aponta para o barco)
            const pullYaw = Math.atan2(dirToFishZ, -dirToFishX);
            this.fishYaw += wrapA(pullYaw - this.fishYaw) * Math.min(1, dt * 6);

            const targetTension = clamp(0.30 + 0.18 * Math.min(1.5, sq), 0.25, 0.55);
            this.tension += (targetTension - this.tension) * Math.min(1, dt * 4.0);
          } else {
            // Linha frouxa, peixe flutua e nada de forma orgânica
            this.tension += (0.02 - this.tension) * Math.min(1, dt * 3.5);
            
            // Movimento de repouso: peixe nada lentamente em círculos suaves ou desvia
            const idleSpeed = 0.5 + 0.5 * (f ? f.sta : 0.5);
            const driftAngle = Math.sin(this.animProg * 0.4 + (f ? f.s : 0)) * 0.6;
            const vx = Math.cos(this.fishYaw + driftAngle) * idleSpeed;
            const vz = -Math.sin(this.fishYaw + driftAngle) * idleSpeed;
            
            this.fishPos.x += vx * dt;
            this.fishPos.z += vz * dt;
            
            const idleYaw = Math.atan2(-vz, vx);
            this.fishYaw += wrapA(idleYaw - this.fishYaw) * Math.min(1, dt * 2.5);
          }
        }

        // Dispara rastro de espuma (V-wake) se o peixe estiver se movendo e submerso
        const vx = (this.fishPos.x - oldX) / dt;
        const vz = (this.fishPos.z - oldZ) / dt;
        const speed = Math.hypot(vx, vz);
        if (speed > 1.2 && (!f.jumpY || f.jumpY <= 0)) {
          spawnLineWake(this.bp.x, this.bp.z, vx, vz);
        }
      } else {
        this.counterControl = 0;
        if (this.hold) {
          this.fishPos.x -= dirToFishX * 6.5 * dt;
          this.fishPos.z -= dirToFishZ * 6.5 * dt;
          this.tension += (0.18 - this.tension) * Math.min(1, dt * 5);
        } else {
          this.tension += (0.02 - this.tension) * Math.min(1, dt * 4);
          
          // Isca flutuando suavemente
          this.fishPos.x += Math.sin(this.animProg * 0.2) * 0.15 * dt;
          this.fishPos.z += Math.cos(this.animProg * 0.2) * 0.15 * dt;
        }
      }

      const currentDist = Math.hypot(this.fishPos.x - targetBoatX, this.fishPos.z - targetBoatZ);
      this.progress = clamp(1 - (currentDist - 2.2) / Math.max(1, this.castDist - 2.2), 0, 1);

      // Sobrecarga de peso (ld = f.w / CAP[rod]) e quebra de linha progressiva e justa
      const overload = Math.max(0, ld - 1);
      const snapThreshold = Math.max(0.70, 0.85 - 0.08 * overload);
      if (this.tension > snapThreshold && this.hold) {
        // A linha só arrebenta se o player insistir em ficar puxando na zona vermelha de tensão
        this.snap += dt * (0.45 + overload * 0.8);
      } else {
        // Soltar o carretel ou contra-atacar recupera a linha rapidamente
        this.snap = Math.max(0, this.snap - dt * 2.5);
      }

      if (this.hold && this.crank && S.r) {
        const d = dt * 14;
        // Inverte o sentido: agora soma (+=) ao recolher, enquanto o lançamento subtrai (-=)
        this.crank.rotation.x += d;
        if (this.spool !== this.crank) this.spool.rotation.x += d;

        // Som de carretel dinâmico
        const ld = this.fish ? this.fish.w / CAP[this.currentRodIdx] : 0;
        const cps = Math.min(90, 8 + (1 + ld) * 8);
        Audio.reelSpeed(cps);
      } else {
        Audio.reelSpeed(0);
      }

      const maxReach = S.r ? 48 : (this.castDist + 3.8);
      if (this.snap > 1.1) {
        this.lose();
      } else if (currentDist <= 2.3) {
        // O peixe só pode ser içado para fora se não houver peixe OU se a estamina tiver sido esgotada no combate!
        if (!f || f.sta <= 0.22) {
          this.finish();
        } else {
          // Se o peixe ainda tem energia ao se aproximar do barco, faz arrancada desesperada de fuga!
          f.ph = 2;
          f.tm = 1.4 + Math.random() * 1.2;
          f.fd = Math.random() < 0.5 ? -1 : 1;
        }
      } else if (currentDist > maxReach) {
        this.escape();
      }
    } else if (this.state === 'catch') {
      this.showTime += dt;
      if (this.pressed && this.showTime > .4) {
        this.collectFish();
      } else if (this.showTime > 12) {
        this.detach();
        this.fish = null;
        this.state = 'idle';
      }
    }

    // CÁLCULO DA POSIÇÃO DA BOIA NA ÁGUA (INTEGRADO AO MAR DO JOGO H(x, z))
    cam.updateMatrixWorld(true);
    const wy = (x, z) => H(ST.px + x, ST.pz + z) + .03;

    if (this.state === 'cast') {
      const u = Math.min(1, this.castTimer / this.castDuration);
      this.bp.lerpVectors(this.from, this.to, u);
      this.bp.y += 4 * u * (1 - u) * (2 + this.castDist * .2);
    } else if (this.state === 'wait' || this.state === 'bite') {
      this.bp.set(this.to.x, wy(this.to.x, this.to.z), this.to.z);
      if (this.state === 'bite') this.bp.y -= .22; // Afunda mais a boia para clareza visual
    } else if (this.state === 'reel') {
      const fishY = (this.fish && this.fish.jumpY) ? this.fish.jumpY : 0;
      this.bp.set(this.fishPos.x, wy(this.fishPos.x, this.fishPos.z) + fishY, this.fishPos.z);
    } else if (this.state === 'catch') {
      cam.getWorldPosition(this.camWorldPos);
      cam.getWorldDirection(this.castDir);
      
      // Apresentação frontal erguida e centralizada na câmera FPV
      const weightDrop = 0.12 * Math.min(2.0, Math.sqrt(ld));
      // Usa this.V como buffer temporário para o destino para não poluir this.to
      this.V.set(
        this.camWorldPos.x + this.castDir.x * 1.35 - this.castDir.z * 0.05,
        this.camWorldPos.y + this.castDir.y * 1.35 + 0.10 - weightDrop,
        this.camWorldPos.z + this.castDir.z * 1.35 + this.castDir.x * 0.05
      );

      // Trajetória parabólica de içamento (duração de 1.0s para ser mais perceptível)
      const liftDur = 1.0;
      const u = Math.min(1, this.showTime / liftDur);
      const ease = u * (2 - u); // easeOutQuad
      
      this.bp.lerpVectors(this.catchFrom || this.bp, this.V, ease);
      
      // Arco parabólico: o peixe sobe em curva acentuada antes de chegar na mão
      const arcHeight = 1.8 * Math.sin(u * Math.PI);
      this.bp.y += arcHeight;
    } else {
      this.tip.getWorldPosition(this.V);
      this.bp.set(this.V.x, this.V.y - .55, this.V.z);
    }

    this.bob.position.copy(this.bp);
    this.bob.rotation.z = 0;

    // DINÂMICA VISUAL E FÍSICA DA VARA
    // A linha esticada puxa a vara para a direção exata onde o peixe está no espaço da câmera
    this.localFishPos.copy(this.bp);
    cam.worldToLocal(this.localFishPos);

    if (this.state === 'reel') {
      const fishRelAngle = Math.atan2(this.localFishPos.x, -this.localFishPos.z);
      const pullRatio = Math.max(0.35, Math.min(1, this.tension * 1.2));
      const targetLateral = clamp(fishRelAngle * pullRatio, -0.65, 0.65);
      this.lateral += (targetLateral - this.lateral) * Math.min(1, dt * 7);
    } else {
      this.lateral += (0 - this.lateral) * Math.min(1, dt * 4);
    }
    this.shake = 0;

    const kb = 1.15 - .08 * this.currentRodIdx;
    let tb = 0, ta = S.r ? .62 : .52;

    if (this.state === 'charge') {
      tb = -this.power * .55;
      ta = (S.r ? .62 : .52) + this.power * .55;
    } else if (this.state === 'reel') {
      tb = .15 + this.tension * .85 * kb * (.6 + .7 * Math.min(1.5, Math.sqrt(ld)));
      ta = S.r ? .78 : .70;
    } else if (this.state === 'bite') {
      tb = .10;
    } else if (this.state === 'cast' && this.castTimer < .3) {
      ta = S.r ? .28 : .24;
    } else if (this.state === 'catch') {
      const ldCatch = Math.min(2.0, Math.sqrt(ld));
      tb = 0.12 + 0.50 * kb * ldCatch;
      ta = (S.r ? 1.18 : 1.08) - 0.08 * ldCatch;
    }

    this.flick = Math.max(0, this.flick - dt * 2.2);
    tb += this.flick * .9;

    // Flexão da vara com sistema Mola-Amortecedor (Spring-Damper) para rebote elástico
    // Parâmetros baseados no material/nível da vara
    const stiffness = 14 + this.currentRodIdx * 10;
    const damping = 1.8 + this.currentRodIdx * 0.6;
    
    const acceleration = stiffness * (tb - this.bend) - damping * this.bendVelocity;
    this.bendVelocity += acceleration * dt;
    this.bend += this.bendVelocity * dt;

    this.rodAngle += (ta - this.rodAngle) * Math.min(1, dt * (this.state === 'cast' ? 16 : 7));

    this.segs.forEach(j => {
      j.rotation.x = -(this.bend * 1.17 + .15) * j.userData.w;
      if (j.userData.z0 === undefined) j.userData.z0 = j.rotation.z;
      // Inversão correta para flexionar a haste na direção em que o peixe puxa
      j.rotation.z = j.userData.z0 - this.lateral * (.35 + this.tension) * .8 * j.userData.w;
    });

    if (this.rod) {
      this.rod.rotation.set(
        this.rodAngle - PI / 2,
        Math.max(-.6, Math.min(.6, .1 + (this.lag - this.yaw) * .9 - this.lateral * (.1 + .25 * this.tension))),
        0
      );
      this.rod.position.y = S.r ? -.14 : -.22;
    }

    // Suavização do mouse / botões de combate para não travar nas bordas
    if (this.btnLeftHold) {
      this.mx += (-1.0 - this.mx) * Math.min(1, dt * 10.0);
    } else if (this.btnRightHold) {
      this.mx += (1.0 - this.mx) * Math.min(1, dt * 10.0);
    } else {
      this.mx += (0 - this.mx) * Math.min(1, dt * 1.8);
    }
    this.my += (0 - this.my) * Math.min(1, dt * 1.8);

    this.E.set(this.bp.x, this.bp.y + .07, this.bp.z);
    this.setLine(
      this.state === 'reel' ? (1 - this.tension) * .8 :
      this.state === 'catch' ? Math.max(0.01, 0.04 / (1 + 2.5 * ld)) :
      (this.state === 'wait' || this.state === 'bite') ? .5 : .1
    );

    // PEIXE ARTICULADO PENDURADO NO ANZOL
    if (this.showObj) {
      this.animProg += dt;
      const o = this.showObj.userData.o;
      const k = Math.min(1, this.animProg * 4);
      const sc = this.showObj.userData.s * k * (2 - k);

      // Posição vertical: na água o peixe fica submerso abaixo da boia, fora d'água pendurado pelo anzol
      const isCatch = this.state === 'catch';
      const inWater = this.state === 'bite' || this.state === 'reel';
      const weightHangOffset = 0.12 * Math.min(2.0, Math.sqrt(ld));
      
      // Profundidade do anzol: -0.65 na água para não parecer colado na boia, -0.32 no ar
      this.hang.position.y = inWater ? -0.65 : (-0.32 - weightHangOffset);

      this.hangVert += ((isCatch ? 1 : 0) - this.hangVert) * Math.min(1, dt * 5);
      this.showObj.scale.setScalar(sc);
      
      // Ajuste para prender pela boca: o nariz do modelo está em L/2
      this.showObj.position.x = -o.S.L * sc * 0.48;
      this.showObj.visible = true;
      this.hk.rotation.z = this.hangVert * PI / 2;

      // Postura viva e debate dinâmico do peixe no anzol
      const isRunning = this.fish && this.fish.ph === 2;
      const thrashRoll = (inWater && isRunning) ? Math.sin(this.animProg * 14) * 0.15 * (this.fish ? this.fish.sta : 1) : 0;
      
      this.hang.rotation.set(
        0,
        this.fishYaw * (1 - this.hangVert) + this.hangVert * 0.4,
        thrashRoll * (1 - this.hangVert)
      );

      if (inWater) {
        // Na água (briga/fisgada): o peixe nada e se debate ativamente
        if (isRunning) {
          // Arrancada violenta: batimentos vigorosos de cauda e cabeça
          const fightSpeed = (1.4 + 0.6 * (this.fish ? this.fish.str : 1)) * (0.6 + 0.4 * (this.fish ? this.fish.sta : 1));
          const fightAmp = 1.3 * (0.5 + 0.5 * (this.fish ? this.fish.sta : 1));
          const fightTurn = this.fish && this.fish.fd ? this.fish.fd * 0.8 : 0;
          swim(o, this.animProg * 3.6, fightSpeed, fightAmp, fightTurn);
        } else {
          // Descanso / sendo recolhido: ondulações mais calmas e orgânicas
          const tiredSpeed = 0.9 * (0.4 + 0.6 * (this.fish ? this.fish.sta : 0.5));
          const tiredAmp = 0.6 * (0.4 + 0.6 * (this.fish ? this.fish.sta : 0.5));
          swim(o, this.animProg * 2.2, tiredSpeed, tiredAmp, Math.sin(this.animProg * 0.5) * 0.2);
        }
      } else if (isCatch) {
        // Fora d'água (capturado): peixe pendurado no anzol com surtos de debate
        // O peixe se debate mais forte em intervalos (bursts)
        const burst = Math.pow(Math.max(0, Math.sin(this.showTime * 2.0)), 3.0);
        const twitchFreq = 7.0 + burst * 15.0;
        const twitchAmp = 0.08 + burst * 0.45;
        const decay = Math.max(0, 1.0 - this.showTime * 0.08);
        
        const twitch = Math.sin(this.showTime * twitchFreq) * twitchAmp * decay;
        
        if (o.pv) {
          o.pv.forEach((p, i) => {
            const segRatio = i / (o.pv.length || 1);
            p.rotation.y = twitch * segRatio;
          });
        }
        if (o.tl) o.tl.rotation.y = twitch * 1.8;
        if (o.rip) {
          o.rip.forEach(([m]) => { m.rotation.x = Math.abs(twitch) * 0.3; });
        }
        if (o.pf) {
          o.pf.forEach(([h, s]) => {
            h.rotation.x = s * (PI / 2 + 0.25 + Math.abs(twitch) * 0.5);
          });
        }
        if (o.jv) o.jv.rotation.z = -0.08 + twitch * 0.3;
      } else {
        if (o.pv) o.pv.forEach(p => { p.rotation.y = 0; });
        if (o.tl) o.tl.rotation.y = 0;
        if (o.rip) o.rip.forEach(([m]) => { m.rotation.x = 0; });
        if (o.pf) o.pf.forEach(([h, s]) => { h.rotation.x = s * (PI / 2 + 0.25); });
        if (o.jv) o.jv.rotation.z = -0.1;
      }
    }

    // ATUALIZAÇÃO DO HUD / INTERFACE
    this.statusTimer -= dt;
    this.updateHUD();

    this.pressed = 0;
  }

  updateHUD() {
    const q = this.fish;
    const ld = q ? q.w / CAP[this.currentRodIdx] : 0;
    const fh = () => {
      if (!q || !q.ph) return q && q.sta < .15 ? 'O peixe está cansado! Recolha!' : ld > 1.2 ? 'A vara está no limite! Recolha com cuidado' : 'Segure para recolher, solte quando a barra ficar vermelha';
      const d = q.fd ? q.fd < 0 ? '◀ para a ESQUERDA' : '▶ para a DIREITA' : '▼ para TRÁS';
      return q.ph === 1 ? '⚠ O peixe vai puxar ' + d + '!' : q.fd ? 'O peixe puxa ' + d + '! Solte e mova a vara para o lado oposto' + (this.counterControl > .5 ? ' ✔' : '') : 'O peixe puxa para trás! Solte o carretel' + (this.counterControl > .5 ? ' ✔' : '');
    };

    const HINTS = {
      idle: 'Segure o clique ou Espaço para carregar, solte para lançar',
      charge: 'Solte para lançar',
      cast: '',
      wait: 'Esperando a fisgada… segure para recolher',
      bite: 'Fisgou! Segure para puxar imediatamente',
      reel: q ? fh() : 'Recolhendo…',
      catch: q ? `${q.nw ? '✨ Nova espécie! ' : ''}${q.n} (${q.l}) · ${fmtWeight(q.w)} · Clique para guardar na mochila` : ''
    };

    // 1. Barra de Direção do Peixe (Centralizada, bi-direcional, inicia vazia)
    if (this.ui.pwb) {
      const isReelFight = this.equipped && this.state === 'reel' && this.fish;
      const isRunning = isReelFight && this.fish.ph === 2;

      if (isReelFight) {
        this.ui.pwb.style.opacity = '1';
        if (this.ui.pwf) {
          const fd = isRunning ? (this.fish.fd || 0) : 0; // < 0 puxa para esquerda, > 0 puxa para direita
          if (isRunning && fd !== 0) {
            const pullIntensity = Math.min(1, Math.abs(fd) * 0.9 + 0.1);
            const halfWidth = pullIntensity * 50; // max 50% para o lado que estiver puxando
            if (fd < 0) {
              // Fuga para a esquerda: preenche a partir do centro (50%) para a esquerda
              this.ui.pwf.style.left = `${50 - halfWidth}%`;
              this.ui.pwf.style.width = `${halfWidth}%`;
            } else {
              // Fuga para a direita: preenche a partir do centro (50%) para a direita
              this.ui.pwf.style.left = '50%';
              this.ui.pwf.style.width = `${halfWidth}%`;
            }
          } else {
            // Inicia e permanece 100% vazia quando neutro ou sem arrancada ativa
            this.ui.pwf.style.left = '50%';
            this.ui.pwf.style.width = '0%';
          }
        }
      } else {
        this.ui.pwb.style.opacity = '0';
        if (this.ui.pwf) {
          this.ui.pwf.style.left = '50%';
          this.ui.pwf.style.width = '0%';
        }
      }
    }

    // 2. Barra de Tensão da Linha
    if (this.ui.tnb) {
      this.ui.tnb.style.opacity = (this.equipped && this.state === 'reel' && this.fish) ? '1' : '0';
      if (this.ui.tnf) {
        this.ui.tnf.style.width = (this.tension * 100) + '%';
        this.ui.tnf.style.background = this.tension > .8 ? '#e5534b' : '#FFD400';
      }
    }

    // 3. Atualização dos Estados do Botão de Ação Dedicado
    if (this.ui.btnAction && this.ui.btnLabel && this.ui.btnIcon) {
      if (this.state === 'charge') {
        this.ui.btnIcon.textContent = '⚡';
        this.ui.btnLabel.textContent = 'FORÇA';
      } else if (this.state === 'wait') {
        this.ui.btnIcon.textContent = '🌊';
        this.ui.btnLabel.textContent = 'AGUARDE';
      } else if (this.state === 'bite') {
        this.ui.btnIcon.textContent = '❗';
        this.ui.btnLabel.textContent = 'FISGAR!';
      } else if (this.state === 'reel') {
        this.ui.btnIcon.textContent = '🔄';
        this.ui.btnLabel.textContent = 'RECOLHER';
      } else if (this.state === 'catch') {
        this.ui.btnIcon.textContent = '⭐';
        this.ui.btnLabel.textContent = 'COLETAR';
      } else {
        this.ui.btnIcon.textContent = '🎣';
        this.ui.btnLabel.textContent = 'LANÇAR';
      }
    }

    // 4. Botões de Combate Lateral no Mobile (Resistir / Contra-Ataque Direcional)
    const isTouchDev = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;
    const isReelFight = this.equipped && this.state === 'reel' && this.fish;
    const isRunning = isReelFight && this.fish.ph === 2;
    const fd = isRunning ? (this.fish.fd || 0) : 0;

    if (this.ui.btnLeft) {
      // Se peixe puxa para a DIREITA (fd === 1), mostra botão ESQUERDO
      const showLeft = isTouchDev && isRunning && fd === 1;
      this.ui.btnLeft.classList.toggle('visible', showLeft);
      this.ui.btnLeft.classList.toggle('pulse', showLeft && !this.btnLeftHold);
    }

    if (this.ui.btnRight) {
      // Se peixe puxa para a ESQUERDA (fd === -1), mostra botão DIREITO
      const showRight = isTouchDev && isRunning && fd === -1;
      this.ui.btnRight.classList.toggle('visible', showRight);
      this.ui.btnRight.classList.toggle('pulse', showRight && !this.btnRightHold);
    }
  }
}

export const fishingSystem = new FishingSystem();
if (typeof window !== 'undefined') {
  window.fishingSystem = fishingSystem;
}
