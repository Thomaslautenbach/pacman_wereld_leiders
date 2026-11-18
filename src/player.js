import { CELL, EYE_H, PLAYER_RADIUS, PLAYER_SPEED } from './config.js';

const KEYMAP = {
  KeyW: 'f', ArrowUp: 'f',
  KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l',
  KeyD: 'r', ArrowRight: 'r',
};

/** First-person speler: WASD + muis (pointer lock), cirkel-tegen-grid botsing. */
export class Player {
  constructor(camera, lockElement) {
    this.camera = camera;
    this.lockElement = lockElement;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = { f: false, b: false, l: false, r: false };
    this.bobPhase = 0;
    this.roll = 0;
    this.sensitivity = 0.0022;
    this.speedMul = 1; // < 1 in een eco-zone
    this.maze = null;

    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) {
        this.keys[k] = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.keys[k] = false;
    });
    window.addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.lockElement) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-0.7, Math.min(0.7, this.pitch));
    });
  }

  setMaze(maze) {
    this.maze = maze;
  }

  /** Zet speler op een cel en laat hem naar de eerste open gang kijken. */
  reset(c, r) {
    this.x = c * CELL;
    this.z = r * CELL;
    this.pitch = 0;
    this.roll = 0;
    const order = [[0, -1], [-1, 0], [1, 0], [0, 1]];
    for (const [dc, dr] of order) {
      if (this.maze.isWalkable(c + dc, r + dr)) {
        this.yaw = Math.atan2(-dc, -dr);
        break;
      }
    }
    this.syncCamera(0);
  }

  get cell() {
    return this.maze.worldToCell(this.x, this.z);
  }

  /** Kijkrichting in het grondvlak (eenheidsvector). */
  get forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  update(dt) {
    const f = this.forward;
    const rgt = { x: -f.z, z: f.x };
    let mx = 0;
    let mz = 0;
    if (this.keys.f) { mx += f.x; mz += f.z; }
    if (this.keys.b) { mx -= f.x; mz -= f.z; }
    if (this.keys.r) { mx += rgt.x; mz += rgt.z; }
    if (this.keys.l) { mx -= rgt.x; mz -= rgt.z; }
    const len = Math.hypot(mx, mz);
    let moving = 0;
    if (len > 0) {
      const step = (PLAYER_SPEED * this.speedMul * dt) / len;
      // Per as bewegen zodat je langs muren glijdt.
      this.x += mx * step;
      this.resolve();
      this.z += mz * step;
      this.resolve();
      moving = 1;
    }
    this.bobPhase += dt * 9 * moving * this.speedMul;
    this.syncCamera(moving);
  }

  syncCamera(moving) {
    const bob = moving ? Math.sin(this.bobPhase) * 0.05 : 0;
    this.camera.position.set(this.x, EYE_H + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  /** Duw de spelercirkel uit alle geblokkeerde cellen rondom. */
  resolve() {
    const R = PLAYER_RADIUS;
    const half = CELL / 2;
    const [c0, r0] = this.maze.worldToCell(this.x, this.z);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (!this.maze.isBlocked(c, r)) continue;
        const minX = c * CELL - half;
        const maxX = c * CELL + half;
        const minZ = r * CELL - half;
        const maxZ = r * CELL + half;
        const nx = Math.max(minX, Math.min(this.x, maxX));
        const nz = Math.max(minZ, Math.min(this.z, maxZ));
        const dx = this.x - nx;
        const dz = this.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          this.x += (dx / d) * (R - d);
          this.z += (dz / d) * (R - d);
        } else {
          // Middelpunt in de muur (bv. net geannexeerd): kortste weg eruit.
          const pushes = [
            [minX - R - this.x, 0], [maxX + R - this.x, 0],
            [0, minZ - R - this.z], [0, maxZ + R - this.z],
          ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          this.x += pushes[0][0];
          this.z += pushes[0][1];
        }
      }
  }
}
