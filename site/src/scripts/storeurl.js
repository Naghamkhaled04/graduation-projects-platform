// بحث المتجر وترتيبه وفلتره بالرابط: بتقدري تبعتي الرابط لحدا، وزر الرجوع بيرجّعك لنفس النتيجة.

const SORTS = ['', 'p', '-p', 'n'];

/** '?q=…&sort=…&only=1' → { q, sort, only } */
export function readState(search) {
  const u = new URLSearchParams(search);
  const sort = u.get('sort') ?? '';
  return { q: u.get('q') ?? '', sort: SORTS.includes(sort) ? sort : '', only: u.get('only') === '1' };
}

/** { q, sort, only } → query string بس للي مش افتراضي ('' إذا كله افتراضي) */
export function toQuery({ q, sort, only }) {
  const u = new URLSearchParams();
  if (q.trim()) u.set('q', q.trim());
  if (sort) u.set('sort', sort);
  if (only) u.set('only', '1');
  const s = u.toString();
  return s ? '?' + s : '';
}
