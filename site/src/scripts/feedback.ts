  import { getBackend } from '../community/backend';
  import { compress } from '../community/img';
  import { gate, esc, ar, stars, date, STATUS, demoBanner } from '../community/ui';
  import type { Feedback } from '../community/types';

export function mountFeedback(root: HTMLElement) {
  (async () => {
    const be = await getBackend(), pid = root.dataset.project!;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    let rating = 0; const imgs: string[] = [];

    const paintRate = () => { $('#fb-rate').innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${n <= rating ? 'on' : ''}" data-n="${n}" aria-label="${n} من ٥">★</button>`).join(''); };
    const paintThumbs = () => { $('#fb-thumbs').innerHTML = imgs.map((u, i) => `<span class="t"><img src="${u}" alt="" /><button type="button" data-rm="${i}" aria-label="حذف الصورة">×</button></span>`).join(''); };

    async function load() {
      const list = await be.feedbackFor(pid);
      const shown = list.filter((f) => f.status === 'approved');
      const built = shown.filter((f) => f.images.length).length, bb = document.getElementById('built-badge');
      if (bb) { bb.hidden = built === 0; if (built) bb.textContent = built === 1 ? 'طالب واحد نفّذ هذا المشروع' : `${ar(built)} طلاب نفّذوا هذا المشروع`; }
      const n = shown.length, avg = n ? shown.reduce((s, f) => s + f.rating, 0) / n : 0;
      $('#avg-stars').textContent = n ? stars(Math.round(avg)) : '';
      $('#avg-num').textContent = n ? ar(Math.round(avg * 10) / 10) : '';
      $('#avg-cnt').textContent = n ? `(${ar(n)} تجربة)` : 'كن أول من يشارك تجربته';
      const me = (await be.session())?.id;
      $('#fb-list').innerHTML = list.map((f: Feedback) => `
        <article class="c-card fb">
          <div class="top"><b><a class="who" href="/u?id=${encodeURIComponent(f.user_id)}" title="ملفه العام">${esc(f.author ?? 'طالب')}</a></b><span class="c-stars">${stars(f.rating)}</span><small>${date(f.created_at)}</small>
            ${f.status !== 'approved' ? `<span class="c-badge ${f.status}">${STATUS[f.status]}</span>` : ''}
            ${f.user_id === me ? `<button type="button" class="c-btn ghost sm" data-del="${f.id}">حذف</button>` : ''}</div>
          <p>${esc(f.comment)}</p>
          ${f.images.length ? `<div class="c-thumbs">${f.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="صورة من تنفيذ الطالب" loading="lazy" /></a>`).join('')}</div>` : ''}
        </article>`).join('') || '';
      return list.some((f) => f.user_id === me);
    }

    const done = await load();
    const authHost = $('#fb-auth'), form = $('#fb-form');
    authHost.insertAdjacentHTML('beforebegin', demoBanner(be));
    const sess = await gate(authHost, be, 'سجّل دخولك بالبريد لتكتب تجربتك');
    if (sess) { authHost.hidden = true; if (done) form.innerHTML = '<p class="c-note">كتبت تجربتك على هالمشروع. شكراً لمشاركتك </p>'; form.hidden = false; }
    paintRate();

    root.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;
      const star = t.closest<HTMLElement>('[data-n]'); if (star) { rating = Number(star.dataset.n); paintRate(); }
      const rm = t.closest<HTMLElement>('[data-rm]'); if (rm) { imgs.splice(Number(rm.dataset.rm), 1); paintThumbs(); }
      const del = t.closest<HTMLElement>('[data-del]'); if (del && confirm('تحذف تجربتك؟')) { await be.deleteFeedback(del.dataset.del!); location.reload(); }
    });
    root.querySelector('#fb-files')?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement, err = $('#fb-err'); err.textContent = '';
      try { for (const f of [...(input.files ?? [])]) { if (imgs.length >= 3) { err.textContent = 'الحد الأقصى ٣ صور'; break; } imgs.push(await compress(f)); } } catch (x: any) { err.textContent = x.message; }
      input.value = ''; paintThumbs();
    });
    root.querySelector('#fb-send')?.addEventListener('click', async () => {
      const err = $('#fb-err'), btn = $<HTMLButtonElement>('#fb-send'); err.textContent = ''; btn.disabled = true;
      try {
        await be.submitFeedback({ project_id: pid, rating, comment: $<HTMLTextAreaElement>('#fb-text').value, images: imgs });
        form.innerHTML = '<p class="c-note">وصلت تجربتك بتظهر للجميع بعد المراجعة، ونقاطك بتنزل بعد الموافقة.</p>'; await load();
      } catch (x: any) { err.textContent = x.message === 'AUTH' ? 'سجّل دخولك أولاً' : x.message; } finally { btn.disabled = false; }
    });
  })();
}
