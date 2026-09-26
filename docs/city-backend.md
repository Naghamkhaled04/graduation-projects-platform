# الحفظ السحابي للمدينة الذكية (Supabase)

بدون هذا الإعداد، المدينة تعمل بوضع **محلي**: كل زائر يبني مبناه ويراه هو فقط (محفوظ بمتصفحه).
لتظهر مباني الزوّار للجميع، فعّلوا Supabase (مجاني للبدء).

## الخطوات

1. أنشئوا مشروعاً على supabase.com (الحساب حسابكم أنتم).
2. من **SQL Editor** شغّلوا الملف أدناه.
3. من **Authentication → URL Configuration** أضيفوا رابط موقعكم (و`http://localhost:4321` للتجربة) إلى Redirect URLs.
4. من **Project Settings → API** انسخوا `Project URL` و`anon public key` إلى ملف `site/.env`:

```
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

مفتاح `anon` مخصص أصلاً ليكون علنياً بالمتصفح، والحماية الفعلية هي سياسات RLS بالأسفل. **لا تضعوا مفتاح `service_role` بأي ملف بالموقع.**

## الجدول والسياسات

```sql
create table public.buildings (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 40),
  sign       text not null check (char_length(sign) between 2 and 28),
  style      text not null check (style in ('hospital','home','shop','lab','tower','farm')),
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  projects   text[] not null check (array_length(projects,1) between 1 and 6),
  plot       int  not null unique check (plot >= 4 and plot < 36),  -- 0..3 محجوزة لمباني الفريق
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (owner_id)                                                  -- مبنى واحد لكل شخص
);

alter table public.buildings enable row level security;

-- الجميع يرى المعتمَد؛ وصاحب المبنى يرى مبناه حتى لو قيد المراجعة
create policy "read approved or own" on public.buildings
  for select using (status = 'approved' or owner_id = auth.uid());

-- الإدخال: مسجّل دخول فقط، ودائماً "قيد المراجعة"
create policy "insert own pending" on public.buildings
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

-- التعديل: المبنى المعلّق فقط، ولا يقدر يغيّر حالته أو قطعته
create policy "update own pending" on public.buildings
  for update to authenticated
  using (owner_id = auth.uid() and status = 'pending')
  with check (owner_id = auth.uid() and status = 'pending');

create policy "delete own" on public.buildings
  for delete to authenticated using (owner_id = auth.uid());
```

## المراجعة والاعتماد

المباني الجديدة تبقى `pending` ولا يراها غير صاحبها حتى تعتمدوها.
من **Table Editor → buildings** غيّروا `status` إلى `approved` (أو `rejected`) بعد قراءة الاسم واللافتة.
هذا مقصود: اللافتات نصوص يكتبها الزوّار وتظهر بموقعكم، فلا نعرضها قبل مراجعتها.

## ملاحظات

- تسجيل الدخول برابط سحري على البريد (بدون كلمة سر).
- الاسم واللافتة يمرّان بتنظيف بالمتصفح وبقيود الطول بالقاعدة، والعرض بالموقع يتم عبر `textContent` (لا HTML).
- القيود بالمتصفح ليست حماية؛ الحماية هي RLS وقيود الجدول أعلاه.
- قطعة الأرض تُحجز بالإدخال؛ لو حجزها شخص آخر بنفس اللحظة يجرّب الموقع القطعة التالية تلقائياً.
- لم يُختبر هذا المسار مع مشروع Supabase فعلي بعد؛ اختبروه بحساب تجريبي قبل الإطلاق.
