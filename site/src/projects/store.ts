import { registerModel, guessKind, KINDS, type Kind, type ModelSpec } from '../model/spec';
import staticProjects from '../data/projects.json';
import { DOMAIN_KEYS, tagsOf } from '../data/taxonomy';
import details from '../data/details.json';

export interface PartOpt { k: string; nm: string; d: string; p: number; def?: boolean }
export interface PartDoc { id: string; nm: string; kind: Kind; req: boolean; qty: number; opts: PartOpt[] }
export interface ExtraDoc { k: string; nm: string; d: string; p: number }
export interface ProjectDoc {
  id: string; title: string; level: 'سهل' | 'متوسط' | 'متقدم'; cat: string; tags?: string[]; desc: string; problem: string;
  steps: [string, string][]; feats: string[]; chals: string[]; parts: PartDoc[]; extras: ExtraDoc[];
  exclusive: boolean; range: string; model: ModelSpec | null; status: 'draft' | 'published' | 'hidden'; updated_at?: string;
}

export const LEVEL_KEY = { 'سهل': 'e', 'متوسط': 'm', 'متقدم': 'h' } as const;
export const CATS = DOMAIN_KEYS;
export const emptyDoc = (): ProjectDoc => ({ id: '', title: '', level: 'متوسط', cat: 'بيوت ومدن ذكية', tags: ['بيوت ومدن ذكية'], desc: '', problem: '', steps: [], feats: [], chals: [], parts: [], extras: [], exclusive: false, range: '', model: null, status: 'draft' });

const KIND_BY_CAT: Record<string, Kind> = { microcontroller: 'mcu', 'sensor-and-module': 'sensor', display: 'display', motor: 'motor', power: 'power' };
const pickKind = (name: string, cat?: string): Kind => { const k = guessKind(name); return k === 'other' && cat && KIND_BY_CAT[cat] ? KIND_BY_CAT[cat] : k; };

/** يبني مسودة قابلة للتعديل من مشروع ثابت موجود */
export function docFromStatic(id: string): ProjectDoc | null {
  const p: any = (staticProjects as any[]).find((x) => x.id === id); if (!p) return null;
  const d: any = (details as any)[id] ?? {};
  const parts: PartDoc[] = (d.parts?.length ? d.parts : (p.bom ?? []).map((r: any, i: number) => ({ id: `b${i}`, nm: r[0], req: true, qty: 1, opts: [{ k: 'x', nm: r[0], d: '', p: 0, def: true }] })))
    .map((x: any) => ({ id: x.id, nm: x.nm, kind: pickKind(x.opts?.[0]?.nm ?? x.nm, x.cat), req: !!x.req, qty: x.qty ?? 1, opts: x.opts }));
  return { ...emptyDoc(), id, title: p.t, level: p.ln, cat: p.c, tags: tagsOf(id), desc: p.d, problem: d.problem || p.prob, steps: d.steps ?? [], feats: d.feats?.length ? d.feats : p.feat, chals: d.chals ?? [], parts, extras: d.extras ?? [], exclusive: !!p.x, range: d.range ?? '', model: null, status: 'draft' };
}

export const costOf = (d: ProjectDoc) => d.parts.reduce((s, p) => { const o = p.opts.find((x) => x.def) ?? p.opts[0]; return s + (o ? o.p * p.qty : 0); }, 0);
const fmt = (n: number) => String(Math.round(n)).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[+c]);

/** شكل البطاقة/المدينة (نفس شكل بيانات المشاريع الثابتة) */
export function toCard(d: ProjectDoc) {
  return {
    id: d.id, c: d.cat, tags: d.tags?.length ? d.tags : [d.cat], l: LEVEL_KEY[d.level], ln: d.level, t: d.title, d: d.desc, p: d.parts.slice(0, 3).map((x) => x.nm), cost: fmt(costOf(d)),
    prob: d.problem, feat: d.feats, bom: d.parts.map((x) => [x.nm, fmt(x.qty), '', '']), x: d.exclusive, fromDb: true,
  };
}

export interface ProjectStore {
  mode: 'local' | 'cloud';
  listPublic(): Promise<ProjectDoc[]>;
  listAll(): Promise<ProjectDoc[]>;
  get(id: string): Promise<ProjectDoc | null>;
  save(d: ProjectDoc): Promise<void>;
  remove(id: string): Promise<void>;
  /** يحلّل صورة لدارة/مشروع ويرجع قائمة القطع (يحتاج خدمة الذكاء الاصطناعي على Supabase) */
  analyzeImage(dataUrl: string): Promise<{ name: string; kind: Kind; qty: number }[]>;
}

const validate = (d: ProjectDoc) => {
  if (!/^[a-z0-9-]{2,40}$/.test(d.id)) throw new Error('الرمز (slug) حروف إنجليزية صغيرة وأرقام وشرطات، من 2 إلى 40');
  if (d.title.trim().length < 3) throw new Error('اكتب اسم المشروع');
  if (d.desc.trim().length < 20) throw new Error('الوصف قصير (٢٠ حرف على الأقل)');
  if (d.status === 'published' && !d.exclusive && !d.parts.length) throw new Error('أضف قطعة واحدة على الأقل قبل النشر');
  for (const p of d.parts) { if (!p.opts.length) throw new Error(`القطعة «${p.nm}» بدون خيارات`); if (!p.opts.some((o) => o.def)) p.opts[0].def = true; }
};

class LocalProjects implements ProjectStore {
  mode = 'local' as const; private key = 'projects.local.v1';
  private read(): Record<string, ProjectDoc> { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } }
  async listAll() { return Object.values(this.read()); }
  async listPublic() { return Object.values(this.read()).filter((d) => d.status !== 'draft'); }
  async get(id: string) { return this.read()[id] ?? null; }
  async save(d: ProjectDoc) { validate(d); const all = this.read(); all[d.id] = { ...d, updated_at: new Date().toISOString() }; localStorage.setItem(this.key, JSON.stringify(all)); }
  async remove(id: string) { const all = this.read(); delete all[id]; localStorage.setItem(this.key, JSON.stringify(all)); }
  async analyzeImage(): Promise<never> { throw new Error('التحليل بالصورة يحتاج تفعيل Supabase وخدمة الذكاء الاصطناعي (docs/community-backend.md). بالوضع التجريبي الصق أسماء القطع بدل الصورة.'); }
}
class CloudProjects implements ProjectStore {
  mode = 'cloud' as const; constructor(private sb: any) {}
  private rows(r: any): ProjectDoc[] { if (r.error) throw new Error(r.error.message); return r.data.map((x: any) => ({ ...x.data, id: x.id, status: x.status, updated_at: x.updated_at })); }
  async listPublic() { return this.rows(await this.sb.from('projects').select('*').in('status', ['published', 'hidden'])); }
  async listAll() { return this.rows(await this.sb.from('projects').select('*').order('updated_at', { ascending: false })); }
  async get(id: string) { const r = await this.sb.from('projects').select('*').eq('id', id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? { ...r.data.data, id: r.data.id, status: r.data.status } : null; }
  async save(d: ProjectDoc) { validate(d); const { id, status, updated_at, ...data } = d; const r = await this.sb.from('projects').upsert({ id, status, data, updated_at: new Date().toISOString() }); if (r.error) throw new Error(r.error.message); }
  async remove(id: string) { const r = await this.sb.from('projects').delete().eq('id', id); if (r.error) throw new Error(r.error.message); }
  async analyzeImage(dataUrl: string) {
    const r = await this.sb.functions.invoke('parts-from-image', { body: { image: dataUrl } });
    if (r.error) throw new Error(r.error.message || 'تعذّر تحليل الصورة');
    const ok = new Set(KINDS.map((k) => k.k));
    return (r.data?.parts ?? []).slice(0, 20).map((p: any) => ({ name: String(p.name ?? '').slice(0, 60), kind: (ok.has(p.kind) ? p.kind : guessKind(String(p.name ?? ''))) as Kind, qty: Math.max(1, Math.min(9, Number(p.qty) || 1)) })).filter((p: any) => p.name);
  }
}

let cached: Promise<ProjectStore> | null = null;
export function getProjectStore(): Promise<ProjectStore> {
  cached ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) { const { createClient } = await import('@supabase/supabase-js'); return new CloudProjects(createClient(url, key)); }
    return new LocalProjects();
  })();
  return cached;
}

/** يجلب المشاريع المنشورة ويسجّل مجسماتها. يرجع تعديلات فوق المشاريع الثابتة */
export async function loadRuntime() {
  let docs: ProjectDoc[] = [];
  try { docs = await (await getProjectStore()).listPublic(); } catch (e) { console.warn('projects runtime:', e); }
  const overrides = new Map<string, ProjectDoc>();
  for (const d of docs) { overrides.set(d.id, d); if (d.status === 'published') registerModel(d.id, d.model ?? undefined); }
  const staticIds = new Set((staticProjects as any[]).map((p) => p.id));
  return {
    hidden: new Set(docs.filter((d) => d.status === 'hidden').map((d) => d.id)),
    changed: docs.filter((d) => d.status === 'published' && staticIds.has(d.id)),
    added: docs.filter((d) => d.status === 'published' && !staticIds.has(d.id)),
    overrides,
  };
}

let fnClient: Promise<any | null> | null = null;
/** يستدعي Edge Function على Supabase. يرجع null إن لم تكن مفعّلة أو فشل الاستدعاء (فيعتمد المتصفح على البحث المحلي) */
export async function invokeFn<T = any>(name: string, body: unknown, timeoutMs = 8000): Promise<T | null> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!(url && key)) return null;
  fnClient ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key)).catch(() => null);
  const sb = await fnClient; if (!sb) return null;
  try {
    const r: any = await Promise.race([sb.functions.invoke(name, { body }), new Promise((res) => setTimeout(() => res({ error: 'timeout' }), timeoutMs))]);
    return r?.error ? null : (r?.data as T);
  } catch { return null; }
}
