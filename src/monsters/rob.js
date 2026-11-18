import * as THREE from 'three';
import { Monster, mat, part } from './base.js';

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const ECO_RADIUS = 2; // cellen
const MAX_ZONES = 2;

function speedSignTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#d4202a';
  g.lineWidth = 14;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#111';
  g.font = 'bold 56px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('30', 64, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Rob Tetten — strategie "duurzame vertraging".
 * Probeert de speler de pas af te snijden (mikt een paar cellen vóór hem)
 * en legt periodiek een eco-zone neer waarin de speler trager loopt.
 * Monsters zelf hebben nergens last van.
 */
export class Rob extends Monster {
  static quotes = {
    gameOver: [
      'Het kan wél! Alleen niet sneller dan 30.',
      'U bent niet ingehaald. U bent duurzaam tot stilstand gebracht.',
      'Dit was een tijdelijke maatregel. Voor de lange termijn.',
    ],
    levelComplete: [
      'Mooi tempo. Volgende keer graag iets groener.',
      'Ik heb een visie voor 2050. Dit level zat daar niet in.',
      'Fijn dat u uw bolletjes gescheiden heeft opgegeten.',
    ],
  };

  constructor(game, start) {
    super(game, { name: 'Rob Tetten', color: '#4fd1c5', start, speedFactor: 0.95, scale: 1.0 });
  }

  buildFigure(b) {
    const suit = mat(0x2b3f6b);
    const shirt = mat(0xf4f6f8);
    const skin = mat(0xf1cfb2);
    const hair = mat(0x8a6738);
    const sneaker = mat(0xffffff);
    const dark = mat(0x1a1a1a);
    const leaf = mat(0x22c25a, { emissive: 0x0b5a26 });

    // slanke benen, witte sneakers
    part(b, new THREE.BoxGeometry(0.17, 0.74, 0.2), suit, -0.11, 0.42, 0);
    part(b, new THREE.BoxGeometry(0.17, 0.74, 0.2), suit, 0.11, 0.42, 0);
    part(b, new THREE.BoxGeometry(0.19, 0.08, 0.32), sneaker, -0.11, 0.04, 0.05);
    part(b, new THREE.BoxGeometry(0.19, 0.08, 0.32), sneaker, 0.11, 0.04, 0.05);
    // slim-fit pak, open boord, geen das
    part(b, new THREE.BoxGeometry(0.54, 0.78, 0.3), suit, 0, 1.17, 0);
    part(b, new THREE.BoxGeometry(0.16, 0.24, 0.02), shirt, 0, 1.44, 0.155);
    part(b, new THREE.ConeGeometry(0.08, 0.14, 3), shirt, 0, 1.49, 0.16, { rot: [0, 0, Math.PI] });
    part(b, new THREE.OctahedronGeometry(0.05), leaf, -0.17, 1.38, 0.16, { scale: [1, 1.6, 0.4] }); // groen speldje
    part(b, new THREE.BoxGeometry(0.13, 0.66, 0.16), suit, -0.34, 1.12, 0, { rot: [0, 0, 0.08] });
    const arm = part(b, new THREE.BoxGeometry(0.13, 0.62, 0.16), suit, 0.36, 1.32, 0.06, { rot: [-0.3, 0, -1.0] });
    part(b, new THREE.SphereGeometry(0.065, 6, 4), skin, -0.38, 0.77, 0);
    // 30-bordje in de opgestoken hand
    const sign = new THREE.Group();
    part(sign, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), mat(0x888888), 0, 0.2, 0);
    part(sign, new THREE.CircleGeometry(0.17, 20), new THREE.MeshStandardMaterial({ map: speedSignTexture(), side: THREE.DoubleSide }), 0, 0.5, 0.01);
    sign.position.set(0, -0.32, 0.02);
    sign.rotation.z = 1.0;
    arm.add(sign);
    // hoofd: jongensachtig, net kapsel met kuifje, brede glimlach
    part(b, new THREE.CylinderGeometry(0.09, 0.1, 0.12, 6), skin, 0, 1.62, 0);
    part(b, new THREE.SphereGeometry(0.25, 8, 6), skin, 0, 1.86, 0, { scale: [0.95, 1.08, 0.98] });
    part(b, new THREE.SphereGeometry(0.255, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, 1.9, -0.01);
    part(b, new THREE.SphereGeometry(0.12, 6, 4), hair, 0.05, 2.1, 0.15, { scale: [1.5, 0.55, 0.9], rot: [0.4, 0, -0.2] });
    part(b, new THREE.SphereGeometry(0.03, 6, 4), dark, -0.08, 1.9, 0.225);
    part(b, new THREE.SphereGeometry(0.03, 6, 4), dark, 0.08, 1.9, 0.225);
    part(b, new THREE.TorusGeometry(0.08, 0.016, 4, 10, Math.PI), dark, 0, 1.79, 0.23, { rot: [0, 0, Math.PI] });
  }

  onReset() {
    const d = this.game.difficulty;
    this.ecoTimer = (d.ecoInterval ?? 14) * (0.5 + Math.random() * 0.3);
  }

  /** Afsnijden: mik op een begaanbare cel een paar stappen vóór de speler. */
  chooseTarget() {
    const p = this.game.player;
    const maze = this.game.maze;
    const [pc, pr] = p.cell;
    const f = p.forward;
    const dc = Math.abs(f.x) > Math.abs(f.z) ? Math.sign(f.x) : 0;
    const dr = dc === 0 ? Math.sign(f.z) : 0;
    const [mc, mr] = this.cell;
    // dichtbij: gewoon direct aanvallen
    if (Math.abs(mc - pc) + Math.abs(mr - pr) <= 3) return [pc, pr];
    for (let k = 4; k >= 1; k--) {
      const c = pc + dc * k;
      const r = pr + dr * k;
      if (maze.isWalkable(c, r)) return [c, r];
    }
    return [pc, pr];
  }

  onAlert() {
    this.say('Ik zie u wel hoor.', 1.6);
  }

  /** Kies het middelpunt: bij Rob zelf als hij dichtbij is, anders vlak bij de speler. */
  pickZoneCenter() {
    const maze = this.game.maze;
    const [pc, pr] = this.game.player.cell;
    const [mc, mr] = this.nearCell;
    if (Math.abs(mc - pc) + Math.abs(mr - pr) <= 7) return [mc, mr];
    const cands = maze.intersections().filter(([c, r]) => {
      const d = Math.abs(c - pc) + Math.abs(r - pr);
      return d >= 2 && d <= 5 && maze.isWalkable(c, r);
    });
    return cands.length ? pick(cands) : null;
  }

  think(dt) {
    if (this.frightened) return;
    const d = this.game.difficulty;
    this.ecoTimer -= dt;
    if (this.ecoTimer > 0) return;
    this.ecoTimer = (d.ecoInterval ?? 14) * (0.85 + Math.random() * 0.3);
    if (this.game.maze.ecoZones.length >= MAX_ZONES) return;
    const center = this.pickZoneCenter();
    if (!center) return;
    this.game.maze.addEcoZone(center[0], center[1], ECO_RADIUS, d.ecoDuration ?? 10);
    this.game.sfx.eco();
    this.game.hud.toast(`Rob Tetten roept een eco-zone uit! Max. 30 (${d.ecoDuration ?? 10} sec)`, 2.5);
    this.say(pick(['Het kan wél! Rustiger.', 'Eco-zone, mensen!', 'Fietsen is ook bewegen.']), 2.2);
  }
}
