import * as THREE from 'three';
import { FISH_SPECIES, createArticulatedFishMesh, fishManager } from '../world/fish.js';
import { ST } from '../core/state.js';

const T = THREE;

export class FishViewerModal {
  constructor() {
    this.modalEl = null;
    this.canvasEl = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.currentMeshObj = null;
    this.currentSpeciesId = 'tubarao';
    this.animSpeed = 1.0;
    this.showWireframe = false;
    this.animReqId = null;
    this.animTime = 0;
    this.camYaw = 0.5;
    this.camPitch = 0.2;
    this.camDist = 4.5;
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
  }

  init() {
    this.modalEl = document.getElementById('fish-modal');
    this.canvasEl = document.getElementById('fish-preview-canvas');

    if (!this.modalEl || !this.canvasEl) return;

    // Conecta botões de abrir/fechar
    const btnClose = document.getElementById('btn-close-fish-modal');
    if (btnClose) {
      btnClose.onclick = () => this.close();
    }

    const btnOpenHud = document.getElementById('btn-open-fish-hud');
    if (btnOpenHud) {
      btnOpenHud.onclick = () => this.open();
    }

    const btnOpenTitle = document.getElementById('btn-open-fish-title');
    if (btnOpenTitle) {
      btnOpenTitle.onclick = () => this.open();
    }

    // Inicializa WebGL Renderer local para a inspeção 3D do peixe
    const width = 480;
    const height = 360;
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvasEl,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(45, width / height, 0.1, 100);

    // Luzes da cena de inspeção 3D
    const hemiLight = new T.HemisphereLight(0x38bdf8, 0x0f172a, 1.2);
    const dirLight = new T.DirectionalLight(0xfff0d0, 1.5);
    dirLight.position.set(5, 8, 5);
    this.scene.add(hemiLight, dirLight);

    // Controles de rotação com mouse/toque no canvas
    this.canvasEl.onpointerdown = (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.canvasEl.setPointerCapture(e.pointerId);
    };

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.camYaw -= dx * 0.01;
      this.camPitch = Math.max(-1.1, Math.min(1.1, this.camPitch + dy * 0.01));
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    this.canvasEl.onwheel = (e) => {
      this.camDist = Math.max(2.0, Math.min(8.0, this.camDist + e.deltaY * 0.005));
      e.preventDefault();
    };

    // Monta a lista de espécies na barra lateral
    this.renderSpeciesGrid();

    // Controles da UI
    const wireBtn = document.getElementById('fish-wireframe-toggle');
    if (wireBtn) {
      wireBtn.onclick = () => {
        this.showWireframe = !this.showWireframe;
        wireBtn.classList.toggle('on', this.showWireframe);
        this.applyWireframeState();
      };
    }

    const speedSlider = document.getElementById('fish-speed-slider');
    const speedVal = document.getElementById('fish-speed-val');
    if (speedSlider) {
      speedSlider.oninput = () => {
        this.animSpeed = parseFloat(speedSlider.value);
        if (speedVal) speedVal.textContent = this.animSpeed.toFixed(1) + 'x';
      };
    }
  }

  renderSpeciesGrid() {
    const container = document.getElementById('fish-species-list');
    if (!container) return;

    container.innerHTML = '';
    FISH_SPECIES.forEach(sp => {
      const btn = document.createElement('button');
      btn.className = `fish-species-btn ${sp.id === this.currentSpeciesId ? 'active' : ''}`;
      btn.setAttribute('data-species', sp.id);
      btn.innerHTML = `
        <span class="fish-sp-dot" style="background:${sp.colorTheme}"></span>
        <div class="fish-sp-info">
          <div class="fish-sp-title">${sp.name}</div>
          <div class="fish-sp-sub">${sp.jointsCount} Articulações · ${sp.sizeRange}</div>
        </div>
      `;
      btn.onclick = () => this.selectSpecies(sp.id);
      container.appendChild(btn);
    });
  }

  selectSpecies(speciesId) {
    this.currentSpeciesId = speciesId;

    // Atualiza botões ativos
    document.querySelectorAll('.fish-species-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-species') === speciesId);
    });

    // Remove modelo atual
    if (this.currentMeshObj) {
      this.scene.remove(this.currentMeshObj.group);
      this.currentMeshObj = null;
    }

    // Cria novo modelo articulado
    this.currentMeshObj = createArticulatedFishMesh(speciesId);
    this.scene.add(this.currentMeshObj.group);

    // Ajusta câmera pelo tamanho do peixe
    const sp = FISH_SPECIES.find(s => s.id === speciesId);
    this.camDist = speciesId === 'arraia' || speciesId === 'marlin' ? 5.5 : 3.8;

    this.applyWireframeState();
    this.updateInfoCard(sp);
  }

  applyWireframeState() {
    if (!this.currentMeshObj) return;
    this.currentMeshObj.group.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = this.showWireframe);
        } else {
          child.material.wireframe = this.showWireframe;
        }
      }
    });
  }

  updateInfoCard(sp) {
    if (!sp) return;

    const elTitle = document.getElementById('fish-card-title');
    const elSci = document.getElementById('fish-card-sci');
    const elCat = document.getElementById('fish-card-cat');
    const elSize = document.getElementById('fish-card-size');
    const elHab = document.getElementById('fish-card-hab');
    const elSpeed = document.getElementById('fish-card-speed');
    const elJoints = document.getElementById('fish-card-joints');
    const elDesc = document.getElementById('fish-card-desc');

    if (elTitle) elTitle.textContent = sp.name;
    if (elSci) elSci.textContent = sp.scientificName;
    if (elCat) elCat.textContent = sp.category;
    if (elSize) elSize.textContent = sp.sizeRange;
    if (elHab) elHab.textContent = sp.habitat;
    if (elSpeed) elSpeed.textContent = sp.speedText;
    if (elJoints) elJoints.textContent = `${sp.jointsCount} Nós Articulados`;
    if (elDesc) elDesc.textContent = sp.desc;
  }

  open() {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'flex';
    this.selectSpecies(this.currentSpeciesId);

    // Inicia loop de renderização do preview
    let lastNow = performance.now();
    const loopPreview = () => {
      const now = performance.now();
      const dt = (now - lastNow) / 1000;
      lastNow = now;

      this.animTime += dt * this.animSpeed;

      // Anima articulações do peixe em exibição
      if (this.currentMeshObj) {
        const { group, joints, wings } = this.currentMeshObj;
        const phase = this.animTime * 6.0;

        joints.forEach((j, idx) => {
          j.rotation.y = Math.sin(phase - idx * 0.5) * (idx + 1) * 0.09;
        });

        if (this.currentSpeciesId === 'arraia' && wings.length >= 2) {
          const wingFlap = Math.sin(this.animTime * 3.0) * 0.4;
          wings[0].l1.rotation.z = wingFlap;
          wings[0].l2.rotation.z = Math.sin(this.animTime * 3.0 - 0.3) * 0.3;
          wings[0].l3.rotation.z = Math.sin(this.animTime * 3.0 - 0.6) * 0.2;

          wings[1].r1.rotation.z = -wingFlap;
          wings[1].r2.rotation.z = -Math.sin(this.animTime * 3.0 - 0.3) * 0.3;
          wings[1].r3.rotation.z = -Math.sin(this.animTime * 3.0 - 0.6) * 0.2;
        }

        group.rotation.y = Math.sin(this.animTime * 1.5) * 0.15;
      }

      // Atualiza posição da câmera orbital da inspeção
      const cx = Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
      const cy = Math.sin(this.camPitch) * this.camDist;
      const cz = Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;

      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(0, 0, 0);

      this.renderer.render(this.scene, this.camera);
      this.animReqId = requestAnimationFrame(loopPreview);
    };

    if (this.animReqId) cancelAnimationFrame(this.animReqId);
    this.animReqId = requestAnimationFrame(loopPreview);

    this.updateRadarInfo();
  }

  updateRadarInfo() {
    const radarEl = document.getElementById('fish-radar-info');
    if (!radarEl) return;

    if (fishManager.fishList.length === 0) {
      radarEl.textContent = 'Sem cardumes detectados na área imediata.';
      return;
    }

    // Calcula peixe selvagem mais próximo do navio
    let minDist = 9999;
    let closestFish = null;

    fishManager.fishList.forEach(f => {
      const d = Math.hypot(f.group.position.x - ST.px, f.group.position.z - ST.pz);
      if (d < minDist) {
        minDist = d;
        closestFish = f;
      }
    });

    if (closestFish) {
      const sp = FISH_SPECIES.find(s => s.id === closestFish.speciesId);
      radarEl.innerHTML = `📡 <b>Radar Fauna:</b> ${sp ? sp.name : 'Peixe'} detectado a <b>${Math.round(minDist)} metros</b> da proa!`;
    }
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'none';
    if (this.animReqId) {
      cancelAnimationFrame(this.animReqId);
      this.animReqId = null;
    }
  }
}

export const fishViewerModal = new FishViewerModal();
