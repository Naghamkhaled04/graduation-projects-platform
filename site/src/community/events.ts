import type { RoleKey } from './teams';

/**
 * مسابقات وإيفنتات: TFC بتنشرها، والطلاب بيسجّلوا بفريقهم أو بيطلبوا نشكّلهم فريق،
 * وTFC بتشكّل الفرق حسب الأدوار (scripts/teammatch.js).
 * نفس بنية communities.ts: واجهة وحدة، تنفيذ محلي (تجريبي) وسحابي.
 */
export interface EventItem {
  id: string; kind: 'competition' | 'event'; title: string; body: string;
  starts_on: string; signup_by: string | null; place: string; team_size: number; skills: string[]; created_at: string;
}
export interface Signup {
  event_id: string; user_id: string; name?: string; mode: 'team' | 'match';
  team_name: string | null; roles: RoleKey[]; skills: string[]; team_no: number | null; created_at: string;
}
export type EventInput = Pick<EventItem, 'kind' | 'title' | 'body' | 'starts_on' | 'signup_by' | 'place' | 'team_size' | 'skills'>;
export type SignupInput = Pick<Signup, 'mode' | 'team_name' | 'roles' | 'skills'>;

export const KIND_LABEL = { competition: 'مسابقة', event: 'إيفنت' } as const;

export interface Events {
  mode: 'local' | 'cloud';
  list(): Promise<EventItem[]>;
  /** لـTFC بس (الصلاحية بالقاعدة بالسحابي) */
  add(e: EventInput): Promise<void>;
  remove(id: string): Promise<void>;
  mySignup(eventId: string): Promise<Signup | null>;
  signup(eventId: string, s: SignupInput): Promise<void>;
  cancel(eventId: string): Promise<void>;
  /** لـTFC: كل التسجيلات، واعتماد الفرق (رقم فريق لكل مسجّل) */
  signups(eventId: string): Promise<Signup[]>;
  setTeams(eventId: string, teams: string[][]): Promise<void>;
  /** أعضاء فريقي بهالمسابقة بعد ما TFC تشكّله */
  teammates(eventId: string): Promise<{ name: string; roles: RoleKey[] }[]>;
}

const clean = (s: string, n: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (s: string[] | string) => (Array.isArray(s) ? s : s.split(/[،,]/)).map((x) => clean(x, 40)).filter(Boolean).slice(0, 8);
function checkEvent(e: EventInput): EventInput {
  const title = clean(e.title, 120), body = e.body.replace(/[<>]/g, '').trim().slice(0, 1500);
  if (title.length < 4) throw new Error('اكتب اسم المسابقة');
  if (!e.starts_on) throw new Error('حدّد التاريخ');
  return { ...e, title, body, place: clean(e.place, 80), skills: list(e.skills), team_size: Math.min(8, Math.max(2, e.team_size | 0 || 3)) };
}
function checkSignup(s: SignupInput): SignupInput {
  if (s.mode === 'team' && clean(s.team_name ?? '', 60).length < 2) throw new Error('اكتب اسم فريقك');
  if (s.mode === 'match' && !s.roles.length) throw new Error('اختار دور واحد على الأقل');
  return { mode: s.mode, team_name: s.mode === 'team' ? clean(s.team_name!, 60) : null, roles: s.roles.slice(0, 4), skills: list(s.skills) };
}

interface LocalState { events: EventItem[]; signups: Signup[] }
class LocalEvents implements Events {
  mode = 'local' as const; private key = 'events.local.v1';
  private st(): LocalState { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s) return s; } catch { /* جديد */ } return { events: [], signups: [] }; }
  private put(s: LocalState) { localStorage.setItem(this.key, JSON.stringify(s)); }
  private me() { try { return JSON.parse(localStorage.getItem('community.demo.v1') || 'null')?.me ?? null; } catch { return null; } }
  async list() { return this.st().events.slice().sort((a, b) => (a.starts_on < b.starts_on ? -1 : 1)); }
  async add(e: EventInput) { const s = this.st(); s.events.push({ ...checkEvent(e), id: crypto.randomUUID(), created_at: new Date().toISOString() }); this.put(s); }
  async remove(id: string) { const s = this.st(); s.events = s.events.filter((x) => x.id !== id); s.signups = s.signups.filter((x) => x.event_id !== id); this.put(s); }
  async mySignup(eventId: string) { return this.st().signups.find((x) => x.event_id === eventId && x.user_id === 'me') ?? null; }
  async signup(eventId: string, v: SignupInput) {
    const s = this.st(); s.signups = s.signups.filter((x) => !(x.event_id === eventId && x.user_id === 'me'));
    s.signups.push({ ...checkSignup(v), event_id: eventId, user_id: 'me', name: this.me()?.display_name ?? 'أنت', team_no: null, created_at: new Date().toISOString() });
    this.put(s);
  }
  async cancel(eventId: string) { const s = this.st(); s.signups = s.signups.filter((x) => !(x.event_id === eventId && x.user_id === 'me')); this.put(s); }
  async signups(eventId: string) { return this.st().signups.filter((x) => x.event_id === eventId); }
  async setTeams(eventId: string, teams: string[][]) {
    const s = this.st();
    for (const x of s.signups) if (x.event_id === eventId) { const i = teams.findIndex((t) => t.includes(x.user_id)); x.team_no = i < 0 ? null : i + 1; }
    this.put(s);
  }
  async teammates(eventId: string) {
    const s = this.st(), me = s.signups.find((x) => x.event_id === eventId && x.user_id === 'me');
    if (!me?.team_no) return [];
    return s.signups.filter((x) => x.event_id === eventId && x.team_no === me.team_no && x.user_id !== 'me').map((x) => ({ name: x.name ?? 'طالب', roles: x.roles }));
  }
}

class CloudEvents implements Events {
  mode = 'cloud' as const; constructor(private sb: any) {}
  private need<T>(r: { data: T; error: any }): T { if (r.error) throw new Error(r.error.message); return r.data; }
  private async uid() { return (await this.sb.auth.getSession()).data.session?.user.id as string | undefined; }
  async list() { return this.need(await this.sb.from('events').select('*').order('starts_on')) as EventItem[]; }
  async add(e: EventInput) { this.need(await this.sb.from('events').insert(checkEvent(e))); }
  async remove(id: string) { this.need(await this.sb.from('events').delete().eq('id', id)); }
  async mySignup(eventId: string) {
    const u = await this.uid(); if (!u) return null;
    return (this.need(await this.sb.from('event_signups').select('*').eq('event_id', eventId).eq('user_id', u)) as Signup[])[0] ?? null;
  }
  async signup(eventId: string, v: SignupInput) {
    if (!(await this.uid())) throw new Error('AUTH');
    this.need(await this.sb.from('event_signups').upsert({ ...checkSignup(v), event_id: eventId }, { onConflict: 'event_id,user_id' }));
  }
  async cancel(eventId: string) { const u = await this.uid(); this.need(await this.sb.from('event_signups').delete().eq('event_id', eventId).eq('user_id', u)); }
  async signups(eventId: string) {
    const r = this.need(await this.sb.from('event_signups').select('*,profiles(display_name)').eq('event_id', eventId).order('created_at')) as any[];
    return r.map((x) => ({ ...x, name: x.profiles?.display_name }));
  }
  async setTeams(eventId: string, teams: string[][]) {
    this.need(await this.sb.rpc('set_event_teams', { e: eventId, teams: teams.map((t, i) => ({ no: i + 1, ids: t })) }));
  }
  async teammates(eventId: string) { return this.need(await this.sb.rpc('event_teammates', { e: eventId })) as { name: string; roles: RoleKey[] }[]; }
}

let cached: Promise<Events> | null = null;
export function getEvents(): Promise<Events> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudEvents(createClient(url, key)); }
    return new LocalEvents();
  })();
  return cached;
}
