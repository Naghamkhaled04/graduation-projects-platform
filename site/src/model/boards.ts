import * as THREE from 'three';

/** لوحات التحكم الشائعة كمجسمات ثلاثية الأبعاد، مبنية بالكود بلا ملفات خارجية */
export type BoardId = 'uno' | 'esp32' | 'esp8266' | 'pico' | 'rpi';

const mat = (c: THREE.ColorRepresentation, r = 0.55, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const sh = (o: THREE.Mesh) => { o.castShadow = o.receiveShadow = true; return o; };
const box = (w: number, h: number, d: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, r = 0.55, m = 0.1) => {
  const o = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, r, m)));
  o.position.set(x, y + h / 2, z); return o;
};
const cyl = (rad: number, h: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, r = 0.45, m = 0.6) => {
  const o = sh(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 20), mat(c, r, m)));
  o.position.set(x, y + h / 2, z); return o;
};

const GOLD = () => mat(0xd6b25e, 0.3, 0.88);
const SILVER = () => mat(0xc9ced6, 0.32, 0.85);
const BLACK = () => mat(0x15181d, 0.5, 0.2);

/** صف دبابيس ذهبية على حافة اللوحة */
function pins(g: THREE.Group, n: number, x0: number, z: number, step: number, y: number, tall = 0.5) {
  const geo = new THREE.CylinderGeometry(0.048, 0.048, tall, 6), m = GOLD();
  const im = new THREE.InstancedMesh(geo, m, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(x0 + i * step, y + tall / 2, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  im.castShadow = true; g.add(im);
}

/** مربعات صغيرة (مقاومات/مكثفات SMD) موزّعة بشكل ثابت */
function smd(g: THREE.Group, seed: number, count: number, w: number, d: number, y: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < count; i++) {
    const c = rnd() > 0.5 ? 0x2b2f36 : 0xa9793f;
    const b = box(0.12 + rnd() * 0.1, 0.05, 0.07, c, (rnd() - 0.5) * w, y, (rnd() - 0.5) * d, 0.6, 0.15);
    g.add(b);
  }
}

function pcb(w: number, d: number, color: THREE.ColorRepresentation, holes = true) {
  const shape = new THREE.Shape();
  const r = 0.28, hw = w / 2, hd = d / 2;
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd); shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r); shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd); shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r); shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  if (holes) {
    for (const [hx, hz] of [[-hw + 0.5, -hd + 0.5], [hw - 0.5, -hd + 0.5], [-hw + 0.5, hd - 0.5], [hw - 0.5, hd - 0.5]]) {
      const h = new THREE.Path();
      h.absarc(hx, hz, 0.16, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = sh(new THREE.Mesh(geo, mat(color, 0.44, 0.08)));
  m.position.y = 0;
  return m;
}

export interface Board { group: THREE.Group; led: THREE.Mesh | null }

function uno(): Board {
  const g = new THREE.Group();
  g.add(pcb(6.8, 5.0, 0x0b7a86));
  // منفذ USB-B الفضي المميز
  g.add(box(1.2, 1.1, 1.6, 0xc9ced6, -2.6, 0.16, -1.4, 0.3, 0.85));
  // مقبس طاقة أسود
  g.add(box(1.0, 0.9, 1.3, 0x14171b, -2.7, 0.16, 1.5, 0.55, 0.15));
  // المتحكم ATmega بعلبة طويلة
  g.add(box(1.0, 0.32, 2.4, 0x1b1f25, 0.9, 0.16, 0.6, 0.5, 0.2));
  g.add(box(0.28, 0.34, 0.28, 0x2b3038, 1.2, 0.16, 1.4, 0.5, 0.2));
  // مذبذب معدني
  g.add(box(0.75, 0.3, 0.45, 0xc0c6cf, -0.6, 0.16, -0.6, 0.3, 0.8));
  // مثبت جهد + مكثفان
  g.add(box(0.5, 0.55, 0.45, 0x14171b, -1.6, 0.16, 1.6, 0.5, 0.2));
  g.add(cyl(0.3, 0.7, 0x2f3540, -2.0, 0.16, 0.6));
  g.add(cyl(0.3, 0.7, 0x2f3540, 2.4, 0.16, 1.5));
  // صفوف الدبابيس السوداء
  g.add(box(3.4, 0.28, 0.32, 0x14171b, 0.6, 0.16, -2.15, 0.6));
  g.add(box(2.1, 0.28, 0.32, 0x14171b, -1.6, 0.16, -2.15, 0.6));
  g.add(box(2.7, 0.28, 0.32, 0x14171b, 1.0, 0.16, 2.15, 0.6));
  g.add(box(2.2, 0.28, 0.32, 0x14171b, -1.5, 0.16, 2.15, 0.6));
  pins(g, 10, -1.0, -2.15, 0.36, 0.44);
  pins(g, 8, -2.4, -2.15, 0.36, 0.44);
  pins(g, 8, -0.2, 2.15, 0.36, 0.44);
  pins(g, 6, -2.4, 2.15, 0.36, 0.44);
  smd(g, 7, 22, 5.4, 3.6, 0.16);
  const led = sh(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3ad17a, emissive: 0x2bbf68, emissiveIntensity: 1.5 })));
  led.position.set(2.1, 0.32, -0.9); g.add(led);
  return { group: g, led };
}

function esp32(): Board {
  const g = new THREE.Group();
  g.add(pcb(5.6, 2.8, 0x14171b, false));
  // وحدة WROOM بغطاء معدني
  const can = box(2.4, 0.28, 1.7, 0xd3d8de, -0.5, 0.16, 0, 0.35, 0.9);
  g.add(can, box(2.2, 0.02, 1.5, 0xb9c0c8, -0.5, 0.44, 0, 0.4, 0.8));
  // هوائي مطبوع بالحافة
  for (let i = 0; i < 7; i++) g.add(box(0.1, 0.03, 0.6, 0xd8b35a, -2.55 + (i % 2) * 0.18, 0.16, -0.7 + i * 0.22, 0.4, 0.6));
  // منفذ USB-C
  g.add(box(0.85, 0.32, 0.55, 0xc9ced6, 2.5, 0.16, 0, 0.3, 0.85));
  // زرّان
  g.add(box(0.36, 0.22, 0.36, 0x2f3540, 1.5, 0.16, -1.0, 0.5, 0.2));
  g.add(box(0.36, 0.22, 0.36, 0x2f3540, 1.5, 0.16, 1.0, 0.5, 0.2));
  g.add(box(0.7, 0.24, 0.5, 0x1f242b, 0.9, 0.16, 0, 0.5, 0.2));
  smd(g, 3, 14, 3.4, 1.8, 0.16);
  g.add(box(5.2, 0.24, 0.3, 0x14171b, 0, 0.16, 1.25, 0.6));
  g.add(box(5.2, 0.24, 0.3, 0x14171b, 0, 0.16, -1.25, 0.6));
  pins(g, 15, -2.3, 1.25, 0.33, 0.4);
  pins(g, 15, -2.3, -1.25, 0.33, 0.4);
  const led = sh(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshStandardMaterial({ color: 0x5ab9ff, emissive: 0x2d8fe0, emissiveIntensity: 1.6 })));
  led.position.set(2.0, 0.3, 0.7); g.add(led);
  return { group: g, led };
}

function esp8266(): Board {
  const g = new THREE.Group();
  g.add(pcb(4.9, 2.6, 0x0f5e6b, false));
  g.add(box(2.0, 0.26, 1.5, 0xd3d8de, -0.4, 0.16, 0, 0.35, 0.9));
  for (let i = 0; i < 6; i++) g.add(box(0.1, 0.03, 0.55, 0xd8b35a, -2.2 + (i % 2) * 0.16, 0.16, -0.6 + i * 0.22, 0.4, 0.6));
  g.add(box(0.95, 0.42, 0.7, 0xc9ced6, 2.15, 0.16, 0, 0.3, 0.85));
  g.add(box(0.34, 0.2, 0.34, 0x2f3540, 1.3, 0.16, -0.9, 0.5, 0.2));
  g.add(box(0.34, 0.2, 0.34, 0x2f3540, 1.3, 0.16, 0.9, 0.5, 0.2));
  smd(g, 11, 12, 3.0, 1.6, 0.16);
  g.add(box(4.5, 0.24, 0.3, 0x14171b, 0, 0.16, 1.15, 0.6));
  g.add(box(4.5, 0.24, 0.3, 0x14171b, 0, 0.16, -1.15, 0.6));
  pins(g, 14, -2.0, 1.15, 0.31, 0.4);
  pins(g, 14, -2.0, -1.15, 0.31, 0.4);
  const led = sh(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0x5ab9ff, emissive: 0x2d8fe0, emissiveIntensity: 1.4 })));
  led.position.set(1.0, 0.3, 0.55); g.add(led);
  return { group: g, led };
}

function pico(): Board {
  const g = new THREE.Group();
  g.add(pcb(5.1, 2.1, 0x0d5a2f, false));
  // رقاقة RP2040 مربعة
  g.add(box(0.9, 0.22, 0.9, 0x1b1f25, 0, 0.16, 0, 0.45, 0.25));
  // ذاكرة فلاش
  g.add(box(0.55, 0.2, 0.5, 0x22272e, 0.95, 0.16, 0, 0.45, 0.25));
  // منفذ micro-USB
  g.add(box(0.75, 0.3, 0.5, 0xc9ced6, -2.25, 0.16, 0, 0.3, 0.85));
  // زر BOOTSEL
  g.add(box(0.34, 0.2, 0.34, 0xf0f2f4, -1.2, 0.16, 0, 0.5, 0.1));
  smd(g, 5, 10, 3.2, 1.2, 0.16);
  pins(g, 20, -2.25, 0.88, 0.235, 0.16, 0.34);
  pins(g, 20, -2.25, -0.88, 0.235, 0.16, 0.34);
  const led = sh(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3ad17a, emissive: 0x2bbf68, emissiveIntensity: 1.5 })));
  led.position.set(-1.75, 0.28, 0.4); g.add(led);
  return { group: g, led };
}

function rpi(): Board {
  const g = new THREE.Group();
  g.add(pcb(6.6, 4.4, 0x0d6b3f));
  // رقاقة المعالج + الذاكرة
  g.add(box(1.25, 0.26, 1.25, 0x23272e, -0.5, 0.16, -0.3, 0.4, 0.35));
  g.add(box(0.9, 0.2, 0.9, 0x1b1f25, 0.9, 0.16, -0.4, 0.45, 0.3));
  // منفذا USB مزدوجان (أزرق) + إيثرنت
  g.add(box(1.5, 1.0, 1.3, 0x2a2f38, 2.55, 0.16, -1.2, 0.4, 0.5));
  g.add(box(1.5, 1.0, 1.3, 0x2a2f38, 2.55, 0.16, 0.5, 0.4, 0.5));
  g.add(box(1.5, 1.05, 1.4, 0xc9ced6, 2.55, 0.16, 1.55, 0.3, 0.85));
  // منفذا HDMI صغيران + USB-C
  g.add(box(0.75, 0.35, 0.5, 0xc9ced6, -0.6, 0.16, 2.0, 0.3, 0.8));
  g.add(box(0.75, 0.35, 0.5, 0xc9ced6, 0.9, 0.16, 2.0, 0.3, 0.8));
  g.add(box(0.6, 0.3, 0.45, 0xc9ced6, -2.1, 0.16, 2.0, 0.3, 0.85));
  // مقبس الصوت
  g.add(cyl(0.3, 0.55, 0x14171b, 2.0, 0.16, 2.0));
  // رأس GPIO ٤٠ دبوساً
  g.add(box(5.2, 0.3, 0.42, 0x14171b, -0.2, 0.16, -1.85, 0.6));
  pins(g, 20, -2.6, -1.95, 0.26, 0.46);
  pins(g, 20, -2.6, -1.75, 0.26, 0.46);
  smd(g, 17, 20, 5.2, 3.0, 0.16);
  const led = sh(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xe03a3a, emissiveIntensity: 1.5 })));
  led.position.set(-2.8, 0.3, -1.0); g.add(led);
  return { group: g, led };
}

const MAKERS: Record<BoardId, () => Board> = { uno, esp32, esp8266, pico, rpi };
export const makeBoard = (id: BoardId): Board => (MAKERS[id] ?? uno)();
