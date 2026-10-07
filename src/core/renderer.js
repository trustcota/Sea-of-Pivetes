import * as THREE from 'three';

export const R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;

export const sc = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(60, 1, .5, 2500);
R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
document.body.prepend(R.domElement);
export const sky = new THREE.Color();
export const sunL = new THREE.DirectionalLight(0xfff0d0, 1);
sunL.castShadow = true;
sunL.shadow.mapSize.width = 1024;
sunL.shadow.mapSize.height = 1024;
sunL.shadow.camera.near = 1;
sunL.shadow.camera.far = 250;
sunL.shadow.camera.left = -55;
sunL.shadow.camera.right = 55;
sunL.shadow.camera.top = 55;
sunL.shadow.camera.bottom = -55;
sunL.shadow.bias = -0.0004;

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
  R.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
