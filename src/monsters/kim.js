import * as THREE from 'three';
import { Monster, mat, part } from './base.js';

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const BASE_RADIUS = 3;
const SHOT_RANGE = 15; // cellen

/**
 * Kim Jong-Oen — strategie "afschrikking".
 * Patrouilleert rond zijn basis. Ziet hij de speler in een rechte gang, dan
 * vuurt hij een projectiel af. Na 3 gemiste schoten gaat hij zelf jagen.
 */
export class Kim extends Monster {
  static quotes = {
    gameOver: [
      'De Geliefde Leider wint. Zoals altijd. Staatsmedia bevestigt.',
      'Jouw nederlaag is uitgeroepen tot nationale feestdag.',
      'Ik heb dit level ook in mijn eerste poging uitgespeeld. Met 11 hole-in-ones.',
    ],
    levelComplete: [
      'Jouw overwinning is geschrapt uit de geschiedenisboeken.',
      'Dit was een succesvolle test. Van onze kant.',
      'Je hebt gewonnen. Volgens jouw propaganda.',
    ],
  };

  constructor(game, start) {
    super(game, { name: 'Kim Jong-Oen', color: '#5ee07a', start, speedFactor: 0.82, scale: 0.95 });
  }

  buildFigure(b) {
    const suit = mat(0x33373a);
    const skin = mat(0xf0d2b4);
    const hair = mat(0x111111, { roughness: 0.35 });
    const shaved = mat(0x4a4038);
    const dark = mat(0x151515);
    const button = mat(0x8a8c8e, { metalness: 0.6, roughness: 0.3 });

    // korte, stevige beentjes
    part(b, new THREE.BoxGeometry(0.3, 0.6, 0.3), suit, -0.19, 0.3, 0);
    part(b, new THREE.BoxGeometry(0.3, 0.6, 0.3), suit, 0.19, 0.3, 0);
    part(b, new THREE.BoxGeometry(0.32, 0.08, 0.38), dark, -0.19, 0.04, 0.04);
    part(b, new THREE.BoxGeometry(0.32, 0.08, 0.38), dark, 0.19, 0.04, 0.04);
    // dikke ronde buik in Mao-tuniek, brede borst, hoge kraag
    part(b, new THREE.SphereGeometry(0.6, 12, 9), suit, 0, 1.0, 0, { scale: [1.05, 0.95, 0.92] });
    part(b, new THREE.CylinderGeometry(0.44, 0.56, 0.48, 12), suit, 0, 1.36, 0);
    part(b, new THREE.CylinderGeometry(0.21, 0.24, 0.12, 12), suit, 0, 1.62, 0);
    [[1.47, 0.45], [1.28, 0.5], [1.09, 0.555], [0.9, 0.55]].forEach(([y, z]) =>
      part(b, new THREE.SphereGeometry(0.035, 6, 4), button, 0, y, z));
    part(b, new THREE.BoxGeometry(0.16, 0.14, 0.03), suit, -0.22, 1.38, 0.44, { rot: [-0.25, 0, 0] });
    part(b, new THREE.BoxGeometry(0.16, 0.14, 0.03), suit, 0.22, 1.38, 0.44, { rot: [-0.25, 0, 0] });
    // dikke armen; rechts een raketje
    part(b, new THREE.BoxGeometry(0.22, 0.6, 0.26), suit, -0.7, 1.12, 0, { rot: [0, 0, 0.32] });
    const arm = part(b, new THREE.BoxGeometry(0.22, 0.6, 0.26), suit, 0.68, 1.18, 0.14, { rot: [-0.6, 0, -0.32] });
    part(b, new THREE.SphereGeometry(0.09, 6, 4), skin, -0.8, 0.84, 0);
    const rocket = new THREE.Group();
    part(rocket, new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), mat(0xdddddd), 0, 0, 0);
    part(rocket, new THREE.ConeGeometry(0.05, 0.12, 8), mat(0xd02020), 0, 0.24, 0);
    rocket.position.set(0, -0.36, 0.05);
    rocket.rotation.x = 0.6;
    arm.add(rocket);
    // breed rond hoofd zonder nek, bolle wangen, onderkin
    part(b, new THREE.SphereGeometry(0.33, 10, 8), skin, 0, 1.84, 0, { scale: [1.2, 1, 1.05] });
    part(b, new THREE.SphereGeometry(0.14, 8, 6), skin, -0.22, 1.74, 0.2);
    part(b, new THREE.SphereGeometry(0.14, 8, 6), skin, 0.22, 1.74, 0.2);
    part(b, new THREE.SphereGeometry(0.2, 8, 6), skin, 0, 1.62, 0.12, { scale: [1.45, 0.55, 1.1] });
    // plat zwart kuifje met opgeschoren zijkanten
    part(b, new THREE.CylinderGeometry(0.335, 0.33, 0.1, 12), shaved, 0, 1.92, -0.02, { scale: [1.2, 1, 1.05] });
    part(b, new THREE.BoxGeometry(0.6, 0.18, 0.56), hair, 0, 2.08, 0.02);
    part(b, new THREE.BoxGeometry(0.56, 0.08, 0.16), hair, 0, 2.04, 0.3, { rot: [0.35, 0, 0] });
    // spleetoogjes en een tevreden glimlach tussen de wangen
    part(b, new THREE.BoxGeometry(0.08, 0.025, 0.02), dark, -0.11, 1.87, 0.335);
    part(b, new THREE.BoxGeometry(0.08, 0.025, 0.02), dark, 0.11, 1.87, 0.335);
    part(b, new THREE.TorusGeometry(0.07, 0.016, 4, 10, Math.PI), dark, 0, 1.75, 0.34, { rot: [0, 0, Math.PI] });
  }

  onReset() {
    this.hunting = false;
    this.misses = 0;
    this.shootCooldown = 2;
    this.wanderTarget = null;
  }

  onRespawn() {
    // terug op de basis: de afschrikking begint opnieuw
    this.hunting = false;
    this.misses = 0;
  }

  onAlert() {
    this.say('Vijand gespot!', 1.5);
  }

  /** Een willekeurige begaanbare cel binnen BASE_RADIUS van de basis. */
  pickWanderTarget() {
    const maze = this.game.maze;
    const [bc, br] = this.start;
    const opts = [];
    for (let r = br - BASE_RADIUS; r <= br + BASE_RADIUS; r++)
      for (let c = bc - BASE_RADIUS; c <= bc + BASE_RADIUS; c++) {
        if (Math.abs(c - bc) + Math.abs(r - br) > BASE_RADIUS) continue;
        if (maze.isWalkable(c, r) && maze.findPath(this.start, [c, r])) opts.push([c, r]);
      }
    return opts.length ? pick(opts) : [...this.start];
  }

  chooseTarget() {
    if (this.hunting || this.alertTimer > 0) return this.game.player.cell;
    const wt = this.wanderTarget;
    if (!wt || (wt[0] === this.cell[0] && wt[1] === this.cell[1]) || !this.game.maze.isWalkable(...wt)) {
      this.wanderTarget = this.pickWanderTarget();
    }
    return this.wanderTarget;
  }

  /** Staat de speler in een rechte, vrije gang met Kim (zelfde rij of kolom)? */
  straightLineToPlayer() {
    const maze = this.game.maze;
    const [pc, pr] = this.game.player.cell;
    const [kc, kr] = this.nearCell;
    if (pc !== kc && pr !== kr) return false;
    const dist = Math.abs(pc - kc) + Math.abs(pr - kr);
    if (dist < 1 || dist > SHOT_RANGE) return false;
    const dc = Math.sign(pc - kc);
    const dr = Math.sign(pr - kr);
    for (let i = 1; i < dist; i++) if (maze.isBlocked(kc + dc * i, kr + dr * i)) return false;
    return true;
  }

  think(dt) {
    if (this.frightened) return;
    this.shootCooldown -= dt;
    if (this.shootCooldown > 0 || !this.straightLineToPlayer()) return;
    const cd = this.game.difficulty.kimCooldown;
    this.shootCooldown = this.hunting ? cd * 1.5 : cd;
    const p = this.game.player;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const len = Math.hypot(dx, dz) || 1;
    this.faceToward(p.x, p.z);
    this.pauseTimer = 0.35;
    this.game.projectiles.fire(this, this.x + (dx / len) * 0.7, this.z + (dz / len) * 0.7, dx, dz);
    this.say(pick(['Testlancering!', 'Waarschuwingsschot!', 'Afschrikking!']), 1.3);
  }

  onShotMissed() {
    if (this.hunting || this.eaten) return;
    this.misses++;
    if (this.misses >= 3) {
      this.hunting = true;
      this.say('Genoeg! Ik kom zelf.', 2.5, '#b00');
      this.game.hud.toast('Kim Jong-Oen heeft 3x gemist en komt nu zelf jagen!', 3);
      this.game.sfx.alert();
    } else {
      this.game.hud.toast(`Kim Jong-Oen mist! (${this.misses}/3)`, 1.5);
    }
  }
}
