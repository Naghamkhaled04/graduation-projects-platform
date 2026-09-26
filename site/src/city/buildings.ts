import * as THREE from 'three';
import { windowMaterial } from './materials';
import type { Style } from './types';

const std = (c: number | string, r = 0.7, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glowMat = (c: number | string, k = 2.2) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }); return m; };
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y + h / 2, z); return o;
};

export interface Made {
  group: THREE.Group; body: THREE.Mesh; w: number; d: number; h: number;
  spinners: THREE.Object3D[]; blinkers: THREE.Mesh[];
}

/** لافتة نيون عربية */
export function makeSign(text: string, color: string) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#071417'; g.beginPath(); g.roundRect(10, 10, 1004, 236, 44); g.fill();
  g.shadowColor = color; g.shadowBlur = 26; g.strokeStyle = color; g.lineWidth = 12;
  g.beginPath(); g.roundRect(10, 10, 1004, 236, 44); g.stroke();
  g.shadowBlur = 18; g.shadowColor = '#ffb060'; g.fillStyle = '#fff6e6';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  let size = 130;
  do { g.font = `700 ${size}px "IBM Plex Sans Arabic", Arial`; size -= 6; } while (g.measureText(text).width > 880 && size > 40);
  g.fillText(text, 512, 134);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
}

/** ناطحة لكل شخص: كل مشروع = طابق. واجهتها نحو +z ومركزها (0,0,0) */
/** شكل المبنى من نشاط صاحبه: عدد المشاريع والمنفَّذ منها يكبّرانه، والنقاط ترفع إضاءته */
export function towerLook(projects: number, executed = 0, points = 0) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const tier = clamp(((projects - 1) / 5) * 0.6 + (Math.min(executed, 5) / 5) * 0.4);
  return { floors: projects + Math.min(executed, 4), scale: 1 + 0.45 * tier, glow: clamp(points / 300) * 0.5 };
}

export function makeTower(style: Style, color: string, sign: string, floors: number, seed = 1, look: { scale?: number; glow?: number } = {}): Made {
  const glow = look.glow ?? 0.3, scale = look.scale ?? 1;
  const g = new THREE.Group(); const spinners: THREE.Object3D[] = []; const blinkers: THREE.Mesh[] = [];
  const accent = new THREE.Color(color);
  const dims: Record<Style, [number, number]> = { hospital: [10, 8], home: [8, 7], shop: [10, 7], lab: [8, 8], tower: [7, 7], farm: [9, 7] };
  const [w, d] = dims[style];
  const h = 13 + Math.max(2, Math.min(8, floors)) * 3.6;

  g.add(box(w + 2.4, 1.6, d + 2.4, std(0x0c1d20, 0.9, 0.1)));                       // القاعدة
  const body = box(w, h, d, windowMaterial({ tint: accent, seed, glow: 1.35 + glow * 0.7, lit: 0.36 - glow * 0.06 }), 0, 1.6);
  g.add(body);
  for (const s of [-1, 1]) g.add(box(0.35, h, 0.35, glowMat(color, 1.4 + glow * 0.7), s * (w / 2), 1.6, d / 2));  // خطوط نيون عمودية
  g.add(box(w + 0.6, 0.4, d + 0.6, glowMat(color, 1.5 + glow * 0.8), 0, 1.6 + h));               // إطار السطح
  const top = 1.6 + h + 0.4;

  if (style === 'hospital') {
    g.add(box(4, 1, 1, glowMat('#ff5a3c', 2.4), 0, top + 1.5, 0), box(1, 4, 1, glowMat('#ff5a3c', 2.4), 0, top, 0));
  } else if (style === 'home') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 4, 4), std(color, 0.6, 0.1)); roof.rotation.y = Math.PI / 4; roof.position.y = top + 2; g.add(roof);
  } else if (style === 'shop') {
    for (let i = 0; i < 6; i++) g.add(box(w / 6 - 0.15, 0.4, 2.4, glowMat(i % 2 ? '#fff0d8' : color, 1.6), -w / 2 + w / 12 + i * (w / 6), 4.6, d / 2 + 1.1));
    g.add(box(w - 2, 2.6, d - 2, std(0x102629, 0.8), 0, top));
  } else if (style === 'lab') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fe8ee, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.3 })); dome.position.y = top; g.add(dome);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), glowMat(color, 2.6)); core.position.y = top + 1.4; g.add(core);
  } else if (style === 'tower') {
    g.add(box(0.25, 9, 0.25, std(0xdddddd, 0.4, 0.6), 0, top));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), glowMat('#ff2d2d', 3)); b.position.y = top + 9.2; g.add(b); blinkers.push(b);
  } else {
    g.add(box(w - 1, 0.6, d - 1, std(0x3d6b45, 0.9), 0, top));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 8, 8), std(0xf1f1f1, 0.5)); pole.position.set(w / 2 - 1, top + 4, -d / 4); g.add(pole);
    const rotor = new THREE.Group(); rotor.position.set(w / 2 - 1, top + 8, -d / 4 + 0.35);
    for (let i = 0; i < 3; i++) { const bl = box(0.22, 4, 0.05, std(0xffffff, 0.4)); bl.geometry.translate(0, 2, 0); bl.position.set(0, 0, 0); bl.rotation.z = (i * Math.PI * 2) / 3; rotor.add(bl); }
    g.add(rotor); spinners.push(rotor);
  }

  // لافتات على الوجهين + شعاع ضوئي يُرى من بعيد
  const sy = Math.max(9, h * 0.55);
  const s1 = makeSign(sign, color); s1.position.set(0, sy, d / 2 + 0.3); g.add(s1);
  const s2 = makeSign(sign, color); s2.position.set(0, sy, -d / 2 - 0.3); s2.rotation.y = Math.PI; g.add(s2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 70 + glow * 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.1 + glow * 0.14, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  beam.position.y = top + (70 + glow * 40) / 2; g.add(beam);
  if (glow > 0.3) {   // هالة على الأرض للمباني القوية
    const halo = new THREE.Mesh(new THREE.CircleGeometry(w * (1.0 + glow * 0.9), 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.06 + glow * 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.08; g.add(halo);
  }
  g.scale.setScalar(scale);
  return { group: g, body, w: w * scale, d: d * scale, h: (top + 6) * scale, spinners, blinkers };
}
