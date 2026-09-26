import * as THREE from 'three';
import { makeBoard, type BoardId } from '../model/boards';
import { makeEnv, configureRenderer } from './stage';

/**
 * انميشن الواجهة: اللوحات بتتبدّل وحدة ورا وحدة — تطلع من تحت، تلف، وتختفي.
 * بديل الروبوت الثابت: بيوصل إنه إحنا بنشتغل على كل الألواح.
 */
const ORDER: BoardId[] = ['uno', 'esp32', 'rpi', 'pico', 'esp8266'];
const HOLD = 4.2;            // ثواني لكل لوحة
const FADE = 1.1;            // مدة التبديل — أطول = أنعم

export function mountHeroBoards(canvas: HTMLCanvasElement, onChange?: (id: BoardId) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  configureRenderer(renderer);
  const env = makeEnv(renderer);

  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
  key.position.set(4, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 28; sc.updateProjectionMatrix();
  scene.add(key, new THREE.AmbientLight(0xffeedd, 0.55));
  const rim = new THREE.DirectionalLight(0xfa7b19, 1.25); rim.position.set(-6, 3, -4); scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.1; floor.receiveShadow = true; scene.add(floor);

  const holder = new THREE.Group(); scene.add(holder);
  let cur: THREE.Group | null = null, led: THREE.Mesh | null = null;
  let idx = 0;

  function build(i: number) {
    if (cur) { holder.remove(cur); cur.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); }
    const b = makeBoard(ORDER[i]);
    cur = b.group; led = b.led;
    const bb = new THREE.Box3().setFromObject(cur), size = new THREE.Vector3(), mid = new THREE.Vector3();
    bb.getSize(size); bb.getCenter(mid);
    cur.position.sub(mid);
    cur.scale.setScalar(5.6 / Math.max(size.x, size.z));
    cur.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.transparent = true; } });
    holder.add(cur);
    onChange?.(ORDER[i]);
  }
  build(0);

  // سحب بالإصبع يوقف التبديل التلقائي مؤقتاً
  let ry = 0.35, drag = false, px = 0, vy = 0, idle = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; idle = 0; canvas.setPointerCapture(e.pointerId); });
  const up = () => (drag = false);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; vy = (e.clientX - px) * 0.008; ry += vy; px = e.clientX; });

  const size = () => {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  new ResizeObserver(size).observe(canvas); size();

  let raf = 0, t0 = performance.now(), clock = 0, visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.02 });
  io.observe(canvas);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let last = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    const t = (now - t0) / 1000;

    if (!reduce) clock += dt;
    if (clock > HOLD + FADE) { clock = 0; idx = (idx + 1) % ORDER.length; build(idx); }

    // دخول: تطلع من تحت وتكبر | خروج: تنزل وتصغر
    const inP = Math.min(1, clock / FADE);
    const outP = clock > HOLD ? Math.min(1, (clock - HOLD) / FADE) : 0;
    // تنعيم مزدوج: يمنع الوقفة المفاجئة بأول وآخر التبديل
    const ease = (x: number) => { const t = x * x * (3 - 2 * x); return t * t * (3 - 2 * t); };
    const vis = ease(inP) * (1 - ease(outP));

    if (!drag) { vy *= 0.93; ry += 0.0045 + vy; idle += dt; }
    holder.rotation.set(0.5 + Math.sin(t * 0.5) * 0.03, ry, Math.sin(t * 0.35) * 0.03);
    holder.position.y = Math.sin(t * 0.85) * 0.14 + (1 - vis) * -1.4;
    holder.scale.setScalar(0.86 + vis * 0.14);
    if (cur) cur.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.opacity = vis; });
    if (led) { const mm = led.material as THREE.MeshStandardMaterial; mm.emissiveIntensity = (1.1 + Math.sin(t * 3.4) * 0.6) * vis; }

    cam.position.set(0, 6.2, 13.2);
    cam.lookAt(0, 0.2, 0);
    renderer.render(scene, cam);
  };
  loop();

  return { dispose: () => { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); } };
}
