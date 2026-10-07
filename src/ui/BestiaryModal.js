import * as THREE from 'three';
import { FISH_SPECIES, swim, createArticulatedFishMesh } from '../world/fish.js';
import { GAME } from '../core/state.js';

const T = THREE;

export class BestiaryModal {
  constructor() {
    this.modalEl = null;
    this.canvasEl = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    
    this.discoveredIndices = []; 
    this.currentPageIndex = 0; // 0: Intro, 1: Summary, 2+: Species
    
    this.currentMeshObj = null;
    this.animReqId = null;
    this.animTime = 0;

    this.pages = []; // Estrutura de páginas: [{type: 'intro'}, {type: 'summary'}, {type: 'creature', speciesIdx: N}]
  }

  init() {
    this.modalEl = document.getElementById('bestiary-modal');
    this.canvasEl = document.getElementById('bestiary-canvas');

    if (!this.modalEl || !this.canvasEl) return;

    const btnClose = document.getElementById('btn-close-bestiary');
    const btnPrev = document.getElementById('bestiary-prev');
    const btnNext = document.getElementById('bestiary-next');

    if (btnClose) btnClose.onclick = () => this.close();
    if (btnPrev) btnPrev.onclick = () => this.prevPage();
    if (btnNext) btnNext.onclick = () => this.nextPage();

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvasEl,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(400, 350, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(40, 400 / 350, 0.1, 100);

    const hemiLight = new T.HemisphereLight(0xffffff, 0x5c4a33, 1.2);
    const dirLight = new T.DirectionalLight(0xfff0d0, 1.0);
    dirLight.position.set(5, 8, 5);
    this.scene.add(hemiLight, dirLight);
  }

  buildPages() {
    this.pages = [{ type: 'intro' }, { type: 'summary' }];
    this.discoveredIndices = [];
    
    FISH_SPECIES.forEach((sp, idx) => {
      if (GAME.discoveredSpecies.includes(sp.raw.id)) {
        this.discoveredIndices.push(idx);
        this.pages.push({ type: 'creature', speciesIdx: idx });
      }
    });
  }

  open() {
    if (!this.modalEl) this.init();
    if (!this.modalEl) return;
    
    this.buildPages();
    this.modalEl.style.display = 'flex';
    this.currentPageIndex = 0;
    this.renderPage();

    let lastNow = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - lastNow) / 1000;
      lastNow = now;
      this.animTime += dt;

      if (this.currentMeshObj) {
        swim(this.currentMeshObj.fishObj, this.animTime, 1, 1);
        this.currentMeshObj.group.rotation.y = Math.sin(this.animTime * 0.5) * 0.3;
      }

      this.camera.position.set(0, 0.5, 4.5);
      this.camera.lookAt(0, 0, 0);

      this.renderer.render(this.scene, this.camera);
      this.animReqId = requestAnimationFrame(loop);
    };

    if (this.animReqId) cancelAnimationFrame(this.animReqId);
    this.animReqId = requestAnimationFrame(loop);
  }

  renderPage() {
    const page = this.pages[this.currentPageIndex];
    
    // Elementos de conteúdo
    const elIntro = document.getElementById('bestiary-intro-content');
    const elSummary = document.getElementById('bestiary-summary-content');
    const elSpecies = document.getElementById('bestiary-species-content');
    const elPageNum = document.getElementById('bestiary-page-num');
    const btnPrev = document.getElementById('bestiary-prev');
    const btnNext = document.getElementById('bestiary-next');

    // Esconde tudo primeiro
    if (elIntro) elIntro.style.display = 'none';
    if (elSummary) elSummary.style.display = 'none';
    if (elSpecies) elSpecies.style.display = 'none';
    
    if (this.currentMeshObj) {
      this.scene.remove(this.currentMeshObj.group);
      this.currentMeshObj = null;
    }

    if (page.type === 'intro') {
      if (elIntro) elIntro.style.display = 'flex';
      if (elPageNum) elPageNum.textContent = 'Prólogo';
    } 
    else if (page.type === 'summary') {
      if (elSummary) elSummary.style.display = 'flex';
      if (elPageNum) elPageNum.textContent = 'Sumário';
      this.renderSummary();
    } 
    else if (page.type === 'creature') {
      if (elSpecies) elSpecies.style.display = 'flex';
      this.showCreature(page.speciesIdx);
      if (elPageNum) elPageNum.textContent = `Pág. ${this.currentPageIndex - 1}`;
    }

    // Botões
    if (btnPrev) btnPrev.disabled = this.currentPageIndex === 0;
    if (btnNext) btnNext.disabled = this.currentPageIndex === this.pages.length - 1;
  }

  renderSummary() {
    const list = document.getElementById('bestiary-summary-list');
    if (!list) return;
    list.innerHTML = '';

    FISH_SPECIES.forEach((sp, idx) => {
      const isDiscovered = GAME.discoveredSpecies.includes(sp.raw.id);
      const item = document.createElement('div');
      item.className = `summary-item ${isDiscovered ? '' : 'locked'}`;
      
      const name = isDiscovered ? sp.name : 'Espécie Desconhecida';
      const pageNum = isDiscovered ? (this.pages.findIndex(p => p.speciesIdx === idx) - 1) : '??';

      item.innerHTML = `
        <span class="summary-name">${idx + 1}. ${name}</span>
        <span class="summary-dots"></span>
        <span class="summary-page">${pageNum}</span>
      `;

      if (isDiscovered) {
        item.onclick = () => {
          this.currentPageIndex = this.pages.findIndex(p => p.speciesIdx === idx);
          this.renderPage();
        };
      }
      list.appendChild(item);
    });
  }

  showCreature(speciesIdx) {
    const sp = FISH_SPECIES[speciesIdx];
    if (!sp) return;

    const elName = document.getElementById('bestiary-name');
    const elSci = document.getElementById('bestiary-sci');
    const elCat = document.getElementById('bestiary-cat');
    const elSize = document.getElementById('bestiary-size');
    const elHab = document.getElementById('bestiary-hab');
    const elDesc = document.getElementById('bestiary-desc');

    if (elName) elName.textContent = sp.name;
    if (elSci) elSci.textContent = sp.scientificName;
    if (elCat) elCat.textContent = `Categoria: ${sp.category}`;
    if (elSize) elSize.textContent = `Porte: ${sp.sizeRange}`;
    if (elHab) elHab.textContent = `Habitat: ${sp.habitat}`;
    if (elDesc) elDesc.textContent = sp.desc;

    this.currentMeshObj = createArticulatedFishMesh(sp.id);
    this.scene.add(this.currentMeshObj.group);
  }

  nextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
      this.renderPage();
    }
  }

  prevPage() {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.renderPage();
    }
  }

  close() {
    this.modalEl.style.display = 'none';
    if (this.animReqId) {
      cancelAnimationFrame(this.animReqId);
      this.animReqId = null;
    }
  }
}

export const bestiaryModal = new BestiaryModal();
