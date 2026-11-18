import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CELL, WALL_H, DIRS } from './config.js';

const MAX_ACTIVE = 4; // zoveel echte reflecties renderen we tegelijk (performance)
const MIRROR_W = CELL * 0.86;
const MIRROR_H = WALL_H * 0.78;
const MIRROR_Y = MIRROR_H / 2 + 0.15;

let inReflectorPass = false;

/**
 * Spiegels: elk vlak van een 'M'-cel dat aan een open gang grenst krijgt een
 * Three.js Reflector. Daarnaast wiskunde voor kaatsende projectielen en
 * monsters die de speler via een spiegel zien.
 */
export class Mirrors {
  constructor(maze) {
    this.maze = maze;
    this.faces = [];
    this.group = new THREE.Group();
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xa9b8c6, metalness: 1, roughness: 0.18, emissive: 0x1b2530,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9d3dc, metalness: 0.9, roughness: 0.3 });
    const geo = new THREE.PlaneGeometry(MIRROR_W, MIRROR_H);

    for (const [c, r] of maze.mirrorCells) {
      for (const [dc, dr] of DIRS) {
        if (maze.isWall(c + dc, r + dr)) continue;
        const n = new THREE.Vector3(dc, 0, dr);
        const center = new THREE.Vector3(c * CELL + dc * (CELL / 2 + 0.02), MIRROR_Y, r * CELL + dr * (CELL / 2 + 0.02));
        const rotY = Math.atan2(dc, dr);

        const reflector = new Reflector(geo, {
          textureWidth: 512,
          textureHeight: 512,
          color: 0xb8c4cc,
          clipBias: 0.003,
        });
        reflector.position.copy(center);
        reflector.rotation.y = rotY;
        // Voorkom dat spiegels elkaar recursief renderen.
        const orig = reflector.onBeforeRender.bind(reflector);
        reflector.onBeforeRender = (renderer, scene, camera) => {
          if (inReflectorPass) return;
          inReflectorPass = true;
          try {
            orig(renderer, scene, camera);
          } finally {
            inReflectorPass = false;
          }
        };

        const fallback = new THREE.Mesh(geo, fallbackMat);
        fallback.position.copy(center);
        fallback.rotation.y = rotY;
        fallback.visible = false;

        // Lijst rond de spiegel
        const frame = new THREE.Group();
        const t = 0.08;
        const bar = (w, h, x, y) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
          m.position.set(x, y, 0);
          frame.add(m);
        };
        bar(MIRROR_W + t * 2, t, 0, MIRROR_H / 2 + t / 2);
        bar(MIRROR_W + t * 2, t, 0, -MIRROR_H / 2 - t / 2);
        bar(t, MIRROR_H, MIRROR_W / 2 + t / 2, 0);
        bar(t, MIRROR_H, -MIRROR_W / 2 - t / 2, 0);
        frame.position.copy(center);
        frame.rotation.y = rotY;

        this.group.add(reflector, fallback, frame);
        this.faces.push({ c, r, n, center, reflector, fallback, tangent: new THREE.Vector3(-dr, 0, dc) });
      }
    }
  }

  /** Kies per frame welke spiegels echt reflecteren (dichtstbij, zichtbaar, naar camera gericht). */
  update(camera) {
    const cam = camera.position;
    const candidates = [];
    for (const f of this.faces) {
      const toCam = new THREE.Vector3().subVectors(cam, f.center);
      const facing = toCam.dot(f.n) > 0.05;
      const dist = toCam.length();
      const front = f.center.clone().addScaledVector(f.n, 0.3);
      const seen = facing && dist < 30 * CELL && this.maze.lineOfSight(cam.x, cam.z, front.x, front.z, 0.3);
      if (seen) candidates.push({ f, dist });
      f.reflector.visible = false;
      f.fallback.visible = true;
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (const { f } of candidates.slice(0, MAX_ACTIVE)) {
      f.reflector.visible = true;
      f.fallback.visible = false;
    }
  }

  /**
   * Ziet een waarnemer (a) het doel (b) via een spiegel? Spiegel b in het vlak,
   * snijd de lijn a→b' met het vlak en controleer zichtlijnen beide kanten op.
   */
  seenVia(ax, az, bx, bz, maxDist = 18 * CELL) {
    for (const f of this.faces) {
      const p = f.center;
      const n = f.n;
      const da = (ax - p.x) * n.x + (az - p.z) * n.z;
      const db = (bx - p.x) * n.x + (bz - p.z) * n.z;
      if (da <= 0.05 || db <= 0.05) continue;
      // gespiegeld doel
      const rx = bx - 2 * db * n.x;
      const rz = bz - 2 * db * n.z;
      const t = da / (da + db);
      const ix = ax + (rx - ax) * t;
      const iz = az + (rz - az) * t;
      const along = (ix - p.x) * f.tangent.x + (iz - p.z) * f.tangent.z;
      if (Math.abs(along) > MIRROR_W / 2) continue;
      const total = Math.hypot(ix - ax, iz - az) + Math.hypot(bx - ix, bz - iz);
      if (total > maxDist) continue;
      const fx = ix + n.x * 0.3;
      const fz = iz + n.z * 0.3;
      if (this.maze.lineOfSight(ax, az, fx, fz) && this.maze.lineOfSight(fx, fz, bx, bz)) return f;
    }
    return null;
  }

  dispose() {
    for (const f of this.faces) f.reflector.dispose();
    this.group.traverse((o) => {
      if (o.isMesh && o.geometry) o.geometry.dispose();
    });
  }
}
