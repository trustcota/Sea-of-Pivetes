import * as THREE from 'three';
import { sc } from '../core/renderer.js';

const T = THREE;

/* ===== Arquipélago: gerador de ilhas (do projeto Arquipélago Lowpoly Infinito), isolado em escopo próprio ===== */
export const ilhasRoot = new T.Group();
sc.add(ilhasRoot);

export const ILHAS = (function(scene) {
const T = THREE, PI = Math.PI;
let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const R = (a, b) => a + (b - a) * rnd(), P = a => a[rnd() * a.length | 0];
const col = c => new T.Color(c).offsetHSL(R(-.012, .012), R(-.05, .05), R(-.035, .035));
const mat = c => new T.MeshLambertMaterial({ color: col(c), vertexColors: true });
const grad = g => { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, n = p.count, a = new Float32Array(n * 3), h = (b.max.y - b.min.y) || 1; for (let i = 0; i < n; i++) { const v = .8 + .28 * (p.getY(i) - b.min.y) / h; a.set([v, v, v], i * 3) } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g };
const mesh = (g, c, x = 0, y = 0, z = 0) => { const m = new T.Mesh(grad(g), Array.isArray(c) ? c.map(mat) : mat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m };
const jit = (g, a) => { const p = g.attributes.position, k = {}; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = [x, y, z].map(v => v.toFixed(3)).join(), o = k[h] || (k[h] = [R(-a, a), R(-a, a), R(-a, a)]); p.setXYZ(i, x + o[0], y + o[1], z + o[2]) } return g };
const ico = (r, d = 1, j = .1) => jit(new T.IcosahedronGeometry(r, d), r * j);
const cyl = (a, b, h, n = 6) => new T.CylinderGeometry(a, b, h, n);
const cone = (r, h, n = 5) => new T.ConeGeometry(r, h, n);
const grp = (...m) => { const g = new T.Group(); g.add(...m); return g };
const GL = [0x6fbf5a, 0x7ccb62, 0x5aa84f];
const tuft = (x, z, s = 1) => { if (window.NT) return new T.Group(); const g = grp(...[0, 1, 2].map(i => { const m = mesh(cone(.05 * s, R(.2, .34) * s, 4), P(GL), Math.cos(i * 2.1) * .06 * s, .13 * s, Math.sin(i * 2.1) * .06 * s); m.rotation.set(R(-.3, .3), 0, R(-.3, .3)); m.castShadow = false; return m })); g.position.set(x, 0, z); return g };
const root = (r, c, a) => { const m = mesh(cone(r * .3, .45, 4), c, Math.cos(a) * r * 1.05, .1, Math.sin(a) * r * 1.05); m.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15); return m };

/* Árvores */
const trunk = (h, r = .18, c = 0x7a5239) => grp(mesh(cyl(r * .7, r, h, 7), c, 0, h / 2, 0), mesh(cyl(r * 1.02, r * 1.1, .9, 7), c, 0, -.4, 0), ...[0, 1, 2, 3].map(i => root(r, c, i * 1.6 + R(0, .5))));
const pine = () => { const n = 4 + (rnd() * 3 | 0), w = R(1, 1.35), c = P([0x2f7d4f, 0x3a8f5a, 0x27684a]), g = grp(trunk(.9, .2)); for (let i = 0; i < n; i++) { const t = i / (n - 1), m = mesh(jit(new T.ConeGeometry(w * (1 - t * .62), 1.05 - t * .2, 8), .04), c, 0, .85 + i * .62, 0); m.rotation.y = i * .5; g.add(m) } return g };
const tree = (cs, tr = 0x7a5239, k = 1) => { const h = R(1.3, 2) * k, g = grp(trunk(h, R(.17, .25), tr)), c = P(cs), c2 = P(cs), b = mesh(ico(R(1, 1.25), 1, .08), c, 0, h + .65, 0); b.scale.y = .9; g.add(b); for (let i = 0; i < 6; i++) { const a = i * 1.05 + R(0, .5); g.add(mesh(ico(R(.5, .72), 1, .08), i % 2 ? c : c2, Math.cos(a) * .85, h + .35 + R(0, .7), Math.sin(a) * .85)) } g.add(mesh(ico(R(.45, .6), 1, .08), c2, R(-.2, .2), h + 1.5, R(-.2, .2)), tuft(1, .6, 1.2), tuft(-.9, -.7, 1)); return g };
const round = () => tree([0x6cbf5a, 0x5aae4f, 0x82c95e]);
const blossom = () => tree([0xf4a6c0, 0xf7b9cf, 0xe98fb0], 0x6b4a3a, .85);
const autumn = () => tree([0xe8893a, 0xf0a93a, 0xd4642c], 0x6b4a3a);

/* Arbustos */
const GB = [0x4f9d4a, 0x5cb35a, 0x3f8a4a];
const bush = (c, n = 5) => { const g = new T.Group(), bl = []; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + R(0, .6), d = i ? R(.35, .55) : 0, r = i ? R(.4, .55) : R(.6, .7), p = [Math.cos(a) * d, r * .75 + (i ? 0 : .1), Math.sin(a) * d]; bl.push([p, r]); g.add(mesh(ico(r, 1, .07), c, ...p)) } g.add(tuft(.75, .3, 1.1), tuft(-.65, -.5, 1)); g.userData.bl = bl; return g };
const dots = (g, c, n, s) => { for (let i = 0; i < n; i++) { const [p, r] = P(g.userData.bl), a = R(0, 6.28), b = R(.2, 1.3); g.add(mesh(ico(s, 0, 0), P(c), p[0] + Math.sin(b) * Math.cos(a) * r * .98, p[1] + Math.cos(b) * r * .98, p[2] + Math.sin(b) * Math.sin(a) * r * .98)) } return g };
const bushA = () => bush(P(GB));
const berry = () => dots(bush(P(GB)), [0xd7263d], 12, .075);
const bloomB = () => dots(bush(P(GB)), [0xffb3c6, 0xffffff, 0xffd166], 14, .1);
const hedge = () => { const g = new T.Group(), c = P(GB), n = 4 + (rnd() * 2 | 0); for (let i = 0; i < n; i++) { const r = R(.45, .52), m = mesh(ico(r, 1, .07), c, (i - (n - 1) / 2) * .5, r * .9, R(-.08, .08)); m.scale.set(1, 1.15, 1.1); g.add(m) } for (let i = 0; i < n - 1; i++) g.add(mesh(ico(.38, 1, .07), c, (i - (n - 2) / 2) * .5, .85, 0)); g.add(tuft(.9, .4, 1.1), tuft(-.9, -.3, 1)); return g };

/* Troncos */
const BK = [0x7a5239, 0x8a5e3c, 0x6b4a3a], CUT = 0xe8c48f, RING = 0xc99a63;
const logG = (r, l, y = r * .95) => { const g = grp(mesh(cyl(r, r, l, 9).rotateZ(PI / 2), [P(BK), CUT, CUT], 0, y, 0)); [-1, 1].forEach(s => g.add(mesh(cyl(r * .55, r * .55, .03, 8).rotateZ(PI / 2), RING, s * l / 2, y, 0))); return g };
const logA = (r = R(.27, .36)) => { const g = logG(r, R(1.8, 2.5)), s = mesh(cyl(.04, .06, .4, 5), 0x7a5239, R(-.3, .3), r * 1.7, r * .5); s.rotation.set(.7, 0, R(-.4, .4)); g.add(s, tuft(.5, .4, 1), tuft(-.7, -.35, .9)); return g };
const mush = (x, y, z, s = 1) => { const g = grp(mesh(cyl(.04, .05, .12, 5), 0xf5ead8, 0, .06, 0), mesh(new T.SphereGeometry(.1, 6, 4, 0, 6.28, 0, 1.6), P([0xe5484d, 0xf08a4b]), 0, .12, 0)); g.position.set(x, y, z); g.scale.setScalar(s); return g };
const stump = () => { const r = R(.38, .5), h = R(.4, .65), g = grp(mesh(cyl(r * .88, r * 1.08, h, 9), [P(BK), CUT, CUT], 0, h / 2, 0), mesh(cyl(r * 1.08, r * 1.1, .6, 9), 0x7a5239, 0, -.28, 0), mesh(cyl(r * .6, r * .6, .03, 9), RING, 0, h + .012, 0), mesh(cyl(r * .28, r * .28, .03, 7), 0xb88450, 0, h + .02, 0)); for (let i = 0; i < 4; i++) g.add(root(r * 1.1, 0x7a5239, i * 1.6 + R(0, .5))); g.add(mush(r * 1.35, 0, R(-.3, .3), R(.9, 1.3)), tuft(-r * 1.3, .2, 1)); return g };
const pile = () => { const r = .2, l = R(1.2, 1.6), g = new T.Group(); [[-.4, r], [0, r], [.4, r], [-.2, r * 2.75], [.2, r * 2.75], [0, r * 4.5]].forEach(([z, y]) => { const q = logG(r, l + R(-.1, .1), y); q.position.z = z; g.add(q) }); g.add(tuft(.5, .7, 1), tuft(-.6, -.7, 1)); return g };
const mossyLog = () => { const g = logG(.3, R(1.9, 2.4)), m = mesh(ico(.3, 1, .08), 0x78b657, R(-.3, .3), .52, 0); m.scale.set(1.8, .4, 1); g.add(m, mush(.4, .5, .15, R(.9, 1.3)), mush(.62, .45, .22, .75), mush(-.5, .47, -.1, 1), tuft(.2, .5, 1)); return g };

/* Pedras */
const GR = [0x9aa0a6, 0x8b9199, 0xa8aeb4, 0x7f858c];
const rock = (r, s, c) => { const g = jit(new T.IcosahedronGeometry(r, 1), r * .16), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -r * .4)); const m = mesh(g, c || P(GR)); m.scale.set(...s); m.position.y = r * s[1] * .4; m.rotation.y = R(0, PI); return m };
const boulder = () => grp(rock(R(.6, .85), [R(.9, 1.2), R(.8, 1.1), R(.9, 1.2)]), tuft(.7, .3, 1));
const slab = () => grp(rock(R(.7, .9), [1.35, .5, 1.05]), tuft(-.8, .5, 1));
const cluster = () => { const g = grp(rock(.65, [1, .9, 1])); for (let i = 0; i < 3; i++) { const m = rock(R(.22, .4), [1, .9, 1]); m.position.x = R(-1, 1); m.position.z = R(-.8, .8); g.add(m) } g.add(tuft(.6, .8, 1)); return g };
const mossy = () => { const g = grp(rock(.7, [1.1, .9, 1])), c = mesh(ico(.5, 1, .08), 0x78b657, 0, .78, 0); c.scale.set(1.15, .45, 1.1); g.add(c, tuft(.8, .2, 1), tuft(-.7, -.5, .9)); return g };

/* Flores */
const stem = (h, c = 0x4f9d4a) => mesh(cyl(.022, .03, h, 5), c, 0, h / 2, 0);
const blade = (l = .32) => { const m = mesh(new T.OctahedronGeometry(.08), 0x5ab04f, 0, l * .5, 0); m.scale.set(.5, l / .08 * .5, .15); m.rotation.set(R(-.5, .5), R(0, 6.28), R(-.7, .7)); return m };
const ring = (n, r, s, c, y = 0) => Array.from({ length: n }, (_, i) => { const a = i / n * 6.28, m = mesh(new T.OctahedronGeometry(s), c, Math.cos(a) * r, y, Math.sin(a) * r); m.scale.set(1.6, .35, .75); m.rotation.y = -a; return m });
const daisy = () => { const h = R(.55, .85), p = P([0xffffff, 0xfff4d6, 0xffe3ec, 0xe3d4ff]); return grp(stem(h), blade(), blade(.26), mesh(ico(.09, 1, .05), 0xf5c542, 0, h + .03, 0), ...ring(10, .17, .075, p, h)) };
const tulip = () => { const h = R(.5, .75), c = P([0xe84a5f, 0xff8fab, 0xf9c74f, 0xb388eb, 0xff9f6b]), g = grp(stem(h), blade(.4), blade(.3)); for (let i = 0; i < 5; i++) { const a = i * 1.257, m = mesh(new T.OctahedronGeometry(.09), c, Math.cos(a) * .055, h + .1, Math.sin(a) * .055); m.scale.set(.35, 1.5, .7); m.rotation.set(0, -a, -.28); g.add(m) } return g };
const sunflower = () => { const h = R(1.1, 1.5), hd = grp(mesh(cyl(.21, .21, .08, 10), 0x6b4226, 0, .02, 0), ...ring(14, .31, .11, 0xffc928, -.02), ...ring(14, .27, .1, 0xf5a623, -.05)); hd.position.y = h; hd.rotation.x = R(.35, .7); return grp(stem(h, 0x4a8f45), blade(.6), blade(.5), hd) };
const lavender = () => { const c = P([0x9b72cf, 0xb48ee0, 0x8a6bd1]), g = grp(blade(.4), blade(.3)); for (let k = 0; k < 3; k++) { const h = R(.5, .85), x = R(-.1, .1), z = R(-.1, .1), s = stem(h); s.position.set(x, h / 2, z); g.add(s); for (let i = 0; i < 6; i++) { const m = mesh(new T.OctahedronGeometry(.07 - i * .006), c, x, h - .25 + i * .075, z); m.scale.set(1, 1.25, 1); g.add(m) } } return g };
const clump = mk => () => { const g = new T.Group(), n = 4 + (rnd() * 3 | 0); for (let i = 0; i < n; i++) { const f = mk(); f.position.set(R(-.5, .5), 0, R(-.5, .5)); f.rotation.set(0, R(0, 6.28), R(-.12, .12)); f.scale.setScalar(R(.9, 1.35)); g.add(f) } g.add(tuft(.3, .25, 1.2), tuft(-.35, -.3, 1)); return g };

/* ===== Ajustes de geração: altere só aqui (unidades do mundo) ===== */
const GEN = {
 height: 8.5,      // altura média das ilhas acima do nível do mar (aumentada para ilhas maiores)
 rockyBonus: 4.2,  // altura extra do bioma Costão rochoso
 heightVar: .35,   // variação de altura entre ilhas (0 = todas iguais)
 rise: 1.1,        // suavidade da subida da praia ao topo (praia e encosta mais amplas)
 depth: 12,        // profundidade do oceano: fundo abaixo do nível do mar
 shelf: 1.6,       // largura da plataforma rasa ao redor das ilhas (declive suave)
 spacing: 220,     // distância entre as células da grade de ilhas
 gap: 24,          // folga mínima entre as bordas de ilhas vizinhas
 rMin: 38, rMax: 70, // raio das ilhas (muito maiores)
 density: .80      // chance de cada célula da grade ter uma ilha
};
const HZ = 0xeaf3ea, CS = 48, N = 16, SEA = 0.0, SH = .25; let IC, JM, SKD; const calc = () => { IC = GEN.spacing; JM = Math.min(.45, (GEN.rMax * 1.33 + GEN.gap / 2) / IC); SKD = Math.max(3.5, (GEN.height + GEN.rockyBonus) * 1.2) }; calc();
const MAT = new T.MeshLambertMaterial({ vertexColors: true }), $ = id => document.getElementById(id);
const geo = (p, c, n) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('normal', new T.BufferAttribute(n, 3)); return g };
const fnorm = p => { const n = new Float32Array(p.length); for (let i = 0; i < p.length; i += 9) { const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2]; let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; for (let k = 0; k < 9; k += 3) { n[i + k] = x; n[i + k + 1] = y; n[i + k + 2] = z } } return n };
/* junta um modelo inteiro em uma única geometria com cores já aplicadas */
function bake(gr) { gr.updateMatrixWorld(true); const A = [], B = []; let n = 0; gr.traverse(m => { if (!m.isMesh) return; const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld), p = g.attributes.position.array, v = g.attributes.color.array, c = new Float32Array(p.length), mt = m.material, put = (a, b, k) => { for (let i = a * 3; i < b * 3; i += 3) { c[i] = k.r * v[i]; c[i + 1] = k.g * v[i + 1]; c[i + 2] = k.b * v[i + 2] } }; if (Array.isArray(mt)) g.groups.forEach(q => put(q.start, q.start + q.count, mt[q.materialIndex].color)); else put(0, p.length / 3, mt.color); A.push(p); B.push(c); n += p.length }); const pos = new Float32Array(n), cl = new Float32Array(n); let o = 0; A.forEach((p, i) => { pos.set(p, o); cl.set(B[i], o); o += p.length }); return { pos, col: cl, nor: fnorm(pos) } }

const ctl = { target: new T.Vector3() };
/* ruído e ilhas (tudo determinístico pela semente) */
let WS = (Math.random() * 1e9 | 0) || 1;
const h2 = (x, z, s = 0) => { let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(WS + s * 7919 | 0, 1013904223) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296 };
const lp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t);
const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = sm(x - i), v = sm(z - j); return lp(lp(h2(i, j, 9), h2(i + 1, j, 9), u), lp(h2(i, j + 1, 9), h2(i + 1, j + 1, 9), u), v) };
const rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const cells = new Map();
const cell = (i, j) => { const k = i + ',' + j; let c = cells.get(k); if (c === undefined) { c = h2(i, j, 1) < GEN.density ? { x: (i + JM + (1 - 2 * JM) * h2(i, j, 2)) * IC, z: (j + JM + (1 - 2 * JM) * h2(i, j, 3)) * IC, r: GEN.rMin + (GEN.rMax - GEN.rMin) * h2(i, j, 4), b: h2(i, j, 5) * 6 | 0, s: 1 + GEN.heightVar * (h2(i, j, 6) * 2 - 1) } : null; cells.set(k, c) } return c };
const F = { h: 0, b: 0, m: -1 };
function field(x, z) {
 let m = -1, c0 = null;
 const ix = Math.floor(x / IC), iz = Math.floor(z / IC);
 for (let i = ix - 1; i <= ix + 1; i++) {
  for (let j = iz - 1; j <= iz + 1; j++) {
   const c = cell(i, j);
   if (!c) continue;
   const dx = x - c.x, dz = z - c.z;
   const distSq = dx * dx + dz * dz;
   const maxR = c.r * 1.55;
   if (distSq > maxR * maxR) continue;
   const dist = Math.sqrt(distSq);
   const a = Math.atan2(dz, dx), ca = Math.cos(a), sa = Math.sin(a);
   const q = 1 - dist / c.r / (1 + .5 * (vn(ca * 2.2 + c.x, sa * 2.2 + c.z) - .5) + .16 * (vn(ca * 5.5 + c.z * .7, sa * 5.5 + c.x * .7) - .5));
   if (q > m) { m = q; c0 = c }
  }
 }
 let h; const fine = (vn(x * .5, z * .5) - .5) * .3 * Math.min(Math.max(m, 0) * 2, 1);
 if (m < SH) h = SEA - GEN.depth * sm(Math.min((SH - m) / GEN.shelf, 1)) + fine;
 else if (c0) {
  const k = c0.b == 4, P = (GEN.height + (k ? GEN.rockyBonus : 0)) * c0.s, u = m - SH;
  h = SEA + P * (.7 * sm(Math.min(u / GEN.rise, 1)) + .3 * sm(Math.max(0, Math.min((m - .55) / .45, 1)))) + (vn(x * .11, z * .11) - .5) * (k ? .56 : .39) * P * sm(Math.min(u / .3, 1)) + fine;
 } else {
  h = SEA - GEN.depth + fine;
 }
 F.h = h; F.m = m; F.b = c0 ? c0.b : 0; return F;
}

/* biomas: cores do chão e quais modelos nascem em cada um */
const BI = [
 { n: 'Campina florida', g: [0x8fd36a, 0x79c35b], w: { round: 3, blossom: .4, bushA: 3, berry: 1.5, bloomB: 2, hedge: .7, fD: 5, fT: 4, fS: 2, fL: 3, boulder: 1, logA: .6, stump: .5 } },
 { n: 'Pinheiral', g: [0x5fa865, 0x4b9459], w: { pine: 9, boulder: 1.5, mossy: 1, logA: 1.2, pile: .4, stump: 1, bushA: 1.5, berry: .5, fL: .8 } },
 { n: 'Bosque de outono', g: [0xc9b25a, 0xb6a04c], w: { autumn: 7, round: 1, logA: 1.5, stump: 1.5, mossyLog: 1, pile: .6, bushA: 1.5, berry: 1, boulder: .8, fS: 1 } },
 { n: 'Jardim de cerejeiras', g: [0xa9dc8a, 0x93d07a], w: { blossom: 6, bloomB: 3, hedge: 1, fD: 4, fT: 5, fL: 2, boulder: .6, stump: .4 } },
 { n: 'Costão rochoso', g: [0x9fb089, 0x8a9c78], w: { boulder: 4, slab: 3, cluster: 3, mossy: 2, pine: 1.5, logA: .5, fL: 1 } },
 { n: 'Tundra nevada', g: [0xf2f7fa, 0xdfeaf2], tn: .5, w: { pine: 7, boulder: 2, cluster: 1, slab: 1, stump: .6, logA: .5 } }];
BI.forEach(B => { B.w.gr = 5; B.c0 = new T.Color(B.g[0]); B.c1 = new T.Color(B.g[1]); B.k = Object.keys(B.w); B.cw = []; let s = 0; B.k.forEach(k => B.cw.push(s += B.w[k])); B.tot = s });
const SAND = new T.Color(0xf1dca0), SEAB = new T.Color(0xa08c66), DEEP_C = new T.Color(0x6e6350), tc = new T.Color();
const gc = (b, h, x, z) => { tc.copy(BI[b].c0).lerp(BI[b].c1, vn(x * .09, z * .09)); if (h < 1.4) tc.lerp(SAND, sm(Math.min((1.4 - h) / 1.4, 1))); if (h < -.2) tc.lerp(SEAB, Math.min((-.2 - h) / .6, 1)); if (h < -1) tc.lerp(DEEP_C, Math.min((-1 - h) / 2, 1)); return tc.multiplyScalar(.93 + .14 * vn(x * .45, z * .45)) };

/* biblioteca: 4 variações prontas de cada modelo, juntadas em uma geometria só */
const DEF = { pine: [pine, 1.5, 1, 2.4, 3.3, .8], round: [round, 2.1, 1, 2.2, 3, .8], blossom: [blossom, 2, 1, 2.1, 2.8, .8], autumn: [autumn, 2.1, 1, 2.2, 3, .8], boulder: [boulder, 1.1, 1, 1.2, 2.4, 1], slab: [slab, 1.3, 1, 1.3, 2.2, 1], cluster: [cluster, 1.4, 1, 1.2, 1.9, 1], mossy: [mossy, 1.2, 1, 1.2, 2.1, 1], bushA: [bushA, 1.2, 0, 1.3, 1.8, 1], berry: [berry, 1.2, 0, 1.3, 1.7, 1], bloomB: [bloomB, 1.2, 0, 1.3, 1.7, 1], hedge: [hedge, 1.5, 0, 1.3, 1.7, 1], logA: [logA, 1.4, 0, 1.3, 1.7, 1], stump: [stump, .9, 0, 1.4, 2, 1], pile: [pile, 1, 0, 1.3, 1.6, 1], mossyLog: [mossyLog, 1.4, 0, 1.3, 1.7, 1], fD: [clump(daisy), .9, 0, .75, 1, 1], fT: [clump(tulip), .9, 0, .75, 1, 1], fS: [clump(sunflower), .9, 0, .75, 1, 1], fL: [clump(lavender), .9, 0, .75, 1, 1], gr: [() => { window.NT = 0; const g = grp(tuft(0, 0, 1.6), tuft(.5, .3, 1.2), tuft(-.4, .2, 1.3)); window.NT = 1; return g }, .6, 0, 1, 1.6, .5] };
const CRF = { pine: .3, round: .32, blossom: .3, autumn: .32, boulder: .8, slab: 1, cluster: 1, mossy: .75, bushA: .8, berry: .8, bloomB: .8, hedge: 1, logA: .7, stump: .5, pile: .8, mossyLog: .7 };
const FOOT = { pine: [.35, .35], round: [.4, .4], blossom: [.4, .4], autumn: [.4, .4], boulder: [.8, .8], slab: [1.1, .9], cluster: [1.1, 1.1], mossy: [.8, .8], bushA: [.9, .9], berry: [.9, .9], bloomB: [.9, .9], hedge: [1.4, .5], logA: [1.1, .3], stump: [.5, .5], pile: [.75, .5], mossyLog: [1.1, .3], fD: [.5, .5], fT: [.5, .5], fS: [.5, .5], fL: [.5, .5], gr: [.4, .4] };
const CK = { pine: 't', round: 't', blossom: 't', autumn: 't', boulder: 'r', slab: 'r', cluster: 'r', mossy: 'r', bushA: 'b', berry: 'b', bloomB: 'b', hedge: 'b', logA: 'l', stump: 'l', pile: 'l', mossyLog: 'l', fD: 'f', fT: 'f', fS: 'f', fL: 'f', gr: 'f' };
const CLS = { t: [0, .1, .7], r: [1, .1, 1], l: [1, .08, .5], b: [0, .05, .6], f: [0, .03, .9] };
const DBG = window.DBG = { ok: 0, steep: 0, wet: 0, resid: 0 };
const LIB = {}; window.NT = 1; { let q = 0; for (const k in DEF) { LIB[k] = []; for (let v = 0; v < 4; v++) { seed = 500 + (q++) * 131 + v * 17; LIB[k].push(bake(DEF[k][0]())) } } }

/* árvores simplificadas (cerca de 40 triângulos) para ilhas distantes */
const FTD = { pine: [0x2f7d4f, 0x3a8f5a, 0x27684a], round: [0x6cbf5a, 0x5aae4f, 0x82c95e], blossom: [0xf4a6c0, 0xf7b9cf, 0xe98fb0], autumn: [0xe8893a, 0xf0a93a, 0xd4642c] }, FAR = {};
for (const k in FTD) { FAR[k] = []; for (let v = 0; v < 4; v++) { seed = 3000 + v * 11 + k.length; const c = P(FTD[k]), g = grp(mesh(cyl(.2, .28, 1.6, 5), k == 'pine' ? 0x6b4a3a : 0x7a5239, 0, .5, 0));
 if (k == 'pine') g.add(mesh(cone(1.25, 3.4, 6), c, 0, 2.4, 0)); else { const b = mesh(ico(1.4, 0, .06), c, 0, 2.9, 0); b.scale.y = .9; g.add(b, mesh(ico(.8, 0, .06), c, .7, 2.4, .3)) }
 FAR[k].push(bake(g)) } }

/* chunk: terreno + um mesh de objetos grandes + um de pequenos, tudo já fundido */
function merge(L) { let n = 0; L.forEach(q => n += q.p.pos.length); if (!n) return null; const Pp = new Float32Array(n), C = new Float32Array(n), Nn = new Float32Array(n); let o = 0;
 for (const q of L) { const { pos, col: cc, nor } = q.p, e = q.e, s = q.s, t = q.tn;
  for (let i = 0; i < pos.length; i += 3, o += 3) { const vx = pos[i], vy = pos[i + 1], vz = pos[i + 2], nx = nor[i], ny = nor[i + 1], nz = nor[i + 2];
   Pp[o] = (e[0] * vx + e[3] * vy + e[6] * vz) * s + q.x; Pp[o + 1] = (e[1] * vx + e[4] * vy + e[7] * vz) * s + q.y; Pp[o + 2] = (e[2] * vx + e[5] * vy + e[8] * vz) * s + q.z;
   Nn[o] = e[0] * nx + e[3] * ny + e[6] * nz; Nn[o + 1] = e[1] * nx + e[4] * ny + e[7] * nz; Nn[o + 2] = e[2] * nx + e[5] * ny + e[8] * nz;
   C[o] = cc[i] + (1 - cc[i]) * t; C[o + 1] = cc[i + 1] + (1 - cc[i + 1]) * t; C[o + 2] = cc[i + 2] + (1 - cc[i + 2]) * t } }
 const m = new T.Mesh(geo(Pp, C, Nn), MAT); m.castShadow = m.receiveShadow = true; return m }

const OFF = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]], QA = new T.Quaternion(), QB = new T.Quaternion(), UP = new T.Vector3(0, 1, 0), NV = new T.Vector3(), MT = new T.Matrix4();
function build(cx, cz, lod = 0) {
 const Nn = lod < 2 ? N : 4, st = lod == 1 ? 2 : 1, x0 = cx * CS, z0 = cz * CS, S = CS / Nn, M = lod < 2 ? 2 : 0, W = Nn + 1 + 2 * M, H = [], Bq = []; let mx = -9;
 for (let j = -M; j <= Nn + M; j++) for (let i = -M; i <= Nn + M; i++) { const f = field(x0 + i * S, z0 + j * S); H.push(f.h); Bq.push(f.b); if (i >= 0 && i <= Nn && j >= 0 && j <= Nn && f.m > mx) mx = f.m }
 const ch = { cx, cz, lod, ms: [], age: 0 }; if (mx < SH - GEN.shelf - (lod > 1 ? .35 : lod ? .16 : .08)) {
  const hF = SEA - GEN.depth, fc = gc(0, hF, x0 + CS / 2, z0 + CS / 2), fq = new Float32Array([x0, hF, z0, x0, hF, z0 + CS, x0 + CS, hF, z0, x0 + CS, hF, z0, x0, hF, z0 + CS, x0 + CS, hF, z0 + CS]), fk = new Float32Array(18);
  for (let k = 0; k < 18; k += 3) { fk[k] = fc.r; fk[k + 1] = fc.g; fk[k + 2] = fc.b }
  const fm = new T.Mesh(geo(fq, fk, fnorm(fq)), MAT); fm.receiveShadow = true; ch.ms.push(fm); ch.ms.forEach(m => { m.scale.y = .001; m.position.y = SEA; scene.add(m) }); return ch }
 const nq = Nn / st, ix = (i, j) => (j + M) * W + i + M, tp = new Float32Array((nq * nq + 4 * nq) * 18), tl = new Float32Array(tp.length); let o = 0, i = 0, j = 0;
 const tri = p => { const o0 = o; let hs = 0, bb = 0; for (let t = 0; t < 6; t += 2) { const a = i + p[t] * st, b = j + p[t + 1] * st, k = ix(a, b); tp[o] = x0 + a * S; tp[o + 1] = H[k]; tp[o + 2] = z0 + b * S; o += 3; hs += H[k]; bb = Bq[k] } const c = gc(bb, hs / 3, x0 + (i + .4 * st) * S, z0 + (j + .4 * st) * S); for (let k = o0; k < o; k += 3) { tl[k] = c.r; tl[k + 1] = c.g; tl[k + 2] = c.b } };
 for (j = 0; j < Nn; j += st) for (i = 0; i < Nn; i += st) { tri([0, 0, 0, 1, 1, 0]); tri([1, 0, 0, 1, 1, 1]) }
 /* saia vertical nas bordas: esconde frestas entre níveis de detalhe diferentes */
 const sk = (ia, ja, ib, jb) => { const ka = ix(ia, ja), kb = ix(ib, jb), ax = x0 + ia * S, az = z0 + ja * S, bx = x0 + ib * S, bz = z0 + jb * S, ha = H[ka], hb = H[kb], c = gc(Bq[ka], (ha + hb) / 2, (ax + bx) / 2, (az + bz) / 2);
  for (const p of [[ax, ha, az], [bx, hb, bz], [bx, hb - SKD, bz], [ax, ha, az], [bx, hb - SKD, bz], [ax, ha - SKD, az]]) { tp[o] = p[0]; tp[o + 1] = p[1]; tp[o + 2] = p[2]; tl[o] = c.r; tl[o + 1] = c.g; tl[o + 2] = c.b; o += 3 } };
 for (let t = 0; t < Nn; t += st) { sk(t, 0, t + st, 0); sk(Nn, t, Nn, t + st); sk(Nn - t, Nn, Nn - t - st, Nn); sk(0, Nn - t, 0, Nn - t - st) }
 const te = new T.Mesh(geo(tp, tl, fnorm(tp)), MAT); te.receiveShadow = true; ch.ms.push(te);
 const hz = (x, z) => { const lim = Nn + M - 1e-3, u = Math.max(-M, Math.min(lim, (x - x0) / S)), v = Math.max(-M, Math.min(lim, (z - z0) / S)), a = Math.floor(u), b = Math.floor(v), fu = u - a, fv = v - b, h00 = H[ix(a, b)], h10 = H[ix(a + 1, b)], h01 = H[ix(a, b + 1)], h11 = H[ix(a + 1, b + 1)]; return fu + fv <= 1 ? h00 + fu * (h10 - h00) + fv * (h01 - h00) : h11 + (1 - fu) * (h01 - h11) + (1 - fv) * (h10 - h11) };
 if (lod < 2) {
  const rr = rng(h2(cx, cz, 77) * 4294967295 | 0), inst = [];
  for (let t = 0; t < 300; t++) { const x = x0 + rr() * CS, z = z0 + rr() * CS, f = field(x, z); if (f.h < 1.5 || f.m < .12) continue;
   const B = BI[f.b], r = rr() * B.tot, k = B.k[B.cw.findIndex(v => v >= r)], d = DEF[k], sc2 = d[3] + rr() * (d[4] - d[3]), rd = d[1] * sc2 * d[5];
   if (inst.some(w => Math.hypot(w.x - x, w.z - z) < w.r + rd)) continue;
   const [ft, sx, rl] = CLS[CK[k]], fr = Math.max(FOOT[k][0], FOOT[k][1]) * sc2, hs = OFF.map(([a, b]) => hz(x + a * fr, z + b * fr)), lo = Math.min(...hs), hi = Math.max(...hs);
   if (lo < .3) { DBG.wet++; continue }
   if ((hi - lo) / (2 * fr) > rl) { DBG.steep++; continue }
   let y = lo - sx * sc2; QA.identity();
   if (ft) { const gx = (hs[1] - hs[2]) / (2 * fr), gz = (hs[3] - hs[4]) / (2 * fr), py = hs.reduce((u, v) => u + v) / 9; let res = 0; OFF.forEach(([a, b], n) => { res = Math.max(res, Math.abs(hs[n] - (py + (gx * a + gz * b) * fr))) });
    NV.set(-gx, 1, -gz).normalize(); if (Math.acos(NV.y) > .6) { DBG.steep++; continue } if (res > .2 * fr + .08) { DBG.resid++; continue }
    QA.setFromUnitVectors(UP, NV); y = py - sx * sc2 - res * .7 }
   const ya = rr() * 6.28, vi = rr() * 4 | 0; QB.setFromAxisAngle(UP, ya); QA.multiply(QB); MT.makeRotationFromQuaternion(QA); const E = MT.elements;
   if (!isFinite(y)) continue; DBG.ok++; inst.push({ x, z, y, r: rd, t: CK[k] == 't', k, vi, cr: (CRF[k] || 0) * sc2, big: d[2], p: LIB[k][vi], s: sc2, e: new Float32Array([E[0], E[1], E[2], E[4], E[5], E[6], E[8], E[9], E[10]]), tn: B.tn || 0 }) }
  const kp = lod ? inst.filter(q => q.t) : inst; if (lod) kp.forEach(q => q.p = FAR[q.k][q.vi]);
  ch.col = lod ? [] : inst.filter(q => q.cr).map(q => [q.x, q.z, q.cr]); ch.big = merge(kp.filter(q => q.big)); ch.small = lod ? null : merge(kp.filter(q => !q.big));
  [ch.big, ch.small].forEach(m => m && ch.ms.push(m)) } else { const rr = rng(h2(cx, cz, 91) * 4294967295 | 0), inst = [];
  for (let t = 0; t < 120; t++) { const x = x0 + rr() * CS, z = z0 + rr() * CS, f = field(x, z); if (f.h < 1.8 || f.m < .2) continue;
   const B = BI[f.b], r = rr() * B.tot, k = B.k[B.cw.findIndex(v => v >= r)]; if (CK[k] != 't') continue;
   const d = DEF[k], sc2 = d[3] + rr() * (d[4] - d[3]), rd = d[1] * sc2 * d[5], fr = .4 * sc2; if (inst.some(w => Math.hypot(w.x - x, w.z - z) < w.r + rd)) continue;
   const lo = Math.min(hz(x, z), hz(x + fr, z), hz(x - fr, z), hz(x, z + fr), hz(x, z - fr)); if (!(lo >= .3)) continue;
   const a = rr() * 6.28, c = Math.cos(a), sn = Math.sin(a);
   inst.push({ x, z, y: lo - .1 * sc2, r: rd, p: FAR[k][rr() * 4 | 0], s: sc2, e: new Float32Array([c, 0, -sn, 0, 1, 0, sn, 0, c]), tn: B.tn || 0 }) }
  ch.col = []; ch.big = merge(inst); ch.big && ch.ms.push(ch.big) }
 ch.ms.forEach(m => { m.scale.y = .001; m.position.y = SEA; scene.add(m) }); return ch }
const drop = c => c.ms.forEach(m => { scene.remove(m); m.geometry.dispose() });

/* gerenciador de distância de visão */
const chunks = new Map(), queue = []; let VD = 2, VDm = 2, fcx = 1e9, fcz = 1e9, bud = 0;
/* níveis de detalhe por distância: 0 completo, 1 só árvores e terreno médio, 2 só terreno grosso */
const lodOf = (d, c) => { const a = d < 3.4 ? 0 : d < 8 ? 1 : 2; if (c === undefined || a == c) return a; return a < c ? (d < [3.4, 8][a] - .6 ? a : c) : (d > [3.4, 8][c] + .6 ? a : c) };
function plan() { const tg = ctl.target, cx = Math.floor(tg.x / CS), cz = Math.floor(tg.z / CS); if (cx == fcx && cz == fcz && !plan.f) return; fcx = cx; fcz = cz; plan.f = 0; queue.length = 0;
 for (let dz = -VD; dz <= VD; dz++) for (let dx = -VD; dx <= VD; dx++) { const d = Math.hypot(dx, dz), k = (cx + dx) + ',' + (cz + dz), c = chunks.get(k); if (d <= VD + .3 && (!c || lodOf(d, c.lod) != c.lod)) queue.push([d, cx + dx, cz + dz, k]) }
 queue.sort((a, b) => b[0] - a[0]); chunks.forEach((c, k) => { if (Math.hypot(c.cx - cx, c.cz - cz) > VD + 1.4) { drop(c); chunks.delete(k) } }) }
function pump() { const t0 = performance.now(), lim = bud > 0 ? 24 : 7; bud--; while (queue.length && performance.now() - t0 < lim) { const [d, x, z, k] = queue.pop(), old = chunks.get(k), lod = lodOf(d, old && old.lod); if (old && old.lod == lod) continue; const nc = build(x, z, lod); if (old) { drop(old); nc.age = 9; nc.ms.forEach(m => { m.scale.y = 1; m.position.y = 0 }) } chunks.set(k, nc) } }

function tH(x, z) { const S = CS / N, i = Math.floor(x / S), j = Math.floor(z / S), u = x / S - i, v = z / S - j, a = field(i * S, j * S).h, b = field((i + 1) * S, j * S).h, c = field(i * S, (j + 1) * S).h, d = field((i + 1) * S, (j + 1) * S).h; return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d) }
function nearestIsland(x, z) { const ix = Math.floor(x / IC), iz = Math.floor(z / IC); let b = null, bd = 1e9; for (let i = ix - 2; i <= ix + 2; i++) for (let j = iz - 2; j <= iz + 2; j++) { const c = cell(i, j); if (c) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c } } } return b }

/* Aproximação analítica ultrarrápida da elevação da ilha para amortecimento e contenção de ondas */
function shoreClamp(x, z, rawY) {
  const ix = Math.floor(x / IC), iz = Math.floor(z / IC);
  let nearC = null, minDist = 1e9;
  for (let i = ix - 1; i <= ix + 1; i++) {
    for (let j = iz - 1; j <= iz + 1; j++) {
      const c = cell(i, j);
      if (!c) continue;
      const dx = x - c.x, dz = z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) {
        minDist = dist;
        nearC = c;
      }
    }
  }
  if (!nearC || minDist > nearC.r + 20) {
    return rawY;
  }
  const normDist = minDist / nearC.r;
  const estH = GEN.height * (1.0 - normDist) * nearC.s;
  if (estH > -2.2) {
    const depth = Math.max(0.0, -estH);
    const damp = Math.max(0.0, Math.min(1.0, depth / 2.2));
    let y = rawY * damp;
    if (estH >= -0.1) {
      y = Math.min(y, -0.35 - estH * 0.5);
    }
    return y;
  }
  return rawY;
}

window.MAP = { SEA, get floor() { return SEA - GEN.depth }, cfg: GEN, height: tH, depth: (x, z) => SEA - tH(x, z), isLand: (x, z) => tH(x, z) >= SEA, island: nearestIsland, biome: (x, z) => BI[field(x, z).b].n, get seed() { return WS } };

const DRAFT = 1.8, HP = [[0, 5], [0, -5], [0, 0], [0, 2.5], [0, -2.5], [-2.2, 0], [2.2, 0]];
const deep = (x, z, d) => SEA - tH(x, z) >= d;
/* true se o casco (calado DRAFT) encostaria em terra/baixio nessa posição e rumo */
function hit(px, pz, hd) { const ch = Math.cos(hd), sh = Math.sin(hd); for (const [lx, lz] of HP) if (!deep(px + lx * ch + lz * sh, pz - lx * sh + lz * ch, DRAFT)) return true; return false }
/* posição inicial: água funda a ~50 m da costa da ilha mais próxima, com a ilha à frente da proa */
function startPos() { let c = null; for (let k = 0; k < 4 && !c; k++) for (let i = -k; i <= k && !c; i++) for (let j = -k; j <= k && !c; j++) if (Math.max(Math.abs(i), Math.abs(j)) == k) c = cell(i, j);
 if (!c) return { x: 0, z: 0 };
 for (let d = c.r * 1.35 + 50; d < c.r * 1.35 + 300; d += 12) for (let t = 0; t < 16; t++) { const a = -1.5708 + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * .4, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; let ok = true; for (let u = 0; u < 8 && ok; u++) ok = deep(x + Math.cos(u * .785) * 14, z + Math.sin(u * .785) * 14, DRAFT * 2.5); if (ok) return { x, z } }
 return { x: c.x + c.r * 3, z: c.z } }
function update(px, pz, dt) { scene.position.set(-px, -SEA, -pz); ctl.target.set(px, 0, pz); plan(); pump(); const tg = ctl.target;
 chunks.forEach(c => { c.age += dt; if (c.age < 1.2) { const e = Math.max(1 - Math.pow(1 - Math.min(c.age / .9, 1), 3), .001); c.ms.forEach(m => { m.scale.y = e; m.position.y = SEA * (1 - e) }) } if (c.small) c.small.visible = Math.hypot((c.cx + .5) * CS - tg.x, (c.cz + .5) * CS - tg.z) < CS * 1.7 }) }
function prime() { bud = 40; fcx = 1e9; plan(); for (let i = 0; i < 40 && queue.length; i++) pump() }
function safeNear(px, pz, hd) { for (let r = 0; r < 260; r += 6) for (let t = 0; t < (r ? 16 : 1); t++) { const a = t * .3927, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; if (!hit(x, z, hd) && deep(x, z, DRAFT * 1.6)) return { x, z } } return startPos() }
/* ajustes de mapa */
function regen() { cells.clear(); chunks.forEach(drop); chunks.clear(); queue.length = 0; prime() }
function setCfg(k, v) { GEN[k] = v; calc(); regen() }
function reseed() { WS = (Math.random() * 1e9 | 0) || 1; regen() }
function setVD(v) { VD = v; plan.f = 1; bud = 50; }
return { hit, startPos, safeNear, update, prime, setCfg, reseed, setVD, vd: () => VD, CS, tH, SEA, GEN, chunks, queue, nearestIsland, shoreClamp, setWireframe: on => { MAT.wireframe = on; } }
})(ilhasRoot);
