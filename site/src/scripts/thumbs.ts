import * as THREE from 'three';
import { createStage, makeEnv, configureRenderer, type Stage } from './stage';

/**
 * مجسمات البطاقات: سياق WebGL واحد مشترك (المتصفح يحدّ عدد السياقات بحوالي ١٦)
 * يرسم كل بطاقة ظاهرة ثم ينسخ الصورة إلى canvas البطاقة. يُبنى المجسم عند الاقتراب ويُفكّ عند الابتعاد.
 */
const W = 640, H = 420;

export function initThumbs(canvases: HTMLCanvasElement[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  configureRenderer(renderer);
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const env = makeEnv(renderer);

  interface Live { stage: Stage; ctx: CanvasRenderingContext2D; rot: number; hover: boolean; onScreen: boolean }
  const live = new Map<HTMLCanvasElement, Live>();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const cv = en.target as HTMLCanvasElement;
        if (en.isIntersecting && !live.has(cv)) {
          cv.width = W; cv.height = H;
          const stage = createStage(cv.dataset.id!, env, W / H, 512);
          const item: Live = { stage, ctx: cv.getContext('2d')!, rot: 0.6, hover: false, onScreen: true };
          const card = cv.closest('.card');
          card?.addEventListener('pointerenter', () => (item.hover = true));
          card?.addEventListener('pointerleave', () => (item.hover = false));
          live.set(cv, item);
        } else if (!en.isIntersecting && live.has(cv)) {
          live.get(cv)!.stage.dispose();
          live.delete(cv);
        }
      }
    },
    { rootMargin: '200px' },
  );
  canvases.forEach((c) => io.observe(c));

  const t0 = performance.now();
  let frame = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (++frame % 2) return; // 30fps تكفي للبطاقات
    const t = (performance.now() - t0) / 1000;
    for (const [cv, it] of live) {
      const r = cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      it.rot += reduce ? 0 : it.hover ? 0.02 : 0.0045;
      it.stage.update(t, it.rot, 0.42);
      renderer.render(it.stage.scene, it.stage.cam);
      it.ctx.clearRect(0, 0, W, H);
      it.ctx.drawImage(renderer.domElement, 0, 0, W, H);
      cv.classList.add('ready');
    }
  };
  tick();
}
