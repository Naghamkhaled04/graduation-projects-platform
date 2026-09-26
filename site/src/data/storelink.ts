import catalog from './novatera.json';
import { STORE_URL } from './config';

/**
 * يربط أسماء القطع بمشاريعنا مع منتجات المتجر الحقيقي (نوفاتيرا).
 * أسماء المتجر إنجليزية وأسماء مشاريعنا عربية غالباً، فنترجم الكلمات الشائعة أولاً.
 * القاعدة: ربط غلط أسوأ من عدم الربط — لو الثقة ضعيفة نرجّع null.
 */
export interface Product { id: string; nm: string; cat: string; p: number; img: string }
const items = catalog as Product[];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const base = (s: string) =>
  s.toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c)))
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

/** يلصق فواصل رموز الموديل: MQ-135 → mq135، NEO-6M → neo6m، PM2.5 → pm25 */
const glue = (s: string) => base(s).replace(/([a-z0-9])[-_.]+(?=[a-z0-9])/g, '$1');
const norm = (s: string) => glue(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** رمز موديل: حروف+أرقام ملتصقة (dht22, mq135, acs712, esp8266, nrf24l01) */
const MODEL = /^(?=.*\d)(?=.*[a-z])[a-z0-9]{4,}$/;

/** كل سطر مجموعة مرادفات: يكفي أن يطابق المنتج واحداً منها */
const AR2EN: [RegExp, string][] = [
  [/حساس|مستشعر/, 'sensor'], [/شاشه/, 'lcd|oled|display|screen|tft'], [/محرك/, 'motor'], [/مضخه|طلمبه/, 'pump'],
  [/بطاريه/, 'battery'], [/ليثيوم/, 'lithium'], [/رصاص/, 'lead acid|sla'], [/جرس|صافره/, 'buzzer'],
  [/مرحل|ريلاي/, 'relay'], [/كاميرا/, 'camera'], [/سيرفو/, 'servo'], [/مروحه/, 'fan'],
  [/اسلاك|سلك|وصلات|جامبر/, 'jumper|wire|cable'], [/لوحه تجارب/, 'breadboard'], [/مقاومه/, 'resistor'],
  [/مكثف/, 'capacitor'], [/صمام|سولينويد/, 'solenoid|valve'], [/شمسي|شمسيه/, 'solar'],
  [/مزود طاقه|محول|ادابتر/, 'adapter|power supply|psu'], [/شاحن/, 'charger'], [/ليد|ليدات/, 'led'],
  [/رطوبه/, 'humidity'], [/حراره/, 'temperature'], [/تربه/, 'soil'], [/تيار/, 'current'],
  [/تدفق/, 'flow'], [/غاز/, 'gas'], [/دخان/, 'smoke'], [/حركه/, 'motion|pir'],
  [/موجات فوق صوتيه|فوق صوتي/, 'ultrasonic|hcsr04'], [/وزن/, 'load cell|hx711|weight'], [/جيروسكوب|تسارع/, 'gyro|accelerometer|mpu'],
  [/قارئ بطاقه|بطاقات/, 'rfid'], [/ذاكره/, 'sd card|micro sd|tf card'], [/ساعه/, 'rtc'], [/ميكروفون/, 'microphone'],
  [/سماعه/, 'speaker'], [/زر ضغط|ازرار/, 'push button|button|tactile'], [/مفتاح/, 'switch'], [/انبوب|خرطوم/, 'tube|hose'],
  [/ستيبر|خطوي/, 'stepper'], [/مائيه|مياه|ماء/, 'water'], [/هواء|هوائيه/, 'air'],
  [/كهربائي|كهرباء/, 'electric'], [/لمس|تاتش/, 'touch'], [/انذار/, 'alarm'], [/درايفر|مشغل محرك/, 'driver|l298|l293|a4988'], [/غبار/, 'dust'], [/ضغط/, 'pressure'],
];

const STOP = new Set('the a an and of for with module board kit set pcs pc مع من الى على قطعه وحده فولت امبير بوصه مللي انش'.split(/\s+/));

function terms(raw: string) {
  const n = norm(raw);
  const groups: string[][] = [], models = new Set<string>();
  const words = new Set<string>();
  for (const [re, en] of AR2EN) if (re.test(n)) groups.push(en.split('|'));
  for (const t of n.split(' ')) {
    if (!t || STOP.has(t)) continue;
    if (!/^[a-z0-9]+$/.test(t)) continue;                 // الكلمات العربية تُترجم أعلاه فقط
    // رقم مفرد (4 بـ Raspberry Pi 4): ليس شرطاً لكنه يُحتسب، فلا يُطابَق موديل مختلف
    if (/^\d+$/.test(t)) { if (t.length <= 2) groups.push([t]); continue; }
    if (t.length < 3) continue;
    words.add(t);
    if (MODEL.test(t)) models.add(t);
  }
  words.forEach((w) => groups.push([w]));
  return { groups, models: [...models] };
}

const INDEX = items.map((it) => ({ it, n: ' ' + norm(it.nm) + ' ', flat: norm(it.nm).replace(/ /g, '') }));

export function findProduct(name: string): Product | null {
  const { groups, models } = terms(name);
  if (!groups.length) return null;

  let best: Product | null = null, bestScore = -1;
  for (const { it, n, flat } of INDEX) {
    // رمز الموديل شرط قاطع: لو الاسم فيه MQ135 فالمنتج لازم يحتويه، وإلا فهو قطعة ثانية
    let ok = true;
    for (const m of models) if (!flat.includes(m)) { ok = false; break; }
    if (!ok) continue;

    let covered = 0, need = 0, bonus = 0;
    for (const g of groups) {
      // رقم مفرد (Pi 4، ١٢ فولت): يرجّح المطابقة ولا يمنعها، ولا يُحتسب داخل رقم أطول
      if (/^\d+$/.test(g[0])) {
        if (new RegExp('(?<![0-9])' + g[0] + '(?![0-9])').test(n)) bonus += 4;
        continue;
      }
      const shortest = Math.min(...g.map((x) => x.length));
      need += shortest;
      if (g.some((x) => n.includes(x))) covered += shortest;
    }
    if (!need || !covered) continue;

    const ratio = covered / need;
    if (ratio < 0.7) continue;
    // بلا رمز موديل نطلب تغطية شبه كاملة، لأن المطابقة بالكلمات وحدها ضعيفة
    if (!models.length && ratio < 0.95) continue;
    const score = ratio * 100 + bonus - Math.abs(it.nm.length - name.length) * 0.1;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return bestScore >= 55 ? best : null;
}

export const productUrl = (id: string) => `${STORE_URL}/product/${id}`;
export const STORE_HOME = `${STORE_URL}/store`;
