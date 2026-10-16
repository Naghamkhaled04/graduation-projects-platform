// حساب السلة ونص زرها — دوال صافية عشان تنفحص بـnode:test.

/** bag: { id: { p, n } } → { count, total } (المجموع مقرّب لـ3 منازل، بلا كسور عائمة) */
export function summary(bag) {
  let count = 0, total = 0;
  for (const k in bag) { count += bag[k].n; total += bag[k].p * bag[k].n; }
  return { count, total: Math.round(total * 1000) / 1000 };
}

/** جمع "قطعة" بالعربي: ١ قطعة، ٢ قطعتين، ٣–١٠ قطع، ١١+ قطعة */
export function partsWord(n) {
  if (n === 2) return 'قطعتين';
  return n >= 3 && n <= 10 ? 'قطع' : 'قطعة';
}

/** نص زر السلة العائم: "٣ قطع · ٧ د.أ" (المثنى بلا رقم: "قطعتين · …") */
export function fabText({ count, total }, ar) {
  const word = partsWord(count);
  return `${count === 2 ? word : `${ar(count)} ${word}`} · ${ar(total)} د.أ`;
}
