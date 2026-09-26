# مخطط قاعدة البيانات الكامل — منصة Super Marketplace

> MongoDB + Redis + Elasticsearch
> الإصدار 1.0

---

## القرارات التصميمية الأساسية

قبل الجداول، هذي أربع قرارات تحدد شكل النظام كله. لو غلطت فيهم، راح تعيد كتابة نص المشروع لاحقاً.

### القرار 1: كيف نتعامل مع اختلاف الفئات؟

المشكلة: العطر عنده `حجم` و`نوع الرائحة`، والفستان عنده `مقاس` و`لون`، والوجبة عندها `وقت تحضير`. كيف نخزنهم بنفس الـ collection؟

| الخيار | الوصف | الحكم |
|--------|-------|-------|
| **أ. collection لكل فئة** | `restaurants_products`, `fragrances_products`... | ❌ كارثة. البحث الموحد يصير مستحيل، وكل فئة جديدة = كود جديد |
| **ب. EAV** (جدول خصائص منفصل) | صف لكل خاصية | ❌ نمط SQL قديم. بطيء جداً بـ Mongo، والاستعلامات كابوس |
| **ج. حقل `attributes` مرن + تعريف بالفئة** | خصائص كـ sub-document، الفئة تعرّف الـ schema | ✅ **الموصى به** |

**الخيار ج** يعني: `products` collection واحد، فيه حقل `attributes` يقبل أي شكل، و`categories` collection يحمل تعريف الخصائص المسموحة لكل فئة (النوع، إلزامي أو لا، هل يُبحث فيه). التحقق يصير على مستوى التطبيق عند الإدخال.

الفائدة: تضيف فئة جديدة (إلكترونيات، أثاث) بإدخال مستند واحد بـ `categories` — بدون سطر كود.

### القرار 2: تخزين المبالغ

**لا تستخدم `float` أبداً للفلوس.** خزّن كأعداد صحيحة.

```javascript
// ❌ غلط
price: 150000.50

// ✅ صح — الدينار العراقي بلا كسور أصلاً
price_iqd: 150000        // عدد صحيح

// ✅ للعملات ذات الكسور (درهم، ريال، دولار)
price_minor: 36000       // 360.00 درهم مخزنة كـ 36000 فلس
currency: "AED"
```

سبب هذا أن `0.1 + 0.2 !== 0.3` بالأرقام العشرية، وبعد ألف طلب راح تلاقي فروقات بالحسابات ما تعرف من وين جت.

### القرار 3: العملات المتعددة

**لا تخزّن السعر بكل عملة داخل المنتج.** أسعار الصرف تتغير، والبيانات تصير قديمة وتحتاج تحديث ملايين المستندات.

```javascript
// ❌ غلط
price: { IQD: 150000, AED: 360, USD: 115 }

// ✅ صح
base_price: 150000,
base_currency: "IQD"
// التحويل يصير وقت العرض من collection أسعار الصرف
```

استثناء واحد: **بعد إتمام الطلب**، جمّد السعر والعملة والسعر التحويلي داخل الطلب نفسه. الطلب سجل تاريخي، ما يتأثر بتغير الأسعار.

### القرار 4: المتغيرات (Variants)

الفستان بمقاس M أحمر وM أزرق: هل هما منتجان أم منتج واحد؟

**منتج واحد + مصفوفة variants مدمجة.** كل variant عنده SKU ومخزون وسعر خاص فيه.

السبب: العميل يبحث عن "فستان أسود"، مش عن "فستان أسود مقاس M". العرض على مستوى المنتج، الشراء على مستوى الـ variant.

الحد: لو المنتج عنده أكثر من ~50 variant، افصلهم لـ collection مستقل. تحت هذا الرقم، الدمج أسرع.

---

## الفهرس

| # | Collection | الغرض |
|---|-----------|-------|
| 1 | `users` | العملاء والبائعون والإدارة |
| 2 | `addresses` | عناوين المستخدمين |
| 3 | `vendors` | ملفات المتاجر |
| 4 | `categories` | الفئات وتعريف خصائصها |
| 5 | `products` | المنتجات والمتغيرات والوسائط |
| 6 | `inventory_logs` | حركة المخزون |
| 7 | `carts` | السلات |
| 8 | `orders` | الطلبات |
| 9 | `payments` | المعاملات المالية |
| 10 | `wallets` | المحافظ |
| 11 | `wallet_transactions` | حركة المحافظ |
| 12 | `payouts` | تسويات البائعين |
| 13 | `cities` | المدن ومناطق الخدمة |
| 14 | `shipping_rates` | أسعار الشحن |
| 15 | `shipments` | الشحنات والتتبع |
| 16 | `reviews` | التقييمات |
| 17 | `conversations` | محادثات العميل↔البائع |
| 18 | `messages` | الرسائل |
| 19 | `ai_sessions` | جلسات وكيل الـ AI |
| 20 | `user_profiles` | ملف التفضيلات السلوكي |
| 21 | `coupons` | الكوبونات والعروض |
| 22 | `loyalty_accounts` | نقاط الولاء |
| 23 | `referrals` | الإحالات |
| 24 | `group_buys` | الشراء الجماعي |
| 25 | `favorites` | المفضلة |
| 26 | `notifications` | الإشعارات |
| 27 | `exchange_rates` | أسعار الصرف |
| 28 | `platform_settings` | إعدادات المنصة |
| 29 | `audit_logs` | سجل التدقيق |
| 30 | `events` | أحداث التحليلات |

---

## 1. users

مستخدم واحد لكل الأدوار. البائع = مستخدم دوره `vendor` ومرتبط بـ `vendor_id`.

```javascript
{
  _id: ObjectId,

  // الهوية
  phone: "+9647701234567",        // فريد — رقم الهاتف هو المعرّف الأساسي
  phone_verified: true,
  email: "ahmed@example.com",     // اختياري
  email_verified: false,
  password_hash: "$2b$12$...",    // bcrypt، cost >= 12

  // الملف الشخصي
  full_name: "أحمد محمود",
  avatar_url: "https://cdn.../avatars/u123.webp",
  gender: "male",                 // male | female | undisclosed
  birth_date: ISODate,            // للتوصيات العمرية

  // الأدوار
  roles: ["customer"],            // customer | vendor | admin | support
  vendor_id: ObjectId,            // موجود فقط لو الدور vendor
  permissions: [],                // للإدارة: ["orders.refund", "vendors.approve"]

  // الموقع
  city_id: ObjectId,
  default_address_id: ObjectId,
  preferred_currency: "IQD",
  preferred_language: "ar",       // ar | en | ku

  // الحالة
  status: "active",               // active | suspended | deleted
  suspension_reason: null,

  // الأمان
  last_login_at: ISODate,
  failed_login_attempts: 0,
  locked_until: null,
  refresh_token_family: "uuid",   // لإبطال كل الجلسات دفعة واحدة

  // الأجهزة (للإشعارات)
  devices: [
    {
      device_id: "uuid",
      push_token: "ExponentPushToken[...]",
      platform: "ios",            // ios | android | web
      last_seen_at: ISODate
    }
  ],

  created_at: ISODate,
  updated_at: ISODate
}
```

**الفهارس**
```javascript
db.users.createIndex({ phone: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true, sparse: true })
db.users.createIndex({ vendor_id: 1 }, { sparse: true })
db.users.createIndex({ city_id: 1, status: 1 })
```

> **مهم:** لا تخزن كلمات المرور إلا بـ bcrypt أو argon2. ولا تخزن أرقام البطاقات إطلاقاً — بوابة الدفع تعطيك `token` وهذا اللي تخزنه.

---

## 2. addresses

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,

  label: "البيت",                  // البيت | العمل | نص حر
  recipient_name: "أحمد محمود",
  phone: "+9647701234567",

  city_id: ObjectId,
  district: "الكرادة",
  street: "شارع 62",
  building: "بناية النور، شقة 12",
  landmark: "مقابل صيدلية الشفاء",  // مهم جداً بالعراق — العناوين غير مرقمة

  location: {
    type: "Point",
    coordinates: [44.3615, 33.3157]  // [lng, lat] — الترتيب مهم!
  },

  is_default: false,
  created_at: ISODate
}
```

**الفهارس**
```javascript
db.addresses.createIndex({ user_id: 1, is_default: -1 })
db.addresses.createIndex({ location: "2dsphere" })   // للبحث الجغرافي
```

---

## 3. vendors

```javascript
{
  _id: ObjectId,
  owner_user_id: ObjectId,

  // الهوية التجارية
  business_name: "عطور الشرق",
  slug: "otoor-alsharq",           // للروابط
  logo_url: "https://cdn.../logo.webp",
  cover_url: "https://cdn.../cover.webp",
  description: "متخصصون بالعود والعطور الشرقية منذ 1998",

  category_ids: [ObjectId],        // بائع ممكن يبيع بأكثر من فئة
  primary_category_id: ObjectId,

  // الموقع
  city_id: ObjectId,
  address: {
    district: "الكرادة",
    street: "...",
    location: { type: "Point", coordinates: [44.36, 33.31] }
  },
  serves_cities: [ObjectId],       // المدن اللي يشحن لها

  // التوثيق
  verification: {
    status: "verified",            // pending | verified | rejected
    business_license_url: "...",   // وصول مقيّد — الإدارة فقط
    owner_id_url: "...",
    verified_at: ISODate,
    verified_by: ObjectId,
    rejection_reason: null
  },

  // ساعات العمل
  working_hours: {
    timezone: "Asia/Baghdad",
    schedule: {
      sunday:    { open: "09:00", close: "22:00", closed: false },
      monday:    { open: "09:00", close: "22:00", closed: false },
      friday:    { open: "16:00", close: "23:00", closed: false }
      // ... باقي الأيام
    },
    exceptions: [                  // أعياد وإجازات
      { date: "2026-03-20", closed: true, reason: "عيد الفطر" }
    ]
  },
  is_accepting_orders: true,       // مفتاح يدوي للبائع (busy mode)

  // الإحصائيات المحسوبة مسبقاً (denormalized للسرعة)
  stats: {
    rating_avg: 4.8,
    rating_count: 245,
    products_count: 150,
    orders_completed: 1820,
    cancellation_rate: 0.021,      // نسبة الإلغاء من طرفه
    avg_response_time_min: 8,      // متوسط سرعة الرد بالدردشة
    avg_prep_time_min: 22          // للمطاعم
  },

  // الشروط المالية
  commission_rate: 12.0,           // نسبة مئوية — تتجاوز الإعداد العام
  payout: {
    method: "bank_transfer",
    bank_name: "مصرف الرافدين",
    account_holder: "أحمد محمود",
    iban_masked: "IQ**********4471",   // مقنّع — الكامل بخزنة مشفرة
    payout_cycle: "weekly"         // daily | weekly | biweekly
  },
  balance_pending: 4250000,        // IQD — مبالغ لم تُصرف بعد
  balance_available: 1800000,

  // إعدادات المتجر
  settings: {
    free_shipping_threshold: 150000,   // null = لا يوجد
    return_policy_days: 7,
    accepts_cod: true,
    min_order_value: 25000,
    auto_accept_orders: false
  },

  status: "active",                // active | paused | suspended | closed
  created_at: ISODate,
  updated_at: ISODate
}
```

**الفهارس**
```javascript
db.vendors.createIndex({ slug: 1 }, { unique: true })
db.vendors.createIndex({ city_id: 1, status: 1, "stats.rating_avg": -1 })
db.vendors.createIndex({ category_ids: 1, city_id: 1 })
db.vendors.createIndex({ "address.location": "2dsphere" })
```

> **تحذير أمني:** الـ IBAN والوثائق الرسمية لا تخزنها كنص عادي. استخدم تشفير على مستوى الحقل (field-level encryption) أو خدمة أسرار مثل AWS Secrets Manager، وخزّن هنا المرجع فقط.

---

## 4. categories

هذا **قلب النظام**. كل فئة تعرّف خصائصها بنفسها.

```javascript
{
  _id: ObjectId,
  slug: "fragrances",
  name: { ar: "العطور", en: "Fragrances", ku: "بۆنەکان" },
  icon: "💐",
  parent_id: null,                 // للفئات الفرعية
  display_order: 2,

  // نموذج العمل — يحدد سلوك الطلب كله
  fulfillment_model: "shipping",   // shipping | food_delivery | pickup_only
  
  // الخصائص المتاحة لهذه الفئة
  attribute_schema: [
    {
      key: "scent_family",
      label: { ar: "عائلة الرائحة", en: "Scent Family" },
      type: "enum",                // text|number|enum|multi_enum|boolean|range
      options: [
        { value: "woody",  label: { ar: "خشبي" } },
        { value: "floral", label: { ar: "زهري" } },
        { value: "oriental", label: { ar: "شرقي" } },
        { value: "fresh",  label: { ar: "منعش" } }
      ],
      required: true,
      filterable: true,            // يظهر بفلاتر البحث
      searchable: true,            // يدخل بفهرس Elasticsearch
      ai_relevant: true            // الـ AI يستخدمه بالتوصيات
    },
    {
      key: "longevity_hours",
      label: { ar: "الثبات بالساعات" },
      type: "number",
      min: 1, max: 24,
      required: false,
      filterable: true,
      ai_relevant: true
    },
    {
      key: "is_original",
      label: { ar: "أصلي" },
      type: "boolean",
      required: true,
      filterable: true
    }
  ],

  // محاور المتغيرات لهذه الفئة
  variant_axes: [
    { key: "size", label: { ar: "الحجم" }, options: ["30ml", "50ml", "100ml"] }
  ],

  commission_rate: 12.0,           // الافتراضي للفئة
  requires_expiry_date: false,
  created_at: ISODate
}
```

### أمثلة لباقي الفئات

```javascript
// مطاعم
{
  slug: "restaurants",
  fulfillment_model: "food_delivery",
  attribute_schema: [
    { key: "cuisine", type: "enum", options: ["عراقي","لبناني","تركي","إيطالي","برجر"], filterable: true },
    { key: "prep_time_min", type: "number", required: true },
    { key: "spice_level", type: "enum", options: ["بدون","خفيف","متوسط","حار"], ai_relevant: true },
    { key: "is_vegetarian", type: "boolean", filterable: true },
    { key: "calories", type: "number" }
  ],
  variant_axes: [
    { key: "portion", options: ["صغير","وسط","كبير"] }
  ]
}

// ملابس
{
  slug: "clothing",
  fulfillment_model: "shipping",
  attribute_schema: [
    { key: "gender", type: "enum", options: ["رجالي","نسائي","أطفال","للجنسين"], filterable: true },
    { key: "material", type: "enum", options: ["قطن","بوليستر","صوف","حرير","جينز"] },
    { key: "season", type: "multi_enum", options: ["صيفي","شتوي","ربيعي"] },
    { key: "fit", type: "enum", options: ["ضيق","عادي","واسع"], ai_relevant: true }
  ],
  variant_axes: [
    { key: "size",  options: ["XS","S","M","L","XL","XXL"] },
    { key: "color", options: ["أسود","أبيض","أحمر","أزرق","بيج"] }
  ]
}

// مكياج ومستحضرات تجميل
{
  slug: "beauty",
  fulfillment_model: "shipping",
  requires_expiry_date: true,
  attribute_schema: [
    { key: "skin_type", type: "multi_enum", options: ["دهنية","جافة","مختلطة","حساسة"], ai_relevant: true },
    { key: "coverage", type: "enum", options: ["خفيف","متوسط","كامل"] },
    { key: "finish", type: "enum", options: ["مطفي","لامع","طبيعي"] },
    { key: "is_cruelty_free", type: "boolean", filterable: true }
  ],
  variant_axes: [
    { key: "shade", options: [] }   // فارغ = البائع يدخل قيمه بحرية
  ]
}
```

---

## 5. products

```javascript
{
  _id: ObjectId,
  vendor_id: ObjectId,
  category_id: ObjectId,
  city_id: ObjectId,               // منسوخ من البائع لتسريع الفلترة

  // المعلومات الأساسية
  name: { ar: "عود الليل", en: "Oud Al Layl" },
  slug: "oud-al-layl-x7k2",
  description: { ar: "عود فاخر...", en: "..." },
  brand: "عطور الشرق",
  sku: "OTR-OUD-001",

  // التسعير (بالعملة الأساسية، عدد صحيح)
  base_currency: "IQD",
  price: 150000,
  compare_at_price: 180000,        // السعر قبل الخصم — للشطب
  cost_price: 95000,               // تكلفة البائع — لا تُعرض للعميل أبداً

  // الخصائص حسب تعريف الفئة
  attributes: {
    scent_family: "woody",
    longevity_hours: 12,
    is_original: true
  },

  // المتغيرات
  has_variants: true,
  variants: [
    {
      variant_id: "v1",
      sku: "OTR-OUD-001-30",
      axes: { size: "30ml" },
      price: 150000,               // يتجاوز سعر المنتج
      stock: 25,
      barcode: "6291041500213",
      image_index: 0               // أي صورة تمثل هذا المتغير
    },
    {
      variant_id: "v2",
      sku: "OTR-OUD-001-50",
      axes: { size: "50ml" },
      price: 220000,
      stock: 12,
      image_index: 1
    }
  ],
  stock_total: 37,                 // مجموع محسوب — للفلترة السريعة

  // الوسائط
  media: {
    images: [
      { url: "https://cdn.../p1_1.webp", thumb_url: "...", order: 1, is_primary: true },
      { url: "https://cdn.../p1_2.webp", thumb_url: "...", order: 2 }
    ],                             // حد أقصى 8
    video: {
      url: "https://cdn.../p1.mp4",
      thumbnail_url: "https://cdn.../p1_vt.jpg",
      duration_sec: 14,            // حد أقصى 15
      size_bytes: 2940000,         // حد أقصى 10MB
      moderation: { status: "approved", checked_at: ISODate }
    }
  },

  // الشحن
  shipping: {
    weight_grams: 350,
    dimensions_cm: { l: 12, w: 6, h: 6 },
    is_fragile: true,
    free_shipping: false,
    handling_days: 1               // كم يوم يحتاج البائع للتجهيز
  },

  // خاص بالمنتجات ذات الصلاحية
  expiry_date: null,
  batch_number: null,

  // الإحصائيات (denormalized)
  stats: {
    rating_avg: 4.9,
    rating_count: 340,
    views: 12400,
    favorites: 890,
    orders_count: 156,
    conversion_rate: 0.0126        // طلبات ÷ مشاهدات
  },

  // البحث والاكتشاف
  tags: ["عود","عطر رجالي","فاخر","هدية"],
  search_keywords: ["oud","عود","اود"],   // مرادفات وأخطاء إملائية شائعة

  status: "published",             // draft | pending_review | published | rejected | archived
  is_featured: false,
  featured_until: null,

  published_at: ISODate,
  created_at: ISODate,
  updated_at: ISODate
}
```

**الفهارس**
```javascript
db.products.createIndex({ vendor_id: 1, status: 1 })
db.products.createIndex({ category_id: 1, city_id: 1, status: 1, price: 1 })
db.products.createIndex({ slug: 1 }, { unique: true })
db.products.createIndex({ "stats.rating_avg": -1, "stats.orders_count": -1 })
db.products.createIndex({ status: 1, published_at: -1 })
// فهرس نصي احتياطي — الأساسي يكون بـ Elasticsearch
db.products.createIndex({ "name.ar": "text", tags: "text" })
```

> **ملاحظة:** المنتجات تُزامَن مع Elasticsearch عبر job في الخلفية عند كل تعديل. لا تعتمد على `$text` بـ Mongo للبحث الحقيقي — ضعيف مع العربية.

---

## 6. inventory_logs

كل حركة مخزون تُسجل. ضروري لكشف الأخطاء والتلاعب.

```javascript
{
  _id: ObjectId,
  product_id: ObjectId,
  variant_id: "v1",
  vendor_id: ObjectId,

  change: -2,                      // سالب = خصم، موجب = إضافة
  stock_before: 27,
  stock_after: 25,

  reason: "order_placed",          // order_placed | order_cancelled | manual_adjust
                                   // | return_received | damaged | restock
  reference_id: ObjectId,          // رقم الطلب مثلاً
  actor_id: ObjectId,              // مين عمل التغيير
  note: null,

  created_at: ISODate
}
```

**الفهارس**
```javascript
db.inventory_logs.createIndex({ product_id: 1, created_at: -1 })
db.inventory_logs.createIndex({ vendor_id: 1, created_at: -1 })
```

> **حرج:** خصم المخزون لازم يكون ذرّي (atomic). استخدم:
> ```javascript
> db.products.updateOne(
>   { _id, "variants.variant_id": "v1", "variants.stock": { $gte: qty } },
>   { $inc: { "variants.$.stock": -qty, stock_total: -qty } }
> )
> ```
> لو `modifiedCount === 0` يعني المخزون ما كفى — ارفض الطلب. بدون هذا الشرط راح تبيع منتجات ما عندك.

---

## 7. carts

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,               // أو session_id للزوار
  session_id: null,

  // السلة مقسمة حسب البائع — كل بائع طلب منفصل عند الدفع
  vendor_carts: [
    {
      vendor_id: ObjectId,
      items: [
        {
          product_id: ObjectId,
          variant_id: "v1",
          quantity: 2,
          price_snapshot: 150000,  // السعر وقت الإضافة
          added_at: ISODate
        }
      ],
      note_to_vendor: "بدون بصل لو سمحت"
    }
  ],

  // من وكيل الـ AI
  created_by_ai: false,
  ai_session_id: null,

  coupon_code: null,
  city_id: ObjectId,

  expires_at: ISODate,             // TTL — تنظيف تلقائي
  updated_at: ISODate
}
```

**الفهارس**
```javascript
db.carts.createIndex({ user_id: 1 }, { unique: true, sparse: true })
db.carts.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })  // حذف تلقائي
```

> **تنبيه:** `price_snapshot` للعرض فقط. عند الدفع، أعد قراءة السعر الحقيقي من `products`. لو تغير، أبلغ العميل قبل الدفع. لا تثق بأي سعر قادم من الواجهة.

---

## 8. orders

الطلب سجل تاريخي — كل شي مجمّد بداخله.

```javascript
{
  _id: ObjectId,
  order_number: "ORD-2026-000012345",   // مقروء للبشر

  customer_id: ObjectId,
  vendor_id: ObjectId,                  // طلب واحد = بائع واحد
  city_id: ObjectId,
  fulfillment_model: "shipping",        // منسوخ من الفئة

  // العناصر — بيانات مجمّدة، ما تتأثر بتغير المنتج لاحقاً
  items: [
    {
      product_id: ObjectId,
      variant_id: "v1",
      name_snapshot: "عود الليل - 30ml",
      image_snapshot: "https://cdn.../p1_1.webp",
      sku: "OTR-OUD-001-30",
      quantity: 2,
      unit_price: 150000,
      line_total: 300000
    }
  ],

  // الحسابات — كلها أعداد صحيحة
  currency: "IQD",
  exchange_rate_used: 1.0,
  pricing: {
    subtotal: 300000,
    shipping_fee: 20000,
    tax: 15000,                         // 5%
    discount: 30000,
    coupon_code: "WELCOME10",
    loyalty_points_used: 0,
    loyalty_discount: 0,
    total: 305000                       // اللي يدفعه العميل
  },

  // التسوية المالية مع البائع
  settlement: {
    commission_rate: 12.0,
    commission_amount: 36000,           // 12% من 300000
    payment_gateway_fee: 8845,
    shipping_cost_actual: 20000,
    platform_shipping_subsidy: 0,
    vendor_net: 255155,                 // اللي يستلمه البائع
    status: "pending",                  // pending | released | held | reversed
    released_at: null
  },

  // الشحن
  shipping: {
    method: "inter_city_standard",
    address_snapshot: {
      recipient_name: "أحمد محمود",
      phone: "+9647701234567",
      city: "البصرة",
      district: "العشار",
      street: "...",
      landmark: "مقابل صيدلية الشفاء",
      location: { type: "Point", coordinates: [47.80, 30.50] }
    },
    estimated_delivery: ISODate,
    actual_delivery: null,
    shipment_id: ObjectId
  },

  payment_id: ObjectId,
  payment_method: "credit_card",
  payment_status: "paid",               // pending | paid | failed | refunded | partially_refunded

  // دورة الحياة
  status: "shipped",
  status_history: [
    { status: "pending",   at: ISODate, by: ObjectId, note: null },
    { status: "confirmed", at: ISODate, by: ObjectId, note: null },
    { status: "preparing", at: ISODate, by: ObjectId, note: null },
    { status: "shipped",   at: ISODate, by: ObjectId, note: "تم التسليم للمندوب" }
  ],

  cancellation: null,
  // { reason, by, at, refund_amount, refund_status }

  return_request: null,
  // { reason, requested_at, status, images: [], resolution }

  customer_note: "الرجاء التغليف كهدية",
  is_gift: true,

  created_by_ai: false,
  ai_session_id: null,

  created_at: ISODate,
  updated_at: ISODate
}
```

### حالات الطلب

```
pending ──> confirmed ──> preparing ──> ready ──> shipped ──> delivered ──> completed
   │            │             │            │          │
   └────────────┴─────────────┴────────────┴──────────┴──> cancelled
                                                      delivered ──> return_requested ──> returned ──> refunded
```

**الفهارس**
```javascript
db.orders.createIndex({ order_number: 1 }, { unique: true })
db.orders.createIndex({ customer_id: 1, created_at: -1 })
db.orders.createIndex({ vendor_id: 1, status: 1, created_at: -1 })
db.orders.createIndex({ status: 1, created_at: -1 })
db.orders.createIndex({ "settlement.status": 1, vendor_id: 1 })
db.orders.createIndex({ city_id: 1, created_at: -1 })
```

---

## 9. payments

```javascript
{
  _id: ObjectId,
  order_id: ObjectId,
  user_id: ObjectId,

  amount: 305000,
  currency: "IQD",

  method: "credit_card",           // credit_card | zain_cash | asiacell | 
                                   // bank_transfer | cod | wallet
  gateway: "stripe",               // stripe | hyperpay | zaincash | internal
  gateway_transaction_id: "pi_3Nx...",
  gateway_response: { },           // الرد الخام — للتدقيق

  // بيانات البطاقة المقنّعة فقط
  card_snapshot: {
    brand: "visa",
    last4: "4242",
    exp_month: 12,
    exp_year: 2028
  },

  status: "succeeded",             // pending | processing | succeeded | 
                                   // failed | refunded | partially_refunded
  failure_code: null,
  failure_message: null,

  refunds: [
    {
      refund_id: "re_3Nx...",
      amount: 50000,
      reason: "منتج تالف",
      status: "succeeded",
      created_at: ISODate
    }
  ],
  refunded_total: 50000,

  // نظام الأمانة (Escrow)
  escrow: {
    enabled: true,
    hold_until: ISODate,           // تاريخ التحرير التلقائي
    released: false,
    released_at: null
  },

  idempotency_key: "uuid",         // يمنع الدفع المزدوج
  ip_address: "37.236.x.x",

  created_at: ISODate,
  updated_at: ISODate
}
```

**الفهارس**
```javascript
db.payments.createIndex({ order_id: 1 })
db.payments.createIndex({ gateway_transaction_id: 1 }, { unique: true, sparse: true })
db.payments.createIndex({ idempotency_key: 1 }, { unique: true })
db.payments.createIndex({ user_id: 1, created_at: -1 })
db.payments.createIndex({ "escrow.released": 1, "escrow.hold_until": 1 })
```

> **حرج:** `idempotency_key` ليس اختيارياً. بدونه، لو ضغط العميل زر الدفع مرتين أو انقطع الاتصال وأعاد المحاولة، راح ينخصم مرتين. أرسل نفس المفتاح مع كل إعادة محاولة لنفس العملية.

---

## 10-11. wallets & wallet_transactions

```javascript
// wallets
{
  _id: ObjectId,
  owner_id: ObjectId,
  owner_type: "user",              // user | vendor
  currency: "IQD",
  balance: 45000,                  // لا يُعدّل مباشرة — يُحسب من الحركات
  pending_balance: 12000,
  lifetime_credited: 890000,
  lifetime_debited: 845000,
  is_frozen: false,
  updated_at: ISODate
}

// wallet_transactions — دفتر الأستاذ
{
  _id: ObjectId,
  wallet_id: ObjectId,
  type: "credit",                  // credit | debit
  amount: 15000,
  balance_after: 45000,
  reason: "order_refund",          // order_refund | referral_bonus | cashback
                                   // | order_payment | payout | admin_adjust
  reference_id: ObjectId,
  description: "استرداد الطلب ORD-2026-000012345",
  created_at: ISODate
}
```

> **قاعدة ذهبية:** `balance` يجب أن يساوي دائماً مجموع الحركات. شغّل job يومي يتحقق من هذا. لو صار اختلاف، عندك ثغرة أو bug — لازم تعرف فوراً.

---

## 12. payouts

```javascript
{
  _id: ObjectId,
  vendor_id: ObjectId,
  payout_number: "PAY-2026-00456",

  period: { from: ISODate, to: ISODate },
  order_ids: [ObjectId],
  orders_count: 47,

  breakdown: {
    gross_sales: 8500000,
    commission: 1020000,
    gateway_fees: 246500,
    refunds: 150000,
    adjustments: 0,
    net_payable: 7083500
  },

  currency: "IQD",
  method: "bank_transfer",
  status: "completed",             // scheduled | processing | completed | failed
  transfer_reference: "TRF-99887",
  receipt_url: null,

  scheduled_at: ISODate,
  processed_at: ISODate,
  created_at: ISODate
}
```

---

## 13-15. الشحن

```javascript
// cities
{
  _id: ObjectId,
  code: "BGD",
  name: { ar: "بغداد", en: "Baghdad", ku: "بەغدا" },
  country_code: "IQ",
  timezone: "Asia/Baghdad",
  currency: "IQD",
  center: { type: "Point", coordinates: [44.3615, 33.3157] },
  districts: ["الكرادة","المنصور","الجادرية","زيونة","الأعظمية"],
  is_active: true,
  services_enabled: ["restaurants","fragrances","clothing","beauty"],
  delivery_time_min: 30,
  delivery_time_max: 60
}

// shipping_rates
{
  _id: ObjectId,
  from_city_id: ObjectId,
  to_city_id: ObjectId,            // null = نفس المدينة
  method: "inter_city_standard",   // same_city_express | same_city_standard |
                                   // inter_city_standard | inter_city_express | pickup

  pricing: {
    base_fee: 25000,
    per_kg: 3000,
    per_km: 0,
    min_fee: 25000,
    max_fee: 120000
  },

  free_over: 200000,               // مجاني فوق هذا المبلغ
  estimated_days_min: 2,
  estimated_days_max: 5,
  max_weight_kg: 30,
  carrier: "local_courier",
  is_active: true
}

// shipments
{
  _id: ObjectId,
  order_id: ObjectId,
  tracking_number: "TRK-IQ-8847362",
  carrier: "local_courier",
  method: "inter_city_standard",

  from: { city_id: ObjectId, address: "..." },
  to:   { city_id: ObjectId, address: "...", location: { type: "Point", coordinates: [] } },

  weight_kg: 0.7,
  cost: 25000,

  courier: {
    name: "علي حسن",
    phone: "+9647801234567",
    vehicle: "دراجة نارية"
  },

  tracking_events: [
    { status: "picked_up", location: "بغداد - الكرادة", at: ISODate, note: null },
    { status: "in_transit", location: "الطريق السريع", at: ISODate },
    { status: "out_for_delivery", location: "البصرة - العشار", at: ISODate }
  ],
  current_location: { type: "Point", coordinates: [47.80, 30.50] },

  status: "out_for_delivery",
  delivery_proof: {
    type: "signature",             // signature | photo | otp
    url: null,
    otp_verified: false
  },
  attempts: 1,
  estimated_delivery: ISODate,
  delivered_at: null,
  created_at: ISODate
}
```

---

## 16. reviews

```javascript
{
  _id: ObjectId,
  order_id: ObjectId,              // إلزامي — لا تقييم بدون شراء مؤكد
  product_id: ObjectId,
  vendor_id: ObjectId,
  user_id: ObjectId,

  rating: 5,                       // 1-5
  title: "ممتاز",
  comment: "العطر أصلي وثباته قوي جداً",
  images: ["https://cdn.../rev1.webp"],

  // تقييمات فرعية حسب الفئة
  sub_ratings: {
    quality: 5,
    value_for_money: 4,
    delivery_speed: 5,
    matches_description: 5
  },

  is_verified_purchase: true,      // دايماً true بهذا التصميم
  helpful_count: 23,

  vendor_reply: {
    text: "شكراً لثقتك 🙏",
    replied_at: ISODate
  },

  moderation: {
    status: "approved",            // pending | approved | rejected
    flagged_reason: null,
    reviewed_by: ObjectId
  },

  created_at: ISODate
}
```

**الفهارس**
```javascript
db.reviews.createIndex({ product_id: 1, "moderation.status": 1, created_at: -1 })
db.reviews.createIndex({ vendor_id: 1, created_at: -1 })
db.reviews.createIndex({ order_id: 1, product_id: 1 }, { unique: true })  // تقييم واحد لكل منتج بالطلب
```

---

## 17-18. الدردشة

```javascript
// conversations
{
  _id: ObjectId,
  participants: [
    { user_id: ObjectId, role: "customer" },
    { user_id: ObjectId, role: "vendor", vendor_id: ObjectId }
  ],
  participant_ids: [ObjectId, ObjectId],   // مسطّح للفهرسة

  context: {
    type: "order",                 // order | product | general
    order_id: ObjectId,
    product_id: null
  },

  last_message: {
    text: "الطلب بالطريق",
    sender_id: ObjectId,
    at: ISODate
  },
  unread_count: { "userId1": 0, "userId2": 3 },

  status: "open",                  // open | archived | blocked
  created_at: ISODate,
  updated_at: ISODate
}

// messages
{
  _id: ObjectId,
  conversation_id: ObjectId,
  sender_id: ObjectId,
  sender_role: "vendor",

  type: "text",                    // text | image | product_card | order_card | system
  text: "الطلب بالطريق، يوصلك خلال ساعة",
  attachments: [
    { type: "image", url: "https://cdn.../msg1.webp", size_bytes: 240000 }
  ],
  product_ref: null,               // لو أرسل بطاقة منتج

  read_by: [
    { user_id: ObjectId, at: ISODate }
  ],

  edited_at: null,
  deleted_at: null,
  created_at: ISODate
}
```

**الفهارس**
```javascript
db.conversations.createIndex({ participant_ids: 1, updated_at: -1 })
db.messages.createIndex({ conversation_id: 1, created_at: -1 })
```

---

## 19-20. الذكاء الاصطناعي

```javascript
// ai_sessions
{
  _id: ObjectId,
  user_id: ObjectId,
  city_id: ObjectId,

  messages: [
    { role: "user", content: "عندي عرس بعد أسبوع وميزانيتي 300 ألف", at: ISODate },
    { role: "assistant", content: "...", at: ISODate }
  ],

  // ما استخرجه الـ AI من المحادثة
  extracted_intent: {
    occasion: "wedding",
    budget: 300000,
    currency: "IQD",
    deadline: ISODate,
    categories_needed: ["clothing", "beauty", "fragrances"],
    constraints: { gender: "female", size: "M" }
  },

  // ما رشّحه
  recommendations: [
    {
      product_id: ObjectId,
      vendor_id: ObjectId,
      category: "clothing",
      price: 180000,
      score: 0.92,
      reasoning: "يطابق المقاس والمناسبة، تقييم عالي، توصيل خلال يومين"
    }
  ],

  outcome: {
    cart_created: true,
    cart_id: ObjectId,
    order_ids: [ObjectId],
    total_value: 295000,
    converted: true
  },

  tokens_used: 4820,
  cost_usd: 0.038,                 // تتبع التكلفة مهم
  model: "claude-sonnet-4-6",

  created_at: ISODate
}

// user_profiles — يبنيه النظام من السلوك
{
  _id: ObjectId,
  user_id: ObjectId,

  preferences: {
    categories: [
      { category_id: ObjectId, affinity: 0.85, interactions: 142 }
    ],
    price_sensitivity: "medium",   // low | medium | high
    avg_order_value: 125000,
    preferred_vendors: [ObjectId],
    
    // تفضيلات مستخرجة حسب الفئة
    attribute_preferences: {
      fragrances: { scent_family: { woody: 0.7, oriental: 0.3 } },
      restaurants: { spice_level: { medium: 0.8 }, cuisine: { عراقي: 0.6 } },
      clothing: { size: "M", fit: "عادي" }
    }
  },

  behavior: {
    active_hours: [19, 20, 21, 22],
    active_days: ["thursday", "friday"],
    avg_session_min: 8.4,
    orders_count: 34,
    last_order_at: ISODate,
    churn_risk: 0.12
  },

  // للأشياء اللي صرّح فيها العميل
  stated_preferences: {
    dietary: ["no_spicy"],
    allergies_note: null,          // نص حر يكتبه العميل بنفسه
    sizes: { clothing: "M", shoes: "42" }
  },

  updated_at: ISODate
}
```

> **ملاحظة خصوصية:** `user_profiles` يحتوي بيانات سلوكية حساسة. طبّق مبدأ الوصول الأدنى — البائع ما يشوف هذا الملف إطلاقاً، فقط النظام والـ AI.

---

## 21-24. النمو والتسويق

```javascript
// coupons
{
  _id: ObjectId,
  code: "WELCOME10",
  type: "percentage",              // percentage | fixed | free_shipping
  value: 10,
  max_discount: 50000,
  min_order_value: 100000,

  scope: {
    vendor_ids: [],                // فارغ = كل البائعين
    category_ids: [ObjectId],
    product_ids: [],
    city_ids: [ObjectId]
  },

  funded_by: "platform",           // platform | vendor | shared
  vendor_share_percent: 0,

  usage: {
    limit_total: 1000,
    limit_per_user: 1,
    used_count: 342
  },

  valid_from: ISODate,
  valid_until: ISODate,
  is_active: true,
  created_by: ObjectId
}

// loyalty_accounts
{
  _id: ObjectId,
  user_id: ObjectId,
  points_balance: 1250,
  lifetime_earned: 4800,
  lifetime_redeemed: 3550,
  tier: "gold",                    // bronze | silver | gold | platinum
  tier_progress: { current: 4800, next_tier_at: 10000 },
  transactions: [
    { type: "earn", points: 150, reason: "order", order_id: ObjectId, at: ISODate },
    { type: "redeem", points: -500, reason: "discount", order_id: ObjectId, at: ISODate },
    { type: "expire", points: -100, at: ISODate }
  ],
  updated_at: ISODate
}

// referrals
{
  _id: ObjectId,
  referrer_id: ObjectId,
  referral_code: "AHMED2026",
  referred_user_id: ObjectId,
  status: "completed",             // pending | completed | expired | fraudulent
  reward: {
    referrer_amount: 10000,
    referred_amount: 15000,
    currency: "IQD",
    granted_at: ISODate
  },
  qualifying_order_id: ObjectId,   // المكافأة بعد أول طلب مكتمل
  fraud_check: { ip_match: false, device_match: false, score: 0.05 },
  created_at: ISODate
}

// group_buys
{
  _id: ObjectId,
  product_id: ObjectId,
  vendor_id: ObjectId,
  initiator_id: ObjectId,

  tiers: [
    { min_participants: 5,  discount_percent: 15 },
    { min_participants: 10, discount_percent: 30 }
  ],

  participants: [
    { user_id: ObjectId, quantity: 1, payment_id: ObjectId, joined_at: ISODate }
  ],
  participants_count: 7,
  current_discount: 15,

  status: "active",                // active | succeeded | failed | cancelled
  expires_at: ISODate,
  created_at: ISODate
}
```

> **مهم بالشراء الجماعي:** لا تخصم فلوس المشاركين إلا بعد نجاح المجموعة. استخدم `authorization` بدل `capture` ببوابة الدفع — تحجز المبلغ وتسحبه فقط عند اكتمال العدد.

---

## 25-27. مساعدة

```javascript
// favorites
{
  _id: ObjectId,
  user_id: ObjectId,
  list_name: "المفضلة",
  items: [
    { product_id: ObjectId, added_at: ISODate, note: null }
  ],
  is_public: false,
  updated_at: ISODate
}

// notifications
{
  _id: ObjectId,
  user_id: ObjectId,
  type: "order_shipped",
  title: { ar: "طلبك بالطريق 🚚" },
  body: { ar: "الطلب ORD-...345 خرج للتوصيل" },
  data: { order_id: ObjectId, deep_link: "app://orders/..." },
  channels: ["push", "in_app"],    // push | sms | email | in_app
  delivery_status: { push: "sent", sms: null },
  read: false,
  read_at: null,
  created_at: ISODate
}

// exchange_rates
{
  _id: ObjectId,
  base: "IQD",
  rates: { AED: 0.0024, SAR: 0.0019, USD: 0.00077, TRY: 0.026 },
  source: "openexchangerates",
  fetched_at: ISODate,
  valid_until: ISODate
}
```

---

## 28-30. النظام

```javascript
// platform_settings — مستند واحد
{
  _id: "global",
  commission_defaults: {
    restaurants: 15.0, fragrances: 12.0, clothing: 10.0,
    beauty: 12.0, cosmetics: 12.0, electronics: 8.0
  },
  tax_rate: 5.0,
  escrow_hold_days: 3,
  return_window_days: 7,
  loyalty: { points_per_currency_unit: 0.001, redemption_rate: 100 },
  media_limits: {
    max_images_per_product: 8,
    max_image_size_mb: 5,
    max_video_duration_sec: 15,
    max_video_size_mb: 10
  },
  maintenance_mode: false,
  updated_at: ISODate
}

// audit_logs — كل عملية حساسة
{
  _id: ObjectId,
  actor_id: ObjectId,
  actor_role: "admin",
  action: "order.refund",
  resource_type: "order",
  resource_id: ObjectId,
  changes: { before: { status: "delivered" }, after: { status: "refunded" } },
  ip_address: "37.236.x.x",
  user_agent: "...",
  created_at: ISODate
}

// events — للتحليلات (حجم كبير، فكر بـ ClickHouse لاحقاً)
{
  _id: ObjectId,
  user_id: ObjectId,
  session_id: "uuid",
  event: "product_view",           // product_view | add_to_cart | checkout_start
                                   // | purchase | search | ai_query
  properties: {
    product_id: ObjectId,
    category_id: ObjectId,
    source: "ai_recommendation",
    price: 150000
  },
  city_id: ObjectId,
  platform: "ios",
  created_at: ISODate
}
```

**الفهارس**
```javascript
db.audit_logs.createIndex({ resource_type: 1, resource_id: 1, created_at: -1 })
db.audit_logs.createIndex({ actor_id: 1, created_at: -1 })
db.events.createIndex({ user_id: 1, created_at: -1 })
db.events.createIndex({ event: 1, created_at: -1 })
db.events.createIndex({ created_at: 1 }, { expireAfterSeconds: 15552000 })  // 180 يوم
```

---

## استراتيجية Redis

Mongo للتخزين الدائم، Redis للأشياء السريعة والمتغيرة:

| المفتاح | الغرض | TTL |
|---------|-------|-----|
| `cart:{user_id}` | نسخة السلة السريعة | 7 أيام |
| `session:{token}` | جلسات المصادقة | 15 دقيقة |
| `stock:{variant_id}` | عدّاد مخزون مؤقت أثناء الدفع | 15 دقيقة |
| `views:product:{id}` | عدّاد مشاهدات (يُكتب لـ Mongo كل ساعة) | — |
| `rate:{ip}:{endpoint}` | تحديد معدل الطلبات | 1 دقيقة |
| `otp:{phone}` | رمز التحقق | 5 دقائق |
| `online:{user_id}` | حالة الاتصال بالدردشة | 60 ثانية |
| `search:popular:{city}` | أشهر عمليات البحث | 1 ساعة |

---

## فهرس Elasticsearch للمنتجات

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "arabic_custom": {
          "tokenizer": "standard",
          "filter": ["lowercase", "arabic_normalization", "arabic_stem"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "product_id":   { "type": "keyword" },
      "name_ar":      { "type": "text", "analyzer": "arabic_custom" },
      "name_en":      { "type": "text" },
      "description":  { "type": "text", "analyzer": "arabic_custom" },
      "tags":         { "type": "keyword" },
      "vendor_id":    { "type": "keyword" },
      "vendor_name":  { "type": "text", "analyzer": "arabic_custom" },
      "category_id":  { "type": "keyword" },
      "city_id":      { "type": "keyword" },
      "price":        { "type": "long" },
      "rating":       { "type": "float" },
      "orders_count": { "type": "integer" },
      "in_stock":     { "type": "boolean" },
      "attributes":   { "type": "object", "dynamic": true },
      "location":     { "type": "geo_point" },
      "created_at":   { "type": "date" }
    }
  }
}
```

**دالة الترتيب:** امزج التطابق النصي (`_score`) مع إشارات العمل:
```
final_score = _score × 0.5
            + (نفس المدينة ? 0.2 : 0)
            + (rating / 5) × 0.15
            + log(orders_count + 1) × 0.1
            + (in_stock ? 0.05 : -0.5)
```

---

## قائمة تحقق قبل الإطلاق

- [ ] كل الفهارس المذكورة مُنشأة على بيئة الإنتاج
- [ ] `idempotency_key` مفعّل على كل مسارات الدفع
- [ ] خصم المخزون ذرّي ومختبر تحت ضغط متزامن
- [ ] IBAN والوثائق مشفّرة على مستوى الحقل
- [ ] نسخ احتياطي يومي + اختبار استرجاع فعلي (نسخة ما جربتها = ما عندك نسخة)
- [ ] TTL مفعّل على `carts` و `events`
- [ ] job يومي يطابق أرصدة المحافظ مع دفتر الحركات
- [ ] Rate limiting على كل نقاط الـ API العامة
- [ ] سجل تدقيق على كل عملية مالية أو إدارية
- [ ] بيانات اختبار واقعية لكل فئة (30+ منتج لكل فئة)

---

## ما هو خارج هذا المخطط عمداً

- **الريلز والبث المباشر** — مستبعدة من النطاق
- **جداول التوصية بالتعلم الآلي** — تُبنى لاحقاً بعد تجميع بيانات كافية من `events`
- **تعدد المستودعات للبائع الواحد** — أضفها لو احتجت لاحقاً
- **الاشتراكات المتكررة** — ليست بالنطاق الحالي
