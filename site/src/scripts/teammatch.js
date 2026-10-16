// تشكيل فرق المسابقات حسب المهارات: كل فريق يغطي أكبر عدد ممكن من الأدوار.
// صافية عشان تنفحص بـnode:test.

/**
 * people: [{ id, roles: string[] }], size: حجم الفريق
 * → { teams: string[][], left: string[] } (left = بيستنوا تسجيلات أكثر)
 *
 * جشع: صاحب الدور الأندر بيفتح الفريق، وبعدين كل مرة بنضيف اللي بيغطي أكثر أدوار ناقصة.
 * ponytail: جشع مش أمثل، بيكفي لعشرات المسجّلين؛ لو صاروا مئات بنحتاج مطابقة أذكى.
 */
export function formTeams(people, size) {
  const n = Math.max(2, size | 0);
  const freq = {};
  for (const p of people) for (const r of p.roles) freq[r] = (freq[r] || 0) + 1;
  const rarity = (p) => (p.roles.length ? Math.min(...p.roles.map((r) => freq[r])) : Infinity);
  const pool = [...people].sort((a, b) => rarity(a) - rarity(b));
  const teams = [];
  while (pool.length >= n) {
    const first = pool.shift();
    const team = [first], have = new Set(first.roles);
    while (team.length < n) {
      let best = 0, score = -1;
      pool.forEach((p, i) => { const s = p.roles.filter((r) => !have.has(r)).length; if (s > score) { score = s; best = i; } });
      const [p] = pool.splice(best, 1);
      team.push(p); p.roles.forEach((r) => have.add(r));
    }
    teams.push(team.map((p) => p.id));
  }
  return { teams, left: pool.map((p) => p.id) };
}
