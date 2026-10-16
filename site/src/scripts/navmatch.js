// أي قسم بالقائمة لازم يضوي للصفحة الحالية: أطول بادئة مطابقة بتربح (الاستشارة جوّا المتجر مثلاً).

const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/');

/** items: [{ href, match?: string[] }] → href القسم الحالي أو null */
export function activeHref(path, items) {
  const p = path.replace(/\/$/, '') || '/';
  let best = null, len = -1;
  for (const it of items) {
    for (const m of it.match ?? [it.href]) {
      if (under(p, m) && m.length > len) { best = it.href; len = m.length; }
    }
  }
  return best;
}
