# المسابقات والإيفنتات

TFC (الأدمن) بتنشر مسابقة أو إيفنت. الطالب بيسجّل بفريقه (`team`) أو بيطلب نشكّله فريق (`match`)
مع أدواره. TFC بتشكّل الفرق من الموقع (`scripts/teammatch.js`) وبتعتمدها بـ`set_event_teams`،
وكل طالب بيشوف أعضاء فريقه بس عن طريق `event_teammates`.

## السكربت

```sql
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'competition' check (kind in ('competition','event')),
  title      text not null check (char_length(title) between 4 and 120),
  body       text not null default '' check (char_length(body) <= 1500),
  starts_on  date not null,
  signup_by  date,
  place      text not null default '' check (char_length(place) <= 80),
  team_size  int  not null default 3 check (team_size between 2 and 8),
  skills     text[] not null default '{}',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_signups (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mode       text not null check (mode in ('team','match')),
  team_name  text check (char_length(team_name) <= 60),
  roles      text[] not null default '{}',
  skills     text[] not null default '{}',
  team_no    int,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- اعتماد الفرق: [{no, ids:[uuid…]}] — TFC بس
create or replace function public.set_event_teams(e uuid, teams jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select role from public.profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'TFC فقط';
  end if;
  update public.event_signups set team_no = null where event_id = e;
  update public.event_signups s set team_no = (t->>'no')::int
    from jsonb_array_elements(teams) t
   where s.event_id = e and s.user_id::text in (select jsonb_array_elements_text(t->'ids'));
end; $$;

-- أعضاء فريقي بمسابقة: الأسماء والأدوار بس، بدون باقي المسجّلين
create or replace function public.event_teammates(e uuid)
returns table (name text, roles text[])
language sql stable security definer set search_path = public as $$
  select p.display_name, s.roles
    from public.event_signups s
    join public.profiles p on p.id = s.user_id
   where s.event_id = e and s.user_id <> auth.uid() and s.team_no is not null
     and s.team_no = (select team_no from public.event_signups where event_id = e and user_id = auth.uid());
$$;

alter table public.events        enable row level security;
alter table public.event_signups enable row level security;

-- المسابقات ظاهرة للكل، والنشر والتعديل لـTFC
create policy "events read" on public.events for select using (true);

create policy "events admin" on public.events for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- التسجيل: كل طالب بيشوف ويعدّل تسجيله (بدون رقم الفريق)، وTFC بتشوف الكل
create policy "signups read" on public.event_signups for select to authenticated
  using (user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "signups insert own" on public.event_signups for insert to authenticated
  with check (user_id = auth.uid() and team_no is null);

create policy "signups update own" on public.event_signups for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and team_no is null);

create policy "signups delete own" on public.event_signups for delete to authenticated
  using (user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');
```
