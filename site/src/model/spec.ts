import * as THREE from 'three';

/** مجسم يُبنى من قائمة قطع على لوحة تجارب، بدون كود. يُخزَّن كـ JSON مع المشروع */
export type Kind = 'mcu' | 'arduino' | 'sensor' | 'display' | 'motor' | 'servo' | 'battery' | 'buzzer' | 'camera' | 'relay' | 'led' | 'power' | 'pump' | 'solar' | 'rfid' | 'valve' | 'fan' | 'other' | 'none';
export interface Item { kind: Kind; label?: string; x: number; z: number; rot: number; color?: string }
export interface ModelSpec { items: Item[]; wires: [number, number][] }
export interface Built { group: THREE.Group; led: THREE.Mesh | null; extra: Record<string, unknown> }

export const KINDS: { k: Kind; label: string }[] = [
  { k: 'mcu', label: 'لوحة تحكم (ESP32)' }, { k: 'arduino', label: 'Arduino' }, { k: 'sensor', label: 'حساس' },
  { k: 'display', label: 'شاشة' }, { k: 'motor', label: 'محرك' }, { k: 'servo', label: 'سيرفو' },
  { k: 'battery', label: 'بطارية' }, { k: 'buzzer', label: 'جرس' }, { k: 'camera', label: 'كاميرا' },
  { k: 'relay', label: 'مرحّل' }, { k: 'led', label: 'ليد' }, { k: 'power', label: 'مزود طاقة' }, { k: 'pump', label: 'مضخة' },
  { k: 'solar', label: 'لوح شمسي' }, { k: 'rfid', label: 'قارئ RFID' }, { k: 'valve', label: 'صمام' }, { k: 'fan', label: 'مروحة' },
  { k: 'other', label: 'قطعة أخرى' }, { k: 'none', label: 'بدون مجسم (أسلاك…)' },
];
export const DEFAULT_COLOR: Record<Kind, string> = {
  mcu: '#2F7D5C', arduino: '#0F8B95', sensor: '#2563EB', display: '#1B6E4B', motor: '#8A8F98', servo: '#3B82F6',
  battery: '#2A2F3B', buzzer: '#1F2937', camera: '#1F2937', relay: '#2563EB', led: '#22C55E', power: '#2A2F3B', pump: '#2563EB', solar: '#1E3A8A',
  rfid: '#F1F5F9', valve: '#C79235', fan: '#374151', other: '#9AA1AF', none: '#9AA1AF',
};

/** يخمّن نوع القطعة من اسمها (عربي أو إنجليزي) لتوليد المجسم تلقائياً */
export function guessKind(name: string): Kind {
  const n = name.toLowerCase();
  const has = (re: RegExp) => re.test(n);
  if (has(/أسلاك|اسلاك|سلك|jumper|wire|breadboard|لوحة تجارب|وصلات|مقاومة|resistor|مكثف|capacitor|حامل|قاعدة|علبة|case|مسمار|screw/)) return 'none';
  if (has(/esp32-?cam|camera|كاميرا|ov2640/)) return 'camera';
  if (has(/esp32|esp-32|esp8266|nodemcu|wemos|d1 mini|pico|لوحة تحكم|متحكم|microcontroller/)) return 'mcu';
  if (has(/arduino|أردوينو|اردوينو|\bnano\b|\buno\b|mega/)) return 'arduino';
  if (has(/lcd|oled|tft|شاشة|display|e-?paper|seven.?seg/)) return 'display';
  if (has(/servo|سيرفو|sg90|mg90/)) return 'servo';
  if (has(/pump|مضخة|طلمبة/)) return 'pump';
  if (has(/valve|صمام|solenoid|سولينويد/)) return 'valve';
  if (has(/fan|مروحة|blower|مبرد/)) return 'fan';
  if (has(/motor|محرك|stepper|dc gear|l298|l293|driver|درايفر/)) return 'motor';
  if (has(/buzzer|جرس|صافرة|سماعة|speaker/)) return 'buzzer';
  if (has(/relay|مرحّل|مرحل|ريلاي/)) return 'relay';
  if (has(/rfid|nfc|rc522|pn532|قارئ بطاقة/)) return 'rfid';
  if (has(/solar|شمسي|panel|لوح شمس/)) return 'solar';
  if (has(/battery|بطارية|lipo|li-ion|18650|powerbank|باور/)) return 'battery';
  if (has(/adapter|محوّل|محول|مزود|power supply|charger|شاحن|tp4056|buck|boost|regulator/)) return 'power';
  if (has(/\bled\b|ليد|diode|ديود|neopixel|ws2812/)) return 'led';
  if (has(/sensor|حساس|dht|ldr|pir|hc-?sr|mq-?\d|ds18b20|mpu|hx711|load ?cell|خلية وزن|ultrasonic|flame|gps|max30|ecg|ad8232|bmp|bme|soil|تربة|رطوبة|حرارة|مستشعر|ir |تدفق|flow/)) return 'sensor';
  return 'other';
}

const mat = (c: string | number, r = 0.55, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const shade = (mesh: THREE.Mesh) => { mesh.castShadow = mesh.receiveShadow = true; return mesh; };
const B = (w: number, h: number, d: number, c: string | number, x = 0, y = 0, z = 0, r = 0.55, m = 0.1) => { const o = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, r, m))); o.position.set(x, y + h / 2, z); return o; };
const C = (rt: number, rb: number, h: number, c: string | number, x = 0, y = 0, z = 0, r = 0.5, m = 0.3) => { const o = shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), mat(c, r, m))); o.position.set(x, y + h / 2, z); return o; };
const gold = () => mat(0xd4af37, 0.3, 0.85);
const pins = (g: THREE.Group, n: number, x0: number, z: number, step = 0.36) => { const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8), m = gold(); for (let i = 0; i < n; i++) { const p = new THREE.Mesh(geo, m); p.position.set(x0 + i * step, -0.1, z); g.add(p); } };

/** قطعة واحدة، مركزها (0,0,0) وقاعدتها y=0 */
function part(it: Item): { g: THREE.Group; led?: THREE.Mesh } {
  const g = new THREE.Group(), c = it.color || DEFAULT_COLOR[it.kind];
  let led: THREE.Mesh | undefined;
  switch (it.kind) {
    case 'mcu':
      g.add(B(5.6, 0.28, 2.6, c, 0, 0.35), B(1.5, 0.24, 1.5, 0xd8dce2, -0.3, 0.63, 0, 0.4, 0.4), B(1.35, 0.12, 0.8, 0xc5cad2, 2.2, 0.6, 0, 0.3, 0.78), B(0.55, 0.44, 1.1, 0xb8bdc6, -2.75, 0.5, 0, 0.35, 0.72));
      pins(g, 15, -2.5, 1.42); pins(g, 15, -2.5, -1.42);
      led = shade(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x1fa35a, emissiveIntensity: 1.3 }))); led.position.set(1.35, 0.85, 0.95); g.add(led); break;
    case 'arduino':
      g.add(B(6.6, 0.28, 4.9, c, 0, 0.35), B(1.7, 0.2, 1.7, 0x14171b, 0.8, 0.63), B(1.6, 1, 1.3, 0xb8bdc6, -2.8, 0.63, -1, 0.3, 0.8), B(1.4, 0.7, 0.9, 0x14171b, -2.9, 0.63, 1.5));
      pins(g, 10, -2.2, -2.3); pins(g, 8, -1.8, 2.3); break;
    case 'sensor':
      g.add(B(2.4, 0.26, 2.4, c, 0, 0.35), C(0.7, 0.7, 0.7, 0xd8dde5, 0, 0.61, 0, 0.35, 0.7), B(0.7, 0.3, 0.5, 0x2b2b2b, 0.75, 0.61, 0.85));
      pins(g, 4, -0.55, -1.15, 0.36); break;
    case 'display':
      g.add(B(3.6, 0.28, 1.6, c, 0, 0.35), B(3.1, 0.12, 1.1, 0x0c1c14, 0, 0.63, 0, 0.3, 0.05), B(2.4, 0.03, 0.14, 0x7fe3b0, 0, 0.75, -0.2, 0.4, 0), B(1.6, 0.03, 0.14, 0x7fe3b0, -0.4, 0.75, 0.15, 0.4, 0)); pins(g, 4, -0.55, 0.9); break;
    case 'motor': { const m = C(1, 1, 3, c, 0, 0.35, 0, 0.35, 0.7); m.rotation.z = Math.PI / 2; m.position.y = 1.35; g.add(m); const sh = C(0.15, 0.15, 1.2, 0xd8dde5, 2.1, 0.35, 0, 0.3, 0.9); sh.rotation.z = Math.PI / 2; sh.position.y = 1.35; g.add(sh, B(2.6, 0.35, 1.6, 0x39404d, 0, 0)); break; }
    case 'servo':
      g.add(B(2.2, 1.8, 1.1, c, 0, 0.1, 0, 0.5, 0.15), B(0.6, 0.12, 1.1, c, -1.4, 0.9), B(0.6, 0.12, 1.1, c, 1.4, 0.9), C(0.32, 0.32, 0.4, 0xf1f5f9, 0.45, 1.9, 0, 0.5, 0.1), B(1.7, 0.1, 0.32, 0xf1f5f9, 1.2, 2.3)); break;
    case 'battery': g.add(B(3, 2, 2.4, c, 0, 0, 0, 0.6), B(2.6, 0.2, 2, 0xe8743b, 0, 2.0, 0, 0.5, 0.2)); break;
    case 'buzzer': g.add(C(0.85, 0.85, 1, c, 0, 0.35, 0, 0.6, 0.15), C(0.15, 0.15, 0.1, 0x000000, 0, 1.36, 0)); break;
    case 'camera': g.add(B(2.4, 0.26, 2.4, 0x14532d, 0, 0.35), B(1.5, 1.5, 1.5, c, 0, 0.61), C(0.5, 0.55, 0.6, 0x0b1220, 0, 2.1, 0, 0.2, 0.5)); pins(g, 4, -0.55, 1.2); break;
    case 'relay': g.add(B(2.8, 0.26, 2.2, 0x1e3a8a, 0, 0.35), B(1.5, 1.2, 1.2, c, -0.3, 0.61, 0), B(0.6, 0.7, 0.6, 0x16a34a, 0.9, 0.61, 0.6)); pins(g, 3, -0.4, -1); break;
    case 'led': { const l = shade(new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 14), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 }))); l.position.y = 0.95; g.add(l, C(0.32, 0.32, 0.6, c, 0, 0.35, 0, 0.3, 0)); led = l; break; }
    case 'power': g.add(B(2.4, 1.3, 1.8, c, 0, 0.35, 0, 0.6), B(0.5, 0.5, 0.5, 0xb8bdc6, 1.4, 0.55, 0, 0.3, 0.8)); break;
    case 'pump': { g.add(C(1.1, 1.1, 1.6, c, 0, 0.35, 0, 0.4, 0.3), B(2.2, 0.3, 1.6, 0x39404d, 0, 0)); const o = C(0.25, 0.25, 1.6, 0xd8dde5, 1.5, 0.9, 0, 0.3, 0.8); o.rotation.z = Math.PI / 2; g.add(o); break; }
    case 'solar': { const p = B(5, 0.18, 3.4, c, 0, 1.2, 0, 0.25, 0.5); p.rotation.x = -0.35; g.add(p, C(0.15, 0.15, 1.4, 0x9aa1af, 0, 0.35, -0.8, 0.4, 0.7)); for (let i = 1; i < 5; i++) { const l = B(0.04, 0.05, 3.3, 0xbfd0ff, -2.5 + i, 1.32, 0, 0.3, 0.6); l.rotation.x = -0.35; g.add(l); } break; }
    case 'rfid': g.add(B(3.2, 0.26, 2.2, c, 0, 0.35, 0, 0.5, 0.1), B(1.6, 0.08, 1.6, 0xd4af37, 0, 0.61, 0, 0.3, 0.8), B(0.6, 0.5, 0.5, 0x2b2b2b, 1.1, 0.61, 0.6)); pins(g, 6, -0.9, 1.05); break;
    case 'valve': { g.add(C(0.7, 0.7, 1.6, c, 0, 0.35, 0, 0.35, 0.8), B(1.5, 1.1, 1.2, 0x111827, 0, 1.9, 0, 0.5, 0.2)); const pp = C(0.28, 0.28, 3.2, 0xd8dde5, 0, 0.35, 0, 0.3, 0.8); pp.rotation.z = Math.PI / 2; pp.position.y = 0.9; g.add(pp); break; }
    case 'fan': { g.add(B(2.6, 0.5, 2.6, c, 0, 0.35, 0, 0.6, 0.2), C(0.45, 0.45, 0.6, 0x111827, 0, 0.85, 0, 0.4, 0.3)); for (let i = 0; i < 3; i++) { const b = B(1, 0.06, 0.4, 0xe5e7eb, 0.6, 1.4, 0, 0.5, 0.1); const gg = new THREE.Group(); gg.add(b); gg.rotation.y = (i * Math.PI * 2) / 3; g.add(gg); } break; }
    case 'none': break;
    default: g.add(B(2.2, 1.2, 1.8, c, 0, 0.35, 0, 0.6, 0.15));
  }
  return { g, led };
}

/** توزيع تلقائي: اللوحة بالوسط والقطع حولها بصفين، وسلك من كل قطعة للوحة */
export function autoLayout(kinds: Kind[]): ModelSpec {
  kinds = kinds.filter((k) => k !== 'none');
  const items: Item[] = []; const wires: [number, number][] = [];
  const ctl = kinds.findIndex((k) => k === 'mcu' || k === 'arduino');
  const order = kinds.map((k, i) => ({ k, i })).sort((a, b) => (a.i === ctl ? -1 : b.i === ctl ? 1 : a.i - b.i));
  let row = 0, col = 0;
  order.forEach(({ k, i }) => {
    if (i === ctl) { items[i] = { kind: k, x: 0, z: 0, rot: 0 }; return; }
    const side = row % 2 ? 1 : -1, level = Math.floor(row / 2);
    items[i] = { kind: k, x: -6 + col * 4.6, z: side * (5.2 + level * 4), rot: side > 0 ? 180 : 0 };
    row++; if (row % 2 === 0) col++;
    if (col > 3) col = 0;
  });
  if (ctl >= 0) items.forEach((_, i) => { if (i !== ctl) wires.push([ctl, i]); });
  return { items, wires };
}

const WIRE_COLORS = [0xdc2626, 0x1f2937, 0x7c63f7, 0xf59e0b, 0x10b981, 0x3b82f6];

export function buildFromSpec(spec: ModelSpec): Built {
  const g = new THREE.Group();
  let led: THREE.Mesh | null = null;
  const xs = spec.items.map((i) => i.x), zs = spec.items.map((i) => i.z);
  const w = Math.max(12, (Math.max(0, ...xs.map(Math.abs)) + 5) * 2), d = Math.max(9, (Math.max(0, ...zs.map(Math.abs)) + 4) * 2);
  g.add(B(w, 0.45, d, 0xf2f3f5, 0, 0, 0, 0.85, 0));
  for (let i = -3; i <= 3; i++) g.add(B(w - 0.6, 0.05, 0.15, 0xd9dce2, 0, 0.45, i * (d / 8), 0.9, 0));
  const nodes: THREE.Vector3[] = [];
  spec.items.forEach((it) => {
    if (it.kind === 'none') { nodes.push(new THREE.Vector3(it.x, 1.2, it.z)); return; }
    const { g: p, led: l } = part(it);
    p.position.set(it.x, 0.45, it.z); p.rotation.y = (it.rot * Math.PI) / 180;
    g.add(p); if (l && !led) led = l;
    nodes.push(new THREE.Vector3(it.x, 1.2, it.z));
  });
  spec.wires.forEach(([a, b], i) => {
    if (!nodes[a] || !nodes[b]) return;
    const A = nodes[a], Bp = nodes[b], mid = A.clone().lerp(Bp, 0.5); mid.y += 2.2 + (i % 3) * 0.4;
    const curve = new THREE.CatmullRomCurve3([A.clone(), A.clone().lerp(mid, 0.6).setY(2.2), mid, Bp.clone().lerp(mid, 0.6).setY(2.2), Bp.clone()]);
    const tube = shade(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.075, 8, false), mat(WIRE_COLORS[i % WIRE_COLORS.length], 0.55, 0.05)));
    g.add(tube);
  });
  return { group: g, led, extra: {} };
}

/** سجل النماذج المولّدة: أي شاشة تطلب مجسماً بالمعرّف تجده هنا قبل المجسمات المكتوبة يدوياً */
const registry = new Map<string, ModelSpec>();
export const registerModel = (id: string, spec: ModelSpec | null | undefined) => { if (spec?.items?.length) registry.set(id, spec); else registry.delete(id); };
export const modelFor = (id: string) => registry.get(id);
