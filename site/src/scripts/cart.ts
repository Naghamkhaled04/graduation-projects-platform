  interface Opt { k: string; nm: string; d: string; p: number; def?: boolean; url?: string; live?: number; img?: string }
  interface Part { id: string; nm: string; req: boolean; qty: number; opts: Opt[] }
  interface Extra { k: string; nm: string; d: string; p: number }

  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const AR = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
  const CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function mountCart(root: HTMLElement) {
    const { parts, extras, project, wa } = JSON.parse(root.dataset.cart!) as { parts: Part[]; extras: Extra[]; project: string; wa: string };
    const state: Record<string, { on: boolean; qty: number; pick: string }> = {};
    parts.forEach((p) => (state[p.id] = { on: true, qty: p.qty, pick: (p.opts.find((o) => o.def) ?? p.opts[0]).k }));
    const extraOn: Record<string, boolean> = {};
    extras.forEach((e) => (extraOn[e.k] = false));
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const items = q('.items'), extrasEl = root.querySelector<HTMLElement>('.extras');

    function render() {
      items.innerHTML = parts.map((p) => {
        const st = state[p.id], sel = p.opts.find((o) => o.k === st.pick)!, multi = p.opts.length > 1;
        return `<div class="item ${st.on ? '' : 'off'}">
          <div class="row1">
            <button type="button" class="chk ${st.on ? 'on' : ''}" data-tog="${p.id}" aria-label="تفعيل القطعة">${CHECK}</button>
            ${sel.img ? `<a class="pimg" href="${esc(sel.url || '#')}"><img src="${esc(sel.img)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/img/part.svg'" /></a>` : ''}
            <div class="mid">
              <div class="nm">${sel.url ? `<a class="plink" href="${esc(sel.url)}">${esc(sel.nm)}</a>` : esc(sel.nm)}${p.req ? '<span class="req">أساسي</span>' : ''}</div>
              <div class="dsc">${esc(sel.d)}</div>
              ${st.on ? `<div class="qty"><button type="button" data-q="${p.id}:-1">−</button><span>${AR(st.qty)}</span><button type="button" data-q="${p.id}:1">+</button></div>` : ''}
            </div>
            <div class="pr">${AR((sel.live ?? sel.p) * st.qty)} د.أ<small>${AR(sel.live ?? sel.p)} للقطعة</small></div>
          </div>
          ${st.on && multi ? `<div class="alts"><div class="altlbl">بدائل متاحة</div>${p.opts.map((o) => `
            <button type="button" class="alt ${o.k === st.pick ? 'on' : ''}" data-pick="${p.id}:${o.k}">
              <span class="rad"></span><span class="an">${esc(o.nm)}<span class="ad">${esc(o.d)}</span></span><span class="ap">${AR(o.p)} د.أ</span>
            </button>`).join('')}</div>` : ''}
        </div>`;
      }).join('');
      if (extrasEl) extrasEl.innerHTML = extras.map((e) => `
        <button type="button" class="addrow ${extraOn[e.k] ? 'on' : ''}" data-ex="${e.k}">
          <span class="rad sq"></span><span class="an">${esc(e.nm)}<span class="ad">${esc(e.d)}</span></span><span class="ap">+${AR(e.p)} د.أ</span>
        </button>`).join('');

      let total = 0, count = 0, active = 0;
      parts.forEach((p) => { const st = state[p.id]; if (!st.on) return; total += p.opts.find((o) => o.k === st.pick)!.p * st.qty; count += st.qty; active++; });
      extras.forEach((e) => { if (extraOn[e.k]) { total += e.p; count++; } });
      q('.tq').textContent = `${AR(count)} قطعة`; q('.tp').textContent = `${AR(Math.round(total * 100) / 100)} د.أ`;
      q('.cnt').textContent = `${AR(active)} من ${AR(parts.length)} مفعّلة`;
    }

    root.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-tog],[data-q],[data-pick],[data-ex]');
      if (!t) return;
      if (t.dataset.tog) {
        const p = parts.find((x) => x.id === t.dataset.tog)!;
        if (p.req && state[p.id].on && !confirm('هاي قطعة أساسية للمشروع. متأكد بدك تشيلها؟')) return;
        state[p.id].on = !state[p.id].on;
      } else if (t.dataset.q) {
        const [id, d] = t.dataset.q.split(':'); state[id].qty = Math.max(1, Math.min(9, state[id].qty + Number(d)));
      } else if (t.dataset.pick) {
        const [id, k] = t.dataset.pick.split(':'); state[id].pick = k;
      } else if (t.dataset.ex) extraOn[t.dataset.ex] = !extraOn[t.dataset.ex];
      render();
    });

    q('.order').addEventListener('click', () => {
      const lines: string[] = []; let total = 0;
      parts.forEach((p) => { const st = state[p.id]; if (!st.on) return; const s = p.opts.find((o) => o.k === st.pick)!; lines.push(`• ${s.nm} × ${st.qty} — ${s.p * st.qty} د.أ`); total += s.p * st.qty; });
      const ex = extras.filter((e) => extraOn[e.k]);
      if (ex.length) { lines.push('', 'إضافات:'); ex.forEach((e) => { lines.push(`• ${e.nm} — ${e.p} د.أ`); total += e.p; }); }
      const msg = `مرحبا \nبدي أطلب سلة مشروع:\n*${project}*\n\n${lines.join('\n')}\n\nالمجموع: *${Math.round(total * 100) / 100} د.أ*\n\nالاسم:\nالجامعة:\nالعنوان:`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    });
    q('.sendlist').addEventListener('click', () => {
      const lines = parts.filter((p) => state[p.id].on).map((p) => { const st = state[p.id], sel = p.opts.find((o) => o.k === st.pick)!; return `• ${sel.nm} × ${st.qty}`; });
      const msg = `مرحباً،\nابعتولي قائمة قطع مشروع:\n*${project}*\n\n${lines.join('\n')}\n\nمع الأسعار والبدائل المتوفرة، لو سمحتم.`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    });
    render();
  }
