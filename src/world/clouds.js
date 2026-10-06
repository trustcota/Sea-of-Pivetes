import * as THREE from 'three';
import { rnd } from '../core/math.js';
import { sc } from '../core/renderer.js';

const T = THREE;
export const cm = new T.MeshStandardMaterial({ flatShading: true, fog: false, roughness: 1 });
export const cg = [0, 1, 2, 3].map(() => {
  const g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position, sd = rnd(0, 99);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i),
      v = Math.sin(Math.round(x * 1e4) * 127.1 + Math.round(y * 1e4) * 311.7 + Math.round(z * 1e4) * 74.7 + sd) * 43758.5453,
      f = 1 + (v - Math.floor(v) - .5) * .3;
    p.setXYZ(i, x * f, y * f, z * f);
  }
  return g;
});
export const clouds = new T.Group();
for (let i = 0; i < 16; i++) {
  const c = new T.Group();
  const n = 5 + Math.floor(rnd(0, 3));
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - .5,
      up = k === (n >> 1) || (k === (n >> 1) - 1 && n > 5),
      r = rnd(3.4, 5) * (1 - .5 * Math.abs(t)),
      m = new T.Mesh(cg[k % 4], cm);
    m.position.set(t * n * 3.2 + rnd(-1, 1), up ? r * .5 : rnd(-.5, .3), rnd(-2.4, 2.4));
    m.scale.set(r * 1.2, r * (up ? .7 : .5), r);
    m.rotation.y = rnd(0, 6.28);
    c.add(m);
  }
  c.rotation.y = rnd(0, 6.28);
  c.position.set(rnd(-220, 220), rnd(48, 62), rnd(-220, 220));
  c.userData.v = rnd(.6, 1.4);
  clouds.add(c);
}
sc.add(clouds);
