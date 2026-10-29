/** الجامعات الأردنية: الحكومية والخاصة. `abbr` اختصار إنجليزي يُعرض بالبطاقة، و`short` اسم عربي قصير للعناوين */
export const UNIVERSITIES: { slug: string; name: string; short: string; abbr: string; city: string }[] = [
  // الحكومية
  { slug: 'ju', name: 'الجامعة الأردنية', short: 'الأردنية', abbr: 'JU', city: 'عمّان' },
  { slug: 'yu', name: 'جامعة اليرموك', short: 'اليرموك', abbr: 'YU', city: 'إربد' },
  { slug: 'just', name: 'جامعة العلوم والتكنولوجيا الأردنية', short: 'العلوم والتكنولوجيا', abbr: 'JUST', city: 'إربد' },
  { slug: 'mutah', name: 'جامعة مؤتة', short: 'مؤتة', abbr: 'Mutah', city: 'الكرك' },
  { slug: 'hu', name: 'الجامعة الهاشمية', short: 'الهاشمية', abbr: 'HU', city: 'الزرقاء' },
  { slug: 'aabu', name: 'جامعة آل البيت', short: 'آل البيت', abbr: 'AABU', city: 'المفرق' },
  { slug: 'bau', name: 'جامعة البلقاء التطبيقية', short: 'البلقاء التطبيقية', abbr: 'BAU', city: 'السلط' },
  { slug: 'ahu', name: 'جامعة الحسين بن طلال', short: 'الحسين بن طلال', abbr: 'AHU', city: 'معان' },
  { slug: 'ttu', name: 'جامعة الطفيلة التقنية', short: 'الطفيلة التقنية', abbr: 'TTU', city: 'الطفيلة' },
  { slug: 'gju', name: 'الجامعة الألمانية الأردنية', short: 'الألمانية الأردنية', abbr: 'GJU', city: 'مادبا' },
  // الخاصة
  { slug: 'psut', name: 'جامعة الأميرة سمية للتكنولوجيا', short: 'الأميرة سمية', abbr: 'PSUT', city: 'عمّان' },
  { slug: 'htu', name: 'جامعة الحسين التقنية', short: 'الحسين التقنية', abbr: 'HTU', city: 'عمّان' },
  { slug: 'asu', name: 'جامعة العلوم التطبيقية الخاصة', short: 'العلوم التطبيقية', abbr: 'ASU', city: 'عمّان' },
  { slug: 'philadelphia', name: 'جامعة فيلادلفيا', short: 'فيلادلفيا', abbr: 'PU', city: 'عمّان' },
  { slug: 'isra', name: 'جامعة الإسراء', short: 'الإسراء', abbr: 'IU', city: 'عمّان' },
  { slug: 'petra', name: 'جامعة البترا', short: 'البترا', abbr: 'UOP', city: 'عمّان' },
  { slug: 'meu', name: 'جامعة الشرق الأوسط', short: 'الشرق الأوسط', abbr: 'MEU', city: 'عمّان' },
  { slug: 'zaytoonah', name: 'جامعة الزيتونة الأردنية', short: 'الزيتونة', abbr: 'ZUJ', city: 'عمّان' },
  { slug: 'ammanu', name: 'جامعة عمّان الأهلية', short: 'عمّان الأهلية', abbr: 'Ahliyya', city: 'عمّان' },
  { slug: 'aau', name: 'جامعة عمّان العربية', short: 'عمّان العربية', abbr: 'AAU', city: 'عمّان' },
  { slug: 'wise', name: 'جامعة العلوم الإسلامية العالمية', short: 'العلوم الإسلامية', abbr: 'WISE', city: 'عمّان' },
  { slug: 'zu', name: 'جامعة الزرقاء', short: 'الزرقاء', abbr: 'ZU', city: 'الزرقاء' },
  { slug: 'jadara', name: 'جامعة جدارا', short: 'جدارا', abbr: 'Jadara', city: 'إربد' },
  { slug: 'inu', name: 'جامعة إربد الأهلية', short: 'إربد الأهلية', abbr: 'INU', city: 'إربد' },
  { slug: 'jpu', name: 'جامعة جرش', short: 'جرش', abbr: 'JPU', city: 'جرش' },
  { slug: 'anu', name: 'جامعة عجلون الوطنية', short: 'عجلون الوطنية', abbr: 'ANU', city: 'عجلون' },
  { slug: 'aum', name: 'الجامعة الأمريكية في مادبا', short: 'الأمريكية في مادبا', abbr: 'AUM', city: 'مادبا' },
  { slug: 'aut', name: 'جامعة العقبة للتكنولوجيا', short: 'العقبة للتكنولوجيا', abbr: 'AUT', city: 'العقبة' },
];
const n = (s: string) => s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
/** يطابق اسماً كتبه الطالب (مثلاً "اليرموك" أو "جامعة اليرموك" أو "YU") مع الجامعة المعروفة */
export const uniSlug = (input: string): string | null => {
  const q = n(input); if (!q) return null;
  const byAbbr = UNIVERSITIES.find((u) => u.abbr.toLowerCase() === input.trim().toLowerCase());
  if (byAbbr) return byAbbr.slug;
  return UNIVERSITIES.find((u) => n(u.name) === q || n(u.short) === q || n(u.name).includes(q) || q.includes(n(u.short)))?.slug ?? null;
};
