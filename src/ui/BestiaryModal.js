import * as THREE from 'three';
import { FISH_SPECIES, swim, createArticulatedFishMesh } from '../world/fish.js';
import { GAME, CAM } from '../core/state.js';
import { cv } from '../core/renderer.js';

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
    this.lastScrollTime = 0; // Cooldown para o scroll
    this.scrollCooldown = 400; // ms

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

    // Handler global para Scroll (Roda do mouse) - Funciona mesmo com Pointer Lock
    window.addEventListener('wheel', (e) => {
      if (!this.modalEl || this.modalEl.style.display !== 'flex') return;
      
      const now = Date.now();
      if (now - this.lastScrollTime < this.scrollCooldown) return;
      if (Math.abs(e.deltaY) < 5) return; 

      if (e.deltaY > 0) this.nextPage();
      else this.prevPage();
      
      this.lastScrollTime = now;
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });

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
    this.pages = [{ type: 'intro' }];
    
    // Filtra apenas as espécies descobertas
    const discovered = FISH_SPECIES.filter(sp => GAME.discoveredSpecies.includes(sp.raw.id));
    
    // Calcula quantas páginas de sumário são necessárias (8 itens por página para não apertar)
    const itemsPerPage = 8;
    const numSummaryPages = Math.max(1, Math.ceil(discovered.length / itemsPerPage));
    
    for (let i = 0; i < numSummaryPages; i++) {
      this.pages.push({ 
        type: 'summary', 
        summaryPageIdx: i,
        items: discovered.slice(i * itemsPerPage, (i + 1) * itemsPerPage) 
      });
    }
    
    // Adiciona as páginas de detalhes das criaturas
    discovered.forEach((sp) => {
      const originalIdx = FISH_SPECIES.findIndex(s => s.id === sp.id);
      this.pages.push({ type: 'creature', speciesIdx: originalIdx });
    });
  }

  open() {
    if (!this.modalEl) this.init();
    if (!this.modalEl) return;
    
    // Libera o mouse para permitir clicar no sumário
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (_) {}
    }

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
    if (!page) return;
    
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
      if (elPageNum) elPageNum.textContent = `Sumário (${page.summaryPageIdx + 1})`;
      this.renderSummary(page.items);
    } 
    else if (page.type === 'creature') {
      if (elSpecies) elSpecies.style.display = 'flex';
      this.showCreature(page.speciesIdx);
      // Calcula o número da página baseada em quantas páginas de intro/summary existem
      const introSummaryCount = this.pages.filter(p => p.type === 'intro' || p.type === 'summary').length;
      if (elPageNum) elPageNum.textContent = `Pág. ${this.currentPageIndex - introSummaryCount + 1}`;
    }

    // Botões
    if (btnPrev) btnPrev.disabled = this.currentPageIndex === 0;
    if (btnNext) btnNext.disabled = this.currentPageIndex === this.pages.length - 1;
  }

  renderSummary(items) {
    const list = document.getElementById('bestiary-summary-list');
    if (!list) return;
    list.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'summary-item locked';
      empty.innerHTML = '<span class="summary-name">Nenhuma descoberta registrada...</span>';
      list.appendChild(empty);
      return;
    }

    items.forEach((sp) => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      
      // Encontra a página real da criatura
      const targetPageIndex = this.pages.findIndex(p => p.type === 'creature' && p.speciesIdx === FISH_SPECIES.findIndex(s => s.id === sp.id));
      const introSummaryCount = this.pages.filter(p => p.type === 'intro' || p.type === 'summary').length;
      const displayPageNum = targetPageIndex - introSummaryCount + 1;

      item.innerHTML = `
        <span class="summary-name">${sp.name}</span>
        <span class="summary-dots"></span>
        <span class="summary-page">${displayPageNum}</span>
      `;

      item.onclick = () => {
        this.currentPageIndex = targetPageIndex;
        this.renderPage();
      };
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

    // Tenta recapturar o mouse ao fechar o livro se estiver em primeira pessoa
    if (CAM.fpv && GAME.state === 'PLAY') {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      if (!isTouch && cv) {
         try { cv.requestPointerLock(); } catch (_) {}
      }
    }
  }
}

export const bestiaryModal = new BestiaryModal();
