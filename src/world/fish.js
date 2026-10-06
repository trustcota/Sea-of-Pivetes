import * as THREE from 'three';
import { rnd, clamp, wrapA } from '../core/math.js';
import { sc } from '../core/renderer.js';
import { H } from './ocean.js';
import { ST } from '../core/state.js';

const T = THREE;

// Material padrão flat-shading com cores de vértices ou materiais coloridos
const matFlat = (color, opacity = 1, transparent = false) => new T.MeshStandardMaterial({
  color: new T.Color(color),
  flatShading: true,
  roughness: 0.6,
  metalness: 0.1,
  side: T.DoubleSide,
  opacity,
  transparent
});

// Helper para gradiente de luz nos modelos low poly
function applyGradient(geom, topFactor = 1.15, bottomFactor = 0.85) {
  geom.computeBoundingBox();
  const bbox = geom.boundingBox;
  const pos = geom.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const h = (maxY - minY) || 1;

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const factor = bottomFactor + (topFactor - bottomFactor) * ((y - minY) / h);
    colors[i * 3] = factor;
    colors[i * 3 + 1] = factor;
    colors[i * 3 + 2] = factor;
  }
  geom.setAttribute('color', new T.BufferAttribute(colors, 3));
  return geom;
}

// ============================================================================
// DEFINIÇÕES DAS ESPÉCIES DE PEIXES ARTICULADOS LOW POLY
// ============================================================================

export const FISH_SPECIES = [
  {
    id: 'tubarao',
    name: 'Tubarão-Arrecife',
    scientificName: 'Carcharhinus perezi',
    category: 'Predador Oceânico',
    sizeRange: '2.2m - 3.2m',
    habitat: 'Arrecifes e Mar Aberto',
    speedText: 'Alta (38 km/h)',
    jointsCount: 6,
    colorTheme: '#5a6b7c',
    desc: 'Predador imponente com corpo hidrodinâmico, nadadeira dorsal pontiaguda que rompe a superfície e articulação caudal potente.'
  },
  {
    id: 'atum',
    name: 'Atum-Azul',
    scientificName: 'Thunnus thynnus',
    category: 'Nectônico Veloz',
    sizeRange: '1.8m - 2.4m',
    habitat: 'Águas Profundas',
    speedText: 'Extrema (70 km/h)',
    jointsCount: 5,
    colorTheme: '#1d4ed8',
    desc: 'Torpedo prateado de dorso azul-cobalto e pequenas barbatanas amarelas. Movimento caudal de alta frequência.'
  },
  {
    id: 'dourado',
    name: 'Dourado / Mahi-Mahi',
    scientificName: 'Coryphaena hippurus',
    category: 'Predador Tropical',
    sizeRange: '1.2m - 1.8m',
    habitat: 'Superfície Oceânica',
    speedText: 'Muito Alta (50 km/h)',
    jointsCount: 5,
    colorTheme: '#eab308',
    desc: 'Cores elétricas em tons de verde-turquesa e ouro brilhante, com crista frontal proeminente e longa nadadeira dorsal.'
  },
  {
    id: 'peixe_voador',
    name: 'Peixe-Voador',
    scientificName: 'Exocoetidae',
    category: 'Superficial / Aéreo',
    sizeRange: '0.3m - 0.45m',
    habitat: 'Superfície e Ar',
    speedText: 'Planeio (55 km/h)',
    jointsCount: 4,
    colorTheme: '#38bdf8',
    desc: 'Pequeno ágil capaz de saltar sobre as cristas das ondas e plainar dezenas de metros com suas nadadeiras peitorais estendidas.'
  },
  {
    id: 'arraia',
    name: 'Arraia-Manta',
    scientificName: 'Mobula birostris',
    category: 'Planctófago Gigante',
    sizeRange: '3.0m - 4.5m',
    habitat: 'Canais de Arrecife',
    speedText: 'Graciosa (24 km/h)',
    jointsCount: 8,
    colorTheme: '#1e293b',
    desc: 'Majestosa gigante dos oceanos com asas articulares triplas que se movem em ondas sincronizadas sob a água.'
  },
  {
    id: 'peixe_palhaco',
    name: 'Peixe-Palhaço',
    scientificName: 'Amphiprion ocellaris',
    category: 'Coralino de Arrecife',
    sizeRange: '0.12m - 0.22m',
    habitat: 'Anêmonas e Arrecifes',
    speedText: 'Moderada (12 km/h)',
    jointsCount: 4,
    colorTheme: '#f97316',
    desc: 'Laranja vibrante com três faixas brancas contornadas em preto. Nada em movimentos curtos e ondulantes em cardumes.'
  },
  {
    id: 'peixe_anjo',
    name: 'Peixe-Anjo Imperador',
    scientificName: 'Pomacanthus imperator',
    category: 'Coralino Ornamental',
    sizeRange: '0.3m - 0.4m',
    habitat: 'Arrecifes Rasos',
    speedText: 'Suave (15 km/h)',
    jointsCount: 4,
    colorTheme: '#06b6d4',
    desc: 'Corpo achatado com vistosas listras amarelas e azuis cyan, acompanhado de filamentos delicados que se alinham à corrente.'
  },
  {
    id: 'marlin',
    name: 'Marlin-Azul / Peixe-Espada',
    scientificName: 'Makaira nigricans',
    category: 'Predador Pelágico',
    sizeRange: '2.5m - 3.8m',
    habitat: 'Mar Aberto',
    speedText: 'Explosiva (80 km/h)',
    jointsCount: 6,
    colorTheme: '#1e1b4b',
    desc: 'Rostro longo em formato de lança e crista dorsal imponente. Um dos peixes mais rápidos e articulados dos oceanos.'
  }
];

// ============================================================================
// CONSTRUTORES DE MALHAS ARTICULADAS (TREE DE SEGMENTOS LOW POLY)
// ============================================================================

/**
 * Cria a malha hierárquica articulada de uma espécie
 */
export function createArticulatedFishMesh(speciesId) {
  const rootGroup = new T.Group();
  rootGroup.name = `fish_root_${speciesId}`;

  // Estrutura de dados para controle de animação dos nós articulados
  const joints = [];
  const fins = [];
  const wings = [];

  switch (speciesId) {
    case 'tubarao':
      buildShark(rootGroup, joints, fins);
      break;
    case 'atum':
      buildTuna(rootGroup, joints, fins);
      break;
    case 'dourado':
      buildMahiMahi(rootGroup, joints, fins);
      break;
    case 'peixe_voador':
      buildFlyingFish(rootGroup, joints, fins, wings);
      break;
    case 'arraia':
      buildMantaRay(rootGroup, joints, wings);
      break;
    case 'peixe_palhaco':
      buildClownfish(rootGroup, joints, fins);
      break;
    case 'peixe_anjo':
      buildAngelfish(rootGroup, joints, fins);
      break;
    case 'marlin':
      buildMarlin(rootGroup, joints, fins);
      break;
    default:
      buildShark(rootGroup, joints, fins);
  }

  return {
    group: rootGroup,
    joints,
    fins,
    wings,
    speciesId
  };
}

// ----------------------------------------------------------------------------
// 1. TUBARÃO-ARRECIFE (Reef Shark)
// ----------------------------------------------------------------------------
function buildShark(root, joints, fins) {
  const cGrey = 0x4a5568;
  const cDark = 0x2d3748;
  const cWhite = 0xe2e8f0;

  // Segmento 0: Cabeça
  const headGroup = new T.Group();
  const headGeo = new T.ConeGeometry(0.45, 1.1, 6);
  headGeo.rotateX(Math.PI / 2);
  const headMesh = new T.Mesh(headGeo, matFlat(cGrey));
  headMesh.position.z = 0.55;
  headGroup.add(headMesh);

  // Olhos
  const eyeGeo = new T.SphereGeometry(0.06, 5, 4);
  const eyeMat = matFlat(0x111111);
  const eyeL = new T.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.28, 0.08, 0.35);
  const eyeR = new T.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.28, 0.08, 0.35);
  headGroup.add(eyeL, eyeR);

  // Barriga branca
  const bellyGeo = new T.BoxGeometry(0.5, 0.15, 0.9);
  const bellyMesh = new T.Mesh(bellyGeo, matFlat(cWhite));
  bellyMesh.position.set(0, -0.22, 0.45);
  headGroup.add(bellyMesh);

  // Peitorais (Fins)
  const finGeo = new T.ConeGeometry(0.25, 0.9, 4);
  finGeo.rotateZ(Math.PI / 2);

  const finLGroup = new T.Group();
  finLGroup.position.set(-0.35, -0.1, 0.4);
  const finL = new T.Mesh(finGeo, matFlat(cDark));
  finL.rotation.set(0.2, -0.6, -0.3);
  finLGroup.add(finL);

  const finRGroup = new T.Group();
  finRGroup.position.set(0.35, -0.1, 0.4);
  const finR = new T.Mesh(finGeo, matFlat(cDark));
  finR.rotation.set(0.2, 0.6, 0.3);
  finRGroup.add(finR);

  headGroup.add(finLGroup, finRGroup);
  fins.push({ group: finLGroup, side: -1 }, { group: finRGroup, side: 1 });

  root.add(headGroup);

  // Joint 1: Torso / Dorsal Primária
  const j1 = new T.Group();
  j1.position.z = -0.1;
  const body1Geo = new T.CylinderGeometry(0.42, 0.38, 0.8, 6);
  body1Geo.rotateX(Math.PI / 2);
  const body1Mesh = new T.Mesh(body1Geo, matFlat(cGrey));
  body1Mesh.position.z = -0.4;
  j1.add(body1Mesh);

  // Barbatanas Dorsal principal
  const dFinGeo = new T.ConeGeometry(0.3, 0.85, 4);
  dFinGeo.rotateX(-0.4);
  const dFinMesh = new T.Mesh(dFinGeo, matFlat(cDark));
  dFinMesh.position.set(0, 0.6, -0.3);
  j1.add(dFinMesh);

  headGroup.add(j1);
  joints.push(j1);

  // Joint 2: Abdômen
  const j2 = new T.Group();
  j2.position.z = -0.8;
  const body2Geo = new T.CylinderGeometry(0.38, 0.28, 0.75, 6);
  body2Geo.rotateX(Math.PI / 2);
  const body2Mesh = new T.Mesh(body2Geo, matFlat(cGrey));
  body2Mesh.position.z = -0.375;
  j2.add(body2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3: Cauda Base
  const j3 = new T.Group();
  j3.position.z = -0.75;
  const body3Geo = new T.CylinderGeometry(0.28, 0.16, 0.7, 5);
  body3Geo.rotateX(Math.PI / 2);
  const body3Mesh = new T.Mesh(body3Geo, matFlat(cGrey));
  body3Mesh.position.z = -0.35;
  j3.add(body3Mesh);

  j2.add(j3);
  joints.push(j3);

  // Joint 4: Nadadeira Caudal (Caudal Fin)
  const j4 = new T.Group();
  j4.position.z = -0.7;

  // Lóbulo Superior da cauda de tubarão
  const cFinSupGeo = new T.ConeGeometry(0.2, 1.1, 4);
  cFinSupGeo.rotateX(-0.6);
  const cFinSup = new T.Mesh(cFinSupGeo, matFlat(cDark));
  cFinSup.position.set(0, 0.45, -0.35);

  // Lóbulo Inferior da cauda
  const cFinInfGeo = new T.ConeGeometry(0.14, 0.55, 4);
  cFinInfGeo.rotateX(0.7);
  const cFinInf = new T.Mesh(cFinInfGeo, matFlat(cGrey));
  cFinInf.position.set(0, -0.22, -0.2);

  j4.add(cFinSup, cFinInf);
  j3.add(j4);
  joints.push(j4);

  root.scale.setScalar(1.2);
}

// ----------------------------------------------------------------------------
// 2. ATUM-AZUL (Bluefin Tuna)
// ----------------------------------------------------------------------------
function buildTuna(root, joints, fins) {
  const cBlue = 0x1e3a8a;
  const cSilver = 0xcbd5e1;
  const cYellow = 0xeab308;

  const headGroup = new T.Group();
  const hGeo = new T.ConeGeometry(0.38, 0.8, 6);
  hGeo.rotateX(Math.PI / 2);
  const hMesh = new T.Mesh(hGeo, matFlat(cBlue));
  hMesh.position.z = 0.4;
  headGroup.add(hMesh);

  // Olhos
  const eyeL = new T.Mesh(new T.SphereGeometry(0.06, 5, 4), matFlat(0x0f172a));
  eyeL.position.set(-0.22, 0.05, 0.25);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.22;
  headGroup.add(eyeL, eyeR);

  // Peitorais pequenas e afiadas
  const pFinGeo = new T.BoxGeometry(0.4, 0.04, 0.15);
  const pFinLGroup = new T.Group();
  pFinLGroup.position.set(-0.25, -0.05, 0.2);
  const pFinL = new T.Mesh(pFinGeo, matFlat(cBlue));
  pFinL.rotation.set(0.1, -0.5, -0.2);
  pFinLGroup.add(pFinL);

  const pFinRGroup = new T.Group();
  pFinRGroup.position.set(0.25, -0.05, 0.2);
  const pFinR = new T.Mesh(pFinGeo, matFlat(cBlue));
  pFinR.rotation.set(0.1, 0.5, 0.2);
  pFinRGroup.add(pFinR);

  headGroup.add(pFinLGroup, pFinRGroup);
  fins.push({ group: pFinLGroup, side: -1 }, { group: pFinRGroup, side: 1 });

  root.add(headGroup);

  // Joint 1: Torso bojudo
  const j1 = new T.Group();
  j1.position.z = 0.0;
  const b1Geo = new T.CylinderGeometry(0.45, 0.42, 0.7, 7);
  b1Geo.rotateX(Math.PI / 2);
  const b1Mesh = new T.Mesh(b1Geo, matFlat(cBlue));
  b1Mesh.position.z = -0.35;

  const belly = new T.Mesh(new T.CylinderGeometry(0.42, 0.38, 0.68, 7), matFlat(cSilver));
  belly.position.set(0, -0.08, -0.35);
  belly.scale.set(0.95, 0.8, 1);
  j1.add(b1Mesh, belly);

  headGroup.add(j1);
  joints.push(j1);

  // Joint 2: Corpo posterior
  const j2 = new T.Group();
  j2.position.z = -0.7;
  const b2Geo = new T.CylinderGeometry(0.42, 0.25, 0.65, 6);
  b2Geo.rotateX(Math.PI / 2);
  const b2Mesh = new T.Mesh(b2Geo, matFlat(cBlue));
  b2Mesh.position.z = -0.325;
  j2.add(b2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3: Pedúnculo Caudal com barbatana amarela
  const j3 = new T.Group();
  j3.position.z = -0.65;
  const b3Geo = new T.CylinderGeometry(0.25, 0.1, 0.55, 5);
  b3Geo.rotateX(Math.PI / 2);
  const b3Mesh = new T.Mesh(b3Geo, matFlat(cBlue));
  b3Mesh.position.z = -0.275;
  j3.add(b3Mesh);

  // Pequenos espinhos amarelos (Finlets)
  for (let i = 0; i < 3; i++) {
    const fTop = new T.Mesh(new T.ConeGeometry(0.04, 0.12, 3), matFlat(cYellow));
    fTop.position.set(0, 0.16, -0.1 - i * 0.12);
    const fBot = new T.Mesh(new T.ConeGeometry(0.04, 0.12, 3), matFlat(cYellow));
    fBot.rotation.x = Math.PI;
    fBot.position.set(0, -0.16, -0.1 - i * 0.12);
    j3.add(fTop, fBot);
  }

  j2.add(j3);
  joints.push(j3);

  // Joint 4: Cauda em meia-lua rígida e veloz
  const j4 = new T.Group();
  j4.position.z = -0.55;

  const tailGeo = new T.BoxGeometry(0.05, 0.9, 0.45);
  const tailMesh = new T.Mesh(tailGeo, matFlat(cBlue));
  tailMesh.position.z = -0.2;
  tailMesh.rotation.x = 0.15;
  j4.add(tailMesh);

  j3.add(j4);
  joints.push(j4);

  root.scale.setScalar(1.1);
}

// ----------------------------------------------------------------------------
// 3. DOURADO / MAHI-MAHI
// ----------------------------------------------------------------------------
function buildMahiMahi(root, joints, fins) {
  const cGreen = 0x10b981;
  const cGold = 0xf59e0b;
  const cBlueSpot = 0x06b6d4;

  const headGroup = new T.Group();

  // Testeira alta e reta do Dourado
  const headGeo = new T.BoxGeometry(0.35, 0.75, 0.7);
  const headMesh = new T.Mesh(headGeo, matFlat(cGreen));
  headMesh.position.set(0, 0.1, 0.35);
  headGroup.add(headMesh);

  // Olhos
  const eyeL = new T.Mesh(new T.SphereGeometry(0.07, 5, 4), matFlat(0x0f172a));
  eyeL.position.set(-0.2, 0.15, 0.45);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  headGroup.add(eyeL, eyeR);

  // Peitorais longas amareladas
  const pFinGeo = new T.ConeGeometry(0.12, 0.7, 4);
  pFinGeo.rotateZ(Math.PI / 2);

  const pLGrp = new T.Group();
  pLGrp.position.set(-0.2, -0.15, 0.3);
  const pL = new T.Mesh(pFinGeo, matFlat(cGold));
  pL.rotation.set(0.2, -0.4, -0.3);
  pLGrp.add(pL);

  const pRGrp = new T.Group();
  pRGrp.position.set(0.2, -0.15, 0.3);
  const pR = new T.Mesh(pFinGeo, matFlat(cGold));
  pR.rotation.set(0.2, 0.4, 0.3);
  pRGrp.add(pR);

  headGroup.add(pLGrp, pRGrp);
  fins.push({ group: pLGrp, side: -1 }, { group: pRGrp, side: 1 });

  root.add(headGroup);

  // Crista Dorsal Contínua por todo o corpo
  const makeDorsalSegment = (h, zLen) => {
    const dGeo = new T.BoxGeometry(0.04, h, zLen);
    const dM = new T.Mesh(dGeo, matFlat(cBlueSpot));
    dM.position.set(0, h * 0.5 + 0.3, -zLen * 0.5);
    return dM;
  };

  // Joint 1
  const j1 = new T.Group();
  j1.position.z = 0.0;
  const b1Geo = new T.BoxGeometry(0.32, 0.7, 0.65);
  const b1Mesh = new T.Mesh(b1Geo, matFlat(cGold));
  b1Mesh.position.z = -0.325;
  j1.add(b1Mesh, makeDorsalSegment(0.35, 0.65));

  headGroup.add(j1);
  joints.push(j1);

  // Joint 2
  const j2 = new T.Group();
  j2.position.z = -0.65;
  const b2Geo = new T.BoxGeometry(0.26, 0.55, 0.6);
  const b2Mesh = new T.Mesh(b2Geo, matFlat(cGold));
  b2Mesh.position.z = -0.3;
  j2.add(b2Mesh, makeDorsalSegment(0.28, 0.6));

  j1.add(j2);
  joints.push(j2);

  // Joint 3
  const j3 = new T.Group();
  j3.position.z = -0.6;
  const b3Geo = new T.BoxGeometry(0.18, 0.38, 0.55);
  const b3Mesh = new T.Mesh(b3Geo, matFlat(cGold));
  b3Mesh.position.z = -0.275;
  j3.add(b3Mesh, makeDorsalSegment(0.2, 0.55));

  j2.add(j3);
  joints.push(j3);

  // Joint 4: Cauda bifurcada dourada
  const j4 = new T.Group();
  j4.position.z = -0.55;

  const tailTop = new T.Mesh(new T.ConeGeometry(0.12, 0.8, 4), matFlat(cGold));
  tailTop.rotation.set(-0.5, 0, 0);
  tailTop.position.set(0, 0.3, -0.3);

  const tailBot = new T.Mesh(new T.ConeGeometry(0.1, 0.65, 4), matFlat(cGold));
  tailBot.rotation.set(0.6, 0, 0);
  tailBot.position.set(0, -0.25, -0.25);

  j4.add(tailTop, tailBot);
  j3.add(j4);
  joints.push(j4);

  root.scale.setScalar(1.0);
}

// ----------------------------------------------------------------------------
// 4. PEIXE-VOADOR (Flying Fish)
// ----------------------------------------------------------------------------
function buildFlyingFish(root, joints, fins, wings) {
  const cNavy = 0x0284c7;
  const cSilver = 0xf1f5f9;
  const cWing = 0x7dd3fc;

  const headGroup = new T.Group();
  const hGeo = new T.ConeGeometry(0.18, 0.45, 5);
  hGeo.rotateX(Math.PI / 2);
  const hMesh = new T.Mesh(hGeo, matFlat(cNavy));
  hMesh.position.z = 0.225;
  headGroup.add(hMesh);

  // Asas peitorais imponentes (grandes nadadeiras transientes)
  const wingGeo = new T.BoxGeometry(0.9, 0.02, 0.35);

  const wingLGroup = new T.Group();
  wingLGroup.position.set(-0.1, 0.02, 0.1);
  const wingL = new T.Mesh(wingGeo, matFlat(cWing, 0.85, true));
  wingL.position.x = -0.45;
  wingLGroup.add(wingL);

  const wingRGroup = new T.Group();
  wingRGroup.position.set(0.1, 0.02, 0.1);
  const wingR = new T.Mesh(wingGeo, matFlat(cWing, 0.85, true));
  wingR.position.x = 0.45;
  wingRGroup.add(wingR);

  headGroup.add(wingLGroup, wingRGroup);
  wings.push({ left: wingLGroup, right: wingRGroup });

  root.add(headGroup);

  // Joint 1
  const j1 = new T.Group();
  j1.position.z = 0.0;
  const b1Geo = new T.CylinderGeometry(0.18, 0.14, 0.4, 5);
  b1Geo.rotateX(Math.PI / 2);
  const b1Mesh = new T.Mesh(b1Geo, matFlat(cSilver));
  b1Mesh.position.z = -0.2;
  j1.add(b1Mesh);

  headGroup.add(j1);
  joints.push(j1);

  // Joint 2
  const j2 = new T.Group();
  j2.position.z = -0.4;
  const b2Geo = new T.CylinderGeometry(0.14, 0.08, 0.35, 5);
  b2Geo.rotateX(Math.PI / 2);
  const b2Mesh = new T.Mesh(b2Geo, matFlat(cNavy));
  b2Mesh.position.z = -0.175;
  j2.add(b2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3: Cauda para propulsão
  const j3 = new T.Group();
  j3.position.z = -0.35;
  const tailGeo = new T.BoxGeometry(0.02, 0.35, 0.2);
  const tailMesh = new T.Mesh(tailGeo, matFlat(cNavy));
  tailMesh.position.z = -0.1;
  j3.add(tailMesh);

  j2.add(j3);
  joints.push(j3);

  root.scale.setScalar(1.0);
}

// ----------------------------------------------------------------------------
// 5. ARRAIA-MANTA (Manta Ray)
// ----------------------------------------------------------------------------
function buildMantaRay(root, joints, wings) {
  const cDark = 0x0f172a;
  const cWhite = 0xf8fafc;

  // Corpo central plano
  const bodyGroup = new T.Group();
  const centerGeo = new T.BoxGeometry(0.7, 0.18, 1.2);
  const centerMesh = new T.Mesh(centerGeo, matFlat(cDark));
  bodyGroup.add(centerMesh);

  // Ventral branca
  const bellyMesh = new T.Mesh(new T.BoxGeometry(0.66, 0.04, 1.15), matFlat(cWhite));
  bellyMesh.position.y = -0.09;
  bodyGroup.add(bellyMesh);

  // Lóbulos cefálicos (chifres da boca)
  const hornGeo = new T.ConeGeometry(0.12, 0.4, 4);
  hornGeo.rotateX(Math.PI / 2);
  const hornL = new T.Mesh(hornGeo, matFlat(cDark));
  hornL.position.set(-0.22, 0, 0.75);
  const hornR = hornL.clone();
  hornR.position.x = 0.22;
  bodyGroup.add(hornL, hornR);

  root.add(bodyGroup);

  // ASA ESQUERDA (3 articulações em cadeia)
  const wingL1 = new T.Group();
  wingL1.position.set(-0.35, 0, 0);
  const wL1Mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 1.1), matFlat(cDark));
  wL1Mesh.position.x = -0.35;
  wingL1.add(wL1Mesh);

  const wingL2 = new T.Group();
  wingL2.position.set(-0.7, 0, 0);
  const wL2Mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.08, 0.9), matFlat(cDark));
  wL2Mesh.position.x = -0.35;
  wingL2.add(wL2Mesh);
  wingL1.add(wingL2);

  const wingL3 = new T.Group();
  wingL3.position.set(-0.7, 0, 0);
  const wL3Geo = new T.ConeGeometry(0.4, 0.8, 3);
  wL3Geo.rotateZ(Math.PI / 2);
  const wL3Mesh = new T.Mesh(wL3Geo, matFlat(cDark));
  wL3Mesh.position.x = -0.35;
  wingL3.add(wL3Mesh);
  wingL2.add(wingL3);

  bodyGroup.add(wingL1);

  // ASA DIREITA (3 articulações)
  const wingR1 = new T.Group();
  wingR1.position.set(0.35, 0, 0);
  const wR1Mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 1.1), matFlat(cDark));
  wR1Mesh.position.x = 0.35;
  wingR1.add(wR1Mesh);

  const wingR2 = new T.Group();
  wingR2.position.set(0.7, 0, 0);
  const wR2Mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.08, 0.9), matFlat(cDark));
  wR2Mesh.position.x = 0.35;
  wingR2.add(wR2Mesh);
  wingR1.add(wingR2);

  const wingR3 = new T.Group();
  wingR3.position.set(0.7, 0, 0);
  const wR3Geo = new T.ConeGeometry(0.4, 0.8, 3);
  wR3Geo.rotateZ(-Math.PI / 2);
  const wR3Mesh = new T.Mesh(wR3Geo, matFlat(cDark));
  wR3Mesh.position.x = 0.35;
  wingR3.add(wR3Mesh);
  wingR2.add(wingR3);

  bodyGroup.add(wingR1);

  wings.push(
    { l1: wingL1, l2: wingL2, l3: wingL3 },
    { r1: wingR1, r2: wingR2, r3: wingR3 }
  );

  // Cauda chicote
  const tailJ1 = new T.Group();
  tailJ1.position.z = -0.6;
  const tMesh1 = new T.Mesh(new T.CylinderGeometry(0.06, 0.04, 0.8, 4), matFlat(cDark));
  tMesh1.rotation.x = Math.PI / 2;
  tMesh1.position.z = -0.4;
  tailJ1.add(tMesh1);

  const tailJ2 = new T.Group();
  tailJ2.position.z = -0.8;
  const tMesh2 = new T.Mesh(new T.CylinderGeometry(0.04, 0.01, 1.0, 4), matFlat(cDark));
  tMesh2.rotation.x = Math.PI / 2;
  tMesh2.position.z = -0.5;
  tailJ2.add(tMesh2);
  tailJ1.add(tailJ2);

  bodyGroup.add(tailJ1);
  joints.push(tailJ1, tailJ2);

  root.scale.setScalar(1.3);
}

// ----------------------------------------------------------------------------
// 6. PEIXE-PALHAÇO (Clownfish)
// ----------------------------------------------------------------------------
function buildClownfish(root, joints, fins) {
  const cOrange = 0xea580c;
  const cWhite = 0xffffff;
  const cBlack = 0x18181b;

  const headGroup = new T.Group();
  const hGeo = new T.SphereGeometry(0.28, 6, 5);
  hGeo.scale(0.8, 1.1, 1.1);
  const hMesh = new T.Mesh(hGeo, matFlat(cOrange));
  hMesh.position.z = 0.2;
  headGroup.add(hMesh);

  // Faixa Branca 1
  const stripe1 = new T.Mesh(new T.CylinderGeometry(0.24, 0.25, 0.1, 6), matFlat(cWhite));
  stripe1.rotation.x = Math.PI / 2;
  stripe1.position.z = 0.12;
  headGroup.add(stripe1);

  // Olhos
  const eyeL = new T.Mesh(new T.SphereGeometry(0.05, 5, 4), matFlat(cBlack));
  eyeL.position.set(-0.18, 0.08, 0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  headGroup.add(eyeL, eyeR);

  root.add(headGroup);

  // Joint 1: Torso
  const j1 = new T.Group();
  j1.position.z = -0.05;
  const b1Mesh = new T.Mesh(new T.BoxGeometry(0.26, 0.48, 0.35), matFlat(cOrange));
  b1Mesh.position.z = -0.175;

  const stripe2 = new T.Mesh(new T.BoxGeometry(0.28, 0.5, 0.09), matFlat(cWhite));
  stripe2.position.z = -0.175;
  j1.add(b1Mesh, stripe2);

  headGroup.add(j1);
  joints.push(j1);

  // Joint 2: Abdômen
  const j2 = new T.Group();
  j2.position.z = -0.35;
  const b2Mesh = new T.Mesh(new T.BoxGeometry(0.2, 0.38, 0.3), matFlat(cOrange));
  b2Mesh.position.z = -0.15;
  j2.add(b2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3: Cauda arredondada com borda preta
  const j3 = new T.Group();
  j3.position.z = -0.3;
  const tailGeo = new T.BoxGeometry(0.04, 0.36, 0.25);
  const tailMesh = new T.Mesh(tailGeo, matFlat(cOrange));
  tailMesh.position.z = -0.12;

  const tailBorder = new T.Mesh(new T.BoxGeometry(0.05, 0.38, 0.05), matFlat(cBlack));
  tailBorder.position.z = -0.23;
  j3.add(tailMesh, tailBorder);

  j2.add(j3);
  joints.push(j3);

  root.scale.setScalar(0.9);
}

// ----------------------------------------------------------------------------
// 7. PEIXE-ANJO IMPERADOR (Angelfish)
// ----------------------------------------------------------------------------
function buildAngelfish(root, joints, fins) {
  const cCyan = 0x06b6d4;
  const cYellow = 0xfacc15;
  const cNavy = 0x1e1b4b;

  const headGroup = new T.Group();

  // Disco achatado lateralmente
  const bodyGeo = new T.BoxGeometry(0.12, 0.7, 0.5);
  const bodyMesh = new T.Mesh(bodyGeo, matFlat(cCyan));
  bodyMesh.position.z = 0.25;
  headGroup.add(bodyMesh);

  // Listras amarelas
  for (let i = 0; i < 3; i++) {
    const sM = new T.Mesh(new T.BoxGeometry(0.14, 0.65, 0.06), matFlat(cYellow));
    sM.position.set(0, 0, 0.12 + i * 0.12);
    headGroup.add(sM);
  }

  // Olho com máscara negra
  const mask = new T.Mesh(new T.BoxGeometry(0.15, 0.2, 0.18), matFlat(cNavy));
  mask.position.set(0, 0.1, 0.35);
  const eyeL = new T.Mesh(new T.SphereGeometry(0.04, 5, 4), matFlat(0xffffff));
  eyeL.position.set(-0.08, 0.1, 0.38);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  headGroup.add(mask, eyeL, eyeR);

  root.add(headGroup);

  // Joint 1
  const j1 = new T.Group();
  j1.position.z = 0.0;
  const b1Mesh = new T.Mesh(new T.BoxGeometry(0.1, 0.6, 0.4), matFlat(cCyan));
  b1Mesh.position.z = -0.2;

  // Barbatanas dorsal e anal longas e elegantes
  const dFin = new T.Mesh(new T.ConeGeometry(0.15, 0.6, 3), matFlat(cYellow));
  dFin.rotation.set(-0.6, 0, 0);
  dFin.position.set(0, 0.45, -0.15);

  const aFin = new T.Mesh(new T.ConeGeometry(0.15, 0.6, 3), matFlat(cYellow));
  aFin.rotation.set(0.6, 0, 0);
  aFin.position.set(0, -0.45, -0.15);

  j1.add(b1Mesh, dFin, aFin);
  headGroup.add(j1);
  joints.push(j1);

  // Joint 2
  const j2 = new T.Group();
  j2.position.z = -0.4;
  const b2Mesh = new T.Mesh(new T.BoxGeometry(0.06, 0.35, 0.3), matFlat(cCyan));
  b2Mesh.position.z = -0.15;
  j2.add(b2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3: Cauda em leque
  const j3 = new T.Group();
  j3.position.z = -0.3;
  const tailMesh = new T.Mesh(new T.BoxGeometry(0.03, 0.4, 0.22), matFlat(cYellow));
  tailMesh.position.z = -0.11;
  j3.add(tailMesh);

  j2.add(j3);
  joints.push(j3);

  root.scale.setScalar(0.95);
}

// ----------------------------------------------------------------------------
// 8. MARLIN-AZUL / PEIXE-ESPADA (Swordfish)
// ----------------------------------------------------------------------------
function buildMarlin(root, joints, fins) {
  const cDarkBlue = 0x1e1b4b;
  const cSilver = 0x94a3b8;
  const cSail = 0x312e81;

  const headGroup = new T.Group();

  // Rostro longo (espada / lança)
  const billGeo = new T.ConeGeometry(0.06, 1.2, 5);
  billGeo.rotateX(-Math.PI / 2);
  const billMesh = new T.Mesh(billGeo, matFlat(0x0f172a));
  billMesh.position.z = 1.1;
  headGroup.add(billMesh);

  // Cabeça aerodinâmica
  const hGeo = new T.ConeGeometry(0.35, 0.8, 6);
  hGeo.rotateX(Math.PI / 2);
  const hMesh = new T.Mesh(hGeo, matFlat(cDarkBlue));
  hMesh.position.z = 0.4;
  headGroup.add(hMesh);

  root.add(headGroup);

  // Joint 1: Vela Dorsal principal
  const j1 = new T.Group();
  j1.position.z = 0.0;
  const b1Mesh = new T.Mesh(new T.CylinderGeometry(0.38, 0.32, 0.8, 6), matFlat(cDarkBlue));
  b1Mesh.rotation.x = Math.PI / 2;
  b1Mesh.position.z = -0.4;

  const sailGeo = new T.BoxGeometry(0.04, 0.9, 0.7);
  const sailMesh = new T.Mesh(sailGeo, matFlat(cSail));
  sailMesh.position.set(0, 0.65, -0.35);
  sailMesh.rotation.x = -0.2;

  j1.add(b1Mesh, sailMesh);
  headGroup.add(j1);
  joints.push(j1);

  // Joint 2
  const j2 = new T.Group();
  j2.position.z = -0.8;
  const b2Mesh = new T.Mesh(new T.CylinderGeometry(0.32, 0.22, 0.7, 6), matFlat(cSilver));
  b2Mesh.rotation.x = Math.PI / 2;
  b2Mesh.position.z = -0.35;
  j2.add(b2Mesh);

  j1.add(j2);
  joints.push(j2);

  // Joint 3
  const j3 = new T.Group();
  j3.position.z = -0.7;
  const b3Mesh = new T.Mesh(new T.CylinderGeometry(0.22, 0.12, 0.6, 5), matFlat(cDarkBlue));
  b3Mesh.rotation.x = Math.PI / 2;
  b3Mesh.position.z = -0.3;
  j3.add(b3Mesh);

  j2.add(j3);
  joints.push(j3);

  // Joint 4: Cauda grande em foice
  const j4 = new T.Group();
  j4.position.z = -0.6;

  const tailTop = new T.Mesh(new T.ConeGeometry(0.12, 1.1, 4), matFlat(cDarkBlue));
  tailTop.rotation.set(-0.5, 0, 0);
  tailTop.position.set(0, 0.45, -0.3);

  const tailBot = new T.Mesh(new T.ConeGeometry(0.1, 0.9, 4), matFlat(cDarkBlue));
  tailBot.rotation.set(0.6, 0, 0);
  tailBot.position.set(0, -0.4, -0.25);

  j4.add(tailTop, tailBot);
  j3.add(j4);
  joints.push(j4);

  root.scale.setScalar(1.25);
}

// ============================================================================
// SIMULADOR DE COMPORTAMENTO & ECOSSISTEMA DE PEIXES POR BIOMA
// ============================================================================

// Matriz de Espécies permitidas por Bioma e Profundidade
const BIOME_SPECIES_MAP = {
  // Biomas Tropicais e Arrecifais (Águas Claras e Rasas)
  'Campina florida': ['peixe_palhaco', 'peixe_anjo', 'dourado', 'peixe_voador'],
  'Jardim de cerejeiras': ['peixe_palhaco', 'peixe_anjo', 'dourado', 'peixe_voador'],
  
  // Biomas Rochosos e Costões (Canais, Falésias e Fendas)
  'Costão rochoso': ['arraia', 'tubarao', 'marlin', 'atum'],
  'Pinheiral': ['tubarao', 'marlin', 'atum', 'arraia'],
  
  // Biomas Frios e Temperados (Águas Profundas e Oceano Aberto)
  'Tundra nevada': ['atum', 'tubarao', 'marlin'],
  'Bosque de outono': ['dourado', 'atum', 'peixe_voador', 'arraia'],
  
  // Alto-mar / Oceano Pelágico
  'Mar Aberto': ['tubarao', 'marlin', 'atum', 'dourado', 'peixe_voador', 'arraia']
};

export class FishWorldManager {
  constructor() {
    this.fishList = [];
    this.container = new T.Group();
    this.container.name = 'fish_world_container';
    sc.add(this.container);
  }

  /**
   * Identifica o bioma e profundidade para determinar a espécie ideal
   */
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

    // Em águas rasas de recife, prioriza peixes de coral
    if (isShallow && (biomeName === 'Campina florida' || biomeName === 'Jardim de cerejeiras')) {
      return Math.random() < 0.6 ? 'peixe_palhaco' : 'peixe_anjo';
    }

    const available = BIOME_SPECIES_MAP[biomeName] || BIOME_SPECIES_MAP['Mar Aberto'];
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Popula o oceano distribuindo espécies de forma rara e espaçada por biomas
   */
  spawnEcosystem(centerX = 0, centerZ = 0) {
    this.clearAll();

    // Quantidade reduzida para encontros mais raros e naturais
    const totalFish = 10;
    for (let i = 0; i < totalFish; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = rnd(30, 140);
      const wx = centerX + Math.cos(angle) * dist;
      const wz = centerZ + Math.sin(angle) * dist;

      const speciesId = this.getSpeciesForLocation(wx, wz);
      this.spawnFish(speciesId, wx, wz, centerX, centerZ);
    }
  }

  spawnFish(speciesId, wx, wz, playerX = 0, playerZ = 0) {
    const articulated = createArticulatedFishMesh(speciesId);
    this.container.add(articulated.group);

    // Profundidade natural de submersão no mar
    const baseDepth = speciesId === 'peixe_voador' ? 0.35 :
                      speciesId === 'tubarao' ? 0.55 :
                      speciesId === 'marlin' ? 0.50 :
                      speciesId === 'atum' || speciesId === 'dourado' ? 0.45 :
                      speciesId === 'arraia' ? 0.75 : 0.40;

    const waterY = H(wx, wz);
    // Posição no espaço da cena (relativa ao navio/câmera)
    articulated.group.position.set(wx - playerX, waterY - baseDepth, wz - playerZ);
    articulated.group.rotation.y = Math.random() * Math.PI * 2;

    const fishData = {
      ...articulated,
      wx,
      wz,
      baseDepth,
      heading: Math.random() * Math.PI * 2,
      speed: speciesId === 'tubarao' || speciesId === 'marlin' ? rnd(3.8, 6.5) :
             speciesId === 'atum' ? rnd(4.5, 8.0) :
             speciesId === 'arraia' ? rnd(1.8, 3.0) : rnd(2.2, 4.2),
      animPhase: Math.random() * 100,
      isFlying: false,
      flyTime: 0,
      jumpCooldown: rnd(18, 50),
      jumpDuration: rnd(1.4, 2.4)
    };

    this.fishList.push(fishData);
    return fishData;
  }

  clearAll() {
    this.fishList.forEach(f => {
      this.container.remove(f.group);
    });
    this.fishList = [];
  }

  /**
   * Loop de atualização de animação articulada e física de natação submersa
   */
  update(dt, now, playerX, playerZ) {
    const timeSec = now * 0.001;

    for (let i = 0; i < this.fishList.length; i++) {
      const f = this.fishList[i];
      const { group, joints, wings, speciesId } = f;

      // 1. Manutenção de proximidade: se o peixe afastar-se demais, reposiciona suavemente no horizonte
      const distToPlayer = Math.hypot(f.wx - playerX, f.wz - playerZ);
      if (distToPlayer > 170) {
        const reAngle = ST.hd + rnd(-1.4, 1.4);
        const reDist = rnd(55, 125);
        f.wx = playerX + Math.sin(reAngle) * reDist;
        f.wz = playerZ + Math.cos(reAngle) * reDist;
        f.heading = reAngle + rnd(-0.5, 0.5);

        // Adapta espécie ao novo bioma se necessário
        const newSpecies = this.getSpeciesForLocation(f.wx, f.wz);
        if (newSpecies !== f.speciesId && Math.random() < 0.35) {
          this.container.remove(f.group);
          const newArticulated = createArticulatedFishMesh(newSpecies);
          this.container.add(newArticulated.group);
          f.group = newArticulated.group;
          f.joints = newArticulated.joints;
          f.wings = newArticulated.wings;
          f.speciesId = newSpecies;
        }
      }

      // 2. Movimento Wiggle Articulado (propagação de onda senoidal pela espinha)
      const swimFreq = f.speed * 2.3;
      const phase = timeSec * swimFreq + f.animPhase;

      joints.forEach((jointGroup, jIdx) => {
        const waveAmp = (jIdx + 1) * 0.085;
        jointGroup.rotation.y = Math.sin(phase - jIdx * 0.55) * waveAmp;
      });

      // 3. Articulação das asas (para a Arraia e Peixe-Voador)
      if (speciesId === 'arraia' && wings && wings.length >= 2) {
        const wingFlap = Math.sin(timeSec * 2.4) * 0.4;
        wings[0].l1.rotation.z = wingFlap;
        wings[0].l2.rotation.z = Math.sin(timeSec * 2.4 - 0.3) * 0.3;
        wings[0].l3.rotation.z = Math.sin(timeSec * 2.4 - 0.6) * 0.2;

        wings[1].r1.rotation.z = -wingFlap;
        wings[1].r2.rotation.z = -Math.sin(timeSec * 2.4 - 0.3) * 0.3;
        wings[1].r3.rotation.z = -Math.sin(timeSec * 2.4 - 0.6) * 0.2;
      }

      if (speciesId === 'peixe_voador' && wings && wings.length > 0) {
        if (f.isFlying) {
          wings[0].left.rotation.z = Math.sin(timeSec * 16) * 0.12;
          wings[0].right.rotation.z = -Math.sin(timeSec * 16) * 0.12;
        } else {
          wings[0].left.rotation.z = 0.5 + Math.sin(phase) * 0.08;
          wings[0].right.rotation.z = -0.5 - Math.sin(phase) * 0.08;
        }
      }

      // 4. Lógica de saltos parabólicos raros acima da água
      const canJump = (speciesId === 'peixe_voador' || speciesId === 'atum' || speciesId === 'dourado');
      if (canJump) {
        f.jumpCooldown -= dt;
        if (!f.isFlying && f.jumpCooldown <= 0) {
          f.isFlying = true;
          f.jumpDuration = speciesId === 'peixe_voador' ? rnd(2.0, 3.0) : rnd(1.1, 1.6);
          f.flyTime = f.jumpDuration;
          f.jumpCooldown = rnd(20, 60);
        }

        if (f.isFlying) {
          f.flyTime -= dt;
          const progress = 1 - (f.flyTime / f.jumpDuration);
          const waterY = H(f.wx, f.wz);
          const peakHeight = speciesId === 'peixe_voador' ? 2.2 : 1.4;
          const flyHeight = Math.sin(progress * Math.PI) * peakHeight;
          
          group.position.y = waterY + flyHeight;
          group.rotation.x = -Math.cos(progress * Math.PI) * 0.55;

          if (f.flyTime <= 0) {
            f.isFlying = false;
            group.rotation.x = 0;
          }
        }
      }

      // 5. Atualização da posição no mar (submerso acompanhando a altura da onda H)
      if (!f.isFlying) {
        const waterY = H(f.wx, f.wz);
        const targetY = waterY - f.baseDepth;
        group.position.y += (targetY - group.position.y) * dt * 5.0;

        // Curvatura suave e desvio ao nadar
        f.heading += Math.sin(timeSec * 0.35 + f.animPhase) * dt * 0.22;
        group.rotation.y = f.heading;
        group.rotation.z = Math.sin(phase) * 0.07;
        group.rotation.x = 0;
      }

      // Avançar na direção do rumo
      const moveSpd = f.isFlying ? f.speed * 1.7 : f.speed;
      f.wx += Math.sin(f.heading) * moveSpd * dt;
      f.wz += Math.cos(f.heading) * moveSpd * dt;

      // Posição no espaço relativo da cena (Three.js origin no barco)
      group.position.x = f.wx - playerX;
      group.position.z = f.wz - playerZ;
    }
  }
}

export const fishManager = new FishWorldManager();

