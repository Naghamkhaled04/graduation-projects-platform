import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createStage, makeEnv, configureRenderer, type Stage } from '../scripts/stage';
import { setHeader } from '../scripts/theme';
import projectsRaw from '../data/projects.json';
import { createStore, type Store } from './store';
import { makeTower, towerLook } from './buildings';
import { getSocial } from './social';
import { svg } from '../data/icons';
import { windowMaterial } from './materials';
import { loadRuntime, toCard } from '../projects/store';
import { PLOTS, STYLES, COLORS, MAX_PROJECTS, clean, type Building, type Style } from './types';

interface P { id: string; t: string; d: string; ln: string; cost: string; x?: boolean }
const PROJECTS = new Map((projectsRaw as P[]).map((p) => [p.id, p]));
const LINES = [-120, -80, -40, 0, 40, 80, 120];
const SKY = ['dnet', 'dsolar', 'uav', 'zep'];
const NIGHT = 0x061214;

const $ = <T extends HTMLElement>(root: ParentNode, s: string) => root.querySelector<T>(s)!;
const mat = (c: number, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const bright = (c: number | string, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o; };
const rand = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const faceDir = (px: number, pz: number): [number, number] => (Math.abs(pz) >= Math.abs(px) ? [0, -Math.sign(pz)] : [-Math.sign(px), 0]);

interface Placed { data: Building; group: THREE.Group; body: THREE.Mesh; h: number; pos: THREE.Vector3; front: [number, number]; spinners: THREE.Object3D[]; blinkers: THREE.Mesh[] }

export async function initCity(root: HTMLElement) {
  const canvas = root.querySelector('canvas')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch { root.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(NIGHT);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  setHeader('rgb(247,239,227)', 'rgb(6,18,20)');
  try { await document.fonts.load('700 64px "IBM Plex Sans Arabic"', 'مشفى'); } catch { /* اختياري */ }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x040d0f, 140, 470);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 1200);
  cam.position.set(150, 95, 170);
  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06; controls.maxPolarAngle = 1.5; controls.minDistance = 10; controls.maxDistance = 330;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.target.set(0, 12, 0);

  // إضاءة ليلية
  scene.add(new THREE.HemisphereLight(0x5f8f97, 0x081213, 0.55));
  const moon = new THREE.DirectionalLight(0xa9c4ff, 0.9); moon.position.set(-120, 200, -160); scene.add(moon);
  const warm = new THREE.DirectionalLight(0xe8743b, 0.7); warm.position.set(160, 40, 120); scene.add(warm);

  // سماء + نجوم + قمر
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 top=vec3(0.002,0.008,0.014); vec3 mid=vec3(0.006,0.024,0.03); vec3 hor=vec3(0.06,0.03,0.02); vec3 c = mix(hor, mid, smoothstep(0.0,0.22,h)); c = mix(c, top, smoothstep(0.15,0.85,h)); gl_FragColor = vec4(c,1.0); }',
  })));
  {
    const n = 700, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.92 + 0.08); a[i * 3] = Math.sin(v) * Math.cos(u) * 620; a[i * 3 + 1] = Math.cos(v) * 620; a[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 620; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff3dd, size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, toneMapped: false })));
    const m = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16), bright(0xfff0d0, 1.9)); m.position.set(-260, 190, -330); scene.add(m);
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(128, 128, 8, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,210,.55)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.set(190, 190, 1); sp.position.copy(m.position); scene.add(sp);
  }

  // الأرض والشوارع
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(178, 182, 1, 120), mat(0x0a1a1c, 0.95, 0)); ground.position.y = -0.5; scene.add(ground);
  const roadMat = mat(0x152a2c, 0.9, 0);
  for (const l of LINES) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(330, 0.2, 7), roadMat); a.position.set(0, 0.12, l);
    const b = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 330), roadMat); b.position.set(l, 0.13, 0); scene.add(a, b);
  }
  const lawns: THREE.Mesh[] = [], markers: THREE.Mesh[] = [];
  PLOTS.forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(33, 0.3, 33), mat(0x0d2124, 0.95, 0)); l.position.set(x, 0.05, z); scene.add(l); lawns.push(l);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.18, 8, 44), bright(0xe8743b, 1.7)); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.4, z); scene.add(ring); markers.push(ring);
  });

  // خط الأفق: ناطحات خلفية تملأ المدينة (ديكور، ليست مباني أشخاص)
  {
    const fillMat = windowMaterial({ base: 0x0d2124, tint: 0xffb060, seed: 3, glow: 1.05, lit: 0.62 });
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const spots: [number, number, number, number, number][] = [];
    const ring = [[-11.5, -11.5], [0, -11.5], [11.5, -11.5], [-11.5, 0], [11.5, 0], [-11.5, 11.5], [0, 11.5], [11.5, 11.5]];
    PLOTS.forEach(([px, pz]) => ring.forEach(([dx, dz]) => {
      const dist = Math.hypot(px + dx, pz + dz), w = 6 + rand() * 2.5, d = 6 + rand() * 2.5;
      const h = 6 + rand() * 20 * Math.max(0.35, 1.3 - dist / 190);
      spots.push([px + dx + (rand() - 0.5) * 2, pz + dz + (rand() - 0.5) * 2, w, h, d]);
    }));
    const inst = new THREE.InstancedMesh(geo, fillMat, spots.length); const m4 = new THREE.Matrix4(), col = new THREE.Color();
    spots.forEach(([x, z, w, h, d], i) => { m4.compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); inst.setMatrixAt(i, m4); const k = 0.7 + rand() * 0.6; inst.setColorAt(i, col.setRGB(k, k, k)); });
    scene.add(inst);
  }

  // إنارة الشوارع + سيارات عابرة (ضوء فقط)
  {
    const lampG = new THREE.SphereGeometry(0.28, 6, 6), pts: THREE.Vector3[] = [];
    for (const l of LINES) for (let i = -160; i <= 160; i += 14) for (const s of [-4.2, 4.2]) pts.push(new THREE.Vector3(i, 3.4, l + s), new THREE.Vector3(l + s, 3.4, i));
    const lamps = new THREE.InstancedMesh(lampG, bright(0xffc079, 1.5), pts.length); const m4 = new THREE.Matrix4();
    pts.forEach((p, i) => lamps.setMatrixAt(i, m4.setPosition(p))); scene.add(lamps);
  }
  const ambient = (() => {
    const roads: { ax: 'x' | 'z'; l: number }[] = []; for (const l of LINES) if (l !== 0) roads.push({ ax: 'x', l }, { ax: 'z', l });
    const cars: { ax: 'x' | 'z'; l: number; dir: 1 | -1; lane: number; s: number; v: number }[] = [];
    roads.forEach((r) => { for (let k = 0; k < 6; k++) { const dir = k % 2 ? -1 : 1; cars.push({ ax: r.ax, l: r.l, dir: dir as 1 | -1, lane: dir * 1.8, s: (rand() - 0.5) * 300, v: 9 + rand() * 9 }); } });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), new THREE.MeshBasicMaterial({ toneMapped: false }), cars.length);
    const c = new THREE.Color(); cars.forEach((car, i) => inst.setColorAt(i, car.dir > 0 ? c.setRGB(1.5, 1.3, 0.9) : c.setRGB(1.5, 0.15, 0.12)));
    scene.add(inst); return { cars, inst };
  })();

  // ---- المباني ----
  const placed = new Map<string, Placed>();
  const pickables: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];
  let mineId: string | null = null;

  function addBuilding(b: Building) {
    const [px, pz] = PLOTS[b.plot], front = faceDir(px, pz);
    const look = towerLook(b.projects.length, b.executed ?? 0, b.ownerPoints ?? 0);
    const made = makeTower(b.style, b.color, b.sign, look.floors, b.plot * 7 + 3, look);
    const inner = new THREE.Group(); inner.add(made.group); inner.rotation.y = Math.atan2(front[0], front[1]);
    const holder = new THREE.Group(); holder.position.set(px, 0.2, pz); holder.add(inner); scene.add(holder);
    made.body.userData.pick = { kind: 'b', id: b.id }; pickables.push(made.body);
    spinners.push(...made.spinners);
    (lawns[b.plot].material as THREE.MeshStandardMaterial).color.set(0x123034); markers[b.plot].visible = false;
    placed.set(b.id, { data: b, group: holder, body: made.body, h: made.h, pos: new THREE.Vector3(px, 0, pz), front, spinners: made.spinners, blinkers: made.blinkers });
    refreshCounters();
  }
  function removeBuilding(id: string) {
    const p = placed.get(id); if (!p) return;
    scene.remove(p.group); pickables.splice(pickables.indexOf(p.body), 1);
    p.spinners.forEach((s) => spinners.splice(spinners.indexOf(s), 1));
    (lawns[p.data.plot].material as THREE.MeshStandardMaterial).color.set(0x0d2124); markers[p.data.plot].visible = true;
    placed.delete(id); refreshCounters();
  }

  // ---- طائرات ----
  const drones: { g: THREE.Group; r: number; h: number; sp: number; a: number; rotors: THREE.Object3D[]; id: string }[] = [];
  SKY.forEach((id, i) => {
    const g = new THREE.Group(), rotors: THREE.Object3D[] = [];
    if (id === 'zep') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 16), mat(0x2a3f42, 0.5)); body.scale.set(2.4, 1, 1); g.add(body, box(0.2, 1.4, 1.8, mat(0xe8743b), -3.4, -0.5, 0));
    } else {
      g.add(box(1.8, 0.5, 1.8, mat(0x1c2526, 0.4, 0.4)));
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        g.add(box(1.5, 0.12, 0.12, mat(0x39484a), sx * 0.9, 0.2, sz * 0.9).rotateY(sx * sz * 0.785));
        const rt = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0x9fe8ee, transparent: true, opacity: 0.25 })); rt.position.set(sx * 1.4, 0.6, sz * 1.4); g.add(rt); rotors.push(rt);
      }
    }
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bright(i % 2 ? 0xff3b30 : 0x33ff99, 3)); lt.position.y = -0.2; g.add(lt);
    g.userData.pick = { kind: 'p', id }; scene.add(g); pickables.push(g);
    drones.push({ g, r: 34 + i * 14, h: 34 + i * 6, sp: (0.09 + i * 0.025) * (i % 2 ? -1 : 1), a: i * 1.6, rotors, id });
  });

  // ---- تقاطع المركز: إشارات وإسعاف ----
  const lights: { ax: 'x' | 'z'; red: THREE.Mesh; green: THREE.Mesh }[] = [];
  const pole = (x: number, z: number, ax: 'x' | 'z') => {
    const g = new THREE.Group(); g.position.set(x, 0.2, z);
    g.add(box(0.25, 5, 0.25, mat(0x22292a, 0.5, 0.4)), box(0.8, 1.9, 0.6, mat(0x0a0f10), 0, 4.2, 0));
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }));
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), new THREE.MeshBasicMaterial({ color: 0x33d17a, toneMapped: false }));
    red.position.set(0, 5.5, 0.32); green.position.set(0, 4.7, 0.32);
    g.rotation.y = ax === 'x' ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : z < 0 ? 0 : Math.PI; g.add(red, green); scene.add(g); lights.push({ ax, red, green });
  };
  pole(-5, 5, 'x'); pole(5, -5, 'x'); pole(5, 5, 'z'); pole(-5, -5, 'z');
  const vehicles: { g: THREE.Group; ax: 'x' | 'z'; dir: 1 | -1; lane: number; s: number; v: number; amb?: boolean }[] = [];
  const car = (color: number, amb = false) => {
    const g = new THREE.Group();
    g.add(box(amb ? 3.6 : 2.6, 0.9, 1.3, mat(color, 0.5, 0.2), 0, 0.25, 0), box(amb ? 1.8 : 1.4, 0.7, 1.15, mat(0x9fb7b9, 0.3, 0.3), amb ? -0.4 : -0.1, 1.05, 0));
    const hl = bright(0xffe9b8, 3), tl = bright(0xff2d2d, 3), L = amb ? 1.8 : 1.3;
    for (const s of [-0.45, 0.45]) { g.add(box(0.12, 0.25, 0.3, hl, L, 0.6, s), box(0.12, 0.25, 0.3, tl, -L, 0.6, s)); }
    scene.add(g); return g;
  };
  const cc = [0xe8743b, 0x3b6f73, 0xc6d3a6, 0x7fa07a, 0xf2ead9];
  const addCar = (ax: 'x' | 'z', dir: 1 | -1, lane: number, s: number, v: number, c: number) => vehicles.push({ g: car(c), ax, dir, lane, s, v });
  addCar('x', -1, -1.8, 40, 7, cc[0]); addCar('x', -1, -1.8, -10, 7, cc[1]); addCar('x', -1, -1.8, -70, 7, cc[3]);
  addCar('z', 1, 1.8, -50, 6, cc[2]); addCar('z', 1, 1.8, -14, 6, cc[3]); addCar('z', -1, -1.8, 44, 6.5, cc[4]); addCar('z', -1, -1.8, 8, 6.5, cc[1]);
  const amb = car(0xffffff, true); amb.add(box(3.3, 0.35, 1.34, mat(0xe8743b), 0, 0.6, 0));
  const sirenA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2d2d, toneMapped: false }));
  const sirenB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0x2d6bff, toneMapped: false }));
  sirenA.position.set(-0.3, 1.95, 0.35); sirenB.position.set(-0.3, 1.95, -0.35); amb.add(sirenA, sirenB);
  const ambLight = new THREE.PointLight(0xff3b30, 0, 30, 2); ambLight.position.set(-0.3, 2.6, 0); amb.add(ambLight);
  vehicles.push({ g: amb, ax: 'x', dir: 1, lane: 1.8, s: -80, v: 12, amb: true });

  // ---- المعالجة اللاحقة (توهج) ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let bloomOn = true;

  // ---- واجهة ----
  const status = $<HTMLElement>(root, '.status'), statusTxt = $<HTMLElement>(status, 'span');
  const panel = $<HTMLElement>(root, '.panel'), builder = $<HTMLElement>(root, '.builder'), tip = $<HTMLElement>(root, '.tip'), toastEl = $<HTMLElement>(root, '.toast');
  const btnExplore = $<HTMLButtonElement>(root, '#btn-explore'), btnFly = $<HTMLButtonElement>(root, '#btn-fly'), btnBuild = $<HTMLButtonElement>(root, '#btn-build');
  const stickEl = $<HTMLElement>(root, '.stick'), cBuild = $(root, '#c-buildings'), cProj = $(root, '#c-projects');
  let mode: 'explore' | 'fly' = 'explore';
  const goal = { pos: null as THREE.Vector3 | null, tgt: null as THREE.Vector3 | null };
  const stopAuto = () => { controls.autoRotate = false; };
  controls.addEventListener('start', () => { goal.pos = goal.tgt = null; stopAuto(); });
  const flyTo = (pos: THREE.Vector3, tgt: THREE.Vector3) => { goal.pos = pos; goal.tgt = tgt; stopAuto(); };
  let toastT = 0;
  const toast = (m: string) => { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastT); toastT = window.setTimeout(() => toastEl.classList.remove('on'), 4200); };
  function refreshCounters() { const all = new Set<string>(); placed.forEach((p) => p.data.projects.forEach((x) => all.add(x))); cBuild.textContent = String(placed.size); cProj.textContent = String(all.size); }

  // طيران حر
  const fl = { yaw: 0, pitch: 0, vel: new THREE.Vector3(), keys: new Set<string>(), stick: { x: 0, y: 0 } };
  function setMode(m: 'explore' | 'fly') {
    if (m === 'fly' && mode !== 'fly') { const d = new THREE.Vector3(); cam.getWorldDirection(d); fl.yaw = Math.atan2(-d.x, -d.z); fl.pitch = Math.asin(d.y); fl.vel.set(0, 0, 0); goal.pos = goal.tgt = null; }
    if (m === 'explore' && mode === 'fly') { const d = new THREE.Vector3(); cam.getWorldDirection(d); controls.target.copy(cam.position).addScaledVector(d, 60); }
    mode = m; controls.enabled = m === 'explore'; stopAuto(); root.dataset.mode = m;
    btnExplore.classList.toggle('on', m === 'explore'); btnFly.classList.toggle('on', m === 'fly');
    if (m === 'fly') { closePanel(); tip.classList.remove('on'); }
  }

  // لوحة المشروع مع مجسم ثلاثي الأبعاد
  const pv = $<HTMLElement>(panel, '.pv'), pvCanvas = $<HTMLCanvasElement>(panel, '.pv canvas');
  let pr: THREE.WebGLRenderer | null = null, prEnv: THREE.Texture | null = null, pst: Stage | null = null, pry = 0.6, pvT = 0;
  function showModel(id: string) {
    if (!pr) { try { pr = new THREE.WebGLRenderer({ canvas: pvCanvas, antialias: true, alpha: true }); configureRenderer(pr); prEnv = makeEnv(pr); } catch { return; } }
    pst?.dispose(); pv.classList.add('on');
    const w = pvCanvas.clientWidth || 340, h = pvCanvas.clientHeight || 220; pr.setSize(w, h, false);
    pst = createStage(id, prEnv!, w / h, 512);
  }
  function selectProject(id: string) {
    const p = PROJECTS.get(id); if (!p) return;
    $(panel, '.d').textContent = p.d; $(panel, '.pm').textContent = `${p.ln} · ${p.x ? 'فكرة حصرية' : p.cost + ' د.أ تقريباً'}`; $(panel, '.pt').textContent = p.t;
    const open = $<HTMLAnchorElement>(panel, 'a.open'); open.style.display = ''; open.href = (p as any).fromDb ? `/p?id=${encodeURIComponent(id)}` : `/projects/${id}`;
    panel.querySelectorAll('.list button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === id));
    showModel(id);
  }
  function closePanel() { panel.classList.remove('open'); }
  function openPanel(meta: string, title: string, ids: string[]) {
    $(panel, '.meta').textContent = meta; $(panel, 'h2').textContent = title;
    const ul = $(panel, '.list'); ul.textContent = '';
    ids.filter((x) => PROJECTS.has(x)).forEach((x) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.id = x; b.textContent = PROJECTS.get(x)!.t; b.addEventListener('click', () => selectProject(x)); ul.appendChild(b); });
    ul.style.display = ids.length > 1 ? '' : 'none'; panel.classList.add('open');
    if (ids.length) selectProject(ids[0]);
  }
  function openBuilding(id: string) {
    const b = placed.get(id)?.data; if (!b) return;
    openPanel(b.official ? 'مبنى الفريق' : b.id === mineId ? 'مبناك' : 'مبنى ' + (b.ownerName ?? 'مجتمعي') + (b.status === 'pending' ? ' · قيد المراجعة' : ''), b.sign, b.projects);
    void loadSocial(id, b.owner);
  }
  function focusBuilding(id: string) {
    const p = placed.get(id); if (!p) return; if (mode === 'fly') setMode('explore');
    const dist = 38 + p.h * 0.55, tgt = new THREE.Vector3(p.pos.x, p.h * 0.55, p.pos.z);
    flyTo(new THREE.Vector3(p.pos.x + p.front[0] * dist, p.h * 0.75 + 12, p.pos.z + p.front[1] * dist), tgt);
    openBuilding(id);
  }
  // ---- تفاعل المبنى: إعجاب، زيارات، تعليقات ----
  const soc = $(panel, '.social'), cbox = $(panel, '.cbox'), likeB = $<HTMLButtonElement>(panel, '.social .like');
  const visitsEl = $(panel, '.social .visits'), cBtn = $<HTMLButtonElement>(panel, '.social .cbtn');
  const cList = $(panel, '.clist'), cForm = $<HTMLFormElement>(panel, '.cform'), cErr = $(panel, '.cerr');
  let socId: string | null = null, socOwner: string | undefined;
  const esc2 = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const arN = (n: number) => n.toLocaleString('ar-EG');

  async function loadSocial(id: string, owner?: string) {
    socId = id; socOwner = owner; soc.hidden = false; cbox.hidden = true; cErr.textContent = '';
    const s = await getSocial();
    void s.visit(id);
    const st = (await s.stats([id]))[id] ?? { likes: 0, visits: 0, liked: false };
    paintLike(st.likes, st.liked);
    visitsEl.innerHTML = `${svg('eye', 14)} ${arN(st.visits)} زيارة`;
    const cs = await s.comments(id);
    cBtn.innerHTML = `${svg('chat', 14)} ${cs.length ? arN(cs.length) + ' تعليق' : 'علّق'}`;
  }
  const paintLike = (n: number, on: boolean) => { likeB.classList.toggle('on', on); likeB.setAttribute('aria-pressed', String(on)); likeB.innerHTML = `${svg('heart', 14)} ${n ? arN(n) : ''} ${on ? 'أعجبني' : 'إعجاب'}`; };

  likeB.addEventListener('click', async () => {
    if (!socId) return;
    const s = await getSocial();
    try { const on = await s.toggleLike(socId); const st = (await s.stats([socId]))[socId]; paintLike(st?.likes ?? (on ? 1 : 0), on); }
    catch (e: any) { toast(e.message === 'AUTH' ? 'سجّل دخولك من صفحة حسابك لتعمل إعجاب' : e.message); }
  });
  cBtn.addEventListener('click', () => { cbox.hidden = !cbox.hidden; if (!cbox.hidden) void paintComments(); });
  async function paintComments() {
    if (!socId) return;
    const cs = await (await getSocial()).comments(socId);
    cList.innerHTML = cs.length ? cs.map((c) => `<div class="cm"><b>${esc2(c.author)}</b>${c.mine ? `<button class="x" data-del="${c.id}" aria-label="حذف">×</button>` : ''}<div>${esc2(c.body)}</div></div>`).join('') : '<p class="cm">لا تعليقات بعد. كن أول واحد.</p>';
    cBtn.innerHTML = `${svg('chat', 14)} ${cs.length ? arN(cs.length) + ' تعليق' : 'علّق'}`;
  }
  cList.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-del]'); if (!b) return;
    await (await getSocial()).removeComment(b.dataset.del!); void paintComments();
  });
  cForm.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!socId) return;
    const inp = cForm.querySelector('input')!; cErr.textContent = '';
    try { await (await getSocial()).addComment(socId, inp.value); inp.value = ''; void paintComments(); }
    catch (x: any) { cErr.textContent = x.message === 'AUTH' ? 'سجّل دخولك من صفحة حسابك لتعلّق' : x.message; }
  });
  void socOwner;

  $(panel, '.close').addEventListener('click', () => { soc.hidden = true; cbox.hidden = true; socId = null; closePanel(); });

  // بحث عن مبنى
  const sIn = $<HTMLInputElement>(root, '#find'), sRes = $(root, '.sr');
  sIn.addEventListener('input', () => {
    const q = sIn.value.trim(); sRes.textContent = ''; if (!q) return;
    [...placed.values()].filter((p) => p.data.sign.includes(q) || p.data.name.includes(q) || (p.data.ownerName ?? '').includes(q)).slice(0, 6).forEach((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = p.data.sign + (p.data.ownerName && !p.data.official ? ' — ' + p.data.ownerName : ''); b.addEventListener('click', () => { sIn.value = ''; sRes.textContent = ''; focusBuilding(p.data.id); }); sRes.appendChild(b);
    });
  });

  // ---- مدخلات ----
  const typing = () => document.activeElement instanceof HTMLInputElement;
  const FLYKEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ'];
  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (e.code === 'Escape') { closePanel(); closeBuilder(); return; }
    if (FLYKEYS.includes(e.code)) { if (mode === 'explore' && !builder.classList.contains('open') && e.code !== 'ShiftLeft') setMode('fly'); fl.keys.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); }
  });
  addEventListener('keyup', (e) => fl.keys.delete(e.code)); addEventListener('blur', () => fl.keys.clear());
  let down: { x: number; y: number } | null = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointermove', (e) => {
    if (mode === 'fly' && down && e.buttons) { fl.yaw -= (e.clientX - lx) * 0.004; fl.pitch = Math.max(-1.45, Math.min(1.45, fl.pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; }
  });
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  const pick = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect(); mv.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam);
    const hit = ray.intersectObjects(pickables, true)[0]; if (!hit) return null;
    let o: THREE.Object3D | null = hit.object; while (o && !o.userData.pick) o = o.parent; return o?.userData.pick as { kind: 'b' | 'p'; id: string } | null;
  };
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 5 || mode !== 'explore') return;
    const h = pick(e.clientX, e.clientY); if (!h) return;
    if (h.kind === 'b') focusBuilding(h.id); else openPanel('طائرة بالسماء', PROJECTS.get(h.id)!.t, [h.id]);
  });
  let tipT = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'explore' || e.buttons || performance.now() - tipT < 70) return; tipT = performance.now();
    const h = pick(e.clientX, e.clientY);
    if (h) { const t = h.kind === 'b' ? placed.get(h.id)?.data : null; tip.textContent = t ? `${t.sign} · ${t.projects.length} مشاريع` : PROJECTS.get(h.id)?.t ?? ''; tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`; tip.classList.add('on'); canvas.style.cursor = 'pointer'; }
    else { tip.classList.remove('on'); canvas.style.cursor = ''; }
  });
  {
    const knob = $(stickEl, 'i'); let sid = -1, cx = 0, cy = 0;
    stickEl.addEventListener('pointerdown', (e) => { sid = e.pointerId; stickEl.setPointerCapture(sid); const r = stickEl.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; if (mode !== 'fly') setMode('fly'); e.stopPropagation(); });
    stickEl.addEventListener('pointermove', (e) => { if (e.pointerId !== sid) return; let dx = (e.clientX - cx) / 46, dy = (e.clientY - cy) / 46; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } fl.stick.x = dx; fl.stick.y = -dy; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; });
    const end = () => { sid = -1; fl.stick.x = fl.stick.y = 0; knob.style.transform = ''; }; stickEl.addEventListener('pointerup', end); stickEl.addEventListener('pointercancel', end);
  }

  // ---- واجهة البناء ----
  let store: Store; let dStyle: Style = 'tower', dColor = COLORS[0]; const chosen = new Set<string>();
  let preview: { group: THREE.Group; spin: THREE.Object3D[] } | null = null;
  const $name = $<HTMLInputElement>(builder, '#b-name'), $sign = $<HTMLInputElement>(builder, '#b-sign'), $search = $<HTMLInputElement>(builder, '#b-search');
  const $err = $(builder, '.err'), $count = $(builder, '#b-count'), $list = $(builder, '#b-list'), $auth = $(builder, '#b-auth'), $save = $<HTMLButtonElement>(builder, '#b-save');
  const nextFree = () => { const used = new Set([...placed.values()].map((p) => p.data.plot)); for (let i = 0; i < PLOTS.length; i++) if (!used.has(i)) return i; return -1; };
  function dropPreview() { if (preview) { scene.remove(preview.group); preview.spin.forEach((s) => spinners.splice(spinners.indexOf(s), 1)); preview = null; } const m = mineId ? placed.get(mineId) : null; if (m) m.group.visible = true; }
  function updatePreview(fly = true) {
    if (preview) { scene.remove(preview.group); preview.spin.forEach((s) => spinners.splice(spinners.indexOf(s), 1)); preview = null; }
    const mine = mineId ? placed.get(mineId) : null, plot = mine ? mine.data.plot : nextFree(); if (plot < 0) return; if (mine) mine.group.visible = false;
    const made = makeTower(dStyle, dColor, clean($sign.value || $name.value || 'مبناك', 28), Math.max(2, chosen.size), plot * 7 + 3, towerLook(Math.max(2, chosen.size)));
    const [px, pz] = PLOTS[plot], f = faceDir(px, pz), inner = new THREE.Group(); inner.add(made.group); inner.rotation.y = Math.atan2(f[0], f[1]);
    const holder = new THREE.Group(); holder.position.set(px, 0.2, pz); holder.add(inner); scene.add(holder); preview = { group: holder, spin: made.spinners }; spinners.push(...made.spinners);
    if (fly) flyTo(new THREE.Vector3(px + f[0] * 62 + 22, made.h * 0.7 + 14, pz + f[1] * 62 + 18), new THREE.Vector3(px, made.h * 0.45, pz));
  }
  function renderList() {
    const q = $search.value.trim(); $list.textContent = '';
    [...PROJECTS.values()].filter((p) => !q || p.t.includes(q)).forEach((p) => {
      const l = document.createElement('label'); l.className = 'pi'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = chosen.has(p.id);
      c.addEventListener('change', () => { if (c.checked && chosen.size >= MAX_PROJECTS) { c.checked = false; $err.textContent = `الحد الأقصى ${MAX_PROJECTS} مشاريع`; return; } c.checked ? chosen.add(p.id) : chosen.delete(p.id); $count.textContent = String(chosen.size); $err.textContent = ''; updatePreview(false); });
      const s = document.createElement('span'); s.textContent = p.t; l.append(c, s); $list.appendChild(l);
    });
  }
  const chipRow = (el: HTMLElement, items: { k: string; html: string }[], cur: () => string, set: (k: string) => void) => {
    el.textContent = ''; items.forEach((it) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'opt' + (cur() === it.k ? ' on' : ''); b.innerHTML = it.html; b.addEventListener('click', () => { set(it.k); chipRow(el, items, cur, set); updatePreview(false); }); el.appendChild(b); });
  };
  const paint = () => { chipRow($(builder, '#b-styles'), STYLES.map((s) => ({ k: s.key, html: `${svg(s.icon, 16)}${s.label}` })), () => dStyle, (k) => (dStyle = k as Style)); chipRow($(builder, '#b-colors'), COLORS.map((c) => ({ k: c, html: `<i style="background:${c}"></i>` })), () => dColor, (k) => (dColor = k)); };
  async function openBuilder() {
    closePanel(); if (mode === 'fly') setMode('explore'); builder.classList.add('open'); $err.textContent = '';
    const mine = await store.mine();
    if (mine) { $name.value = mine.name; $sign.value = mine.sign; dStyle = mine.style; dColor = mine.color; chosen.clear(); mine.projects.forEach((x) => chosen.add(x)); }
    $count.textContent = String(chosen.size); $save.textContent = mine ? 'حدّث مبناي' : 'ابنِ مبناي'; $auth.hidden = store.mode === 'local' || (await store.authed());
    paint(); renderList(); updatePreview(true);
  }
  function closeBuilder() { if (!builder.classList.contains('open')) return; builder.classList.remove('open'); dropPreview(); }
  $(builder, '.close').addEventListener('click', closeBuilder); btnBuild.addEventListener('click', openBuilder);
  let pt = 0; [$name, $sign].forEach((i) => i.addEventListener('input', () => { clearTimeout(pt); pt = window.setTimeout(() => updatePreview(false), 250); })); $search.addEventListener('input', renderList);
  $(builder, '#b-mail').addEventListener('click', async () => { const em = $<HTMLInputElement>(builder, '#b-email').value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { $err.textContent = 'اكتب بريداً صحيحاً'; return; } try { await store.signIn(em); $err.textContent = 'أرسلنا رابط الدخول لبريدك. افتحه ثم ارجع هنا.'; } catch (e: any) { $err.textContent = e.message; } });
  $save.addEventListener('click', async () => {
    $err.textContent = ''; $save.disabled = true;
    try {
      const b = await store.save({ name: $name.value, sign: $sign.value || $name.value, style: dStyle, color: dColor, projects: [...chosen] });
      dropPreview(); if (mineId) removeBuilding(mineId); addBuilding(b); mineId = b.id; builder.classList.remove('open');
      toast(b.status === 'pending' ? 'وصل مبناك! سيظهر للجميع بعد المراجعة، وأنت تشوفه الآن.' : 'مبناك صار بالمدينة'); focusBuilding(b.id);
    } catch (e: any) { if (e.message === 'AUTH') { $auth.hidden = false; $err.textContent = 'سجّل دخولك بالبريد أولاً لتبني مبناك.'; } else $err.textContent = e.message || 'تعذّر الحفظ'; }
    finally { $save.disabled = false; }
  });

  // ---- تحميل ----
  try { const rt = await loadRuntime(); rt.hidden.forEach((id) => PROJECTS.delete(id)); [...rt.changed, ...rt.added].forEach((d) => PROJECTS.set(d.id, toCard(d) as any)); } catch (e) { console.warn(e); }
  store = await createStore(); let loaded: Building[] = [];
  try { loaded = await store.list(); } catch (e) { console.error(e); const { OFFICIAL } = await import('./types'); loaded = OFFICIAL; toast('تعذّر جلب مباني الزوّار، نعرض مباني الفريق فقط.'); }
  loaded.forEach(addBuilding); try { const m = await store.mine(); if (m) mineId = m.id; } catch { /* بدون حساب */ }
  {
    // رابط مباشر لمبنى شخص: /city?b=معرّف-المبنى أو /city?u=معرّف-الطالب
    const qp = new URLSearchParams(location.search), tb = qp.get('b'), tu = qp.get('u');
    const target = tb ? placed.get(tb)?.data.id : tu ? [...placed.values()].find((p) => p.data.owner === tu)?.data.id : null;
    if (target) setTimeout(() => focusBuilding(target), 900);
  }
  btnExplore.addEventListener('click', () => { closeBuilder(); setMode('explore'); }); btnFly.addEventListener('click', () => { closeBuilder(); setMode('fly'); });

  const resize = () => { const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(root); resize();

  const t0 = performance.now(); let last = t0, slow = 0, frames = 0;
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const tick = () => {
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
    // جودة تكيّفية: لو الجهاز بطيء نوقف التوهج وننزّل الدقة
    if (bloomOn && ++frames > 60) { slow += dt > 0.045 ? 1 : -1; slow = Math.max(0, slow); if (slow > 70) { bloomOn = false; renderer.setPixelRatio(1); resize(); } }

    const ambX = vehicles.find((v) => v.amb)!.s, emergency = ambX > -40 && ambX < 8;
    const xGreen = emergency ? true : t % 12 < 6, zGreen = emergency ? false : !xGreen;
    for (const l of lights) { const g = l.ax === 'x' ? xGreen : zGreen; l.red.visible = !g; l.green.visible = g; }
    status.classList.toggle('alert', emergency);
    statusTxt.textContent = emergency ? 'إسعاف قادم — الإشارة فتحت الممر الأخضر تلقائياً' : 'المدينة تعمل بشكل طبيعي';
    for (const v of vehicles) {
      const green = v.ax === 'x' ? xGreen : zGreen, dist = v.dir * v.s; let go = true;
      if (!v.amb) { if (!green && dist < -5 && dist > -5 - v.v * 0.9) go = false; for (const o of vehicles) if (o !== v && !o.amb && o.ax === v.ax && o.dir === v.dir && o.lane === v.lane) { const gap = (o.s - v.s) * v.dir; if (gap > 0 && gap < 5.5) go = false; } }
      if (go) v.s += v.dir * v.v * dt; if (v.s > 165) v.s = v.amb ? -230 : -165; if (v.s < -165 && !v.amb) v.s = 165; v.g.visible = Math.abs(v.s) < 167;
      if (v.ax === 'x') { v.g.position.set(v.s, 0.35, v.lane); v.g.rotation.y = v.dir > 0 ? 0 : Math.PI; } else { v.g.position.set(v.lane, 0.35, v.s); v.g.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    const blink = Math.floor(t * 5) % 2 === 0; sirenA.visible = blink; sirenB.visible = !blink; ambLight.intensity = emergency ? (blink ? 90 : 20) : 0; ambLight.color.set(blink ? 0xff3b30 : 0x2d6bff);
    ambient.cars.forEach((c, i) => {
      c.s += c.dir * c.v * dt; if (c.s > 165) c.s = -165; if (c.s < -165) c.s = 165;
      if (c.ax === 'x') v3.set(c.s, 0.6, c.l + c.lane); else v3.set(c.l + c.lane, 0.6, c.s);
      q0.setFromEuler(new THREE.Euler(0, c.ax === 'x' ? 0 : Math.PI / 2, 0)); ambient.inst.setMatrixAt(i, m4.compose(v3, q0, one));
    }); ambient.inst.instanceMatrix.needsUpdate = true;
    drones.forEach((d, i) => { d.a += d.sp * dt; d.g.position.set(Math.cos(d.a) * d.r, d.h + Math.sin(t * 1.3 + i) * 0.8, Math.sin(d.a) * d.r); d.g.rotation.y = -d.a + (d.sp > 0 ? Math.PI : 0); d.rotors.forEach((r) => (r.rotation.y += 1.2)); });
    spinners.forEach((s) => (s.rotation.z += 1.4 * dt));
    const bl = Math.sin(t * 3) > 0; placed.forEach((p) => p.blinkers.forEach((b) => (b.visible = bl)));

    if (mode === 'fly') {
      const k = fl.keys, boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + fl.stick.y, s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + fl.stick.x, u = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') ? 1 : 0);
      cam.rotation.order = 'YXZ'; cam.rotation.set(fl.pitch, fl.yaw, 0);
      fwd.set(-Math.sin(fl.yaw) * Math.cos(fl.pitch), Math.sin(fl.pitch), -Math.cos(fl.yaw) * Math.cos(fl.pitch)); right.set(Math.cos(fl.yaw), 0, -Math.sin(fl.yaw));
      v3.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s).addScaledVector(new THREE.Vector3(0, 1, 0), u).multiplyScalar(34 * boost);
      fl.vel.lerp(v3, 1 - Math.pow(0.002, dt)); cam.position.addScaledVector(fl.vel, dt);
      cam.position.y = Math.max(3, Math.min(180, cam.position.y)); const r = Math.hypot(cam.position.x, cam.position.z); if (r > 175) { cam.position.x *= 175 / r; cam.position.z *= 175 / r; }
    } else {
      if (goal.pos && goal.tgt) { cam.position.lerp(goal.pos, 0.045); controls.target.lerp(goal.tgt, 0.06); if (cam.position.distanceTo(goal.pos) < 0.6) goal.pos = goal.tgt = null; }
      controls.update();
    }

    if (pst && pr && panel.classList.contains('open')) { pry += 0.008; pvT += dt; pst.update(pvT, pry, 0.42); pr.render(pst.scene, pst.cam); }
    if (bloomOn) composer.render(); else renderer.render(scene, cam);
  };
  root.classList.add('ready'); tick();
}
