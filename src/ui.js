import { clamp, D2, wrapA } from './core/math.js';
import { S, WI, ST, CAM, UIS, HM, AN, INT, keys, GAME, SETTINGS, saveSettingsState } from './core/state.js';
import { setFpv, resetPlayer } from './ship/player.js';
import { SH } from './ship/ship.js';
import { ILHAS } from './world/archipelago.js';
import { sea } from './world/ocean.js';
import { setupRadialMenu, updateRadialOrdersVisibility } from './radialMenu.js';

export const degN = r => ((Math.round(r / D2) % 360) + 360) % 360;
export const potName = g => g < 30 ? 'de popa' : g < 80 ? 'alheta' : g < 110 ? 'través' : g < 155 ? 'bolina' : 'de proa';

export function setupUI(actions = {}) {
  const $ = id => document.getElementById(id);

  const wsl = $('wsl'), wdr = $('wdr'), wdv = $('wdv'), hlm = $('hlm');
  function showDir() {
    const d = degN(WI.dir);
    if (wdr) wdr.value = d;
    if (wdv) wdv.textContent = d + '°';
  }
  function setWindStr(v) {
    WI.str = clamp(v, 0, 1);
    if (wsl) wsl.value = Math.round(WI.str * 100);
  }

  let mapAuto = true, mapVDm = 2, mapFa = 0, mapFn = 0, mapCool = 0;
  const mapVB = [...document.querySelectorAll('[data-vd]')];

  function setMapVD(v, isManual = false) {
    if (isManual) mapVDm = v;
    ILHAS.setVD(v);
    SETTINGS.renderDist = v;
    saveSettingsState();
    if ($('mapa-rg')) $('mapa-rg').value = v;
    if ($('mapa-rgv')) $('mapa-rgv').textContent = Math.round((v - .35) * ILHAS.CS) + ' m';
    if ($('modal-mapa-rg')) $('modal-mapa-rg').value = v;
    if ($('modal-mapa-rg-val')) $('modal-mapa-rg-val').textContent = Math.round((v - .35) * ILHAS.CS) + ' m';
    mapVB.forEach(x => x.classList.toggle('on', +x.dataset.vd === v));
    document.querySelectorAll('button[data-modal-vd]').forEach(x => x.classList.toggle('on', +x.dataset.modalVd === v));
  }

  // Carrega e aplica configurações salvas do localStorage
  if (SETTINGS) {
    if (SETTINGS.oceanCondition !== undefined) {
      S.t = SETTINGS.oceanCondition;
      const sl = $('sl');
      if (sl) sl.value = S.t * 100;
    }
    if (SETTINGS.windStrength !== undefined) {
      WI.str = SETTINGS.windStrength > 1 ? SETTINGS.windStrength / 100 : SETTINGS.windStrength;
      SETTINGS.windStrength = WI.str;
      const wsl = $('wsl');
      if (wsl) wsl.value = Math.round(WI.str * 100);
      const modalWsl = $('modal-wsl');
      if (modalWsl) modalWsl.value = Math.round(WI.str * 100);
    }
    if (SETTINGS.windDir !== undefined) {
      WI.dir = SETTINGS.windDir * D2;
      showDir();
      const modalWdr = $('modal-wdr');
      if (modalWdr) modalWdr.value = Math.round(SETTINGS.windDir);
    }
    if (SETTINGS.renderDist !== undefined) {
      setMapVD(SETTINGS.renderDist, true);
    }
    if (SETTINGS.terrainHeight !== undefined) {
      ILHAS.setCfg('height', SETTINGS.terrainHeight);
    }
    if (SETTINGS.terrainDepth !== undefined) {
      ILHAS.setCfg('depth', SETTINGS.terrainDepth);
    }
    if (SETTINGS.terrainSpacing !== undefined) {
      ILHAS.setCfg('spacing', SETTINGS.terrainSpacing);
    }
    if (SETTINGS.terrainDensity !== undefined) {
      ILHAS.setCfg('density', SETTINGS.terrainDensity / 100);
    }
    if (SETTINGS.autoCam !== undefined) {
      CAM.auto = SETTINGS.autoCam;
      const ar = $('ar');
      if (ar) ar.classList.toggle('on', CAM.auto);
      const modalAr = $('modal-ar');
      if (modalAr) modalAr.classList.toggle('on', CAM.auto);
    }
    if (SETTINGS.wireframe) {
      SH.mats.forEach(m => m.wireframe = true);
      if (sea && sea.material) sea.material.wireframe = true;
      if (ILHAS && ILHAS.setWireframe) ILHAS.setWireframe(true);
      const wf = $('wf');
      if (wf) wf.classList.add('on');
      const modalWf = $('modal-wf');
      if (modalWf) modalWf.classList.add('on');
    }
  }

  // Botões da Tela Inicial e Modais
  const btnPlay = $('btn-play');
  if (btnPlay) {
    btnPlay.onclick = () => {
      if (actions.onPlay) actions.onPlay();
    };
  }

  const settingsModal = $('settings-modal');
  const controlsModal = $('controls-modal');
  const btnSettings = $('btn-settings');
  const btnIngameMenu = $('btn-ingame-menu');
  const btnCloseSettings = $('btn-close-settings');
  const btnSaveSettings = $('btn-save-settings');
  const btnReturnMenu = $('btn-return-menu');
  const returnRow = $('settings-menu-return-row');

  const btnControls = $('btn-controls');
  const btnCloseControls = $('btn-close-controls');
  const btnConfirmControls = $('btn-confirm-controls');

  const modalSeaBtns = [...document.querySelectorAll('button[data-modal-sea]')];
  const modalVdBtns = [...document.querySelectorAll('button[data-modal-vd]')];

  function syncSettingsModal() {
    const modalSl = $('modal-sl'), modalSlVal = $('modal-sl-val');
    if (modalSl) modalSl.value = Math.round(S.t * 100);
    if (modalSlVal) modalSlVal.textContent = Math.round(S.t * 100) + '%';

    const modalWsl = $('modal-wsl'), modalWslVal = $('modal-wsl-val');
    if (modalWsl) modalWsl.value = Math.round(WI.str * 100);
    if (modalWslVal) modalWslVal.textContent = Math.round(WI.str * 100) + '%';

    const modalWdr = $('modal-wdr'), modalWdrVal = $('modal-wdr-val');
    if (modalWdr) {
      modalWdr.value = degN(WI.dir);
      if (modalWdrVal) modalWdrVal.textContent = degN(WI.dir) + '°';
    }

    modalSeaBtns.forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.modalSea - S.t) < 0.05));
    const curVd = ILHAS.vd();
    modalVdBtns.forEach(b => b.classList.toggle('on', +b.dataset.modalVd === curVd));
    const modalRg = $('modal-mapa-rg'), modalRgVal = $('modal-mapa-rg-val');
    if (modalRg) {
      modalRg.value = curVd;
      if (modalRgVal) modalRgVal.textContent = Math.round((curVd - .35) * ILHAS.CS) + ' m';
    }

    // Sincroniza controles do arquipélago
    const modalGh = $('modal-mapa-gh'), modalGhVal = $('modal-mapa-gh-val');
    const origGh = $('mapa-gh');
    if (modalGh && origGh) {
      modalGh.value = origGh.value;
      if (modalGhVal) modalGhVal.textContent = origGh.value;
    }

    const modalGd = $('modal-mapa-gd'), modalGdVal = $('modal-mapa-gd-val');
    const origGd = $('mapa-gd');
    if (modalGd && origGd) {
      modalGd.value = origGd.value;
      if (modalGdVal) modalGdVal.textContent = origGd.value;
    }

    const modalGs = $('modal-mapa-gs'), modalGsVal = $('modal-mapa-gs-val');
    const origGs = $('mapa-gs');
    if (modalGs && origGs) {
      modalGs.value = origGs.value;
      if (modalGsVal) modalGsVal.textContent = origGs.value;
    }

    const modalGn = $('modal-mapa-gn'), modalGnVal = $('modal-mapa-gn-val');
    const origGn = $('mapa-gn');
    if (modalGn && origGn) {
      modalGn.value = origGn.value;
      if (modalGnVal) modalGnVal.textContent = origGn.value;
    }

    const modalAu = $('modal-mapa-au'), origAu = $('mapa-au');
    if (modalAu && origAu) {
      modalAu.classList.toggle('on', origAu.classList.contains('on'));
    }

    const modalAr = $('modal-ar'), origAr = $('ar');
    if (modalAr && origAr) {
      modalAr.classList.toggle('on', origAr.classList.contains('on'));
    }

    const modalWf = $('modal-wf'), origWf = $('wf');
    if (modalWf && origWf) {
      modalWf.classList.toggle('on', origWf.classList.contains('on'));
    }
  }

  const openSettings = () => {
    if (settingsModal) {
      settingsModal.style.display = 'flex';
      if (returnRow) returnRow.style.display = GAME.state === 'PLAY' ? 'block' : 'none';
      syncSettingsModal();
    }
  };
  const closeSettings = () => {
    if (settingsModal) settingsModal.style.display = 'none';
  };

  if (btnSettings) btnSettings.onclick = openSettings;
  if (btnIngameMenu) btnIngameMenu.onclick = openSettings;
  if (btnCloseSettings) btnCloseSettings.onclick = closeSettings;
  if (btnSaveSettings) btnSaveSettings.onclick = closeSettings;

  if (btnReturnMenu) {
    btnReturnMenu.onclick = () => {
      closeSettings();
      if (actions.onReturnMenu) actions.onReturnMenu();
    };
  }

  // Configuração das abas do painel de Ajustes
  const tabBtns = [...document.querySelectorAll('.settings-tab-btn')];
  const tabPanes = [...document.querySelectorAll('.settings-tab-pane')];
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabPanes.forEach(p => p.classList.toggle('active', p.dataset.pane === target));
    };
  });

  const openControls = () => { if (controlsModal) controlsModal.style.display = 'flex'; };
  const closeControls = () => { if (controlsModal) controlsModal.style.display = 'none'; };
  if (btnControls) btnControls.onclick = openControls;
  if (btnCloseControls) btnCloseControls.onclick = closeControls;
  if (btnConfirmControls) btnConfirmControls.onclick = closeControls;

  // Sincronização dos controles dentro do modal de Ajustes
  modalSeaBtns.forEach(b => b.onclick = () => {
    S.t = +b.dataset.modalSea;
    const sl = $('sl');
    if (sl) sl.value = S.t * 100;
    setWindStr(.12 + .85 * S.t);
    syncSettingsModal();
    SETTINGS.oceanCondition = S.t;
    SETTINGS.waveIntensity = Math.round(S.t * 100);
    saveSettingsState();
  });

  const modalSl = $('modal-sl');
  if (modalSl) {
    modalSl.oninput = () => {
      S.t = modalSl.value / 100;
      const sl = $('sl');
      if (sl) sl.value = modalSl.value;
      setWindStr(.12 + .85 * S.t);
      const valEl = $('modal-sl-val');
      if (valEl) valEl.textContent = modalSl.value + '%';
      modalSeaBtns.forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.modalSea - S.t) < 0.05));
      SETTINGS.oceanCondition = S.t;
      SETTINGS.waveIntensity = +modalSl.value;
      saveSettingsState();
    };
  }

  const modalWsl = $('modal-wsl');
  if (modalWsl) {
    modalWsl.oninput = () => {
      WI.str = modalWsl.value / 100;
      const wsl = $('wsl');
      if (wsl) wsl.value = modalWsl.value;
      const valEl = $('modal-wsl-val');
      if (valEl) valEl.textContent = modalWsl.value + '%';
      SETTINGS.windStrength = WI.str;
      saveSettingsState();
    };
  }

  [['modal-w0', 0], ['modal-w1', Math.PI / 2], ['modal-w2', Math.PI * .62]].forEach(([id, o]) => {
    const el = $(id);
    if (el) el.onclick = () => { WI.dir = ST.hd + o; showDir(); SETTINGS.windDir = Math.round(degN(WI.dir)); saveSettingsState(); };
  });

  modalVdBtns.forEach(b => b.onclick = () => {
    setMapVD(+b.dataset.modalVd, true);
  });

  const modalRg = $('modal-mapa-rg');
  if (modalRg) {
    modalRg.oninput = () => {
      setMapVD(+modalRg.value, true);
    };
  }

  const anb = $('an');
  if (anb) anb.onclick = () => { AN.t = AN.t > .5 ? 0 : 1; };

  // Vincula controles avançados do painel de Ajustes aos elementos da simulação
  const modalWdr = $('modal-wdr');
  if (modalWdr) {
    modalWdr.oninput = () => {
      WI.dir = modalWdr.value * D2;
      const wdr = $('wdr');
      if (wdr) wdr.value = modalWdr.value;
      const wdv = $('wdv');
      if (wdv) wdv.textContent = modalWdr.value + '°';
      const valEl = $('modal-wdr-val');
      if (valEl) valEl.textContent = modalWdr.value + '°';
      SETTINGS.windDir = +modalWdr.value;
      saveSettingsState();
    };
  }

  [['gh', 'height', false], ['gd', 'depth', false], ['gs', 'spacing', false], ['gn', 'density', true]].forEach(([id, k, isPct]) => {
    const modalEl = $('modal-mapa-' + id);
    const modalVal = $('modal-mapa-' + id + '-val');
    const origEl = $('mapa-' + id);
    const origVal = $('mapa-' + id + 'v');

    const updateCfg = val => {
      const cfgVal = isPct ? val / 100 : val;
      if (modalVal) modalVal.textContent = isPct ? Math.round(val) : val;
      if (modalEl) modalEl.value = val;
      if (origEl) origEl.value = val;
      if (origVal) origVal.textContent = (isPct ? Math.round(val) : val) + (isPct ? '%' : '');
      ILHAS.setCfg(k, cfgVal);
      if (k === 'height') SETTINGS.terrainHeight = val;
      if (k === 'depth') SETTINGS.terrainDepth = val;
      if (k === 'spacing') SETTINGS.terrainSpacing = val;
      if (k === 'density') SETTINGS.terrainDensity = val;
      saveSettingsState();
      mapRelocate();
    };

    if (modalEl) {
      modalEl.value = isPct ? ILHAS.GEN[k] * 100 : ILHAS.GEN[k];
      if (modalVal) modalVal.textContent = isPct ? Math.round(modalEl.value) : modalEl.value;
      modalEl.oninput = () => updateCfg(+modalEl.value);
    }
    if (origEl) {
      origEl.value = isPct ? ILHAS.GEN[k] * 100 : ILHAS.GEN[k];
      if (origVal) origVal.textContent = (isPct ? Math.round(origEl.value) : origEl.value) + (isPct ? '%' : '');
      origEl.oninput = () => updateCfg(+origEl.value);
    }
  });

  const modalNs = $('modal-mapa-ns');
  if (modalNs) {
    modalNs.onclick = () => {
      const origNs = $('mapa-ns');
      if (origNs) origNs.click();
    };
  }

  const modalAu = $('modal-mapa-au');
  if (modalAu) {
    modalAu.onclick = () => {
      const origAu = $('mapa-au');
      if (origAu) {
        origAu.click();
        modalAu.classList.toggle('on', origAu.classList.contains('on'));
      }
    };
  }

  const modalAr = $('modal-ar');
  if (modalAr) {
    modalAr.onclick = () => {
      const origAr = $('ar');
      if (origAr) {
        origAr.click();
        modalAr.classList.toggle('on', origAr.classList.contains('on'));
      }
    };
  }

  const modalWf = $('modal-wf');
  if (modalWf) {
    modalWf.onclick = () => {
      const origWf = $('wf');
      if (origWf) {
        origWf.click();
        modalWf.classList.toggle('on', origWf.classList.contains('on'));
      }
    };
  }

  // Controles de clima e vento
  const btn = [...document.querySelectorAll('button[data-s]')];
  const sl = $('sl');
  const stx = $('st');
  btn.forEach(b => b.onclick = () => {
    S.t = +b.dataset.s;
    if (sl) sl.value = S.t * 100;
    setWindStr(.12 + .85 * S.t);
  });
  if (sl) sl.oninput = () => {
    S.t = sl.value / 100;
    setWindStr(.12 + .85 * S.t);
  };

  const ar = $('ar'), wf = $('wf');
  if (ar) ar.onclick = () => {
    CAM.auto = !CAM.auto;
    ar.classList.toggle('on', CAM.auto);
    SETTINGS.autoCam = CAM.auto;
    saveSettingsState();
  };
  if (wf) wf.onclick = () => {
    const on = wf.classList.toggle('on');
    SH.mats.forEach(m => m.wireframe = on);
    if (sea && sea.material) sea.material.wireframe = on;
    if (ILHAS && ILHAS.setWireframe) ILHAS.setWireframe(on);
    SETTINGS.wireframe = on;
    saveSettingsState();
  };

  // Sliders de abertura das velas
  const sls = $('sls'), SL = SH.sails, rows = [];
  function mkSl(name, fn) {
    const r = document.createElement('div');
    r.className = 'sr';
    r.innerHTML = '<span>' + name + '</span><input type="range" min="0" max="100" value="100"><b>100%</b>';
    const i = r.children[1], b = r.children[2];
    i.oninput = () => { b.textContent = i.value + '%'; fn(i.value / 100); };
    if (sls) sls.append(r);
    return { i, b };
  }
  const all = mkSl('Todas', v => {
    SL.forEach(x => x.t = v);
    rows.forEach(r => { r.i.value = v * 100; r.b.textContent = Math.round(v * 100) + '%'; });
  });
  SL.forEach(x => rows.push(mkSl(x.name, v => x.t = v)));
  const setAll = v => { all.i.value = v * 100; all.i.oninput(); };
  if ($('up')) $('up').onclick = () => setAll(1);
  if ($('md')) $('md').onclick = () => setAll(.5);
  if ($('dn')) $('dn').onclick = () => setAll(0);

  // Sliders de rotação das vergas
  const rts = $('rts'), rrows = [];
  const ra = document.createElement('div');
  ra.className = 'sr';
  ra.innerHTML = '<span>Todas</span><input type="range" min="-100" max="100" value="0"><b>0%</b>';
  const rai = ra.children[1], rab = ra.children[2];
  if (rts) rts.append(ra);
  rai.oninput = () => {
    rab.textContent = rai.value + '%';
    rrows.forEach(i => { i.value = rai.value; i.oninput(); });
  };
  SH.rigs.forEach(g => {
    const r = document.createElement('div');
    r.className = 'sr';
    r.innerHTML = '<span>' + g.name + '</span><input type="range" min="-100" max="100" value="0"><b>0°</b>';
    const i = r.children[1], b = r.children[2];
    i.oninput = () => { g.t = i.value / 100 * g.lim; b.textContent = Math.round(g.t / D2) + '°'; };
    if (rts) rts.append(r);
    rrows.push(i);
  });
  if ($('ct')) $('ct').onclick = () => {
    rai.value = 0;
    rab.textContent = '0%';
    rrows.forEach(i => { i.value = 0; i.oninput(); });
  };

  // Vento, rumo e leme
  if (wsl) wsl.oninput = () => {
    WI.str = wsl.value / 100;
    const modalWsl = $('modal-wsl');
    if (modalWsl) modalWsl.value = wsl.value;
    SETTINGS.windStrength = WI.str;
    saveSettingsState();
  };
  if (wdr) wdr.oninput = () => { WI.dir = wdr.value * D2; if (wdv) wdv.textContent = wdr.value + '°'; };
  if (hlm) hlm.oninput = () => { HM.t = hlm.value / 100; };
  [['w0', 0], ['w1', Math.PI / 2], ['w2', Math.PI * .62]].forEach(([id, o]) => {
    const el = $(id);
    if (el) el.onclick = () => { WI.dir = ST.hd + o; showDir(); };
  });
  showDir();

  const tm = $('tm');
  function lockUI() {
    [hlm, ...document.querySelectorAll('#sls input,#rts input,#up,#md,#dn,#ct,#an')].forEach(e => {
      if (!e) return;
      e.disabled = !UIS.tmode;
      e.style.opacity = UIS.tmode ? '' : '.4';
    });
  }
  if (tm) {
    tm.onclick = () => {
      UIS.tmode = !UIS.tmode;
      tm.classList.toggle('on', UIS.tmode);
      lockUI();
    };
    lockUI();
  }

  // Alternador de modo e minimizar painel
  const fv = $('fv'), mn = $('mn'), ui = $('ui'), wh = $('wh');
  if (fv) fv.onclick = () => setFpv(!CAM.fpv);
  if (mn && ui) mn.onclick = () => {
    const m = ui.classList.toggle('min');
    mn.textContent = m ? '+' : '–';
    mn.title = m ? 'Expandir painel' : 'Minimizar painel';
  };
  if (wh) wh.onclick = () => {
    wh.classList.toggle('expanded');
  };

  // Atalhos de teclado globais
  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      if (settingsModal && settingsModal.style.display !== 'none') { closeSettings(); return; }
      if (controlsModal && controlsModal.style.display !== 'none') { closeControls(); return; }
    }
    
    // Registra as teclas globalmente para evitar travamento ao liberar controles
    keys[e.code] = 1;

    if (GAME.state !== 'PLAY' || !GAME.canControl) {
      if (e.code === 'KeyV' || e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      return;
    }
    if (e.code === 'KeyV' && !e.repeat && e.target.tagName !== 'INPUT') setFpv(!CAM.fpv);
    if (CAM.fpv && e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (CAM.fpv && e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (e.target.tagName === 'BUTTON') e.target.blur();
    }
  });
  addEventListener('keyup', e => {
    keys[e.code] = 0;
    if (GAME.state === 'PLAY' && GAME.canControl && CAM.fpv && e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
    }
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = 0;
  });

  // Ajustes de mapa procedural
  function mapTick(dt) {
    mapFa += dt;
    mapFn++;
    if (mapFa > .5) {
      const f = mapFn / mapFa;
      mapCool -= mapFa;
      if (mapCool <= 0 && mapAuto) {
        const v = ILHAS.vd();
        if (f < 30 && v > 2) {
          setMapVD(Math.max(2, v - (v > 8 ? 2 : 1)), false);
          mapCool = 5;
        } else if (f > 56 && v < mapVDm) {
          setMapVD(v + 1, false);
          mapCool = 5;
        }
      }
      mapFa = 0;
      mapFn = 0;
    }
  }
  function mapRelocate() {
    resetPlayer();
    if (ILHAS.hit(ST.px, ST.pz, ST.hd)) {
      const s = ILHAS.safeNear(ST.px, ST.pz, ST.hd);
      ST.px = s.x; ST.pz = s.z;
      AN.ax = ST.px + Math.sin(ST.hd) * 5;
      AN.az = ST.pz + Math.cos(ST.hd) * 5;
      ST.v = 0; ST.sw = 0; ST.svx = 0; ST.svz = 0;
    }
    ILHAS.update(ST.px, ST.pz, 0);
  }
  mapVB.forEach(b => b.onclick = () => {
    setMapVD(+b.dataset.vd, true);
  });
  if ($('mapa-rg')) $('mapa-rg').oninput = e => {
    setMapVD(+e.target.value, true);
  };
  if ($('mapa-au')) $('mapa-au').onclick = e => {
    mapAuto = !mapAuto;
    e.currentTarget.classList.toggle('on', mapAuto);
  };
  if ($('mapa-ns')) $('mapa-ns').onclick = () => {
    ILHAS.reseed();
    mapRelocate();
  };
  setMapVD(2);

  setupRadialMenu({ setAll });

  return {
    rows,
    SL,
    rrows,
    hlm,
    btn,
    stx,
    mapTick,
    mapRelocate,
    setAll,
    setWindStr
  };
}

export function formatGameTime() {
  const h = Math.floor(S.time);
  const m = Math.floor((S.time - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  let icon = '☀️';
  if (h >= 5 && h < 7) icon = '🌅';
  else if (h >= 17 && h < 19) icon = '🌇';
  else if (h >= 19 || h < 5) icon = '🌙';
  return `${hh}:${mm} ${icon}`;
}

export function updWindHud(wang) {
  const whA = document.getElementById('wha'), whT = document.getElementById('wht'), whC = document.getElementById('whc');
  if (!whA || !whT) return;
  const rel = wrapA(wang - ST.hd);
  whA.setAttribute('transform', 'translate(50 50) rotate(' + (-rel / D2).toFixed(1) + ')');
  if (whC) {
    whC.setAttribute('transform', 'translate(50 50) rotate(' + (-ST.hd / D2).toFixed(1) + ')');
  }
  whT.innerHTML = 'Horário: ' + formatGameTime() + '<br>Vento ' + Math.round(WI.wsp * 1.944) + ' nós<br>' + potName(Math.abs(rel) / D2) + '<br>Vel. ' + (ST.v * 1.944).toFixed(1) + ' nós<br>Rumo ' + degN(ST.hd) + '°<br>Pos ' + Math.round(ST.px) + ', ' + Math.round(ST.pz) + '<br>Banda ' + Math.round(Math.abs(ST.heel) / D2) + '°' + (Math.abs(ST.heel) > .58 ? ' ⚠ borda na água' : Math.abs(ST.heel) > .25 ? ' ⚠' : '') + (ST.fl ? '<br>velas batendo' : '') + (AN.set ? '<br>⚓ fundeada' : AN.d > .5 ? '<br>⚓ lançada' : '');
}

export function updAnchor(dt) {
  const anb = document.getElementById('an');
  if (AN.up && !AN.wnow) { AN.t = AN.d; AN.up = 0; }
  AN.wnow = 0;
  if (!INT.grab || INT.grab.t !== 'anchor') AN.hold = 0;
  AN.d += clamp(AN.t - AN.d, -.15 * dt, .35 * dt);
  const y = .85 - AN.d * 9, len = Math.max(.01, 1.55 - (y + .8));
  SH.anc.position.y = y;
  SH.arope.position.y = 1.55 - len / 2;
  SH.arope.scale.y = len;
  SH.arope.visible = AN.d > .01;
  SH.cap.rotation.y = AN.d * 40;
  if (anb) {
    anb.textContent = 'Âncora: ' + (AN.set ? 'fundeada (içar)' : AN.d > .97 ? 'arrastando' : AN.d > .02 ? (AN.t > AN.d ? 'descendo' : 'subindo') : AN.t > .5 ? 'descendo' : 'içada (lançar)');
  }
}
