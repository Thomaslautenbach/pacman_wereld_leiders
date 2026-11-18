import * as THREE from 'three';

// ---------- gedeelde texturen ----------
let smokeTex = null;
function getSmokeTexture() {
  if (smokeTex) return smokeTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  // een paar overlappende zachte bollen = pluizige rookwolk
  for (let i = 0; i < 7; i++) {
    const x = 64 + (Math.random() - 0.5) * 40;
    const y = 64 + (Math.random() - 0.5) * 40;
    const r = 26 + Math.random() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  smokeTex = new THREE.CanvasTexture(cv);
  smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}

let glowTex = null;
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// ---------- lucht ----------
/** Sterrenhemel met kleurverloop; volgt de camera zodat hij oneindig ver lijkt. */
export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      glow: { value: new THREE.Color() },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(horizon, top, pow(h, 0.45));
            c += glow * pow(1.0 - h, 6.0) * 0.6;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    dome.renderOrder = -10;
    this.group.add(dome);

    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 0.92); // alleen bovenste halve bol
      pos[i * 3] = Math.sin(v) * Math.cos(u) * 140;
      pos[i * 3 + 1] = Math.cos(v) * 140;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 140;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.stars.renderOrder = -9;
    this.group.add(this.stars);
  }

  setTheme(theme) {
    const fog = new THREE.Color(theme.fog);
    const accent = new THREE.Color(theme.accent);
    this.uniforms.top.value.copy(new THREE.Color(theme.ceiling)).multiplyScalar(0.5);
    this.uniforms.horizon.value.copy(fog).lerp(accent, 0.25);
    this.uniforms.glow.value.copy(accent).multiplyScalar(0.5);
  }

  update(camera, time) {
    this.group.position.copy(camera.position);
    this.stars.rotation.y = time * 0.005;
  }
}

// ---------- zwevend stof ----------
export class Dust {
  constructor(count = 350, range = 14) {
    this.range = range;
    this.count = count;
    const pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * range * 2;
      pos[i * 3 + 1] = Math.random() * 3.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * range * 2;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.15;
      this.vel[i * 3 + 1] = (Math.random() - 0.3) * 0.08;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.05, map: getGlowTexture(), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
  }

  setColor(c) {
    this.material.color.set(c);
  }

  /** Deeltjes wrappen rond de speler zodat er altijd stof in beeld is. */
  update(dt, cx, cz) {
    const p = this.geo.attributes.position.array;
    const R = this.range;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      p[k] += this.vel[k] * dt;
      p[k + 1] += this.vel[k + 1] * dt;
      p[k + 2] += this.vel[k + 2] * dt;
      if (p[k] - cx > R) p[k] -= 2 * R;
      else if (p[k] - cx < -R) p[k] += 2 * R;
      if (p[k + 2] - cz > R) p[k + 2] -= 2 * R;
      else if (p[k + 2] - cz < -R) p[k + 2] += 2 * R;
      if (p[k + 1] > 3.9) p[k + 1] = 0.1;
      else if (p[k + 1] < 0.05) p[k + 1] = 3.8;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------- paddenstoelwolk ----------
const LIFE = 8;
const STEM_H = 16; // ruim boven de muren (4) uit: zichtbaar door het hele doolhof
const FIRE = new THREE.Color(0xffb347);
const EMBER = new THREE.Color(0xff4a1c);
const SMOKE = new THREE.Color(0x77706a);
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** "Diplomatiek incident": atoompaddenstoel + schokgolf als monsters botsen. */
export class Explosions {
  constructor() {
    this.group = new THREE.Group();
    this.list = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 64);
  }

  spawn(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const puffs = [];
    const add = (kind, i, n, extra = {}) => {
      const mat = new THREE.SpriteMaterial({ map: getSmokeTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.material.rotation = Math.random() * Math.PI * 2;
      group.add(s);
      puffs.push({ s, kind, i, n, a: (i / n) * Math.PI * 2 + Math.random() * 0.3, jitter: Math.random(), ...extra });
    };
    for (let i = 0; i < 24; i++) add('stem', i, 24);
    for (let i = 0; i < 18; i++) add('cap', i, 18);
    for (let i = 0; i < 8; i++) add('top', i, 8);
    for (let i = 0; i < 12; i++) add('skirt', i, 12);

    // gloeiende kern en flits (additief)
    const glowMat = new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffd28a, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Sprite(glowMat);
    group.add(core);
    const flash = new THREE.Sprite(glowMat.clone());
    flash.material.color.set(0xffffff);
    flash.material.depthTest = false; // flits schijnt overal doorheen
    flash.renderOrder = 20;
    group.add(flash);

    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffc070, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);

    this.group.add(group);
    this.list.push({ t: 0, group, puffs, core, flash, ring });
  }

  update(dt) {
    for (let k = this.list.length - 1; k >= 0; k--) {
      const ex = this.list[k];
      ex.t += dt;
      const t = ex.t;
      const rise = easeOut(t / 2.2);
      const fadeOut = 1 - Math.min(1, Math.max(0, (t - (LIFE - 2.5)) / 2.5));
      const fadeIn = Math.min(1, t / 0.15);
      const cool = Math.min(1, Math.max(0, (t - 0.5) / 2.5));
      const topY = 0.4 + rise * STEM_H;

      for (const p of ex.puffs) {
        let x = 0;
        let y = 0;
        let z = 0;
        let size = 1;
        let heat = cool;
        if (p.kind === 'stem') {
          const f = p.i / (p.n - 1);
          y = 0.4 + f * (topY - 0.4);
          x = Math.sin(t * 1.3 + p.i) * 0.15;
          z = Math.cos(t * 1.1 + p.i) * 0.15;
          size = (1.8 + f * 0.9) + t * 0.15;
          heat = Math.min(1, cool + (1 - f) * 0.3);
        } else if (p.kind === 'cap') {
          const r = 0.8 + rise * 4.2 + t * 0.1;
          const a = p.a + t * 0.25;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          y = topY + Math.sin(p.a * 3) * 0.3 - rise * 0.6;
          size = 3.4 + t * 0.45;
          heat = cool * 0.85;
        } else if (p.kind === 'top') {
          const r = rise * 2.4 * p.jitter;
          x = Math.cos(p.a) * r;
          z = Math.sin(p.a) * r;
          y = topY + 0.9 + rise * 0.6;
          size = 3.8 + t * 0.5;
          heat = cool * 0.8;
        } else {
          const r = 0.4 + easeOut(t / 1.3) * 4.2;
          x = Math.cos(p.a) * r;
          z = Math.sin(p.a) * r;
          y = 0.6 + p.jitter * 0.4;
          size = 1.5 + t * 0.35;
        }
        p.s.position.set(x, y, z);
        p.s.scale.setScalar(size);
        const c = p.s.material.color;
        if (heat < 0.5) c.copy(FIRE).lerp(EMBER, heat * 2);
        else c.copy(EMBER).lerp(SMOKE, (heat - 0.5) * 2);
        p.s.material.opacity = fadeIn * fadeOut * (p.kind === 'skirt' ? 0.7 : 0.9);
      }

      ex.core.position.set(0, topY, 0);
      ex.core.scale.setScalar(7 + rise * 4);
      ex.core.material.opacity = Math.max(0, 1 - t / 3) * 0.9;
      ex.flash.position.set(0, 2, 0);
      ex.flash.scale.setScalar(4 + t * 60);
      ex.flash.material.opacity = Math.max(0, 1 - t / 0.5);
      const rr = 1 + easeOut(t / 1.4) * 14;
      ex.ring.scale.set(rr, rr, rr);
      ex.ring.material.opacity = Math.max(0, 1 - t / 1.4);

      if (t >= LIFE) {
        this.group.remove(ex.group);
        ex.group.traverse((o) => {
          if (o.material) o.material.dispose();
        });
        this.list.splice(k, 1);
      }
    }
  }

  clear() {
    for (const ex of this.list) this.group.remove(ex.group);
    this.list.length = 0;
  }
}
