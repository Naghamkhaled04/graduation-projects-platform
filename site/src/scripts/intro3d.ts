import * as THREE from 'three';
import { clamp, sstep } from './theme';
import { buildBoard } from './board3d';

type Pose = [number, number, number, number, number, number]; // rx, ry, rz, x, y, scale
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Pose, b: Pose, t: number) => a.map((v, i) => lerp(v, b[i], t)) as Pose;

const OPEN: Pose = [0.95, -0.55, 0.1, 0, -3.0, 0.56];
const IDEA = (q: number): Pose => [0.6, 0.6 + q * 2.2, 0.05, -2.9, -0.1, 0.6];
const TEAM = (q: number): Pose => [0.75, 0.3 + q * 2.4, 0, 0, -2.2, 0.62]; // تحت النص، بتلف ببطء على المسرح الكحلي
const WHY = (q: number): Pose => [0.7, 2.8 + q * 3.2, 0, -2.9, 0, 0.58];
const PORT: Pose = [0.25, Math.PI / 2, 0, 0, 1.5, 0.85]; // فتحة الـUSB (طرف -X) بتواجه الكاميرا

export function initIntro(root: HTMLElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.stage3d')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { root.classList.add('no-webgl', 'powered'); return; }
  root.classList.add('js-3d');
  if (reduce) root.classList.add('still');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0, 17);
  const { board, parts, list, pcbMat, ledMat, ledLight, rim } = buildBoard(renderer, scene, {
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

  const sec = (id: string) => root.querySelector<HTMLElement>(id)!;
  const sIdea = sec('#s-idea'), sTeam = sec('#s-team'), sWhy = sec('#s-why'), sPort = sec('#s-port');
  const prog = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return clamp((innerHeight * 0.6 - r.top) / r.height); };


  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  let mx = 0, my = 0, smx = 0, smy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  // نزول (0→1.1ث) ثم تشغيل (1.35→2.35ث)
  const T_DROP = 1.1, T_ON = 1.35, T_ON_LEN = 1.0, t0 = performance.now();
  const bootEl = root.querySelector<HTMLElement>('.boot');
  const lines = ['> DROP ............ OK', '> PWR 3.3V ........ OK', '> MCU INIT ........ OK', '> LINK ............ READY'];
  let line = -1;
  const outBack = (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
  const flicker = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : [0.2, 0.9, 0.1, 1, 0.4, 1, 0.7, 1][Math.floor(t * 8)]);
  const v = new THREE.Vector3();

  const frame = () => {
    const t = reduce ? 99 : (performance.now() - t0) / 1000;
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
    const portrait = innerWidth < 760;

    // تقدم الأقسام (مع تقليل الحركة كله صفر → البوردة ثابتة على OPEN)
    const p0 = reduce ? 0 : clamp(scrollY / (innerHeight * 0.9));
    const qI = reduce ? 0 : prog(sIdea), qT = reduce ? 0 : prog(sTeam), qW = reduce ? 0 : prog(sWhy), qP = reduce ? 0 : prog(sPort);

    let pose = OPEN;
    pose = mix(pose, IDEA(qI), sstep(0.15, 1, p0));
    pose = mix(pose, TEAM(qT), sstep(0.85, 1, qI)); // بتنزل وقت ما "هدفنا" بيطلع، قبل ما يوصل عنوان "مين نحن"
    pose = mix(pose, WHY(qW), sstep(0, 0.25, qW));
    pose = mix(pose, PORT, sstep(0, 0.4, qP));
    if (portrait) { pose = [...pose] as Pose; pose[3] = 0; pose[4] = lerp(pose[4], 2.6, sstep(0.2, 0.4, p0) * (1 - sstep(0.1, 0.25, qP))); pose[5] *= 0.62; } // بالموبايل فوق النص، بانتقال ناعم

    // النزول
    const d = clamp(t / T_DROP), drop = (1 - outBack(d)) * 9;
    board.rotation.set(pose[0] + smy * 0.14 + (1 - d) * 0.6, pose[1] + smx * 0.25 - (1 - d) * 0.9, pose[2] + Math.sin(t * 0.5) * 0.02);
    board.position.set(pose[3], pose[4] + drop + Math.sin(t * 0.9) * 0.08, 0);

    board.scale.setScalar(pose[5]);

    shadow.position.set(pose[3], pose[4] - 1.6, 0);
    (shadow.material as THREE.MeshBasicMaterial).opacity = d * 0.9 * (1 - sstep(0.3, 0.7, qP));

    // التشغيل + توهّج الدخول
    const fl = flicker(clamp((t - T_ON) / T_ON_LEN)), plug = sstep(0.3, 0.8, qP);
    pcbMat.emissiveIntensity = fl * (0.55 + Math.sin(t * 2) * 0.12) * (1 + plug);
    ledMat.emissiveIntensity = fl * (1.3 + Math.sin(t * 4) * 0.6 + plug * 1.5);
    rim.intensity = fl * (3 + plug * 3);
    parts.led.g.getWorldPosition(v); ledLight.position.copy(v).y += 0.6; ledLight.intensity = fl * (5 + Math.sin(t * 4) * 2);
    const k = Math.floor(clamp((t - 0.4) / 2.2) * lines.length);
    if (bootEl && k !== line && k < lines.length) { line = k; bootEl.textContent = lines[k]; }
    root.classList.toggle('powered', fl >= 1);
    root.classList.toggle('plugged', plug > 0.6);

    // تفكيك مع "فكرتنا"، وتركيب مع "هدفنا"
    const e = sstep(0.05, 0.3, qI) * (1 - sstep(0.55, 0.85, qI));
    list.forEach((o) => { o.g.position.copy(o.base).addScaledVector(o.dir, e * 1.1); o.g.rotation.y = o.spin * e * 0.6; });

    renderer.render(scene, cam);
  };

  if (reduce) { frame(); addEventListener('resize', frame); return; }
  const loop = () => { requestAnimationFrame(loop); frame(); };
  loop();
}
