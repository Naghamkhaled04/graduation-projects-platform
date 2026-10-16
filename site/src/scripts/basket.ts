import { WHATSAPP } from '../data/config';
import { summary, fabText } from './basketsum.js';

/** سلة المتجر: مشتركة بين واجهة المتجر وصفحات الأقسام، محفوظة بالمتصفح */
export interface Line { id: string; nm: string; p: number; img: string; n: number }

const KEY = 'store.basket.v3';
const ar = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function mountBasket(root: ParentNode = document) {
  const box = root.querySelector<HTMLElement>('.bsk');
  const fab = root.querySelector<HTMLElement>('.bfab');
  if (!box || !fab) return;
  const scrim = root.querySelector<HTMLElement>('.bsk-scrim');
  const list = box.querySelector<HTMLElement>('.list')!;
  const total = box.querySelector<HTMLElement>('.total')!;
  const cnt = box.querySelector<HTMLElement>('.top .cnt')!;
  const clearBtn = box.querySelector<HTMLButtonElement>('.clear')!;
  const fabT = fab.querySelector<HTMLElement>('.t')!;
  const tip = root.querySelector<HTMLElement>('.btoast');
  const tipMsg = tip?.querySelector<HTMLElement>('.m');
  const tipUndo = tip?.querySelector<HTMLButtonElement>('.undo');
  let tipT = 0, undo: (() => void) | null = null;

  // إشعار صغير؛ مع "تراجع" لما يكون في شي ينرجع عنه
  const toast = (msg: string, onUndo?: () => void) => {
    if (!tip || !tipMsg || !tipUndo) return;
    tipMsg.textContent = msg; undo = onUndo ?? null; tipUndo.hidden = !onUndo;
    tip.hidden = false; clearTimeout(tipT); tipT = window.setTimeout(() => { tip.hidden = true; undo = null; }, onUndo ? 4000 : 2200);
  };
  tipUndo?.addEventListener('click', () => { undo?.(); undo = null; tip!.hidden = true; });

  let bag: Record<string, Line> = {};
  try { bag = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* فاضية */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch { /* اختياري */ } };

  const open = () => { box.hidden = false; if (scrim) scrim.hidden = false; box.querySelector<HTMLElement>('.x')!.focus(); };
  const close = () => { box.hidden = true; if (scrim) scrim.hidden = true; };

  function paint() {
    const keys = Object.keys(bag), s = summary(bag);
    fab.hidden = !keys.length;
    fabT.textContent = fabText(s, ar);
    total.textContent = `${ar(s.total)} د.أ`;
    cnt.textContent = keys.length ? `(${fabText(s, ar).split(' · ')[0]})` : '';
    clearBtn.hidden = !keys.length;
    box.classList.toggle('is-empty', !keys.length);
    list.innerHTML = keys.length
      ? keys.map((k) => `<div class="row">
          <img src="${esc(bag[k].img)}" alt="" loading="lazy" width="44" height="44" />
          <span class="n">${esc(bag[k].nm)}</span>
          <span class="pp">${ar(bag[k].p * bag[k].n)} د.أ</span>
          <span class="qty"><button type="button" data-m="${esc(k)}" aria-label="أنقص">−</button><b>${ar(bag[k].n)}</b><button type="button" data-p="${esc(k)}" aria-label="زد">+</button></span>
        </div>`).join('')
      : '<div class="empty"><p>سلتك فاضية لسا. ضيفي قطع مشروعك وبنأكدها معك على واتساب.</p><a class="nv-btn" href="/store/all">تصفّح القطع</a></div>';
    // زر أضف بكل كرت بيبيّن الكمية اللي بالسلة
    root.querySelectorAll<HTMLElement>('.nv-card').forEach((c) => {
      const b = c.querySelector<HTMLElement>('.add'); if (!b) return;
      const n = bag[c.dataset.id!]?.n ?? 0;
      b.textContent = n ? `✓ ${ar(n)}` : '+ أضف';
      b.classList.toggle('in', n > 0);
    });
  }

  root.querySelectorAll<HTMLElement>('.nv-grid').forEach((grid) =>
    grid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.add'); if (!b) return;
      const el = b.closest<HTMLElement>('.nv-card')!, id = el.dataset.id!;
      bag[id] = { id, nm: el.dataset.nm!, p: Number(el.dataset.price) || 0, img: el.dataset.img || '', n: (bag[id]?.n ?? 0) + 1 };
      save(); paint();
      // الإضافة ما بتفتح السلة: إشعار + زر السلة بينبض
      toast(`انضافت للسلة ✓ ${el.dataset.nm}`);
      fab.classList.remove('pop'); void fab.offsetWidth; fab.classList.add('pop');
    }));

  list.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-p],[data-m]'); if (!t) return;
    const k = t.dataset.p ?? t.dataset.m!;
    if (t.dataset.p) bag[k].n++; else if (--bag[k].n <= 0) delete bag[k];
    save(); paint();
  });

  // إفراغ السلة مع تراجع ٤ ثواني
  clearBtn.addEventListener('click', () => {
    const backup = bag; bag = {}; save(); paint();
    toast('فرّغنا السلة', () => { bag = backup; save(); paint(); });
  });

  fab.addEventListener('click', open);
  box.querySelector('.x')!.addEventListener('click', close);
  scrim?.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });

  // الموبايل: سحب اللوحة لتحت بيسكّرها
  let y0 = -1;
  const grab = box.querySelector<HTMLElement>('.grab');
  grab?.addEventListener('pointerdown', (e) => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); });
  grab?.addEventListener('pointerup', (e) => { if (y0 >= 0 && e.clientY - y0 > 60) close(); y0 = -1; });

  box.querySelector('.order')!.addEventListener('click', () => {
    const keys = Object.keys(bag); if (!keys.length) return;
    const msg = `مرحباً،\nبدي أطلب هالقطع:\n\n${keys.map((k) => `• ${bag[k].nm} × ${bag[k].n}`).join('\n')}\n\nالمجموع التقريبي: ${ar(summary(bag).total)} د.أ`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });
  paint();
}
