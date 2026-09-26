// يستخرج محتوى صفحات المشاريع القديمة (pages/project-*.html) إلى src/data/details.json
// تشغيل مرة واحدة: node extract-details.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = '../pages';
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function arrayAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  let i = html.indexOf('[', at), depth = 0, end = i;
  for (; end < html.length; end++) {
    const c = html[end];
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) break;
  }
  return new Function('return ' + html.slice(i, end + 1))();
}
function section(html, title) {
  const re = new RegExp(`<h2>\\s*${title}[^<]*</h2>([\\s\\S]*?)(?=<div class="sec"|<!--|</div>\\s*</div>\\s*<script|$)`);
  return (html.match(re) || [])[1] || '';
}
const lis = (s) => [...s.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => strip(m[1]));

const out = {};
for (const f of fs.readdirSync(dir).filter((n) => /^project-.+\.html$/.test(n))) {
  const id = f.replace(/^project-|\.html$/g, '');
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const d = {};
  d.lead = strip((html.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || '');
  d.problem = strip((section(html, 'المشكلة').match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
  d.steps = [...html.matchAll(/<div class="step"><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/div>/g)].map((m) => [strip(m[1]), strip(m[2])]);
  d.feats = lis(section(html, 'مميزات'));
  d.chals = lis(section(html, 'التحديات'));
  d.gate = lis(section(html, 'ما يتضمنه|ماذا|ضمن الاستشارة|الاستشارة'));
  d.range = strip((html.match(/التكلفة التقريبية<\/span><span class="tnum">([\s\S]*?)<\/span>/) || [])[1] || '');
  d.groups = strip((html.match(/<span class="n">([\s\S]*?)<\/span>/) || [])[1] || '');
  try { d.parts = arrayAfter(html, 'const PARTS='); } catch { d.parts = null; }
  try { d.extras = arrayAfter(html, 'const EXTRAS='); } catch { d.extras = null; }
  out[id] = d;
}
fs.writeFileSync('src/data/details.json', JSON.stringify(out, null, 1));
const n = Object.keys(out).length;
const withParts = Object.values(out).filter((d) => d.parts?.length).length;
console.log(`${n} pages | with parts: ${withParts} | with steps: ${Object.values(out).filter((d) => d.steps.length).length} | with chals: ${Object.values(out).filter((d) => d.chals.length).length}`);
console.log('no parts:', Object.entries(out).filter(([, d]) => !d.parts?.length).map(([k]) => k).join(', '));
