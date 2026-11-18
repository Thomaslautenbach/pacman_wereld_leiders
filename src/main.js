import * as THREE from 'three';
import { CELL, POINTS, START_LIVES } from './config.js';
import { Maze, makePowerBox } from './maze.js';
import { Player } from './player.js';
import { Minimap } from './minimap.js';
import { Mirrors } from './mirrors.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Projectiles } from './projectiles.js';
import { Poetsin } from './monsters/poetsin.js';
import { Trumpf } from './monsters/trumpf.js';
import { Kim } from './monsters/kim.js';
import { Rob } from './monsters/rob.js';
import { Sky, Dust, Explosions } from './effects.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Alle levels uit /levels, gesorteerd op bestandsnaam.
const levelModules = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });
const LEVELS = Object.keys(levelModules).sort().map((k) => levelModules[k]);

const ANNEX_DURATION = 15;
const MAX_FAKES = 2;
const FAKE_TTL = 25;
const CRASH_STUN = 5; // seconden stilstaan na een botsing tussen monsters
const CRASH_COOLDOWN = 12; // daarna even immuun, anders blijven ze ontploffen
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 200);
    this.scene.add(this.camera);

    // Vast aantal lichten (voorkomt shader-hercompilaties).
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.9);
    this.lantern = new THREE.PointLight(0xffffff, 9, 16, 1.2);
    this.lantern.position.set(0, 0.2, 0);
    this.camera.add(this.lantern);
    this.scene.add(this.ambient, this.hemi);

    this.sky = new Sky();
    this.dust = new Dust();
    this.explosions = new Explosions();
    this.scene.add(this.sky.group, this.dust.points, this.explosions.group);
    this.shakeTime = 0;
    this.shakeAmp = 0;

    // Post-processing: bloom laat neon, bolletjes en explosies gloeien.
    this.hiQuality = true;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.45, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.hud = new Hud();
    this.sfx = new Sfx();
    this.player = new Player(this.camera, this.canvas);
    this.minimap = new Minimap(document.getElementById('minimap'));

    this.mode = 'title';
    this.pendingAction = null;
    this.clock = new THREE.Clock();
    this.time = 0;

    window.addEventListener('resize', () => this.onResize());
    document.getElementById('overlay').addEventListener('click', () => this.onOverlayClick());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.hud.toast(this.sfx.toggleMute() ? 'Geluid uit' : 'Geluid aan', 1.2);
      if (e.code === 'KeyG') {
        this.hiQuality = !this.hiQuality;
        this.dust.points.visible = this.hiQuality;
        this.hud.toast(this.hiQuality ? 'Graphics: hoog (bloom aan)' : 'Graphics: snel (bloom uit)', 1.4);
      }
    });

    this.newGame();
    this.showTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- spelverloop ----------
  newGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    const level = LEVELS[i];
    this.level = level;
    this.difficulty = level.difficulty;

    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.maze.dispose();
      this.mirrors.dispose();
    }
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.maze = new Maze(level);
    this.levelGroup.add(this.maze.build());
    this.mirrors = new Mirrors(this.maze);
    this.levelGroup.add(this.mirrors.group);
    this.projectiles = new Projectiles(this.maze, this.sfx);
    this.levelGroup.add(this.projectiles.group);

    const t = level.theme;
    this.scene.background = new THREE.Color(t.fog);
    this.scene.fog = new THREE.Fog(t.fog, 8, 42);
    this.sky.setTheme(t);
    this.dust.setColor(t.light);
    this.hemi.color.set(t.light);
    this.hemi.groundColor.set(t.floor);
    this.lantern.color.set(t.light);
    this.hud.setAccent(t.accent);

    this.player.setMaze(this.maze);
    this.minimap.setMaze(this.maze);

    const s = this.maze.monsterStarts;
    this.monsters = [new Poetsin(this, s['1']), new Trumpf(this, s['2']), new Kim(this, s['3'])];
    if (s['4']) this.monsters.push(new Rob(this, s['4']));
    for (const m of this.monsters) this.levelGroup.add(m.root);

    this.fakes = [];
    this.resetRound();
    this.hud.setLevel(i + 1, level.name);
    this.hud.setLives(this.lives);
    this.hud.setScore(this.score);
  }

  /** Begin van een level of na levensverlies: posities terugzetten. */
  resetRound() {
    this.player.reset(...this.maze.playerStart);
    for (const m of this.monsters) {
      m.reset();
      m.pauseTimer = 2.2; // "klaar voor de start"
    }
    this.projectiles.clear();
    this.explosions.clear();
    this.maze.clearTemp();
    this.player.speedMul = 1;
    this.wasInEco = false;
    this.hud.setEco(false);
    this.powerTimer = 0;
    this.sfx.stopSiren();
    this.hud.setPower(null);
    this.invuln = 2.2;
  }

  showTitle() {
    this.hud.showOverlay({
      title: 'SUMMIT MAZE',
      sub: 'Eet alle bolletjes op de wereldtop. Ontwijk de wereldleiders.',
      body: [
        '<b>WASD</b> lopen &nbsp; <b>MUIS</b> kijken &nbsp; <b>ESC</b> pauze &nbsp; <b>M</b> geluid &nbsp; <b>G</b> graphics',
        '<b>BOTSEN</b> twee leiders tegen elkaar: KABOEM, ze staan 5 sec stil',
        '<b>SANCTIEPAKKET</b> (blauw pakje, witte strik): leiders worden blauw en eetbaar',
        '&nbsp; let op: een pakje met <b>gouden strik</b> is een nep-deal (-100)',
        '<b>POETSIN</b> traag maar onvermoeibaar, annexeert kruispunten',
        '<b>TRUMPF</b> snel en onvoorspelbaar, bluft graag',
        '<b>KIM JONG-OEN</b> schiet in rechte gangen; lok zijn schoten via een <b>SPIEGEL</b> terug',
        '<b>ROB TETTEN</b> snijdt je de pas af en legt <b>ECO-ZONES</b> neer: daarin loop je trager',
      ].join('<br>'),
      hint: 'KLIK OM TE BEGINNEN',
    });
    this.pendingAction = () => this.startLevelIntro();
  }

  startLevelIntro() {
    this.sfx.start();
    this.hud.toast(`TOP ${this.levelIndex + 1}: ${this.level.name.toUpperCase()} — ${this.level.subtitle}`, 3.5);
  }

  onOverlayClick() {
    this.sfx.unlock();
    if (document.pointerLockElement === this.canvas) return;
    const p = this.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }

  onLockChange() {
    const locked = document.pointerLockElement === this.canvas;
    if (locked) {
      const action = this.pendingAction;
      this.pendingAction = null;
      this.mode = 'playing';
      if (action) action();
      this.hud.hideOverlay();
      this.clock.getDelta();
    } else if (this.mode === 'playing' || this.mode === 'dying') {
      this.pausedFrom = this.mode;
      this.mode = 'paused';
      this.sfx.stopSiren();
      this.hud.showOverlay({ title: 'PAUZE', sub: 'De onderhandelingen zijn opgeschort.', hint: 'KLIK OM VERDER TE GAAN' });
      this.pendingAction = () => {
        if (this.powerTimer > 0) this.sfx.startSiren();
        if (this.pausedFrom === 'dying') this.mode = 'dying';
      };
    }
  }

  endScreen(mode, overlay, action) {
    this.mode = mode;
    this.hud.setEco(false);
    this.sfx.stopSiren();
    this.hud.showOverlay(overlay);
    this.pendingAction = action;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  levelComplete() {
    this.sfx.levelComplete();
    const m = pick(this.monsters);
    const last = this.levelIndex === LEVELS.length - 1;
    if (last) {
      this.endScreen('victory', {
        title: 'WERELDVREDE?!',
        sub: `Alle toppen gehaald. Eindscore: ${this.score}`,
        quote: pick(m.constructor.quotes.levelComplete),
        cite: m.name,
        hint: 'KLIK VOOR EEN NIEUWE AMBTSTERMIJN',
      }, () => {
        this.newGame();
        this.startLevelIntro();
      });
    } else {
      this.endScreen('levelcomplete', {
        title: `${this.level.name.toUpperCase()} AFGEROND`,
        sub: `Score: ${this.score} — volgende: ${LEVELS[this.levelIndex + 1].name}`,
        quote: pick(m.constructor.quotes.levelComplete),
        cite: m.name,
        hint: 'KLIK VOOR DE VOLGENDE TOP',
      }, () => {
        this.loadLevel(this.levelIndex + 1);
        this.startLevelIntro();
      });
    }
  }

  gameOver(killer) {
    this.sfx.gameOver();
    const m = killer || pick(this.monsters);
    this.endScreen('gameover', {
      title: 'GAME OVER',
      sub: `Eindscore: ${this.score} — gestrand op ${this.level.name}`,
      quote: pick(m.constructor.quotes.gameOver),
      cite: m.name,
      hint: 'KLIK OM OPNIEUW TE BEGINNEN',
    }, () => {
      this.newGame();
      this.startLevelIntro();
    });
  }

  addScore(n) {
    this.score = Math.max(0, this.score + n);
    this.hud.setScore(this.score);
  }

  loseLife(killer) {
    if (this.invuln > 0 || this.mode !== 'playing') return;
    this.lives--;
    this.hud.setLives(this.lives);
    this.sfx.stopSiren();
    this.sfx.death();
    this.hud.flash('#ff2020', 0.7);
    this.killer = killer;
    this.mode = 'dying';
    this.dyingTimer = 1.8;
    if (killer) killer.say(pick(['Hah!', 'Te makkelijk.', 'Dat was de deal.']), 1.8);
  }

  // ---------- API voor monsters ----------
  /** Poetsin annexeert een kruispunt niet te dicht bij speler of monsters. */
  annexIntersection() {
    const [pc, pr] = this.player.cell;
    const occupied = (c, r) =>
      this.monsters.some((m) => {
        const cells = [m.cell, m.next, m.nearCell].filter(Boolean);
        return cells.some((x) => Math.abs(x[0] - c) + Math.abs(x[1] - r) <= 1);
      });
    const all = this.maze.intersections().filter(([c, r]) =>
      !this.maze.isTempWall(c, r) && Math.max(Math.abs(c - pc), Math.abs(r - pr)) > 2 && !occupied(c, r));
    let cands = all.filter(([c, r]) => {
      const d = Math.abs(c - pc) + Math.abs(r - pr);
      return d >= 3 && d <= 9;
    });
    if (!cands.length) cands = all;
    if (!cands.length) return false;
    const [c, r] = pick(cands);
    if (!this.maze.annex(c, r, ANNEX_DURATION)) return false;
    this.sfx.annex();
    this.hud.toast(`Poetsin annexeert een kruispunt! (${ANNEX_DURATION} sec)`, 2.5);
    return true;
  }

  /** Trumpf laat een nep-sanctiepakket achter. */
  dropFakePowerup(c, r) {
    if (this.fakes.length >= MAX_FAKES) return false;
    if (this.maze.hasPower(c, r) || this.fakes.some((f) => f.c === c && f.r === r)) return false;
    const mesh = makePowerBox(true);
    mesh.position.set(c * CELL, 1.0, r * CELL);
    this.levelGroup.add(mesh);
    this.fakes.push({ c, r, mesh, ttl: FAKE_TTL });
    this.sfx.drop();
    return true;
  }

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    // eco-zone: speler loopt trager (monsters trekken zich er niets van aan)
    const inEco = this.maze.inEcoZone(this.player.x, this.player.z);
    this.player.speedMul = inEco ? this.difficulty.ecoSlow ?? 0.5 : 1;
    if (inEco !== this.wasInEco) {
      this.hud.setEco(inEco);
      if (inEco) this.hud.toast('Eco-zone: je loopt op halve kracht.', 1.6);
      this.wasInEco = inEco;
    }
    this.player.update(dt);
    this.maze.update(dt, this.time);
    if (this.invuln > 0) this.invuln -= dt;

    // eten
    const [pc, pr] = this.player.cell;
    const eaten = this.maze.eatAt(pc, pr);
    if (eaten === 'pellet') {
      this.addScore(POINTS.pellet);
      this.sfx.chomp();
    } else if (eaten === 'power') {
      this.addScore(POINTS.power);
      this.activatePower();
    }
    for (let i = this.fakes.length - 1; i >= 0; i--) {
      const f = this.fakes[i];
      f.ttl -= dt;
      f.mesh.rotation.y = this.time * 1.5;
      f.mesh.position.y = 1.0 + Math.sin(this.time * 3 + f.c) * 0.12;
      const hit = f.c === pc && f.r === pr;
      if (hit) {
        this.addScore(POINTS.fakePower);
        this.sfx.fake();
        this.hud.flash('#ffb000', 0.35);
        this.hud.toast(`Nep-deal van Trumpf! ${POINTS.fakePower} punten`, 2.2);
      }
      if (hit || f.ttl <= 0) {
        this.levelGroup.remove(f.mesh);
        this.fakes.splice(i, 1);
      }
    }

    // power-up
    if (this.powerTimer > 0) {
      this.powerTimer -= dt;
      this.hud.setPower(this.powerTimer / this.difficulty.powerDuration);
      if (this.powerTimer <= 0) {
        this.powerTimer = 0;
        for (const m of this.monsters) m.setFrightened(false);
        this.sfx.stopSiren();
        this.hud.setPower(null);
      }
    }

    for (const m of this.monsters) m.update(dt);

    this.projectiles.update(dt, {
      player: this.player,
      monsters: this.monsters,
      onPlayerHit: (p) => this.loseLife(p.owner),
      onMonsterHit: (p, m) => {
        m.stun(5);
        this.sfx.stun();
        this.hud.toast(`${m.name} verdoofd door een teruggekaatst schot! (5 sec)`, 2.2);
        this.addScore(50);
      },
      onEnd: (p) => {
        if (!p.hitPlayer && p.owner.onShotMissed) p.owner.onShotMissed();
      },
    });

    // botsing monster <-> monster: diplomatiek incident met paddenstoelwolk
    for (let i = 0; i < this.monsters.length; i++) {
      for (let j = i + 1; j < this.monsters.length; j++) {
        const a = this.monsters[i];
        const b = this.monsters[j];
        if (!this.canCrash(a) || !this.canCrash(b)) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) < 0.9) this.monsterCrash(a, b);
      }
    }

    // botsing speler <-> monsters
    for (const m of this.monsters) {
      if (m.eaten) continue;
      const d = Math.hypot(m.x - this.player.x, m.z - this.player.z);
      if (d > 0.85) continue;
      if (m.frightened) {
        m.getEaten();
        this.addScore(POINTS.monster);
        this.sfx.eatMonster();
        this.hud.toast(`${m.name} gesanctioneerd! +${POINTS.monster}`, 1.8);
      } else if (!m.harmless) {
        this.loseLife(m);
      }
    }

    if (this.maze.remaining === 0 && this.mode === 'playing') this.levelComplete();
  }

  canCrash(m) {
    return !m.eaten && m.stunTimer <= 0 && m.collideCooldown <= 0 && !m.respawning;
  }

  monsterCrash(a, b) {
    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;
    this.explosions.spawn(x, z);
    for (const m of [a, b]) {
      m.stun(CRASH_STUN, 'blast');
      m.collideCooldown = CRASH_STUN + CRASH_COOLDOWN;
    }
    // hoe dichterbij, hoe harder de flits en het schudden
    const d = Math.hypot(x - this.player.x, z - this.player.z);
    const near = Math.max(0, 1 - d / 45);
    this.sfx.nuke(0.35 + near * 0.65);
    this.hud.flash('#fff2c8', 0.25 + near * 0.6);
    this.shakeTime = 1.4;
    this.shakeAmp = 0.03 + near * 0.18;
    this.hud.toast(`Diplomatiek incident! ${a.name} en ${b.name} botsen en staan ${CRASH_STUN} sec stil.`, 3);
  }

  activatePower() {
    this.powerTimer = this.difficulty.powerDuration;
    for (const m of this.monsters) m.setFrightened(true);
    this.sfx.powerUp();
    this.sfx.startSiren();
    this.hud.flash('#2b6bff', 0.35);
    this.hud.toast(`SANCTIEPAKKET! ${this.difficulty.powerDuration} sec lang zijn de leiders eetbaar`, 2.2);
  }

  updateDying(dt) {
    this.dyingTimer -= dt;
    const k = 1 - this.dyingTimer / 1.8;
    this.player.roll = k * 1.2;
    this.player.pitch = -k * 0.5;
    this.player.syncCamera(0);
    for (const m of this.monsters) {
      m.time += dt;
      m.syncMesh();
      if (m.bubbleTimer > 0 && (m.bubbleTimer -= dt) <= 0) m.bubble.sprite.visible = false;
    }
    if (this.dyingTimer <= 0) {
      if (this.lives <= 0) {
        this.gameOver(this.killer);
      } else {
        this.mode = 'playing';
        this.resetRound();
        this.hud.toast(`Nog ${this.lives} ${this.lives === 1 ? 'leven' : 'levens'}. Nieuwe onderhandelingsronde!`, 2.2);
      }
    }
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === 'playing') this.update(dt);
    else if (this.mode === 'dying') this.updateDying(dt);
    this.hud.update(dt);

    const active = this.mode === 'playing' || this.mode === 'dying';
    if (active) this.explosions.update(dt);
    if (active && this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeTime / 1.4);
      this.camera.position.x += (Math.random() - 0.5) * a * 2;
      this.camera.position.y += (Math.random() - 0.5) * a * 2;
      this.camera.position.z += (Math.random() - 0.5) * a * 2;
    }
    this.sky.update(this.camera, this.time);
    if (this.hiQuality) this.dust.update(dt, this.player.x, this.player.z);

    if (this.maze) {
      this.minimap.updateVisibility(this.player, this.camera);
      this.minimap.draw(this.player, this.monsters, { fakes: this.fakes, projectiles: this.projectiles.points });
      this.mirrors.update(this.camera);
    }
    if (this.hiQuality) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.game = new Game();
