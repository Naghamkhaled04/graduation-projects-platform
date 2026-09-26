/** تفاعل المباني: إعجابات، زيارات، تعليقات. محلي للمعاينة، وسحابي عبر Supabase */
export interface Stats { likes: number; visits: number; liked: boolean }
export interface Comment { id: string; author: string; body: string; at: string; mine: boolean }
export interface Social {
  mode: 'local' | 'cloud';
  stats(ids: string[]): Promise<Record<string, Stats>>;
  toggleLike(id: string): Promise<boolean>;
  visit(id: string): Promise<void>;
  comments(id: string): Promise<Comment[]>;
  addComment(id: string, body: string): Promise<void>;
  removeComment(id: string): Promise<void>;
}

const clean = (s: string, n: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);

interface LocalState { likes: string[]; visits: Record<string, { n: number; day: string }>; comments: Record<string, Comment[]> }
class LocalSocial implements Social {
  mode = 'local' as const; private key = 'city.social.v1';
  private st(): LocalState { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s) return s; } catch { /* جديد */ } return { likes: [], visits: {}, comments: {} }; }
  private put(s: LocalState) { localStorage.setItem(this.key, JSON.stringify(s)); }
  async stats(ids: string[]) { const s = this.st(); return Object.fromEntries(ids.map((id) => [id, { likes: s.likes.includes(id) ? 1 : 0, visits: s.visits[id]?.n ?? 0, liked: s.likes.includes(id) }])); }
  async toggleLike(id: string) { const s = this.st(); const on = !s.likes.includes(id); s.likes = on ? [...s.likes, id] : s.likes.filter((x) => x !== id); this.put(s); return on; }
  async visit(id: string) { const s = this.st(), v = s.visits[id] ?? { n: 0, day: '' }; if (v.day !== today()) { v.n++; v.day = today(); } s.visits[id] = v; this.put(s); }
  async comments(id: string) { return this.st().comments[id] ?? []; }
  async addComment(id: string, body: string) {
    const b = clean(body, 200); if (b.length < 2) throw new Error('اكتب تعليقاً');
    const s = this.st(); (s.comments[id] ??= []).push({ id: crypto.randomUUID(), author: 'أنت', body: b, at: new Date().toISOString(), mine: true }); this.put(s);
  }
  async removeComment(id: string) { const s = this.st(); for (const k of Object.keys(s.comments)) s.comments[k] = s.comments[k].filter((c) => c.id !== id); this.put(s); }
}

class CloudSocial implements Social {
  mode = 'cloud' as const; constructor(private sb: any) {}
  private async uid() { return (await this.sb.auth.getSession()).data.session?.user.id as string | undefined; }
  private vkey() { try { let v = localStorage.getItem('city.vid'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('city.vid', v); } return v; } catch { return 'anon'; } }
  async stats(ids: string[]) {
    const out: Record<string, Stats> = Object.fromEntries(ids.map((id) => [id, { likes: 0, visits: 0, liked: false }]));
    const r = await this.sb.rpc('building_stats', { ids }); (r.data ?? []).forEach((x: any) => { if (out[x.building_id]) { out[x.building_id].likes = x.likes; out[x.building_id].visits = x.visits; } });
    const u = await this.uid();
    if (u) { const l = await this.sb.from('building_likes').select('building_id').eq('user_id', u).in('building_id', ids); (l.data ?? []).forEach((x: any) => { if (out[x.building_id]) out[x.building_id].liked = true; }); }
    return out;
  }
  async toggleLike(id: string) {
    const u = await this.uid(); if (!u) throw new Error('AUTH');
    const has = await this.sb.from('building_likes').select('building_id').eq('building_id', id).eq('user_id', u).maybeSingle();
    if (has.data) { await this.sb.from('building_likes').delete().eq('building_id', id).eq('user_id', u); return false; }
    const r = await this.sb.from('building_likes').insert({ building_id: id }); if (r.error) throw new Error(r.error.message); return true;
  }
  async visit(id: string) { const u = await this.uid(); await this.sb.from('building_visits').upsert({ building_id: id, visitor: u ?? this.vkey() }, { onConflict: 'building_id,visitor,day', ignoreDuplicates: true }); }
  async comments(id: string) {
    const u = await this.uid();
    const r = await this.sb.from('building_comments').select('id,body,created_at,user_id,profiles(display_name)').eq('building_id', id).order('created_at', { ascending: true }).limit(50);
    return (r.data ?? []).map((c: any) => ({ id: c.id, author: c.profiles?.display_name ?? 'طالب', body: c.body, at: c.created_at, mine: c.user_id === u }));
  }
  async addComment(id: string, body: string) {
    const b = clean(body, 200); if (b.length < 2) throw new Error('اكتب تعليقاً');
    if (!(await this.uid())) throw new Error('AUTH');
    const r = await this.sb.from('building_comments').insert({ building_id: id, body: b }); if (r.error) throw new Error(r.error.message);
  }
  async removeComment(id: string) { const r = await this.sb.from('building_comments').delete().eq('id', id); if (r.error) throw new Error(r.error.message); }
}

let cached: Promise<Social> | null = null;
export function getSocial(): Promise<Social> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudSocial(createClient(url, key)); }
    return new LocalSocial();
  })();
  return cached;
}
