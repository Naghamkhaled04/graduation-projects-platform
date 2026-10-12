# صلاحيات الأدمن (Supabase)

> تكمل `community-backend.md`. سياسة `profiles` تسمح للشخص بتعديل ملفه وحده،
> فترقية حساب آخر لا تمر منها. تمر عبر دالة `security definer` يفحص فيها
> الخادم أن المنادي أدمن فعلاً — فلا يرقّي أحد نفسه من المتصفح.

## السكربت

```sql
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
```

## التحقق

```sql
select public.admin_set_role(auth.uid(), 'student');  -- يرفض: آخر أدمن
select * from public.public_roles();                   -- صفّك
```
