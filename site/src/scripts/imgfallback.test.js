import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onImgError, FALLBACK } from './imgfallback.js';

const img = (src) => {
  const cls = new Set();
  return { tagName: 'IMG', src, srcset: 'x 1x', classList: { add: (c) => cls.add(c), contains: (c) => cls.has(c) }, removeAttribute(a) { this[a] = ''; } };
};

test('a broken image gets the placeholder and a class to style it', () => {
  const el = img('https://novatera.space/a.webp');
  onImgError(el);
  assert.equal(el.src, FALLBACK);
  assert.equal(el.srcset, '');
  assert.ok(el.classList.contains('img-off'));
});
test('if the placeholder itself fails, it does not loop', () => {
  const el = img('https://novatera.space/a.webp');
  onImgError(el); el.src = FALLBACK + '#broken';
  onImgError(el);
  assert.equal(el.src, FALLBACK + '#broken', 'second error leaves it alone');
});
test('ignores anything that is not an image', () => {
  const s = { tagName: 'SCRIPT', src: '/x.js' };
  onImgError(s);
  assert.equal(s.src, '/x.js');
});
