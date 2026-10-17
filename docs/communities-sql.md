# جداول المجتمع (Supabase)

> ⚠️ **غير مُنفَّذ — مرجع فقط.** المنتج هو دروبل على `novatera.space`، وعنده مستخدمون وأدوار
> وتعليقات وسير اعتماد مدمجون. هذا الملف يبقى لأنه يوثّق **الصلاحيات المطلوبة** بدقة
> (مين بينشر وين، وشو بينقرأ)، فيُترجَم لأدوار دروبل عند بناء القسم ٧ من `drupal-build-plan.md`.

> هذا الملف يكمل `community-backend.md`. ذاك ينشئ `profiles` و`points_ledger` و`feedback` و`redemptions`،
> وهذا ينشئ جداول المجتمع الثلاثة التي يستعملها `site/src/community/communities.ts`:
> `uni_posts` و`uni_replies` و`uni_moderators`، مع الدالّتين `community_counts` و`is_moderator_of`.
>
> **شغّل `community-backend.md` أولاً** لأن الجداول هنا ترتبط بـ`profiles`.

## قبل أن تبدأ

عمود `uni` يحمل اسم الجامعة كما هو مكتوب في `site/src/data/universities.ts`،
أو أحد اسمي المساحتين العامتين من `site/src/data/spaces.ts`:

| القيمة | المساحة |
|---|---|
| `المجتمع العام` | مفتوحة لكل مسجّل |
| `الإعلانات` | قناة من الفريق — النشر للمشرفين فقط |
| اسم أي جامعة | مجتمع تلك الجامعة |

## السكربت

```sql
-- ============ الجداول ============

create table public.uni_posts (
  id          uuid primary key default gen_random_uuid(),
  uni         text not null check (char_length(uni) between 2 and 60),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('question','showcase','partner','resource','deadline','request')),
  title       text not null check (char_length(title) between 4 and 120),
  body        text not null check (char_length(body) between 2 and 2000),
  due         date,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reply_count int  not null default 0,
  created_at  timestamptz not null default now()
);
create index uni_posts_feed on public.uni_posts (uni, created_at desc);

create table public.uni_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.uni_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 600),
  created_at timestamptz not null default now()
);
create index uni_replies_post on public.uni_replies (post_id, created_at);

-- منشورات زي لينكد إن: لحد ٤ صور (روابط من Storage) وعدّاد إعجابات.
-- alter عشان تنضاف على قاعدة قايمة كمان
alter table public.uni_posts add column if not exists images text[] not null default '{}'
  check (coalesce(array_length(images, 1), 0) <= 4);
alter table public.uni_posts add column if not exists like_count int not null default 0;

create table public.post_likes (
  post_id    uuid not null references public.uni_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.uni_moderators (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  uni        text not null,
  why        text check (char_length(why) <= 400),
  status     text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at timestamptz not null default now(),
  primary key (uni, user_id)
);

-- ============ دوال ============

-- هل المستخدم الحالي مشرف على هذه المساحة؟ الأدمن مشرف على الكل
create or replace function public.is_moderator_of(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  ) or exists (
    select 1 from public.uni_moderators m
    where m.uni = u and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- عدد أعضاء كل جامعة: من حدّد جامعته بملفه
create or replace function public.community_counts()
returns table (uni text, n bigint)
language sql stable security definer set search_path = public as $$
  select university as uni, count(*) as n
  from public.profiles
  where university is not null and char_length(university) > 1
  group by university;
$$;

-- عدّاد الردود يُحدَّث تلقائياً
create or replace function public.bump_reply_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.uni_posts
     set reply_count = greatest(0, reply_count + case when tg_op = 'INSERT' then 1 else -1 end)
   where id = coalesce(new.post_id, old.post_id);
  return null;
end; $$;

drop trigger if exists uni_replies_count on public.uni_replies;
create trigger uni_replies_count
after insert or delete on public.uni_replies
for each row execute function public.bump_reply_count();

-- عدّاد الإعجابات يُحدَّث تلقائياً
create or replace function public.bump_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.uni_posts
     set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end)
   where id = coalesce(new.post_id, old.post_id);
  return null;
end; $$;

drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count
after insert or delete on public.post_likes
for each row execute function public.bump_like_count();

-- ============ الصلاحيات ============

alter table public.post_likes     enable row level security;
alter table public.uni_posts      enable row level security;
alter table public.uni_replies    enable row level security;
alter table public.uni_moderators enable row level security;

-- القراءة: المعتمَد للجميع، وصاحب المنشور يرى منشوره، والمشرف يرى كل شيء بمساحته
create policy "posts read" on public.uni_posts for select
  using (status = 'approved' or user_id = auth.uid() or public.is_moderator_of(uni));

-- النشر: مسجّل دخول فقط، ودائماً "قيد المراجعة".
-- الإعلانات وأنواع المشرفين (deadline) للمشرف وحده.
create policy "posts insert" on public.uni_posts for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending'
    and (uni <> 'الإعلانات' or public.is_moderator_of(uni))
    and (kind <> 'deadline'  or public.is_moderator_of(uni))
  );

-- التعديل: صاحبه ما دام معلّقاً، أو المشرف (للاعتماد والرفض)
create policy "posts update" on public.uni_posts for update to authenticated
  using (public.is_moderator_of(uni) or (user_id = auth.uid() and status = 'pending'))
  with check (public.is_moderator_of(uni) or (user_id = auth.uid() and status = 'pending'));

create policy "posts delete" on public.uni_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator_of(uni));

-- الردود: تُقرأ مع منشور ظاهر، وتُكتب من مسجّل، وتُحذف من صاحبها أو المشرف
create policy "replies read" on public.uni_replies for select
  using (exists (select 1 from public.uni_posts p where p.id = post_id
                 and (p.status = 'approved' or p.user_id = auth.uid() or public.is_moderator_of(p.uni))));

create policy "replies insert" on public.uni_replies for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.uni_posts p where p.id = post_id and p.status = 'approved'));

create policy "replies delete" on public.uni_replies for delete to authenticated
  using (user_id = auth.uid()
    or exists (select 1 from public.uni_posts p where p.id = post_id and public.is_moderator_of(p.uni)));

-- الإعجابات: كل واحد بيشوف إعجاباته، وبيعجب بمنشور معتمد مرة وحدة، وبيشيل إعجابه
create policy "likes read own" on public.post_likes for select to authenticated
  using (user_id = auth.uid());

create policy "likes insert" on public.post_likes for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.uni_posts p where p.id = post_id and p.status = 'approved'));

create policy "likes delete own" on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

-- صور المنشورات: عامة للقراءة، وكل طالب بيرفع بمجلده بس (حد ١.٥ ميغا للصورة)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 1572864, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

create policy "post images read" on storage.objects for select using (bucket_id = 'post-images');

create policy "post images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "post images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- المشرفون: القائمة ظاهرة، والطلب من صاحبه، والاعتماد من الأدمن فقط
create policy "mods read" on public.uni_moderators for select using (true);

create policy "mods apply" on public.uni_moderators for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "mods update own pending" on public.uni_moderators for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

create policy "mods admin" on public.uni_moderators for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
```

## أول مشرف

لا يستطيع أحد اعتماد نفسه. بعد تسجيل دخولك، اجعل حسابك أدمن مرة واحدة من **SQL Editor**:

```sql
update public.profiles set role = 'admin' where id = auth.uid();
```

ثم تستطيع اعتماد المشرفين من لوحة `/admin`، وتنشر في **الإعلانات**.

## التحقق بعد التشغيل

```sql
select tablename from pg_tables
 where schemaname = 'public' and tablename like 'uni_%';          -- ثلاثة صفوف
select public.is_moderator_of('المجتمع العام');                    -- false قبل أن تصير أدمن
select * from public.community_counts();                           -- فارغ حتى ينضم أحد
```
