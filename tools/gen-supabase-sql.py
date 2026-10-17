# -*- coding: utf-8 -*-
"""يدمج سكربتات docs/*.md بملف واحد آمن للإعادة.
    python tools/gen-supabase-sql.py
"""
import io, re, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

def statements(sql):
    out, buf, dollar = [], [], False
    for line in sql.splitlines(True):
        if line.count('$$') % 2: dollar = not dollar
        buf.append(line)
        if not dollar and line.rstrip().endswith(';'):
            out.append(''.join(buf).strip()); buf = []
    if ''.join(buf).strip(): out.append(''.join(buf).strip())
    return out

def head(st):
    for l in st.splitlines():
        l = l.strip()
        if l and not l.startswith('--'): return l
    return ''

def idempotent(st):
    h = head(st)
    if h.lower().startswith('drop '): return st          # مكتوبة محمية أصلاً
    # إضافة جدول لمنشور البث توقع لو كان مضافاً — نتجاهل التكرار وحده
    if h.lower().startswith('alter publication'):
        return 'do $do$ begin\n  ' + st.rstrip() + '\nexception when duplicate_object then null; end $do$;'
    st = re.sub(r'\bcreate table (?!if not exists)', 'create table if not exists ', st, 1, re.I)
    m = re.match(r'create (unique )?index on ([\w.]+)\s*\(([^)]*)\)', h, re.I)
    if m:
        nm = m.group(2).split('.')[-1] + '_' + '_'.join(re.findall(r'\w+', m.group(3))[:2])
        st = st.replace(m.group(0), f'create {m.group(1) or ""}index if not exists {nm} on {m.group(2)} ({m.group(3)})', 1)
    else:
        st = re.sub(r'\bcreate (unique )?index (?!if not exists)', r'create \1index if not exists ', st, 1, re.I)
    m = re.match(r'create policy\s+("[^"]+"|\S+)\s+on\s+([\w.]+)', h, re.I)
    if m: return f'drop policy if exists {m.group(1)} on {m.group(2)};\n{st}'
    m = re.match(r'create trigger\s+(\S+).*?\son\s+([\w.]+)', h, re.I | re.S)
    if m: return f'drop trigger if exists {m.group(1)} on {m.group(2)};\n{st}'
    return st

CITY = r'buildings|building_|\bfollows\b|advisor_usage|bump_advisor|building_stats'
# المجتمعات معرّفة بنسختين؛ communities-sql.md هي الصح (٦ أنواع، due، ومساحات عامة)
OLD_COM = r'\buni_posts\b|\buni_replies\b|\buni_moderators\b|is_moderator_of|bump_replies'
KEEP = re.compile(r'^(create|alter|insert|update|comment|grant|drop)\b', re.I)

PARTS = [('١. الحسابات والنقاط والتقييمات', 'docs/community-backend.md', CITY + '|' + OLD_COM),
         ('٢. المجتمعات',                   'docs/communities-sql.md',   CITY),
         ('٣. مساحة الفريق',                'docs/teams-sql.md',         CITY),
         ('٤. رسائل الطلاب والإدارة',        'docs/messages-sql.md',      CITY),
         ('٥. صلاحيات الأدمن',              'docs/admin-sql.md',         CITY),
         ('٦. المسابقات والإيفنتات',          'docs/events-sql.md',        CITY)]

out = ['-- ============================================================',
       '-- إعداد قاعدة بيانات منصة مشاريع التخرج — سوبابيس',
       '--',
       '-- الصقيه كله بـ SQL Editor واضغطي Run. آمن للإعادة.',
       '-- مولَّد: python tools/gen-supabase-sql.py — عدّلي docs/*.md لا هذا الملف.',
       '-- مستثنى: المدينة الذكية (ملغاة)، والنسخة القديمة من جداول المجتمع.',
       '-- ============================================================',
       '',
       '-- ------------------------------------------------------------',
       '-- بداية نظيفة: شيلي التعليق وشغّلي السطر لحاله أولاً.',
       '-- **بيمسح كل البيانات** — قبل ما يصير عندك مستخدمون.',
       '--',
       '-- drop table if exists public.messages, public.team_notes, public.team_links,',
       '--   public.team_tasks, public.team_activity, public.team_members, public.teams,',
       '--   public.uni_replies, public.uni_posts, public.uni_moderators,',
       '--   public.redemptions, public.feedback, public.points_ledger,',
       '--   public.projects, public.profiles cascade;',
       '-- ------------------------------------------------------------']

for title, path, drop in PARTS:
    rx = re.compile(drop, re.I)
    keep = []
    for block in re.findall(r'```sql\n(.*?)```', io.open(path, encoding='utf-8').read(), re.S):
        for st in statements(block):
            if not KEEP.match(head(st)) or rx.search(st): continue
            keep.append(idempotent(st))
    out += ['', '-- ' + '=' * 58, f'-- {title}', '-- المصدر: ' + path, '-- ' + '=' * 58, '', '\n\n'.join(keep)]
    print(f'{path:32} {len(keep)} جملة')

txt = '\n'.join(out) + '\n'
io.open('docs/supabase-setup.sql', 'w', encoding='utf-8', newline='\n').write(txt)

tbl = re.findall(r'create table if not exists public\.(\w+)', txt)
fn = set(re.findall(r'create or replace function public\.(\w+)', txt))
used = set(re.findall(r'\b(?:on|references|join)\s+public\.(\w+)', txt))
dup = [t for t in set(tbl) if tbl.count(t) > 1]
bad = re.findall(r'^create (?!table if|or replace|unique index if|index if|policy|trigger)\S+.*$', txt, re.M)
print(f'\nجداول {len(tbl)} | دوال {len(fn)} | سياسات {len(re.findall(r"create policy", txt))} | أسطر {len(txt.splitlines())}')
print('مكررة   :', dup or 'ولا وحدة ✅')
print('ناقصة   :', sorted(used - set(tbl) - fn) or 'ولا وحدة ✅')
print('بلا حماية:', bad or 'ولا وحدة ✅')
sys.exit(1 if (dup or bad or (used - set(tbl) - fn)) else 0)
