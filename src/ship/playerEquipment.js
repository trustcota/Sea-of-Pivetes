import * as THREE from 'three';
import { cam } from '../core/renderer.js';
import { CAM, GAME, PL } from '../core/state.js';
import { Audio } from '../core/audio.js';

const T = THREE;

// Materiais reutilizáveis estilo náutico
const matGold = new T.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.8 });
const matIron = new T.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.6, metalness: 0.6 });
const matDark = new T.MeshStandardMaterial({ color: 0x1f1915, roughness: 0.8 });
const matLeather = new T.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.7 });
const matLens = new T.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.65 });

export class PlayerEquipment {
  constructor() {
    this.lanternGroup = null;
    this.lanternLight = null;
    this.lanternGlassMat = null;
    this.lanternMode = 'belt'; // 'belt' (guardada no cinto) ou 'hand' (na mão)
    this.lanternOn = false;

    this.spyglassGroup = null;
    this.spyglassEquipped = false;
    this.spyglassActive = false;

    this.flickerTimer = 0;
    this.swayTime = 0;
    this.overlayEl = null;

    // Alvos de posicionamento relativo à câmera (em FPV)
    this.posLanternHand = new T.Vector3(-0.30, -0.22, -0.52);
    this.posLanternBelt = new T.Vector3(-0.25, -0.42, -0.22);
    this.posSpyglassRest = new T.Vector3(0.26, -0.22, -0.48);
  }

  init() {
    this.overlayEl = document.getElementById('spyglass-overlay');
    this.buildLantern();
    this.buildSpyglass();

    window.addEventListener('contextmenu', (e) => {
      if (this.spyglassEquipped && CAM.fpv && GAME.state === 'PLAY') {
        e.preventDefault();
        this.toggleSpyglassAim();
      }
    });
  }

  buildLantern() {
    this.lanternGroup = new T.Group();
    this.lanternGroup.name = 'player_lantern';
    this.lanternGroup.visible = false;

    // Base metálica dourada com aro de ferro
    const b1 = new T.Mesh(new T.CylinderGeometry(0.065, 0.05, 0.025, 8), matGold);
    b1.position.y = -0.10;
    this.lanternGroup.add(b1);

    const b2 = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.015, 8), matIron);
    b2.position.y = -0.08;
    this.lanternGroup.add(b2);

    // Vidro brilhante da lanterna
    this.lanternGlassMat = new T.MeshStandardMaterial({
      color: 0x221105,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    const glass = new T.Mesh(new T.CylinderGeometry(0.052, 0.052, 0.12, 6), this.lanternGlassMat);
    glass.position.y = -0.01;
    this.lanternGroup.add(glass);

    // Varetas verticais de proteção em ferro
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const rx = Math.cos(a) * 0.054;
      const rz = Math.sin(a) * 0.054;
      const rib = new T.Mesh(new T.CylinderGeometry(0.003, 0.003, 0.12, 4), matIron);
      rib.position.set(rx, -0.01, rz);
      this.lanternGroup.add(rib);
    }

    // Topo cônico dourado
    const topCap = new T.Mesh(new T.CylinderGeometry(0.002, 0.065, 0.055, 8), matGold);
    topCap.position.y = 0.075;
    this.lanternGroup.add(topCap);

    // Argola superior de ferro/ouro para transporte
    const ring = new T.Mesh(new T.TorusGeometry(0.024, 0.005, 4, 12), matGold);
    ring.position.y = 0.115;
    this.lanternGroup.add(ring);

    // Ponto de luz quente dinâmico
    this.lanternLight = new T.PointLight(0xffaa44, 0, 16);
    this.lanternLight.position.set(0, -0.01, 0);
    this.lanternGroup.add(this.lanternLight);

    cam.add(this.lanternGroup);
  }

  buildSpyglass() {
    this.spyglassGroup = new T.Group();
    this.spyglassGroup.name = 'player_spyglass';
    this.spyglassGroup.visible = false;

    // Tubo principal telescópico (latão polido + empunhadura em couro)
    const tube1 = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.18, 12), matGold);
    tube1.rotation.x = Math.PI / 2;
    this.spyglassGroup.add(tube1);

    const grip = new T.Mesh(new T.CylinderGeometry(0.0275, 0.0275, 0.10, 12), matLeather);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.01;
    this.spyglassGroup.add(grip);

    // Tubo intermediário (mais fino, estendido para frente)
    const tube2 = new T.Mesh(new T.CylinderGeometry(0.021, 0.021, 0.16, 12), matGold);
    tube2.rotation.x = Math.PI / 2;
    tube2.position.z = -0.12;
    this.spyglassGroup.add(tube2);

    // Tubo frontal com anel chanfrado
    const tube3 = new T.Mesh(new T.CylinderGeometry(0.017, 0.017, 0.12, 12), matGold);
    tube3.rotation.x = Math.PI / 2;
    tube3.position.z = -0.22;
    this.spyglassGroup.add(tube3);

    const rim = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.02, 12), matGold);
    rim.rotation.x = Math.PI / 2;
    rim.position.z = -0.28;
    this.spyglassGroup.add(rim);

    // Lente de cristal
    const lens = new T.Mesh(new T.CircleGeometry(0.018, 12), matLens);
    lens.position.z = -0.285;
    this.spyglassGroup.add(lens);

    // Ocular traseira
    const eyepiece = new T.Mesh(new T.CylinderGeometry(0.020, 0.024, 0.02, 12), matDark);
    eyepiece.rotation.x = Math.PI / 2;
    eyepiece.position.z = 0.10;
    this.spyglassGroup.add(eyepiece);

    cam.add(this.spyglassGroup);
  }

  setLanternMode(mode) {
    this.lanternMode = (mode === 'hand') ? 'hand' : 'belt';
    this.applyLanternVisuals();
    try { Audio.play('click'); } catch (_) {}
  }

  toggleLanternPower() {
    this.lanternOn = !this.lanternOn;
    this.applyLanternVisuals();
    try { Audio.play('click'); } catch (_) {}
  }

  applyLanternVisuals() {
    if (!this.lanternGroup) return;

    const isEquipped = (this.lanternMode === 'hand' || this.lanternMode === 'belt') && CAM.fpv && GAME.state === 'PLAY';
    this.lanternGroup.visible = isEquipped;

    if (this.lanternOn && isEquipped) {
      this.lanternLight.intensity = 1.35;
      this.lanternGlassMat.color.setHex(0xffaa44);
      this.lanternGlassMat.emissive.setHex(0xffaa44);
      this.lanternGlassMat.emissiveIntensity = 0.95;
    } else {
      this.lanternLight.intensity = 0;
      this.lanternGlassMat.color.setHex(0x221105);
      this.lanternGlassMat.emissive.setHex(0x000000);
      this.lanternGlassMat.emissiveIntensity = 0.0;
    }
  }

  toggleSpyglass() {
    if (!CAM.fpv) return;
    if (this.spyglassActive || this.spyglassEquipped) {
      this.spyglassEquipped = false;
      this.spyglassActive = false;
    } else {
      this.spyglassEquipped = true;
      this.spyglassActive = true;
    }
    this.applySpyglassVisuals();
    try { Audio.play('click'); } catch (_) {}
  }

  toggleSpyglassAim() {
    if (!this.spyglassEquipped || !CAM.fpv) return;
    this.spyglassActive = !this.spyglassActive;
    this.applySpyglassVisuals();
    try { Audio.play('click'); } catch (_) {}
  }

  applySpyglassVisuals() {
    const isZooming = this.spyglassActive && CAM.fpv && GAME.state === 'PLAY';
    if (this.overlayEl) {
      this.overlayEl.classList.toggle('active', isZooming);
    }
    if (this.spyglassGroup) {
      // Quando olhando pela lente (zoom ativo), a malha 3D fica OCULTA para não atrapalhar
      // o círculo visual da lente! Quando abaixada na mão direita, fica visível na mão.
      if (isZooming) {
        this.spyglassGroup.visible = false;
      } else if (this.spyglassEquipped && CAM.fpv && GAME.state === 'PLAY') {
        this.spyglassGroup.visible = true;
      } else {
        this.spyglassGroup.visible = false;
      }
    }
  }

  isSpyglassActive() {
    return this.spyglassActive && CAM.fpv && GAME.state === 'PLAY';
  }

  update(dt, t) {
    if (GAME.state !== 'PLAY' || !CAM.fpv) {
      if (this.lanternGroup) this.lanternGroup.visible = false;
      if (this.spyglassGroup) this.spyglassGroup.visible = false;
      if (this.spyglassActive) {
        this.spyglassActive = false;
        if (this.overlayEl) this.overlayEl.classList.remove('active');
      }
      return;
    }

    this.swayTime += dt * 3.2;

    // --- LANTERNA ---
    if (this.lanternGroup && (this.lanternMode === 'hand' || this.lanternMode === 'belt')) {
      this.lanternGroup.visible = true;

      const targetPos = this.lanternMode === 'hand' ? this.posLanternHand : this.posLanternBelt;
      const isMoving = Math.abs(PL.vx || 0) > 0.1 || Math.abs(PL.vz || 0) > 0.1;
      const bobY = isMoving ? Math.sin(this.swayTime * 2) * 0.014 : Math.sin(this.swayTime * 0.6) * 0.005;
      const bobX = isMoving ? Math.cos(this.swayTime) * 0.010 : 0;

      this.lanternGroup.position.set(
        targetPos.x + bobX,
        targetPos.y + bobY,
        targetPos.z
      );

      // Balanço natural pendular da lanterna
      const swayRot = isMoving ? Math.sin(this.swayTime) * 0.12 : Math.sin(this.swayTime * 0.5) * 0.04;
      this.lanternGroup.rotation.set(
        swayRot * 0.6,
        0,
        -swayRot * 0.8
      );

      // Cintilação orgânica sutil da chama
      if (this.lanternOn) {
        this.flickerTimer += dt * 12;
        const flicker = Math.sin(this.flickerTimer) * 0.08 + Math.cos(this.flickerTimer * 2.3) * 0.05;
        this.lanternLight.intensity = Math.max(0.8, 1.35 + flicker);
      }
    } else if (this.lanternGroup) {
      this.lanternGroup.visible = false;
    }

    // --- LUNETA ---
    if (this.spyglassGroup) {
      if (this.spyglassActive) {
        // Ao olhar através da lente óptica com a moldura amarela, a malha 3D fica 100% invisível
        // garantindo campo visual limpo e sem a ponta da luneta invadindo o círculo!
        this.spyglassGroup.visible = false;
      } else if (this.spyglassEquipped) {
        // Quando abaixada, é empunhada naturalmente na mão direita
        this.spyglassGroup.visible = true;
        const isMoving = Math.abs(PL.vx || 0) > 0.1 || Math.abs(PL.vz || 0) > 0.1;
        const bobY = isMoving ? Math.sin(this.swayTime * 2) * 0.012 : Math.sin(this.swayTime * 0.6) * 0.004;
        const bobX = isMoving ? Math.cos(this.swayTime) * 0.008 : 0;
        this.spyglassGroup.position.set(
          this.posSpyglassRest.x + bobX,
          this.posSpyglassRest.y + bobY,
          this.posSpyglassRest.z
        );
        this.spyglassGroup.rotation.set(-0.25, -0.15, 0.1);
      } else {
        this.spyglassGroup.visible = false;
      }
    }
  }
}

export const playerEquipment = new PlayerEquipment();
if (typeof window !== 'undefined') {
  window.playerEquipment = playerEquipment;
}
