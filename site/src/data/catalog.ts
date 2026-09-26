import projectsRaw from './projects.json';
import details from './details.json';
import { tagsOf } from './taxonomy';
import { loadRuntime, toCard, type ProjectDoc } from '../projects/store';
import type { SearchDoc } from './search';

/** وثيقة بحث لكل مشروع، بحقول موزونة (العنوان أهم من الوصف من الخطوات…) */
const fromStatic = (p: any): SearchDoc => {
  const d: any = (details as any)[p.id] ?? {};
  const tags = tagsOf(p.id);
  return {
    id: p.id, title: p.t, desc: p.d, tags, ln: p.ln, cost: p.cost,
    fields: [
      { w: 3, text: p.t }, { w: 2, text: tags.join(' ') }, { w: 2, text: p.d }, { w: 1, text: p.prob ?? '' },
      { w: 1, text: (p.feat ?? []).join(' ') }, { w: 1, text: (d.steps ?? []).map((s: string[]) => s.join(' ')).join(' ') },
      { w: 1.3, text: (d.parts ?? []).map((x: any) => x.nm).join(' ') }, { w: 0.6, text: (d.chals ?? []).join(' ') },
    ],
  };
};
const fromDoc = (d: ProjectDoc): SearchDoc => {
  const c = toCard(d); const tags = d.tags?.length ? d.tags : [d.cat];
  return {
    id: d.id, title: d.title, desc: d.desc, tags, ln: d.level, cost: c.cost, fromDb: true,
    fields: [
      { w: 3, text: d.title }, { w: 2, text: tags.join(' ') }, { w: 2, text: d.desc }, { w: 1, text: d.problem },
      { w: 1, text: d.feats.join(' ') }, { w: 1, text: d.steps.map((s) => s.join(' ')).join(' ') },
      { w: 1.3, text: d.parts.map((x) => x.nm).join(' ') }, { w: 0.6, text: d.chals.join(' ') },
    ],
  };
};

/** المشاريع الثابتة + ما أضافته/عدّلته/أخفته لوحة الأدمن */
export async function loadCatalog(): Promise<SearchDoc[]> {
  let all = (projectsRaw as any[]).map(fromStatic);
  try {
    const rt = await loadRuntime();
    all = all.filter((p) => !rt.hidden.has(p.id));
    [...rt.changed, ...rt.added].forEach((d) => { const x = fromDoc(d); const i = all.findIndex((p) => p.id === x.id); i >= 0 ? (all[i] = x) : all.push(x); });
  } catch { /* الثابت فقط */ }
  return all;
}
