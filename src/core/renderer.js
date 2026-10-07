import * as THREE from 'three';

export const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;

export const R = new THREE.WebGLRenderer({
  antialias: !isMobile,
  powerPreference: 'high-performance',
  desynchronized: true,
  alpha: false,
  stencil: false,
  depth: true
});

R.shadowMap.enabled = true;
R.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

export const sc = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(60, 1, .5, 2500);

const maxDPR = isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 1.5);
R.setPixelRatio(maxDPR);
document.body.prepend(R.domElement);

export const sky = new THREE.Color();
export const sunL = new THREE.DirectionalLight(0xfff0d0, 1);
sunL.castShadow = true;
sunL.shadow.mapSize.width = isMobile ? 512 : 1024;
sunL.shadow.mapSize.height = isMobile ? 512 : 1024;
sunL.shadow.camera.near = 1;
sunL.shadow.camera.far = 250;
sunL.shadow.camera.left = -50;
sunL.shadow.camera.right = 50;
sunL.shadow.camera.top = 50;
sunL.shadow.camera.bottom = -50;
sunL.shadow.bias = isMobile ? -0.0008 : -0.0004;

export const hemi = new THREE.HemisphereLight(0xffffff, 0x1b5a78, .6);
export const fLight = new THREE.DirectionalLight(0xcfe0ff, 0);
sunL.position.set(-70, 35, -50);
sc.add(sunL.target);
fLight.position.set(20, 60, 30);
sc.background = sky;
sc.fog = new THREE.FogExp2(0xffffff, .014);
sc.add(sunL, hemi, fLight);

export const cv = R.domElement;

export function resize() {
  const dpr = isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 1.5);
  R.setPixelRatio(dpr);
  R.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
