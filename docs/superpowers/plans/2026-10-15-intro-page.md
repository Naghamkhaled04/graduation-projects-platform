# Intro Page + Site Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` a public 3D intro page (board drops, powers on, follows the visitor through idea/goal → team → why us → sign-in) and lock every other page behind sign-in, with the old home moved to `/home`.

**Architecture:** A dependency-free `guard.js` (pure functions, unit-tested with `node:test`) is inlined into `<head>` by `Base.astro` for every non-public page and redirects to `/login?next=…` before paint. The Three.js board builder is extracted from `hero3d.ts` into `board3d.ts` so `/home` and the intro share one model. The intro scene (`intro3d.ts`) blends board poses from per-section scroll progress; content lives in `src/data/intro.ts`.

**Tech Stack:** Astro 7 (static output), Three.js 0.186, GSAP 3.12.5 (CDN, already in `Base.astro`), Node 24 `node:test`, Playwright (via the Playwright MCP / `webapp-testing` skill) for visual and flow checks.

**Spec:** `docs/superpowers/specs/2026-10-15-intro-page-design.md`

## Global Constraints

- Public without sign-in: `/`, `/login`, `/join`, `/terms` **only**.
- Demo session = `JSON.parse(localStorage['community.demo.v1']).authed === true`; Supabase session = a localStorage key matching `/^sb-.+-auth-token$/` whose value contains `access_token`.
- Redirect target: `/login?next=<encodeURIComponent(pathname + search)>`; after sign-in with no `next`, go to `/home`.
- Palette tokens from `site/src/styles/global.css` (navy `#0e3a63`/`#0a2448`/`#0b1230`, neon `#3db7a6`, glow `rgba(61,183,166,…)`); fonts IBM Plex Sans Arabic + IBM Plex Mono; page is `dir="rtl"`.
- All copy in Jordanian Arabic, matching the spec's text; example content is flagged `example: true` and shows the tag "مثال · عبّيه".
- `devicePixelRatio` capped at 2; no horizontal scroll at 390px; `prefers-reduced-motion` → no drop, no flicker, no scroll-linked board motion.
- No new npm dependencies.
- Run all commands from `site/` unless stated. Dev server: `npm run dev -- --port 4321` (already configured in `.claude/launch.json`).

## Review Focus

1. **Storage unavailable or throwing** (Safari private mode, blocked site data): the guard must not throw and must send the visitor to `/login`, not leave a blank page. → test in Task 1.
2. **Corrupt demo session JSON** (`community.demo.v1` = `"{oops"`): treated as signed-out, no exception. → test in Task 1.
3. **Malicious `next`** (`/login?next=https://evil.com` or `//evil.com`): after sign-in the user must stay on this site (`/home`). Today `login.astro` follows any `next`. → `safeNext` + test in Task 1.
4. **Deep link with query** (`/store/all?q=esp32`) while signed out: after sign-in the visitor lands back on the exact URL including `?q=esp32`. → test in Task 1.
5. **No WebGL** (old phone / disabled GPU): intro still shows the hero, all text and the sign-in buttons, with a still board image. → check in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `site/src/scripts/guard.js` (new) | Pure session/redirect helpers: `hasSession`, `loginUrl`, `safeNext`. No imports, so it can be inlined. |
| `site/src/scripts/guard.test.js` (new) | `node:test` unit tests for `guard.js`. |
| `site/src/layouts/Base.astro` (modify) | New props `isPublic`, `bare`; inlines the guard for non-public pages; `bare` hides site chrome. |
| `site/src/pages/home.astro` (moved from `index.astro`) | Old home, unchanged content, now at `/home`. |
| `site/src/pages/index.astro` (new) | Intro page markup + styles. |
| `site/src/data/intro.ts` (new) | All intro copy. |
| `site/src/scripts/board3d.ts` (new) | Shared Three.js board: env, lights, PCB (+ glow map), parts. |
| `site/src/scripts/hero3d.ts` (modify) | Uses `board3d.ts`; behaviour unchanged. |
| `site/src/scripts/intro3d.ts` (rewrite of draft) | Intro scene: drop, power-on, section poses, team split, USB port. |
| `site/src/styles/auth.css` (modify) | `view-transition-name: auth` on the sign-in card. |
| `site/public/intro/board.webp` (new) | Still image for the no-WebGL fallback. |
| `site/src/pages/intro-draft.astro` (delete) | Spike page. |

---

### Task 1: Site lock (guard) + move home to `/home`

**Files:**
- Create: `site/src/scripts/guard.js`, `site/src/scripts/guard.test.js`
- Modify: `site/package.json` (scripts), `site/src/layouts/Base.astro`, `site/src/pages/login.astro`, `site/src/pages/join.astro`, `site/src/pages/terms.astro`, `site/src/components/Header.astro`, `site/src/components/Footer.astro`, `site/src/pages/admin.astro`, `site/src/pages/p.astro`, `site/src/pages/projects/[id].astro`, `site/src/pages/settings.astro`
- Move: `site/src/pages/index.astro` → `site/src/pages/home.astro`
- Create (temporary stub): `site/src/pages/index.astro`

**Interfaces:**
- Produces: `hasSession(store: {getItem(k): string|null, key(i): string|null, length: number}): boolean`, `loginUrl(loc: {pathname: string, search: string}): string`, `safeNext(raw: string|null, fallback?: string): string` from `site/src/scripts/guard.js`. `Base.astro` props `{ title: string; description?: string; isPublic?: boolean; bare?: boolean }`.

- [ ] **Step 1: Write the failing tests**

`site/src/scripts/guard.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSession, loginUrl, safeNext } from './guard.js';

const store = (obj) => {
  const keys = Object.keys(obj);
  return { getItem: (k) => (k in obj ? obj[k] : null), key: (i) => keys[i] ?? null, length: keys.length };
};

test('signed-out when storage is empty', () => {
  assert.equal(hasSession(store({})), false);
});
test('demo session counts when authed is true', () => {
  assert.equal(hasSession(store({ 'community.demo.v1': '{"authed":true}' })), true);
  assert.equal(hasSession(store({ 'community.demo.v1': '{"authed":false}' })), false);
});
test('supabase session counts when token has access_token', () => {
  assert.equal(hasSession(store({ 'sb-abcd-auth-token': '{"access_token":"x"}' })), true);
  assert.equal(hasSession(store({ 'sb-abcd-auth-token': '{}' })), false);
  assert.equal(hasSession(store({ 'other-auth-token': '{"access_token":"x"}' })), false);
});
test('corrupt demo JSON is signed-out, not a crash', () => {
  assert.equal(hasSession(store({ 'community.demo.v1': '{oops' })), false);
});
test('throwing storage is signed-out, not a crash', () => {
  const bad = { getItem() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, get length() { throw new Error('blocked'); } };
  assert.equal(hasSession(bad), false);
});
test('loginUrl keeps path and query', () => {
  assert.equal(loginUrl({ pathname: '/store/all', search: '?q=esp32' }), '/login?next=%2Fstore%2Fall%3Fq%3Desp32');
  assert.equal(loginUrl({ pathname: '/city', search: '' }), '/login?next=%2Fcity');
});
test('safeNext only allows same-site paths', () => {
  assert.equal(safeNext('/store/all?q=esp32'), '/store/all?q=esp32');
  assert.equal(safeNext(null), '/home');
  assert.equal(safeNext(''), '/home');
  assert.equal(safeNext('https://evil.com'), '/home');
  assert.equal(safeNext('//evil.com'), '/home');
  assert.equal(safeNext('/\\evil.com'), '/home');
  assert.equal(safeNext('javascript:alert(1)'), '/home');
  assert.equal(safeNext('/x', '/profile'), '/x');
  assert.equal(safeNext(null, '/profile'), '/profile');
});
```

Add to `site/package.json` `"scripts"`:
```json
"test": "node --test src/scripts/guard.test.js"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../guard.js'`.

- [ ] **Step 3: Implement `guard.js`**

`site/src/scripts/guard.js`:
```js
// قفل الموقع — دوال صافية بدون imports، لأن Base.astro بيحقن هالملف inline بأول <head>.

/** في جلسة دخول؟ (تجريبي أو Supabase) — متزامن، وما بيرمي أبدًا */
export function hasSession(store) {
  try {
    const demo = JSON.parse(store.getItem('community.demo.v1') || 'null');
    if (demo && demo.authed === true) return true;
  } catch (e) { /* JSON خربان أو تخزين محجوب */ }
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && /^sb-.+-auth-token$/.test(k) && (store.getItem(k) || '').indexOf('access_token') !== -1) return true;
    }
  } catch (e) { /* تخزين محجوب */ }
  return false;
}

/** رابط الدخول مع الرجوع لنفس الصفحة */
export function loginUrl(loc) {
  return '/login?next=' + encodeURIComponent(loc.pathname + loc.search);
}

/** next آمن: مسار داخلي بس، وإلا fallback */
export function safeNext(raw, fallback = '/home') {
  return typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Move the old home to `/home` and add a temporary `/` stub**

```bash
git mv src/pages/index.astro src/pages/home.astro
```

`site/src/pages/index.astro` (stub; replaced in Task 3):
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="مشاريع — مشاريع تخرج لطلاب الحاسوب وإنترنت الأشياء" isPublic bare>
  <main style="min-height:100vh;display:grid;place-content:center;gap:12px;text-align:center">
    <h1>مشاريع</h1>
    <p><a href="/login">تسجيل الدخول</a> · <a href="/join">حساب جديد</a></p>
  </main>
</Base>
```

- [ ] **Step 6: Wire the guard and the new props into `Base.astro`**

In `site/src/layouts/Base.astro`, replace the frontmatter and `<head>` opening and the three chrome lines:

```astro
---
import '../styles/global.css';
import Header from '../components/Header.astro';
import ChatAdvisor from '../components/ChatAdvisor.astro';
import WhatsAppFab from '../components/WhatsAppFab.astro';
import Footer from '../components/Footer.astro';
import guardSrc from '../scripts/guard.js?raw';

interface Props {
  title: string;
  description?: string;
  /** صفحة مفتوحة بدون تسجيل دخول */
  isPublic?: boolean;
  /** بدون الهيدر والمساعد والواتساب والفوتر (صفحة التعريف) */
  bare?: boolean;
}
const { title, description = 'مشاريع تخرج لطلاب الحاسوب وإنترنت الأشياء: أفكار، قطع، وسلة جاهزة.', isPublic = false, bare = false } = Astro.props;
const guard = guardSrc.replace(/^export /gm, '') + '\nif(!hasSession(localStorage))location.replace(loginUrl(location));';
const path = Astro.url.pathname.replace(/\/$/, '');
const chrome = !bare && !['/city', '/admin'].includes(path);
---

<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    {!isPublic && <script is:inline set:html={guard}></script>}
```
Keep the rest of `<head>` as is. In `<body>` replace:
```astro
    <Header />
    <slot />
    {!['/city', '/admin'].includes(Astro.url.pathname.replace(/\/$/, '')) && <ChatAdvisor />}
    {!['/city', '/admin'].includes(Astro.url.pathname.replace(/\/$/, '')) && <WhatsAppFab />}
    {!['/city', '/admin'].includes(Astro.url.pathname.replace(/\/$/, '')) && <Footer />}
```
with:
```astro
    {!bare && <Header />}
    <slot />
    {chrome && <ChatAdvisor />}
    {chrome && <WhatsAppFab />}
    {chrome && <Footer />}
```

- [ ] **Step 7: Mark public pages and make `next` safe**

- `login.astro`, `join.astro`, `terms.astro`: add `isPublic` to the `<Base …>` tag, e.g. `<Base title="تسجيل الدخول — مشاريع" description="…" isPublic>`.
- `login.astro` script: replace
  `const next = new URLSearchParams(location.search).get('next') || '/profile';`
  with
  ```ts
  import { safeNext } from '../scripts/guard.js';
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  ```
  (put the `import` with the other imports at the top of the `<script>`).
- `join.astro` script: replace `const next = params.get('next') || '/profile';` with `const next = safeNext(params.get('next'));` and add `import { safeNext } from '../scripts/guard.js';` to its imports.

- [ ] **Step 8: Point home links at `/home`**

Run from `site/`:
```bash
perl -pi -e "s#href: '/'#href: '/home'#; s#href: '/\\#projects'#href: '/home\\#projects'#; s#href=\"/\"#href=\"/home\"#g; s#href=\"/\\#(projects|contact)\"#href=\"/home\\#\$1\"#g" src/components/Header.astro src/components/Footer.astro src/pages/admin.astro src/pages/p.astro "src/pages/projects/[id].astro" src/pages/settings.astro
grep -rnE "href(=|: )['\"]/(#|['\"])" src --include=*.astro --include=*.ts
```
Expected: the grep prints nothing.

- [ ] **Step 9: Build and check the lock in a browser**

Run: `npm run build` → Expected: `Complete!`, no errors. Start/keep the dev server on 4321, then run this Playwright check (Playwright MCP `browser_run_code_unsafe`):
```js
async (page) => {
  const ctx = page.context(); await ctx.clearCookies();
  await page.goto('http://localhost:4321/'); await page.evaluate(() => localStorage.clear());
  const out = {};
  for (const p of ['/store/all?q=esp32', '/city', '/home']) { await page.goto('http://localhost:4321' + p); out[p] = new URL(page.url()).pathname + new URL(page.url()).search; }
  for (const p of ['/', '/login', '/join', '/terms']) { await page.goto('http://localhost:4321' + p); out[p] = new URL(page.url()).pathname; }
  await page.evaluate(() => localStorage.setItem('community.demo.v1', JSON.stringify({ authed: true, me: { id: 'me', display_name: 'x', role: 'student', points: 0 }, feedback: [], ledger: [], redemptions: [], admin: false })));
  await page.goto('http://localhost:4321/login?next=%2Fstore%2Fall%3Fq%3Desp32'); await page.waitForURL(/store/);
  out.afterLogin = new URL(page.url()).pathname + new URL(page.url()).search;
  await page.goto('http://localhost:4321/login?next=https%3A%2F%2Fevil.com'); await page.waitForURL(/home/);
  out.evil = new URL(page.url()).pathname;
  return out;
}
```
Expected:
```
"/store/all?q=esp32": "/login?next=%2Fstore%2Fall%3Fq%3Desp32", "/city": "/login?next=%2Fcity", "/home": "/login?next=%2Fhome",
"/": "/", "/login": "/login", "/join": "/join", "/terms": "/terms",
"afterLogin": "/store/all?q=esp32", "evil": "/home"
```

- [ ] **Step 10: Commit**

```bash
git add -A src package.json
git commit -m "feat: lock site behind sign-in, move home to /home, safe next redirects"
```

---

### Task 2: Extract the shared 3D board (`board3d.ts`)

**Files:**
- Create: `site/src/scripts/board3d.ts`
- Modify: `site/src/scripts/hero3d.ts:1-178`

**Interfaces:**
- Produces:
  ```ts
  export interface Part { g: THREE.Group; base: THREE.Vector3; dir: THREE.Vector3; spin: number }
  export interface BoardOpts { pcb: [string, string]; env: number; hemiGround: number; hemi: number; key: number }
  export interface Board {
    board: THREE.Group; parts: Record<string, Part>; list: Part[];
    pcbMat: THREE.MeshStandardMaterial; ledMat: THREE.MeshStandardMaterial;
    ledLight: THREE.PointLight; rim: THREE.DirectionalLight;
  }
  export function buildBoard(renderer: THREE.WebGLRenderer, scene: THREE.Scene, o: BoardOpts): Board
  ```
  `pcbMat` has a glow `emissiveMap` (neon traces) with `emissiveIntensity: 0`; `ledMat` starts with `emissiveIntensity: 1.6`, `ledLight.intensity = 8`, `rim.intensity = 3` (hero values).

- [ ] **Step 1: Take a "before" screenshot of `/home`**

Sign in (demo) and screenshot the hero at rest and with parts exploded (Playwright MCP):
```js
async (page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4321/login'); await page.evaluate(() => localStorage.setItem('community.demo.v1', JSON.stringify({ authed: true, me: { id: 'me', display_name: 'x', role: 'student', points: 0 }, feedback: [], ledger: [], redemptions: [], admin: false })));
  await page.goto('http://localhost:4321/home'); await page.waitForTimeout(2500);
  await page.screenshot({ path: '.playwright-mcp/home_before_0.png' });
  await page.evaluate(() => scrollTo(0, innerHeight * 1.2)); await page.waitForTimeout(2500);
  await page.screenshot({ path: '.playwright-mcp/home_before_1.png' });
}
```

- [ ] **Step 2: Create `board3d.ts`**

`site/src/scripts/board3d.ts` — move `W, D, TH, TOP`, `pcbTexture`, the environment, lights, board, materials, `box`, `part` and every `part(...)` call out of `hero3d.ts`, with these changes:
```ts
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
  {
    const env = new THREE.Scene();
    const mat = (c: number, i: number, side: THREE.Side = THREE.BackSide) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side });
    env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 60, 60), mat(o.env, 1)));
    const panel = (w: number, h: number, x: number, y: number, z: number, c: number, i: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c, i, THREE.DoubleSide)); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(24, 12, 0, 22, 6, 0xffffff, 3.2);
    panel(10, 20, -24, 4, 4, 0xd8ecff, 1.6);
    panel(10, 20, 24, 2, -2, 0xd8f2f0, 1.2);
    panel(20, 6, 0, -16, 10, 0x3db7a6, 1.5);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, o.hemiGround, o.hemi));
  const key = new THREE.DirectionalLight(0xffffff, o.key); key.position.set(4, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3db7a6, 3); rim.position.set(-7, 3, -5); scene.add(rim);
  const ledLight = new THREE.PointLight(0x3db7a6, 8, 6, 2); scene.add(ledLight);

  const board = new THREE.Group(); scene.add(board);
  const tx = pcbTextures(o.pcb[0], o.pcb[1]);
  const pcbMat = new THREE.MeshStandardMaterial({ map: tx.map, emissiveMap: tx.glow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.42, metalness: 0.12 });
  // … paste the board Shape/ExtrudeGeometry block from hero3d.ts:106-122 unchanged,
  //   but use `pcbMat` instead of `new THREE.MeshStandardMaterial({ map: pcbTexture(), … })`.
  // … paste materials, `box`, `part` and every `part(...)` call from hero3d.ts:124-178 unchanged,
  //   renaming `orangeM` → `neonM`, and creating `ledMat` before the parts:
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x3db7a6, emissive: 0x3db7a6, emissiveIntensity: 1.6, roughness: 0.3 });
  //   so `part('led', …)` becomes `(g) => g.add(box(0.34, 0.12, 0.22, ledMat))`.
  return { board, parts, list, pcbMat, ledMat, ledLight, rim };
}
```
The two "paste" blocks are verbatim moves of existing code (lines given), not new logic.

- [ ] **Step 3: Use it from `hero3d.ts`**

In `site/src/scripts/hero3d.ts`: delete lines 26–59 (`W…pcbTexture`) and 61 (`interface Part`), delete the environment/lights/board/materials/parts blocks (lines 81–178), and in their place (right after `cam.position.set(0, 0, 17);`) put:
```ts
  const { board, parts, list, ledMat, ledLight } = buildBoard(renderer, scene, {
    pcb: ['#078a91', '#045a60'], env: 0x6f6a62, hemiGround: 0x9fb3c4, hemi: 0.9, key: 3.2,
  });
```
Add `import { buildBoard } from './board3d';` at the top. Everything below (shadow, dust, tick) stays as is.

- [ ] **Step 4: Type-check, build, compare screenshots**

Run: `npx astro check` → Expected: 0 errors in `board3d.ts`/`hero3d.ts`.
Run: `npm run build` → Expected: `Complete!`.
Re-run the Step 1 Playwright code saving to `home_after_0.png` / `home_after_1.png`, then:
```bash
python -c "from PIL import Image, ImageChops; import sys
for i in (0,1):
  a=Image.open(f'../.playwright-mcp/home_before_{i}.png').convert('RGB'); b=Image.open(f'../.playwright-mcp/home_after_{i}.png').convert('RGB')
  d=ImageChops.difference(a,b).getbbox(); print(i, 'same' if not d else d)"
```
Expected: both `same`, or a diff box only around the floating dust (random each load). Look at both pairs side by side to confirm the board itself is identical.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/board3d.ts src/scripts/hero3d.ts
git commit -m "refactor: extract shared 3D board builder from hero3d"
```

---

### Task 3: Intro content + page markup (no 3D yet)

**Files:**
- Create: `site/src/data/intro.ts`
- Modify: `site/src/pages/index.astro` (replace the stub)

**Interfaces:**
- Produces: `intro` object (shape below); DOM hooks used by Task 4: `#intro` (root), `canvas.stage3d`, `.boot`, `#s-idea`, `#s-team`, `.mem .slot` (×4), `#s-why`, `#s-port`, `[data-auth]` (sign-in links), `img.board-still`.

- [ ] **Step 1: Create `intro.ts`**

`site/src/data/intro.ts`:
```ts
// كل نصوص صفحة التعريف. أي عنصر عليه example: true بيطلع عليه "مثال · عبّيه" لحد ما يتبدّل بالحقيقي.
export interface Member { name: string; role: string; line: string; example?: true }
export interface Comp { name: string; year: string; result: string; example?: true }

export const intro = {
  hero: {
    eyebrow: 'U1 · مشاريع تخرج · الأردن',
    title: ['من فكرة', 'إلى', 'مشروع بيشتغل'],
    lede: 'إحنا أربع طلاب علوم حاسوب وإنترنت أشياء. منساعدك تختار مشروع تخرجك، تجهّز قطعه، وتوصل للمناقشة وإنت فاهم كل سطر.',
    trust: ['٥٠ فكرة مشروع جاهزة', 'قطع من مورّد معتمد بإربد', 'استشارة بـ ٥ د.أ'],
  },
  idea: { h: 'فكرتنا', p: 'منصة بتمسك إيد طالب التخرج من أول فكرة لآخر سؤال بالمناقشة: فكرة واضحة، قطع بأسعار المورّد، ومسار مكتوب خطوة بخطوة.' },
  goal: { h: 'هدفنا', p: 'إنه كل طالب يدخل مناقشته فاهم مشروعه، مش حافظه. وإنا نبني من الأردن شركة منتجات، منتج ورا منتج.' },
  team: [
    { name: 'نغم', role: 'الدور', line: 'سطر عن نفسك', example: true },
    { name: 'استبرق', role: 'الدور', line: 'سطر عن نفسك', example: true },
    { name: 'شكري', role: 'الدور', line: 'سطر عن نفسك', example: true },
    { name: 'محمد', role: 'الدور', line: 'سطر عن نفسك', example: true },
  ] as Member[],
  why: [
    { k: 'القطع', h: 'مورّد معتمد بإربد', p: 'القطع من ABELA Electronic. منجهّز سلتك، بتأكدها عبر واتساب، وإحنا منطلبها.' },
    { k: 'الفهم', h: 'ما منكتب الكود عنك', p: 'منعطيك المسار والمخطط والحلول، وإنت بتبني. هيك بتدخل المناقشة واثق.' },
    { k: 'السعر', h: 'أسعار واضحة', p: 'الاستشارة ٥ د.أ، وجلسة المراجعة ١٢ د.أ. بدون مفاجآت.' },
    { k: 'التقنية', h: 'تقنية إلنا', p: 'نموذج تفريغ صوتي باللهجة الأردنية بنيناه بإيدينا، مش خدمة مستأجرة.' },
  ],
  competitions: [
    { name: 'اسم المسابقة', year: '٢٠٢٥', result: 'النتيجة', example: true },
    { name: 'اسم المسابقة', year: '٢٠٢٥', result: 'النتيجة', example: true },
    { name: 'اسم المسابقة', year: '٢٠٢٦', result: 'النتيجة', example: true },
  ] as Comp[],
  port: { h: 'شبّك حالك.', p: 'سجّل دخولك وكمّل من وين ما وقفت.', cta: 'سجّل دخولك' },
};
```

- [ ] **Step 2: Write `index.astro`**

`site/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { intro } from '../data/intro';
const { hero, idea, goal, team, why, competitions, port } = intro;
const Ex = '<span class="ex">مثال · عبّيه</span>';
---

<Base title="مشاريع — من فكرة إلى مشروع بيشتغل" description="فريق أردني بيوصّل طالب التخرج من الفكرة للمناقشة." isPublic bare>
  <div class="intro" id="intro">
    <canvas class="stage3d" aria-hidden="true"></canvas>
    <img class="board-still" src="/intro/board.webp" alt="" width="1200" height="800" />

    <nav class="in-nav" aria-label="الدخول">
      <a class="in-logo" href="/"><i aria-hidden="true"></i>مشاريع</a>
      <div class="in-cta">
        <a class="in-btn ghost" href="/join" data-auth>حساب جديد</a>
        <a class="in-btn" href="/login" data-auth>تسجيل الدخول</a>
      </div>
    </nav>

    <header class="in-hero">
      <span class="silk">{hero.eyebrow}</span>
      <h1>{hero.title[0]}<br />{hero.title[1]} <em>{hero.title[2]}</em></h1>
      <p class="lede">{hero.lede}</p>
      <div class="in-hero-cta">
        <a class="in-btn big" href="/login" data-auth>سجّل دخولك ←</a>
        <a class="in-btn ghost big" href="#s-idea">تعرّف علينا ↓</a>
      </div>
      <ul class="trust">{hero.trust.map((t) => <li>{t}</li>)}</ul>
      <div class="boot" aria-hidden="true"></div>
    </header>

    <section class="in-sec in-idea" id="s-idea">
      <div class="in-col">
        <article><span class="silk">U2 · الفكرة</span><h2>{idea.h}</h2><p>{idea.p}</p></article>
        <article><span class="silk">U3 · الهدف</span><h2>{goal.h}</h2><p>{goal.p}</p></article>
      </div>
    </section>

    <section class="in-sec in-team" id="s-team">
      <div class="in-wide">
        <span class="silk">U4 · الفريق</span>
        <h2>مين نحن</h2>
        <div class="team">
          {team.map((m) => (
            <div class="mem">
              <div class="slot" aria-hidden="true"></div>
              <h3>{m.name}</h3>
              <p class="role">{m.role}</p>
              <p>{m.line}</p>
              {m.example && <Fragment set:html={Ex} />}
            </div>
          ))}
        </div>
      </div>
    </section>

    <section class="in-sec in-why" id="s-why">
      <div class="in-col">
        <span class="silk">U5 · ليش نحنا</span>
        <h2>ليش نحنا بالذات؟</h2>
        <div class="why">
          {why.map((w) => (<div><b class="silk">{w.k}</b><h3>{w.h}</h3><p>{w.p}</p></div>))}
        </div>
        <h3 class="comp-h">شاركنا في</h3>
        <ul class="comps">
          {competitions.map((c) => (<li><span class="silk">{c.year}</span><b>{c.name}</b><span>{c.result}</span>{c.example && <Fragment set:html={Ex} />}</li>))}
        </ul>
      </div>
    </section>

    <section class="in-sec in-port" id="s-port">
      <div class="port-box">
        <span class="silk">J1 · دخول</span>
        <h2>{port.h}</h2>
        <p>{port.p}</p>
        <a class="in-btn big plug" href="/login" data-auth>{port.cta}</a>
        <a class="terms" href="/terms">الشروط والأحكام</a>
      </div>
    </section>
  </div>

  <style is:global>
    body { background: #071a33; color: #e9f3f8; }
    .intro { position: relative; }
    .intro::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background: radial-gradient(circle at 1px 1px, rgba(233,243,248,.07) 1px, transparent 1.5px) 0 0/24px 24px,
                  radial-gradient(ellipse at 50% 60%, #0b2f55 0%, #071a33 70%); }
    .stage3d { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; }
    .board-still { display: none; }
    .intro > section, .intro > header { position: relative; z-index: 1; }
    .silk { font: 500 11px 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: .16em; color: #7f9ab3; text-transform: uppercase; }
    .ex { display: inline-block; margin-top: 6px; font: 500 11px 'IBM Plex Mono', monospace; color: #ffd36b; background: rgba(255,196,0,.12); border: 1px dashed rgba(255,196,0,.45); padding: 1px 8px; border-radius: 6px; }

    .in-nav { position: fixed; top: env(safe-area-inset-top, 0px); inset-inline: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center; padding: 16px clamp(16px, 4vw, 40px); background: linear-gradient(#071a33cc, transparent); }
    .in-logo { display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 19px; }
    .in-logo i { width: 26px; height: 26px; border-radius: 7px; background: #0e3a63; position: relative; box-shadow: inset 0 0 0 1px #1c5f77; }
    .in-logo i::after { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: #3db7a6; box-shadow: 0 0 10px #3db7a6; }
    .in-cta, .in-hero-cta { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    .in-btn { font: 600 14px var(--font); padding: 9px 18px; border-radius: 999px; background: #3db7a6; color: #04211d; box-shadow: 0 0 24px rgba(61,183,166,.45); transition: transform .3s var(--ease-spring), box-shadow .3s; }
    .in-btn:hover { transform: translateY(-2px); box-shadow: 0 0 36px rgba(61,183,166,.7); }
    .in-btn.ghost { background: transparent; color: #e9f3f8; box-shadow: inset 0 0 0 1px rgba(233,243,248,.25); }
    .in-btn.big { font-size: 16px; padding: 13px 26px; }
    .in-btn:focus-visible { outline: 2px solid #a8efe4; outline-offset: 3px; }

    .in-hero { min-height: 100vh; min-height: 100dvh; display: grid; align-content: start; justify-items: center; text-align: center; padding: 14vh 16px 0; gap: 14px; }
    .in-hero h1 { font-size: clamp(42px, 7.6vw, 100px); line-height: 1.08; font-weight: 700; letter-spacing: -.02em; }
    .in-hero h1 em { font-style: normal; color: #3db7a6; }
    .in-hero .lede { max-width: 560px; color: #b9cadb; }
    .trust { list-style: none; padding: 0; margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 4px 18px; justify-content: center; font: 500 12px 'IBM Plex Mono', monospace; color: #7f9ab3; }
    .trust li::before { content: '◆ '; color: #3db7a6; font-size: 9px; }
    .boot { font: 500 12px 'IBM Plex Mono', monospace; color: #3db7a6; direction: ltr; min-height: 1.4em; }
    /* قبل التشغيل: العنوان باهت؛ intro3d.ts بيحط .powered */
    .js-3d:not(.powered) .in-hero h1, .js-3d:not(.powered) .in-hero .lede { opacity: .08; }
    .in-hero h1, .in-hero .lede { transition: opacity .8s; }
    .powered .in-hero h1 em { text-shadow: 0 0 22px rgba(61,183,166,.75), 0 0 60px rgba(61,183,166,.4); animation: inFlick 1s steps(1) 1; }
    @keyframes inFlick { 0%{opacity:.2} 10%{opacity:1} 16%{opacity:.35} 26%{opacity:1} 34%{opacity:.6} 44%,100%{opacity:1} }

    .in-sec { padding-inline: clamp(16px, 5vw, 64px); }
    .in-sec h2 { font-size: clamp(34px, 5vw, 60px); line-height: 1.1; margin: 8px 0 18px; }
    .in-col { width: min(520px, 100%); }
    .in-idea { min-height: 220vh; }
    .in-idea article { min-height: 100vh; padding-top: 30vh; }
    .in-idea p, .in-why p { color: #b9cadb; max-width: 46ch; }

    .in-team { min-height: 160vh; padding-top: 22vh; }
    .in-wide { width: min(1100px, 100%); margin-inline: auto; text-align: center; position: sticky; top: 14vh; }
    .team { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-top: 24px; }
    .mem { background: rgba(7,26,51,.72); backdrop-filter: blur(10px); border: 1px solid rgba(61,183,166,.25); border-radius: 18px; padding: 16px; text-align: center; }
    .mem .slot { height: 130px; }
    .mem h3 { font-size: 22px; }
    .mem .role { font: 500 12px 'IBM Plex Mono', monospace; color: #3db7a6; }
    .mem p { color: #b9cadb; font-size: 14px; }

    .in-why { min-height: 170vh; padding-top: 20vh; }
    .why { display: grid; gap: 22px; margin-top: 10px; }
    .why h3 { font-size: 22px; margin: 2px 0 4px; }
    .comp-h { margin-top: 40px; font-size: 18px; color: #e9f3f8; }
    .comps { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 8px; }
    .comps li { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; padding: 12px 0; border-top: 1px solid rgba(127,154,179,.22); }
    .comps b { font-weight: 600; }
    .comps span:not(.silk):not(.ex) { color: #b9cadb; font-size: 14px; }

    .in-port { min-height: 140vh; display: grid; align-items: end; padding-bottom: 12vh; }
    .port-box { text-align: center; display: grid; justify-items: center; gap: 12px; }
    .port-box p { color: #b9cadb; }
    .plugged .plug { box-shadow: 0 0 0 1px #a8efe4, 0 0 50px rgba(61,183,166,.9); }
    .terms { font-size: 13px; color: #7f9ab3; text-decoration: underline; margin-top: 10px; }

    /* بدون WebGL: صورة ثابتة + كل شي ظاهر */
    .no-webgl .stage3d { display: none; }
    .no-webgl .board-still { display: block; position: absolute; top: 58vh; left: 50%; transform: translateX(-50%); width: min(560px, 90vw); height: auto; z-index: 0; }
    /* تقليل الحركة: البوردة بتضل مع الهيرو وما بتلحق التمرير */
    .still .stage3d { position: absolute; height: 100vh; }

    @media (max-width: 760px) {
      .in-nav .ghost { display: none; }
      .in-hero { padding-top: 12vh; }
      .in-idea article, .why > div, .comps, .mem { background: rgba(7,26,51,.72); backdrop-filter: blur(8px); border-radius: 16px; }
      .in-idea article { min-height: 0; margin: 45vh 0 30vh; padding: 20px; }
      .why > div { padding: 16px; }
      .in-wide { position: static; }
      .team { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .mem .slot { height: 90px; }
    }
  </style>
</Base>
```

- [ ] **Step 3: Build and screenshot (static)**

Run: `npm run build` → Expected: `Complete!`.
Playwright MCP: open `http://localhost:4321/` at 1280×800 and 390×844, full-page screenshot each, and evaluate `document.documentElement.scrollWidth <= innerWidth`.
Expected: all 5 sections visible top-to-bottom with readable text, the "مثال · عبّيه" tags on team cards and competitions, nav buttons visible, `scrollWidth <= innerWidth` is `true` at 390.

- [ ] **Step 4: Commit**

```bash
git add src/data/intro.ts src/pages/index.astro
git commit -m "feat: intro page content and layout"
```

---

### Task 4: Intro 3D scene (`intro3d.ts`)

**Files:**
- Rewrite: `site/src/scripts/intro3d.ts` (replaces the spike version)
- Modify: `site/src/pages/index.astro` (add the `<script>`)

**Interfaces:**
- Consumes: `buildBoard`, `Board` from `./board3d`; `clamp`, `sstep` from `./theme`; DOM hooks from Task 3.
- Produces: `initIntro(root: HTMLElement): void`. Adds classes on `root`: `js-3d` (scene running), `powered` (after power-on), `plugged` (sign-in section reached), `no-webgl`, `still` (reduced motion).

- [ ] **Step 1: Replace `intro3d.ts`**

`site/src/scripts/intro3d.ts`:
```ts
import * as THREE from 'three';
import { clamp, sstep } from './theme';
import { buildBoard } from './board3d';

type Pose = [number, number, number, number, number, number]; // rx, ry, rz, x, y, scale
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Pose, b: Pose, t: number) => a.map((v, i) => lerp(v, b[i], t)) as Pose;

const OPEN: Pose = [0.95, -0.55, 0.1, 0, -2.55, 0.6];
const IDEA = (q: number): Pose => [0.6, 0.6 + q * 2.2, 0.05, -2.9, -0.1, 0.6];
const TEAM: Pose = [0.9, 0.3, 0, 0, 1.4, 0.5];
const WHY = (q: number): Pose => [0.7, 2.8 + q * 3.2, 0, -2.9, 0, 0.58];
const PORT: Pose = [0.25, Math.PI / 2, 0, 0, -0.4, 0.85]; // فتحة الـUSB (طرف -X) بتواجه الكاميرا

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

  // الـ٤ بوردات الصغيرة لقسم الفريق (بيشاركوا الهندسة والمواد)
  const minis = [0, 1, 2, 3].map(() => { const m = board.clone(); m.visible = false; scene.add(m); return m; });

  const shadow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(61,183,166,.35)'); gr.addColorStop(1, 'rgba(61,183,166,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; scene.add(m); return m;
  })();

  const sec = (id: string) => root.querySelector<HTMLElement>(id)!;
  const sIdea = sec('#s-idea'), sTeam = sec('#s-team'), sWhy = sec('#s-why'), sPort = sec('#s-port');
  const slots = [...root.querySelectorAll<HTMLElement>('.mem .slot')];
  const prog = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return clamp((innerHeight * 0.6 - r.top) / r.height); };

  // من نقطة على الشاشة لنقطة على مستوى z=0
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2();
  const toWorld = (sx: number, sy: number, out: THREE.Vector3) => {
    ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(plane, out); return out;
  };

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
  const v = new THREE.Vector3(), target = new THREE.Vector3();

  const frame = () => {
    const t = reduce ? 99 : (performance.now() - t0) / 1000;
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
    const portrait = innerWidth < 760;

    // تقدم الأقسام (مع تقليل الحركة كله صفر → البوردة ثابتة على OPEN)
    const p0 = reduce ? 0 : clamp(scrollY / (innerHeight * 0.9));
    const qI = reduce ? 0 : prog(sIdea), qT = reduce ? 0 : prog(sTeam), qW = reduce ? 0 : prog(sWhy), qP = reduce ? 0 : prog(sPort);

    let pose = OPEN;
    pose = mix(pose, IDEA(qI), sstep(0.15, 1, p0));
    pose = mix(pose, TEAM, sstep(0, 0.25, qT));
    pose = mix(pose, WHY(qW), sstep(0, 0.25, qW));
    pose = mix(pose, PORT, sstep(0, 0.4, qP));
    if (portrait) { pose = [...pose] as Pose; pose[3] = 0; pose[4] += p0 > 0.3 && qP < 0.2 ? 2.2 : 0; pose[5] *= 0.62; }

    // النزول
    const d = clamp(t / T_DROP), drop = (1 - outBack(d)) * 9;
    board.rotation.set(pose[0] + smy * 0.14 + (1 - d) * 0.6, pose[1] + smx * 0.25 - (1 - d) * 0.9, pose[2] + Math.sin(t * 0.5) * 0.02);
    board.position.set(pose[3], pose[4] + drop + Math.sin(t * 0.9) * 0.08, 0);

    // انقسام الفريق: البوردة بتصغر والـ٤ بيطلعوا لأماكن الكروت
    const split = sstep(0.05, 0.3, qT) * (1 - sstep(0, 0.25, qW));
    board.scale.setScalar(pose[5] * (1 - split));
    minis.forEach((m, i) => {
      m.visible = split > 0.01 && !!slots[i];
      if (!m.visible) return;
      const r = slots[i].getBoundingClientRect();
      toWorld(r.left + r.width / 2, r.top + r.height / 2, target);
      m.position.lerpVectors(board.position, target, split);
      m.rotation.set(0.9, t * 0.6 + i * 1.3, 0);
      m.scale.setScalar(lerp(0.05, portrait ? 0.14 : 0.2, split));
    });

    shadow.position.set(pose[3], pose[4] - 1.6, 0);
    (shadow.material as THREE.MeshBasicMaterial).opacity = d * 0.9 * (1 - split) * (1 - sstep(0.3, 0.7, qP));

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
```

- [ ] **Step 2: Wire it into `index.astro`**

Add right before `<style is:global>` in `site/src/pages/index.astro`:
```astro
  <script>
    import { initIntro } from '../scripts/intro3d';
    initIntro(document.getElementById('intro')!);
  </script>
```

- [ ] **Step 3: Type-check, build, and capture every stage**

Run: `npx astro check` → 0 errors in `intro3d.ts`. Run: `npm run build` → `Complete!`.
Playwright MCP:
```js
async (page) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const shots = async (w, h, tag) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:4321/'); await page.waitForTimeout(600);
    await page.screenshot({ path: `.playwright-mcp/i_${tag}_drop.png` });
    await page.waitForTimeout(2600); await page.screenshot({ path: `.playwright-mcp/i_${tag}_on.png` });
    for (const [id, f] of [['#s-idea', 0.15], ['#s-idea', 0.7], ['#s-team', 0.45], ['#s-why', 0.4], ['#s-port', 0.8]]) {
      const y = await page.evaluate(([s, k]) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top + scrollY + r.height * k - innerHeight * 0.6; }, [id, f]);
      await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(900);
      await page.screenshot({ path: `.playwright-mcp/i_${tag}_${id.slice(3)}_${f}.png` });
    }
    return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  };
  return { desktopFits: await shots(1280, 800, 'd'), mobileFits: await shots(390, 844, 'm'), errs };
}
```
Expected: `errs` empty, both `…Fits` true. Look at every image:
- `drop`: board mid-air above its resting spot, title faint.
- `on`: board lit (neon traces + LED), title bright with neon word.
- `idea_0.15`: parts apart; `idea_0.7`: parts back together.
- `team_0.45`: four small boards sitting on the four team cards' empty slots, main board gone.
- `why_0.4`: one board, turned, beside the text.
- `port_0.8`: board facing camera with the USB port toward you, "سجّل دخولك" button glowing.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/intro3d.ts src/pages/index.astro
git commit -m "feat: intro 3D scene — drop, power-on, team split, USB port"
```

---

### Task 5: Sign-in morph, fallbacks, cleanup

**Files:**
- Modify: `site/src/styles/auth.css`, `site/src/pages/index.astro`
- Create: `site/public/intro/board.webp`
- Delete: `site/src/pages/intro-draft.astro`

**Interfaces:**
- Consumes: `[data-auth]` links (Task 3), `.auth .box` card on `/login` and `/join`.

- [ ] **Step 1: Shared-element name on the sign-in card**

Append to `site/src/styles/auth.css`:
```css
/* الزر بصفحة التعريف بيتمدد ويصير هالكرت (View Transition بين الصفحات) */
.auth .box { view-transition-name: auth; }
::view-transition-group(auth) { animation-duration: .55s; animation-timing-function: var(--ease-spring); }
```

- [ ] **Step 2: Name the clicked button on the intro**

Inside the `<script>` added in Task 4 (after `initIntro(...)`) in `index.astro`:
```ts
    // الاسم بينحط على الزر المكبوس بس، عشان ما يتكرر بالصفحة
    document.querySelectorAll<HTMLAnchorElement>('[data-auth]').forEach((a) =>
      a.addEventListener('click', () => { a.style.viewTransitionName = 'auth'; }),
    );
    addEventListener('pageshow', () => document.querySelectorAll<HTMLElement>('[data-auth]').forEach((a) => (a.style.viewTransitionName = '')));
```
(`pageshow` clears it when the visitor comes back with the Back button.)

- [ ] **Step 3: Make the no-WebGL still image**

With the dev server running, first create the folder (`mkdir -p public/intro` from `site/`), then capture the powered board and save it as WebP:
```js
async (page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4321/'); await page.waitForTimeout(3500);
  await page.evaluate(() => { document.querySelectorAll('.in-hero > *:not(canvas), .in-nav').forEach(e => e.style.visibility = 'hidden'); });
  await page.screenshot({ path: 'site/public/intro/board.png', clip: { x: 340, y: 380, width: 600, height: 400 } });
}
```
```bash
python -c "from PIL import Image; Image.open('public/intro/board.png').convert('RGB').resize((1200,800)).save('public/intro/board.webp', quality=82)"
rm public/intro/board.png
```
Open `public/intro/board.webp` and confirm it shows the whole lit board on navy (adjust the `clip` box and retake if it is cut off).

- [ ] **Step 4: Delete the spike page**

```bash
git rm src/pages/intro-draft.astro
```

- [ ] **Step 5: Check fallbacks and the morph**

Run: `npm run build` → `Complete!`. Playwright MCP:
```js
async (page) => {
  const out = {};
  // بدون WebGL
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = function () { return null; }; });
  await page.goto('http://localhost:4321/'); await page.waitForTimeout(800);
  out.noWebgl = await page.evaluate(() => ({ cls: document.getElementById('intro').className, img: getComputedStyle(document.querySelector('.board-still')).display, h1: getComputedStyle(document.querySelector('.in-hero h1')).opacity, btn: !!document.querySelector('.in-nav [href="/login"]').offsetParent }));
  await page.screenshot({ path: '.playwright-mcp/i_nowebgl.png' });
  return out;
}
```
Expected: `cls` contains `no-webgl powered`, `img` is `block`, `h1` is `1`, `btn` true; screenshot shows title, buttons and the still board.

Then in a fresh page with `page.emulateMedia({ reducedMotion: 'reduce' })`, open `/`, wait 300 ms, screenshot: board already lit at rest, no `.boot` animation needed; scroll to `#s-port` and screenshot: board scrolled away with the hero (class `still`), text readable.

Finally (normal page) click the hero "سجّل دخولك ←" and screenshot right after navigation: you land on `/login` with the card visible; in Chromium the button grows into the card (watch it in the Browser pane).

- [ ] **Step 6: Full acceptance pass and unit tests**

Run: `npm test` → 7 pass. Re-run Task 1 Step 9 and Task 4 Step 3 checks → same expected results.

- [ ] **Step 7: Commit**

```bash
git add -A src public/intro
git commit -m "feat: sign-in morph, no-WebGL still, reduced motion; remove intro draft"
```
