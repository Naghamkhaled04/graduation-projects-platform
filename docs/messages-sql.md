# رسائل الطلاب والإدارة (Supabase)

> تكمل `community-backend.md` — ترتبط بـ`profiles` وتستعمل `is_admin()`.

**النموذج:** خيط واحد لكل طالب مع الإدارة. الطالب يرى خيطه وحده،
والأدمن يرى الكل ويرد. لا رسائل بين الطلاب — تلك ميزة أخرى ولم تُطلب.

## السكربت

```sql
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
create policy "messages read" on public.messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- الطالب يكتب باسمه فقط وبخيطه، والأدمن يكتب بأي خيط بعلامة from_admin
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert to authenticated
  with check (
    (user_id = auth.uid() and from_admin = false)
    or (public.is_admin() and from_admin = true)
  );

-- التعليم كمقروء فقط، ولا أحد يعدّل نص رسالة بعد إرسالها
drop policy if exists "messages mark read" on public.messages;
create policy "messages mark read" on public.messages for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "messages delete admin" on public.messages;
create policy "messages delete admin" on public.messages for delete to authenticated
  using (public.is_admin());

-- بث لحظي: الرسالة تظهر عند الطرف الثاني بلا تحديث الصفحة.
-- الصلاحيات نفسها تنطبق على البث، فلا يصل للطالب إلا خيطه.
alter publication supabase_realtime add table public.messages;

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
```

## التحقق

```sql
select count(*) from pg_policies where tablename = 'messages';  -- أربعة
select * from public.admin_threads();                           -- فارغ قبل أول رسالة
```
