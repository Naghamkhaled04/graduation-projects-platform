import * as THREE from 'three';
import { createStage, makeEnv, configureRenderer } from './stage';

/** عارض تفاعلي لصفحة المشروع: سحب للتدوير، عجلة للتقريب، ويتوقف خارج الشاشة */
export function mountViewer(el: HTMLElement, id: string) {
  const canvas = el.querySelector('canvas')!;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    el.classList.add('no-webgl');
    return;
  }
  configureRenderer(renderer);
  const stage = createStage(id, makeEnv(renderer), 1);

  let dist = stage.dist, tDist = dist;
  const size = () => {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    const ratio = tDist / stage.dist;
    stage.fit(w / h);
    tDist = stage.dist * ratio; dist = tDist;
  };
  new ResizeObserver(size).observe(el);
  size();

  let rotY = 0.6, rotX = 0.42, tY = rotY, tX = rotX;
  let drag = false, px = 0, py = 0, idle = 0;
  el.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; py = e.clientY; el.setPointerCapture(e.pointerId); el.classList.add('touched'); });
  el.addEventListener('pointerup', () => (drag = false));
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    tY += (e.clientX - px) * 0.008;
    tX = Math.max(0.05, Math.min(1.25, tX + (e.clientY - py) * 0.006));
    px = e.clientX; py = e.clientY; idle = 0;
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    tDist = Math.max(stage.dist * 0.5, Math.min(stage.dist * 1.5, tDist + e.deltaY * stage.dist * 0.001));
  }, { passive: false });

  const xb = el.querySelector<HTMLButtonElement>('.xbtn');
  xb?.addEventListener('click', (e) => { e.stopPropagation(); const on = xb.getAttribute('aria-pressed') !== 'true'; xb.setAttribute('aria-pressed', String(on)); xb.textContent = on ? 'جمّع المجسم' : 'فكّك المجسم'; stage.setExplode(on); });
  xb?.addEventListener('pointerdown', (e) => e.stopPropagation());
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  const tick = () => {
    requestAnimationFrame(tick);
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    idle++;
    if (!drag && !reduce) tY += idle > 90 ? 0.004 : 0;
    rotY += (tY - rotY) * 0.1; rotX += (tX - rotX) * 0.1; dist += (tDist - dist) * 0.1;
    stage.update((performance.now() - t0) / 1000, rotY, rotX, dist);
    renderer.render(stage.scene, stage.cam);
  };
  tick();
}
