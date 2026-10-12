import { UNIVERSITIES } from './universities';

/** مساحات مش مربوطة بجامعة: المجتمع العام (للكل، وبينذكر فيه أي جامعة) والإعلانات (من الفريق) */
export type SpaceKind = 'general' | 'news' | 'uni';
export interface Space { slug: string; name: string; short: string; kind: SpaceKind; desc: string; icon: string }

export const SPACES: Space[] = [
  {
    slug: 'general', name: 'المجتمع العام', short: 'المجتمع العام', kind: 'general', icon: 'users',
    desc: 'كل الجامعات بمكان واحد. اسأل، شارك، واذكر أي جامعة بمنشورك فيوصلها.',
  },
  {
    slug: 'news', name: 'الإعلانات', short: 'الإعلانات', kind: 'news', icon: 'medal',
    desc: 'مشاريع جديدة، عروض قطع، ومواعيد مهمة. من الفريق — للقراءة فقط.',
  },
];

export const spaceBySlug = (slug: string) => SPACES.find((s) => s.slug === slug) ?? null;
export const isSpace = (slug: string) => SPACES.some((s) => s.slug === slug);

/** كل مساحات المجتمع: العامة أولاً وبعدها الجامعات — مصدر موحّد لمسارات /c/ */
export const ALL_SPACES: Space[] = [
  ...SPACES,
  ...UNIVERSITIES.map((u): Space => ({
    slug: u.slug, name: u.name, short: u.short, kind: 'uni', icon: 'chat',
    desc: `مجتمع طلاب ${u.name}`,
  })),
];

/** يحوّل ذكر جامعة (@JUST أو @اليرموك) لرابط مجتمعها. يُستعمل على نص المنشور بعد التهريب */
export function linkMentions(escaped: string): string {
  return escaped.replace(/@([\p{L}A-Za-z]{2,24})/gu, (m, tag: string) => {
    const t = tag.toLowerCase();
    const u = UNIVERSITIES.find(
      (x) => x.abbr.toLowerCase() === t || x.short === tag || x.name.includes(tag),
    );
    return u ? `<a class="ment" href="/c/${u.slug}">@${u.abbr}</a>` : m;
  });
}

/** الجامعات المذكورة بنص منشور — لفلترة المجتمع العام حسب جامعة */
export function mentionedUnis(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/@([\p{L}A-Za-z]{2,24})/gu)) {
    const t = m[1].toLowerCase();
    const u = UNIVERSITIES.find(
      (x) => x.abbr.toLowerCase() === t || x.short === m[1] || x.name.includes(m[1]),
    );
    if (u) out.add(u.slug);
  }
  return [...out];
}

/** بوست مثبّت من الفريق يفتح كل مساحة. ليس بياناً وهمياً: مكتوب باسم الفريق وظاهر كذلك */
export interface Pinned { title: string; body: string }
export const PINNED: Record<string, Pinned> = {
  general: {
    title: 'أهلاً فيكم بالمجتمع العام',
    body: 'هون بتحكي مع طلاب من كل الجامعات — مش جامعتك بس.\n\nاسأل عن لوحة أو حساس، اعرض شغلك وخذ رأي، أو دوّر على شريك لمشروع التخرج.\n\nولو سؤالك يخص جامعة معيّنة، اذكرها بعلامة @ (مثلاً @JUST) فيوصل لطلابها ويطلع بفلتر جامعتهم.\n\nالمنشورات بتنراجع قبل ما تظهر — عشان يضل المكان نظيف ومفيد.',
  },
  news: {
    title: 'شو بتلاقي هون',
    body: 'هاي قناة من فريق مشاريع — للقراءة بس.\n\nمنشر فيها: مشاريع جديدة انضافت للكتالوج، قطع نفدت أو رجعت، عروض وخصومات، ومواعيد مهمة.\n\nلو عندك سؤال أو اقتراح، اكتبه بالمجتمع العام أو بمجتمع جامعتك.',
  },
  uni: {
    title: 'مجتمع جامعتك — ابدأ منه',
    body: 'هاي مساحة طلاب جامعتك وحدهم: نفس المدرّسين، نفس المختبرات، نفس مواعيد التسليم.\n\nمناسبة للأسئلة المحلية: مين بيفهم بالموضوع، وين تلاقي قطعة بالمدينة، ومين بده شريك من نفس الكلية.\n\nأول عضو نشِط بياخد الإشراف. وللأسئلة اللي ما تخص الجامعة، في المجتمع العام.',
  },
};
