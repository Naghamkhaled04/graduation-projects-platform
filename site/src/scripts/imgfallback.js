// أي صورة بتفشل (مثلاً صور القطع من المتجر لما يكون واقف) بتتبدّل بصورة بديلة مرتبة.
// بلا imports، لأن Base.astro بيحقن الملف inline بأول <head> عشان يلقط الأخطاء من أول صورة.

export const FALLBACK = '/img/part.svg';

export function onImgError(el) {
  if (!el || el.tagName !== 'IMG' || el.classList.contains('img-off')) return; // مرة وحدة بس، بلا لفّ
  el.classList.add('img-off');
  el.removeAttribute('srcset');
  el.src = FALLBACK;
}
