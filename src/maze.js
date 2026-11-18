import * as THREE from 'three';
import { CELL, WALL_H, DIRS } from './config.js';
import { astar } from './pathfinding.js';

// ---------- procedurele texturen ----------
function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wallTextures(theme) {
  const map = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = theme.wall;
    g.fillRect(0, 0, w, h);
    // subtiele panelen
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 64) g.fillRect(6, y + 6, w - 12, 52);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    // nep-ambient-occlusion: donker aan de voet, lichte rand bovenaan
    const ao = g.createLinearGradient(0, h, 0, h * 0.6);
    ao.addColorStop(0, 'rgba(0,0,0,0.55)');
    ao.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ao;
    g.fillRect(0, h * 0.6, w, h * 0.4);
    const top = g.createLinearGradient(0, 0, 0, 14);
    top.addColorStop(0, 'rgba(255,255,255,0.35)');
    top.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, w, 14);
  });
  const glow = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, h * 0.82);
    g.lineTo(w, h * 0.82);
    g.stroke();
  });
  return { map, glow };
}

function floorTexture(theme, accent) {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = theme;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = accent;
    g.globalAlpha = 0.25;
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.globalAlpha = 0.08;
    g.fillStyle = '#fff';
    for (let i = 0; i < 120; i++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function annexTexture() {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#5a0f12';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a1a1f';
    for (let y = -w; y < h; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + w);
      g.lineTo(w, y + w + 22);
      g.lineTo(0, y + 22);
      g.fill();
    }
    g.fillStyle = '#ffd84a';
    g.font = 'bold 30px monospace';
    g.textAlign = 'center';
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('GEANNEXEERD', 0, 10);
    g.restore();
    g.font = 'bold 22px monospace';
    g.fillText('TIJDELIJK*', w / 2, 60);
    g.font = '14px monospace';
    g.fillText('*15 seconden', w / 2, h - 40);
  });
}

// Groene vloercirkel met een 30-bord: de eco-zone van Rob Tetten.
function ecoTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    g.fillStyle = 'rgba(40, 200, 90, 0.38)';
    g.beginPath();
    g.arc(cx, cy, w / 2 - 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(180, 255, 190, 0.95)';
    g.lineWidth = 10;
    g.setLineDash([28, 18]);
    g.beginPath();
    g.arc(cx, cy, w / 2 - 10, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    // snelheidsbord
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx, cy, 80, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d4202a';
    g.lineWidth = 18;
    g.stroke();
    g.fillStyle = '#111';
    g.font = 'bold 84px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('30', cx, cy + 4);
    g.fillStyle = 'rgba(230, 255, 230, 0.95)';
    g.font = 'bold 44px monospace';
    g.fillText('ECO-ZONE', cx, cy - 140);
    g.font = 'bold 28px monospace';
    g.fillText('rustig aan a.u.b.', cx, cy + 140);
  });
}

// Cadeauverpakking: het "sanctiepakket". `fake` krijgt een gouden strik als subtiele hint.
export function makePowerBox(fake = false) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({
    color: fake ? 0x3f6ee0 : 0x2f66ff,
    emissive: fake ? 0x1b2e6a : 0x1a3cff,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: fake ? 0xffc23a : 0xffffff,
    emissive: fake ? 0x7a4c00 : 0x777777,
    roughness: 0.3,
  });
  const s = 0.5;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), boxMat));
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 1.02, 0.1), ribbonMat);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, s * 1.02, s * 1.02), ribbonMat);
  const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(0.09, 0.03, 24, 4), ribbonMat);
  bow.position.y = s / 2 + 0.07;
  group.add(r1, r2, bow);
  return group;
}

/**
 * Het doolhof: parseert het JSON-grid, bouwt de 3D-geometrie en levert
 * hulpfuncties voor botsing, zicht en pathfinding.
 */
export class Maze {
  constructor(level) {
    this.level = level;
    this.theme = level.theme;
    this.grid = level.grid.map((row) => row.split(''));
    this.H = this.grid.length;
    this.W = this.grid[0].length;
    this.solid = new Uint8Array(this.W * this.H); // 1 = muur, 2 = spiegel
    this.temp = new Map(); // key -> { mesh, timer, total }
    this.ecoZones = []; // { x, z, radius, timer, total, mesh }
    this.pellets = new Map(); // key -> instance index
    this.powerups = new Map(); // key -> mesh
    this.monsterStarts = {};
    this.mirrorCells = [];
    this.group = new THREE.Group();

    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        const ch = this.grid[r][c];
        const k = this.key(c, r);
        if (ch === '#') this.solid[k] = 1;
        else if (ch === 'M') {
          this.solid[k] = 2;
          this.mirrorCells.push([c, r]);
        } else if (ch === 'P') this.playerStart = [c, r];
        else if ('1234'.includes(ch)) this.monsterStarts[ch] = [c, r];
      }
    }
    this.passable = (c, r) => this.isWalkable(c, r);
  }

  key(c, r) {
    return r * this.W + c;
  }
  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.W && r < this.H;
  }
  isWall(c, r) {
    return !this.inBounds(c, r) || this.solid[this.key(c, r)] !== 0;
  }
  isMirror(c, r) {
    return this.inBounds(c, r) && this.solid[this.key(c, r)] === 2;
  }
  isTempWall(c, r) {
    return this.temp.has(this.key(c, r));
  }
  isBlocked(c, r) {
    return this.isWall(c, r) || this.isTempWall(c, r);
  }
  isWalkable(c, r) {
    return !this.isBlocked(c, r);
  }

  cellToWorld(c, r) {
    return { x: c * CELL, z: r * CELL };
  }
  worldToCell(x, z) {
    return [Math.round(x / CELL), Math.round(z / CELL)];
  }
  isBlockedAt(x, z) {
    const [c, r] = this.worldToCell(x, z);
    return this.isBlocked(c, r);
  }

  /** Zichtlijn tussen twee wereldpunten (op grondvlak) zonder muren ertussen. */
  lineOfSight(ax, az, bx, bz, step = 0.25) {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const n = Math.ceil(dist / step);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.isBlockedAt(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  walkableNeighbors(c, r) {
    const out = [];
    for (const [dc, dr] of DIRS) if (this.isWalkable(c + dc, r + dr)) out.push([c + dc, r + dr]);
    return out;
  }

  /** Open cellen met ≥3 open buren (de basisgeometrie, tijdelijke muren genegeerd). */
  intersections() {
    if (!this._inter) {
      this._inter = [];
      for (let r = 0; r < this.H; r++)
        for (let c = 0; c < this.W; c++) {
          if (this.isWall(c, r)) continue;
          let n = 0;
          for (const [dc, dr] of DIRS) if (!this.isWall(c + dc, r + dr)) n++;
          if (n >= 3) this._inter.push([c, r]);
        }
    }
    return this._inter;
  }

  findPath(from, to) {
    return astar(this.W, this.H, this.passable, from, to);
  }

  // ---------- 3D-opbouw ----------
  build() {
    const t = this.theme;
    const { map, glow } = wallTextures(t);
    const wallMat = new THREE.MeshStandardMaterial({
      map,
      emissive: new THREE.Color(t.wallLine),
      emissiveMap: glow,
      emissiveIntensity: 0.55,
      roughness: 0.8,
    });
    const mirrorFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.8, roughness: 0.35 });
    const boxGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);

    // Alleen muurblokken die aan een open cel grenzen zijn zichtbaar.
    const visibleWalls = [];
    const visibleMirrors = [];
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        const s = this.solid[this.key(c, r)];
        if (!s) continue;
        let exposed = false;
        for (const [dc, dr] of DIRS) {
          const nc = c + dc;
          const nr = r + dr;
          if (this.inBounds(nc, nr) && !this.solid[this.key(nc, nr)]) exposed = true;
        }
        if (exposed) (s === 2 ? visibleMirrors : visibleWalls).push([c, r]);
      }
    const m4 = new THREE.Matrix4();
    const addInstanced = (cells, mat) => {
      if (!cells.length) return;
      const mesh = new THREE.InstancedMesh(boxGeo, mat, cells.length);
      cells.forEach(([c, r], i) => {
        m4.makeTranslation(c * CELL, WALL_H / 2, r * CELL);
        mesh.setMatrixAt(i, m4);
      });
      this.group.add(mesh);
    };
    addInstanced(visibleWalls, wallMat);
    addInstanced(visibleMirrors, mirrorFrameMat);

    // Vloer en plafond
    const fw = this.W * CELL;
    const fh = this.H * CELL;
    const floorTex = floorTexture(t.floor, t.accent);
    floorTex.repeat.set(this.W, this.H);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(fw, fh),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(fw / 2 - CELL / 2, 0, fh / 2 - CELL / 2);
    this.group.add(floor);
    // Geen plafond: open sterrenhemel (zie effects.js). Muren blijven te hoog om overheen te kijken.

    // Bolletjes (instanced) en power-ups
    const pelletCells = [];
    for (let r = 0; r < this.H; r++)
      for (let c = 0; c < this.W; c++) {
        const ch = this.grid[r][c];
        if (ch === '.') pelletCells.push([c, r]);
        else if (ch === 'o') {
          const box = makePowerBox(false);
          box.position.set(c * CELL, 1.0, r * CELL);
          this.group.add(box);
          this.powerups.set(this.key(c, r), box);
        }
      }
    this.pelletMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: t.pellet }),
      Math.max(1, pelletCells.length),
    );
    pelletCells.forEach(([c, r], i) => {
      m4.makeTranslation(c * CELL, 0.75, r * CELL);
      this.pelletMesh.setMatrixAt(i, m4);
      this.pellets.set(this.key(c, r), i);
    });
    this.pelletMesh.count = pelletCells.length;
    this.group.add(this.pelletMesh);

    this.annexMat = new THREE.MeshStandardMaterial({ map: annexTexture(), emissive: 0x330000, roughness: 0.7 });
    this.annexGeo = new THREE.BoxGeometry(CELL * 0.98, WALL_H, CELL * 0.98);
    return this.group;
  }

  get remaining() {
    return this.pellets.size + this.powerups.size;
  }

  /** Probeert bolletje/power-up in cel op te eten. Geeft 'pellet', 'power' of null. */
  eatAt(c, r) {
    const k = this.key(c, r);
    if (this.pellets.has(k)) {
      const i = this.pellets.get(k);
      this.pellets.delete(k);
      const m = new THREE.Matrix4().makeScale(0, 0, 0);
      this.pelletMesh.setMatrixAt(i, m);
      this.pelletMesh.instanceMatrix.needsUpdate = true;
      return 'pellet';
    }
    if (this.powerups.has(k)) {
      const mesh = this.powerups.get(k);
      this.group.remove(mesh);
      this.powerups.delete(k);
      return 'power';
    }
    return null;
  }

  hasPellet(c, r) {
    return this.pellets.has(this.key(c, r));
  }
  hasPower(c, r) {
    return this.powerups.has(this.key(c, r));
  }

  /** Plaatst een tijdelijke muur ("annexatie"). */
  annex(c, r, duration) {
    const k = this.key(c, r);
    if (this.temp.has(k) || this.isWall(c, r)) return false;
    const mesh = new THREE.Mesh(this.annexGeo, this.annexMat);
    mesh.position.set(c * CELL, -WALL_H / 2, r * CELL);
    this.group.add(mesh);
    this.temp.set(k, { mesh, timer: duration, total: duration, c, r });
    return true;
  }

  clearTemp() {
    for (const t of this.temp.values()) this.group.remove(t.mesh);
    this.temp.clear();
    for (const z of this.ecoZones) this.group.remove(z.mesh);
    this.ecoZones.length = 0;
  }

  /** Legt een eco-zone neer rond cel (c, r); straal in cellen. */
  addEcoZone(c, r, radiusCells, duration) {
    if (!this.ecoMat) {
      this.ecoMat = new THREE.MeshBasicMaterial({ map: ecoTexture(), transparent: true, depthWrite: false });
    }
    const radius = (radiusCells + 0.5) * CELL;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), this.ecoMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(c * CELL, 0.03, r * CELL);
    mesh.renderOrder = 1;
    this.group.add(mesh);
    this.ecoZones.push({ x: c * CELL, z: r * CELL, c, r, radius, timer: duration, total: duration, mesh });
  }

  /** Staat een wereldpunt in een eco-zone? */
  inEcoZone(x, z) {
    return this.ecoZones.some((e) => Math.hypot(x - e.x, z - e.z) <= e.radius);
  }

  update(dt, time) {
    for (const [k, t] of this.temp) {
      t.timer -= dt;
      const rise = Math.min(1, (t.total - t.timer) / 0.6);
      const sink = Math.min(1, Math.max(0, t.timer) / 0.6);
      const f = Math.min(rise, sink);
      t.mesh.position.y = -WALL_H / 2 + f * WALL_H;
      if (t.timer <= 0) {
        this.group.remove(t.mesh);
        this.temp.delete(k);
      }
    }
    for (let i = this.ecoZones.length - 1; i >= 0; i--) {
      const e = this.ecoZones[i];
      e.timer -= dt;
      const fade = Math.min(1, (e.total - e.timer) / 0.5, Math.max(0, e.timer) / 0.8);
      e.mesh.material.opacity = fade * (0.85 + Math.sin(time * 4) * 0.15);
      e.mesh.rotation.z = time * 0.2;
      if (e.timer <= 0) {
        this.group.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.ecoZones.splice(i, 1);
      }
    }
    for (const box of this.powerups.values()) {
      box.rotation.y = time * 1.5;
      box.position.y = 1.0 + Math.sin(time * 3 + box.position.x) * 0.12;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      }
    });
    this.annexGeo?.dispose();
    this.annexMat?.dispose();
    this.ecoMat?.map.dispose();
    this.ecoMat?.dispose();
  }
}
