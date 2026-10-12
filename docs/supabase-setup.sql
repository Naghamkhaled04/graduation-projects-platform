-- ============================================================
-- إعداد قاعدة بيانات منصة مشاريع التخرج — سوبابيس
--
-- الصقيه كله بـ SQL Editor واضغطي Run. آمن للإعادة.
-- مولَّد: python tools/gen-supabase-sql.py — عدّلي docs/*.md لا هذا الملف.
-- مستثنى: المدينة الذكية (ملغاة)، والنسخة القديمة من جداول المجتمع.
-- ============================================================

-- ------------------------------------------------------------
-- بداية نظيفة: شيلي التعليق وشغّلي السطر لحاله أولاً.
-- **بيمسح كل البيانات** — قبل ما يصير عندك مستخدمون.
--
-- drop table if exists public.messages, public.team_notes, public.team_links,
--   public.team_tasks, public.team_activity, public.team_members, public.teams,
--   public.uni_replies, public.uni_posts, public.uni_moderators,
--   public.redemptions, public.feedback, public.points_ledger,
--   public.projects, public.profiles cascade;
-- ------------------------------------------------------------

-- ==========================================================
-- ١. الحسابات والنقاط والتقييمات
-- المصدر: docs/community-backend.md
-- ==========================================================

-- ============ الملفات التعريفية ============
create table if not exists public.profiles (
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

-- البريد الجامعي: للعرض على الإدارة ولاستنتاج الجامعة. غير مؤكّد —
-- حساب الطالب على بريده الشخصي ليصله كود الاستعادة دائماً.
alter table public.profiles add column if not exists uni_email text check (char_length(uni_email) <= 120);

alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'student' and points = 0);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant update (display_name, university, major, year, bio) on public.profiles to authenticated;

-- إنشاء ملف تلقائياً عند التسجيل
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email,'@',1),''), 'طالب'));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ سجل النقاط (للقراءة فقط من المتصفح) ============
create table if not exists public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  unique (reason, ref_id)
);

alter table public.points_ledger enable row level security;

drop policy if exists "ledger own or admin" on public.points_ledger;
create policy "ledger own or admin" on public.points_ledger for select
  using (user_id = auth.uid() or is_admin());

create or replace function public.award(uid uuid, d int, why text, ref uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into points_ledger (user_id, delta, reason, ref_id) values (uid, d, why, ref)
  on conflict (reason, ref_id) do nothing;
  if found then update profiles set points = points + d where id = uid; end if;
end $$;

-- ============ الفيدباك والتقييمات ============
create table if not exists public.feedback (
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

drop policy if exists "feedback read" on public.feedback;
create policy "feedback read" on public.feedback for select
  using (status = 'approved' or user_id = auth.uid() or is_admin());

drop policy if exists "feedback insert own pending" on public.feedback;
create policy "feedback insert own pending" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "feedback edit own pending" on public.feedback;
create policy "feedback edit own pending" on public.feedback for update to authenticated
  using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "feedback admin all" on public.feedback;
create policy "feedback admin all" on public.feedback for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "feedback delete own" on public.feedback;
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

drop trigger if exists feedback_points on public.feedback;
create trigger feedback_points after update of status on public.feedback
  for each row execute function public.on_feedback_approved();

-- ============ استبدال النقاط باستشارة مجانية ============
create table if not exists public.redemptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  code       text not null unique,
  status     text not null default 'open' check (status in ('open','used','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.redemptions enable row level security;

drop policy if exists "redemptions own or admin" on public.redemptions;
create policy "redemptions own or admin" on public.redemptions for select
  using (user_id = auth.uid() or is_admin());

drop policy if exists "redemptions admin update" on public.redemptions;
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

-- ============ تعديل نقاط يدوي (للأدمن فقط) ============
create or replace function public.admin_adjust_points(uid uuid, d int, why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'غير مسموح'; end if;
  perform award(uid, d, 'admin: ' || left(why, 60), gen_random_uuid());
end $$;

grant execute on function public.admin_adjust_points(uuid,int,text) to authenticated;

-- ============ المشاريع (تُدار من لوحة الأدمن) ============
create table if not exists public.projects (
  id         text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  data       jsonb not null,
  status     text not null default 'draft' check (status in ('draft','published','hidden')),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "projects read public" on public.projects;
-- الزائر يرى المنشور والمخفي (المخفي لإخفاء مشروع ثابت)، والمسودات للأدمن فقط
create policy "projects read public" on public.projects for select
  using (status in ('published','hidden') or is_admin());

drop policy if exists "projects admin write" on public.projects;
create policy "projects admin write" on public.projects for all to authenticated
  using (is_admin()) with check (is_admin());

-- ============ صور الفيدباك (Storage) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', true, 1572864, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

drop policy if exists "fb images read" on storage.objects;
create policy "fb images read" on storage.objects for select using (bucket_id = 'feedback-images');

drop policy if exists "fb images upload own folder" on storage.objects;
create policy "fb images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fb images delete own" on storage.objects;
create policy "fb images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-images' and (storage.foldername(name))[1] = auth.uid()::text);

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'بريدكم@example.com');

-- ============ عدد أعضاء كل مجتمع ============
create or replace function public.community_counts()
returns table (uni text, n bigint)
language sql stable security definer set search_path = public as $$
  select university, count(*) from profiles
  where university is not null and university <> '' group by university
$$;

grant execute on function public.community_counts() to anon, authenticated;

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

drop trigger if exists trg_lock_referrer on public.profiles;
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

-- ==========================================================
-- ٢. المجتمعات
-- المصدر: docs/communities-sql.md
-- ==========================================================

-- ============ الجداول ============

create table if not exists public.uni_posts (
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

create index if not exists uni_posts_feed on public.uni_posts (uni, created_at desc);

create table if not exists public.uni_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.uni_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 600),
  created_at timestamptz not null default now()
);

create index if not exists uni_replies_post on public.uni_replies (post_id, created_at);

create table if not exists public.uni_moderators (
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

create trigger uni_replies_count
after insert or delete on public.uni_replies
for each row execute function public.bump_reply_count();

-- ============ الصلاحيات ============

alter table public.uni_posts      enable row level security;

alter table public.uni_replies    enable row level security;

alter table public.uni_moderators enable row level security;

drop policy if exists "posts read" on public.uni_posts;
-- القراءة: المعتمَد للجميع، وصاحب المنشور يرى منشوره، والمشرف يرى كل شيء بمساحته
create policy "posts read" on public.uni_posts for select
  using (status = 'approved' or user_id = auth.uid() or public.is_moderator_of(uni));

drop policy if exists "posts insert" on public.uni_posts;
-- النشر: مسجّل دخول فقط، ودائماً "قيد المراجعة".
-- الإعلانات وأنواع المشرفين (deadline) للمشرف وحده.
create policy "posts insert" on public.uni_posts for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending'
    and (uni <> 'الإعلانات' or public.is_moderator_of(uni))
    and (kind <> 'deadline'  or public.is_moderator_of(uni))
  );

drop policy if exists "posts update" on public.uni_posts;
-- التعديل: صاحبه ما دام معلّقاً، أو المشرف (للاعتماد والرفض)
create policy "posts update" on public.uni_posts for update to authenticated
  using (public.is_moderator_of(uni) or (user_id = auth.uid() and status = 'pending'))
  with check (public.is_moderator_of(uni) or (user_id = auth.uid() and status = 'pending'));

drop policy if exists "posts delete" on public.uni_posts;
create policy "posts delete" on public.uni_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator_of(uni));

drop policy if exists "replies read" on public.uni_replies;
-- الردود: تُقرأ مع منشور ظاهر، وتُكتب من مسجّل، وتُحذف من صاحبها أو المشرف
create policy "replies read" on public.uni_replies for select
  using (exists (select 1 from public.uni_posts p where p.id = post_id
                 and (p.status = 'approved' or p.user_id = auth.uid() or public.is_moderator_of(p.uni))));

drop policy if exists "replies insert" on public.uni_replies;
create policy "replies insert" on public.uni_replies for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.uni_posts p where p.id = post_id and p.status = 'approved'));

drop policy if exists "replies delete" on public.uni_replies;
create policy "replies delete" on public.uni_replies for delete to authenticated
  using (user_id = auth.uid()
    or exists (select 1 from public.uni_posts p where p.id = post_id and public.is_moderator_of(p.uni)));

drop policy if exists "mods read" on public.uni_moderators;
-- المشرفون: القائمة ظاهرة، والطلب من صاحبه، والاعتماد من الأدمن فقط
create policy "mods read" on public.uni_moderators for select using (true);

drop policy if exists "mods apply" on public.uni_moderators;
create policy "mods apply" on public.uni_moderators for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "mods update own pending" on public.uni_moderators;
create policy "mods update own pending" on public.uni_moderators for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "mods admin" on public.uni_moderators;
create policy "mods admin" on public.uni_moderators for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

update public.profiles set role = 'admin' where id = auth.uid();

-- ==========================================================
-- ٣. مساحة الفريق
-- المصدر: docs/teams-sql.md
-- ==========================================================

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 60),
  project    text check (char_length(project) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id      uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  name    text not null check (char_length(name) between 2 and 40),
  roles   text[] not null default '{}',
  skills  text[] not null default '{}',
  wants   text[] not null default '{}',
  joined_at timestamptz not null default now()
);

-- حساب واحد لا يكون بفريقين، ولا يتكرر داخل نفس الفريق
create unique index if not exists team_members_one_team on public.team_members (user_id) where user_id is not null;

create index if not exists team_members_team on public.team_members (team_id);

create table if not exists public.team_tasks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  title      text not null check (char_length(title) between 3 and 120),
  assignee   uuid references public.team_members(id) on delete set null,
  status     text not null default 'todo' check (status in ('todo','doing','done')),
  due        date,
  created_at timestamptz not null default now()
);

create index if not exists team_tasks_team on public.team_tasks (team_id, created_at desc);

create table if not exists public.team_links (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 100),
  -- http/https فقط: يمنع javascript: من الوصول للجدول أصلاً
  url        text not null check (url ~* '^https?://'),
  author     text not null,
  created_at timestamptz not null default now()
);

create index if not exists team_links_team on public.team_links (team_id, created_at desc);

create table if not exists public.team_notes (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.team_links(id) on delete cascade,
  author     text not null,
  body       text not null check (char_length(body) between 2 and 400),
  created_at timestamptz not null default now()
);

create index if not exists team_notes_link on public.team_notes (link_id, created_at);

create table if not exists public.team_activity (
  id      uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  who     text not null,
  what    text not null check (char_length(what) <= 160),
  at      timestamptz not null default now()
);

create index if not exists team_activity_team on public.team_activity (team_id, at desc);

-- ============ دوال ============

-- هل المستخدم الحالي عضو بهذا الفريق؟ security definer ليتجاوز RLS على team_members
-- وإلا صارت السياسة تستدعي نفسها (recursion) عند قراءة الأعضاء.
create or replace function public.is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members m where m.team_id = t and m.user_id = auth.uid());
$$;

-- فريق المستخدم الحالي (أو null)
create or replace function public.my_team() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.team_members where user_id = auth.uid() limit 1;
$$;

-- إنشاء فريق وإضافة المنشئ كعضو — بعملية واحدة، فلا يبقى فريق بلا أعضاء لو فشل النصف الثاني
create or replace function public.create_team(nm text, proj text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'AUTH'; end if;
  if public.my_team() is not null then raise exception 'عندك فريق أصلاً'; end if;
  insert into public.teams (name, project) values (nm, proj) returning id into t;
  insert into public.team_members (team_id, user_id, name) values (t, auth.uid(), my_name);
  insert into public.team_activity (team_id, who, what) values (t, my_name, 'أنشأ الفريق');
  return t;
end; $$;

-- الحد ٨ أعضاء — بالقاعدة لا بالمتصفح
create or replace function public.cap_team_size() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.team_members where team_id = new.team_id) >= 8
    then raise exception 'الحد ٨ أعضاء';
  end if;
  return new;
end; $$;

drop trigger if exists team_members_cap on public.team_members;
create trigger team_members_cap before insert on public.team_members
for each row execute function public.cap_team_size();

-- آخر عضو يغادر: الفريق ينحذف معه بدل ما يضل يتيم
create or replace function public.drop_empty_team() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.team_members where team_id = old.team_id)
    then delete from public.teams where id = old.team_id;
  end if;
  return null;
end; $$;

drop trigger if exists team_members_cleanup on public.team_members;
create trigger team_members_cleanup after delete on public.team_members
for each row execute function public.drop_empty_team();

-- ============ الصلاحيات: الفريق يرى ويعدّل شغله وحده ============

alter table public.teams         enable row level security;

alter table public.team_members  enable row level security;

alter table public.team_tasks    enable row level security;

alter table public.team_links    enable row level security;

alter table public.team_notes    enable row level security;

alter table public.team_activity enable row level security;

drop policy if exists "team read" on public.teams;
create policy "team read"   on public.teams for select using (public.is_team_member(id));

drop policy if exists "team update" on public.teams;
create policy "team update" on public.teams for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));

drop policy if exists "members rw" on public.team_members;
-- الإنشاء يمرّ عبر create_team() فقط

create policy "members rw" on public.team_members for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

drop policy if exists "tasks rw" on public.team_tasks;
create policy "tasks rw" on public.team_tasks for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

drop policy if exists "links rw" on public.team_links;
create policy "links rw" on public.team_links for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

drop policy if exists "notes rw" on public.team_notes;
create policy "notes rw" on public.team_notes for all to authenticated
  using (exists (select 1 from public.team_links l where l.id = link_id and public.is_team_member(l.team_id)))
  with check (exists (select 1 from public.team_links l where l.id = link_id and public.is_team_member(l.team_id)));

drop policy if exists "activity read" on public.team_activity;
create policy "activity read"   on public.team_activity for select using (public.is_team_member(team_id));

drop policy if exists "activity insert" on public.team_activity;
create policy "activity insert" on public.team_activity for insert to authenticated
  with check (public.is_team_member(team_id));

-- ==========================================================
-- ٤. رسائل الطلاب والإدارة
-- المصدر: docs/messages-sql.md
-- ==========================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  -- صاحب الخيط: الطالب. يبقى هو نفسه سواء كتب الطالب أو ردّ الأدمن
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_admin boolean not null default false,
  body       text not null check (char_length(body) between 2 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread on public.messages (user_id, created_at);

-- للأدمن: ترتيب الخيوط بآخر رسالة
create index if not exists messages_recent on public.messages (created_at desc);

alter table public.messages enable row level security;

-- الطالب يقرأ خيطه، والأدمن يقرأ الكل
drop policy if exists "messages read" on public.messages;

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- الطالب يكتب باسمه فقط وبخيطه، والأدمن يكتب بأي خيط بعلامة from_admin
drop policy if exists "messages insert" on public.messages;

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert to authenticated
  with check (
    (user_id = auth.uid() and from_admin = false)
    or (public.is_admin() and from_admin = true)
  );

-- التعليم كمقروء فقط، ولا أحد يعدّل نص رسالة بعد إرسالها
drop policy if exists "messages mark read" on public.messages;

drop policy if exists "messages mark read" on public.messages;
create policy "messages mark read" on public.messages for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages delete admin" on public.messages;

drop policy if exists "messages delete admin" on public.messages;
create policy "messages delete admin" on public.messages for delete to authenticated
  using (public.is_admin());

-- قائمة الخيوط للأدمن: آخر رسالة وعدد غير المقروء، بنداء واحد
create or replace function public.admin_threads()
returns table (user_id uuid, name text, last_body text, last_at timestamptz, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.user_id,
         coalesce(p.display_name, 'طالب'),
         (select body from messages x where x.user_id = m.user_id order by created_at desc limit 1),
         max(m.created_at),
         count(*) filter (where m.read_at is null and m.from_admin = false)
    from messages m left join profiles p on p.id = m.user_id
   where public.is_admin()
   group by m.user_id, p.display_name
   order by max(m.created_at) desc
   limit 200;
$$;

-- ==========================================================
-- ٥. صلاحيات الأدمن
-- المصدر: docs/admin-sql.md
-- ==========================================================

create or replace function public.admin_set_role(uid uuid, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'للأدمن فقط'; end if;
  if r not in ('student','admin') then raise exception 'دور غير معروف'; end if;
  -- آخر أدمن لا ينزّل نفسه، وإلا ضاعت اللوحة على الجميع
  if r = 'student' and uid = auth.uid()
     and (select count(*) from profiles where role = 'admin') <= 1
    then raise exception 'إنت آخر أدمن — رقّي حداً غيرك أولاً';
  end if;
  update profiles set role = r where id = uid;
end; $$;

-- اسم ودور أي حساب: لعرض شارة «فريق المنصة» جنب الاسم
create or replace function public.public_roles()
returns table (id uuid, role text)
language sql stable security definer set search_path = public as $$
  select id, role from profiles where role = 'admin';
$$;

grant execute on function public.public_roles() to anon, authenticated;
