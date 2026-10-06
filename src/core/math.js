import * as THREE from 'three';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const m3 = (a, s) => s < .5 ? a[0] + (a[1] - a[0]) * s * 2 : a[1] + (a[2] - a[1]) * (s - .5) * 2;
export const c3 = (a, s, o) => s < .5 ? o.copy(a[0]).lerp(a[1], s * 2) : o.copy(a[1]).lerp(a[2], s * 2 - 1);
export const K = h => h.map(x => new THREE.Color(x));
export const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const D2 = Math.PI / 180;
