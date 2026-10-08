/**
 * AudioManager - Galeão
 * Single AudioContext manager with synthesized sounds.
 */

const SR = 44100;
const R = Math.random;
const nb = new WeakMap();

// --- SYNTHESIS FUNCTIONS (DO NOT ALTER LOGIC) ---

function noise(c) {
  if (!nb.has(c)) {
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nb.set(c, b);
  }
  return nb.get(c);
}

function env(g, t, a, pk, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function N(c, o, t, dur, type, f0, f1, q, pk, a, d) {
  const s = c.createBufferSource();
  s.buffer = noise(c); s.loop = true;
  const f = c.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  env(g, t, a, pk, d);
  s.connect(f).connect(g).connect(o);
  s.start(t, R() * 1.5);
  s.stop(t + Math.max(dur, a + d) + 0.1);
}

function T(c, o, t, f0, f1, dur, pk, type = 'sine') {
  const x = c.createOscillator();
  x.type = type;
  x.frequency.setValueAtTime(f0, t);
  x.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  env(g, t, 0.004, pk, dur);
  x.connect(g).connect(o);
  x.start(t);
  x.stop(t + dur + 0.05);
}

function splash(c, o, t, k = 1) {
  N(c, o, t, .05, 'lowpass', 7000, 5000, .4, .9, .001, .05);
  N(c, o, t, .5 * k, 'lowpass', 3800, 2200, .5, .6, .004, .35 * k);
  N(c, o, t, .3 * k, 'highpass', 4500, 4500, .4, .3, .003, .22 * k);
  for (let i = 0, n = Math.round(8 + 14 * k); i < n; i++) {
    const f = 3000 + R() * 4000;
    N(c, o, t + .05 + Math.pow(R(), 1.6) * .7 * k, .03, 'bandpass', f, f, 6, .08 + R() * .12, .001, .015 + R() * .02);
  }
}

function gotas(c, o, t) {
  for (let i = 0; i < 14; i++) {
    const f = 3000 + R() * 4000;
    N(c, o, t + Math.pow(R(), 1.4) * .8, .03, 'bandpass', f, f, 6, .1 + R() * .15, .001, .015 + R() * .02);
  }
}

function plop(c, o, t) { T(c, o, t, 480, 190, .09, .6); }

function ar_cortando(c, o, t) { N(c, o, t, .3, 'bandpass', 600, 3800, 1.5, .7, .05, .25); }

function linha_assobio(c, o, t) { N(c, o, t, .9, 'bandpass', 6500, 4500, 6, .14, .06, .84); }

function click(c, o, t) {
  N(c, o, t, .03, 'bandpass', 3300 + R() * 500, 3300, 4, .5 + R() * .2, .001, .014);
}

function freada(c, o, t) {
  N(c, o, t, .06, 'lowpass', 2500, 900, 1, .7, .002, .05);
}

function casco(c, o, t, k = 1) { N(c, o, t, .6, 'lowpass', 1100, 450, .7, .8 * k, .03, .55); }

function praia(c, o, t) {
  N(c, o, t, 1.8, 'lowpass', 350, 3200, .6, .6, 1.7, .5);
  N(c, o, t + 1.7, 3.4, 'highpass', 3500, 2500, .5, .22, .15, 3.2);
}

function gaivota_nota(c, o, t, b, len, pk) {
  const x = c.createOscillator();
  x.type = 'sawtooth';
  x.frequency.setValueAtTime(b * .85, t);
  x.frequency.linearRampToValueAtTime(b * 1.5, t + len * .3);
  x.frequency.linearRampToValueAtTime(b, t + len);
  const l = c.createOscillator(), lg = c.createGain();
  l.frequency.value = 28 + R() * 10;
  lg.gain.value = b * .05;
  l.connect(lg).connect(x.frequency);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = b * 1.8;
  f.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(.0001, t);
  g.gain.linearRampToValueAtTime(pk, t + .04);
  g.gain.setValueAtTime(pk, t + len * .6);
  g.gain.exponentialRampToValueAtTime(.0001, t + len);
  x.connect(f).connect(g).connect(o);
  x.start(t);
  l.start(t);
  x.stop(t + len + .05);
  l.stop(t + len + .05);
}

function gaivota(c, o, t, b = 1000 + R() * 250, pk = .5) {
  let x = 0;
  for (let i = 0, n = 3 + Math.round(R()); i < n; i++) {
    const len = .32 + R() * .15;
    gaivota_nota(c, o, t + x, b * (1 - i * .04), len, pk);
    x += len + .08;
  }
}

function bando(c, o, t) {
  for (let i = 0; i < 3; i++) gaivota(c, o, t + R() * 1.5, 850 + R() * 500, .25 + R() * .2);
}

function peixe_agua(c, o, t) {
  let x = 0;
  for (let i = 0; i < 9; i++) {
    const k = Math.pow(.82, i);
    N(c, o, t + x, .2, 'lowpass', 2800, 900, .6, .7 * k + .1, .004, .12 + .1 * k);
    N(c, o, t + x + .01, .15, 'bandpass', 4500, 4500, .8, .25 * k, .003, .1 * k);
    x += .07 + R() * .16 + i * .03;
  }
}

function peixe_convez(c, o, t) {
  let x = 0;
  for (let i = 0; i < 7; i++) {
    const k = Math.pow(.8, i);
    T(c, o, t + x, 160, 70, .06, .55 * k + .05);
    N(c, o, t + x, .08, 'bandpass', 1800, 1200, 1.2, .5 * k + .05, .002, .05);
    x += .12 + R() * .2 + i * .05;
  }
}

function criarCarretelLancando(ac, saida) {
  let rodando = false, rate = 0, prox = 0, timer = null;
  function agendar() {
    if (!rodando || rate <= 0) return;
    const agora = ac.currentTime;
    while (prox < agora + 0.1) {
      click(ac, saida, Math.max(prox, agora));
      prox += (1 / Math.max(rate, 0.1)) * (0.92 + Math.random() * 0.16);
    }
  }
  return {
    iniciar(cliquesPorSeg = 80) {
      rate = cliquesPorSeg;
      if (!rodando) {
        rodando = true;
        prox = ac.currentTime;
        timer = setInterval(agendar, 25);
      }
      agendar();
    },
    velocidade(cliquesPorSeg) {
      rate = cliquesPorSeg;
    },
    parar(comFreada = true) {
      if (!rodando) return;
      rodando = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (comFreada) freada(ac, saida, ac.currentTime);
    }
  };
}

// --- MANAGER CLASS ---

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.debug = false;
    this.carretel = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.carretel = criarCarretelLancando(this.ctx, this.master);
    this.enabled = true;

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(name, params = {}) {
    if (!this.enabled) this.init();
    if (!this.enabled) return;
    this.resume();
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    // Variação de volume 0.85 a 1.0
    g.gain.value = params.vol || (0.85 + R() * 0.15);
    g.connect(this.master);

    if (this.debug) console.log(`[Audio] ${name} @ ${t.toFixed(3)}s (State: ${this.ctx.state})`);

    switch (name) {
      case 'splash': splash(this.ctx, g, t, params.k || 1); break;
      case 'plop': plop(this.ctx, g, t); break;
      case 'ar_cortando': ar_cortando(this.ctx, g, t); break;
      case 'linha_assobio': linha_assobio(this.ctx, g, t); break;
      case 'click': click(this.ctx, g, t); break;
      case 'freada': freada(this.ctx, g, t); break;
      case 'carretel_freada': freada(this.ctx, g, t); break;
      case 'onda_casco': casco(this.ctx, g, t, params.k || 1); break;
      case 'onda_praia': praia(this.ctx, g, t); break;
      case 'gaivota': gaivota(this.ctx, g, t); break;
      case 'bando': bando(this.ctx, g, t); break;
      case 'peixe_agua': peixe_agua(this.ctx, g, t); break;
      case 'peixe_convez': peixe_convez(this.ctx, g, t); break;
      case 'gotas': gotas(this.ctx, g, t); break;
    }
  }

  reelStart(rate = 80) {
    if (!this.enabled) this.init();
    this.resume();
    if (this.carretel) {
      this.carretel.iniciar(rate);
    }
  }

  reelSpeed(rate) {
    if (!this.enabled) this.init();
    if (this.carretel) {
      if (rate <= 0) {
        this.carretel.velocidade(0);
      } else {
        this.carretel.iniciar(rate);
        this.carretel.velocidade(rate);
      }
    }
  }

  reelStop(comFreada = true) {
    if (this.carretel) {
      this.carretel.parar(comFreada);
    }
  }

  testar(nome) {
    if (!this.enabled) this.init();
    this.play(nome);
  }
}

export const Audio = new AudioManager();
