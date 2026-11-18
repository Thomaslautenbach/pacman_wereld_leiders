/** Retro arcade-geluiden, volledig gesynthetiseerd met de Web Audio API. */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.chompFlip = false;
    this.siren = null;
    this.muted = false;
  }

  /** Moet vanuit een user-gesture aangeroepen worden. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, to = null, delay = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, { vol = 0.3, delay = 0, freq = 1200 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
  }

  melody(notes, { type = 'square', vol = 0.22, step = 0.12 } = {}) {
    notes.forEach((n, i) => {
      if (n) this.tone(n, step * 0.9, { type, vol, delay: i * step });
    });
  }

  chomp() {
    this.chompFlip = !this.chompFlip;
    this.tone(this.chompFlip ? 520 : 380, 0.07, { type: 'triangle', vol: 0.25, to: this.chompFlip ? 300 : 560 });
  }
  powerUp() {
    this.melody([392, 523, 659, 784, 1047], { type: 'square', vol: 0.18, step: 0.07 });
  }
  startSiren() {
    if (!this.ctx || this.siren) return;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 600;
    lfo.frequency.value = 6;
    lfoGain.gain.value = 180;
    g.gain.value = 0.06;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(g).connect(this.master);
    osc.start();
    lfo.start();
    this.siren = { osc, lfo };
  }
  stopSiren() {
    if (!this.siren) return;
    this.siren.osc.stop();
    this.siren.lfo.stop();
    this.siren = null;
  }
  eatMonster() {
    this.tone(200, 0.35, { type: 'sawtooth', vol: 0.25, to: 1600 });
    this.tone(1600, 0.15, { type: 'square', vol: 0.12, delay: 0.3, to: 2400 });
  }
  death() {
    this.tone(880, 1.2, { type: 'square', vol: 0.22, to: 60 });
    this.noise(0.5, { vol: 0.25, delay: 0.9, freq: 600 });
  }
  shoot() {
    this.tone(1400, 0.25, { type: 'sawtooth', vol: 0.15, to: 300 });
    this.noise(0.15, { vol: 0.15, freq: 3000 });
  }
  bounce() {
    this.tone(2200, 0.12, { type: 'sine', vol: 0.25, to: 3400 });
    this.tone(3300, 0.2, { type: 'sine', vol: 0.12, delay: 0.04 });
  }
  explode() {
    this.noise(0.35, { vol: 0.3, freq: 900 });
  }
  stun() {
    this.melody([1318, 1046, 1318, 1046], { type: 'triangle', vol: 0.2, step: 0.06 });
  }
  annex() {
    this.tone(90, 0.6, { type: 'sawtooth', vol: 0.3, to: 45 });
    this.noise(0.5, { vol: 0.2, freq: 400 });
  }
  fake() {
    this.tone(300, 0.15, { type: 'square', vol: 0.25 });
    this.tone(200, 0.4, { type: 'square', vol: 0.25, delay: 0.15, to: 120 });
  }
  /** Atoomdreun: lage sweep + lang gerommel. `v` = luidheid (afstand). */
  nuke(v = 1) {
    this.noise(0.25, { vol: 0.5 * v, freq: 5000 });
    this.tone(140, 2.4, { type: 'sine', vol: 0.55 * v, to: 26, attack: 0.01 });
    this.tone(70, 2.8, { type: 'triangle', vol: 0.35 * v, to: 22, delay: 0.05 });
    this.noise(3.2, { vol: 0.45 * v, freq: 260, delay: 0.1 });
    this.noise(2.0, { vol: 0.25 * v, freq: 140, delay: 1.2 });
  }
  /** Fietsbel + zacht akkoord voor de eco-zone. */
  eco() {
    this.tone(2400, 0.25, { type: 'sine', vol: 0.18 });
    this.tone(2400, 0.35, { type: 'sine', vol: 0.18, delay: 0.14 });
    this.melody([0, 0, 523, 659, 784], { type: 'triangle', vol: 0.12, step: 0.1 });
  }
  drop() {
    this.melody([660, 880], { type: 'triangle', vol: 0.12, step: 0.08 });
  }
  alert() {
    this.tone(1000, 0.08, { type: 'square', vol: 0.18 });
    this.tone(1400, 0.12, { type: 'square', vol: 0.18, delay: 0.09 });
  }
  bluff() {
    this.tone(500, 0.12, { type: 'sawtooth', vol: 0.2, to: 900 });
    this.tone(900, 0.18, { type: 'sawtooth', vol: 0.2, delay: 0.12, to: 400 });
  }
  levelComplete() {
    this.melody([523, 659, 784, 1047, 0, 784, 1047, 1319], { type: 'square', vol: 0.2, step: 0.12 });
  }
  gameOver() {
    this.melody([392, 370, 349, 330, 0, 262], { type: 'triangle', vol: 0.28, step: 0.25 });
  }
  start() {
    this.melody([523, 1047, 784, 659, 1047, 784, 659, 0, 554, 1109, 831, 698], { type: 'square', vol: 0.15, step: 0.1 });
  }
}
