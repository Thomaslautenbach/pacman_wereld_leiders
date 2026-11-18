import * as THREE from 'three';
import { Monster, mat, part } from './base.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * Trumpf â€” strategie "onvoorspelbare deal".
 * Snel; wisselt willekeurig tussen achtervolgen en weglopen.
 * Soms is het weglopen bluf en draait hij abrupt om.
 * Laat af en toe een nep-sanctiepakket achter dat punten kost.
 */
export class Trumpf extends Monster {
  static quotes = {
    gameOver: [
      'Niemand verliest beter dan jij. Echt, de allerbeste verliezer.',
      'You\'re fired! Tremendous game over, misschien wel de beste ooit.',
      'Ik had dit doolhof gewonnen met 50 punten. Iedereen zegt het.',
    ],
    levelComplete: [
      'Dit level was gerigged. Ik eis een hertelling van de bolletjes.',
      'Ik heb je laten winnen. Dat was de deal. Briljante deal.',
      'Ik ben eigenlijk de echte winnaar van dit level.',
    ],
  };

  constructor(game, start) {
    super(game, { name: 'Trumpf', color: '#ffa630', start, speedFactor: 1.12, scale: 1.08 });
  }

  buildFigure(b) {
    const suit = mat(0x1d2b5e);
    const shirt = mat(0xc9c2b2); // vergeeld overhemd
    const tie = mat(0xe0141e, { roughness: 0.4 });
    const skin = mat(0xf29a4a, { roughness: 0.28, emissive: 0x3a1600 }); // glimmend van het zweet
    const pale = mat(0xf6dcc0);
    const hair = mat(0xffd54a, { roughness: 0.22, metalness: 0.15 }); // vettig glanzend
    const dark = mat(0x1a1a1a);
    const lips = mat(0xc85a4a);
    const gold = mat(0xffcc33, { metalness: 0.9, roughness: 0.25, emissive: 0x4a3000 });
    const sweat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.7, roughness: 0.05 });

    part(b, new THREE.BoxGeometry(0.3, 0.62, 0.32), suit, -0.2, 0.31, 0);
    part(b, new THREE.BoxGeometry(0.3, 0.62, 0.32), suit, 0.2, 0.31, 0);
    part(b, new THREE.BoxGeometry(0.32, 0.08, 0.42), dark, -0.2, 0.04, 0.05);
    part(b, new THREE.BoxGeometry(0.32, 0.08, 0.42), dark, 0.2, 0.04, 0.05);
    // enorme buik in een overhemd dat op knappen staat, open colbert eromheen
    part(b, new THREE.SphereGeometry(0.62, 12, 9), shirt, 0, 1.0, 0.06, { scale: [1.1, 1.0, 0.98] });
    part(b, new THREE.BoxGeometry(1.0, 0.55, 0.6), suit, 0, 1.42, -0.02);
    part(b, new THREE.BoxGeometry(0.26, 0.8, 0.7), suit, -0.5, 1.05, -0.02, { rot: [0, 0.15, 0.05] });
    part(b, new THREE.BoxGeometry(0.26, 0.8, 0.7), suit, 0.5, 1.05, -0.02, { rot: [0, -0.15, -0.05] });
    part(b, new THREE.CylinderGeometry(0.6, 0.6, 0.07, 14), dark, 0, 0.62, 0.04, { scale: [1, 1, 0.92] }); // riem
    part(b, new THREE.BoxGeometry(0.12, 0.08, 0.04), gold, 0, 0.62, 0.6); // gesp
    part(b, new THREE.BoxGeometry(0.22, 0.16, 0.06), shirt, 0.2, 0.52, 0.5, { rot: [0.2, 0, 0.2] }); // hemd uit de broek
    part(b, new THREE.SphereGeometry(0.06, 6, 4), mat(0xb3121a), -0.24, 1.18, 0.62, { scale: [1.3, 1, 0.3] }); // ketchupvlek
    // vÃ©Ã©l te lange, scheve stropdas met mosterdvlek
    const tieG = new THREE.Group();
    part(tieG, new THREE.BoxGeometry(0.14, 0.13, 0.05), tie, 0, 0.5, 0);
    part(tieG, new THREE.BoxGeometry(0.14, 1.05, 0.04), tie, 0, -0.08, 0.02);
    part(tieG, new THREE.ConeGeometry(0.08, 0.13, 4), tie, 0, -0.66, 0.02, { rot: [Math.PI, Math.PI / 4, 0] });
    part(tieG, new THREE.SphereGeometry(0.045, 6, 4), mat(0xd9a400), 0.02, 0.05, 0.05, { scale: [1.2, 1, 0.3] });
    tieG.position.set(0.04, 1.08, 0.6);
    tieG.rotation.set(-0.18, 0, 0.14);
    b.add(tieG);
    // dikke armen; links een hamburger, rechts een gouden pinkring
    part(b, new THREE.BoxGeometry(0.24, 0.72, 0.28), suit, -0.72, 1.12, 0.05, { rot: [-0.35, 0, 0.22] });
    part(b, new THREE.BoxGeometry(0.24, 0.72, 0.28), suit, 0.72, 1.1, 0, { rot: [0, 0, -0.22] });
    part(b, new THREE.SphereGeometry(0.085, 6, 4), skin, -0.8, 0.8, 0.2);
    part(b, new THREE.SphereGeometry(0.085, 6, 4), skin, 0.8, 0.74, 0.02);
    part(b, new THREE.TorusGeometry(0.05, 0.018, 6, 10), gold, 0.83, 0.71, 0.08, { rot: [0, 0.5, 0] });
    const burger = new THREE.Group();
    part(burger, new THREE.CylinderGeometry(0.15, 0.14, 0.05, 10), mat(0xd9a05b), 0, 0, 0);
    part(burger, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), mat(0x5a2e14), 0, 0.05, 0);
    part(burger, new THREE.BoxGeometry(0.25, 0.015, 0.25), mat(0xffcf3a), 0, 0.085, 0, { rot: [0, 0.4, 0] });
    part(burger, new THREE.CylinderGeometry(0.17, 0.17, 0.015, 10), mat(0x4fb83a), 0, 0.1, 0);
    part(burger, new THREE.SphereGeometry(0.155, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9a05b), 0, 0.105, 0, { scale: [1, 0.6, 1] });
    burger.position.set(-0.8, 0.9, 0.3);
    burger.rotation.set(0.3, 0, 0.2);
    b.add(burger);
    // hoofd met hangwangen, onderkin en zweetdruppels
    part(b, new THREE.SphereGeometry(0.33, 10, 8), skin, 0, 1.9, 0, { scale: [1.08, 1.02, 0.98] });
    part(b, new THREE.SphereGeometry(0.22, 8, 6), skin, 0, 1.66, 0.08, { scale: [1.5, 0.62, 1.15] });
    part(b, new THREE.SphereGeometry(0.12, 8, 6), skin, -0.22, 1.75, 0.13);
    part(b, new THREE.SphereGeometry(0.12, 8, 6), skin, 0.22, 1.75, 0.13);
    part(b, new THREE.SphereGeometry(0.075, 6, 4), pale, -0.12, 1.94, 0.26, { scale: [1.3, 0.8, 0.5] });
    part(b, new THREE.SphereGeometry(0.075, 6, 4), pale, 0.12, 1.94, 0.26, { scale: [1.3, 0.8, 0.5] });
    // loensende halfgesloten oogjes, Ã©Ã©n opgetrokken wenkbrauw
    part(b, new THREE.BoxGeometry(0.075, 0.022, 0.02), dark, -0.12, 1.93, 0.3);
    part(b, new THREE.BoxGeometry(0.075, 0.022, 0.02), dark, 0.12, 1.93, 0.3);
    part(b, new THREE.BoxGeometry(0.1, 0.035, 0.03), skin, -0.12, 1.955, 0.3, { rot: [0, 0, 0.1] });
    part(b, new THREE.BoxGeometry(0.1, 0.035, 0.03), skin, 0.12, 1.955, 0.3, { rot: [0, 0, -0.1] });
    part(b, new THREE.BoxGeometry(0.12, 0.028, 0.03), hair, -0.12, 2.02, 0.29, { rot: [0, 0, 0.35] });
    part(b, new THREE.BoxGeometry(0.12, 0.028, 0.03), hair, 0.12, 1.99, 0.3, { rot: [0, 0, 0.05] });
    // gluiperig scheef grijnsje
    part(b, new THREE.BoxGeometry(0.14, 0.025, 0.03), lips, 0.03, 1.79, 0.32, { rot: [0, 0, 0.22] });
    part(b, new THREE.BoxGeometry(0.05, 0.018, 0.02), mat(0xffffff), 0.05, 1.795, 0.335, { rot: [0, 0, 0.22] });
    part(b, new THREE.SphereGeometry(0.025, 6, 4), sweat, -0.15, 2.06, 0.27, { scale: [0.8, 1.3, 0.6] });
    part(b, new THREE.SphereGeometry(0.02, 6, 4), sweat, 0.19, 2.0, 0.27, { scale: [0.8, 1.3, 0.6] });
    // vettige gele kam-over met losse slierten
    part(b, new THREE.SphereGeometry(0.36, 10, 6), hair, 0, 2.12, -0.02, { scale: [1.08, 0.42, 1.12] });
    part(b, new THREE.SphereGeometry(0.24, 8, 6), hair, 0.07, 2.14, 0.22, { scale: [1.5, 0.42, 0.9], rot: [0.25, 0, -0.18] });
    part(b, new THREE.SphereGeometry(0.17, 6, 4), hair, -0.3, 2.0, 0.02, { scale: [0.5, 0.85, 1.35] });
    part(b, new THREE.SphereGeometry(0.17, 6, 4), hair, 0.3, 2.0, 0.02, { scale: [0.5, 0.85, 1.35] });
    part(b, new THREE.BoxGeometry(0.02, 0.2, 0.02), hair, 0.1, 2.02, 0.33, { rot: [0.3, 0, 0.4] });
    part(b, new THREE.BoxGeometry(0.02, 0.16, 0.02), hair, 0.16, 2.03, 0.31, { rot: [0.3, 0, 0.6] });
  }

  onReset() {
    this.mode = 'chase';
    this.modeTimer = rand(2, 5);
    this.bluffTimer = 0;
    this.dropTimer = this.game.difficulty.trumpfDropInterval * rand(0.5, 1);
  }

  chooseTarget() {
    if (this.alertTimer > 0) return this.game.player.cell;
    return this.mode === 'flee' ? 'flee' : this.game.player.cell;
  }

  onAlert() {
    this.mode = 'chase';
    this.modeTimer = rand(3, 5);
    this.bluffTimer = 0;
  }

  think(dt) {
    if (this.frightened) return;

    // bluf: doet alsof hij vlucht en draait dan abrupt om
    if (this.bluffTimer > 0) {
      this.bluffTimer -= dt;
      if (this.bluffTimer <= 0) {
        this.mode = 'chase';
        this.modeTimer = rand(3, 5);
        this.reverse();
        this.boost = 1.45;
        this.boostTimer = 2.2;
        this.say(pick(['Grapje! Big deal!', 'Gotcha. Geniaal.', 'Nooit gezegd!']), 2);
        this.game.sfx.bluff();
      }
    } else {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        if (this.mode === 'chase') {
          this.mode = 'flee';
          this.modeTimer = rand(2, 4);
          this.reverse();
          if (Math.random() < 0.45) this.bluffTimer = rand(0.7, 1.4);
          this.say(pick(['Ik moet golfen.', 'Fake news!', 'Even weg, deal!']), 1.6);
        } else {
          this.mode = 'chase';
          this.modeTimer = rand(2, 5);
        }
      }
    }

    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = this.game.difficulty.trumpfDropInterval * rand(0.8, 1.2);
      if (this.game.dropFakePowerup(...this.cell)) this.say(pick(['Gratis deal! Geloof me.', 'Het beste pakket ooit.']), 2);
    }
  }
}
