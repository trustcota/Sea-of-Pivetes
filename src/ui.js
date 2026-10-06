import { clamp, D2, wrapA } from './core/math.js';
import { S, WI, ST, CAM, UIS, HM, AN, INT, keys } from './core/state.js';
import { setFpv, resetPlayer } from './ship/player.js';
import { SH } from './ship/ship.js';
import { ILHAS } from './world/archipelago.js';

export const degN = r => ((Math.round(r / D2) % 360) + 360) % 360;
export const potName = g => g < 30 ? 'de popa' : g < 80 ? 'alheta' : g < 110 ? 'través' : g < 155 ? 'bolina' : 'de proa';

export function setupUI() {
  const $ = id => document.getElementById(id);
  const anb = $('an');
  if (anb) anb.onclick = () => { AN.t = AN.t > .5 ? 0 : 1; };

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
  };
  if (wf) wf.onclick = () => {
    const on = wf.classList.toggle('on');
    SH.mats.forEach(m => m.wireframe = on);
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
  if (wsl) wsl.oninput = () => { WI.str = wsl.value / 100; };
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
    if (e.code === 'KeyV' && !e.repeat && e.target.tagName !== 'INPUT') setFpv(!CAM.fpv);
    keys[e.code] = 1;
    if (CAM.fpv && e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (CAM.fpv && e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (e.target.tagName === 'BUTTON') e.target.blur();
    }
  });
  addEventListener('keyup', e => {
    keys[e.code] = 0;
    if (CAM.fpv && e.code === 'Space' && e.target.tagName !== 'INPUT') e.preventDefault();
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = 0;
  });

  // Ajustes de mapa procedural
  let mapAuto = true, mapVDm = 2, mapFa = 0, mapFn = 0, mapCool = 0;
  const mapVB = [...document.querySelectorAll('[data-vd]')];
  function setMapVD(v) {
    ILHAS.setVD(v);
    if ($('mapa-rg')) $('mapa-rg').value = v;
    if ($('mapa-rgv')) $('mapa-rgv').textContent = Math.round((v - .35) * ILHAS.CS) + ' m';
  }
  function mapTick(dt) {
    mapFa += dt;
    mapFn++;
    if (mapFa > .5) {
      const f = mapFn / mapFa;
      mapCool -= mapFa;
      if (mapCool <= 0 && mapAuto) {
        const v = ILHAS.vd();
        if (f < 30 && v > 2) {
          setMapVD(Math.max(2, v - (v > 8 ? 2 : 1)));
          mapCool = 5;
        } else if (f > 56 && v < mapVDm) {
          setMapVD(v + 1);
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
    mapVDm = +b.dataset.vd;
    setMapVD(mapVDm);
    mapVB.forEach(x => x.classList.toggle('on', x === b));
  });
  if ($('mapa-rg')) $('mapa-rg').oninput = e => {
    mapVDm = +e.target.value;
    setMapVD(mapVDm);
    mapVB.forEach(x => x.classList.toggle('on', +x.dataset.vd === mapVDm));
  };
  if ($('mapa-au')) $('mapa-au').onclick = e => {
    mapAuto = !mapAuto;
    e.currentTarget.classList.toggle('on', mapAuto);
  };
  if ($('mapa-ns')) $('mapa-ns').onclick = () => {
    ILHAS.reseed();
    mapRelocate();
  };
  [['gh', 'height', 1, ''], ['gd', 'depth', 1, ''], ['gs', 'spacing', 1, ''], ['gn', 'density', .01, '%']].forEach(([id, k, sc2, u]) => {
    const el = $('mapa-' + id), lb = $('mapa-' + id + 'v');
    if (!el || !lb) return;
    const show = () => lb.textContent = (k == 'density' ? Math.round(el.value) : el.value) + (u || '');
    el.value = k == 'density' ? ILHAS.GEN[k] * 100 : ILHAS.GEN[k];
    show();
    el.oninput = show;
    el.onchange = () => {
      ILHAS.setCfg(k, k == 'density' ? el.value / 100 : +el.value);
      mapRelocate();
    };
  });
  setMapVD(2);

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

export function updWindHud(wang) {
  const whA = document.getElementById('wha'), whT = document.getElementById('wht'), whC = document.getElementById('whc');
  if (!whA || !whT) return;
  const rel = wrapA(wang - ST.hd);
  whA.setAttribute('transform', 'translate(50 50) rotate(' + (-rel / D2).toFixed(1) + ')');
  if (whC) {
    whC.setAttribute('transform', 'translate(50 50) rotate(' + (-ST.hd / D2).toFixed(1) + ')');
  }
  whT.innerHTML = 'Vento ' + Math.round(WI.wsp * 1.944) + ' nós<br>' + potName(Math.abs(rel) / D2) + '<br>Vel. ' + (ST.v * 1.944).toFixed(1) + ' nós<br>Rumo ' + degN(ST.hd) + '°<br>Pos ' + Math.round(ST.px) + ', ' + Math.round(ST.pz) + '<br>Banda ' + Math.round(Math.abs(ST.heel) / D2) + '°' + (Math.abs(ST.heel) > .58 ? ' ⚠ borda na água' : Math.abs(ST.heel) > .25 ? ' ⚠' : '') + '<br>GZ ' + Math.round(100 * Math.max(0, Math.sin(Math.abs(ST.heel)) * (1 - Math.pow(ST.heel / 1.1, 2))) / .4) + '% do máx' + (ST.fl ? '<br>velas batendo' : '') + (AN.set ? '<br>⚓ fundeada' : AN.d > .5 ? '<br>⚓ lançada' : '');
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
