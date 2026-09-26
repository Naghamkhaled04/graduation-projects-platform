/** الجامعات الأردنية الشائعة لصفحات "مشاريع تخرج جامعة X" */
export const UNIVERSITIES: { slug: string; name: string; short: string }[] = [
  { slug: 'ju', name: 'الجامعة الأردنية', short: 'الأردنية' },
  { slug: 'yu', name: 'جامعة اليرموك', short: 'اليرموك' },
  { slug: 'just', name: 'جامعة العلوم والتكنولوجيا الأردنية', short: 'العلوم والتكنولوجيا' },
  { slug: 'hu', name: 'الجامعة الهاشمية', short: 'الهاشمية' },
  { slug: 'mutah', name: 'جامعة مؤتة', short: 'مؤتة' },
  { slug: 'ahu', name: 'جامعة الحسين بن طلال', short: 'الحسين بن طلال' },
  { slug: 'bau', name: 'جامعة البلقاء التطبيقية', short: 'البلقاء التطبيقية' },
  { slug: 'ttu', name: 'جامعة الطفيلة التقنية', short: 'الطفيلة التقنية' },
  { slug: 'psut', name: 'جامعة الأميرة سمية للتكنولوجيا', short: 'الأميرة سمية' },
  { slug: 'gju', name: 'الجامعة الألمانية الأردنية', short: 'الألمانية الأردنية' },
  { slug: 'philadelphia', name: 'جامعة فيلادلفيا', short: 'فيلادلفيا' },
  { slug: 'zu', name: 'جامعة الزرقاء', short: 'الزرقاء' },
  { slug: 'asu', name: 'جامعة العلوم التطبيقية الخاصة', short: 'العلوم التطبيقية الخاصة' },
  { slug: 'ammanu', name: 'جامعة عمان الأهلية', short: 'عمان الأهلية' },
  { slug: 'petra', name: 'جامعة البتراء', short: 'البتراء' },
  { slug: 'zaytoonah', name: 'جامعة الزيتونة الأردنية', short: 'الزيتونة' },
];
const n = (s: string) => s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
/** يطابق اسماً كتبه الطالب (مثلاً "اليرموك" أو "جامعة اليرموك") مع الجامعة المعروفة */
export const uniSlug = (input: string): string | null => {
  const q = n(input); if (!q) return null;
  return UNIVERSITIES.find((u) => n(u.name) === q || n(u.short) === q || n(u.name).includes(q) || q.includes(n(u.short)))?.slug ?? null;
};
