import * as THREE from 'three';
import { K } from './math.js';

export const SKY = K([0x8fd3f4, 0x9fb0bb, 0x232b35]);
export const DEEP = K([0x093854, 0x072d42, 0x061e2b]);
export const SHAL = K([0x00d2be, 0x04a6b5, 0x08667a]);
export const CREST = K([0x6dfbe5, 0x3fe3d3, 0x24b2be]);
export const CLD = K([0xffffff, 0xb3bcc4, 0x39424d]);
export const FOAM = new THREE.Color(0xf4fffd);
export const WH = new THREE.Color(0xffffff);
export const GC = { h: new THREE.Color(0xffc93c), r: new THREE.Color(0xff6a55) };
