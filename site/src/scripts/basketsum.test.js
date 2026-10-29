import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summary, partsWord, fabText } from './basketsum.js';

const ar = (n) => String(n);

test('counts quantities and sums prices × quantity', () => {
  assert.deepEqual(summary({}), { count: 0, total: 0 });
  assert.deepEqual(summary({ a: { p: 2.5, n: 2 }, b: { p: 0.1, n: 3 } }), { count: 5, total: 5.3 });
});
test('total has no float noise', () => {
  assert.equal(summary({ a: { p: 0.1, n: 1 }, b: { p: 0.2, n: 1 } }).total, 0.3);
});
test('Arabic plural for parts', () => {
  assert.equal(partsWord(1), 'قطعة');
  assert.equal(partsWord(2), 'قطعتين');
  assert.equal(partsWord(3), 'قطع');
  assert.equal(partsWord(10), 'قطع');
  assert.equal(partsWord(11), 'قطعة');
});
test('basket button text', () => {
  assert.equal(fabText({ count: 3, total: 7 }, ar), '3 قطع · 7 د.أ');
  assert.equal(fabText({ count: 2, total: 1.5 }, ar), 'قطعتين · 1.5 د.أ', 'dual drops the number');
});
