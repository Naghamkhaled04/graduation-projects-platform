import * as THREE from 'three';
import { KINDS, DEFAULT_COLOR, autoLayout, registerModel, guessKind, type Kind, type Item } from '../model/spec';
import { compress } from '../community/img';
import { svg } from '../data/icons';
import { createStage, makeEnv, configureRenderer, type Stage } from '../scripts/stage';
import { CATS, costOf, emptyDoc, getProjectStore, type PartDoc, type ProjectDoc } from '../projects/store';

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PREVIEW_ID = '__preview__';
const kindOpts = (cur: string) => KINDS.map((k) => `<option value="${k.k}" ${k.k === cur ? 'selected' : ''}>${k.label}</option>`).join('');
const ctl = (items: Item[]) => items.findIndex((i) => i.kind === 'mcu' || i.kind === 'arduino');
const wiresFor = (items: Item[]): [number, number][] => { const c = ctl(items); return c < 0 ? [] : items.map((_, i) => i).filter((i) => i !== c).map((i) => [c, i] as [number, number]); };

function setPath(o: any, path: string, v: any) {
  const ks = path.split('.'); let t = o;
  for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
  t[ks[ks.length - 1]] = v;
}

/** معاينة المجسم داخل المحرر: تُعاد بناؤها عند كل تعديل مع الحفاظ على زاوية الكاميرا */
function previewer(el: HTMLElement) {
  const canvas = el.querySelector('canvas')!;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); configureRenderer(r);
  const env = makeEnv(r); let first = true; let st: Stage | null = null, ry = 0.6, rx = 0.45, dist = 0, alive = true, drag = false, px = 0, py = 0;
  const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); st?.fit(w / h); };
  new ResizeObserver(size).observe(el);
  canvas.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => (drag = false));
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; ry += (e.clientX - px) * 0.008; rx = Math.max(0.05, Math.min(1.25, rx + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; });
  const t0 = performance.now();
  const loop = () => { if (!alive) return; requestAnimationFrame(loop); if (!st || !el.isConnected) return; st.update((performance.now() - t0) / 1000, ry, rx, dist || st.dist); r.render(st.scene, st.cam); };
  loop();
  return {
    update() { st?.dispose(); st = createStage(PREVIEW_ID, env, (el.clientWidth || 600) / (el.clientHeight || 340), 512, !first); first = false; size(); if (!dist) dist = st.dist; else { dist = Math.min(dist, st.dist * 1.6); } },
    stop() { alive = false; st?.dispose(); r.dispose(); },
  };
}

export async function openEditor(initial: ProjectDoc | null, onDone: () => void) {
  const store = await getProjectStore();
  const doc: ProjectDoc = structuredClone(initial ?? emptyDoc());
  const isNew = !initial;
  const ov = document.createElement('div'); ov.className = 'ed-ov';
  ov.innerHTML = `<div class="ed"><div class="ed-top"><h2>${isNew ? 'مشروع جديد' : 'تعديل: ' + esc(doc.title)}</h2><button type="button" class="c-btn ghost" data-close>إغلاق</button></div>
    <div class="ed-body"><div class="ed-form"></div><aside class="ed-side"><div class="ed-prev"><canvas></canvas><small>اسحب لتدوير المجسم</small></div><div class="ed-model"></div></aside></div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const form = ov.querySelector<HTMLElement>('.ed-form')!, side = ov.querySelector<HTMLElement>('.ed-model')!;
  const prev = previewer(ov.querySelector<HTMLElement>('.ed-prev')!);

  const refreshModel = () => { registerModel(PREVIEW_ID, doc.model ?? undefined); prev.update(); };
  // المجسم يتولد تلقائياً من القطع طالما ما عدّلتوه يدوياً. نوع كل قطعة يتحدد من اسمها ما لم تغيّروه بإيدكم
  let manual = !!doc.model && !!initial;
  const kindLocked = new Set<string>();
  const regen = () => { manual = false; const ks = doc.parts.map((p) => p.kind).filter((k) => k !== 'none'); doc.model = ks.length ? autoLayout(ks) : null; };
  let autoT = 0;
  const schedule = () => { clearTimeout(autoT); autoT = window.setTimeout(() => { if (manual) return; regen(); paintModel(); refreshModel(); }, 350); };
  if (!doc.model && doc.parts.length) regen();

  /* ---------- نموذج المشروع (بنفس التقسيم المعتمد) ---------- */
  function paintForm() {
    const y = form.scrollTop;
    form.innerHTML = `
      <section><h3>١) الأساسيات</h3>
        <label>اسم المشروع<input data-f="title" value="${esc(doc.title)}" maxlength="90" placeholder="مثلاً: مراقبة المحلول الوريدي عن بُعد" /></label>
        <div class="two"><label>الرمز (إنجليزي صغير، بالرابط)<input data-f="id" dir="ltr" value="${esc(doc.id)}" ${isNew ? '' : 'disabled'} maxlength="40" placeholder="iv-monitor" /></label>
        <div class="tagsel"><span>المجال (اختاروا واحد أو أكثر، الأول هو الأساسي)</span>${CATS.map((c) => `<label class="chk"><input type="checkbox" data-tag="${c}" ${(doc.tags ?? [doc.cat]).includes(c) ? 'checked' : ''} /> ${c}</label>`).join('')}</div></div>
        <div class="two"><label>مستوى الصعوبة<select data-f="level">${['سهل', 'متوسط', 'متقدم'].map((l) => `<option ${l === doc.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="chk"><input type="checkbox" data-f="exclusive" ${doc.exclusive ? 'checked' : ''} /> فكرة حصرية (تخفي القطع وتعرض نطاق التكلفة)</label></div>
        ${doc.exclusive ? `<label>نطاق التكلفة<input data-f="range" value="${esc(doc.range)}" placeholder="٣٠ إلى ٤٥ د.أ" /></label>` : ''}
      </section>
      <section><h3>٢) الوصف (يظهر بالبطاقة وأعلى الصفحة)</h3><textarea data-f="desc" rows="3" maxlength="400" placeholder="جملتين أو تلاتة تجذب الطالب: شو بيعمل المشروع ولمين">${esc(doc.desc)}</textarea></section>
      <section><h3>٣) المشكلة — ليش المشروع مهم</h3><textarea data-f="problem" rows="4">${esc(doc.problem)}</textarea></section>
      <section><h3>٤) كيف يشتغل — خطوات مرتبة</h3>
        ${doc.steps.map((s, i) => `<div class="row3"><input data-f="steps.${i}.0" value="${esc(s[0])}" placeholder="١ · الوزن" /><input data-f="steps.${i}.1" value="${esc(s[1])}" placeholder="شو بيصير بهالخطوة" /><button type="button" class="x" data-rm="steps:${i}">×</button></div>`).join('')}
        <button type="button" class="c-btn ghost sm" data-add="step">＋ خطوة</button></section>
      <section><h3>٥) المميزات (سطر لكل ميزة)</h3><textarea data-lines="feats" rows="4">${esc(doc.feats.join('\n'))}</textarea></section>
      <section><h3>٦) التحديات المتوقعة (سطر لكل تحدٍ)</h3><textarea data-lines="chals" rows="4">${esc(doc.chals.join('\n'))}</textarea></section>
      <section><h3>٧) القطع — أسماء وكميات وبدائل لكل قطعة</h3>
        <div class="bulk"><textarea id="bulk" rows="3" placeholder="الصق أسماء القطع، سطر لكل قطعة أو مفصولة بفاصلة. مثال: ESP32، حساس رطوبة تربة، مرحّل، مضخة مياه × 2"></textarea>
          <div class="ed-acts"><button type="button" class="c-btn sm" data-bulk>أنشئ القطع والمجسم من الأسماء</button>
          <label class="c-btn ghost sm">${svg('camera', 14)} من صورة<input type="file" id="bulk-img" accept="image/jpeg,image/png,image/webp" hidden /></label></div>
          <p class="c-note" id="bulk-msg"></p></div>
        ${doc.parts.map((p, i) => partHtml(p, i)).join('')}
        <button type="button" class="c-btn ghost sm" data-add="part">＋ قطعة</button>
        <p class="tot">التكلفة التقريبية (الخيارات الأساسية): <b>${costOf(doc)} د.أ</b></p></section>
      <section><h3>٨) إضافات اختيارية</h3>
        ${doc.extras.map((e, i) => `<div class="row4"><input data-f="extras.${i}.nm" value="${esc(e.nm)}" placeholder="الاسم" /><input data-f="extras.${i}.d" value="${esc(e.d)}" placeholder="وصف قصير" /><input data-f="extras.${i}.p" data-num value="${e.p}" type="number" step="0.1" /><button type="button" class="x" data-rm="extras:${i}">×</button></div>`).join('')}
        <button type="button" class="c-btn ghost sm" data-add="extra">＋ إضافة</button></section>
      <p class="c-err" id="ed-err"></p>
      <div class="ed-acts">
        <button type="button" class="c-btn ghost" data-save="draft">حفظ كمسودة</button>
        <button type="button" class="c-btn" data-save="published">نشر</button>
        ${!isNew ? `<button type="button" class="c-btn ghost" data-save="hidden">إخفاء من الموقع</button><button type="button" class="c-btn danger" data-del>حذف</button>` : ''}
        <a class="c-btn ghost" data-preview target="_blank" href="/p?id=${esc(doc.id)}">معاينة الصفحة</a>
      </div>`;
    form.scrollTop = y;
  }
  const partHtml = (p: PartDoc, i: number) => `<div class="part">
    <div class="row5"><input data-f="parts.${i}.nm" value="${esc(p.nm)}" placeholder="اسم القطعة (لوحة التحكم)" /><select data-f="parts.${i}.kind">${kindOpts(p.kind)}</select>
      <input data-f="parts.${i}.qty" data-num type="number" min="1" max="9" value="${p.qty}" /><label class="chk"><input type="checkbox" data-f="parts.${i}.req" ${p.req ? 'checked' : ''} /> أساسية</label><button type="button" class="x" data-rm="parts:${i}">×</button></div>
    ${p.opts.map((o, j) => `<div class="row6"><input type="radio" name="def${i}" data-def="${i}:${j}" ${o.def ? 'checked' : ''} title="الخيار الأساسي" /><input data-f="parts.${i}.opts.${j}.nm" value="${esc(o.nm)}" placeholder="اسم الخيار/البديل" /><input data-f="parts.${i}.opts.${j}.d" value="${esc(o.d)}" placeholder="ميزته: أرخص/أدق/أغلى…" /><input data-f="parts.${i}.opts.${j}.p" data-num type="number" step="0.1" value="${o.p}" /><button type="button" class="x" data-rm="opt:${i}:${j}">×</button></div>`).join('')}
    <button type="button" class="c-btn ghost sm" data-add="opt:${i}">＋ بديل</button></div>`;

  /* ---------- لوحة المجسم ---------- */
  function paintModel() {
    const m = doc.model;
    side.innerHTML = `<h3>المجسم</h3><p class="c-note">يتولّد من القطع تلقائياً على لوحة تجارب مع أسلاك. عدّل المواضع والألوان يدوياً لو بدك.</p>
      <div class="ed-acts"><button type="button" class="c-btn sm" data-regen>ولّد من القطع</button><button type="button" class="c-btn ghost sm" data-additem>＋ قطعة بالمجسم</button></div>
      ${(m?.items ?? []).map((it, i) => `<div class="mrow"><select data-m="${i}.kind">${kindOpts(it.kind)}</select>
        <label>x<input data-m="${i}.x" type="number" step="0.5" value="${it.x}" /></label><label>z<input data-m="${i}.z" type="number" step="0.5" value="${it.z}" /></label>
        <select data-m="${i}.rot">${[0, 90, 180, 270].map((r) => `<option ${r === it.rot ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <input data-m="${i}.color" type="color" value="${it.color || DEFAULT_COLOR[it.kind]}" /><button type="button" class="x" data-mrm="${i}">×</button></div>`).join('') || '<p class="c-note">أضف قطعاً بالقسم ٧ ثم اضغط «ولّد من القطع».</p>'}`;
  }

  /* ---------- إنشاء القطع من أسماء أو صورة ---------- */
  const mkPart = (name: string, qty: number, kind: Kind): PartDoc => ({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nm: name, kind, req: true, qty, opts: [{ k: 'a', nm: name, d: '', p: 0, def: true }] });
  function addParts(list: { name: string; qty: number; kind?: Kind }[]) {
    let n = 0;
    for (const x of list) {
      if (doc.parts.some((p) => p.nm.trim().toLowerCase() === x.name.trim().toLowerCase())) continue;
      const p = mkPart(x.name, x.qty, x.kind ?? guessKind(x.name)); if (x.kind) kindLocked.add(p.id); doc.parts.push(p); n++;
    }
    regen(); paintForm(); paintModel(); refreshModel(); return n;
  }
  const parseNames = (txt: string) => txt.split(/[\n,،؛;]+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)(?:\s+[x*]\s*|\s*×\s*)(\d+)$/i) || l.match(/^(\d+)(?:\s+[x*]\s+|\s*×\s*)(.+)$/i);
    if (!m) return { name: l, qty: 1 };
    const num = /^\d+$/.test(m[1]) ? +m[1] : +m[2], name = (/^\d+$/.test(m[1]) ? m[2] : m[1]).trim();
    return { name, qty: Math.max(1, Math.min(9, num)) };
  });
  const say = (t: string) => { const m = form.querySelector<HTMLElement>('#bulk-msg'); if (m) m.textContent = t; };
  async function fromImage(input: HTMLInputElement) {
    const f = input.files?.[0]; if (!f) return; input.value = ''; say('جارٍ تحليل الصورة…');
    try { const img = await compress(f, 1280, 0.8); const found = await store.analyzeImage(img); const n = addParts(found.map((p) => ({ name: p.name, qty: p.qty, kind: p.kind }))); form.querySelector<HTMLElement>('#bulk-msg')!.textContent = `تعرّفنا على ${found.length} قطعة، وأضفنا ${n} جديدة. راجعوا الأسماء والأسعار.`; }
    catch (x: any) { say(x.message); }
  }

  /* ---------- أحداث ---------- */
  const val = (t: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => (t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t.hasAttribute('data-num') ? Number(t.value) || 0 : t.value);
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement; if (t.dataset.lines) { (doc as any)[t.dataset.lines] = t.value.split('\n').map((x) => x.trim()).filter(Boolean); return; }
    if (t.dataset.f) { setPath(doc, t.dataset.f, val(t));
      const nm = t.dataset.f.match(/^parts\.(\d+)\.nm$/);
      if (nm) { const p = doc.parts[+nm[1]]; if (!kindLocked.has(p.id)) { p.kind = guessKind(p.nm); const sel = form.querySelector<HTMLSelectElement>(`[data-f="parts.${nm[1]}.kind"]`); if (sel) sel.value = p.kind; } schedule(); } if (t.dataset.f.endsWith('.p') || t.dataset.f.endsWith('.qty')) form.querySelector('.tot b')!.textContent = costOf(doc) + ' د.أ'; }
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'bulk-img') { void fromImage(t); return; }
    if (t.dataset.tag) { const set = new Set(doc.tags?.length ? doc.tags : [doc.cat]); t.checked ? set.add(t.dataset.tag) : set.delete(t.dataset.tag); doc.tags = [...set]; doc.cat = doc.tags[0] ?? 'أخرى'; return; }
    if (t.dataset.def) { const [i, j] = t.dataset.def.split(':').map(Number); doc.parts[i].opts.forEach((o, k) => (o.def = k === j)); return; }
    if (t.dataset.f === 'exclusive') { doc.exclusive = t.checked; paintForm(); }
    if (t.dataset.f === 'id') doc.id = t.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (t.dataset.f?.endsWith('.kind')) { const pi = Number(t.dataset.f.split('.')[1]); kindLocked.add(doc.parts[pi].id); schedule(); }
    const link = form.querySelector<HTMLAnchorElement>('[data-preview]'); if (link) link.href = `/p?id=${encodeURIComponent(doc.id)}`;
  });
  side.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement; const k = t.dataset.m; if (!k || !doc.model) return; manual = true;
    const [i, f] = k.split('.'); const it = doc.model.items[+i] as any; it[f] = f === 'x' || f === 'z' || f === 'rot' ? Number(t.value) : t.value;
    if (f === 'kind') doc.model.wires = wiresFor(doc.model.items); refreshModel();
  });
  side.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-regen],[data-additem],[data-mrm]'); if (!t) return;
    if (t.hasAttribute('data-regen')) { if (doc.model && !confirm('بيرجع يوزّع القطع تلقائياً وبيمسح تعديلاتك اليدوية. متأكد؟')) return; regen(); }
    if (t.hasAttribute('data-additem')) { manual = true; doc.model ??= { items: [], wires: [] }; doc.model.items.push({ kind: 'sensor', x: 0, z: 6, rot: 0 }); doc.model.wires = wiresFor(doc.model.items); }
    if (t.dataset.mrm && doc.model) { manual = true; doc.model.items.splice(+t.dataset.mrm, 1); doc.model.wires = wiresFor(doc.model.items); if (!doc.model.items.length) doc.model = null; }
    paintModel(); refreshModel();
  });
  form.addEventListener('click', async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-add],[data-rm],[data-save],[data-del],[data-bulk]'); if (!t) return;
    const err = form.querySelector<HTMLElement>('#ed-err')!;
    if (t.hasAttribute('data-bulk')) { const list = parseNames(form.querySelector<HTMLTextAreaElement>('#bulk')!.value); if (!list.length) { say('اكتب أسماء القطع أولاً'); return; } const n = addParts(list); form.querySelector<HTMLElement>('#bulk-msg')!.textContent = `أضفنا ${n} قطعة وولّدنا المجسم. حطوا الأسعار والبدائل تحت.`; return; }
    if (t.dataset.add) {
      const [w, i] = t.dataset.add.split(':');
      if (w === 'step') doc.steps.push([`${doc.steps.length + 1} · `, '']);
      if (w === 'part') doc.parts.push({ id: 'p' + Date.now().toString(36), nm: '', kind: 'sensor', req: true, qty: 1, opts: [{ k: 'a', nm: '', d: '', p: 0, def: true }] });
      if (w === 'extra') doc.extras.push({ k: 'x' + Date.now().toString(36), nm: '', d: '', p: 0 });
      if (w === 'opt') doc.parts[+i].opts.push({ k: 'o' + Date.now().toString(36), nm: '', d: '', p: 0 });
      paintForm(); schedule(); return;
    }
    if (t.dataset.rm) {
      const p = t.dataset.rm.split(':');
      if (p[0] === 'steps') doc.steps.splice(+p[1], 1); if (p[0] === 'extras') doc.extras.splice(+p[1], 1); if (p[0] === 'parts') doc.parts.splice(+p[1], 1);
      if (p[0] === 'opt') { doc.parts[+p[1]].opts.splice(+p[2], 1); }
      paintForm(); schedule(); return;
    }
    if (t.dataset.save) {
      err.textContent = ''; doc.status = t.dataset.save as any;
      doc.parts.forEach((p) => p.opts.forEach((o, i) => { if (!o.k) o.k = 'o' + i; }));
      try { await store.save(doc); ov.remove(); document.body.style.overflow = ''; prev.stop(); onDone(); } catch (x: any) { err.textContent = x.message; }
    }
    if (t.hasAttribute('data-del') && confirm('تحذف المشروع من قاعدة البيانات؟ (المشاريع الثابتة بالملفات بتضل، تقدر بس تخفيها)')) {
      try { await store.remove(doc.id); ov.remove(); document.body.style.overflow = ''; prev.stop(); onDone(); } catch (x: any) { err.textContent = x.message; }
    }
  });
  ov.querySelector('[data-close]')!.addEventListener('click', () => { ov.remove(); document.body.style.overflow = ''; prev.stop(); });

  paintForm(); paintModel(); refreshModel();
}
