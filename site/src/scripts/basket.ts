import { WHATSAPP } from '../data/config';

/** سلة المتجر: مشتركة بين واجهة المتجر وصفحات الأقسام، محفوظة بالمتصفح */
export interface Line { id: string; nm: string; p: number; img: string; n: number }

const KEY = 'store.basket.v3';
const ar = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function mountBasket(root: ParentNode = document) {
  const box = root.querySelector<HTMLElement>('.bsk');
  const fab = root.querySelector<HTMLElement>('.bfab');
  if (!box || !fab) return;
  const list = box.querySelector<HTMLElement>('.list')!;
  const total = box.querySelector<HTMLElement>('.total')!;
  const fabN = fab.querySelector<HTMLElement>('span')!;

  let bag: Record<string, Line> = {};
  try { bag = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* فاضية */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch { /* اختياري */ } };

  function paint() {
    const keys = Object.keys(bag), sum = keys.reduce((s, k) => s + bag[k].p * bag[k].n, 0);
    fab.hidden = !keys.length;
    fabN.textContent = ar(keys.reduce((s, k) => s + bag[k].n, 0));
    total.textContent = `${ar(sum)} د.أ`;
    list.innerHTML = keys.length
      ? keys.map((k) => `<div class="row">
          <img src="${esc(bag[k].img || '/img/part.svg')}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/img/part.svg'" />
          <span class="n">${esc(bag[k].nm)}</span>
          <span class="pp">${ar(bag[k].p * bag[k].n)} د.أ</span>
          <span class="qty"><button type="button" data-m="${esc(k)}" aria-label="أنقص">−</button><b>${ar(bag[k].n)}</b><button type="button" data-p="${esc(k)}" aria-label="زد">+</button></span>
        </div>`).join('')
      : '<p class="c-note">سلتك فاضية.</p>';
    if (!keys.length) box.hidden = true;
  }

  root.querySelectorAll<HTMLElement>('.nv-grid').forEach((grid) =>
    grid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.add'); if (!b) return;
      const el = b.closest<HTMLElement>('.nv-card')!, id = el.dataset.id!;
      bag[id] = { id, nm: el.dataset.nm!, p: Number(el.dataset.price) || 0, img: el.dataset.img || '', n: (bag[id]?.n ?? 0) + 1 };
      save(); paint(); box.hidden = false;
      b.textContent = '✓'; setTimeout(() => (b.textContent = 'أضف'), 1000);
    }));

  list.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-p],[data-m]'); if (!t) return;
    const k = t.dataset.p ?? t.dataset.m!;
    if (t.dataset.p) bag[k].n++; else if (--bag[k].n <= 0) delete bag[k];
    save(); paint();
  });
  fab.addEventListener('click', () => (box.hidden = false));
  box.querySelector('.x')!.addEventListener('click', () => (box.hidden = true));
  box.querySelector('.order')!.addEventListener('click', () => {
    const keys = Object.keys(bag); if (!keys.length) return;
    const sum = keys.reduce((s, k) => s + bag[k].p * bag[k].n, 0);
    const msg = `مرحباً،\nبدي أطلب هالقطع:\n\n${keys.map((k) => `• ${bag[k].nm} × ${bag[k].n}`).join('\n')}\n\nالمجموع التقريبي: ${ar(sum)} د.أ`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });
  paint();
}
