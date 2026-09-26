import details from './details.json';
import projects from './projects.json';
import { findProduct } from './storelink';

/** خريطة: منتج المتجر ← المشاريع اللي بتستعمله. تُحسب مرة عند البناء */
const titleOf = (id: string) => (projects as { id: string; t: string }[]).find((p) => p.id === id)?.t ?? id;

const map = new Map<string, { id: string; t: string }[]>();
for (const [pid, v] of Object.entries(details as Record<string, any>)) {
  for (const part of v.parts ?? []) {
    for (const o of part.opts ?? []) {
      const prod = findProduct(String(o.nm ?? ''));
      if (!prod) continue;
      const arr = map.get(prod.id) ?? [];
      if (!arr.some((x) => x.id === pid)) arr.push({ id: pid, t: titleOf(pid) });
      map.set(prod.id, arr);
    }
  }
}

export const usedBy = (productId: string) => map.get(productId) ?? [];
