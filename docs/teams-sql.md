# جداول مساحة الفريق (Supabase)

> تكمل `community-backend.md` — ترتبط بـ`profiles`، فشغّلي ذاك أولاً.
> تنفّذ الواجهة `Teams` في `site/src/community/teams.ts`.

**نموذج العضوية:** الطالب بفريق واحد. عضو الفريق إما حساب حقيقي (`user_id`) أو
اسم ضافه زميله بدون حساب (`user_id` فاضي) — متل النسخة المحلية بالضبط.

## السكربت

```sql
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 60),
  project    text check (char_length(project) <= 60),
  created_at timestamptz not null default now()
);

create table public.team_members (
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
create unique index team_members_one_team on public.team_members (user_id) where user_id is not null;
create index team_members_team on public.team_members (team_id);

create table public.team_tasks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  title      text not null check (char_length(title) between 3 and 120),
  assignee   uuid references public.team_members(id) on delete set null,
  status     text not null default 'todo' check (status in ('todo','doing','done')),
  due        date,
  created_at timestamptz not null default now()
);
create index team_tasks_team on public.team_tasks (team_id, created_at desc);

create table public.team_links (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 100),
  -- http/https فقط: يمنع javascript: من الوصول للجدول أصلاً
  url        text not null check (url ~* '^https?://'),
  author     text not null,
  created_at timestamptz not null default now()
);
create index team_links_team on public.team_links (team_id, created_at desc);

create table public.team_notes (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.team_links(id) on delete cascade,
  author     text not null,
  body       text not null check (char_length(body) between 2 and 400),
  created_at timestamptz not null default now()
);
create index team_notes_link on public.team_notes (link_id, created_at);

create table public.team_activity (
  id      uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  who     text not null,
  what    text not null check (char_length(what) <= 160),
  at      timestamptz not null default now()
);
create index team_activity_team on public.team_activity (team_id, at desc);

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
create trigger team_members_cleanup after delete on public.team_members
for each row execute function public.drop_empty_team();

-- ============ الصلاحيات: الفريق يرى ويعدّل شغله وحده ============

alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.team_tasks    enable row level security;
alter table public.team_links    enable row level security;
alter table public.team_notes    enable row level security;
alter table public.team_activity enable row level security;

create policy "team read"   on public.teams for select using (public.is_team_member(id));
create policy "team update" on public.teams for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));
-- الإنشاء يمرّ عبر create_team() فقط

create policy "members rw" on public.team_members for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

create policy "tasks rw" on public.team_tasks for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

create policy "links rw" on public.team_links for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

create policy "notes rw" on public.team_notes for all to authenticated
  using (exists (select 1 from public.team_links l where l.id = link_id and public.is_team_member(l.team_id)))
  with check (exists (select 1 from public.team_links l where l.id = link_id and public.is_team_member(l.team_id)));

create policy "activity read"   on public.team_activity for select using (public.is_team_member(team_id));
create policy "activity insert" on public.team_activity for insert to authenticated
  with check (public.is_team_member(team_id));
```

## التحقق بعد التشغيل

```sql
select tablename from pg_tables
 where schemaname = 'public' and tablename like 'team%';   -- ستة صفوف
select public.my_team();                                    -- null قبل أن تنشئ فريقاً
```
