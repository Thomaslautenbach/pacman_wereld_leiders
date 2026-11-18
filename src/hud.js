/** DOM-HUD: score/level/levens rechtsboven, toasts, overlay-schermen. */
export class Hud {
  constructor() {
    this.el = {
      score: document.getElementById('hud-score'),
      level: document.getElementById('hud-level'),
      lives: document.getElementById('hud-lives'),
      power: document.getElementById('hud-power'),
      powerBar: document.getElementById('hud-power-bar'),
      toast: document.getElementById('toast'),
      flash: document.getElementById('flash'),
      overlay: document.getElementById('overlay'),
      title: document.getElementById('overlay-title'),
      sub: document.getElementById('overlay-sub'),
      quote: document.getElementById('overlay-quote'),
      body: document.getElementById('overlay-body'),
      hint: document.getElementById('overlay-hint'),
    };
    this.toastTimer = 0;
    this.lastScore = null;
  }

  setScore(v) {
    if (v !== this.lastScore) this.el.score.textContent = String(v).padStart(6, '0');
    this.lastScore = v;
  }
  setLevel(n, name) {
    this.el.level.textContent = `${n} · ${name}`;
  }
  setLives(n) {
    this.el.lives.textContent = '●'.repeat(Math.max(0, n)) || '-';
  }
  setPower(frac) {
    if (frac == null || frac <= 0) {
      this.el.power.classList.remove('active');
      return;
    }
    this.el.power.classList.add('active');
    this.el.powerBar.style.width = `${Math.round(frac * 100)}%`;
  }
  setEco(on) {
    document.getElementById('eco').classList.toggle('active', on);
  }
  setAccent(color) {
    document.documentElement.style.setProperty('--accent', color);
  }

  toast(msg, seconds = 2.5) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  flash(color = '#fff', strength = 0.6) {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = String(strength);
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.5s';
      f.style.opacity = '0';
    });
  }

  update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
  }

  showOverlay({ title = '', sub = '', quote = '', cite = '', body = '', hint = 'KLIK OM VERDER TE GAAN' }) {
    const e = this.el;
    e.title.textContent = title;
    e.sub.textContent = sub;
    e.quote.innerHTML = '';
    if (quote) {
      e.quote.textContent = `“${quote}”`;
      if (cite) {
        const c = document.createElement('cite');
        c.textContent = `— ${cite}`;
        e.quote.appendChild(c);
      }
    }
    e.body.innerHTML = body;
    e.hint.textContent = hint;
    e.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
  }
}
