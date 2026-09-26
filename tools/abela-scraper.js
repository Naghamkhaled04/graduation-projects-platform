/*
 * سحب كتالوج أبيلا كامل من المتصفح.
 *
 * الاستعمال:
 *  1. افتح https://www.abelaelectronic.com/en بكروم وسكّر أي نافذة تسجيل دخول.
 *  2. F12 ← Console، الصق هاد الملف كامل واضغط Enter.
 *  3. استنى (تقريباً ١٠–٢٠ دقيقة). التقدّم بيطلع بالكونسول وبينحفظ بـ localStorage،
 *     فلو انقطع إشي أعد لصق السكربت وبيكمّل من مكانه.
 *  4. بالآخر بينزل ملف abela.json — حطّه بـ site/src/data/abela.json
 *
 * بيفتح كل صفحة داخل iframe مخفي (نفس الموقع) وبيستنى .product-card تظهر، لأن الموقع
 * بيرسم المنتجات بجافاسكريبت وبيمنع الطلبات المباشرة.
 * لبدء السحب من الصفر: localStorage.removeItem('abelaScrape')
 */
(async () => {
  const KEY = 'abelaScrape';
  const BASE = location.origin + '/en';
  const SKIP = /sale|new[-_]?items?|offers?/i; // "Big sale" و "New Items" مش أقسام حقيقية
  const MAX_PAGES = 80;

  const st = JSON.parse(localStorage.getItem(KEY) || 'null') || { cats: {}, products: {}, done: {} };
  const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  const log = (...a) => console.log('%c[abela]', 'color:#fa7b19;font-weight:bold', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:900px;';
  document.body.appendChild(frame);

  /** يفتح الرابط بالـ iframe ويرجّع الـ document بعد ما تثبت عدد البطاقات */
  async function load(url) {
    await new Promise((res) => { frame.onload = res; frame.src = url; setTimeout(res, 30000); });
    let last = -1, stable = 0;
    for (let i = 0; i < 40; i++) {           // لحد ٢٠ ثانية
      await sleep(500);
      const doc = frame.contentDocument;
      if (!doc) continue;
      const n = doc.querySelectorAll('.product-card').length;
      if (n === last) stable++; else { stable = 0; last = n; }
      if (stable >= 3 && (n > 0 || i > 12)) return doc; // ثابت ١.٥ ثانية، أو فاضي بعد ٦ ثواني
    }
    return frame.contentDocument;
  }

  const num = (t) => {
    const m = String(t || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  function readCards(doc, cat) {
    const out = [];
    for (const card of doc.querySelectorAll('.product-card')) {
      const a = card.querySelector('a.product-name') || card.querySelector('a[href*="/products/"]');
      const href = a?.getAttribute('href') || '';
      const slug = decodeURIComponent(href.split('?')[0].replace(/\/+$/, '').split('/').pop() || '');
      const nm = (card.querySelector('.product-name h6') || a)?.textContent.trim().replace(/\s+/g, ' ');
      const priceEl = card.querySelector('[class*=price]');
      const priceText = priceEl?.textContent.trim().replace(/\s+/g, ' ') || '';
      const img = card.querySelector('img');
      const src = img?.currentSrc || img?.getAttribute('data-src') || img?.getAttribute('src') || '';
      if (!slug || !nm) continue;
      out.push({ id: slug, nm, p: num(priceText), priceText, img: src ? new URL(src, location.href).href : '', cat });
    }
    return out;
  }

  async function crawl(pathFn, cat) {
    let prevFirst = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = pathFn(page);
      if (st.done[url]) continue;
      const doc = await load(url);
      const cards = readCards(doc, cat);
      if (!cards.length || cards[0].id === prevFirst) { st.done[url] = 'end'; save(); break; }
      prevFirst = cards[0].id;
      for (const c of cards) {
        const old = st.products[c.id];
        // القسم الحقيقي بيغلب؛ صفحات "كل المنتجات" ما إلها قسم
        st.products[c.id] = { ...old, ...c, cat: c.cat || old?.cat || '' , cats: [...new Set([...(old?.cats || []), c.cat].filter(Boolean))] };
      }
      st.done[url] = cards.length; save();
      log(`${cat || 'كل المنتجات'} · صفحة ${page} · ${cards.length} منتج · المجموع ${Object.keys(st.products).length}`);
    }
  }

  // ١) الأقسام من قائمة الموقع
  if (!Object.keys(st.cats).length) {
    const doc = await load(BASE);
    for (const d of [document, doc]) {
      for (const a of d.querySelectorAll('a[href*="/categories/"]')) {
        const m = a.getAttribute('href').match(/\/categories\/([^/?#]+)/);
        const name = a.textContent.trim().replace(/\s+/g, ' ');
        if (m && name && !SKIP.test(m[1]) && !SKIP.test(name)) st.cats[decodeURIComponent(m[1])] = name;
      }
    }
    save();
    log('الأقسام:', st.cats);
    if (!Object.keys(st.cats).length) log('ما لقيت أقسام — رح أسحب "كل المنتجات" بس');
  }

  // ٢) كل قسم، ٣) كل المنتجات (عشان ما يفوتنا منتج بلا قسم)
  for (const [slug, name] of Object.entries(st.cats)) {
    await crawl((p) => `${BASE}/categories/${encodeURIComponent(slug)}/products?page=${p}`, name);
  }
  await crawl((p) => `${BASE}/products?page=${p}`, '');

  const list = Object.values(st.products).sort((a, b) => a.nm.localeCompare(b.nm));
  log(`خلصنا: ${list.length} منتج (المتوقع تقريباً ١٠٦٠). بلا سعر: ${list.filter((x) => x.p == null).length}. بلا قسم: ${list.filter((x) => !x.cat).length}`);
  const blob = new Blob([JSON.stringify({ scrapedAt: new Date().toISOString(), cats: st.cats, products: list }, null, 1)], { type: 'application/json' });
  const dl = document.createElement('a');
  dl.href = URL.createObjectURL(blob); dl.download = 'abela.json'; dl.click();
  frame.remove();
})();
