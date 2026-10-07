export const S = { c: .04, t: .04, time: 8.0 };
export const WI = { dir: .45, a: .45, str: .15, s: .15, wsp: 3.75 };
export const ST = { v: 0, hd: 0, heel: 0, hr: 0, sw: 0, r: 0, fl: 0, px: 0, pz: 0, svx: 0, svz: 0, vy: 0.4, pt: 0, rl: 0 };
export const SEAS = { amp: .1, st: .2, chop: .04, wt: 0 };
export const CAM = { yaw: .5, pit: .2, dist: 32, drag: false, auto: true, fpv: false };
export const GAME = { state: 'MENU', canControl: false, backpack: [], discoveredSpecies: [] };
export const INT = { near: null, grab: null, ePrev: false, tHold: false, tFree: false, tJump: false, pX: 0, pY: 0, limHit: false, tDec: false, tInc: false };
export const UIS = { mode: -1, tmode: false };
export const LT = { nl: 3, flash: 0 };
export const FX = { SPD: 0 };
export const FL = { a: 0 };
export const HM = { a: 0, t: 0 };
export const AN = { d: 1, t: 1, set: 1, ax: 0, az: 5, up: 0, wnow: 0, hold: 0 };
export const PL = { m: 'ship', vy: 0, air: false, wet: false, s: 1, cy: 0, vx: 0, vz: 0, wx: 0, wz: 0, y: 0, ladder: null };
export const fp = { x: 0, y: .35, z: .9, yaw: Math.PI, pit: 0 };
export const keys = {};
export const joy = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };
export const lk = { id: -1, x: 0, y: 0 };

const savedGfx = (() => {
  try {
    const raw = localStorage.getItem('mar_de_pivetes_gfx');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
})();

export const GFX = Object.assign({
  quality: 'high',   // 'low' | 'med' | 'high' | 'ultra'
  shadows: 'soft',   // 'off' | 'med' | 'soft'
  exposure: 1.0,     // 0.5 .. 2.0
  glare: 1.0,        // 0.0 .. 2.0
  oceanFoam: 1.0     // 0.2 .. 2.0
}, savedGfx);

export function saveGfxState() {
  try {
    localStorage.setItem('mar_de_pivetes_gfx', JSON.stringify(GFX));
  } catch (_) {}
}

const savedSettings = (() => {
  try {
    const raw = localStorage.getItem('mar_de_pivetes_settings');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
})();

export const SETTINGS = Object.assign({
  oceanCondition: 0.04,
  waveIntensity: 4,
  windStrength: 0.15,
  windDir: 26,
  renderDist: 2,
  terrainHeight: 8.5,
  terrainDepth: 12,
  terrainSpacing: 220,
  terrainDensity: 80,
  autoCam: true,
  wireframe: false,
  showFps: true
}, savedSettings);

// Garante que o jogo sempre inicia em estado Calmo por padrão e vento normalizado
if (SETTINGS.oceanCondition > 0.5) SETTINGS.oceanCondition = 0.04;
if (SETTINGS.waveIntensity > 50) SETTINGS.waveIntensity = 4;
if (SETTINGS.windStrength > 1.0) SETTINGS.windStrength = SETTINGS.windStrength / 100;
if (SETTINGS.windStrength > 1.0 || SETTINGS.windStrength < 0) SETTINGS.windStrength = 0.15;

export function saveSettingsState() {
  try {
    localStorage.setItem('mar_de_pivetes_settings', JSON.stringify(SETTINGS));
  } catch (_) {}
}

