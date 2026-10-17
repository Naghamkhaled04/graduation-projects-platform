import * as THREE from 'three';
import { buildScene } from './scenes';
import { buildFromSpec, modelFor } from '../model/spec';

/** بيئة انعكاس مصنوعة من ألواح مضيئة — تعطي المعدن والبلاستيك مظهراً واقعياً */
export function makeEnv(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  const mat = (c: number, i: number, side: THREE.Side = THREE.BackSide) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side });
  env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), mat(0x8a8378, 1)));
  // سقف متدرّج: فاتح فوق وداكن تحت — بيعطي تدرّجاً بالانعكاس بدل لون مسطّح
  const grad = document.createElement('canvas');
  grad.width = 4; grad.height = 64;
  const gc = grad.getContext('2d')!;
  const lg = gc.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, '#fff6e6'); lg.addColorStop(0.55, '#b9b2a4'); lg.addColorStop(1, '#5d5950');
  gc.fillStyle = lg; gc.fillRect(0, 0, 4, 64);
  const sky = new THREE.CanvasTexture(grad);
  sky.colorSpace = THREE.SRGBColorSpace;
  env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 16, 24), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
  const panel = (w: number, h: number, x: number, y: number, z: number, c: number, i: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c, i, THREE.DoubleSide));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(24, 12, 0, 22, 6, 0xffffff, 3.2);
  panel(10, 20, -24, 4, 4, 0xffe9d0, 1.6);
  panel(10, 20, 24, 2, -2, 0xd8f2f0, 1.2);
  panel(20, 6, 0, -16, 10, 0xe8743b, 1.2);
  panel(14, 14, -14, 14, -18, 0xfff2dd, 2.0);   // لوح علوي خلفي: بيرسم خط ضوء على الحواف
  panel(8, 16, 16, 10, 16, 0xcfe4ff, 1.5);      // لوح بارد أمامي: بيفصل المعدن عن الخلفية
  panel(26, 4, 0, 1, -26, 0xffffff, 0.9);       // شريط أفقي: انعكاس طولي على الأسطح الملساء
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}


/** قرص متدرّج شفاف — يُستعمل للتوهّج حول الليدات ولظل التلامس تحت المجسم */
function radialTexture(stops: [number, string][], size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let glowTex: THREE.Texture | null = null;
let shadowTex: THREE.Texture | null = null;
const getGlow = () => (glowTex ??= radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]));
const getShadow = () => (shadowTex ??= radialTexture([[0, 'rgba(0,0,0,.42)'], [0.45, 'rgba(0,0,0,.2)'], [1, 'rgba(0,0,0,0)']], 256));

export function configureRenderer(r: THREE.WebGLRenderer) {
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.12;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
}

export interface Stage {
  scene: THREE.Scene;
  cam: THREE.PerspectiveCamera;
  built: { group: THREE.Group; led: THREE.Mesh | null; extra: any };
  dist: number;
  focus: number;
  fit(aspect: number): void;
  setExplode(on: boolean): void;
  update(t: number, rotY: number, rotX: number, dist?: number): void;
  dispose(): void;
}

/** مشهد كامل لمشروع: المجسم + قاعدة + إضاءة + تأطير تلقائي للكاميرا */
export function createStage(id: string, env: THREE.Texture, aspect: number, shadowSize = 1024, instant = false): Stage {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 1.15;   // رفع مساهمة البيئة: المعدن والبلاستيك بيطلعوا أحيا
  const spec = modelFor(id);
  const built = spec ? buildFromSpec(spec) : buildScene(id);
  scene.add(built.group);

  const box = new THREE.Box3().setFromObject(built.group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z, size.y * 1.15);
  const R = span * 0.95;

  // قاعدة دائرية بلون الهوية تستقبل الظل
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.95 + 1.5, R * 0.95 + 1.7, 0.4, 72),
    new THREE.MeshStandardMaterial({ color: 0xe9dfcd, roughness: 0.92, metalness: 0 }),
  );
  plinth.position.set(center.x, -0.2 - 0.02, center.z);
  plinth.receiveShadow = true;
  scene.add(plinth);

  // ظل تلامس: الظل الاتجاهي لحاله بيخلي المجسم يبيّن طايراً، وهاد بيثبّته على القاعدة
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.1, R * 2.1),
    new THREE.MeshBasicMaterial({ map: getShadow(), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(center.x, 0.02, center.z);
  contact.renderOrder = -1;
  scene.add(contact);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbfa6, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(span * 0.7, span * 1.4, span * 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: span * 5 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0xe8743b, 1.4);
  rim.position.set(-span, span * 0.5, -span * 0.8);
  scene.add(rim);
  // ملء بارد من الجهة المقابلة: بيفتح الظلال فما تنطمس التفاصيل بالجهة المعتمة
  const fill = new THREE.DirectionalLight(0xcfe4ff, 0.75);
  fill.position.set(-span * 0.6, span * 0.35, span * 1.1);
  scene.add(fill);

  // ---- حركة: تجميع متتابع، تفكيك، نبضات على الأسلاك، حلقة مسح ----
  const easeOutBack = (x: number) => { const c1 = 1.55, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const parts = built.group.children.filter((c: any) => c.isMesh || c.isGroup).filter((c: any) => !c.userData.sp && !c.userData.a && !c.userData.h);
  const minY = Math.min(...parts.map((c) => c.position.y)), maxY = Math.max(...parts.map((c) => c.position.y));
  const anim = parts.map((c, i) => ({
    o: c, base: c.position.clone(), sc: c.scale.clone(),
    delay: 1.0 * ((c.position.y - minY) / Math.max(1, maxY - minY)) * 0.8 + ((i * 37) % 10) * 0.012,
    dir: c.position.clone().sub(center).setY(0).normalize(),
  }));
  const pulses: { m: THREE.Mesh; path: THREE.Curve<THREE.Vector3>; t: number; sp: number }[] = [];
  built.group.traverse((o: any) => {
    const path = o.geometry?.type === 'TubeGeometry' ? o.geometry.parameters.path : null;
    if (!path) return;
    const r = (o.geometry.parameters.radius ?? 0.08) * 2.4;
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false }));
      m.visible = false; o.parent.add(m); pulses.push({ m, path, t: k * 0.5, sp: 0.28 + (k ? 0.06 : 0) });
    }
  });
  // توهّج القطع المضيئة: لوح مواجه للكاميرا بإضافة لونية. أرخص بكتير من bloom وبيعطي نفس الإحساس
  const glows: THREE.Sprite[] = [];
  built.group.traverse((o: any) => {
    const em = o.isMesh && o.material?.emissive;
    if (!em || o.material.emissiveIntensity === 0) return;
    if (em.r + em.g + em.b < 0.15) return;
    o.geometry.computeBoundingSphere?.();
    const rad = (o.geometry.boundingSphere?.radius ?? 0.2) * Math.max(o.scale.x, o.scale.y, o.scale.z);
    if (rad > 1.6) return;                                   // الأجسام الكبيرة مش ليدات
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlow(), color: o.material.emissive.clone(),
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false,
    }));
    sp.scale.setScalar(rad * 7);
    o.add(sp);
    glows.push(sp);
  });

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xe8743b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, 0.06, center.z); scene.add(ring);
  let age = instant ? 99 : 0, lastT = -1, ex = 0, exT = 0, spun = 0;

  const cam = new THREE.PerspectiveCamera(36, aspect, 0.1, 400);
  const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const fitDist = (a: number) =>
    Math.max((size.y * 1.35) / 2 / half, (Math.max(size.x, size.z) * 1.25) / 2 / (half * a)) + Math.max(size.x, size.z) * 0.35;
  let dist = fitDist(aspect);
  const focus = Math.max(0.6, center.y * 0.8);
  const cx = center.x, cz = center.z;

  const update = (t: number, rotY: number, rotX: number, d = api.dist) => {
    const dt = lastT < 0 ? 0 : Math.min(0.06, Math.max(0, t - lastT)); lastT = t; age += dt;
    ex += (exT - ex) * Math.min(1, dt * 6);
    // تجميع القطع من فوق بتتابع من الأسفل للأعلى
    for (const a of anim) {
      const p = clamp01((age - a.delay) / 0.75), e = easeOutBack(p), rise = (1 - clamp01(p)) * (size.y * 0.7 + 8);
      const eo = ex * ex * (3 - 2 * ex);
      a.o.visible = p > 0;
      a.o.position.set(a.base.x + a.dir.x * eo * span * 0.38, a.base.y + rise + eo * (size.y * 0.16 + a.base.y * 0.32), a.base.z + a.dir.z * eo * span * 0.38);
      a.o.scale.copy(a.sc).multiplyScalar(0.2 + 0.8 * Math.max(0, e));
    }
    built.group.position.y = Math.sin(t * 1.4) * 0.12 * clamp01(age - 1.2);
    // نبضات البيانات على الأسلاك
    const live = age > 1.5 && ex < 0.2;
    for (const pu of pulses) { pu.m.visible = live; if (!live) continue; pu.t = (pu.t + pu.sp * dt) % 1; pu.m.position.copy(pu.path.getPoint(pu.t)); pu.m.scale.setScalar(0.8 + Math.sin(t * 9 + pu.t * 12) * 0.25); }
    // حلقة مسح تتمدد كل ٣ ثوانٍ
    const ph = (age % 3) / 3, rr = (0.15 + ph * 0.95) * (R + 1.5);
    ring.scale.set(rr, rr, 1); (ring.material as THREE.MeshBasicMaterial).opacity = age > 1.2 ? (1 - ph) * 0.55 : 0;
    // كاميرا: تقرب وتدور بنعومة عند البداية
    const intro = 1 - clamp01(age / 1.6), ie = intro * intro * (3 - 2 * intro);
    rotY += ie * 1.4; d *= 1 + ie * 0.55 + ex * 0.3;
    cam.position.set(
      cx + Math.sin(rotY) * Math.cos(rotX) * d,
      Math.sin(rotX) * d + focus,
      cz + Math.cos(rotY) * Math.cos(rotX) * d,
    );
    cam.lookAt(cx, focus, cz);
    const { led, extra } = built;
    if (led) (led.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 3.4) * 0.6;
    const gp = (0.34 + Math.sin(t * 3.4) * 0.16) * clamp01(age - 1.1) * (1 - ex * 0.7);
    for (const sp of glows) sp.material.opacity = gp;
    contact.scale.setScalar(1 + ex * 0.35);
    (contact.material as THREE.MeshBasicMaterial).opacity = 0.85 * clamp01(age - 0.6) * (1 - ex * 0.5);
    if (extra.gas)
      extra.gas.forEach((s: THREE.Mesh) => {
        s.position.y += s.userData.sp;
        (s.material as THREE.Material).opacity = 0.4 * (1 - (s.position.y - s.userData.base) / 5);
        if (s.position.y > s.userData.base + 5) { s.position.y = s.userData.base; (s.material as THREE.Material).opacity = 0.4; }
      });
    if (extra.bees)
      extra.bees.forEach((b: THREE.Object3D) => {
        b.userData.a += b.userData.sp;
        b.position.set(Math.cos(b.userData.a) * b.userData.r, b.userData.h + Math.sin(t * 2 + b.userData.a) * 0.5, Math.sin(b.userData.a) * b.userData.r);
        b.rotation.y = -b.userData.a;
      });
  };

  const dispose = () => {
    scene.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x: THREE.Material) => x.dispose());
    });
  };

  const api: Stage = {
    scene, cam, built, dist, focus, update, dispose,
    fit(a: number) { cam.aspect = a; cam.updateProjectionMatrix(); api.dist = fitDist(a); },
    setExplode(on: boolean) { exT = on ? 1 : 0; },
  };
  return api;
}
