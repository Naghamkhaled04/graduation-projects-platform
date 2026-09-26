/**
 * محرك بحث بالوصف (عربي/إنجليزي/لهجات) لمطابقة فكرة الطالب مع مشاريعنا.
 * يعمل بالمتصفح بلا خادم: تطبيع + تجذير خفيف + مفاهيم مترادفة + ترجيح BM25.
 * قرار "موجود/قريب/جديد" يعتمد على نسبة تغطية معلومات الوصف، لا على عدد الكلمات المتطابقة.
 */

export interface SearchDoc { id: string; title: string; desc: string; tags: string[]; ln: string; cost: string; fromDb?: boolean; fields?: { w: number; text: string }[] }
export interface Hit<T extends SearchDoc = SearchDoc> { doc: T; score: number; coverage: number; matched: string[] }
export type Verdict = 'exists' | 'close' | 'none' | 'vague';
export interface SearchResult<T extends SearchDoc = SearchDoc> { verdict: Verdict; hits: Hit<T>[]; informative: number }

const DIAC = /[ً-ْـ]/g;
const DIG = '٠١٢٣٤٥٦٧٨٩';
export const norm = (s: string) =>
  s.toLowerCase().replace(DIAC, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (c) => String(DIG.indexOf(c))).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const PRE = ['وبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const SUF = ['ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'نا', 'ه', 'ي'];
export function stem(w: string): string {
  if (/^[a-z0-9.+-]+$/.test(w)) return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
  for (const p of PRE) if (w.startsWith(p) && w.length - p.length >= 3) { w = w.slice(p.length); break; }
  for (const s of SUF) if (w.endsWith(s) && w.length - s.length >= 3) { w = w.slice(0, -s.length); break; }
  return w;
}

const STOP = new Set(('بدي بدنا بده اريد ابغي ابي عايز بدك ممكن مشروع مشاريع فكره فكرتي فكرة عندكم عندنا عندك هل لو اذا شو ايش كيف اللي الي هاد هاذا هذا هاي هذه هدا ذلك جهاز نظام شي حاجه عمل اعمل نعمل تعمل يعمل عن على علي من في فيه مع الي او ان ما لا كل كمان برضو جدا بس يكون تكون يقدر بيقدر لحاله بشكل ' +
  'نفس مثل زي يعني طيب اي اكثر شوي كتير مره ياخذ يعطي بيعمل يشتغل يصير تصير يخلي بخلي يطلع بطلع اقدر نقدر بقدر احنا انا انت هو هي اشي شغله موضوع عمليه طريقه حل لمشكله وجود ليس ليست عندي عند فيها فيهم الى إلى الي اللي و ب ل ك لما مش وانا وين ايوه شغل موجود اعرف اعرفه بعرف بدنا').split(/\s+/).map((w) => stem(norm(w))));
/** كلمات شائعة بكل المشاريع: تُحسب لكن بوزن منخفض حتى لا تلوّث النتيجة */
const GENERIC = new Set('ذكي ذكيه مراقبه يراقب كشف يكشف قياس يقيس يحسب حساب يعرف تحكم يتحكم حساس حساسات بيانات عرض يعرض تنبيه ينبه تنبه اشعار مستوي قراءه'.split(/\s+/).map((w) => stem(norm(w))));

/** مجموعات مفاهيم: أي كلمة من المجموعة تُحسب مطابقة لغيرها (عربي/إنجليزي/لهجة) */
const CONCEPTS: string[][] = [
  ['غاز', 'تسرب غاز', 'gas', 'mq', 'ميثان', 'بروبان', 'اسطوانه غاز'],
  ['حريق', 'دخان', 'fire', 'flame', 'لهب', 'اطفاء', 'دفاع مدني', 'smoke', 'انذار حريق'],
  ['ماء', 'مياه', 'ميه', 'water', 'تسريب', 'تسرب مياه', 'leak', 'عداد مياه'],
  ['تدفق', 'flow', 'جريان'],
  ['خزان', 'tank', 'منسوب', 'مستوي الماء', 'level', 'جفاف خزان'],
  ['كهرباء', 'طاقه', 'power', 'تيار', 'current', 'استهلاك', 'فاتوره', 'عداد كهرباء', 'energy', 'كيلوواط'],
  ['شمس', 'شمسي', 'solar', 'الواح شمسيه', 'panel', 'pv'],
  ['مريض', 'مرضي', 'patient', 'مستشفي', 'صحه', 'صحي', 'طبي', 'medical', 'health', 'ممرض', 'ممرضه', 'سرير', 'عياده', 'طبيب', 'doctor', 'رعايه صحيه'],
  ['قلب', 'ecg', 'نبض', 'heart', 'تخطيط قلب', 'ekg', 'ضربات القلب'],
  ['علامات حيويه', 'vitals', 'حراره الجسم', 'اكسجين', 'spo2', 'ضغط الدم', 'نبض'],
  ['سقوط', 'سقط', 'وقع', 'يقع', 'fall', 'كبار السن', 'كبير بالسن', 'مسن', 'مسنين', 'عجوز', 'elderly', 'وقوع'],
  ['محلول', 'وريد', 'وريدي', 'iv', 'سيروم', 'كيس محلول', 'مغذي', 'drip', 'تنقيط', 'fluid', 'كيس'],
  ['غيبوبه', 'coma', 'فاقد الوعي', 'مريض غيبوبه'],
  ['دواء', 'ادويه', 'medicine', 'صيدليه', 'ثلاجه', 'fridge', 'تبريد', 'برودة', 'برودا', 'cold', 'حراره الثلاجه', 'لقاح', 'لقاحات'],
  ['مكفوف', 'اعمي', 'blind', 'عصا', 'cane', 'كفيف', 'ضعاف البصر', 'ذوي الاعاقه البصريه'],
  ['سياره', 'مركبه', 'vehicle', 'car', 'سيارات', 'مركبات', 'سائق', 'driver'],
  ['حادث', 'حوادث', 'crash', 'accident', 'اصطدام', 'تصادم', 'انقلاب'],
  ['اسعاف', 'ambulance', 'طوارئ', 'emergency', 'اغاثه'],
  ['اشاره', 'مرور', 'traffic', 'signal', 'تقاطع', 'اشارات', 'اشاره مرور'],
  ['موقف', 'باركنج', 'parking', 'اماكن ركن', 'ركن', 'ركنه'],
  ['نعاس', 'drowsy', 'نوم', 'ارهاق', 'sleep', 'يغفو', 'غفوه', 'انتباه السائق', 'تعب'],
  ['نبات', 'نباتات', 'plant', 'شتله', 'خضار', 'ورد', 'شجر'],
  ['زراعه', 'زراعي', 'مزرعه', 'farm', 'محصول', 'مزارع', 'agriculture', 'مزارعين'],
  ['تربه', 'soil', 'رطوبه التربه', 'رطوبه تربه', 'رطوبه'],
  ['ري', 'سقي', 'يسقي', 'irrigation', 'رش', 'مضخه', 'pump'],
  ['greenhouse', 'بيت بلاستيكي', 'بيوت بلاستيكيه', 'صوبه', 'دفيئه'],
  ['مرض نبات', 'مرض ورق', 'ورقه', 'disease', 'تشخيص نبات', 'فطر', 'افه', 'حشره زراعيه'],
  ['نحل', 'خليه', 'bee', 'عسل', 'honey', 'خلايا نحل'],
  ['ماشيه', 'مواشي', 'بقر', 'غنم', 'cattle', 'livestock', 'قطيع', 'اغنام', 'lora', 'ابقار', 'رعي'],
  ['درون', 'طائره', 'drone', 'uav', 'مسيره', 'طيران', 'طائره بدون طيار', 'quadcopter'],
  ['منطاد', 'zeppelin', 'بالون', 'blimp', 'طبقات عليا', 'غلاف جوي', 'upper atmosphere'],
  ['روبوت', 'robot', 'روبوتات', 'robotic'],
  ['مشي', 'walking', 'يمشي', 'ارجل', 'legs', 'رجل', 'hexapod', 'عنكبوت', 'spider', 'يسير علي ارجل'],
  ['قارب', 'boat', 'مسطح مائي', 'بحيره', 'تنظيف مياه', 'نفايات عائمه', 'بحر', 'sea', 'سفينه'],
  ['موج', 'امواج', 'wave', 'طاقه امواج', 'مولد امواج'],
  ['طقس', 'جو', 'weather', 'رياح', 'wind', 'ضغط جوي', 'رصد جوي', 'مناخ', 'درجه حراره', 'temperature', 'رطوبه جو'],
  ['هواء', 'air', 'جوده الهواء', 'co2', 'تلوث', 'pollution', 'غبار', 'pm2.5', 'اكسيد الكربون'],
  ['سيل', 'سيول', 'فيضان', 'flood', 'مطر', 'امطار', 'وادي'],
  ['مبني', 'بناء', 'تشقق', 'تشققات', 'crack', 'جدار', 'خرسانه', 'هيكل', 'structure', 'شق'],
  ['اهتزاز', 'vibration', 'صيانه تنبويه', 'صيانه', 'predictive', 'ماكينه', 'محرك', 'machine', 'عطل', 'عطب', 'مصنع'],
  ['وجه', 'face', 'حضور', 'attendance', 'تعرف علي الوجه', 'recognition', 'طلاب', 'غياب', 'بصمه وجه'],
  ['قفل', 'lock', 'باب', 'door', 'rfid', 'بطاقه', 'card', 'دخول', 'access', 'كلمه سر', 'كلمه مرور', 'بوابه', 'gate', 'فتح باب', 'nfc'],
  ['حراسه', 'security', 'سرقه', 'تسلل', 'رادار', 'radar', 'حركه', 'motion', 'pir', 'وجود', 'presence', 'دخيل', 'intruder', 'لص', 'حرامي', 'يدخل حدا', 'يدخل شخص', 'اقتحام'],
  ['انذار', 'alarm', 'صفاره', 'جرس', 'buzzer', 'سايرن', 'siren'],
  ['كاميرا', 'camera', 'صوره', 'image', 'ليل', 'night', 'رؤيه', 'vision', 'اشعه تحت حمراء', 'ir', 'نظر ليلي', 'فيديو'],
  ['صوت', 'تفريغ', 'transcription', 'محاضره', 'اجتماع', 'meeting', 'متحدث', 'speaker', 'تسجيل', 'audio', 'كلام', 'speech', 'stt', 'محاضرات', 'جلسه'],
  ['انتحال', 'plagiarism', 'سرقه ادبيه', 'غش', 'تشابه نصوص', 'كشف انتحال', 'نسخ'],
  ['مساعد', 'chatbot', 'شات', 'ذكاء اصطناعي', 'ai', 'rag', 'مستند', 'مستندات', 'وثائق', 'اسال', 'سؤال', 'llm', 'gpt', 'يجاوب', 'بوت'],
  ['مهارات', 'تبادل', 'skill', 'نقاط', 'credits', 'خدمات', 'تبادل خدمات', 'منصه'],
  ['شحن', 'شحنه', 'شحنات', 'shipment', 'سلسله تبريد', 'logistics', 'ship', 'توصيل'],
  ['تتبع', 'tracking', 'gps', 'موقع', 'location', 'اصول', 'assets', 'asset', 'تحديد موقع', 'مكان'],
  ['عامل', 'عمال', 'worker', 'خوذه', 'helmet', 'محجر', 'محاجر', 'مناجم', 'سلامه مهنيه', 'safety', 'صناعي', 'موقع عمل'],
  ['قاطع', 'breaker', 'فني كهرباء', 'عامل صيانه', 'lockout', 'قاطع كهرباء'],
  ['انارة', 'اضاءه', 'شارع', 'شوارع', 'street', 'light', 'lamp', 'عمود', 'اعمده انارة', 'مصباح', 'كشاف'],
  ['بيت', 'منزل', 'home', 'اتمته', 'automation', 'تحكم عن بعد', 'بيوت', 'شقه', 'house'],
  ['تطبيق', 'app', 'موبايل', 'جوال', 'mobile', 'اشعار', 'تنبيه', 'notification', 'alert', 'رسايل', 'واتساب'],
  ['شبكه', 'network', 'اتصال', 'communication', 'wifi', 'واي فاي', 'بلوتوث', 'bluetooth', 'ارسال', 'بيانات', 'اتصالات'],
  ['بطاريه', 'battery', 'power bank', 'شحن بطاريه', 'ليثيوم'],
  ['حراره', 'temperature', 'سخونه', 'برد', 'حساس حراره', 'dht', 'ds18b20'],
  ['وزن', 'weight', 'ميزان', 'load cell', 'خلايا وزن', 'hx711', 'كيلو'],
  ['ذكاء اصطناعي', 'ai', 'تعلم الي', 'machine learning', 'ml', 'شبكه عصبيه', 'تصنيف صور', 'نموذج'],
  ['حيوان', 'animal', 'حيوانات', 'قط', 'كلب', 'مواشي'],
  ['طفل', 'اطفال', 'child', 'kids', 'رضيع', 'baby', 'حضانه'],
  ['لاجئ', 'كارثه', 'زلزال', 'disaster', 'اغاثه', 'انقاذ', 'rescue', 'بحث وانقاذ', 'طوارئ كوارث'],
];

const WEAK = new Set(['تطبيق', 'شبكه', 'حراره', 'انذار', 'بيت']);
let CMAP: Map<string, number[]> | null = null;
let CPHR: { ids: number[]; phrase: string }[] = [];
function conceptMap() {
  if (CMAP) return CMAP;
  CMAP = new Map(); CPHR = [];
  CONCEPTS.forEach((grp, id) => {
    for (const f of grp) {
      const ts = norm(f).split(' ').map(stem).filter(Boolean);
      if (!ts.length) continue;
      if (ts.length === 1) { const a = CMAP!.get(ts[0]) ?? []; if (!a.includes(id)) a.push(id); CMAP!.set(ts[0], a); }
      else CPHR.push({ ids: [id], phrase: ' ' + ts.join(' ') + ' ' });
    }
  });
  return CMAP;
}
export function tokenize(text: string): { terms: string[]; concepts: number[]; covered: Set<string> } {
  const cm = conceptMap();
  const toks = norm(text).split(' ').filter(Boolean).map(stem).filter((t) => t.length >= 2 && !STOP.has(t));
  const concepts = new Set<number>(), covered = new Set<string>();
  toks.forEach((t) => {
    let ids = cm.get(t);
    if (!ids && t.length >= 4 && 'وبلكف'.includes(t[0])) ids = cm.get(t.slice(1));   // "وري" ← "ري"، "بالماء"…
    if (ids) { ids.forEach((id) => concepts.add(id)); covered.add(t); }
  });
  const joined = ' ' + toks.join(' ') + ' ';
  CPHR.forEach((p) => { if (joined.includes(p.phrase)) { p.ids.forEach((id) => concepts.add(id)); p.phrase.trim().split(' ').forEach((w) => covered.add(w)); } });
  return { terms: toks, concepts: [...concepts], covered };
}

interface Indexed<T extends SearchDoc> { doc: T; tf: Map<string, number>; len: number; title: Set<string> }
export function buildIndex<T extends SearchDoc>(docs: T[]) {
  const idx: Indexed<T>[] = []; const df = new Map<string, number>();
  for (const doc of docs) {
    const fields = doc.fields ?? [{ w: 3, text: doc.title }, { w: 2, text: doc.tags.join(' ') }, { w: 2, text: doc.desc }];
    const tf = new Map<string, number>(); let len = 0;
    for (const f of fields) {
      const { terms, concepts } = tokenize(f.text);
      terms.forEach((t) => { tf.set(t, (tf.get(t) ?? 0) + f.w); len += f.w; });
      concepts.forEach((c) => tf.set('#' + c, Math.max(tf.get('#' + c) ?? 0, f.w * 1.2)));
    }
    tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1));
    const tt = tokenize(doc.title); const title = new Set<string>([...tt.terms, ...tt.concepts.map((c) => '#' + c)]);
    idx.push({ doc, tf, len: Math.max(1, len), title });
  }
  const N = idx.length, avg = idx.reduce((s, d) => s + d.len, 0) / Math.max(1, N);
  const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  return { idx, N, avg, idf };
}
export type Index<T extends SearchDoc> = ReturnType<typeof buildIndex<T>>;

const K = 1.2, B = 0.5;
export function search<T extends SearchDoc>(index: Index<T>, query: string, limit = 5): SearchResult<T> {
  const { terms, concepts, covered } = tokenize(query);
  const qTerms = [...new Set(terms)], qCons = concepts.map((c) => '#' + c);
  const items: { t: string; w: number; label: string }[] = [
    ...qTerms.filter((t) => !covered.has(t)).map((t) => ({ t, w: GENERIC.has(t) ? 0.4 : 1, label: t })),
    ...qCons.map((c, i) => ({ t: c, w: WEAK.has(CONCEPTS[concepts[i]][0]) ? 0.6 : 1.5, label: CONCEPTS[concepts[i]][0] })),
  ];
  const informative = items.filter((it) => it.w >= 1).length;
  if (!informative) return { verdict: 'vague', hits: [], informative: 0 };
  const maxScore = items.reduce((s, it) => s + index.idf(it.t) * (K + 1) * it.w, 0) || 1;
  const qStems = qTerms.filter((t) => !GENERIC.has(t));
  const hits: Hit<T>[] = index.idx.map(({ doc, tf, len, title }) => {
    let score = 0; const matched: string[] = [];
    for (const it of items) {
      const f = tf.get(it.t); if (!f) continue;
      score += index.idf(it.t) * ((f * (K + 1)) / (f + K * (1 - B + (B * len) / index.avg))) * it.w;
      if (title.has(it.t)) score += 0.35 * index.idf(it.t) * (K + 1) * it.w;
      if (it.w >= 1) matched.push(it.label);
    }
    for (const t of qStems) if (title.has(t)) score += 0.3 * (K + 1);
    return { doc, score, coverage: Math.min(1, score / maxScore), matched: [...new Set(matched)] };
  }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  const top = hits[0], second = hits[1];
  let verdict: Verdict = 'none';
  if (top) {
    const distinct = !second || top.score >= second.score * 1.15 || top.coverage >= 0.8;
    const many = top.matched.length >= 2;
    if (top.coverage >= 0.5 && distinct) verdict = 'exists';
    else if (top.coverage >= 0.22 && (many || (informative <= 2 && top.coverage >= 0.45))) verdict = 'close';
    if (verdict === 'none' && informative <= 1) verdict = 'vague';
  } else if (informative <= 1) verdict = 'vague';
  return { verdict, hits, informative };
}
