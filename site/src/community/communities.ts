import { UNIVERSITIES } from '../data/universities';

/** مجتمع جامعة: منشورات الطلاب وردودها، ومشرف من نفس الجامعة */
export interface Post {
  id: string; uni: string; user_id: string; author?: string; kind: PostKind;
  title: string; body: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; replies: number;
  /** لمنشورات موعد التسليم */
  due?: string | null;
}
export interface Reply { id: string; post_id: string; user_id: string; author?: string; body: string; created_at: string; mine: boolean }
export type PostKind = 'question' | 'showcase' | 'partner' | 'resource' | 'deadline' | 'request';

export const KINDS: { k: PostKind; label: string; icon: string; hint: string; modOnly?: boolean }[] = [
  { k: 'question', label: 'سؤال تقني', icon: 'chat', hint: 'علقت بمشكلة؟ اسأل زملاءك بجامعتك' },
  { k: 'showcase', label: 'شغلي', icon: 'camera', hint: 'اعرض مشروعك أو تقدّمك' },
  { k: 'partner', label: 'أدوّر على شريك', icon: 'medal', hint: 'فريق مشروع تخرج، أو حدا يشاركك القطع' },
  { k: 'resource', label: 'مصدر مفيد', icon: 'flask', hint: 'مكتبة، مرجع، مكان يبيع قطع، أو تجربة مع مدرّس' },
  { k: 'deadline', label: 'موعد تسليم', icon: 'medal', hint: 'تسليم، مناقشة، أو معرض بجامعتك — بيوصل تنبيه لأعضاء مجتمعك', modOnly: true },
  { k: 'request', label: 'بدي تعديل على مشروع', icon: 'send', hint: 'بدك تغيّر قطعة أو تضيف ميزة؟ اطلب وبنرد عليك بالسعر والمدة' },
];
/** أنواع يكتبها المشرف فقط (لأنها تولّد تنبيهات للجميع) */
export const MOD_ONLY: PostKind[] = ['deadline'];
export const kindLabel = (k: string) => KINDS.find((x) => x.k === k)?.label ?? k;
export const kindIcon = (k: string) => KINDS.find((x) => x.k === k)?.icon ?? 'chat';
export const uniName = (slug: string) => UNIVERSITIES.find((u) => u.slug === slug)?.name ?? slug;

const clean = (s: string, n: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const check = (title: string, body: string) => {
  const t = clean(title, 100), b = clean(body, 1200);
  if (t.length < 6) throw new Error('العنوان قصير (٦ أحرف على الأقل)');
  if (b.length < 15) throw new Error('اكتب تفاصيل أكثر (١٥ حرفاً على الأقل)');
  return { t, b };
};

export interface Communities {
  mode: 'local' | 'cloud';
  /** عدد الأعضاء المنشور لكل جامعة */
  counts(): Promise<Record<string, number>>;
  posts(uni: string): Promise<Post[]>;
  addPost(uni: string, kind: PostKind, title: string, body: string, due?: string | null): Promise<void>;
  /** منشورات لم يرها الطالب بعد (مواعيد وردود على منشوراته) */
  unseen(uni: string): Promise<Post[]>;
  markSeen(uni: string): Promise<void>;
  replies(postId: string): Promise<Reply[]>;
  addReply(postId: string, body: string): Promise<void>;
  /** المشرف على هذه الجامعة (أو الأدمن العام) */
  canModerate(uni: string): Promise<boolean>;
  moderators(uni: string): Promise<{ id: string; name: string }[]>;
  moderate(postId: string, status: 'approved' | 'rejected'): Promise<void>;
  removeReply(id: string): Promise<void>;
  /** طلب أن يكون مشرفاً: يصل للأدمن ليوافق */
  applyModerator(uni: string, why: string): Promise<void>;

  /** للأدمن: كل المنشورات المعلّقة بكل المساحات، ولوحة طلبات الإشراف */
  allPending(): Promise<Post[]>;
  modApplications(): Promise<{ uni: string; user_id: string; name: string; why: string | null; created_at: string }[]>;
  setModerator(uni: string, userId: string, status: 'active' | 'rejected'): Promise<void>;
}

interface LocalState { posts: Post[]; replies: Reply[]; mod: string[] }
class LocalCommunities implements Communities {
  mode = 'local' as const; private key = 'communities.local.v1';
  private st(): LocalState { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s) return s; } catch { /* جديد */ } return { posts: [], replies: [], mod: [] }; }
  private put(s: LocalState) { localStorage.setItem(this.key, JSON.stringify(s)); }
  private me() { try { return JSON.parse(localStorage.getItem('community.demo.v1') || 'null')?.me ?? null; } catch { return null; } }
  async counts() { const u = this.me()?.university; return u ? { [u]: 1 } : {}; }
  async posts(uni: string) { const s = this.st(); return s.posts.filter((p) => p.uni === uni).map((p) => ({ ...p, replies: s.replies.filter((r) => r.post_id === p.id).length })).reverse(); }
  async addPost(uni: string, kind: PostKind, title: string, body: string, due?: string | null) {
    const { t, b } = check(title, body), s = this.st();
    s.posts.push({ id: crypto.randomUUID(), uni, user_id: 'me', author: this.me()?.display_name ?? 'أنت', kind, title: t, body: b, status: 'pending', created_at: new Date().toISOString(), replies: 0, due: due || null });
    this.put(s);
  }
  async unseen(uni: string) { const seen = localStorage.getItem('com.seen.' + uni) ?? ''; return (await this.posts(uni)).filter((p) => p.status === 'approved' && p.created_at > seen); }
  async markSeen(uni: string) { localStorage.setItem('com.seen.' + uni, new Date().toISOString()); }
  async replies(postId: string) { return this.st().replies.filter((r) => r.post_id === postId); }
  async addReply(postId: string, body: string) {
    const b = clean(body, 600); if (b.length < 2) throw new Error('اكتب رداً');
    const s = this.st(); s.replies.push({ id: crypto.randomUUID(), post_id: postId, user_id: 'me', author: this.me()?.display_name ?? 'أنت', body: b, created_at: new Date().toISOString(), mine: true }); this.put(s);
  }
  async canModerate(uni: string) { return this.me()?.role === 'admin' || this.st().mod.includes(uni); }
  async moderators() { return []; }
  async moderate(id: string, status: 'approved' | 'rejected') { const s = this.st(); const p = s.posts.find((x) => x.id === id); if (p) p.status = status; this.put(s); }
  async removeReply(id: string) { const s = this.st(); s.replies = s.replies.filter((r) => r.id !== id); this.put(s); }
  async applyModerator(uni: string) { const s = this.st(); if (!s.mod.includes(uni)) s.mod.push(uni); this.put(s); }
  async allPending() { return this.st().posts.filter((p) => p.status === 'pending'); }
  async modApplications() { return []; }
  async setModerator() {}
  /** للمعاينة فقط: تفعيل الإشراف بالوضع التجريبي */
  demoMod(uni: string, on: boolean) { const s = this.st(); s.mod = on ? [...new Set([...s.mod, uni])] : s.mod.filter((x) => x !== uni); this.put(s); }
}

class CloudCommunities implements Communities {
  mode = 'cloud' as const; constructor(private sb: any) {}
  private async uid() { return (await this.sb.auth.getSession()).data.session?.user.id as string | undefined; }
  private need<T>(r: { data: T; error: any }): T { if (r.error) throw new Error(r.error.message); return r.data; }
  async counts() {
    const r = await this.sb.rpc('community_counts');
    return Object.fromEntries((r.data ?? []).map((x: any) => [x.uni, Number(x.n)]));
  }
  async posts(uni: string) {
    const r = this.need(await this.sb.from('uni_posts').select('*,profiles(display_name)').eq('uni', uni).order('created_at', { ascending: false }).limit(60));
    return (r as any[]).map((p) => ({ ...p, author: p.profiles?.display_name, replies: p.reply_count ?? 0 }));
  }
  async addPost(uni: string, kind: PostKind, title: string, body: string, due?: string | null) {
    const { t, b } = check(title, body);
    if (!(await this.uid())) throw new Error('AUTH');
    this.need(await this.sb.from('uni_posts').insert({ uni, kind, title: t, body: b, due: due || null }));
  }
  async unseen(uni: string) {
    const seen = localStorage.getItem('com.seen.' + uni) ?? new Date(Date.now() - 6048e5).toISOString();
    const r = await this.sb.from('uni_posts').select('*,profiles(display_name)').eq('uni', uni).eq('status', 'approved').gt('created_at', seen).order('created_at', { ascending: false }).limit(20);
    return (r.data ?? []).map((p: any) => ({ ...p, author: p.profiles?.display_name, replies: p.reply_count ?? 0 }));
  }
  async markSeen(uni: string) { localStorage.setItem('com.seen.' + uni, new Date().toISOString()); }
  async replies(postId: string) {
    const u = await this.uid();
    const r = this.need(await this.sb.from('uni_replies').select('id,post_id,body,created_at,user_id,profiles(display_name)').eq('post_id', postId).order('created_at'));
    return (r as any[]).map((x) => ({ id: x.id, post_id: x.post_id, user_id: x.user_id, author: x.profiles?.display_name ?? 'طالب', body: x.body, created_at: x.created_at, mine: x.user_id === u }));
  }
  async addReply(postId: string, body: string) {
    const b = clean(body, 600); if (b.length < 2) throw new Error('اكتب رداً');
    if (!(await this.uid())) throw new Error('AUTH');
    this.need(await this.sb.from('uni_replies').insert({ post_id: postId, body: b }));
  }
  async canModerate(uni: string) { const r = await this.sb.rpc('is_moderator_of', { u: uni }); return r.data === true; }
  async moderators(uni: string) {
    const r = await this.sb.from('uni_moderators').select('user_id,profiles(display_name)').eq('uni', uni).eq('status', 'active');
    return (r.data ?? []).map((x: any) => ({ id: x.user_id, name: x.profiles?.display_name ?? 'مشرف' }));
  }
  async moderate(id: string, status: 'approved' | 'rejected') { this.need(await this.sb.from('uni_posts').update({ status }).eq('id', id)); }
  async removeReply(id: string) { this.need(await this.sb.from('uni_replies').delete().eq('id', id)); }
  async applyModerator(uni: string, why: string) {
    if (!(await this.uid())) throw new Error('AUTH');
    this.need(await this.sb.from('uni_moderators').upsert({ uni, why: clean(why, 400), status: 'pending' }, { onConflict: 'uni,user_id' }));
  }
  async allPending() {
    const r = this.need(await this.sb.from('uni_posts').select('*,profiles(display_name)').eq('status', 'pending').order('created_at').limit(200));
    return (r as any[]).map((p) => ({ ...p, author: p.profiles?.display_name, replies: p.reply_count ?? 0 }));
  }
  async modApplications() {
    const r = await this.sb.from('uni_moderators').select('uni,user_id,why,created_at,profiles(display_name)').eq('status', 'pending').order('created_at');
    return (r.data ?? []).map((x: any) => ({ uni: x.uni, user_id: x.user_id, name: x.profiles?.display_name ?? 'طالب', why: x.why, created_at: x.created_at }));
  }
  async setModerator(uni: string, userId: string, status: 'active' | 'rejected') {
    this.need(await this.sb.from('uni_moderators').update({ status }).eq('uni', uni).eq('user_id', userId));
  }
}

let cached: Promise<Communities> | null = null;
export function getCommunities(): Promise<Communities> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudCommunities(createClient(url, key)); }
    return new LocalCommunities();
  })();
  return cached;
}
export const demoMod = async (uni: string, on: boolean) => { const c = await getCommunities(); if (c instanceof LocalCommunities) c.demoMod(uni, on); };
