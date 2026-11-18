import * as THREE from 'three';
import { Monster, mat, part } from './base.js';

/**
 * Poetsin — strategie "uitputting & annexatie".
 * Traag maar onvermoeibaar: volgt de speler altijd via A*.
 * Annexeert om de ~20 s een kruispunt (tijdelijke muur, 15 s).
 */
export class Poetsin extends Monster {
  static quotes = {
    gameOver: [
      'Dit doolhof was historisch gezien altijd al van mij.',
      'Speciale doolhofoperatie verloopt volgens plan.',
      'U bent niet verslagen. U bent bevrijd.',
    ],
    levelComplete: [
      'Een tactische hergroepering. Niets meer.',
      'Wij erkennen dit level niet als het uwe.',
      'Dit was een goodwill-gebaar van onze kant.',
    ],
  };

  constructor(game, start) {
    super(game, { name: 'Poetsin', color: '#ff4d4d', start, speedFactor: 0.62, scale: 0.92 });
  }

  buildFigure(b) {
    const suit = mat(0x2c2f36);
    const shirt = mat(0xf2f2f2);
    const tie = mat(0x7a1020);
    const skin = mat(0xe6c2a6);
    const hair = mat(0xb9a58d, { side: THREE.DoubleSide });
    const eye = mat(0x7fd6ff, { emissive: 0x2a8fd0 });
    const dark = mat(0x222222);

    part(b, new THREE.BoxGeometry(0.2, 0.72, 0.22), suit, -0.13, 0.36, 0);
    part(b, new THREE.BoxGeometry(0.2, 0.72, 0.22), suit, 0.13, 0.36, 0);
    part(b, new THREE.BoxGeometry(0.66, 0.78, 0.38), suit, 0, 1.08, 0);
    part(b, new THREE.BoxGeometry(0.16, 0.56, 0.02), shirt, 0, 1.18, 0.195);
    part(b, new THREE.BoxGeometry(0.07, 0.46, 0.02), tie, 0, 1.13, 0.21);
    part(b, new THREE.BoxGeometry(0.15, 0.66, 0.18), suit, -0.41, 1.06, 0, { rot: [0, 0, 0.08] });
    part(b, new THREE.BoxGeometry(0.15, 0.66, 0.18), suit, 0.41, 1.06, 0, { rot: [0, 0, -0.08] });
    part(b, new THREE.SphereGeometry(0.08, 6, 4), skin, -0.44, 0.7, 0);
    part(b, new THREE.SphereGeometry(0.08, 6, 4), skin, 0.44, 0.7, 0);
    // hoofd: kaal, smalle krans van dun haar aan de achterkant
    part(b, new THREE.CylinderGeometry(0.1, 0.12, 0.12, 6), skin, 0, 1.52, 0);
    part(b, new THREE.SphereGeometry(0.27, 8, 6), skin, 0, 1.76, 0, { scale: [0.95, 1.1, 1] });
    // theta 0 = voorkant (+z); de krans loopt alleen over zij- en achterkant
    part(b, new THREE.CylinderGeometry(0.275, 0.27, 0.13, 12, 1, true, Math.PI * 0.45, Math.PI * 1.1), hair, 0, 1.74, -0.01);
    // ijskoude blik
    part(b, new THREE.SphereGeometry(0.04, 6, 4), eye, -0.09, 1.8, 0.24);
    part(b, new THREE.SphereGeometry(0.04, 6, 4), eye, 0.09, 1.8, 0.24);
    part(b, new THREE.BoxGeometry(0.1, 0.02, 0.02), dark, -0.09, 1.86, 0.25, { rot: [0, 0, -0.15] });
    part(b, new THREE.BoxGeometry(0.1, 0.02, 0.02), dark, 0.09, 1.86, 0.25, { rot: [0, 0, 0.15] });
    part(b, new THREE.BoxGeometry(0.12, 0.018, 0.02), dark, 0, 1.64, 0.265);
    // medaille op de borst
    part(b, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), mat(0xffcc33, { metalness: 0.6 }), -0.2, 1.3, 0.2, { rot: [Math.PI / 2, 0, 0] });
  }

  onReset() {
    this.annexTimer = this.game.difficulty.annexInterval * (0.7 + Math.random() * 0.3);
  }

  chooseTarget() {
    return this.game.player.cell; // altijd, onvermoeibaar
  }

  onAlert() {
    this.boost = 1.3;
    this.boostTimer = 4;
  }

  think(dt) {
    if (this.frightened) return;
    this.annexTimer -= dt;
    if (this.annexTimer <= 0) {
      const iv = this.game.difficulty.annexInterval;
      this.annexTimer = iv * (0.85 + Math.random() * 0.3);
      if (this.game.annexIntersection(this)) {
        const lines = ['Dit kruispunt is nu van ons.', 'Referendum: 146% voor.', 'Historisch Poetsiaans gebied.'];
        this.say(lines[(Math.random() * lines.length) | 0], 2.5);
      }
    }
  }
}
