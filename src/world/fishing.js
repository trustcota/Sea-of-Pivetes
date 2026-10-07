import * as THREE from 'three';
import { cam, sc, cv } from '../core/renderer.js';
import { ST, CAM, GAME } from '../core/state.js';
import { H } from './ocean.js';
import { SPC, buildFish, swim, createArticulatedFishMesh } from './fish.js';

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

    // Peixe atual no anzol
    this.fish = null;
    this.showObj = null;
    this.showTime = 0;
    this.castTimer = 0;
    this.castDuration = 1;
    this.castDist = 10;
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
      btnToggle: null
    };

    // Áudio Web Audio procedural sintetizado
    this.audioCtx = null;
  }

  init() {
    this.bindUI();
    this.setupInputs();
  }

  playSfx(type) {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        if (this.audioCtx) this.audioCtx.resume().catch(() => {});
        return;
      }
      const t = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'cast') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      } else if (type === 'splash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.linearRampToValueAtTime(60, t + 0.35);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      } else if (type === 'bite') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(580, t + 0.15);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
      } else if (type === 'catch') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.setValueAtTime(523, t + 0.1);
        osc.frequency.setValueAtTime(659, t + 0.2);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      } else if (type === 'snap') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.linearRampToValueAtTime(180, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
      }
    } catch (_) {}
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
    this.rod.position.set(.3, -.14, -.68);
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

      if (R > 1) {
        this.crank = new T.Group();
        this.crank.position.x = .057;
        rg.add(this.crank);
        mesh(new T.BoxGeometry(.006, .065, .008), matIron, 0, .03, 0, this.crank);
        mesh(new T.CylinderGeometry(.011, .011, .03, 5), R === 5 ? matBone : W[2 % W.length], .014, .064, 0, this.crank).rotation.z = PI / 2;
      } else {
        this.crank = this.spool;
      }
    } else if (S.q) {
      this.spool = new T.Object3D();
      this.spool.position.set(0, -.1, -b0 * 1.25);
      this.rod.add(this.spool);
      mesh(new T.SphereGeometry(.008, 4, 3), matHemp, 0, 0, 0, this.spool);
    }

    const gi = [];
    for (let q = 1; q <= S.q; q++) gi.push(Math.floor(q * N / (S.q + 1)));

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
    mesh(new T.SphereGeometry(S.q ? .006 : .009, 4, 3), matHemp, 0, SL, 0, par);
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

    for (let i = 1; i <= this.NL; i++) {
      const u = i / this.NL;
      this.V.lerpVectors(this.T, this.E, u);
      this.V.y -= sag * 4 * u * (1 - u);
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
    let r = Math.random() * FS.reduce((a, x) => a + x[1], 0);
    let e = FS[0];
    for (const x of FS) {
      if ((r -= x[1]) < 0) {
        e = x;
        break;
      }
    }
    const u = Math.pow(Math.random(), 1.6);
    const S = SPC[e[0]];
    return {
      k: e[0],
      t: TIER[e[1]] || 0,
      str: e[4],
      n: S.nm,
      l: S.lt,
      w: e[2] + (e[3] - e[2]) * u,
      u,
      s: Math.random() * 20
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
    this.playSfx('cast');
    this.state = 'cast';
    this.castTimer = 0;
    this.progress = 0;
    this.tension = 0;
    this.snap = 0;
    this.castDist = 7 + this.power * 26;
    this.castDuration = .55 + this.castDist * .02;
    this.flick = 1.2;

    cam.getWorldPosition(this.camWorldPos);
    cam.getWorldDirection(this.castDir);
    this.castDir.y = 0;
    this.castDir.normalize();

    this.dx = this.castDir.x;
    this.dz = this.castDir.z;

    this.tip.getWorldPosition(this.from);
    this.to.set(this.camWorldPos.x + this.dx * this.castDist, 0, this.camWorldPos.z + this.dz * this.castDist);
  }

  startReel(f) {
    this.fish = f;
    this.state = 'reel';
    this.progress = 0;
    this.tension = 0;
    this.snap = 0;
    this.heat = 0;
    this.lineOffset = 0;
    if (f) {
      if (!this.showObj) this.attach(f);
      this.say('BRIGUE COM O PEIXE!', 1.5);
    } else {
      this.timer = 2 + Math.random() * 4;
    }
  }

  escape() {
    this.fish = null;
    this.detach();
    this.state = 'idle';
    this.tension = 0;
    this.flick = 1.2;
    this.say('O peixe escapou!', 2.4);
  }

  lose() {
    this.playSfx('snap');
    this.detach();
    this.state = 'idle';
    this.fish = null;
    this.tension = 0;
    this.flick = 1.5;
    this.say('A linha arrebentou! Lance novamente.', 2.4);
  }

  finish() {
    this.tension = 0;
    if (!this.fish) {
      this.state = 'idle';
      this.say('Linha recolhida. Lance de novo.', 1.8);
      return;
    }
    this.playSfx('catch');
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
    if (this.rod) this.rod.visible = false;
    this.detach();
    this.fish = null;
    this.state = 'idle';
    this.tension = 0;
    this.power = 0;
    this.bend = 0;
    this.bendVelocity = 0;
    this.statusTimer = 0;
    this.line.visible = false;
    this.bob.visible = false;

    if (this.ui.hud) this.ui.hud.style.display = 'none';
  }

  toggleFishing() {
    if (this.equipped) {
      this.unequip();
    } else {
      this.equipRod(this.currentRodIdx);
    }
  }

  bindUI() {
    this.ui.hud = document.getElementById('fishing-hud');
    this.ui.hint = document.getElementById('fishing-hint');
    this.ui.arw = document.getElementById('fishing-arw');
    this.ui.pwb = document.getElementById('fishing-pwb');
    this.ui.pwf = document.getElementById('fishing-pwf');
    this.ui.tnb = document.getElementById('fishing-tnb');
    this.ui.tnf = document.getElementById('fishing-tnf');
    this.ui.sbb = document.getElementById('fishing-sbb');
    this.ui.sbf = document.getElementById('fishing-sbf');
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

    window.addEventListener('pointerdown', e => {
      if (!this.equipped || GAME.state !== 'PLAY' || !CAM.fpv) return;
      if (e.target.closest('#fishing-sel') || e.target.closest('#settings-modal') || e.target.closest('#controls-modal') || e.target.closest('#radial-orders-overlay') || e.target.closest('.modal-overlay')) return;
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
      if (this.castTimer >= this.castDuration) {
        this.playSfx('splash');
        this.state = 'wait';
        this.timer = 2.5 + Math.random() * 4;
      }
    } else if (this.state === 'wait') {
      this.timer -= dt;
      if (this.pressed) {
        this.startReel(null);
      } else if (this.timer <= 0) {
        this.fish = this.pickFish();
        this.attach(this.fish);
        this.playSfx('bite');
        this.state = 'bite';
        this.timer = 1.8;
      }
    } else if (this.state === 'bite') {
      this.timer -= dt;
      if (this.hold) {
        this.startReel(this.fish);
      } else if (this.timer <= 0) {
        this.fish = null;
        this.detach();
        this.state = 'idle';
        this.say('O peixe escapou do anzol…', 2);
      }
    } else if (this.state === 'reel') {
      const f = this.fish;
      if (f) {
        const isRunning = f.ph === 2;
        this.counterControl = isRunning ? (this.hold ? 0 : f.fd ? Math.min(1, Math.max(0, -f.fd * this.mx * 3)) : 1) : 0;

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
          if (this.counterControl > .5) {
            f.sta = Math.max(0, f.sta - dt * .17 / (1 + .3 * f.t + .4 * Math.min(1.5, Math.sqrt(f.w / CAP[this.currentRodIdx]))));
          }
          if (f.tm <= 0 || f.sta <= .05) {
            f.ph = 0;
            f.tm = (.9 + Math.random() * 1.6) * (.5 + f.sta);
          }
        }

        const ld0 = f.w / CAP[this.currentRodIdx];
        const sq = Math.sqrt(ld0);
        const g = .25 + .6 * Math.min(1.6, Math.pow(ld0, .5));
        const F0 = (isRunning ? (.75 + .08 * f.t) * (.45 + .55 * f.sta) : .25) * g * f.str;
        const F = isRunning ? F0 : Math.min(F0, .3);

        this.heat = Math.max(0, Math.min(3, this.heat + (this.hold ? dt : -dt * 2)));
        this.tension += (Math.min(1, .1 + (this.hold ? .28 + .4 * Math.min(1, this.heat / 2.2) : 0) + F * (this.hold ? 1 : .75) * (1 - .9 * this.counterControl)) - this.tension) * Math.min(1, dt * 6);

        if (isRunning && this.counterControl < .5) {
          this.progress -= dt * F * .12;
        } else if (this.hold && this.tension < .85) {
          this.progress += dt * .26 / (1 + .25 * f.t) / (1 + 1.2 * Math.min(1.5, sq)) * (1.05 - this.tension) * (.6 + 1.2 * (1 - f.sta));
        } else if (!this.hold && !isRunning) {
          this.progress -= dt * .03 * (1 + .3 * f.t) * f.sta;
        }

        if (isRunning && f.fd && this.counterControl < .5) {
          this.lineOffset -= f.fd * 2.6 * (.7 + .5 * Math.min(1, sq)) * dt;
        } else {
          this.lineOffset -= Math.sign(this.lineOffset) * Math.min(Math.abs(this.lineOffset), (isRunning ? 1.8 : .7) * dt);
        }
        this.lineOffset = Math.max(-7, Math.min(7, this.lineOffset));

        if (this.progress < -.25 + .1 * Math.min(1, sq)) this.escape();
      } else {
        this.counterControl = 0;
        this.tension += ((this.hold ? .3125 : .015) - this.tension) * Math.min(1, dt * 6);
        if (this.hold && this.tension < .85) this.progress += dt * .45 * (1.1 - this.tension);
        this.timer -= dt;
        if (this.timer <= 0 && this.progress < .8) {
          this.fish = this.pickFish();
          this.attach(this.fish);
          this.playSfx('bite');
          this.say('Fisgou!', 1.2);
        }
      }

      this.snap = this.tension > .85 - .05 * Math.min(1, Math.max(0, ld - 1)) ? this.snap + dt : Math.max(0, this.snap - dt);
      if (this.hold && this.crank) {
        const d = dt * 14;
        this.crank.rotation.x -= d;
        if (this.spool !== this.crank) this.spool.rotation.x -= d;
      }

      if (this.snap > .5) this.lose();
      else if (this.progress >= 1) this.finish();
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

    // DINÂMICA VISUAL E FÍSICA DA VARA
    const rf = this.state === 'reel' && this.fish && this.fish.ph === 2;
    this.fishYaw += ((rf ? (this.fish.fd ? this.fish.fd * 1.4 : 3.1) : 0) - this.fishYaw) * Math.min(1, dt * 4);
    this.lateral += ((rf ? -this.fish.fd : 0) - this.lateral) * Math.min(1, dt * 3);
    this.shake = 0;

    const kb = 1.15 - .08 * this.currentRodIdx;
    let tb = 0, ta = .62;

    if (this.state === 'charge') {
      tb = -this.power * .55;
      ta = .62 + this.power * .55;
    } else if (this.state === 'reel') {
      tb = .15 + this.tension * .85 * kb * (.6 + .7 * Math.min(1.5, Math.sqrt(ld)));
      ta = .78;
    } else if (this.state === 'bite') {
      tb = .10;
    } else if (this.state === 'cast' && this.castTimer < .3) {
      ta = .28;
    } else if (this.state === 'catch') {
      tb = .08 + .6 * kb * Math.min(1.3, Math.sqrt(ld));
    }

    this.flick = Math.max(0, this.flick - dt * 2.2);
    tb += this.flick * .9;

    // Flexão da vara com amortecimento suave e estável (zero trepidação)
    const bendSpeed = Math.min(14, 8 + 1.5 * this.currentRodIdx);
    this.bend += (tb - this.bend) * Math.min(1, dt * bendSpeed);
    this.rodAngle += (ta - this.rodAngle) * Math.min(1, dt * (this.state === 'cast' ? 16 : 7));

    this.segs.forEach(j => {
      j.rotation.x = -(this.bend * 1.17 + .15) * j.userData.w;
      if (j.userData.z0 === undefined) j.userData.z0 = j.rotation.z;
      j.rotation.z = j.userData.z0 + this.lateral * (.35 + this.tension) * .8 * j.userData.w;
    });

    if (this.rod) {
      this.rod.rotation.set(
        this.rodAngle - PI / 2,
        Math.max(-.6, Math.min(.6, .1 + (this.lag - this.yaw) * .9 + this.lateral * (.1 + .25 * this.tension))),
        0
      );
      this.rod.position.y = -.14;
    }

    // Suavização do mouse de combate para não travar nas bordas
    this.mx += (0 - this.mx) * Math.min(1, dt * 1.8);
    this.my += (0 - this.my) * Math.min(1, dt * 1.8);

    // CÁLCULO DA POSIÇÃO DA BOIA NA ÁGUA (INTEGRADO AO MAR DO JOGO H(x, z))
    cam.updateMatrixWorld(true);
    const wy = (x, z) => H(ST.px + x, ST.pz + z) + .03;

    if (this.state === 'cast') {
      const u = Math.min(1, this.castTimer / this.castDuration);
      this.bp.lerpVectors(this.from, this.to, u);
      this.bp.y += 4 * u * (1 - u) * (2 + this.castDist * .2);
    } else if (this.state === 'wait' || this.state === 'bite') {
      this.bp.set(this.to.x, wy(this.to.x, this.to.z), this.to.z);
      if (this.state === 'bite') this.bp.y -= .08;
    } else if (this.state === 'reel') {
      cam.getWorldPosition(this.camWorldPos);
      cam.getWorldDirection(this.castDir);
      this.castDir.y = 0;
      this.castDir.normalize();

      const nx = this.camWorldPos.x + this.castDir.x * 2.5;
      const nz = this.camWorldPos.z + this.castDir.z * 2.5;
      const am = this.lineOffset;
      const ox = this.castDir.z * am;
      const oz = -this.castDir.x * am;

      this.bp.set(this.to.x + (nx - this.to.x) * this.progress + ox, 0, this.to.z + (nz - this.to.z) * this.progress + oz);
      this.bp.y = wy(this.bp.x, this.bp.z);
    } else if (this.state === 'catch') {
      cam.getWorldPosition(this.camWorldPos);
      cam.getWorldDirection(this.castDir);
      // Apresentação frontal destacada na câmera FPV (altura dos olhos, ~1.45m à frente)
      this.bp.set(
        this.camWorldPos.x + this.castDir.x * 1.45 + this.castDir.z * 0.22,
        this.camWorldPos.y + this.castDir.y * 1.45 - 0.05,
        this.camWorldPos.z + this.castDir.z * 1.45 - this.castDir.x * 0.22
      );
    } else {
      this.tip.getWorldPosition(this.V);
      this.bp.set(this.V.x, this.V.y - .55, this.V.z);
    }

    this.bob.position.copy(this.bp);
    this.bob.rotation.z = 0;

    this.E.set(this.bp.x, this.bp.y + .07, this.bp.z);
    this.setLine(this.state === 'reel' ? (1 - this.tension) * .8 : (this.state === 'wait' || this.state === 'bite') ? .5 : .1);

    // PEIXE ARTICULADO PENDURADO NO ANZOL
    if (this.showObj) {
      this.animProg += dt;
      const o = this.showObj.userData.o;
      const k = Math.min(1, this.animProg * 4);
      const sc = this.showObj.userData.s * k * (2 - k);
      const isCatch = this.state === 'catch';
      const inWater = this.state === 'bite' || this.state === 'reel';
      const isRunning = this.fish && this.fish.ph === 2;

      // Posição vertical estável: na água fica na linha da superfície, fora d'água fica pendurado pelo anzol
      this.hang.position.y = isCatch ? -0.28 : 0.05;

      this.hangVert += ((isCatch ? 1 : 0) - this.hangVert) * Math.min(1, dt * 5);
      this.showObj.scale.setScalar(sc);
      this.showObj.position.x = -o.S.L * sc / 2;
      this.showObj.traverse(child => {
        if (child.isMesh) {
          child.frustumCulled = false;
          child.visible = true;
          if (child.material) {
            child.material.needsUpdate = true;
          }
        }
      });
      this.showObj.visible = true;
      this.hk.rotation.z = this.hangVert * PI / 2;

      // Postura estável e natural do peixe no anzol (zero vibrações, debates ou tremores)
      this.hang.rotation.set(
        0,
        this.fishYaw * (1 - this.hangVert) + this.hangVert * 0.4,
        0
      );
      if (o.pv) {
        o.pv.forEach(p => { p.rotation.y = 0; });
      }
      if (o.tl) o.tl.rotation.y = 0;
      if (o.rip) {
        o.rip.forEach(([m]) => { m.rotation.x = 0; });
      }
      if (o.pf) {
        o.pf.forEach(([h, s]) => {
          h.rotation.x = s * (PI / 2 + 0.25);
        });
      }
      if (o.jv) o.jv.rotation.z = -0.1;
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

    let ak = '';
    if (this.equipped && this.state === 'reel' && q && q.ph >= 1) {
      ak = (q.fd ? q.fd < 0 ? '▶' : '◀' : '✋') + '|' +
           (q.ph === 1 ? 't' : this.counterControl > .5 ? 'ok' : 'on') + '|' +
           (q.fd ? this.hold ? 'SOLTE e mova a vara' : 'mova a vara' : 'SOLTE o carretel') + '|' +
           (q.fd ? q.fd < 0 ? 'R' : 'L' : 'C');
    }

    if (this.ui.arw) {
      if (ak !== this.lastArrowKey) {
        this.lastArrowKey = ak;
        if (!ak) {
          this.ui.arw.className = '';
          this.ui.arw.style.opacity = '0';
        } else {
          const [a, c, l, ps] = ak.split('|');
          this.ui.arw.innerHTML = a + '<small>' + l + '</small>';
          this.ui.arw.className = c + ' ' + ps;
          this.ui.arw.style.opacity = '1';
        }
      }
    }

    const hintTxt = this.statusTimer > 0 ? this.statusMsg : (this.equipped ? HINTS[this.state] : '');
    if (this.ui.hint && this.ui.hint.textContent !== hintTxt) {
      this.ui.hint.textContent = hintTxt;
    }

    if (this.ui.pwb) {
      this.ui.pwb.style.opacity = this.state === 'charge' ? '1' : '0';
      if (this.ui.pwf) this.ui.pwf.style.width = (this.power * 100) + '%';
    }

    if (this.ui.tnb) {
      this.ui.tnb.style.opacity = this.state === 'reel' && this.fish ? '1' : '0';
      if (this.ui.tnf) {
        this.ui.tnf.style.width = (this.tension * 100) + '%';
        this.ui.tnf.style.background = this.tension > .85 ? 'var(--crimson)' : 'var(--acc)';
      }
    }

    if (this.ui.sbb) {
      this.ui.sbb.style.opacity = this.state === 'reel' && this.fish ? '1' : '0';
      if (this.ui.sbf) {
        this.ui.sbf.style.width = (this.fish && this.fish.sta !== undefined ? this.fish.sta * 100 : 100) + '%';
      }
    }
  }
}

export const fishingSystem = new FishingSystem();
