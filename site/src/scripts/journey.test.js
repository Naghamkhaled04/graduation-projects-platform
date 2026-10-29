import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darkness, themeVars } from './journey.js';

test('page starts light, is fully dark between idea and why, ends light', () => {
  assert.equal(darkness(0, 0), 0);      // البداية
  assert.equal(darkness(1, 0), 1);      // مين نحن
  assert.equal(darkness(1, 1), 0);      // ليش نحنا والدخول
  const mid = darkness(0.46, 0);
  assert.ok(mid > 0 && mid < 1, 'fades in the gap between فكرتنا and هدفنا');
});
test('colors only change in the gaps, not while a text block is being read', () => {
  assert.equal(darkness(0.2, 0), 0, 'فكرتنا is read on light');
  assert.equal(darkness(0.66, 0), 1, 'هدفنا is read on dark');
  assert.equal(darkness(1, 0.2), 0, 'ليش نحنا heading is read on light');
});
test('theme vars interpolate between the light and dark palettes', () => {
  assert.equal(themeVars(0)['--in-bg'], 'rgb(233 243 248)');
  assert.equal(themeVars(1)['--in-bg'], 'rgb(7 26 51)');
  assert.equal(themeVars(0)['--in-fg'], 'rgb(14 58 99)');
  assert.equal(themeVars(1)['--in-fg'], 'rgb(233 243 248)');
  assert.deepEqual(Object.keys(themeVars(0.5)).sort(), ['--in-bg', '--in-dot', '--in-fg', '--in-fg2', '--in-muted', '--in-neon', '--in-panel']);
});

const lum = (s) => {
  const [r, g, b] = s.match(/\d+/g).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('headings stay readable (≥ 3:1) at every point of the transition', () => {
  for (let d = 0; d <= 1.0001; d += 0.05) {
    const v = themeVars(d);
    const c = contrast(v['--in-fg'], v['--in-bg']);
    assert.ok(c >= 3, `d=${d.toFixed(2)} contrast ${c.toFixed(2)}`);
  }
});
