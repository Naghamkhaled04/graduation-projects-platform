import * as THREE from 'three';
import { makeBoard, type BoardId } from '../model/boards';
import { makeEnv, configureRenderer } from './stage';

/** عارض لوحة واحدة يتبدّل بنعومة بين اللوحات، مع دوران بطيء وسحب بالإصبع */
export function mountBoards(canvas: HTMLCanvasElement, first: BoardId) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  configureRenderer(renderer);
  const env = makeEnv(renderer);

  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xfff2e2, 2.4);
  key.position.set(5, 9, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  const c = key.shadow.camera as THREE.OrthographicCamera;
  c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.updateProjectionMatrix();
  scene.add(key, new THREE.AmbientLight(0xffe9d2, 0.5));
  const rim = new THREE.DirectionalLight(0xe8743b, 1.1); rim.position.set(-5, 3, -5); scene.add(rim);

  // أرضية تلتقط الظل فقط
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.9; floor.receiveShadow = true;
  scene.add(floor);

  const holder = new THREE.Group(); scene.add(holder);
  let current: THREE.Group | null = null, led: THREE.Mesh | null = null;
  let swap = 1;                                  // ٠ = مخفي، ١ = ظاهر
  let pending: BoardId | null = null;

  function build(id: BoardId) {
    if (current) { holder.remove(current); current.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); }
    const b = makeBoard(id);
    current = b.group; led = b.led;
    // نوسّط اللوحة ونوحّد حجمها مهما اختلفت أبعادها
    const bb = new THREE.Box3().setFromObject(current);
    const size = new THREE.Vector3(), mid = new THREE.Vector3();
    bb.getSize(size); bb.getCenter(mid);
    current.position.sub(mid);
    const s = 5.4 / Math.max(size.x, size.z);
    current.scale.setScalar(s);
    holder.add(current);
  }
  build(first);

  let target: BoardId = first;
  const show = (id: BoardId) => { if (id === target) return; target = id; pending = id; };

  // تدوير بالسحب
  let ry = 0.5, rx = 0.62, drag = false, px = 0, py = 0, vy = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  const stop = () => (drag = false);
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    vy = (e.clientX - px) * 0.008; ry += vy;
    rx = Math.max(0.12, Math.min(1.35, rx + (e.clientY - py) * 0.005));
    px = e.clientX; py = e.clientY;
  });

  const size = () => {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 420;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  new ResizeObserver(size).observe(canvas);
  size();

  let raf = 0, t0 = performance.now(), visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.02 });
  io.observe(canvas);

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    const t = (performance.now() - t0) / 1000;

    if (pending) { swap = Math.max(0, swap - 0.09); if (swap <= 0.001) { build(pending); pending = null; } }
    else swap = Math.min(1, swap + 0.07);

    if (!drag) { vy *= 0.94; ry += 0.0028 + vy; }
    const ease = swap * swap * (3 - 2 * swap);
    holder.rotation.set(rx * 0.55, ry, Math.sin(t * 0.4) * 0.02);
    holder.position.y = Math.sin(t * 0.8) * 0.12 + (1 - ease) * -1.6;
    holder.scale.setScalar(0.82 + ease * 0.18);
    if (current) current.traverse((o) => { const m = o as THREE.Mesh; if (m.material) (m.material as THREE.Material).opacity = ease; });
    if (led) { const mm = led.material as THREE.MeshStandardMaterial; mm.emissiveIntensity = 1.1 + Math.sin(t * 3.2) * 0.55; }

    const dist = 13.5;
    cam.position.set(Math.sin(0) * dist, 5.5 + rx * 2.2, dist);
    cam.lookAt(0, 0.3, 0);
    renderer.render(scene, cam);
  };
  loop();

  return { show, dispose: () => { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); } };
}
