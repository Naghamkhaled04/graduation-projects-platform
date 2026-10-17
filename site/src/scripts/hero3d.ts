import * as THREE from 'three';
import { clamp, sstep, colorAt, rgb, sectionProgress, setHeader, type Stops } from './theme';
import { buildBoard } from './board3d';

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
  const { board, parts, list, ledMat, ledLight } = buildBoard(renderer, scene, {
    pcb: ['#078a91', '#045a60'], env: 0x6f6a62, hemiGround: 0x9fb3c4, hemi: 0.9, key: 3.2,
  });

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
