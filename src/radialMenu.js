import { AN, HM, CAM, GAME, INT } from './core/state.js';
import { setFpv } from './ship/player.js';

let setAllFn = null;
let activeMenu = 'main';
let isOpen = false;
let selectedIndex = -1;
let lastTouchX = 0;
let lastTouchY = 0;
let toastTimeout = null;

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

const MENUS = {
  main: {
    title: '📜 ORDENS DO CAPITÃO',
    items: [
      { id: 'anchor', label: 'Âncora', icon: '⚓', target: 'anchor' },
      { id: 'sails', label: 'Velas', icon: '⛵', target: 'sails' },
      { id: 'helm', label: 'Leme', icon: '☸️', target: 'helm' },
      { id: 'camera', label: 'Câmera', icon: '👁️', target: 'camera' },
      { id: 'close', label: 'Fechar', icon: '✕', action: closeRadialMenu }
    ]
  },
  anchor: {
    title: '⚓ ORDENS: ÂNCORA',
    items: [
      {
        id: 'anc_drop',
        label: 'Baixar Âncora',
        icon: '⚓⬇',
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
        action: () => {
          AN.t = 0;
          showOrderToast('📜 Capitão ordenou: Subir Âncora!');
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', target: 'main' }
    ]
  },
  sails: {
    title: '⛵ ORDENS: VELAS',
    items: [
      {
        id: 's100',
        label: 'Içar 100%',
        icon: '⛵',
        action: () => {
          if (setAllFn) setAllFn(1);
          showOrderToast('📜 Capitão ordenou: Içar todas as velas (100%)');
          closeRadialMenu();
        }
      },
      {
        id: 's50',
        label: 'Meia Vela',
        icon: '⛵',
        action: () => {
          if (setAllFn) setAllFn(0.5);
          showOrderToast('📜 Capitão ordenou: Meia vela (50%)');
          closeRadialMenu();
        }
      },
      {
        id: 's0',
        label: 'Arriar Velas',
        icon: '⛵',
        action: () => {
          if (setAllFn) setAllFn(0);
          showOrderToast('📜 Capitão ordenou: Arriar todas as velas');
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', target: 'main' }
    ]
  },
  helm: {
    title: '☸️ ORDENS: LEME',
    items: [
      {
        id: 'h0',
        label: 'Centralizar',
        icon: '☸️',
        action: () => {
          HM.t = 0;
          showOrderToast('📜 Capitão ordenou: Leme ao centro');
          closeRadialMenu();
        }
      },
      {
        id: 'hport',
        label: 'Tudo Bombordo',
        icon: '⬅',
        action: () => {
          HM.t = -1;
          showOrderToast('📜 Capitão ordenou: Tudo a Bombordo (Esquerda)!');
          closeRadialMenu();
        }
      },
      {
        id: 'hstar',
        label: 'Tudo Estibordo',
        icon: '➔',
        action: () => {
          HM.t = 1;
          showOrderToast('📜 Capitão ordenou: Tudo a Estibordo (Direita)!');
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', target: 'main' }
    ]
  },
  camera: {
    title: '👁️ ORDENS: CÂMERA',
    items: [
      {
        id: 'cam_free',
        label: 'Olhar Livre',
        icon: '👁️',
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
        action: () => {
          setFpv(false);
          showOrderToast('📜 Mudando para Câmera Orbital');
          closeRadialMenu();
        }
      },
      { id: 'back', label: 'Voltar', icon: '↩', target: 'main' }
    ]
  }
};

export function isRadialMenuOpen() {
  return isOpen;
}

export function openRadialMenu(menuKey = 'main') {
  isOpen = true;
  activeMenu = menuKey;
  selectedIndex = -1;
  const overlay = document.getElementById('radial-orders-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    renderRadialMenu();
  }
}

export function closeRadialMenu() {
  isOpen = false;
  selectedIndex = -1;
  const overlay = document.getElementById('radial-orders-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

export function updateRadialOrdersVisibility() {
  const triggerBtn = document.getElementById('btn-radial-orders');
  if (triggerBtn) {
    const show = GAME.state === 'PLAY' && CAM.fpv && GAME.canControl;
    triggerBtn.style.display = show ? 'flex' : 'none';
  }
  if (!CAM.fpv || GAME.state !== 'PLAY') {
    if (isOpen) closeRadialMenu();
  }
}

function renderRadialMenu() {
  const menu = MENUS[activeMenu] || MENUS.main;
  const titleEl = document.getElementById('radial-title');
  if (titleEl) titleEl.textContent = menu.title;

  const container = document.getElementById('radial-slices-container');
  if (!container) return;
  container.innerHTML = '';

  const items = menu.items;
  const total = items.length;
  // Posiciona fatias ao redor do círculo em pixels
  const radius = 110; // raio do menu radial

  items.forEach((item, index) => {
    // Começa no topo (-PI/2) e distribui uniformemente
    const angle = (index * (2 * Math.PI / total)) - (Math.PI / 2);
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);

    const btn = document.createElement('button');
    btn.className = 'radial-slice' + (index === selectedIndex ? ' active' : '');
    btn.setAttribute('data-index', index);
    btn.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    btn.innerHTML = `
      <span class="slice-icon">${item.icon}</span>
      <span class="slice-label">${item.label}</span>
    `;

    btn.onclick = (e) => {
      e.stopPropagation();
      executeItem(item);
    };

    container.appendChild(btn);
  });

  const hubIcon = document.getElementById('radial-hub-icon');
  const hubText = document.getElementById('radial-hub-text');
  if (hubIcon) hubIcon.textContent = activeMenu === 'main' ? '⚓' : '↩';
  if (hubText) hubText.textContent = activeMenu === 'main' ? 'FECHAR' : 'VOLTAR';
}

function executeItem(item) {
  if (item.target) {
    activeMenu = item.target;
    selectedIndex = -1;
    renderRadialMenu();
  } else if (item.action) {
    item.action();
  }
}

// Seleção direcional (Joycon Direito ou Toque / Mouse Drag)
export function updateRadialSelectionByDirection(dx, dy) {
  if (!isOpen) return;
  const menu = MENUS[activeMenu] || MENUS.main;
  const items = menu.items;
  const total = items.length;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.18) {
    if (selectedIndex !== -1) {
      selectedIndex = -1;
      renderRadialMenu();
    }
    return;
  }

  // Ângulo em relação ao topo (-PI/2)
  let angle = Math.atan2(dy, dx) + (Math.PI / 2);
  if (angle < 0) angle += 2 * Math.PI;

  const sliceAngle = (2 * Math.PI) / total;
  let idx = Math.round(angle / sliceAngle) % total;

  if (idx !== selectedIndex) {
    selectedIndex = idx;
    renderRadialMenu();
  }
}

export function executeSelectedRadialAction() {
  if (!isOpen) return false;
  if (selectedIndex >= 0) {
    const menu = MENUS[activeMenu] || MENUS.main;
    const item = menu.items[selectedIndex];
    if (item) {
      executeItem(item);
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
      if (isOpen) {
        closeRadialMenu();
      } else {
        openRadialMenu('main');
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
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeRadialMenu();
      }
    };
  }
}
