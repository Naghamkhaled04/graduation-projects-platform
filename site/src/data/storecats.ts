import catalog from './novatera.json';

export interface Prod { id: string; nm: string; cat: string; p: number; img: string }
export const PRODUCTS = catalog as Prod[];

/** أقسام المتجر بترتيب مقصود، مع أيقونة ورابط لكل قسم */
const ORDER: { cat: string; slug: string; icon: string; blurb: string }[] = [
  { cat: 'متحكمات وألواح تطوير', slug: 'boards', icon: 'ai', blurb: 'عقل مشروعك: أردوينو، ESP32، راسبيري' },
  { cat: 'حساسات ووحدات', slug: 'sensors', icon: 'flask', blurb: 'حرارة، رطوبة، غاز، حركة، مسافة' },
  { cat: 'محركات', slug: 'motors', icon: 'robot', blurb: 'سيرفو، ستيبر، DC، ومشغّلاتها' },
  { cat: 'شاشات', slug: 'displays', icon: 'eye', blurb: 'LCD وOLED وTFT بكل المقاسات' },
  { cat: 'طاقة ومزوّدات', slug: 'power', icon: 'energy', blurb: 'محوّلات، منظّمات، ألواح شمسية' },
  { cat: 'بطاريات', slug: 'batteries', icon: 'energy', blurb: 'ليثيوم، شواحن، حاملات' },
  { cat: 'أسلاك وموصلات', slug: 'wires', icon: 'send', blurb: 'جامبر، موصلات، لوحات تجارب' },
  { cat: 'وحدات لاسلكية', slug: 'wireless', icon: 'chat', blurb: 'واي فاي، بلوتوث، LoRa، RF' },
  { cat: 'أطقم أردوينو', slug: 'kits', icon: 'box', blurb: 'أطقم جاهزة للتعلّم من الصفر' },
  { cat: 'أطقم روبوت', slug: 'robot-kits', icon: 'robot', blurb: 'شاسيهات، عجلات، أذرع' },
  { cat: 'طباعة ثلاثية الأبعاد و CNC', slug: '3d-cnc', icon: 'building', blurb: 'فلامنت، قطع غيار، مستلزمات' },
  { cat: 'راسبيري باي', slug: 'raspberry', icon: 'ai', blurb: 'ألواح راسبيري وملحقاتها' },
  { cat: 'المنزل الذكي', slug: 'smart-home', icon: 'home', blurb: 'مفاتيح، مرحّلات، تحكم عن بُعد' },
  { cat: 'ليدات وإضاءة', slug: 'led', icon: 'energy', blurb: 'ليدات، شرائط، مصفوفات' },
  { cat: 'أطقم للأطفال', slug: 'kids', icon: 'medal', blurb: 'تعليمية وآمنة للصغار' },
  { cat: 'متنوّعات', slug: 'misc', icon: 'box', blurb: 'قطع وأدوات متفرقة' },
];

export const CATEGORIES = ORDER.filter((c) => PRODUCTS.some((p) => p.cat === c.cat))
  .map((c) => ({ ...c, n: PRODUCTS.filter((p) => p.cat === c.cat).length }));

export const catBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const slugOf = (cat: string) => ORDER.find((c) => c.cat === cat)?.slug ?? '';
export const productsOf = (cat: string) => PRODUCTS.filter((p) => p.cat === cat);

/** قطع مختارة للواجهة: الأرخص من كل قسم أساسي، بترتيب ثابت */
export const FEATURED = ['متحكمات وألواح تطوير', 'حساسات ووحدات', 'شاشات', 'محركات', 'وحدات لاسلكية', 'طاقة ومزوّدات', 'بطاريات', 'أسلاك وموصلات']
  .flatMap((c) => productsOf(c).filter((p) => p.p > 0).sort((a, b) => a.p - b.p).slice(0, 1));

/** خدماتنا: نفس ما نقدّمه بالمتجر */
/** خدماتنا — مطابقة لما هو معروض فعلاً بالمتجر */
export const SERVICES = [
  { icon: 'store', t: 'توفير القطع', d: 'كل مستلزمات مشروعك بمكان واحد، واللي مش موجود بنجيبه بالطلب.' },
  { icon: 'building', t: 'طباعة ثلاثية الأبعاد و CNC', d: 'علبة لمشروعك، حامل، أو قطعة مخصصة — بنطبعها ونقصّها لك.' },
  { icon: 'ai', t: 'تصميم وتنفيذ دارات أردوينو', d: 'اختيار القطع، تصميم الدارة، وتجميع نموذج يشتغل.' },
  { icon: 'chat', t: 'تطبيقات ويب وهواتف', d: 'لوحة تحكم أو تطبيق يقرأ بيانات مشروعك ويعرضها.' },
  { icon: 'flask', t: 'استشارة تقنية', d: 'المسار التقني وحلول التحديات، بجلسة ومستند.' },
];

export const ar = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 3 });
