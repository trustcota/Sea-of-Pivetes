import { AN, HM, CAM, GAME, INT } from './core/state.js';
import { setFpv } from './ship/player.js';
import { SH } from './ship/ship.js';
import { cv } from './core/renderer.js';
import { fishingSystem } from './world/fishing.js';
import { bestiaryModal } from './ui/BestiaryModal.js';

let setAllFn = null;
let activeMenu = 'main';
let isOpen = false;
let selectedIndex = -1;
let selectedSubIndex = -1;
let toastTimeout = null;

let rjoy = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };

const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

function showRightJoycon(x, y) {
  const base = document.getElementById('joy-right-base');
  if (base) {
    base.style.left = x + 'px';
    base.style.top = y + 'px';
    base.style.display = 'block';
  }
}

function updateRightJoyconKnob(dx, dy) {
  const knob = document.getElementById('joy-right-knob');
  if (knob) {
    knob.style.transform = `translate(calc(-50% + ${dx * 25}px), calc(-50% + ${dy * 25}px))`;
  }
}

function hideRightJoycon() {
  const base = document.getElementById('joy-right-base');
  const knob = document.getElementById('joy-right-knob');
  if (base) base.style.display = 'none';
  if (knob) knob.style.transform = 'translate(-50%, -50%)';
}

export function registerRadialHelpers(helpers) {
  if (helpers && helpers.setAll) {
    setAllFn = helpers.setAll;
  }
}

export function showOrderToast(msg) {
  const toast = document.getElementById('order-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

export function setSailHoist(group, hoistVal) {
  if (!SH || !SH.sails) return;
  SH.sails.forEach(so => {
    if (group === 'all') {
      so.t = hoistVal;
    } else if (group === 'front' && so.name === 'Bujarrona') {
      so.t = hoistVal;
    } else if (group === 'main' && (so.name === 'Grande' || so.name === 'Gávea' || so.name === 'Joanete')) {
      so.t = hoistVal;
    } else if (group === 'rear' && so.name === 'Mezena') {
      so.t = hoistVal;
    }
  });
}

export function setRigRotation(group, dir) {
  if (!SH || !SH.rigs) return;
  SH.rigs.forEach(g => {
    let targetAngle = 0;
    if (dir === 'port') targetAngle = -g.lim;
    else if (dir === 'starboard') targetAngle = g.lim;
    else targetAngle = 0;

    if (group === 'all') {
      g.t = targetAngle;
    } else if (group === 'front' && g.name === 'Bujarrona') {
      g.t = targetAngle;
    } else if (group === 'main' && g.name === 'Principal') {
      g.t = targetAngle;
    } else if (group === 'rear' && g.name === 'Mezena') {
      g.t = targetAngle;
    }
  });
}

const SAIL_SUB_TABS = [
  { id: 'front', label: 'Proa', fullLabel: 'Vela da Frente (Bujarrona)', icon: '⛵' },
  { id: 'main', label: 'Mastro', fullLabel: 'Mastro Principal', icon: '⛵' },
  { id: 'rear', label: 'Popa', fullLabel: 'Vela de Trás (Mezena)', icon: '⛵' }
];

const RIG_SUB_TABS = [
  { id: 'front', label: 'Proa', fullLabel: 'Verga da Proa (Bujarrona)', icon: '🔄' },
  { id: 'main', label: 'Mastro', fullLabel: 'Vergas do Mastro Principal', icon: '🔄' },
  { id: 'rear', label: 'Popa', fullLabel: 'Verga da Popa (Mezena)', icon: '🔄' }
];

const MENUS = {
  main: {
    title: '📜 ORDENS DO CAPITÃO',
    items: [
      {
        id: 'anchor',
        label: 'Âncora',
        icon: '⚓',
        desc: 'Baixa ou içar a âncora do galeão',
        action: () => {
          AN.t = AN.t > 0.5 ? 0 : 1;
          showOrderToast('📜 Capitão ordenou: ' + (AN.t > 0.5 ? 'Baixar Âncora!' : 'Subir Âncora!'));
          closeRadialMenu();
        }
      },
      {
        id: 'sails_up',
        label: 'Içar 100%',
        icon: '⛵',
        desc: 'Abre 100% das velas para velocidade máxima',
        subType: 'sail_hoist',
        hoistVal: 1,
        actionName: 'Içar 100%',
        subTabs: SAIL_SUB_TABS
      },
      {
        id: 'sails_half',
        label: 'Meia Vela',
        icon: '⛵',
        desc: 'Abre 50% das velas para navegação moderada',
        subType: 'sail_hoist',
        hoistVal: 0.5,
        actionName: 'Meia Vela (50%)',
        subTabs: SAIL_SUB_TABS
      },
      {
        id: 'sails_down',
        label: 'Arriar Velas',
        icon: '⛵',
        desc: 'Recolhe todas as velas (0% velocidade)',
        subType: 'sail_hoist',
        hoistVal: 0,
        actionName: 'Arriar Velas',
        subTabs: SAIL_SUB_TABS
      },
      {
        id: 'toggle_lanterns',
        label: 'Furtividade',
        icon: '💡',
        desc: 'Liga ou apaga todas as lanternas do navio simultaneamente',
        action: () => {
          if (SH && SH.lanterns) {
            const anyOn = SH.lanterns.some(l => l.on);
            SH.lanterns.forEach(l => l.on = !anyOn);
            showOrderToast('📜 Capitão ordenou: Modo Furtivo ' + (anyOn ? 'ATIVADO (luzes apagadas)' : 'DESATIVADO (luzes acesas)'));
          }
          closeRadialMenu();
        }
      },
      {
        id: 'rigs_port',
        label: 'Vergas (Esq)',
        icon: '⬅',
        desc: 'Gira vergas a Bombordo (Esquerda)',
        subType: 'rig_rot',
        dir: 'port',
        actionName: 'Vergas a Bombordo',
        subTabs: RIG_SUB_TABS
      },
      {
        id: 'rigs_center',
        label: 'Vergas (Centro)',
        icon: '🎯',
        desc: 'Centraliza todas as vergas a 0°',
        subType: 'rig_rot',
        dir: 'center',
        actionName: 'Centralizar Vergas',
        subTabs: RIG_SUB_TABS
      },
      {
        id: 'rigs_star',
        label: 'Vergas (Dir)',
        icon: '➔',
        desc: 'Gira vergas a Estibordo (Direita)',
        subType: 'rig_rot',
        dir: 'starboard',
        actionName: 'Vergas a Estibordo',
        subTabs: RIG_SUB_TABS
      }
    ]
  },
  submenus: {
    parent: 'main',
    title: '⚙️ CATEGORIAS DE ORDENS',
    items: [
      { id: 'anc_menu', label: 'Âncora', icon: '⚓', desc: 'Opções de Âncora', target: 'anchor' },
      { id: 'sail_menu', label: 'Velas', icon: '⛵', desc: 'Abertura das Velas', target: 'sails' },
      { id: 'rig_menu', label: 'Vergas', icon: '🔄', desc: 'Rotação das Vergas', target: 'rigs' },
      { id: 'cam_menu', label: 'Visão / Luz', icon: '👁️', desc: 'Opções de Visão e Lanternas', target: 'camera' },
      { id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar à roda principal', target: 'main' }
    ]
  },
  anchor: {
    parent: 'submenus',
    title: '⚓ ORDENS: ÂNCORA',
    items: [
      {
        id: 'anc_drop',
        label: 'Baixar Âncora',
        icon: '⚓⬇',
        desc: 'Solta a âncora até o fundo do oceano',
        action: () => {
          AN.t = 1;
          showOrderToast('📜 Capitão ordenou: Baixar Âncora!');
          closeRadialMenu();
        }
      },
      {
        id: 'anc_raise',
        label: 'Subir Âncora',
        icon: '⚓⬆',
        desc: 'Recolhe a âncora para navegar',
        action: () => {
          AN.t = 0;
          showOrderToast('📜 Capitão ordenou: Subir Âncora!');
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar ao menu anterior', target: 'submenus' }
    ]
  },
  sails: {
    parent: 'submenus',
    title: '⛵ ORDENS: VELAS',
    items: [
      {
        id: 's100',
        label: 'Içar 100%',
        icon: '⛵',
        desc: 'Abre 100% das velas',
        subType: 'sail_hoist',
        hoistVal: 1,
        actionName: 'Içar 100%',
        subTabs: SAIL_SUB_TABS
      },
      {
        id: 's50',
        label: 'Meia Vela',
        icon: '⛵',
        desc: 'Abre 50% das velas',
        subType: 'sail_hoist',
        hoistVal: 0.5,
        actionName: 'Meia Vela (50%)',
        subTabs: SAIL_SUB_TABS
      },
      {
        id: 's0',
        label: 'Arriar Velas',
        icon: '⛵',
        desc: 'Recolhe 100% das velas',
        subType: 'sail_hoist',
        hoistVal: 0,
        actionName: 'Arriar Velas',
        subTabs: SAIL_SUB_TABS
      },
      { id: 'rigs', label: 'Girar Vergas', icon: '🔄', desc: 'Orientação do ângulo do vento', target: 'rigs' },
      { id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar ao menu anterior', target: 'submenus' }
    ]
  },
  rigs: {
    parent: 'sails',
    title: '🔄 ORDENS: GIRAR VERGAS (VELAS)',
    items: [
      {
        id: 'rot_port',
        label: 'Girar Bombordo',
        icon: '⬅',
        desc: 'Gira vergas totalmente para a esquerda',
        subType: 'rig_rot',
        dir: 'port',
        actionName: 'Girar a Bombordo',
        subTabs: RIG_SUB_TABS
      },
      {
        id: 'rot_center',
        label: 'Centralizar',
        icon: '🎯',
        desc: 'Alinha vergas retas a 0°',
        subType: 'rig_rot',
        dir: 'center',
        actionName: 'Centralizar Vergas',
        subTabs: RIG_SUB_TABS
      },
      {
        id: 'rot_starboard',
        label: 'Girar Estibordo',
        icon: '➔',
        desc: 'Gira vergas totalmente para a direita',
        subType: 'rig_rot',
        dir: 'starboard',
        actionName: 'Girar a Estibordo',
        subTabs: RIG_SUB_TABS
      },
      { id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar ao menu anterior', target: 'sails' }
    ]
  },
  camera: {
    parent: 'submenus',
    title: '👁️ ORDENS: VISÃO & LUZES',
    items: [
      {
        id: 'cam_free',
        label: 'Olhar Livre',
        icon: '👁️',
        desc: 'Ativa / desativa o modo olhar livre',
        action: () => {
          INT.tFree = !INT.tFree;
          showOrderToast('📜 Capitão: ' + (INT.tFree ? 'Olhar livre ativado' : 'Olhar livre desativado'));
          closeRadialMenu();
        }
      },
      {
        id: 'cam_orbit',
        label: 'Visão Orbital',
        icon: '🎥',
        desc: 'Muda para câmera orbital em 3a pessoa',
        action: () => {
          setFpv(false);
          showOrderToast('📜 Mudando para Câmera Orbital');
          closeRadialMenu();
        }
      },
      {
        id: 'toggle_lanterns',
        label: 'Furtividade',
        icon: '💡',
        desc: 'Liga ou apaga todas as lanternas do navio simultaneamente',
        action: () => {
          if (SH && SH.lanterns) {
            const anyOn = SH.lanterns.some(l => l.on);
            SH.lanterns.forEach(l => l.on = !anyOn);
            showOrderToast('📜 Capitão ordenou: Modo Furtivo ' + (anyOn ? 'ATIVADO (luzes apagadas)' : 'DESATIVADO (luzes acesas)'));
          }
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar ao menu anterior', target: 'submenus' }
    ]
  },
  inventory: {
    title: '🎒 INVENTÁRIO DO EXPLORADOR',
    get items() {
      return [
        {
          id: 'backpack',
          label: 'Mochila',
          icon: '🎒',
          desc: 'Sua mochila de expedição',
          target: 'backpack_slots'
        },
        {
          id: 'bestiary',
          label: 'Bestiário',
          icon: '📖',
          desc: 'Registro de criaturas descobertas',
          action: () => {
            if (bestiaryModal) bestiaryModal.open();
            closeRadialMenu();
          }
        },
        {
          id: 'fishing_rod',
          label: CAM.fpv ? 'Vara de Pesca' : 'Vara (Desativada)',
          icon: '🎣',
          disabled: !CAM.fpv,
          desc: CAM.fpv ? 'Equipar ou guardar sua vara de pesca artesanal' : 'Desativada na Câmera Livre (entre em FPV para pescar)',
          action: () => {
            if (!CAM.fpv) {
              showOrderToast('🎣 Vara de pesca desativada na Câmera Livre (mude para FPV com V)');
              closeRadialMenu();
              return;
            }
            if (fishingSystem) fishingSystem.toggleFishing();
            closeRadialMenu();
          }
        },
        {
          id: 'cam_free',
          label: 'Olhar Livre',
          icon: '👁️',
          desc: 'Alterna o modo olhar livre do capitão',
          action: () => {
            INT.tFree = !INT.tFree;
            showOrderToast('📜 Capitão: Olhar livre ' + (INT.tFree ? 'ativado' : 'desativado'));
            closeRadialMenu();
          }
        },
        { id: 'close', label: 'Fechar', icon: '✕', desc: 'Fechar inventário', action: () => closeRadialMenu() }
      ];
    }
  },
  backpack_slots: {
    parent: 'inventory',
    get title() { return `🎒 MOCHILA (${GAME.backpack.length}/8)`; },
    get items() {
      const items = [];
      for (let i = 0; i < 8; i++) {
        const fish = GAME.backpack[i];
        if (fish) {
          items.push({
            id: `slot_${fish.id}`,
            label: fish.name,
            icon: fish.icon,
            desc: `${(fish.weight < 1 ? (fish.weight * 1000).toFixed(0) + ' g' : fish.weight.toFixed(1) + ' kg')}`,
            action: () => {
              const discard = confirm(`Deseja descartar este ${fish.name}?`);
              if (discard) {
                GAME.backpack.splice(i, 1);
                showOrderToast(`🗑️ ${fish.name} descartado.`);
                renderRadialMenu();
              }
            }
          });
        } else {
          items.push({
            id: `empty_${i}`,
            label: 'Vazio',
            icon: '🔲',
            desc: 'Espaço livre',
            action: () => showOrderToast('🔲 Este slot está vazio.')
          });
        }
      }
      items.push({ id: 'back', label: 'Voltar', icon: '↩', desc: 'Voltar ao inventário', target: 'inventory' });
      return items;
    }
  }
};

export function isRadialMenuOpen() {
  return isOpen;
}

export function openRadialMenu(menuKey = 'main') {
  isOpen = true;
  activeMenu = menuKey;
  selectedIndex = -1;
  selectedSubIndex = -1;
  rjoy.id = -1;
  hideRightJoycon();
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (_) {}
  }
  const overlay = document.getElementById('radial-orders-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    renderRadialMenu();
  }
}

export function closeRadialMenu() {
  isOpen = false;
  selectedIndex = -1;
  selectedSubIndex = -1;
  rjoy.id = -1;
  hideRightJoycon();
  const overlay = document.getElementById('radial-orders-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  const bestiary = document.getElementById('bestiary-modal');
  if (bestiary && bestiary.style.display === 'flex') return;

  if (CAM.fpv && GAME.state === 'PLAY') {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch && cv) {
      try { cv.requestPointerLock(); } catch (_) {}
    }
  }
}

export function updateRadialOrdersVisibility() {
  const triggerBtn = document.getElementById('btn-radial-orders');
  const invBtn = document.getElementById('btn-radial-inventory');
  const show = GAME.state === 'PLAY' && GAME.canControl;
  
  if (triggerBtn) triggerBtn.style.display = show ? 'flex' : 'none';
  if (invBtn) invBtn.style.display = show ? 'flex' : 'none';

  if (GAME.state !== 'PLAY') {
    if (isOpen) closeRadialMenu();
  }
}

function sectorPath(rIn, rOut, a1, a2) {
  const x1 = Math.cos(a1) * rOut, y1 = Math.sin(a1) * rOut;
  const x2 = Math.cos(a2) * rOut, y2 = Math.sin(a2) * rOut;
  const x3 = Math.cos(a2) * rIn, y3 = Math.sin(a2) * rIn;
  const x4 = Math.cos(a1) * rIn, y4 = Math.sin(a1) * rIn;
  const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}

function renderRadialMenu() {
  const menu = MENUS[activeMenu] || MENUS.main;
  const titleEl = document.getElementById('radial-title');
  if (titleEl) titleEl.textContent = typeof menu.title === 'function' ? menu.title() : menu.title;

  const slicesGroup = document.getElementById('gta-slices-group');
  if (!slicesGroup) return;
  slicesGroup.innerHTML = '';

  const items = typeof menu.items === 'function' ? menu.items() : menu.items;
  const total = items.length;
  if (!total) return;

  const rIn = 56;
  const rOut = 138;
  const step = (2 * Math.PI) / total;
  const gap = total > 4 ? 0.03 : 0.02;

  items.forEach((item, index) => {
    const centerAngle = (index * step) - (Math.PI / 2);
    const a1 = centerAngle - (step / 2) + gap;
    const a2 = centerAngle + (step / 2) - gap;

    const pathD = sectorPath(rIn, rOut, a1, a2);
    const isActive = (index === selectedIndex);

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathD);
    pathEl.setAttribute('class', 'gta-slice-path' + (item.disabled ? ' disabled' : '') + (isActive && selectedSubIndex === -1 ? ' active' : ''));

    pathEl.onclick = (e) => {
      e.stopPropagation();
      executeItem(item, -1);
    };

    pathEl.onpointerenter = () => {
      if (selectedIndex !== index || selectedSubIndex !== -1) {
        selectedIndex = index;
        selectedSubIndex = -1;
        renderRadialMenu();
      }
    };

    slicesGroup.appendChild(pathEl);

    // Ícone e Texto
    const rMid = (rIn + rOut) / 2;
    const tx = Math.cos(centerAngle) * rMid;
    const ty = Math.sin(centerAngle) * rMid;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.pointerEvents = 'none';

    const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    iconText.setAttribute('x', tx.toFixed(1));
    iconText.setAttribute('y', (ty - 7).toFixed(1));
    iconText.setAttribute('text-anchor', 'middle');
    iconText.setAttribute('dominant-baseline', 'middle');
    iconText.setAttribute('font-size', '18');
    if (item.disabled) iconText.setAttribute('opacity', '0.4');
    iconText.textContent = item.icon;

    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', tx.toFixed(1));
    labelText.setAttribute('y', (ty + 10).toFixed(1));
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('dominant-baseline', 'middle');
    labelText.setAttribute('font-size', '9');
    labelText.setAttribute('font-weight', 'bold');
    labelText.setAttribute('class', 'gta-slice-text-label');
    labelText.setAttribute('fill', item.disabled ? 'rgba(255,255,255,0.4)' : (isActive && selectedSubIndex === -1 ? '#110b06' : '#fff9ed'));
    labelText.textContent = item.label;

    g.appendChild(iconText);
    g.appendChild(labelText);
    slicesGroup.appendChild(g);

    // Renderiza as 3 sub-abas se o item estiver selecionado
    if (isActive && item.subTabs && item.subTabs.length) {
      const subRIn = 143;
      const subROut = 185;
      const subCount = item.subTabs.length;
      const sliceArc = a2 - a1;
      const subStep = sliceArc / subCount;
      const subGap = 0.01;

      item.subTabs.forEach((sub, sIdx) => {
        const subA1 = a1 + (sIdx * subStep) + subGap;
        const subA2 = a1 + ((sIdx + 1) * subStep) - subGap;
        const subPathD = sectorPath(subRIn, subROut, subA1, subA2);
        const isSubActive = (sIdx === selectedSubIndex);

        const subPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        subPathEl.setAttribute('d', subPathD);
        subPathEl.setAttribute('class', 'gta-subslice-path' + (isSubActive ? ' active' : ''));

        subPathEl.onclick = (e) => {
          e.stopPropagation();
          executeItem(item, sIdx);
        };

        subPathEl.onpointerenter = () => {
          if (selectedIndex !== index || selectedSubIndex !== sIdx) {
            selectedIndex = index;
            selectedSubIndex = sIdx;
            renderRadialMenu();
          }
        };

        slicesGroup.appendChild(subPathEl);

        const subCenterA = (subA1 + subA2) / 2;
        const subMidR = (subRIn + subROut) / 2;
        const stx = Math.cos(subCenterA) * subMidR;
        const sty = Math.sin(subCenterA) * subMidR;

        const subG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        subG.style.pointerEvents = 'none';

        const subLabelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        subLabelText.setAttribute('x', stx.toFixed(1));
        subLabelText.setAttribute('y', sty.toFixed(1));
        subLabelText.setAttribute('text-anchor', 'middle');
        subLabelText.setAttribute('dominant-baseline', 'middle');
        subLabelText.setAttribute('font-size', '10');
        subLabelText.setAttribute('font-weight', 'bold');
        subLabelText.setAttribute('class', 'gta-slice-text-label');
        subLabelText.setAttribute('fill', isSubActive ? '#000000' : '#00d9ff');
        subLabelText.textContent = sub.label;

        subG.appendChild(subLabelText);
        slicesGroup.appendChild(subG);
      });
    }
  });

  // Hub Central
  const hubIcon = document.getElementById('radial-hub-icon');
  const hubText = document.getElementById('radial-hub-text');
  const hubDesc = document.getElementById('radial-hub-desc');

  if (selectedIndex >= 0 && items[selectedIndex]) {
    const cur = items[selectedIndex];
    if (selectedSubIndex >= 0 && cur.subTabs && cur.subTabs[selectedSubIndex]) {
      const sub = cur.subTabs[selectedSubIndex];
      if (hubIcon) hubIcon.textContent = sub.icon || cur.icon || '⛵';
      if (hubText) hubText.textContent = `${cur.label} · ${sub.label}`;
      if (hubDesc) hubDesc.textContent = `${cur.actionName || cur.label} (${sub.fullLabel})`;
    } else {
      if (hubIcon) hubIcon.textContent = cur.icon || '⚓';
      if (hubText) hubText.textContent = cur.label || 'ORDEM';
      if (hubDesc) hubDesc.textContent = cur.subTabs ? `${cur.desc} · (Puxe para fora para vela específica)` : (cur.desc || '');
    }
  } else {
    const parentMenu = menu.parent;
    if (hubIcon) hubIcon.textContent = parentMenu ? '↩' : '✕';
    if (hubText) hubText.textContent = parentMenu ? 'VOLTAR' : 'FECHAR';
    if (hubDesc) hubDesc.textContent = '';
  }
}

function executeItem(item, subIndex = -1) {
  if (item.target) {
    activeMenu = item.target;
    selectedIndex = -1;
    selectedSubIndex = -1;
    renderRadialMenu();
    return;
  }

  if (item.subType === 'sail_hoist') {
    const sub = subIndex >= 0 && item.subTabs ? item.subTabs[subIndex] : null;
    const group = sub ? sub.id : 'all';
    setSailHoist(group, item.hoistVal);
    if (group === 'all' && setAllFn) setAllFn(item.hoistVal);

    const groupText = group === 'all' ? 'em TODAS as velas' : `na ${sub.fullLabel}`;
    showOrderToast(`📜 Capitão ordenou: ${item.actionName} ${groupText}!`);
    closeRadialMenu();
    return;
  }

  if (item.subType === 'rig_rot') {
    const sub = subIndex >= 0 && item.subTabs ? item.subTabs[subIndex] : null;
    const group = sub ? sub.id : 'all';
    setRigRotation(group, item.dir);

    const groupText = group === 'all' ? 'em TODAS as vergas' : `na ${sub.fullLabel}`;
    showOrderToast(`📜 Capitão ordenou: ${item.actionName} ${groupText}!`);
    closeRadialMenu();
    return;
  }

  if (item.action) {
    item.action();
  }
}

export function updateRadialSelectionByDirection(dx, dy) {
  if (!isOpen) return;
  const menu = MENUS[activeMenu] || MENUS.main;
  const items = typeof menu.items === 'function' ? menu.items() : menu.items;
  const total = items.length;
  if (!total) return;

  const dist = Math.hypot(dx, dy);

  if (dist < 0.12 && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
    if (selectedIndex !== -1 || selectedSubIndex !== -1) {
      selectedIndex = -1;
      selectedSubIndex = -1;
      renderRadialMenu();
    }
    return;
  }

  const targetAngle = Math.atan2(dy, dx);
  let bestIndex = 0;
  let minDiff = Infinity;

  const step = (2 * Math.PI) / total;
  items.forEach((_, i) => {
    const itemAngle = (i * step) - (Math.PI / 2);
    const diff = Math.abs(wrapAngle(targetAngle - itemAngle));
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  });

  let bestSubIndex = -1;
  const activeItem = items[bestIndex];
  if (activeItem && activeItem.subTabs && activeItem.subTabs.length) {
    const isOuter = dist > 0.62 || dist > 135;
    if (isOuter) {
      const centerAngle = (bestIndex * step) - (Math.PI / 2);
      const a1 = centerAngle - (step / 2);
      let rel = wrapAngle(targetAngle - a1);
      if (rel < 0) rel += 2 * Math.PI;
      const subStep = step / activeItem.subTabs.length;
      bestSubIndex = Math.floor(rel / subStep);
      if (bestSubIndex < 0) bestSubIndex = 0;
      if (bestSubIndex >= activeItem.subTabs.length) bestSubIndex = activeItem.subTabs.length - 1;
    }
  }

  if (bestIndex !== selectedIndex || bestSubIndex !== selectedSubIndex) {
    selectedIndex = bestIndex;
    selectedSubIndex = bestSubIndex;
    renderRadialMenu();
  }
}

export function executeSelectedRadialAction() {
  if (!isOpen) return false;
  const menu = MENUS[activeMenu] || MENUS.main;
  const items = typeof menu.items === 'function' ? menu.items() : menu.items;
  if (selectedIndex >= 0) {
    const item = items[selectedIndex];
    if (item) {
      executeItem(item, selectedSubIndex);
      return true;
    }
  } else if (selectedIndex === -1) {
    if (menu.parent) {
      activeMenu = menu.parent;
      selectedIndex = -1;
      selectedSubIndex = -1;
      renderRadialMenu();
      return true;
    } else {
      closeRadialMenu();
      return true;
    }
  }
  return false;
}

export function setupRadialMenu(helpers) {
  registerRadialHelpers(helpers);

  const triggerBtn = document.getElementById('btn-radial-orders');
  if (triggerBtn) {
    triggerBtn.onclick = (e) => {
      e.stopPropagation();
      if (isOpen && activeMenu === 'main') {
        closeRadialMenu();
      } else {
        openRadialMenu('main');
      }
    };
  }

  const invBtn = document.getElementById('btn-radial-inventory');
  if (invBtn) {
    invBtn.onclick = (e) => {
      e.stopPropagation();
      if (isOpen && activeMenu === 'inventory') {
        closeRadialMenu();
      } else {
        openRadialMenu('inventory');
      }
    };
  }

  const centerBtn = document.getElementById('radial-center-btn');
  if (centerBtn) {
    centerBtn.onclick = (e) => {
      e.stopPropagation();
      if (activeMenu !== 'main') {
        openRadialMenu('main');
      } else {
        closeRadialMenu();
      }
    };
  }

  const overlay = document.getElementById('radial-orders-overlay');
  if (overlay) {
    overlay.onpointerdown = (e) => {
      if (!isOpen) return;

      if (e.target.closest('#radial-center-btn') || e.target.closest('.gta-slice-path') || e.target.closest('.gta-subslice-path')) {
        return;
      }

      rjoy.id = e.pointerId;
      rjoy.x0 = e.clientX;
      rjoy.y0 = e.clientY;
      rjoy.dx = rjoy.dy = 0;
      showRightJoycon(rjoy.x0, rjoy.y0);
      try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
    };

    overlay.onpointermove = (e) => {
      if (!isOpen) return;

      if (e.pointerId === rjoy.id) {
        const maxDist = 40;
        rjoy.dx = (e.clientX - rjoy.x0) / maxDist;
        rjoy.dy = (e.clientY - rjoy.y0) / maxDist;
        const dist = Math.hypot(rjoy.dx, rjoy.dy);
        const clampedDx = dist > 1 ? rjoy.dx / dist : rjoy.dx;
        const clampedDy = dist > 1 ? rjoy.dy / dist : rjoy.dy;

        updateRightJoyconKnob(clampedDx, clampedDy);
        updateRadialSelectionByDirection(rjoy.dx, rjoy.dy);
      } else if (e.pointerType === 'mouse' && rjoy.id < 0) {
        const wheel = document.getElementById('radial-wheel');
        if (wheel) {
          const rect = wheel.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          updateRadialSelectionByDirection(e.clientX - centerX, e.clientY - centerY);
        }
      }
    };

    overlay.onpointerup = overlay.onpointercancel = (e) => {
      if (!isOpen) return;

      if (e.pointerId === rjoy.id) {
        rjoy.id = -1;
        hideRightJoycon();
        executeSelectedRadialAction();
      }
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeRadialMenu();
      }
    };
  }

  window.addEventListener('pointermove', (e) => {
    if (!isOpen) return;
    if (e.pointerType === 'mouse' && rjoy.id < 0) {
      const wheel = document.getElementById('radial-wheel');
      if (wheel) {
        const rect = wheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        updateRadialSelectionByDirection(e.clientX - centerX, e.clientY - centerY);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyQ' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat && GAME.state === 'PLAY' && GAME.canControl) {
        if (!isOpen) {
          openRadialMenu('main');
        }
      }
      return;
    }

    if (e.code === 'Tab' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat && GAME.state === 'PLAY' && GAME.canControl) {
        if (!isOpen) {
          openRadialMenu('inventory');
        }
      }
      return;
    }

    if (!isOpen) return;

    if (e.code === 'Escape') {
      e.stopPropagation();
      if (activeMenu !== 'main') {
        openRadialMenu('main');
      } else {
        closeRadialMenu();
      }
      return;
    }

    let dx = 0, dy = 0;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') dy = -1;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') dy = 1;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') dx = -1;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') dx = 1;

    if (dx !== 0 || dy !== 0) {
      e.stopPropagation();
      updateRadialSelectionByDirection(dx, dy);
      return;
    }

    if (e.code === 'Enter' || e.code === 'Space') {
      e.stopPropagation();
      executeSelectedRadialAction();
    }
  });

  window.addEventListener('keyup', (e) => {
    if ((e.code === 'KeyQ' || e.code === 'Tab') && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen) {
        if (!executeSelectedRadialAction()) {
          closeRadialMenu();
        }
      }
    }
  });
}
