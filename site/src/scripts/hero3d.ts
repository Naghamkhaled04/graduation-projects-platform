import * as THREE from 'three';
import { clamp, sstep, colorAt, rgb, sectionProgress, setHeader, type Stops } from './theme';

/** مفاتيح حركة البوردة: [p, rx, ry, rz, x, y, scale] */
const KF: number[][] = [
  [0, 0.95, -0.55, 0.1, 0, -2.35, 0.68],
  [0.16, 0.7, 0.25, 0.05, -1.4, -0.4, 0.6],
  [0.34, 0.55, 0.95, 0.08, -2.0, 0, 0.56],
  [0.5, 0.65, 1.7, 0.04, -2.6, 0, 0.6],
  [0.62, 0.75, 2.6, 0, -3.0, 0, 0.62],
  [0.82, 1.22, 5.9, 0, -3.0, 0, 0.64],
  [1, 1.3, 6.5, 0, -3.0, 0, 0.66],
];
const BG: Stops = [[0, [233, 243, 248]], [0.4, [233, 243, 248]], [0.56, [14, 58, 99]], [1, [10, 36, 72]]];
const FG: Stops = [[0, [14, 58, 99]], [0.4, [14, 58, 99]], [0.56, [233, 243, 248]], [1, [233, 243, 248]]];
const FG2: Stops = [[0, [74, 99, 128]], [0.4, [74, 99, 128]], [0.56, [185, 202, 219]], [1, [185, 202, 219]]];

const kf = (p: number) => {
  let i = 0;
  while (i < KF.length - 2 && p > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1];
  const t = sstep(0, 1, clamp((p - a[0]) / (b[0] - a[0])));
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t);
};

const W = 6.8, D = 5.2, TH = 0.16, TOP = 0.1;

function pcbTexture() {
  const c = document.createElement('canvas');
  c.width = 1400; c.height = 1060;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 1400, 1060);
  gr.addColorStop(0, '#078a91'); gr.addColorStop(1, '#045a60');
  g.fillStyle = gr; g.fillRect(0, 0, 1400, 1060);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 110; i++) {
    let x = Math.round(rnd() * 70) * 20, y = Math.round(rnd() * 53) * 20;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * Math.round(rnd() * 8 + 2) * 20;
      else y += (rnd() < 0.5 ? -1 : 1) * Math.round(rnd() * 6 + 2) * 20;
      g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(190,255,250,${0.1 + rnd() * 0.14})`; g.lineWidth = 5 + rnd() * 4; g.stroke();
    g.beginPath(); g.arc(x, y, 9, 0, 7); g.fillStyle = 'rgba(230,255,252,.28)'; g.fill();
    g.beginPath(); g.arc(x, y, 4, 0, 7); g.fillStyle = '#075f65'; g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5;
  g.strokeRect(90, 110, 1220, 840); g.strokeRect(620, 300, 320, 320);
  g.beginPath(); g.arc(660, 340, 9, 0, 7); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = '700 92px "IBM Plex Sans Arabic",Arial'; g.fillText('مشاريع', 640, 760);
  g.font = '500 34px Arial'; g.fillText('IoT · REV 1.0', 640, 830);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Part { g: THREE.Group; base: THREE.Vector3; dir: THREE.Vector3; spin: number }

export function initHero(root: HTMLElement) {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const canvas = q<HTMLCanvasElement>('canvas');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    root.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0, 17);

  // بيئة انعكاس مصنوعة من ألواح مضيئة
  {
    const env = new THREE.Scene();
    const mat = (c: number, i: number, side = THREE.BackSide) =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side });
    env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), mat(0x6f6a62, 1)));
    const panel = (w: number, h: number, x: number, y: number, z: number, c: number, i: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c, i, THREE.DoubleSide));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(24, 12, 0, 22, 6, 0xffffff, 3.2);
    panel(10, 20, -24, 4, 4, 0xd8ecff, 1.6);
    panel(10, 20, 24, 2, -2, 0xd8f2f0, 1.2);
    panel(20, 6, 0, -16, 10, 0x3db7a6, 1.5);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb3c4, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3db7a6, 3); rim.position.set(-7, 3, -5); scene.add(rim);
  const ledLight = new THREE.PointLight(0x3db7a6, 8, 6, 2); scene.add(ledLight);

  // البوردة
  const board = new THREE.Group(); scene.add(board);
  {
    const r = 0.32, x = -W / 2, y = -D / 2, s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.quadraticCurveTo(x + W, y, x + W, y + r);
    s.lineTo(x + W, y + D - r); s.quadraticCurveTo(x + W, y + D, x + W - r, y + D);
    s.lineTo(x + r, y + D); s.quadraticCurveTo(x, y + D, x, y + D - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    [[-2.9, -2.0], [2.7, -1.6], [-2.9, 1.9], [2.7, 2.0]].forEach(([hx, hy]) => {
      const h = new THREE.Path(); h.absarc(hx, hy, 0.2, 0, 7, true); s.holes.push(h);
    });
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: TH, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 16,
    });
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, (p.getY(i) + D / 2) / D);
    geo.translate(0, 0, -TH / 2); geo.rotateX(-Math.PI / 2);
    board.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: pcbTexture(), roughness: 0.42, metalness: 0.12 })));
  }

  const black = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.45, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.22, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6c15a, roughness: 0.28, metalness: 1 });
  const orangeM = new THREE.MeshStandardMaterial({ color: 0x3db7a6, roughness: 0.4 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o;
  };
  const parts: Record<string, Part> = {};
  const list: Part[] = [];
  let ledMat!: THREE.MeshStandardMaterial;
  const part = (name: string, x: number, z: number, dir: number[], build: (g: THREE.Group) => void, spin = 0) => {
    const g = new THREE.Group(); g.position.set(x, TOP, z); build(g); board.add(g);
    const o = { g, base: g.position.clone(), dir: new THREE.Vector3(...dir), spin };
    parts[name] = o; list.push(o);
  };
  part('usb', -2.65, -1.05, [-2.2, 2.4, -0.6], (g) => { g.add(box(1.7, 0.95, 1.3, metal)); g.add(box(1.5, 0.05, 1.1, black, 0, 0.95)); });
  part('dc', -2.75, 1.4, [-2.4, 2.9, 1.5], (g) => { g.add(box(1.5, 0.75, 1, black)); g.add(box(0.5, 0.05, 0.5, metal, -0.3, 0.75)); });
  part('mcu', 0.85, 0.2, [0, 4.6, 0], (g) => {
    g.add(box(1.5, 0.18, 1.5, black));
    const pg = new THREE.BoxGeometry(0.07, 0.05, 0.24);
    for (let i = 0; i < 12; i++) {
      const t = -0.6 + i * 0.109;
      for (const [a, b, rot] of [[t, -0.83, 0], [t, 0.83, 0], [-0.83, t, 1], [0.83, t, 1]] as number[][]) {
        const pin = new THREE.Mesh(pg, metal); pin.position.set(a, 0.05, b); if (rot) pin.rotation.y = Math.PI / 2; g.add(pin);
      }
    }
  }, 0.5);
  part('chip2', -1.35, -0.65, [-0.8, 3.3, -1.8], (g) => g.add(box(0.8, 0.14, 0.8, black)), -0.4);
  part('reg', -1.5, 1.45, [-0.9, 2.6, 2], (g) => g.add(box(0.62, 0.32, 0.55, black)), 0.3);
  part('xtal', -0.35, -1.05, [0.2, 3.8, -2.2], (g) => g.add(box(0.55, 0.2, 0.28, metal)), 0.6);
  [[-2.05, 0.5], [-1.6, 0.15]].forEach(([x, z], i) =>
    part('cap' + i, x, z, [-1.6 - i * 0.4, 3.6 + i * 0.5, 0.6], (g) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 28), new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.4, metalness: 0.3 }));
      c.position.y = 0.25; g.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 28), metal); t.position.y = 0.5; g.add(t);
    }, i * 0.4));
  part('reset', -2.2, -1.95, [-1.2, 4, -2], (g) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 24), orangeM); c.position.y = 0.11; g.add(c); g.add(box(0.5, 0.09, 0.5, metal));
  }, 0.8);
  part('led', 2.35, -0.35, [1.8, 3.6, -0.2], (g) => {
    ledMat = new THREE.MeshStandardMaterial({ color: 0x3db7a6, emissive: 0x3db7a6, emissiveIntensity: 1.6, roughness: 0.3 });
    g.add(box(0.34, 0.12, 0.22, ledMat));
  });
  part('head', 0, -2.2, [0, 2.6, -2.9], (g) => {
    g.add(box(4.6, 0.42, 0.28, black));
    for (let i = 0; i < 10; i++) g.add(box(0.09, 0.36, 0.09, gold, -2.05 + i * 0.455, 0.42, 0));
  });
  part('head2', 0.2, 2.2, [0, 2.8, 3], (g) => {
    g.add(box(4.2, 0.42, 0.28, black));
    for (let i = 0; i < 8; i++) g.add(box(0.09, 0.36, 0.09, gold, -1.85 + i * 0.53, 0.42, 0));
  });
  part('sw', 2.55, 1.5, [1.9, 3.2, 1.6], (g) => {
    g.add(box(0.7, 0.28, 0.7, black));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20), metal); c.position.y = 0.33; g.add(c);
  }, 0.5);

  // ظل وغبار
  const shadow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(10, 36, 72,.38)'); gr.addColorStop(1, 'rgba(10, 36, 72,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = -2.6; scene.add(m); return m;
  })();
  const dust = (() => {
    const n = 140, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 26; a[i * 3 + 1] = (Math.random() - 0.5) * 14; a[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x3db7a6, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(pts); return pts;
  })();

  // عناصر الواجهة
  const titleEl = q('.h3-title'), sub = q('.h3-sub'), hint = q('.h3-hint'), bar = q('.h3-prog i'), stage = q('.h3-stage');
  const caps = [...root.querySelectorAll<HTMLElement>('.cap')];
  const tags = [...root.querySelectorAll<HTMLElement>('.tag')];
  const tagPart = (el: HTMLElement) => parts[el.dataset.part!];

  const resize = () => {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    cam.aspect = stage.clientWidth / stage.clientHeight; cam.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();

  let cur = 0, mx = 0, my = 0, smx = 0, smy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  const v = new THREE.Vector3();

  const tick = () => {
    requestAnimationFrame(tick);
    const { p: target, visible, covers } = sectionProgress(root);
    if (covers) setHeader(rgb(colorAt(FG, cur)), rgb(colorAt(BG, cur)));
    if (!visible) return;
    const t = (performance.now() - t0) / 1000;
    cur += (target - cur) * (reduce ? 1 : 0.075);
    const p = cur;
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;

    const k = kf(p), portrait = innerWidth < 760;
    const e = sstep(0.1, 0.3, p) - sstep(0.46, 0.64, p);
    board.rotation.set(k[0] + smy * 0.16 + Math.sin(t * 0.7) * 0.015, k[1] + smx * 0.3, k[2] + Math.sin(t * 0.5) * 0.02);
    board.position.set(portrait ? 0 : k[3], k[4] + (portrait && p > 0.55 ? 1.6 : 0) + Math.sin(t * 0.9) * 0.1, 0);
    board.scale.setScalar(k[5] * (portrait ? 0.68 : 1));
    for (const o of list) {
      o.g.position.copy(o.base).addScaledVector(o.dir, e * 1.15);
      o.g.rotation.y = o.spin * e * 0.6;
      o.g.rotation.x = Math.sin(t * 1.3 + o.spin * 4) * 0.04 * e;
    }
    ledMat.emissiveIntensity = 1.1 + Math.sin(t * 4) * 0.7;
    parts.led.g.getWorldPosition(v); ledLight.position.copy(v).y += 0.6; ledLight.intensity = 5 + Math.sin(t * 4) * 3;
    const sm = shadow.material as THREE.MeshBasicMaterial;
    sm.opacity = (1 - sstep(0.6, 0.8, p)) * (1 - e * 0.35); shadow.scale.setScalar(1 + e * 0.4);
    dust.rotation.y = t * 0.03 + p * 0.8; dust.position.y = p * 2.2;

    const bg = rgb(colorAt(BG, p));
    stage.style.background = bg;
    stage.style.setProperty('--fg', rgb(colorAt(FG, p)));
    stage.style.setProperty('--fg-2', rgb(colorAt(FG2, p)));
    stage.style.setProperty('--bgc', bg);

    titleEl.style.opacity = String(1 - sstep(0.02, 0.16, p));
    titleEl.style.transform = `translateY(${-6 - p * 40}vh) scale(${1 + p * 0.35})`;
    sub.style.opacity = String(1 - sstep(0, 0.06, p));
    sub.style.transform = `translateY(${p * 120}px)`;
    sub.style.pointerEvents = p > 0.06 ? 'none' : 'auto';
    hint.style.opacity = p < 0.03 ? '0.55' : '0';
    bar.style.height = `${p * 100}%`;

    const idx = p < 0.2 ? 0 : p < 0.47 ? 1 : p < 0.75 ? 2 : 3;
    caps.forEach((c) => c.classList.toggle('on', Number(c.dataset.i) === idx));

    const sw = stage.clientWidth, sh = stage.clientHeight;
    for (const el of tags) {
      tagPart(el).g.getWorldPosition(v); v.project(cam);
      el.style.left = `${(v.x * 0.5 + 0.5) * sw}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * sh}px`;
      el.style.opacity = String(clamp((e - 0.7) * 3.3));
    }
    renderer.render(scene, cam);
  };
  tick();
}
