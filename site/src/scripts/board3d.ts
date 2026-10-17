import * as THREE from 'three';

const W = 6.8, D = 5.2, TH = 0.16, TOP = 0.1;

export interface Part { g: THREE.Group; base: THREE.Vector3; dir: THREE.Vector3; spin: number }
export interface BoardOpts { pcb: [string, string]; env: number; hemiGround: number; hemi: number; key: number }
export interface Board {
  board: THREE.Group; parts: Record<string, Part>; list: Part[];
  pcbMat: THREE.MeshStandardMaterial; ledMat: THREE.MeshStandardMaterial;
  ledLight: THREE.PointLight; rim: THREE.DirectionalLight;
}

/** لوحة PCB + خريطة توهّج للمسارات بنفس البذرة (seed) */
function pcbTextures(c0: string, c1: string) {
  const mk = () => { const c = document.createElement('canvas'); c.width = 1400; c.height = 1060; return [c, c.getContext('2d')!] as const; };
  const [c, g] = mk(), [cg, gg] = mk();
  const gr = g.createLinearGradient(0, 0, 1400, 1060);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(0, 0, 1400, 1060);
  gg.fillStyle = '#000'; gg.fillRect(0, 0, 1400, 1060);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const k of [g, gg]) { k.lineCap = 'round'; k.lineJoin = 'round'; }
  for (let i = 0; i < 110; i++) {
    let x = Math.round(rnd() * 70) * 20, y = Math.round(rnd() * 53) * 20;
    const pts: number[][] = [[x, y]];
    for (let k = 0; k < 3; k++) {
      if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * Math.round(rnd() * 8 + 2) * 20;
      else y += (rnd() < 0.5 ? -1 : 1) * Math.round(rnd() * 6 + 2) * 20;
      pts.push([x, y]);
    }
    const a = 0.1 + rnd() * 0.14, lw = 5 + rnd() * 4;
    for (const [k, col] of [[g, `rgba(190,255,250,${a})`], [gg, '#3db7a6']] as const) {
      k.beginPath(); pts.forEach(([px, py], j) => (j ? k.lineTo(px, py) : k.moveTo(px, py)));
      k.strokeStyle = col; k.lineWidth = lw; k.stroke();
    }
    g.beginPath(); g.arc(x, y, 9, 0, 7); g.fillStyle = 'rgba(230,255,252,.28)'; g.fill();
    g.beginPath(); g.arc(x, y, 4, 0, 7); g.fillStyle = '#075f65'; g.fill();
    gg.beginPath(); gg.arc(x, y, 9, 0, 7); gg.fillStyle = '#a8efe4'; gg.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5;
  g.strokeRect(90, 110, 1220, 840); g.strokeRect(620, 300, 320, 320);
  g.beginPath(); g.arc(660, 340, 9, 0, 7); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = '700 92px "IBM Plex Sans Arabic",Arial'; g.fillText('مشاريع', 640, 760);
  g.font = '500 34px Arial'; g.fillText('IoT · REV 1.0', 640, 830);
  const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(c), glow: tex(cg) };
}

export function buildBoard(renderer: THREE.WebGLRenderer, scene: THREE.Scene, o: BoardOpts): Board {
  // بيئة انعكاس مصنوعة من ألواح مضيئة
  {
    const env = new THREE.Scene();
    const mat = (c: number, i: number, side: THREE.Side = THREE.BackSide) =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side });
    env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), mat(o.env, 1)));
    const panel = (w: number, h: number, x: number, y: number, z: number, c: number, i: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c, i, THREE.DoubleSide));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(24, 12, 0, 22, 6, 0xffffff, 3.2);
    panel(10, 20, -24, 4, 4, 0xd8ecff, 1.6);
    panel(10, 20, 24, 2, -2, 0xd8f2f0, 1.2);
    panel(20, 6, 0, -16, 10, 0x3db7a6, 1.5);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, o.hemiGround, o.hemi));
  const key = new THREE.DirectionalLight(0xffffff, o.key); key.position.set(4, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3db7a6, 3); rim.position.set(-7, 3, -5); scene.add(rim);
  const ledLight = new THREE.PointLight(0x3db7a6, 8, 6, 2); scene.add(ledLight);

  // البوردة
  const board = new THREE.Group(); scene.add(board);
  const tx = pcbTextures(o.pcb[0], o.pcb[1]);
  const pcbMat = new THREE.MeshStandardMaterial({ map: tx.map, emissiveMap: tx.glow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.42, metalness: 0.12 });
  {
    const r = 0.32, x = -W / 2, y = -D / 2, s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.quadraticCurveTo(x + W, y, x + W, y + r);
    s.lineTo(x + W, y + D - r); s.quadraticCurveTo(x + W, y + D, x + W - r, y + D);
    s.lineTo(x + r, y + D); s.quadraticCurveTo(x, y + D, x, y + D - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    [[-2.9, -2.0], [2.7, -1.6], [-2.9, 1.9], [2.7, 2.0]].forEach(([hx, hy]) => {
      const h = new THREE.Path(); h.absarc(hx, hy, 0.2, 0, 7, true); s.holes.push(h);
    });
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: TH, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 16,
    });
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, (p.getY(i) + D / 2) / D);
    geo.translate(0, 0, -TH / 2); geo.rotateX(-Math.PI / 2);
    board.add(new THREE.Mesh(geo, pcbMat));
  }

  const black = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.45, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.22, metalness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6c15a, roughness: 0.28, metalness: 1 });
  const neonM = new THREE.MeshStandardMaterial({ color: 0x3db7a6, roughness: 0.4 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x3db7a6, emissive: 0x3db7a6, emissiveIntensity: 1.6, roughness: 0.3 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); return o;
  };
  const parts: Record<string, Part> = {};
  const list: Part[] = [];
  const part = (name: string, x: number, z: number, dir: number[], build: (g: THREE.Group) => void, spin = 0) => {
    const g = new THREE.Group(); g.position.set(x, TOP, z); build(g); board.add(g);
    const o = { g, base: g.position.clone(), dir: new THREE.Vector3(...dir), spin };
    parts[name] = o; list.push(o);
  };
  part('usb', -2.65, -1.05, [-2.2, 2.4, -0.6], (g) => { g.add(box(1.7, 0.95, 1.3, metal)); g.add(box(1.5, 0.05, 1.1, black, 0, 0.95)); });
  part('dc', -2.75, 1.4, [-2.4, 2.9, 1.5], (g) => { g.add(box(1.5, 0.75, 1, black)); g.add(box(0.5, 0.05, 0.5, metal, -0.3, 0.75)); });
  part('mcu', 0.85, 0.2, [0, 4.6, 0], (g) => {
    g.add(box(1.5, 0.18, 1.5, black));
    const pg = new THREE.BoxGeometry(0.07, 0.05, 0.24);
    for (let i = 0; i < 12; i++) {
      const t = -0.6 + i * 0.109;
      for (const [a, b, rot] of [[t, -0.83, 0], [t, 0.83, 0], [-0.83, t, 1], [0.83, t, 1]] as number[][]) {
        const pin = new THREE.Mesh(pg, metal); pin.position.set(a, 0.05, b); if (rot) pin.rotation.y = Math.PI / 2; g.add(pin);
      }
    }
  }, 0.5);
  part('chip2', -1.35, -0.65, [-0.8, 3.3, -1.8], (g) => g.add(box(0.8, 0.14, 0.8, black)), -0.4);
  part('reg', -1.5, 1.45, [-0.9, 2.6, 2], (g) => g.add(box(0.62, 0.32, 0.55, black)), 0.3);
  part('xtal', -0.35, -1.05, [0.2, 3.8, -2.2], (g) => g.add(box(0.55, 0.2, 0.28, metal)), 0.6);
  [[-2.05, 0.5], [-1.6, 0.15]].forEach(([x, z], i) =>
    part('cap' + i, x, z, [-1.6 - i * 0.4, 3.6 + i * 0.5, 0.6], (g) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 28), new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.4, metalness: 0.3 }));
      c.position.y = 0.25; g.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 28), metal); t.position.y = 0.5; g.add(t);
    }, i * 0.4));
  part('reset', -2.2, -1.95, [-1.2, 4, -2], (g) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 24), neonM); c.position.y = 0.11; g.add(c); g.add(box(0.5, 0.09, 0.5, metal));
  }, 0.8);
  part('led', 2.35, -0.35, [1.8, 3.6, -0.2], (g) => g.add(box(0.34, 0.12, 0.22, ledMat)));
  part('head', 0, -2.2, [0, 2.6, -2.9], (g) => {
    g.add(box(4.6, 0.42, 0.28, black));
    for (let i = 0; i < 10; i++) g.add(box(0.09, 0.36, 0.09, gold, -2.05 + i * 0.455, 0.42, 0));
  });
  part('head2', 0.2, 2.2, [0, 2.8, 3], (g) => {
    g.add(box(4.2, 0.42, 0.28, black));
    for (let i = 0; i < 8; i++) g.add(box(0.09, 0.36, 0.09, gold, -1.85 + i * 0.53, 0.42, 0));
  });
  part('sw', 2.55, 1.5, [1.9, 3.2, 1.6], (g) => {
    g.add(box(0.7, 0.28, 0.7, black));
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20), metal); c.position.y = 0.33; g.add(c);
  }, 0.5);

  return { board, parts, list, pcbMat, ledMat, ledLight, rim };
}
