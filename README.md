# موقع مشاريع التخرج

موقع يعرض أفكار مشاريع تخرج مع مكوناتها، ويبيع الاستشارة التقنية وسلة القطع الجاهزة.

**اقرأ `CONTEXT.md` أولاً** — يشرح نموذج العمل وكل القرارات المتخذة.

---

## التشغيل

كل الملفات HTML خام — تفتح مباشرة بالمتصفح.

```bash
# أو شغّل خادماً محلياً لتجنّب قيود file://
python3 -m http.server 8000
```

ثم افتح `http://localhost:8000/pages/index.html`

---

## البنية

```
CONTEXT.md              ← ابدأ من هنا
README.md

pages/
  index.html            الصفحة الرئيسية · قائمة المشاريع
  project-boat.html     مشروع القارب — القالب المرجعي
  project-wave.html     مشروع الطاقة الموجية
  cart-template.html    قالب السلة منفرداً

demos/
  boat-3d.html          مجسم القارب
  booking-system.html   نظام حجز المواعيد (المشروع الثاني)
  cinematic-render.html عرض سينمائي للتسجيل
  3d-showcase.html      مرجع تقني — أقصى واقعية
  isometric-icons.html  رسومات isometric
  logo-explorations.html استكشافات الشعار

docs/
  business-plan.md      خطة الأفكار الأربعة
  booking-db-schema.md  مخطط قاعدة بيانات المنصة
  adding-projects.md    كيف تضيف مشروعاً جديداً

assets/                 (فارغ — للصور والفيديو لاحقاً)
```

---

## مهام عاجلة

```
[ ] حسم اسم الشركة + فحص الدومين
[ ] تحديث WHATSAPP في كل الصفحات
[ ] جلب أسعار ABELA الحقيقية وتحديث السلات
[ ] كتابة ١٠ مشاريع إضافية (انظر adding-projects.md)
[ ] استبدال العلامة المائية "مشاريع" بالاسم النهائي
```

### أماكن التعديل

**رقم الواتساب** — أعلى السكربت في كل صفحة:
```javascript
const WHATSAPP = '962790000000';
```

**اسم الشركة** — في `demos/cinematic-render.html`:
```javascript
const BRAND = 'مشاريع';
const BRAND_MARK = 'م';
```

وفي رأس كل صفحة:
```html
<div class="logo"><i>م</i> مشاريع</div>
```

---

## قواعد

- عربي · RTL · IBM Plex Sans Arabic
- اللون الأساسي `#5B3DF5`
- المسافات: `4 · 8 · 12 · 16 · 24 · 32` فقط
- الأسعار بالدينار كأعداد صحيحة
- **لا محتوى منسوخ** — كل الرسومات والمجسمات من إنتاجنا
- لا نبيع أكواداً — استشارة فقط
