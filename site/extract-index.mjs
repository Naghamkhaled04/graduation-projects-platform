// يستخرج مصفوفة P من pages/index.html إلى src/data/projects.json (تشغيل مرة واحدة)
import fs from 'node:fs';
const html = fs.readFileSync('../pages/index.html', 'utf8');
const start = html.indexOf('const P=[');
let i = html.indexOf('[', start), depth = 0, end = i;
for (; end < html.length; end++) {
  const c = html[end];
  if (c === '[') depth++; else if (c === ']' && --depth === 0) break;
}
const P = new Function('return ' + html.slice(i, end + 1))();
fs.writeFileSync('src/data/projects.json', JSON.stringify(P, null, 1));
console.log(P.length, 'projects;', 'keys:', Object.keys(P[0]).join(','));
console.log('exclusive:', P.filter(p => p.x).length, '| levels:', [...new Set(P.map(p => p.ln))].join('،'));
