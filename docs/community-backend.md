# المجتمع: الملف التعريفي، النقاط، الفيدباك، الأدمن (Supabase)

هذا الملف مكمّل لـ `docs/city-backend.md` (جدول المباني). شغّلوا السكربتين على نفس مشروع Supabase.
بدون Supabase، الموقع يعمل بوضع **تجريبي محلي** (يظهر بالصفحات) لمعاينة الواجهات فقط: لا يشاركه أحد ولا يصلح للإطلاق.

## قواعد النقاط (معدّلة بمكان واحد بالكود `src/community/rules.ts` وبالسكربت أدناه)

| الحدث | النقاط | شرط |
|---|---|---|
| نشر مبنى الطالب بالمدينة (بعد الاعتماد) | +5 | مرة واحدة |
| تجربة بصور من تنفيذ المشروع | +10 | مرة لكل مشروع، صورة واحدة على الأقل، بعد موافقة الأدمن |
| تعليق على فكرة (بلا صور) | +2 | مرة لكل مشروع، بلا سقف إجمالي (قرار المستخدم) |
| استبدال استشارة مجانية | −50 | يولّد رمزاً ترسله للأدمن |

**ليش ٥٠:** قيمة الاستشارة ٥ د.أ، يعني النقطة ≈ ٠٫١ د.أ. التجربة بالصور (١٠ نقاط ≈ د.أ واحد) هي المحتوى اللي بيسوّق لكم. التعليق (٢) مرة لكل مشروع، فالحد الطبيعي للتعليقات ٢ × عدد المشاريع.

**النقاط لا تُمنح من المتصفح أبداً.** تُمنح فقط بمشغّلات (triggers) بالقاعدة عند موافقة الأدمن، فلا يقدر أحد يزوّرها من الكونسول.

## السكربت (SQL Editor)

```sql
-- ============ الملفات التعريفية ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  university   text check (char_length(university) <= 60),
  major        text check (char_length(major) <= 60),
  year         int  check (year between 1 and 8),
  bio          text check (char_length(bio) <= 280),
  role         text not null default 'student' check (role in ('student','admin')),
  points       int  not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'student' and points = 0);
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- المستخدم يعدّل هذه الأعمدة فقط (لا role ولا points)
revoke update on public.profiles from authenticated;
grant update (display_name, university, major, year, bio) on public.profiles to authenticated;

-- إنشاء ملف تلقائياً عند التسجيل
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email,'@',1),''), 'طالب'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ سجل النقاط (للقراءة فقط من المتصفح) ============
create table public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  unique (reason, ref_id)
);
alter table public.points_ledger enable row level security;
create policy "ledger own or admin" on public.points_ledger for select
  using (user_id = auth.uid() or is_admin());

create or replace function public.award(uid uuid, d int, why text, ref uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into points_ledger (user_id, delta, reason, ref_id) values (uid, d, why, ref)
  on conflict (reason, ref_id) do nothing;
  if found then update profiles set points = points + d where id = uid; end if;
end $$;
revoke all on function public.award(uuid,int,text,uuid) from public, anon, authenticated;

-- ============ الفيدباك والتقييمات ============
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  project_id text not null,
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  comment    text not null check (char_length(comment) between 10 and 800),
  images     text[] not null default '{}' check (coalesce(array_length(images,1),0) <= 3),
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
alter table public.feedback enable row level security;
create policy "feedback read" on public.feedback for select
  using (status = 'approved' or user_id = auth.uid() or is_admin());
create policy "feedback insert own pending" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "feedback edit own pending" on public.feedback for update to authenticated
  using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');
create policy "feedback admin all" on public.feedback for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "feedback delete own" on public.feedback for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.on_feedback_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if coalesce(array_length(new.images,1),0) > 0 then
      perform award(new.user_id, 10, 'feedback_photo', new.id);
    else
      perform award(new.user_id, 2, 'idea_comment', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger feedback_points after update of status on public.feedback
  for each row execute function public.on_feedback_approved();

-- ============ اعتماد المباني (من city-backend.md) يمنح نقاطاً ============
create policy "buildings admin all" on public.buildings for all to authenticated
  using (is_admin()) with check (is_admin());
create or replace function public.on_building_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform award(new.owner_id, 5, 'building_approved', new.id);
  end if;
  return new;
end $$;
create trigger building_points after update of status on public.buildings
  for each row execute function public.on_building_approved();

-- ============ استبدال النقاط باستشارة مجانية ============
create table public.redemptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  code       text not null unique,
  status     text not null default 'open' check (status in ('open','used','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.redemptions enable row level security;
create policy "redemptions own or admin" on public.redemptions for select
  using (user_id = auth.uid() or is_admin());
create policy "redemptions admin update" on public.redemptions for update to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.redeem() returns text
language plpgsql security definer set search_path = public as $$
declare bal int; c text;
begin
  select points into bal from profiles where id = auth.uid() for update;
  if bal is null or bal < 50 then raise exception 'رصيدك أقل من 50 نقطة'; end if;
  c := 'FREE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into points_ledger (user_id, delta, reason, ref_id) values (auth.uid(), -50, 'redeem', gen_random_uuid());
  update profiles set points = points - 50 where id = auth.uid();
  insert into redemptions (user_id, code) values (auth.uid(), c);
  return c;
end $$;
grant execute on function public.redeem() to authenticated;

-- ============ متابعة وتعليقات على المباني (للمرحلة القادمة) ============
create table public.follows (
  follower_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
create policy "follows read" on public.follows for select using (true);
create policy "follows insert own" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "follows delete own" on public.follows for delete to authenticated using (follower_id = auth.uid());

create table public.building_comments (
  id          uuid primary key default gen_random_uuid(),
  building_id text not null,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 2 and 300),
  created_at  timestamptz not null default now()
);
alter table public.building_comments enable row level security;
create policy "bc read" on public.building_comments for select using (true);
create policy "bc insert own" on public.building_comments for insert to authenticated with check (user_id = auth.uid());
create policy "bc delete own or admin" on public.building_comments for delete to authenticated using (user_id = auth.uid() or is_admin());

-- ============ تعديل نقاط يدوي (للأدمن فقط) ============
create or replace function public.admin_adjust_points(uid uuid, d int, why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'غير مسموح'; end if;
  perform award(uid, d, 'admin: ' || left(why, 60), gen_random_uuid());
end $$;
grant execute on function public.admin_adjust_points(uuid,int,text) to authenticated;

-- ============ المشاريع (تُدار من لوحة الأدمن) ============
create table public.projects (
  id         text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  data       jsonb not null,
  status     text not null default 'draft' check (status in ('draft','published','hidden')),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
-- الزائر يرى المنشور والمخفي (المخفي لإخفاء مشروع ثابت)، والمسودات للأدمن فقط
create policy "projects read public" on public.projects for select
  using (status in ('published','hidden') or is_admin());
create policy "projects admin write" on public.projects for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============ صور الفيدباك (Storage) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', true, 1572864, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;
create policy "fb images read" on storage.objects for select using (bucket_id = 'feedback-images');
create policy "fb images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fb images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

## حساب الأدمن

1. سجّلوا الدخول بالموقع مرة ببريدكم (يُنشئ ملفاً تعريفياً تلقائياً).
2. من SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'بريدكم@example.com');
```

3. صفحة `/admin` بتظهر لكم بعدها. **لا يوجد أي طريق من المتصفح لصير أحد أدمن**: الدور لا يُعدَّل إلا من SQL.

## ملاحظات مهمة

- **إثبات الفيدباك:** الطلب يتم بواتساب، فما في "شراء مؤكد" نتحقق منه. لهذا كل فيدباك يمرّ بمراجعة الأدمن قبل الظهور، والصور هي الإثبات الأساسي. لا تعتمدوا فيدباك بلا تفاصيل حقيقية.
- **الخصوصية:** الملف التعريفي علني (الاسم، الجامعة، التخصص، النبذة، النقاط). لا نعرض البريد. اكتبوا للطلاب بوضوح قبل التسجيل شو بيظهر، وأضيفوا سياسة خصوصية وشروط قبل الإطلاق (قانون حماية البيانات الشخصية الأردني).
- **الصور:** تُضغط بالمتصفح قبل الرفع (حد ~1.5MB للصورة، وثلاث صور كحد أقصى). راجعوها قبل الاعتماد.
- **النقاط والاستشارة المجانية:** ٥٠ نقطة = استشارة بـ٥ د.أ. الأرقام بـ `rules.ts` وبالسكربت أعلاه: غيّروا الاثنين معاً.
- **لم يُختبر:** هذا السكربت لم يُشغَّل على Supabase فعلي بعد. شغّلوه على مشروع تجريبي أولاً وراجعوا أي خطأ.
- **المرحلة الجاية:** نقل المشاريع نفسها لقاعدة البيانات لتعدّلوها وتحذفوها من لوحة الأدمن (حالياً هي ملفات بالكود).

## إدارة المشاريع من لوحة الأدمن

- تاب **المشاريع** بـ `/admin`: مشروع جديد، أو تعديل أي مشروع ثابت (بينسخ لقاعدة البيانات وبتظهر نسختكم مكانه)، أو إخفاؤه.
- النموذج بنفس التقسيم المعتمد: اسم، وصف، مشكلة، خطوات، مميزات، تحديات، قطع بالبدائل والأسعار، إضافات.
- **المجسم** يتولّد تلقائياً من القطع على لوحة تجارب مع أسلاك، وبتعدّلوا المواضع والألوان بمعاينة حية.
- المشروع المنشور يظهر فوراً (بدون إعادة بناء الموقع): بالبطاقات، وبالمدينة، وبصفحته `/p?id=رمز-المشروع`.
- الصفحات الثابتة القديمة `/projects/xxx` ما بتتغير بالتعديل. الروابط بالموقع بتنتقل تلقائياً للنسخة المعدّلة.

## توليد المجسم من أسماء القطع أو من صورة

- **من الأسماء (بلا أي إعداد):** بمحرر المشروع الصقوا أسماء القطع (سطر لكل قطعة، أو `مضخة مياه × 2`) واضغطوا «أنشئ القطع والمجسم». نوع كل قطعة بيتحدد من اسمها (عربي أو إنجليزي)، والمجسم بيتولد لحاله ويتحدث مع كل تعديل بالأسماء. إذا غلط بالنوع غيّروه من القائمة (بيثبت) وإذا بدكم قطعة بلا مجسم (أسلاك…) اختاروا «بدون مجسم».
- **من صورة (يحتاج إعداد):** زر «📷 من صورة» بيرسل الصورة لدالة `parts-from-image` (ملف `supabase/functions/parts-from-image/index.ts`) اللي بتستعمل نموذج Claude للتعرف على القطع، وبترجع القائمة لنفس مسار الأسماء.

### إعداد دالة الصورة (مرة واحدة، بحسابكم)

```bash
supabase login
supabase link --project-ref <معرّف-مشروعكم>
supabase functions deploy parts-from-image
supabase secrets set ANTHROPIC_API_KEY=<مفتاحكم من console.anthropic.com>
```

- المفتاح يبقى **secret على Supabase** ولا يظهر بالموقع. لا تضعوه بـ `.env` ولا بالكود.
- الدالة **للأدمن فقط** (تتحقق من `profiles.role`)، وتقبل صور JPG/PNG/WebP حتى ~5MB، وتنظّف ناتج النموذج (أنواع مسموحة فقط، أسماء قصيرة، حد ٢٠ قطعة) لأن الصورة نفسها قد تحتوي نصاً يحاول توجيه النموذج.
- كل صورة = استدعاء مدفوع لخدمة Anthropic. راقبوا الاستهلاك.
- **لم تُختبر** الدالة على مشروع فعلي. جرّبوها بصورة دارة واضحة أولاً، وتوقعوا إن الأسماء والكميات تحتاج مراجعة.
- بالوضع التجريبي المحلي زر الصورة بيعرض رسالة إنه يحتاج Supabase.

## طبقة الفهم لشات المستشار (اختيارية)

الشات يعمل بدونها ببحث محلي بالكلمات والمرادفات. **طبقة Claude هي اللي بتخليه "يفهم" فعلاً**: بتحكم إذا المشروع بيحل مشكلة الطالب أو بس بيشاركه كلمة، وبتشرح الفرق. لو ما فعّلتوها يستمر المحلي.

```sql
create table public.advisor_usage (
  day date not null default current_date, key text not null, n int not null default 0, primary key (day, key)
);
alter table public.advisor_usage enable row level security;   -- بلا سياسات: للدالة فقط

create or replace function public.bump_advisor(k text) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into advisor_usage (day, key, n) values (current_date, k, 1)
  on conflict (day, key) do update set n = advisor_usage.n + 1 returning n into c;
  return c;
end $$;
revoke all on function public.bump_advisor(text) from public, anon, authenticated;
grant execute on function public.bump_advisor(text) to service_role;
```

```bash
supabase functions deploy project-advisor
supabase secrets set ANTHROPIC_API_KEY=<مفتاحكم>   # نفس المفتاح المستعمل لتحليل الصور
```

- **الكلفة والحماية:** كل رسالة استدعاء مدفوع. الدالة عامة (الزائر بلا تسجيل)، فوضعت حد **٢٥ رسالة يومياً لكل زائر** (بعنوان مجزّأ) و**٨٠٠ يومياً عاماً**، عدّلوهما بأعلى الملف. راقبوا الاستهلاك بأول أسبوع.
- ما يُرسل: نص فكرة الطالب فقط + أوصاف أقرب ٨ مشاريع من كتالوجكم. لا بيانات شخصية. مع ذلك، أخبروا الطلاب أن نص الفكرة يُعالج بخدمة خارجية (سياسة الخصوصية).
- الرد يُنظَّف: معرّفات مشاريع موجودة بالقائمة فقط، طول محدود، بلا HTML.
- **لم تُختبر** على مشروع Supabase فعلي بعد.

## تفاعل المباني: إعجابات، زيارات، تعليقات

يعمل محلياً بلا إعداد (بمتصفح كل زائر). للمشاركة الحقيقية نفّذوا هذا بـ Supabase:

```sql
-- ============ إعجابات ============
create table public.building_likes (
  building_id uuid not null references buildings(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (building_id, user_id)
);
alter table public.building_likes enable row level security;
create policy "likes read"   on public.building_likes for select using (true);
create policy "likes insert" on public.building_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes delete" on public.building_likes for delete to authenticated using (user_id = auth.uid());

-- ============ زيارات (زيارة واحدة لكل زائر باليوم) ============
create table public.building_visits (
  building_id uuid not null references buildings(id) on delete cascade,
  visitor     text not null,               -- معرّف المستخدم أو معرّف عشوائي بالمتصفح
  day         date not null default current_date,
  primary key (building_id, visitor, day)
);
alter table public.building_visits enable row level security;
create policy "visits insert" on public.building_visits for insert with check (true);
-- لا سياسة select: الأرقام تُقرأ عبر building_stats فقط، فلا يستطيع أحد سحب قائمة الزوار

-- ============ تعليقات على المباني ============
create table public.building_comments (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 2 and 200),
  created_at  timestamptz not null default now()
);
alter table public.building_comments enable row level security;
create index on public.building_comments (building_id, created_at);
create policy "bcomments read"   on public.building_comments for select using (true);
create policy "bcomments insert" on public.building_comments for insert to authenticated with check (user_id = auth.uid());
create policy "bcomments delete" on public.building_comments for delete to authenticated
  using (user_id = auth.uid() or is_admin() or is_moderator_of(
    (select p.university from buildings b join profiles p on p.id = b.owner_id where b.id = building_id)));

-- ============ الأرقام المجمّعة (دالة واحدة بدل استعلامين) ============
create or replace function public.building_stats(ids uuid[])
returns table (building_id uuid, likes bigint, visits bigint)
language sql stable security definer set search_path = public as $$
  select b.id,
         (select count(*) from building_likes  l where l.building_id = b.id),
         (select count(*) from building_visits v where v.building_id = b.id)
  from buildings b where b.id = any(ids)
$$;
grant execute on function public.building_stats(uuid[]) to anon, authenticated;

-- حدّ بسيط ضد الإغراق بالتعليقات: 10 تعليقات بالساعة لكل مستخدم
create or replace function public.cap_building_comments() returns trigger
language plpgsql as $$
begin
  if (select count(*) from building_comments
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'كثير تعليقات بوقت قصير. جرّب بعد شوي.';
  end if;
  return new;
end $$;
create trigger trg_cap_bcomments before insert on public.building_comments
  for each row execute function public.cap_building_comments();
```

**ملاحظات:**
- الزيارات تُحسب مرة لكل زائر باليوم. الزائر غير المسجّل يُميَّز بمعرّف عشوائي بمتصفحه (`city.vid`)، فهو تقدير لا رقم دقيق.
- `building_stats` دالة `security definer` لأن جدول الزيارات بلا صلاحية قراءة مباشرة.
- **حجم المبنى وإضاءته** يُحسبان بالمتصفح من `profiles.points` وعدد التجارب المعتمدة بصور (`site/src/city/buildings.ts` → `towerLook`). لا حاجة لأي عمود إضافي.

## مجتمعات الجامعات والمشرفون

```sql
-- ============ مشرفو الجامعات ============
create table public.uni_moderators (
  uni        text not null,
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  why        text,
  status     text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at timestamptz not null default now(),
  primary key (uni, user_id)
);
alter table public.uni_moderators enable row level security;
create policy "mods read active" on public.uni_moderators for select
  using (status = 'active' or user_id = auth.uid() or is_admin());
-- الطالب يقدّم طلبه فقط، والحالة تبقى pending مهما أرسل
create policy "mods apply" on public.uni_moderators for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "mods admin" on public.uni_moderators for update to authenticated
  using (is_admin()) with check (is_admin());

-- المشرف يجب أن يكون من نفس الجامعة فعلاً
create or replace function public.is_moderator_of(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from uni_moderators m join profiles p on p.id = m.user_id
    where m.user_id = auth.uid() and m.uni = u and m.status = 'active' and p.university = u)
$$;
grant execute on function public.is_moderator_of(text) to anon, authenticated;

-- ============ منشورات المجتمع ============
create table public.uni_posts (
  id          uuid primary key default gen_random_uuid(),
  uni         text not null,
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  kind        text not null check (kind in ('question','showcase','partner','resource')),
  title       text not null check (char_length(title) between 6 and 100),
  body        text not null check (char_length(body) between 15 and 1200),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reply_count int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.uni_posts enable row level security;
create index on public.uni_posts (uni, status, created_at desc);
create policy "posts read" on public.uni_posts for select
  using (status = 'approved' or user_id = auth.uid() or is_moderator_of(uni));
-- ينشر فقط من جامعته، ودائماً pending
create policy "posts insert" on public.uni_posts for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending'
  and uni = (select university from profiles where id = auth.uid()));
create policy "posts moderate" on public.uni_posts for update to authenticated
  using (is_moderator_of(uni)) with check (is_moderator_of(uni));
create policy "posts delete own" on public.uni_posts for delete to authenticated
  using (user_id = auth.uid() or is_moderator_of(uni));

-- ============ الردود ============
create table public.uni_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references uni_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 600),
  created_at timestamptz not null default now()
);
alter table public.uni_replies enable row level security;
create index on public.uni_replies (post_id, created_at);
create policy "replies read" on public.uni_replies for select using (true);
create policy "replies insert" on public.uni_replies for insert to authenticated with check (
  user_id = auth.uid()
  and (select uni from uni_posts where id = post_id) = (select university from profiles where id = auth.uid()));
create policy "replies delete" on public.uni_replies for delete to authenticated using (
  user_id = auth.uid() or is_moderator_of((select uni from uni_posts where id = post_id)));

create or replace function public.bump_replies() returns trigger language plpgsql as $$
begin
  update uni_posts set reply_count = (select count(*) from uni_replies where post_id = coalesce(new.post_id, old.post_id))
   where id = coalesce(new.post_id, old.post_id);
  return null;
end $$;
create trigger trg_bump_replies after insert or delete on public.uni_replies
  for each row execute function public.bump_replies();

-- ============ عدد أعضاء كل مجتمع ============
create or replace function public.community_counts()
returns table (uni text, n bigint)
language sql stable security definer set search_path = public as $$
  select university, count(*) from profiles
  where university is not null and university <> '' group by university
$$;
grant execute on function public.community_counts() to anon, authenticated;
```

**كيف يصير طالب مشرفاً:** يضغط «قدّم لتكون مشرفاً» بصفحة مجتمع جامعته ويكتب سببه، فيُسجَّل `pending`. أنتم تفتحون `uni_moderators` بـ Supabase وتغيّرون `status` إلى `active`. الدالة تشترط أن تكون جامعته بملفه مطابقة، فلو غيّرها يفقد الإشراف تلقائياً.

**صلاحيات المشرف:** اعتماد ورفض منشورات جامعته فقط، وحذف الردود المسيئة فيها، وحذف تعليقات مباني طلاب جامعته. لا يملك نقاطاً ولا مشاريع ولا حسابات.

**لم يُختبر** أي من هذا على Supabase فعلي. الوضع المحلي (بالمتصفح) مختبر.

## دعوة صديق (+١٠ للداعي، +٥ للمدعو)

النقاط تنزل عند **اعتماد أول محتوى للمدعو**، لا عند التسجيل — لأن التسجيل مجاني على المزوّر، والاعتماد يمرّ بكم.

```sql
alter table public.profiles
  add column referred_by uuid references profiles(id) on delete set null,
  add column invite_paid boolean not null default false;

-- الداعي يُثبَّت مرة واحدة ولا يتغير، ولا يدعو الطالب نفسه
create or replace function public.lock_referrer() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.referred_by is not null then new.referred_by := old.referred_by; end if;
  if new.referred_by = new.id then new.referred_by := null; end if;
  if tg_op = 'UPDATE' then new.invite_paid := old.invite_paid; end if;   -- لا يُعدَّل من الواجهة
  return new;
end $$;
create trigger trg_lock_referrer before insert or update on public.profiles
  for each row execute function public.lock_referrer();

-- تُستدعى من on_feedback_approved بعد منح نقاط المحتوى
create or replace function public.pay_invite(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ref uuid; paid boolean; n int;
begin
  select referred_by, invite_paid into ref, paid from profiles where id = uid;
  if ref is null or paid then return; end if;
  select count(*) into n from profiles where referred_by = ref and invite_paid;
  if n >= 10 then                                  -- سقف 10 أصدقاء لكل داعٍ
    update profiles set invite_paid = true where id = uid;   -- لا تُدفع، ولا تُحاول ثانية
    return;
  end if;
  update profiles set invite_paid = true where id = uid;
  perform award(uid, 5,  'welcome', null);
  perform award(ref, 10, 'invite',  null);
end $$;
revoke all on function public.pay_invite(uuid) from public, anon, authenticated;
```

أضيفوا السطر الأخير داخل `on_feedback_approved()` بعد منح نقاط المحتوى:

```sql
perform pay_invite(new.user_id);
```

**الرابط:** `/join?ref=<معرّف-الطالب>` من كرت «ادعُ صديقك» بصفحة حسابه، مع زر نسخ وزر واتساب.

**الحماية:** الداعي يُثبَّت عند التسجيل ولا يتغير بعدها، ولا يدعو الطالب نفسه، والمكافأة تُدفع مرة واحدة فقط لكل مدعو، وبسقف ١٠ أصدقاء. ومع ذلك تبقى ثغرة واحدة: **شخص يفتح حسابات بأسماء مختلفة ويكتب تعليقاً حقيقياً بكل واحد**. الحاجز الوحيد هنا هو مراجعتكم للمحتوى، فانتبهوا لتعليقات متشابهة تصل بوقت متقارب.

**لم يُختبر** على Supabase. الوضع المحلي مختبر: التسجيل بالرابط ← تعليق ← اعتماد ← نزلت ١٠ للداعي و٥ للمدعو، ولم تتكرر عند اعتماد محتوى ثانٍ.
