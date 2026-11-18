import * as THREE from 'three';
import { CELL } from './config.js';

const SPEED = 9;
const HEIGHT = 1.35;
const MAX_LIFE = 7;
const MAX_BOUNCES = 6;

/** Projectielen van Kim Jong-Oen. Kaatsen terug op spiegels; teruggekaatst verdooft monsters. */
export class Projectiles {
  constructor(maze, sfx) {
    this.maze = maze;
    this.sfx = sfx;
    this.list = [];
    this.effects = [];
    this.group = new THREE.Group();
    this.bodyGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8);
    this.noseGeo = new THREE.ConeGeometry(0.07, 0.2, 8);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x552222, metalness: 0.4 });
    this.noseMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    this.glowMat = new THREE.SpriteMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glowMatBlue = new THREE.SpriteMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.boomMat = new THREE.SpriteMaterial({ color: 0xffaa33, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  fire(owner, x, z, dx, dz) {
    const len = Math.hypot(dx, dz) || 1;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    const nose = new THREE.Mesh(this.noseGeo, this.noseMat);
    nose.position.y = 0.35;
    const inner = new THREE.Group();
    inner.add(body, nose);
    inner.rotation.x = Math.PI / 2; // as langs +z
    mesh.add(inner);
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.set(0.7, 0.7, 1);
    glow.position.z = -0.35;
    mesh.add(glow);
    this.group.add(mesh);
    const p = { owner, x, z, vx: (dx / len) * SPEED, vz: (dz / len) * SPEED, life: MAX_LIFE, bounces: 0, reflected: false, hitPlayer: false, mesh, glow };
    this.orient(p);
    this.list.push(p);
    this.sfx.shoot();
    return p;
  }

  orient(p) {
    p.mesh.position.set(p.x, HEIGHT, p.z);
    p.mesh.rotation.y = Math.atan2(p.vx, p.vz);
  }

  boom(x, z, color = null) {
    const s = new THREE.Sprite((color ? this.glowMatBlue : this.boomMat).clone());
    s.position.set(x, HEIGHT, z);
    s.scale.set(0.3, 0.3, 1);
    this.group.add(s);
    this.effects.push({ s, t: 0 });
  }

  /**
   * hooks: { player: {x,z}, monsters: [...], onPlayerHit(p), onMonsterHit(p, m), onEnd(p) }
   */
  update(dt, hooks) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      let alive = p.life > 0;
      const steps = Math.ceil((SPEED * dt) / 0.1);
      const sdt = dt / steps;
      for (let s = 0; s < steps && alive; s++) {
        const [pc, pr] = this.maze.worldToCell(p.x, p.z);
        const nx = p.x + p.vx * sdt;
        const nz = p.z + p.vz * sdt;
        const [c, r] = this.maze.worldToCell(nx, nz);
        if (this.maze.isBlocked(c, r)) {
          if (this.maze.isMirror(c, r) && !this.maze.isTempWall(c, r) && p.bounces < MAX_BOUNCES) {
            if (c !== pc) p.vx = -p.vx;
            if (r !== pr) p.vz = -p.vz;
            p.bounces++;
            p.reflected = true;
            p.glow.material = this.glowMatBlue;
            this.sfx.bounce();
            this.boom(p.x, p.z, 'blue');
            this.orient(p);
            continue;
          }
          this.boom(p.x, p.z);
          this.sfx.explode();
          alive = false;
          break;
        }
        p.x = nx;
        p.z = nz;
        // speler geraakt?
        if (Math.hypot(p.x - hooks.player.x, p.z - hooks.player.z) < 0.55) {
          p.hitPlayer = true;
          this.boom(p.x, p.z);
          hooks.onPlayerHit(p);
          alive = false;
          break;
        }
        // teruggekaatst schot verdooft monsters
        if (p.reflected) {
          for (const m of hooks.monsters) {
            if (m.eaten) continue;
            if (Math.hypot(p.x - m.x, p.z - m.z) < 0.75) {
              this.boom(p.x, p.z, 'blue');
              hooks.onMonsterHit(p, m);
              alive = false;
              break;
            }
          }
        }
      }
      if (alive) this.orient(p);
      else {
        this.group.remove(p.mesh);
        this.list.splice(i, 1);
        hooks.onEnd(p);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = e.t / 0.35;
      e.s.scale.setScalar(0.3 + k * 1.6);
      e.s.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.group.remove(e.s);
        e.s.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.list) this.group.remove(p.mesh);
    this.list.length = 0;
  }

  get points() {
    return this.list;
  }
}

export const PROJECTILE_RANGE = 15 * CELL;
