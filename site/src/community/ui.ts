import type { Backend } from './backend';
import type { Session } from './types';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const ar = (n: number) => n.toLocaleString('ar-EG');
export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
export const date = (iso: string) => new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
export const STATUS: Record<string, string> = { pending: 'بانتظار المراجعة', approved: 'معتمد', rejected: 'مرفوض', open: 'مفتوح', used: 'مستخدم', cancelled: 'ملغي' };

/** يعرض نموذج الدخول بالبريد (سحابي فقط) إن ما في جلسة. يرجع الجلسة أو null */
/** بعد رجوع الطالب من رابط البريد: طبّق البيانات اللي كتبها بصفحة التسجيل */
export async function applyPendingJoin(be: any) {
  try {
    const raw = sessionStorage.getItem('join.pending'); if (!raw) return;
    sessionStorage.removeItem('join.pending');
    await be.saveProfile(JSON.parse(raw));
  } catch { /* تجاهل */ }
}

export async function gate(host: HTMLElement, be: Backend, msg = 'سجّل دخولك بالبريد لتكمل'): Promise<Session | null> {
  const s = await be.session();
  if (s) await applyPendingJoin(be);
  if (s) return s;
  host.innerHTML = `<div class="c-auth"><p>${esc(msg)}</p><div class="row"><input type="email" dir="ltr" placeholder="بريدك الإلكتروني" /><button type="button" class="c-btn">أرسل رابط الدخول</button></div><small class="c-note"></small></div>`;
  const input = host.querySelector('input')!, note = host.querySelector<HTMLElement>('.c-note')!;
  host.querySelector('button')!.addEventListener('click', async () => {
    if (!/^\S+@\S+\.\S+$/.test(input.value.trim())) { note.textContent = 'اكتب بريداً صحيحاً'; return; }
    try { await be.signIn(input.value.trim()); note.textContent = 'أرسلنا رابط الدخول لبريدك. افتحه وارجع لهالصفحة.'; } catch (e: any) { note.textContent = e.message; }
  });
  return null;
}
export const demoBanner = (be: Backend) => be.mode === 'local'
  ? `<div class="c-demo">وضع تجريبي: بياناتك محفوظة بمتصفحك فقط ولا يراها أحد. الحفظ المشترك يشتغل لما تُفعَّل قاعدة البيانات (<code>docs/community-backend.md</code>).</div>` : '';

/** شارة الليدر جنب الاسم: TFC لأدمن المنصة، وسفير الجامعة لليدرها */
export const adminBadge = (isAdmin: boolean) =>
  isAdmin ? '<span class="c-team" title="فريق TFC، إدارة المنصة">★ TFC</span>' : '';
export const ambBadge = (uniShort: string) =>
  `<span class="c-team amb" title="ليدر مجتمع الجامعة">سفير ${esc(uniShort)}</span>`;
