/** تصنيف المشاريع حسب المجال. المشروع الواحد قد يكون بأكثر من مجال؛ الأول هو الأساسي */
export const DOMAINS = [
  { k: 'صحي', icon: 'health' },
  { k: 'زراعي', icon: 'agri' },
  { k: 'طاقة', icon: 'energy' },
  { k: 'سلامة وأمان', icon: 'safety' },
  { k: 'مواصلات ونقل', icon: 'transport' },
  { k: 'بيئة ومياه', icon: 'water' },
  { k: 'بيوت ومدن ذكية', icon: 'home' },
  { k: 'روبوتات ودرونات', icon: 'robot' },
  { k: 'صناعي وتشغيل', icon: 'industry' },
  { k: 'ذكاء اصطناعي وبرمجة', icon: 'ai' },
] as const;
export const DOMAIN_KEYS: string[] = DOMAINS.map((d) => d.k);
export const domainIcon = (k: string) => DOMAINS.find((d) => d.k === k)?.icon ?? 'box';

export const TAGS: Record<string, string[]> = {
  gas: ['سلامة وأمان', 'بيوت ومدن ذكية'], water: ['بيئة ومياه', 'بيوت ومدن ذكية'], power: ['طاقة', 'بيوت ومدن ذكية'],
  bee: ['زراعي'], iv: ['صحي'], spider: ['روبوتات ودرونات'], vitals: ['صحي'], meter: ['طاقة', 'بيوت ومدن ذكية'], fall: ['صحي'],
  traffic: ['مواصلات ونقل', 'بيوت ومدن ذكية'], guard: ['سلامة وأمان'], crash: ['مواصلات ونقل', 'سلامة وأمان', 'صحي'],
  helmet: ['سلامة وأمان', 'صناعي وتشغيل'], farm: ['زراعي', 'بيئة ومياه'], solar: ['طاقة'], night: ['سلامة وأمان'],
  dnet: ['روبوتات ودرونات', 'سلامة وأمان'], dsolar: ['روبوتات ودرونات', 'طاقة'], meet: ['ذكاء اصطناعي وبرمجة'],
  swap: ['ذكاء اصطناعي وبرمجة'], plant: ['زراعي', 'ذكاء اصطناعي وبرمجة'], home: ['بيوت ومدن ذكية'], ecg: ['صحي'],
  weather: ['بيئة ومياه'], street: ['بيوت ومدن ذكية', 'طاقة'], fire: ['سلامة وأمان'], asset: ['صناعي وتشغيل'],
  flood: ['بيئة ومياه', 'سلامة وأمان'], breaker: ['سلامة وأمان', 'صناعي وتشغيل'], coma: ['صحي'], gate: ['سلامة وأمان'],
  zep: ['بيئة ومياه', 'روبوتات ودرونات'], vdoc: ['صحي', 'روبوتات ودرونات', 'ذكاء اصطناعي وبرمجة'],
  uav: ['روبوتات ودرونات', 'سلامة وأمان'], boat: ['روبوتات ودرونات', 'بيئة ومياه'], wave: ['طاقة', 'بيئة ومياه'],
  lock: ['سلامة وأمان', 'بيوت ومدن ذكية'], park: ['مواصلات ونقل', 'بيوت ومدن ذكية'], air: ['بيئة ومياه', 'بيوت ومدن ذكية'],
  medfridge: ['صحي'], tank: ['بيئة ومياه', 'بيوت ومدن ذكية'], ship: ['صناعي وتشغيل', 'مواصلات ونقل'], face: ['ذكاء اصطناعي وبرمجة', 'سلامة وأمان'],
  cattle: ['زراعي'], crack: ['صناعي وتشغيل', 'سلامة وأمان'], vibe: ['صناعي وتشغيل'],
  drowsy: ['مواصلات ونقل', 'سلامة وأمان', 'ذكاء اصطناعي وبرمجة'], plag: ['ذكاء اصطناعي وبرمجة'], rag: ['ذكاء اصطناعي وبرمجة'], cane: ['صحي'],
  green: ["زراعي", "بيوت ومدن ذكية"],
  psolar: ["طاقة"],
  radar: ["مواصلات ونقل", "ذكاء اصطناعي وبرمجة"],
  gesture: ["ذكاء اصطناعي وبرمجة", "بيوت ومدن ذكية"],
  track: ["بيوت ومدن ذكية", "طاقة"],
  zone: ["سلامة وأمان", "صناعي وتشغيل"],
  rev: ["مواصلات ونقل", "سلامة وأمان"],
  agri: ["زراعي", "ذكاء اصطناعي وبرمجة"],
  bvib: ["صناعي وتشغيل", "سلامة وأمان"],
  flow: ["ذكاء اصطناعي وبرمجة", "بيوت ومدن ذكية"],
  anom: ["صناعي وتشغيل", "ذكاء اصطناعي وبرمجة"],
  garden: ["زراعي", "بيوت ومدن ذكية", "طاقة"],
  dish: ["صحي", "ذكاء اصطناعي وبرمجة"],
  gpstrk: ["مواصلات ونقل", "سلامة وأمان"],
  indoor: ["صناعي وتشغيل", "بيوت ومدن ذكية"],
  wachat: ["بيوت ومدن ذكية", "ذكاء اصطناعي وبرمجة"],
  arm: ["روبوتات ودرونات", "ذكاء اصطناعي وبرمجة"],
  cvrank: ["ذكاء اصطناعي وبرمجة"],
  uniqa: ["ذكاء اصطناعي وبرمجة"],
  wafid: ["ذكاء اصطناعي وبرمجة"],
  voiceid: ["سلامة وأمان", "ذكاء اصطناعي وبرمجة"],
  signcom: ["صحي", "ذكاء اصطناعي وبرمجة"],
  onco: ["صحي", "ذكاء اصطناعي وبرمجة"],
  pharma: ["ذكاء اصطناعي وبرمجة", "صحي"],
  intern: ["ذكاء اصطناعي وبرمجة"],
  events: ["ذكاء اصطناعي وبرمجة"],
  craft: ["ذكاء اصطناعي وبرمجة"],
  geofen: ["صحي", "سلامة وأمان"],
  noisecam: ["سلامة وأمان", "بيوت ومدن ذكية"],
  emeter: ["طاقة", "صناعي وتشغيل"],
  envhub: ["بيئة ومياه", "ذكاء اصطناعي وبرمجة", "صناعي وتشغيل"],
  farcam: ["سلامة وأمان", "بيئة ومياه"],
  sepsis: ["صحي", "ذكاء اصطناعي وبرمجة"],
  vdeep: ["سلامة وأمان", "ذكاء اصطناعي وبرمجة"],
  cyberops: ["سلامة وأمان", "ذكاء اصطناعي وبرمجة"],
  guide: ["روبوتات ودرونات", "ذكاء اصطناعي وبرمجة"],
  glove: ["صحي", "ذكاء اصطناعي وبرمجة"],
  kneebr: ["صحي", "صناعي وتشغيل"],
  kafo: ["صحي"],
  pellet: ["طاقة", "بيئة ومياه", "زراعي"],
};
export const tagsOf = (id: string, fallback?: string[]) => TAGS[id] ?? fallback ?? ['أخرى'];

export const LEVELS = ['سهل', 'متوسط', 'متقدم'] as const;
export const levelNum = (l: string) => (l === 'سهل' ? 1 : l === 'متوسط' ? 2 : 3);

/** يستخرج أول رقم من نص التكلفة: "٣٠ إلى ٤٥" → 30 ، "٦٥" → 65 */
export const costNum = (s: string) => Number(String(s).replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/٫/g, '.').match(/[\d.]+/)?.[0] ?? 0) || 0;

export interface Advice { domains: string[]; experience: 1 | 2 | 3; budget: { min: number; max: number | null } | null }
export interface Suggestion<T> { p: T; score: number; reasons: string[]; stretch: boolean }

/** مستشار المشاريع: يقترح حسب المجال والخبرة والميزانية. بلا ذكاء اصطناعي، قواعد واضحة وقابلة للتوقع */
export function advise<T extends { id: string; ln: string; cost: string; x?: boolean }>(all: T[], a: Advice, tagOf: (p: T) => string[], ignoreBudget = false, allowHard = false): Suggestion<T>[] {
  const out: Suggestion<T>[] = [];
  for (const p of all) {
    const reasons: string[] = []; let score = 0;
    const tags = tagOf(p);
    if (a.domains.length) {
      const hit = a.domains.filter((d) => tags.includes(d));
      if (!hit.length) continue;
      score += 5 + (tags[0] === hit[0] ? 1 : 0); reasons.push(hit.join(' + '));
    }
    const diff = levelNum(p.ln) - a.experience;
    if (diff >= 2 && !allowHard) continue;
    if (diff >= 2) { score += 0; reasons.push(`أصعب من مستواك بدرجتين (${p.ln})`); }
    else if (diff === 0) { score += 4; reasons.push(`مستوى ${p.ln} يناسب خبرتك`); }
    else if (diff === -1) { score += 2; reasons.push(`أسهل شوي من مستواك (${p.ln})`); }
    else if (diff === 1) { score += 1; reasons.push(`تحدٍّ أعلى منك بدرجة (${p.ln})`); }
    else { score += 0; reasons.push(`مستوى ${p.ln}، مريح لخبرتك`); }
    const c = costNum(p.cost);
    if (a.budget && !ignoreBudget) {
      const { min, max } = a.budget;
      if (c >= min && (max == null || c <= max)) { score += 3; reasons.push(`${c} د.أ ضمن نطاقك`); }
      else if (c >= min * 0.85 && (max == null || c <= max * 1.15)) { score += 1; reasons.push(`${c} د.أ قريب من نطاقك`); }
      else continue;
    } else if (c) reasons.push(`حوالي ${c} د.أ`);
    out.push({ p, score, reasons, stretch: diff === 1 });
  }
  return out.sort((x, y) => y.score - x.score || costNum(x.p.cost) - costNum(y.p.cost)).slice(0, 3);
}
