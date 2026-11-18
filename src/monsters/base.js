import * as THREE from 'three';
import { CELL, MONSTER_BASE_SPEED } from '../config.js';

// ---------- hulpjes voor low-poly figuren ----------
export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
}

export function part(parent, geo, material, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  return m;
}

/** Tekst-sprite (naambordje / spraakballon) op een canvas-texture. */
export function makeTextSprite(text, { fg = '#fff', bg = 'rgba(0,0,0,0.7)', border = null, height = 0.32 } = {}) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const setText = (t, color = fg) => {
    const fs = 44;
    ctx.font = `bold ${fs}px monospace`;
    const w = Math.ceil(ctx.measureText(t).width) + 36;
    cv.width = w;
    cv.height = fs + 26;
    ctx.font = `bold ${fs}px monospace`;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, cv.height - 4, 14);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, w / 2, cv.height / 2 + 2);
    tex.needsUpdate = true;
    sprite.scale.set((height * w) / cv.height, height, 1);
  };
  setText(text);
  return { sprite, setText };
}

const FRIGHT_MAT = new THREE.MeshStandardMaterial({ color: 0x2050ff, emissive: 0x1030c0, flatShading: true });
const FLASH_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9999aa, flatShading: true });
const GHOST_MAT = new THREE.MeshBasicMaterial({ color: 0x9fc0ff, wireframe: true, transparent: true, opacity: 0.35 });
const STAR_MAT = new THREE.MeshBasicMaterial({ color: 0xffe14a });
const SOOT_MAT = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1, flatShading: true });
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, alphaMap: shadowAlpha() });

/** Zachte ronde vlek als goedkope contactschaduw. */
function shadowAlpha() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

const angleLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

/**
 * Basisklasse voor alle monsters: grid-beweging van celmidden naar celmidden,
 * A*-pathfinding, schrik-/opgegeten-/verdoofd-toestanden, spiegel-alertheid.
 * Subklassen implementeren buildFigure(), chooseTarget() en optioneel think().
 */
export class Monster {
  constructor(game, { name, color, start, speedFactor = 1, scale = 1 }) {
    this.game = game;
    this.name = name;
    this.color = color;
    this.start = start;
    this.speedFactor = speedFactor;

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.scale.setScalar(scale);
    this.root.add(this.body);
    this.buildFigure(this.body);

    this.meshes = [];
    this.body.traverse((o) => {
      if (o.isMesh) {
        o.userData.mat = o.material;
        this.meshes.push(o);
      }
    });
    this.look = 'normal';

    const label = makeTextSprite(name, { fg: color, border: color, height: 0.26 });
    label.sprite.position.y = 2.55 * scale;
    this.root.add(label.sprite);
    this.bubble = makeTextSprite('...', { fg: '#111', bg: 'rgba(255,255,255,0.92)', height: 0.3 });
    this.bubble.sprite.position.y = 2.95 * scale;
    this.bubble.sprite.visible = false;
    this.root.add(this.bubble.sprite);
    this.bubbleTimer = 0;

    this.stars = new THREE.Group();
    const starGeo = new THREE.OctahedronGeometry(0.09);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(starGeo, STAR_MAT);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
      this.stars.add(s);
    }
    this.stars.position.y = 2.25 * scale;
    this.stars.visible = false;
    this.root.add(this.stars);

    // contactschaduw (staat in root, dus geen materiaalwissel bij schrik/roet)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55 * scale, 20), SHADOW_MAT);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    shadow.renderOrder = 2;
    this.shadow = shadow;
    this.root.add(shadow);

    this.time = Math.random() * 10;
    this.reset();
  }

  // ---- door subklassen te overschrijven ----
  buildFigure() {}
  chooseTarget() {
    return this.game.player.cell;
  }
  think() {}
  onAlert() {}
  onRespawn() {}
  onReset() {}

  reset() {
    this.cell = [...this.start];
    this.prev = null;
    this.next = null;
    const w = this.game.maze.cellToWorld(...this.cell);
    this.x = w.x;
    this.z = w.z;
    this.yaw = 0;
    this.frightened = false;
    this.eaten = false;
    this.stunTimer = 0;
    this.stunKind = null;
    this.collideCooldown = 0;
    this.pauseTimer = 0;
    this.respawning = false;
    this.alertTimer = 0;
    this.alertCooldown = 0;
    this.boostTimer = 0;
    this.boost = 1;
    this.sightTimer = Math.random() * 0.25;
    this.setLook('normal');
    this.stars.visible = false;
    this.bubble.sprite.visible = false;
    this.onReset();
    this.syncMesh();
  }

  get speed() {
    let s = MONSTER_BASE_SPEED * this.game.difficulty.monsterSpeed * this.speedFactor;
    if (this.eaten) return MONSTER_BASE_SPEED * 2.4;
    if (this.frightened) s *= 0.55;
    if (this.alertTimer > 0) s *= 1.2;
    if (this.boostTimer > 0) s *= this.boost;
    return s;
  }

  get harmless() {
    return this.eaten || this.frightened || this.stunTimer > 0 || this.pauseTimer > 0 && this.respawning;
  }

  say(text, seconds = 2.2, color = '#111') {
    this.bubble.setText(text, color);
    this.bubble.sprite.visible = true;
    this.bubbleTimer = seconds;
  }

  setLook(kind) {
    if (this.look === kind) return;
    this.look = kind;
    const m = { fright: FRIGHT_MAT, flash: FLASH_MAT, ghost: GHOST_MAT, soot: SOOT_MAT }[kind] || null;
    for (const mesh of this.meshes) mesh.material = m || mesh.userData.mat;
  }

  setFrightened(on) {
    if (on) {
      if (this.eaten) return;
      this.frightened = true;
      this.reverse();
    } else {
      this.frightened = false;
    }
  }

  getEaten() {
    this.eaten = true;
    this.frightened = false;
    this.stunTimer = 0;
    this.stars.visible = false;
    this.say('Sancties?!', 1.5);
  }

  /** kind: 'shot' (teruggekaatst projectiel) of 'blast' (botsing met ander monster). */
  stun(seconds, kind = 'shot') {
    if (this.eaten) return;
    this.stunTimer = seconds;
    this.stunKind = kind;
    this.stars.visible = true;
    if (kind === 'blast') {
      const lines = ['KABOEM!', 'Diplomatiek incident!', 'Dat was HÚN schuld!', '*kuch kuch*'];
      this.say(lines[(Math.random() * lines.length) | 0], 2.5);
    } else this.say('@#!*', 1.5);
  }

  /** Abrupt omdraaien midden in een gang. */
  reverse() {
    if (this.next) {
      const n = this.next;
      this.next = this.cell;
      this.cell = n;
      this.prev = null;
    }
  }

  alert(via) {
    this.alertTimer = 5;
    this.alertCooldown = 9;
    this.say('!', 1.4, '#d00');
    this.game.sfx.alert();
    if (via === 'mirror') this.game.hud.toast(`${this.name} ziet je via een spiegel!`, 2.2);
    this.onAlert(via);
  }

  // ---- beweging ----
  stepToward(target) {
    if (!target) return this.randomStep();
    const path = this.game.maze.findPath(this.cell, target);
    if (path && path.length) return path[0];
    if (path && path.length === 0) return null; // al op doel
    return this.randomStep();
  }

  randomStep() {
    const maze = this.game.maze;
    let opts = maze.walkableNeighbors(...this.cell).filter((n) => !same(n, this.prev));
    if (!opts.length) opts = maze.walkableNeighbors(...this.cell);
    return opts.length ? opts[(Math.random() * opts.length) | 0] : null;
  }

  fleeStep() {
    const maze = this.game.maze;
    const [pc, pr] = this.game.player.cell;
    let opts = maze.walkableNeighbors(...this.cell).filter((n) => !same(n, this.prev));
    if (!opts.length) opts = maze.walkableNeighbors(...this.cell);
    let best = null;
    let bestScore = -Infinity;
    for (const n of opts) {
      const s = (n[0] - pc) ** 2 + (n[1] - pr) ** 2 + Math.random() * 3;
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    }
    return best;
  }

  pickNext() {
    if (this.eaten) {
      if (same(this.cell, this.start)) {
        this.respawn();
        return null;
      }
      return this.stepToward(this.start);
    }
    if (this.frightened) return this.fleeStep();
    const t = this.chooseTarget();
    if (t === 'flee') return this.fleeStep();
    if (t === 'random') return this.randomStep();
    return this.stepToward(t);
  }

  respawn() {
    this.eaten = false;
    this.frightened = false;
    this.pauseTimer = 1.5;
    this.respawning = true;
    this.say('Ik ben terug.', 1.5);
    this.onRespawn();
  }

  update(dt) {
    this.time += dt;
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.bubble.sprite.visible = false;
    }
    if (this.alertTimer > 0) this.alertTimer -= dt;
    if (this.alertCooldown > 0) this.alertCooldown -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.collideCooldown > 0) this.collideCooldown -= dt;

    // uiterlijk
    const power = this.game.powerTimer;
    if (this.eaten) this.setLook('ghost');
    else if (this.frightened) this.setLook(power < 2 && Math.floor(this.time * 6) % 2 ? 'flash' : 'fright');
    else if (this.stunTimer > 0 && this.stunKind === 'blast') this.setLook('soot');
    else this.setLook('normal');

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.stars.rotation.y += dt * 6;
      this.body.rotation.z = Math.sin(this.time * 12) * 0.2;
      if (this.stunTimer <= 0) {
        this.stars.visible = false;
        this.body.rotation.z = 0;
      }
      this.syncMesh();
      return;
    }
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) this.respawning = false;
      this.syncMesh();
      return;
    }

    if (!this.eaten) {
      this.think(dt);
      this.sightTimer -= dt;
      if (this.sightTimer <= 0) {
        this.sightTimer = 0.25;
        if (!this.frightened && this.alertCooldown <= 0) {
          const p = this.game.player;
          if (this.game.mirrors.seenVia(this.x, this.z, p.x, p.z)) this.alert('mirror');
        }
      }
    }

    let remaining = this.speed * dt;
    let guard = 4;
    while (remaining > 1e-6 && guard-- > 0) {
      if (!this.next) {
        this.next = this.pickNext();
        if (!this.next) break;
      }
      const tx = this.next[0] * CELL;
      const tz = this.next[1] * CELL;
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-4) this.targetYaw = Math.atan2(dx, dz);
      if (d <= remaining) {
        this.x = tx;
        this.z = tz;
        remaining -= d;
        this.prev = this.cell;
        this.cell = this.next;
        this.next = null;
      } else {
        this.x += (dx / d) * remaining;
        this.z += (dz / d) * remaining;
        remaining = 0;
      }
    }
    if (this.targetYaw !== undefined) this.yaw = angleLerp(this.yaw, this.targetYaw, Math.min(1, dt * 10));
    this.syncMesh();
  }

  /** Kijk richting een wereldpunt (bv. voor het schieten). */
  faceToward(x, z) {
    this.targetYaw = Math.atan2(x - this.x, z - this.z);
    this.yaw = this.targetYaw;
  }

  /** Huidige cel op basis van positie (handig midden in een beweging). */
  get nearCell() {
    return this.game.maze.worldToCell(this.x, this.z);
  }

  syncMesh() {
    const bob = Math.abs(Math.sin(this.time * 7)) * 0.06;
    this.root.position.set(this.x, bob, this.z);
    this.shadow.position.y = 0.025 - bob;
    this.shadow.visible = !this.eaten;
    this.root.rotation.y = this.yaw;
    // naambordje/ballon niet meedraaien met het lichaam is niet nodig: sprites kijken altijd naar camera.
  }
}
