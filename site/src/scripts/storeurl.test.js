import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readState, toQuery } from './storeurl.js';

test('reads search, sort and the projects-only filter from the URL', () => {
  assert.deepEqual(readState('?q=esp32&sort=-p&only=1'), { q: 'esp32', sort: '-p', only: true });
  assert.deepEqual(readState(''), { q: '', sort: '', only: false });
});
test('ignores unknown sort values', () => {
  assert.equal(readState('?sort=hack').sort, '');
});
test('writes only what differs from the defaults', () => {
  assert.equal(toQuery({ q: '', sort: '', only: false }), '');
  assert.equal(toQuery({ q: 'حساس حرارة', sort: 'p', only: false }), '?q=%D8%AD%D8%B3%D8%A7%D8%B3+%D8%AD%D8%B1%D8%A7%D8%B1%D8%A9&sort=p');
  assert.equal(toQuery({ q: ' esp32 ', sort: '', only: true }), '?q=esp32&only=1');
});
test('round-trips', () => {
  const s = { q: 'motor', sort: 'n', only: true };
  assert.deepEqual(readState(toQuery(s)), s);
});
