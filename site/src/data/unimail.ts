import { UNIVERSITIES } from './universities';

/** نطاقات البريد الجامعي: تأكيد البريد = تحقق من أن الطالب فعلاً بهذه الجامعة */
export const UNI_DOMAINS: Record<string, string[]> = {
  ju: ['ju.edu.jo'],
  yu: ['yu.edu.jo'],
  just: ['just.edu.jo'],
  hu: ['hu.edu.jo'],
  mutah: ['mutah.edu.jo'],
  ahu: ['ahu.edu.jo'],
  bau: ['bau.edu.jo'],
  ttu: ['ttu.edu.jo'],
  psut: ['psut.edu.jo'],
  gju: ['gju.edu.jo'],
  philadelphia: ['philadelphia.edu.jo'],
  zu: ['zu.edu.jo'],
  asu: ['asu.edu.jo'],
  ammanu: ['ammanu.edu.jo'],
  petra: ['uop.edu.jo'],
  zaytoonah: ['zuj.edu.jo'],
};

export const domainsOf = (slug: string) => UNI_DOMAINS[slug] ?? [];
export const hintFor = (slug: string) => { const d = domainsOf(slug); return d.length ? `اسمك@${d[0]}` : 'بريدك الجامعي'; };

/** هل البريد من نطاق هذه الجامعة؟ يقبل النطاقات الفرعية مثل std.yu.edu.jo */
export function emailMatchesUni(email: string, slug: string): boolean {
  const doms = domainsOf(slug); if (!doms.length) return true;   // جامعة غير معروفة: لا نمنع
  const at = email.toLowerCase().trim().split('@')[1] ?? '';
  return doms.some((d) => at === d || at.endsWith('.' + d));
}
/** يخمّن الجامعة من البريد، لتعبئة الحقل تلقائياً */
export function uniFromEmail(email: string): string | null {
  const at = email.toLowerCase().trim().split('@')[1] ?? ''; if (!at) return null;
  for (const [slug, doms] of Object.entries(UNI_DOMAINS)) if (doms.some((d) => at === d || at.endsWith('.' + d))) return slug;
  return null;
}
export const uniNameOf = (slug: string) => UNIVERSITIES.find((u) => u.slug === slug)?.name ?? '';
/** قائمة النطاقات كلها للعرض */
export const ALL_DOMAINS = [...new Set(Object.values(UNI_DOMAINS).flat())];
