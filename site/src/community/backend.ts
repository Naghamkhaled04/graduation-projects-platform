import { POINTS } from './rules';
import { authReturn } from '../scripts/guard.js';
import { dataUrlToBlob } from './img';
import type { Feedback, FeedbackInput, LedgerRow, Msg, PendingBuilding, Profile, Redemption, Session, Thread } from './types';

export interface Backend {
  mode: 'local' | 'cloud';
  session(): Promise<Session | null>;
  signIn(email: string): Promise<void>;
  /** إنشاء حساب بكلمة سر. handle = بريد أو رقم موبايل بصيغة دولية */
  signUp(handle: string, password: string, profile: Partial<Profile>): Promise<{ needsConfirm: boolean }>;
  /** دخول بكلمة سر */
  logIn(handle: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  profile(id?: string): Promise<Profile | null>;
  saveProfile(p: Partial<Profile>): Promise<Profile>;
  feedbackFor(projectId: string): Promise<Feedback[]>;
  myFeedback(): Promise<Feedback[]>;
  userFeedback(userId: string): Promise<Feedback[]>;
  byUniversity(name: string): Promise<Profile[]>;
  submitFeedback(i: FeedbackInput): Promise<Feedback>;
  deleteFeedback(id: string): Promise<void>;
  ledger(): Promise<LedgerRow[]>;
  redeem(): Promise<string>;
  myRedemptions(): Promise<Redemption[]>;
  leaderboard(): Promise<Profile[]>;
  // أدمن
  isAdmin(): Promise<boolean>;
  adminPendingFeedback(): Promise<Feedback[]>;
  adminModerateFeedback(id: string, status: 'approved' | 'rejected'): Promise<void>;
  adminPendingBuildings(): Promise<PendingBuilding[]>;
  adminModerateBuilding(id: string, status: 'approved' | 'rejected'): Promise<void>;
  adminRedemptions(): Promise<Redemption[]>;
  adminSetRedemption(id: string, status: 'used' | 'cancelled'): Promise<void>;
  adminAdjustPoints(userId: string, delta: number, why: string): Promise<void>;
  adminUsers(): Promise<Profile[]>;

  /** مراسلة الإدارة: خيط واحد لكل طالب */
  myMessages(): Promise<Msg[]>;
  sendMessage(body: string): Promise<void>;
  unreadFromAdmin(): Promise<number>;
  adminThreads(): Promise<Thread[]>;
  adminThread(userId: string): Promise<Msg[]>;
  adminReply(userId: string, body: string): Promise<void>;
  /** نسخة من كل البيانات بملف واحد */
  adminExport(): Promise<Record<string, unknown[]>>;
  /** ترقية حساب لأدمن أو إنزاله — يُفحص على الخادم */
  adminSetRole(userId: string, role: 'student' | 'admin'): Promise<void>;
  /** معرّفات حسابات الفريق، لعرض الشارة جنب الاسم */
  adminIds(): Promise<Set<string>>;
  /** بث لحظي للرسائل. userId فارغ = خيطي أنا. يرجّع دالة إلغاء الاشتراك */
  onMessages(userId: string | null, cb: () => void): Promise<() => void>;
}

const clean = (s: string, n: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const checkInput = (i: FeedbackInput) => {
  const comment = clean(i.comment, 800);
  if (comment.length < 10) throw new Error('اكتب فيدباك من ١٠ أحرف على الأقل');
  if (i.rating < 1 || i.rating > 5) throw new Error('اختر تقييماً من ١ إلى ٥');
  if (i.images.length > 3) throw new Error('الحد الأقصى ٣ صور');
  return { ...i, comment };
};
/** رسائل Supabase بالعربي */
function mapAuthError(m: string) {
  const t = (m || '').toLowerCase();
  if (t.includes('invalid login')) return 'البريد أو كلمة السر غلط';
  if (t.includes('already registered') || t.includes('already been registered')) return 'في حساب بهالبريد. سجّل دخولك بدل ما تنشئ حساباً جديداً';
  if (t.includes('password') && t.includes('6')) return 'كلمة السر ٦ أحرف على الأقل';
  if (t.includes('not confirmed')) return 'أكّد بريدك أولاً: افتح الرسالة اللي وصلتك واضغط الرابط';
  if (t.includes('rate limit') || t.includes('too many')) return 'محاولات كثيرة. جرّب بعد شوي';
  return m || 'تعذّر إتمام العملية';
}

const worth = (imgs: string[]) => (imgs.length ? POINTS.photoFeedback : POINTS.ideaComment);

/* ───────────── محلي: للمعاينة فقط، بمتصفح واحد ───────────── */
interface LocalState {
  me: Profile; feedback: Feedback[]; ledger: (LedgerRow & { user_id: string })[]; redemptions: Redemption[]; admin: boolean;
  /** الوضع التجريبي يبدأ مسجّلاً خارجاً، مثل الوضع الحقيقي */
  authed?: boolean;
}
class LocalBackend implements Backend {
  mode = 'local' as const;
  private key = 'community.demo.v1';
  private st(): LocalState {
    try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s) return s; } catch { /* جديد */ }
    const s: LocalState = { me: { id: 'me', display_name: 'أنت (تجريبي)', role: 'student', points: 0 }, feedback: [], ledger: [], redemptions: [], admin: false };
    this.put(s); return s;
  }
  private put(s: LocalState) { localStorage.setItem(this.key, JSON.stringify(s)); }
  setAdmin(on: boolean) { const s = this.st(); s.admin = on; s.me.role = on ? 'admin' : 'student'; this.put(s); }
  private award(s: LocalState, uid: string, d: number, reason: string) {
    s.ledger.unshift({ id: crypto.randomUUID(), user_id: uid, delta: d, reason, created_at: new Date().toISOString() });
    if (uid === 'me') s.me.points += d;
  }
  /** مكافأة الدعوة تُدفع مرة واحدة، عند أول محتوى معتمد للمدعو */
  private payInvite(s: LocalState, uid: string) {
    if (uid !== 'me' || !s.me.referred_by || s.me.invite_paid) return;
    s.me.invite_paid = true;
    this.award(s, 'me', POINTS.welcome, 'welcome');
    this.award(s, s.me.referred_by, POINTS.invite, 'invite');
  }
  async session() { return this.st().authed ? { id: 'me', email: 'demo@local' } : null; }
  private auth(on: boolean) { const s = this.st(); s.authed = on; this.put(s); }
  async signIn() { this.auth(true); }
  async signUp(_h: string, _p: string, profile: Partial<Profile>) { this.auth(true); await this.saveProfile(profile); return { needsConfirm: false }; }
  async logIn() { this.auth(true); }
  async resetPassword() {}
  async signOut() { this.auth(false); }
  async profile() { return this.st().me; }
  async saveProfile(p: Partial<Profile>) {
    const s = this.st();
    if (p.display_name !== undefined) { const n = clean(p.display_name, 40); if (n.length < 2) throw new Error('الاسم حرفين على الأقل'); s.me.display_name = n; }
    for (const k of ['university', 'major', 'bio'] as const) if (p[k] !== undefined) s.me[k] = clean(String(p[k] ?? ''), k === 'bio' ? 280 : 60);
    if (p.student_id !== undefined) s.me.student_id = String(p.student_id ?? '').replace(/\D/g, '').slice(0, 20) || null;
    // الداعي يُسجَّل مرة واحدة فقط، ولا يمكن تغييره لاحقاً
    if (p.referred_by !== undefined && !s.me.referred_by && p.referred_by && p.referred_by !== s.me.id) s.me.referred_by = String(p.referred_by).slice(0, 64);
    if (p.year !== undefined) s.me.year = p.year;
    this.put(s); return s.me;
  }
  async feedbackFor(pid: string) { const s = this.st(); return s.feedback.filter((f) => f.project_id === pid && (f.status === 'approved' || f.user_id === 'me')); }
  async myFeedback() { return this.st().feedback.filter((f) => f.user_id === 'me'); }
  async userFeedback(id: string) { return id === 'me' ? this.st().feedback.filter((f) => f.user_id === 'me' && f.status === 'approved') : []; }
  async byUniversity(name: string) { const m = this.st().me; return m.university && m.university.includes(name.replace(/^جامعة\s*/, '')) ? [m] : []; }
  async submitFeedback(i: FeedbackInput) {
    const v = checkInput(i), s = this.st();
    if (s.feedback.some((f) => f.project_id === v.project_id && f.user_id === 'me')) throw new Error('كتبت فيدباك على هالمشروع من قبل');
    const f: Feedback = { id: crypto.randomUUID(), project_id: v.project_id, user_id: 'me', author: s.me.display_name, rating: v.rating, comment: v.comment, images: v.images, status: 'pending', created_at: new Date().toISOString() };
    s.feedback.unshift(f); this.put(s); return f;
  }
  async deleteFeedback(id: string) { const s = this.st(); s.feedback = s.feedback.filter((f) => f.id !== id); this.put(s); }
  async ledger() { return this.st().ledger.filter((l) => l.user_id === 'me'); }
  async redeem() {
    const s = this.st(); if (s.me.points < POINTS.redeemCost) throw new Error(`رصيدك أقل من ${POINTS.redeemCost} نقطة`);
    const code = 'FREE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    this.award(s, 'me', -POINTS.redeemCost, 'redeem');
    s.redemptions.unshift({ id: crypto.randomUUID(), user_id: 'me', author: s.me.display_name, code, status: 'open', created_at: new Date().toISOString() });
    this.put(s); return code;
  }
  async myRedemptions() { return this.st().redemptions; }
  async leaderboard() { return [this.st().me]; }
  async isAdmin() { return this.st().admin; }
  async adminPendingFeedback() { return this.st().feedback.filter((f) => f.status === 'pending'); }
  async adminModerateFeedback(id: string, status: 'approved' | 'rejected') {
    const s = this.st(), f = s.feedback.find((x) => x.id === id); if (!f) return;
    const was = f.status; f.status = status;
    if (status === 'approved' && was !== 'approved') {
      this.award(s, f.user_id, worth(f.images), f.images.length ? 'feedback_photo' : 'idea_comment');
      this.payInvite(s, f.user_id);
    }
    this.put(s);
  }
  async adminPendingBuildings() { return []; }
  async adminModerateBuilding() {}
  async adminRedemptions() { return this.st().redemptions; }
  async adminSetRedemption(id: string, status: 'used' | 'cancelled') { const s = this.st(), r = s.redemptions.find((x) => x.id === id); if (r) r.status = status; this.put(s); }
  async adminAdjustPoints(uid: string, d: number, why: string) { const s = this.st(); this.award(s, uid, d, 'admin: ' + why); this.put(s); }
  async adminUsers() { return [this.st().me]; }
  async myMessages() { return this.msgs(); }
  async sendMessage(body: string) {
    const b = clean(body, 2000); if (b.length < 2) throw new Error('اكتب رسالتك');
    const s = this.st() as any; (s.messages ??= []).push({ id: crypto.randomUUID(), user_id: s.me.id, from_admin: false, body: b, read_at: null, created_at: new Date().toISOString() }); this.put(s);
  }
  async unreadFromAdmin() { return this.msgs().filter((m) => m.from_admin && !m.read_at).length; }
  async adminThreads() {
    const m = this.msgs(); if (!m.length) return [];
    const last = m[m.length - 1];
    return [{ user_id: this.st().me.id, name: this.st().me.display_name, last_body: last.body, last_at: last.created_at, unread: 0 }];
  }
  async adminThread() { return this.msgs(); }
  async adminReply(_userId: string, body: string) {
    const b = clean(body, 2000); if (b.length < 2) throw new Error('اكتب الرد');
    const s = this.st() as any; (s.messages ??= []).push({ id: crypto.randomUUID(), user_id: s.me.id, from_admin: true, body: b, read_at: null, created_at: new Date().toISOString() }); this.put(s);
  }
  async adminExport() { return { ...(this.st() as any) }; }
  async adminSetRole() {}
  async adminIds() { return new Set<string>(); }
  async onMessages() { return () => {}; }
  private msgs(): Msg[] { return ((this.st() as any).messages ?? []) as Msg[]; }
}

/* ───────────── Supabase ───────────── */
class CloudBackend implements Backend {
  mode = 'cloud' as const;
  constructor(private sb: any) {}
  private async uid() { return (await this.sb.auth.getSession()).data.session?.user.id as string | undefined; }
  private need<T>(r: { data: T; error: any }): T { if (r.error) throw new Error(r.error.message || 'تعذّر تنفيذ الطلب'); return r.data; }
  private fb = (r: any): Feedback => ({ id: r.id, project_id: r.project_id, user_id: r.user_id, author: r.profiles?.display_name, rating: r.rating, comment: r.comment, images: r.images ?? [], status: r.status, created_at: r.created_at });

  async session() { const s = (await this.sb.auth.getSession()).data.session; return s ? { id: s.user.id, email: s.user.email } : null; }
  async signIn(email: string) { this.need(await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } })); }
  /** البريد يحتاج تأكيداً (وهو نفسه التحقق من الجامعة)؛ الموبايل يدخل فوراً */
  async signUp(handle: string, password: string, profile: Partial<Profile>) {
    const isPhone = /^\+?[0-9]{8,15}$/.test(handle.replace(/[\s-]/g, ''));
    const creds: any = isPhone ? { phone: handle.replace(/[\s-]/g, '') } : { email: handle.trim().toLowerCase() };
    creds.password = password;
    creds.options = { data: { display_name: profile.display_name }, emailRedirectTo: authReturn(location.origin, '/profile') };
    const r = await this.sb.auth.signUp(creds);
    if (r.error) throw new Error(mapAuthError(r.error.message));
    // لا جلسة = بانتظار تأكيد البريد، فنحفظ الملف ليُطبَّق بعد التأكيد
    if (r.data?.session) { await this.saveProfile(profile); return { needsConfirm: false }; }
    try { sessionStorage.setItem('join.pending', JSON.stringify(profile)); } catch { /* اختياري */ }
    return { needsConfirm: !isPhone };
  }
  async logIn(handle: string, password: string) {
    const h = handle.trim(), isPhone = /^\+?[0-9]{8,15}$/.test(h.replace(/[\s-]/g, ''));
    const r = await this.sb.auth.signInWithPassword(isPhone ? { phone: h.replace(/[\s-]/g, ''), password } : { email: h.toLowerCase(), password });
    if (r.error) throw new Error(mapAuthError(r.error.message));
  }
  async resetPassword(email: string) {
    const r = await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authReturn(location.origin, '/settings') });
    if (r.error) throw new Error(mapAuthError(r.error.message));
  }
  async signOut() { await this.sb.auth.signOut(); }
  async profile(id?: string) {
    const me = await this.uid(), u = id ?? me; if (!u) return null;
    // الرقم الجامعي يُقرأ لصاحب الحساب فقط
    const cols = u === me ? '*' : 'id,display_name,university,major,year,bio,role,points';
    return this.need(await this.sb.from('profiles').select(cols).eq('id', u).maybeSingle());
  }
  async saveProfile(p: Partial<Profile>) {
    const u = await this.uid(); if (!u) throw new Error('AUTH');
    const patch: any = {};
    if (p.display_name !== undefined) patch.display_name = clean(p.display_name, 40);
    if (p.referred_by !== undefined) patch.referred_by = p.referred_by || null;
    if (p.student_id !== undefined) patch.student_id = String(p.student_id ?? '').replace(/\D/g, '').slice(0, 20) || null;
    for (const k of ['university', 'major'] as const) if (p[k] !== undefined) patch[k] = clean(String(p[k] ?? ''), 60) || null;
    if (p.bio !== undefined) patch.bio = clean(String(p.bio ?? ''), 280) || null;
    if (p.year !== undefined) patch.year = p.year;
    return this.need(await this.sb.from('profiles').update(patch).eq('id', u).select().single());
  }
  async feedbackFor(pid: string) { return this.need(await this.sb.from('feedback').select('*, profiles(display_name)').eq('project_id', pid).order('created_at', { ascending: false })).map(this.fb); }
  async userFeedback(id: string) { return this.need(await this.sb.from('feedback').select('*').eq('user_id', id).eq('status', 'approved').order('created_at', { ascending: false })).map(this.fb); }
  async byUniversity(name: string) { return this.need(await this.sb.from('profiles').select('id,display_name,university,major,year,bio,role,points').ilike('university', `%${name.replace(/^جامعة\s*/, '').replace(/[%_]/g, '')}%`).order('points', { ascending: false }).limit(50)); }
  async myFeedback() { const u = await this.uid(); if (!u) return []; return this.need(await this.sb.from('feedback').select('*').eq('user_id', u).order('created_at', { ascending: false })).map(this.fb); }
  async submitFeedback(i: FeedbackInput) {
    const u = await this.uid(); if (!u) throw new Error('AUTH');
    const v = checkInput(i), urls: string[] = [];
    for (const d of v.images) {
      const path = `${u}/${crypto.randomUUID()}.jpg`;
      this.need(await this.sb.storage.from('feedback-images').upload(path, await dataUrlToBlob(d), { contentType: 'image/jpeg' }));
      urls.push(this.sb.storage.from('feedback-images').getPublicUrl(path).data.publicUrl);
    }
    const r = await this.sb.from('feedback').insert({ project_id: v.project_id, rating: v.rating, comment: v.comment, images: urls }).select().single();
    if (r.error?.code === '23505') throw new Error('كتبت فيدباك على هالمشروع من قبل');
    return this.fb(this.need(r));
  }
  async deleteFeedback(id: string) { this.need(await this.sb.from('feedback').delete().eq('id', id)); }
  async ledger() { const u = await this.uid(); if (!u) return []; return this.need(await this.sb.from('points_ledger').select('id,delta,reason,created_at').eq('user_id', u).order('created_at', { ascending: false }).limit(50)); }
  async redeem() { return this.need(await this.sb.rpc('redeem')) as string; }
  async myRedemptions() { const u = await this.uid(); if (!u) return []; return this.need(await this.sb.from('redemptions').select('*').eq('user_id', u).order('created_at', { ascending: false })); }
  async leaderboard() { return this.need(await this.sb.from('profiles').select('id,display_name,university,major,year,bio,role,points').order('points', { ascending: false }).limit(30)); }
  async isAdmin() { const p = await this.profile(); return p?.role === 'admin'; }
  async adminPendingFeedback() { return this.need(await this.sb.from('feedback').select('*, profiles(display_name)').eq('status', 'pending').order('created_at')).map(this.fb); }
  async adminModerateFeedback(id: string, status: 'approved' | 'rejected') { this.need(await this.sb.from('feedback').update({ status }).eq('id', id)); }
  async adminPendingBuildings() { return this.need(await this.sb.from('buildings').select('id,name,sign,owner_id').eq('status', 'pending')); }
  async adminModerateBuilding(id: string, status: 'approved' | 'rejected') { this.need(await this.sb.from('buildings').update({ status }).eq('id', id)); }
  async adminRedemptions() { return this.need(await this.sb.from('redemptions').select('*, profiles(display_name)').order('created_at', { ascending: false })).map((r: any) => ({ ...r, author: r.profiles?.display_name })); }
  async adminSetRedemption(id: string, status: 'used' | 'cancelled') { this.need(await this.sb.from('redemptions').update({ status }).eq('id', id)); }
  async adminAdjustPoints(userId: string, d: number, why: string) { this.need(await this.sb.rpc('admin_adjust_points', { uid: userId, d, why })); }
  async adminUsers() { return this.need(await this.sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(100)); }

  async myMessages() {
    const u = await this.uid(); if (!u) return [];
    const r = this.need(await this.sb.from('messages').select('*').eq('user_id', u).order('created_at')) as Msg[];
    // ما وصل من الإدارة صار مقروءاً بمجرد فتح الخيط
    const unread = r.filter((m) => m.from_admin && !m.read_at).map((m) => m.id);
    if (unread.length) await this.sb.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    return r;
  }
  async sendMessage(body: string) {
    const b = clean(body, 2000); if (b.length < 2) throw new Error('اكتب رسالتك');
    const u = await this.uid(); if (!u) throw new Error('AUTH');
    this.need(await this.sb.from('messages').insert({ user_id: u, body: b, from_admin: false }));
  }
  async unreadFromAdmin() {
    const u = await this.uid(); if (!u) return 0;
    const r = await this.sb.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', u).eq('from_admin', true).is('read_at', null);
    return r.count ?? 0;
  }
  async adminThreads() { return (this.need(await this.sb.rpc('admin_threads')) ?? []).map((t: any) => ({ ...t, unread: Number(t.unread) })); }
  async adminThread(userId: string) {
    const r = this.need(await this.sb.from('messages').select('*').eq('user_id', userId).order('created_at')) as Msg[];
    const unread = r.filter((m) => !m.from_admin && !m.read_at).map((m) => m.id);
    if (unread.length) await this.sb.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    return r;
  }
  async adminReply(userId: string, body: string) {
    const b = clean(body, 2000); if (b.length < 2) throw new Error('اكتب الرد');
    this.need(await this.sb.from('messages').insert({ user_id: userId, body: b, from_admin: true }));
  }
  async adminExport() {
    const tables = ['profiles', 'points_ledger', 'feedback', 'redemptions', 'projects', 'uni_posts', 'uni_replies', 'uni_moderators', 'teams', 'team_members', 'team_tasks', 'team_links', 'team_notes', 'team_activity', 'messages'];
    const out: Record<string, unknown[]> = {};
    for (const t of tables) {
      const r = await this.sb.from(t).select('*').limit(10000);
      // جدول ما رجع = صلاحيات أو غير موجود؛ بننزّل الباقي بدل ما نفشل الكل
      out[t] = r.error ? [{ __error: r.error.message }] : (r.data ?? []);
    }
    return out;
  }
  async adminSetRole(userId: string, role: 'student' | 'admin') { this.need(await this.sb.rpc('admin_set_role', { uid: userId, r: role })); }
  async adminIds() {
    const r = await this.sb.rpc('public_roles');
    return new Set<string>((r.data ?? []).map((x: any) => x.id));
  }
  async onMessages(userId: string | null, cb: () => void) {
    const uid = userId ?? (await this.uid());
    if (!uid) return () => {};
    const ch = this.sb.channel('msg:' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `user_id=eq.${uid}` }, cb)
      .subscribe();
    return () => { this.sb.removeChannel(ch); };
  }
}

let cached: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudBackend(createClient(url, key)); }
    return new LocalBackend();
  })();
  return cached;
}
/** للمعاينة التجريبية فقط */
export const localAdmin = (on: boolean) => { const b = new LocalBackend(); b.setAdmin(on); };
