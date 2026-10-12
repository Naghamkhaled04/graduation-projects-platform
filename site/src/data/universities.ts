/** الجامعات الأردنية الشائعة لصفحات "مشاريع تخرج جامعة X" */
/** متجرنا بإربد — فالمسافة بتفرق بالتوصيل، ولهيك المدينة جزء من بيانات الجامعة */
export const STORE_CITY = 'إربد';
export const UNIVERSITIES: { slug: string; name: string; short: string; city: string }[] = [
  { slug: 'ju', name: 'الجامعة الأردنية', short: 'الأردنية' , city: 'عمّان' },
  { slug: 'yu', name: 'جامعة اليرموك', short: 'اليرموك' , city: 'إربد' },
  { slug: 'just', name: 'جامعة العلوم والتكنولوجيا الأردنية', short: 'العلوم والتكنولوجيا' , city: 'إربد' },
  { slug: 'hu', name: 'الجامعة الهاشمية', short: 'الهاشمية' , city: 'الزرقاء' },
  { slug: 'mutah', name: 'جامعة مؤتة', short: 'مؤتة' , city: 'الكرك' },
  { slug: 'ahu', name: 'جامعة الحسين بن طلال', short: 'الحسين بن طلال' , city: 'معان' },
  { slug: 'bau', name: 'جامعة البلقاء التطبيقية', short: 'البلقاء التطبيقية' , city: 'السلط' },
  { slug: 'ttu', name: 'جامعة الطفيلة التقنية', short: 'الطفيلة التقنية' , city: 'الطفيلة' },
  { slug: 'psut', name: 'جامعة الأميرة سمية للتكنولوجيا', short: 'الأميرة سمية' , city: 'عمّان' },
  { slug: 'gju', name: 'الجامعة الألمانية الأردنية', short: 'الألمانية الأردنية' , city: 'مادبا' },
  { slug: 'philadelphia', name: 'جامعة فيلادلفيا', short: 'فيلادلفيا' , city: 'عمّان' },
  { slug: 'zu', name: 'جامعة الزرقاء', short: 'الزرقاء' , city: 'الزرقاء' },
  { slug: 'asu', name: 'جامعة العلوم التطبيقية الخاصة', short: 'العلوم التطبيقية الخاصة' , city: 'عمّان' },
  { slug: 'ammanu', name: 'جامعة عمان الأهلية', short: 'عمان الأهلية' , city: 'عمّان' },
  { slug: 'petra', name: 'جامعة البتراء', short: 'البتراء' , city: 'عمّان' },
  { slug: 'zaytoonah', name: 'جامعة الزيتونة الأردنية', short: 'الزيتونة' , city: 'عمّان' },
];
const n = (s: string) => s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
/** يطابق اسماً كتبه الطالب (مثلاً "اليرموك" أو "جامعة اليرموك") مع الجامعة المعروفة */
export const uniSlug = (input: string): string | null => {
  const q = n(input); if (!q) return null;
  return UNIVERSITIES.find((u) => n(u.name) === q || n(u.short) === q || n(u.name).includes(q) || q.includes(n(u.short)))?.slug ?? null;
};

/** الجامعات بمدينة المتجر: التوصيل أسرع، وهاي معلومة حقيقية تفرّق البطاقات */
export const nearStore = (slug: string) => UNIVERSITIES.find((u) => u.slug === slug)?.city === STORE_CITY;
