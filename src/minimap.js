import { CELL } from './config.js';

/**
 * 2D-minimap met fog of war. Cellen worden "gezien" via raycasts binnen het
 * gezichtsveld van de camera; monsters tekenen we alleen als ze nu in zicht zijn.
 */
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.maze = null;
  }

  setMaze(maze) {
    this.maze = maze;
    this.seen = new Uint8Array(maze.W * maze.H);
    this.visible = new Uint8Array(maze.W * maze.H);
  }

  /** Raycast binnen het horizontale FOV en markeer wat de speler ziet. */
  updateVisibility(player, camera) {
    const m = this.maze;
    this.visible.fill(0);
    const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const rays = 72;
    const maxDist = 40 * CELL;
    const step = 0.3;
    const mark = (c, r) => {
      if (!m.inBounds(c, r)) return;
      const k = m.key(c, r);
      this.visible[k] = 1;
      this.seen[k] = 1;
    };
    // Directe omgeving is altijd bekend.
    const [pc, pr] = player.cell;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) mark(pc + dc, pr + dr);

    for (let i = 0; i <= rays; i++) {
      const a = player.yaw + hfov / 2 - (hfov * i) / rays;
      const dx = -Math.sin(a);
      const dz = -Math.cos(a);
      for (let d = 0; d < maxDist; d += step) {
        const x = player.x + dx * d;
        const z = player.z + dz * d;
        const [c, r] = m.worldToCell(x, z);
        mark(c, r);
        if (m.isBlocked(c, r)) break;
      }
    }
  }

  isCellVisible(c, r) {
    return this.maze.inBounds(c, r) && this.visible[this.maze.key(c, r)] === 1;
  }

  isPointVisible(x, z) {
    const [c, r] = this.maze.worldToCell(x, z);
    return this.isCellVisible(c, r);
  }

  draw(player, monsters, extras) {
    const m = this.maze;
    const g = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.floor(Math.min(cw / m.W, ch / m.H));
    const ox = Math.floor((cw - s * m.W) / 2);
    const oy = Math.floor((ch - s * m.H) / 2);
    const t = m.theme;
    g.clearRect(0, 0, cw, ch);

    for (let r = 0; r < m.H; r++)
      for (let c = 0; c < m.W; c++) {
        const k = m.key(c, r);
        if (!this.seen[k]) continue;
        const x = ox + c * s;
        const y = oy + r * s;
        if (m.isTempWall(c, r)) g.fillStyle = '#c0262d';
        else if (m.isMirror(c, r)) g.fillStyle = '#d7e3ee';
        else if (m.isWall(c, r)) g.fillStyle = t.wall;
        else g.fillStyle = this.visible[k] ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
        g.fillRect(x, y, s, s);
        if (m.isWall(c, r) || m.isTempWall(c, r)) continue;
        if (m.hasPellet(c, r)) {
          g.fillStyle = t.pellet;
          g.fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2);
        } else if (m.hasPower(c, r)) {
          g.fillStyle = '#4f86ff';
          g.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6);
        }
      }

    const toMap = (wx, wz) => [ox + (wx / CELL + 0.5) * s, oy + (wz / CELL + 0.5) * s];

    // Eco-zones (als het middelpunt gezien is)
    for (const e of m.ecoZones) {
      if (!this.seen[m.key(e.c, e.r)]) continue;
      const [x, y] = toMap(e.x, e.z);
      g.fillStyle = 'rgba(60, 220, 110, 0.3)';
      g.strokeStyle = 'rgba(160, 255, 190, 0.8)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, (e.radius / CELL) * s, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // Nep-power-ups (alleen als die cel gezien is)
    for (const fp of extras.fakes) {
      if (!this.seen[m.key(fp.c, fp.r)]) continue;
      const [x, y] = toMap(fp.c * CELL, fp.r * CELL);
      g.fillStyle = '#6f8ee8';
      g.fillRect(x - 3, y - 3, 6, 6);
    }

    // Projectielen in zicht
    for (const p of extras.projectiles) {
      if (!this.isPointVisible(p.x, p.z)) continue;
      const [x, y] = toMap(p.x, p.z);
      g.fillStyle = p.reflected ? '#9ff' : '#ff3b30';
      g.beginPath();
      g.arc(x, y, 2.5, 0, Math.PI * 2);
      g.fill();
    }

    // Monsters alleen als ze nu in zicht zijn
    for (const mo of monsters) {
      if (!this.isPointVisible(mo.x, mo.z)) continue;
      const [x, y] = toMap(mo.x, mo.z);
      g.fillStyle = mo.eaten ? 'rgba(160,190,255,0.5)' : mo.frightened ? '#2b5cff' : mo.color;
      g.beginPath();
      g.arc(x, y, s * 0.42, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#000';
      g.lineWidth = 1;
      g.stroke();
    }

    // Speler als pijl in kijkrichting
    const [px, py] = toMap(player.x, player.z);
    const f = player.forward;
    const len = s * 0.9;
    const w = s * 0.5;
    g.fillStyle = '#ffe84a';
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(px + f.x * len, py + f.z * len);
    g.lineTo(px - f.x * len * 0.5 - f.z * w, py - f.z * len * 0.5 + f.x * w);
    g.lineTo(px - f.x * len * 0.2, py - f.z * len * 0.2);
    g.lineTo(px - f.x * len * 0.5 + f.z * w, py - f.z * len * 0.5 - f.x * w);
    g.closePath();
    g.fill();
    g.stroke();
  }
}
