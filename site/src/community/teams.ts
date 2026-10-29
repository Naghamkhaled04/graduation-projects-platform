/**
 * مساحة الفريق: أعضاء وأدوار ومهام وروابط شغل وملاحظات.
 * تتبع نفس بنية `communities.ts`: واجهة واحدة، تنفيذ محلي الآن وسحابي لاحقاً.
 * فريق التخرج يوصل جاهز — فهاي الميزة بتشتغل من الفريق الأول، بخلاف مطابقة المهارات.
 */

export type RoleKey = 'embedded' | 'hardware' | 'software' | 'data' | 'design' | 'docs' | 'test' | 'pm';

export const ROLES: { k: RoleKey; label: string; hint: string; icon: string }[] = [
  { k: 'embedded', label: 'البرمجة المدمجة', hint: 'كود المتحكم والحساسات', icon: 'ai' },
  { k: 'hardware', label: 'الإلكترونيات والتجميع', hint: 'التوصيل واللحام والعلبة', icon: 'flask' },
  { k: 'software', label: 'البرمجة والواجهات', hint: 'التطبيق أو الموقع أو اللوحة', icon: 'box' },
  { k: 'data', label: 'البيانات والذكاء', hint: 'النماذج والتحليل والقياس', icon: 'chart' },
  { k: 'design', label: 'التصميم والعرض', hint: 'الشرائح والمجسم والفيديو', icon: 'eye' },
  { k: 'docs', label: 'التوثيق والتقرير', hint: 'التقرير والمراجع والمخططات', icon: 'building' },
  { k: 'test', label: 'الاختبار والقياس', hint: 'التجارب والنتائج والأرقام', icon: 'medal' },
  { k: 'pm', label: 'التنسيق والمواعيد', hint: 'المهام والتسليم والتواصل', icon: 'chat' },
];
export const roleLabel = (k: string) => ROLES.find((r) => r.k === k)?.label ?? k;
export const roleIcon = (k: string) => ROLES.find((r) => r.k === k)?.icon ?? 'box';

export type TaskStatus = 'todo' | 'doing' | 'done';
export const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'للعمل', doing: 'شغّال عليها', done: 'خلصت' };
/** الدورة عند الضغط: للعمل ← شغّال ← خلصت ← للعمل */
export const nextStatus = (s: TaskStatus): TaskStatus => (s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo');

export interface Member { id: string; name: string; roles: RoleKey[]; skills: string[]; wants: string[]; me?: boolean }
export interface Note { id: string; author: string; body: string; created_at: string }
export interface WorkLink { id: string; title: string; url: string; author: string; created_at: string; notes: Note[] }
export interface Task { id: string; title: string; assignee: string | null; status: TaskStatus; due: string | null; created_at: string }
export interface Act { id: string; who: string; what: string; at: string }
export interface Team {
  id: string; name: string; project: string | null;
  members: Member[]; tasks: Task[]; links: WorkLink[]; activity: Act[];
}

/** الأدوار اللي ما غطّاها حدا — أساس اقتراح «شو ناقص الفريق» بدون أي نموذج ذكاء */
export const missingRoles = (t: Team): RoleKey[] => {
  const taken = new Set(t.members.flatMap((m) => m.roles));
  return ROLES.map((r) => r.k).filter((k) => !taken.has(k));
};
/** المهارات اللي طلبها أعضاء الفريق وما حدا فيهم بيتقنها */
export const missingSkills = (t: Team): string[] => {
  const have = new Set(t.members.flatMap((m) => m.skills.map((s) => s.trim().toLowerCase())).filter(Boolean));
  const want = t.members.flatMap((m) => m.wants.map((s) => s.trim())).filter(Boolean);
  return [...new Set(want.filter((w) => !have.has(w.toLowerCase())))];
};
export const progress = (t: Team) => {
  const n = t.tasks.length;
  return { done: t.tasks.filter((x) => x.status === 'done').length, total: n };
};

export interface Teams {
  mode: 'local' | 'cloud';
  get(): Promise<Team | null>;
  create(name: string, project: string | null, myName: string): Promise<Team>;
  leave(): Promise<void>;
  addMember(name: string): Promise<void>;
  removeMember(id: string): Promise<void>;
  setMember(id: string, patch: Partial<Pick<Member, 'roles' | 'skills' | 'wants'>>): Promise<void>;
  addTask(title: string, assignee: string | null, due: string | null): Promise<void>;
  setTask(id: string, patch: Partial<Pick<Task, 'status' | 'assignee' | 'due' | 'title'>>): Promise<void>;
  removeTask(id: string): Promise<void>;
  addLink(title: string, url: string): Promise<void>;
  removeLink(id: string): Promise<void>;
  addNote(linkId: string, body: string): Promise<void>;
}

const clean = (s: string, n: number) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (s: string) => clean(s, 240).split(/[،,]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** رابط صالح فقط: بنرفض أي شي مش http/https حتى ما ينحط javascript: برابط */
export function safeUrl(raw: string): string | null {
  const v = raw.trim();
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null; }
  catch { return null; }
}

class LocalTeams implements Teams {
  mode = 'local' as const;
  private key = 'team.local.v1';
  private st(): Team | null { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } }
  private put(t: Team | null) { t ? localStorage.setItem(this.key, JSON.stringify(t)) : localStorage.removeItem(this.key); }
  private me(t: Team) { return t.members.find((m) => m.me)?.name ?? 'أنت'; }
  private log(t: Team, what: string) {
    t.activity.unshift({ id: uid(), who: this.me(t), what, at: now() });
    t.activity = t.activity.slice(0, 40);
  }
  private edit(fn: (t: Team) => void) {
    const t = this.st(); if (!t) throw new Error('ما في فريق');
    fn(t); this.put(t);
  }

  async get() { return this.st(); }
  async create(name: string, project: string | null, myName: string) {
    const t: Team = {
      id: uid(), name: clean(name, 60) || 'فريقي', project,
      members: [{ id: uid(), name: clean(myName, 40) || 'أنت', roles: [], skills: [], wants: [], me: true }],
      tasks: [], links: [], activity: [],
    };
    this.log(t, 'أنشأ الفريق');
    this.put(t); return t;
  }
  async leave() { this.put(null); }
  async addMember(name: string) {
    const n = clean(name, 40); if (n.length < 2) throw new Error('اكتب اسم العضو');
    this.edit((t) => {
      if (t.members.length >= 8) throw new Error('الحد ٨ أعضاء');
      t.members.push({ id: uid(), name: n, roles: [], skills: [], wants: [] });
      this.log(t, `أضاف ${n} للفريق`);
    });
  }
  async removeMember(id: string) {
    this.edit((t) => {
      const m = t.members.find((x) => x.id === id);
      if (m?.me) throw new Error('ما بتقدر تشيل حالك — استعمل «غادر الفريق»');
      t.members = t.members.filter((x) => x.id !== id);
      t.tasks.forEach((x) => { if (x.assignee === id) x.assignee = null; });
      if (m) this.log(t, `شال ${m.name} من الفريق`);
    });
  }
  async setMember(id: string, patch: Partial<Pick<Member, 'roles' | 'skills' | 'wants'>>) {
    this.edit((t) => {
      const m = t.members.find((x) => x.id === id); if (!m) return;
      if (patch.roles) m.roles = patch.roles.slice(0, 4);
      if (patch.skills) m.skills = patch.skills;
      if (patch.wants) m.wants = patch.wants;
      this.log(t, `حدّث دور ${m.name}`);
    });
  }
  async addTask(title: string, assignee: string | null, due: string | null) {
    const ti = clean(title, 120); if (ti.length < 3) throw new Error('اكتب المهمة');
    this.edit((t) => {
      t.tasks.unshift({ id: uid(), title: ti, assignee, status: 'todo', due: due || null, created_at: now() });
      this.log(t, `أضاف مهمة: ${ti}`);
    });
  }
  async setTask(id: string, patch: Partial<Pick<Task, 'status' | 'assignee' | 'due' | 'title'>>) {
    this.edit((t) => {
      const k = t.tasks.find((x) => x.id === id); if (!k) return;
      Object.assign(k, patch);
      if (patch.status === 'done') this.log(t, `خلّص: ${k.title}`);
    });
  }
  async removeTask(id: string) { this.edit((t) => { t.tasks = t.tasks.filter((x) => x.id !== id); }); }
  async addLink(title: string, url: string) {
    const u = safeUrl(url); if (!u) throw new Error('الرابط لازم يبلّش بـ http أو https');
    const ti = clean(title, 100) || 'رابط شغل';
    this.edit((t) => {
      t.links.unshift({ id: uid(), title: ti, url: u, author: this.me(t), created_at: now(), notes: [] });
      this.log(t, `رفع رابط: ${ti}`);
    });
  }
  async removeLink(id: string) { this.edit((t) => { t.links = t.links.filter((x) => x.id !== id); }); }
  async addNote(linkId: string, body: string) {
    const b = clean(body, 400); if (b.length < 2) throw new Error('اكتب ملاحظتك');
    this.edit((t) => {
      const l = t.links.find((x) => x.id === linkId); if (!l) return;
      l.notes.push({ id: uid(), author: this.me(t), body: b, created_at: now() });
      this.log(t, `علّق على: ${l.title}`);
    });
  }
}

/** نفس الواجهة على سوبابيس. الصلاحيات بالقاعدة (RLS): الفريق يرى شغله وحده */
class CloudTeams implements Teams {
  mode = 'cloud' as const;
  constructor(private sb: any) {}
  private need<T>(r: { data: T; error: any }): T { if (r.error) throw new Error(r.error.message); return r.data; }
  private async uid() { return (await this.sb.auth.getSession()).data.session?.user.id as string | undefined; }
  private async teamId() { return (await this.sb.rpc('my_team')).data as string | null; }
  private async me(t: Team) { const u = await this.uid(); return t.members.find((m) => m.id === u || m.me)?.name ?? 'أنت'; }
  private async log(team_id: string, what: string, who: string) {
    await this.sb.from('team_activity').insert({ team_id, who, what });
  }
  /** كل شي بنداء واحد: الفريق وأعضاؤه ومهامه وروابطه وملاحظاتها وسجلّه */
  async get(): Promise<Team | null> {
    const id = await this.teamId(); if (!id) return null;
    const u = await this.uid();
    const [t, mem, tasks, links, act] = await Promise.all([
      this.sb.from('teams').select('*').eq('id', id).single(),
      this.sb.from('team_members').select('*').eq('team_id', id).order('joined_at'),
      this.sb.from('team_tasks').select('*').eq('team_id', id).order('created_at', { ascending: false }),
      this.sb.from('team_links').select('*,team_notes(*)').eq('team_id', id).order('created_at', { ascending: false }),
      this.sb.from('team_activity').select('*').eq('team_id', id).order('at', { ascending: false }).limit(40),
    ]);
    const row = this.need(t);
    return {
      id: row.id, name: row.name, project: row.project,
      members: (mem.data ?? []).map((m: any) => ({
        id: m.id, name: m.name, roles: m.roles ?? [], skills: m.skills ?? [], wants: m.wants ?? [],
        ...(m.user_id && m.user_id === u ? { me: true } : {}),
      })),
      tasks: (tasks.data ?? []).map((k: any) => ({
        id: k.id, title: k.title, assignee: k.assignee, status: k.status, due: k.due, created_at: k.created_at,
      })),
      links: (links.data ?? []).map((l: any) => ({
        id: l.id, title: l.title, url: l.url, author: l.author, created_at: l.created_at,
        notes: (l.team_notes ?? []).slice().sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
          .map((n: any) => ({ id: n.id, author: n.author, body: n.body, created_at: n.created_at })),
      })),
      activity: (act.data ?? []).map((a: any) => ({ id: a.id, who: a.who, what: a.what, at: a.at })),
    };
  }
  async create(name: string, project: string | null, myName: string) {
    if (!(await this.uid())) throw new Error('AUTH');
    const n = clean(name, 60) || 'فريقي', who = clean(myName, 40) || 'أنت';
    this.need(await this.sb.rpc('create_team', { nm: n, proj: project, my_name: who }));
    return (await this.get())!;
  }
  /** المغادرة = حذف صفّي أنا. آخر عضو يغادر ينحذف الفريق معه (trigger) */
  async leave() {
    const u = await this.uid(); if (!u) return;
    this.need(await this.sb.from('team_members').delete().eq('user_id', u));
  }
  async addMember(name: string) {
    const n = clean(name, 40); if (n.length < 2) throw new Error('اكتب اسم العضو');
    const id = await this.teamId(); if (!id) throw new Error('ما في فريق');
    this.need(await this.sb.from('team_members').insert({ team_id: id, name: n }));
    await this.log(id, `أضاف ${n} للفريق`, await this.me((await this.get())!));
  }
  async removeMember(id: string) {
    const u = await this.uid();
    const m = (await this.sb.from('team_members').select('user_id,name').eq('id', id).single()).data;
    if (m?.user_id && m.user_id === u) throw new Error('ما بتقدر تشيل حالك — استعمل «غادر الفريق»');
    this.need(await this.sb.from('team_members').delete().eq('id', id));
  }
  async setMember(id: string, patch: Partial<Pick<Member, 'roles' | 'skills' | 'wants'>>) {
    const p: any = {};
    if (patch.roles) p.roles = patch.roles.slice(0, 4);
    if (patch.skills) p.skills = patch.skills;
    if (patch.wants) p.wants = patch.wants;
    this.need(await this.sb.from('team_members').update(p).eq('id', id));
  }
  async addTask(title: string, assignee: string | null, due: string | null) {
    const ti = clean(title, 120); if (ti.length < 3) throw new Error('اكتب المهمة');
    const id = await this.teamId(); if (!id) throw new Error('ما في فريق');
    this.need(await this.sb.from('team_tasks').insert({ team_id: id, title: ti, assignee, due: due || null }));
    await this.log(id, `أضاف مهمة: ${ti}`, await this.me((await this.get())!));
  }
  async setTask(id: string, patch: Partial<Pick<Task, 'status' | 'assignee' | 'due' | 'title'>>) {
    this.need(await this.sb.from('team_tasks').update(patch).eq('id', id));
    if (patch.status === 'done') {
      const t = (await this.get())!;
      await this.log(t.id, `خلّص: ${t.tasks.find((x) => x.id === id)?.title ?? 'مهمة'}`, await this.me(t));
    }
  }
  async removeTask(id: string) { this.need(await this.sb.from('team_tasks').delete().eq('id', id)); }
  async addLink(title: string, url: string) {
    const u = safeUrl(url); if (!u) throw new Error('الرابط لازم يبلّش بـ http أو https');
    const t = await this.get(); if (!t) throw new Error('ما في فريق');
    const ti = clean(title, 100) || 'رابط شغل', who = await this.me(t);
    this.need(await this.sb.from('team_links').insert({ team_id: t.id, title: ti, url: u, author: who }));
    await this.log(t.id, `رفع رابط: ${ti}`, who);
  }
  async removeLink(id: string) { this.need(await this.sb.from('team_links').delete().eq('id', id)); }
  async addNote(linkId: string, body: string) {
    const b = clean(body, 400); if (b.length < 2) throw new Error('اكتب ملاحظتك');
    const t = await this.get(); if (!t) throw new Error('ما في فريق');
    const who = await this.me(t);
    this.need(await this.sb.from('team_notes').insert({ link_id: linkId, author: who, body: b }));
    await this.log(t.id, `علّق على: ${t.links.find((l) => l.id === linkId)?.title ?? 'رابط'}`, who);
  }
}

let cached: Promise<Teams> | null = null;
export function getTeams(): Promise<Teams> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudTeams(createClient(url, key)); }
    return new LocalTeams();
  })();
  return cached;
}
