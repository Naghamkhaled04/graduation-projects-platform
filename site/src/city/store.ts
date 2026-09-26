import { OFFICIAL, PLOTS, clean, type Building, type Draft } from './types';

export interface Store {
  mode: 'local' | 'cloud';
  list(): Promise<Building[]>;
  mine(): Promise<Building | null>;
  save(d: Draft): Promise<Building>;
  authed(): Promise<boolean>;
  signIn(email: string): Promise<void>;
}

const valid = (d: Draft) => {
  const name = clean(d.name, 40), sign = clean(d.sign, 28);
  if (name.length < 2 || sign.length < 2) throw new Error('اكتب اسماً ولافتة (حرفين على الأقل)');
  if (!d.projects.length) throw new Error('اختر مشروعاً واحداً على الأقل');
  return { ...d, name, sign, projects: d.projects.slice(0, 6) };
};
const freePlot = (used: Set<number>) => {
  for (let i = 0; i < PLOTS.length; i++) if (!used.has(i)) return i;
  throw new Error('المدينة ممتلئة حالياً');
};

/** يحفظ في متصفح الزائر فقط — يعمل بدون أي خادم */
class LocalStore implements Store {
  mode = 'local' as const;
  private key = 'city.mine.v1';
  private read(): Building | null { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } }
  private demo() { try { const s = JSON.parse(localStorage.getItem('community.demo.v1') || 'null'); return { points: s?.me?.points ?? 0, executed: (s?.feedback ?? []).filter((f: any) => f.status === 'approved' && f.images?.length).length }; } catch { return { points: 0, executed: 0 }; } }
  async list() { const m = this.read(); const d = this.demo(); const off = OFFICIAL.map((o) => ({ ...o, ownerName: 'فريق مشاريع', ownerPoints: 120, executed: 3 })); return m ? [...off, { ...m, ownerName: 'أنت', ownerPoints: d.points, executed: d.executed }] : off; }
  async mine() { return this.read(); }
  async authed() { return true; }
  async signIn() {}
  async save(d: Draft) {
    const v = valid(d), old = this.read();
    const b: Building = { id: old?.id ?? crypto.randomUUID(), owner: 'me', ...v, plot: old?.plot ?? freePlot(new Set(OFFICIAL.map((o) => o.plot))), status: 'approved' };
    localStorage.setItem(this.key, JSON.stringify(b));
    return b;
  }
}

/** Supabase: مباني مشتركة بين الجميع. المباني الجديدة "قيد المراجعة" حتى توافقوا عليها */
class CloudStore implements Store {
  mode = 'cloud' as const;
  constructor(private sb: any) {}
  private row = (r: any): Building => ({ id: r.id, owner: r.owner_id, name: r.name, sign: r.sign, style: r.style, color: r.color, projects: r.projects, plot: r.plot, status: r.status });
  async list() {
    const { data, error } = await this.sb.from('buildings').select('*');
    if (error) throw error;
    const ids = [...new Set<string>(data.map((r: any) => r.owner_id))]; const names: Record<string, string> = {};
    const pts: Record<string, number> = {}, exe: Record<string, number> = {};
    if (ids.length) {
      const p = await this.sb.from('profiles').select('id,display_name,points').in('id', ids); (p.data ?? []).forEach((x: any) => { names[x.id] = x.display_name; pts[x.id] = x.points; });
      const f = await this.sb.from('feedback').select('user_id,images').in('user_id', ids).eq('status', 'approved'); (f.data ?? []).forEach((x: any) => { if (x.images?.length) exe[x.user_id] = (exe[x.user_id] ?? 0) + 1; });
    }
    return [...OFFICIAL.map((o) => ({ ...o, ownerName: 'فريق مشاريع', ownerPoints: 120, executed: 3 })), ...data.map((r: any) => ({ ...this.row(r), ownerName: names[r.owner_id], ownerPoints: pts[r.owner_id] ?? 0, executed: exe[r.owner_id] ?? 0 }))];
  }
  async authed() { return !!(await this.sb.auth.getSession()).data.session; }
  async signIn(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) throw error;
  }
  async mine() {
    const s = (await this.sb.auth.getSession()).data.session; if (!s) return null;
    const { data } = await this.sb.from('buildings').select('*').eq('owner_id', s.user.id).maybeSingle();
    return data ? this.row(data) : null;
  }
  async save(d: Draft) {
    if (!(await this.authed())) throw new Error('AUTH');
    const v = valid(d), mine = await this.mine();
    const payload = { name: v.name, sign: v.sign, style: v.style, color: v.color, projects: v.projects };
    if (mine) {
      const { data, error } = await this.sb.from('buildings').update(payload).eq('id', mine.id).select().single();
      if (error) throw error; return this.row(data);
    }
    const used = new Set((await this.list()).map((b) => b.plot));
    for (let tries = 0; tries < 5; tries++) {
      const plot = freePlot(used);
      const { data, error } = await this.sb.from('buildings').insert({ ...payload, plot }).select().single();
      if (!error) return this.row(data);
      if (error.code === '23505') { used.add(plot); continue; } // القطعة انحجزت للتو
      throw error;
    }
    throw new Error('تعذّر حجز قطعة، حاول مجدداً');
  }
}

export async function createStore(): Promise<Store> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const { createClient } = await import('@supabase/supabase-js');
    return new CloudStore(createClient(url, key));
  }
  return new LocalStore();
}
