# الخطوات الجاية

آخر تحديث: ١٦ أكتوبر ٢٠٢٦. فرع `design/navy-neon`، PR #2.

## انعملت بس لسا ما انفحصت بالمتصفح
- صفحة المشاريع (`components/Projects.astro`): الفلترين بسطر واحد بالموبايل.
- صفحة المشروع (`scripts/cart.ts` و`components/Cart.astro`): البدائل مطوية تحت «بدائل (n)».
- صفحة المجتمعات (`pages/communities.astro`): المسجّل بجامعة بيشوف «مجتمعك» أول.

## لسا ما بلّشت
1. عنوان الرئيسية (`components/Hero3D.astro`): يصير «مشروعك شغلك إنت، والعقبات علينا» بدل «من فكرة مشروع إلى مناقشة ناجحة» (بيتكرر مع صفحة البداية).
2. صور المشاريع الثلاثية الأبعاد بالكروت (`scripts/thumbs.ts`): نكبّر المجسّم، أو نحط صور حقيقية للمشاريع المنفّذة.
3. صفحة البداية (`pages/index.astro`، `data/intro.ts`، `scripts/intro3d.ts`):
   - نشيل الرموز U1–U5 وJ1 (نفس العنوان اللي تحتها).
   - نشيل سجل التشغيل «> LINK … READY».
   - «٥٠ فكرة مشروع جاهزة» تنحسب من البيانات (هلأ ٩٨).

## نسخة المعاينة على السيرفر
- نسختنا مرفوعة على `http://beta.projects.tfs.ink` (المجلد `~/beta-site`)، ومخفية عن جوجل بـ`robots.txt` وهيدر noindex.
- **HTTPS لسا ناقص:** acme.sh ما قدر يتحقق، لأنه مسار `/.well-known/acme-challenge` بيرجّع 404 على هالـsubdomain (وعلى projects.tfs.ink كمان). وAutoSSL مش مفعّل بالحساب. نجرّب التحقق بالـDNS، أو نسأل Namecheap.
- لتحديث النسخة: `npm run build` وبعدين نرفع `site/dist` لـ`~/beta-site` (لازم نحافظ على `.htaccess` و`robots.txt`).

## قبل الإطلاق
- رقم واتساب حقيقي بـ`site/src/data/config.ts` (هلأ `962790000000`).
- ربط Supabase: `docs/supabase-setup.sql` + مفتاحين بـCloudflare Pages + حساب أدمن باسم The Four Coders.
- بالأدمن: حذف أي منشور، بلوك ناس، نشر باسم The Four Coders، خبر المسابقة بقناة الإعلانات.
- إشعارات حتى لو الموقع مسكّر (Web Push + PWA، واختياري بوت تيليجرام للأدمن).
