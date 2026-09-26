import { getBackend } from '../community/backend';

/**
 * أول مشروعين مفتوحين للزائر، وبعدها لازم يسجّل.
 * العدّ بالمتصفح فقط — حاجز تشجيعي، مش حماية: مسح بيانات المتصفح يعيد العدّاد.
 * المحتوى يُخفى قبل أي انتظار حتى لا يومض للزائر الممنوع.
 */
const KEY = 'seen.projects.v1';
export const FREE = 2;

const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

export async function guardProject(id: string) {
  const seen = read();
  if (seen.includes(id)) return true;                       // شافه قبل: يضل مفتوح
  if (seen.length < FREE) {                                 // ضمن المجاني
    try { localStorage.setItem(KEY, JSON.stringify([...seen, id])); } catch { /* اختياري */ }
    return true;
  }
  const be = await getBackend();
  if (await be.session()) return true;
  location.replace(`/join?next=${encodeURIComponent(location.pathname + location.search)}&wall=1`);
  return false;
}

/** شريط تنبيه لطيف: بقي لك مشروع واحد مجاني */
export function freeLeftBanner(): string {
  const left = FREE - read().length;
  if (left !== 1) return '';
  return `<p class="wallnote">هاد آخر مشروع بتشوفه بدون حساب. <a href="/join">أنشئ حسابك مجاناً</a> وكمّل على راحتك.</p>`;
}
