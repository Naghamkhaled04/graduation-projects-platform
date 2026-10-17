/** يرسم صورة مشاركة (بورتريه إنستغرام 1080×1350) لمشروع، ثم يشاركها أو ينزّلها */
export async function shareCard(o: { title: string; level: string; domain: string; url: string }) {
  try { await document.fonts.load('700 60px "IBM Plex Sans Arabic"', 'مشروع'); } catch { /* اختياري */ }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!; g.direction = 'rtl'; g.textAlign = 'right';
  g.fillStyle = '#f3f6f8'; g.fillRect(0, 0, W, H);
  const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  rr(60, 60, W - 120, H - 120, 56); g.fillStyle = '#0e3a63'; g.fill();
  const glow = g.createRadialGradient(W - 200, 260, 20, W - 200, 260, 460); glow.addColorStop(0, 'rgba(61, 183, 166,.55)'); glow.addColorStop(1, 'rgba(61, 183, 166,0)');
  rr(60, 60, W - 120, H - 120, 56); g.fillStyle = glow; g.fill();
  const font = (w: number, s: number) => `${w} ${s}px "IBM Plex Sans Arabic", Arial`;
  // شارات المجال والمستوى
  let x = W - 130;
  for (const t of [o.domain, o.level]) {
    g.font = font(500, 34); const tw = g.measureText(t).width + 56;
    rr(x - tw, 130, tw, 70, 35); g.fillStyle = 'rgba(233, 243, 248,.14)'; g.fill(); g.fillStyle = '#f3f6f8'; g.textAlign = 'center'; g.fillText(t, x - tw / 2, 178); g.textAlign = 'right'; x -= tw + 16;
  }
  // العنوان بأسطر
  g.fillStyle = '#f3f6f8'; g.font = font(700, 96);
  const words = o.title.split(' '), lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > W - 260 && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.slice(0, 5).forEach((l, i) => g.fillText(l, W - 130, 400 + i * 128));
  // خط برتقالي وتذييل
  rr(W - 130 - 180, H - 380, 180, 10, 5); g.fillStyle = '#1a9e8f'; g.fill();
  g.fillStyle = '#f3f6f8'; g.font = font(500, 44); g.fillText('فكرة مشروع تخرج جاهزة', W - 130, H - 300);
  g.font = font(400, 36); g.globalAlpha = 0.7; g.fillText('المكونات والتكلفة وسلة القطع', W - 130, H - 240); g.globalAlpha = 1;
  g.font = font(700, 54); g.fillStyle = '#1a9e8f'; g.fillText('مشاريع', W - 130, H - 150);
  g.font = font(400, 30); g.fillStyle = '#f3f6f8'; g.globalAlpha = 0.6; g.textAlign = 'left'; g.fillText(o.url.replace(/^https?:\/\//, ''), 130, H - 150); g.globalAlpha = 1;

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
  const file = new File([blob], 'مشروع.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: o.title, text: o.title, url: o.url }); return; } catch { /* ألغى المستخدم */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'مشروع.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
