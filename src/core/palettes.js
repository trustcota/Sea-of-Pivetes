import * as THREE from 'three';
import { K } from './math.js';

// Transição fluida estilo Piratas do Caribe: [0: Dia Radiante Tropical, 1: Crepúsculo / Brisa de Alto-Mar, 2: Tempestade Maelstrom Épica]
export const SKY = K([0x268ee8, 0x487694, 0x16222a]);
export const DEEP = K([0x003554, 0x022438, 0x01131c]);
export const SHAL = K([0x00c4b4, 0x068e9e, 0x0a2f38]);
export const CREST = K([0x38f0dc, 0x22b2c4, 0x1a505b]);
export const CLD = K([0xffffff, 0xdde7ee, 0x323e46]);
export const FOAM = new THREE.Color(0xf6ffff);
export const WH = new THREE.Color(0xffffff);
export const GC = { h: new THREE.Color(0xffc93c), r: new THREE.Color(0xff5745) };


