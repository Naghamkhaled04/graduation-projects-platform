import * as THREE from 'three';
import { clamp } from './theme';
import { buildBoard } from './board3d';

/**
 * هيرو الرئيسية بموقع الدروبال: نفس بوردة صفحة البداية (نزول وتشغيل)، بس جوّا صندوق الهيرو لحاله،
 * بلا ربط بأقسام صفحة البداية. الصورة الثابتة بتضل لحد ما البوردة تجهز، وبتضل بديل لو ما في WebGL.
 * بيتبني لملف واحد: npm run build:hero ← dist-hero/hero-board.js
 */
export function initHeroBoard(box: HTMLElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'hb-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { return; } // بلا WebGL: الصورة الثابتة بتضل
  box.appendChild(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0, 17);
  const { board, parts, pcbMat, ledMat, ledLight, rim } = buildBoard(renderer, scene, {
    pcb: ['#0d4d6b', '#082c4a'], env: 0x1a2a44, hemiGround: 0x1c5f77, hemi: 0.8, key: 2.6,
  });
  ledMat.color.set(0x1c3a40); ledMat.emissiveIntensity = 0; rim.intensity = 0; ledLight.intensity = 0;

  const shadow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(61,183,166,.35)'); gr.addColorStop(1, 'rgba(61,183,166,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; scene.add(m); return m;
  })();

  // المشهد بحجم الكانفس (أكبر من صندوق الصورة شوي عشان البوردة تطفو بلا قص)، والبوردة بتصغر لما يضيق
  let fit = 1;
  const resize = () => {
    const w = canvas.clientWidth || box.clientWidth, h = canvas.clientHeight || w * 0.62;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    fit = 1.0 * Math.min(1, cam.aspect / 1.55);
  };
  new ResizeObserver(resize).observe(canvas); resize();

  let mx = 0, my = 0, smx = 0, smy = 0;
  box.closest('section')?.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
  }, { passive: true });

  // نزول (0→1.1ث) ثم تشغيل (1.35→2.35ث)، زي صفحة البداية
  const T_DROP = 1.1, T_ON = 1.35, T_ON_LEN = 1.0, t0 = performance.now();
  const outBack = (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
  const flicker = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : [0.2, 0.9, 0.1, 1, 0.4, 1, 0.7, 1][Math.floor(t * 8)]);
  const v = new THREE.Vector3();
  let shown = false;

  const frame = () => {
    const t = reduce ? 99 : (performance.now() - t0) / 1000;
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
    const d = clamp(t / T_DROP), drop = (1 - outBack(d)) * 9;
    board.rotation.set(0.85 + smy * 0.14 + (1 - d) * 0.6, -0.35 + smx * 0.25 - (1 - d) * 0.9, 0.08 + Math.sin(t * 0.5) * 0.02);
    board.position.set(0, -0.2 + drop + Math.sin(t * 0.9) * 0.08, 0);
    board.scale.setScalar(fit);
    shadow.position.set(0, -1.8, 0);
    (shadow.material as THREE.MeshBasicMaterial).opacity = d * 0.9;
    const fl = flicker(clamp((t - T_ON) / T_ON_LEN));
    pcbMat.emissiveIntensity = fl * (0.55 + Math.sin(t * 2) * 0.12);
    ledMat.emissiveIntensity = fl * (1.3 + Math.sin(t * 4) * 0.6);
    rim.intensity = fl * 3;
    parts.led.g.getWorldPosition(v); ledLight.position.copy(v).y += 0.6; ledLight.intensity = fl * (5 + Math.sin(t * 4) * 2);
    renderer.render(scene, cam);
    if (!shown) { shown = true; box.classList.add('hb-ready'); } // أول رسمة: الصورة الثابتة بتختفي
  };

  if (reduce) { frame(); new ResizeObserver(frame).observe(box); return; }
  // بيرسم بس لما الهيرو ظاهر، عشان البطارية
  let on = true, raf = 0;
  const loop = () => { raf = requestAnimationFrame(loop); frame(); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; loop(); }
    else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
  }).observe(box);
  loop();
}

const box = document.querySelector<HTMLElement>('[data-hero-board]');
if (box) initHeroBoard(box);
