import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { inlineGuard } from './guard-inline.js';

const code = inlineGuard(readFileSync(new URL('./guard.js', import.meta.url), 'utf8'));

// بيشغّل نفس السكربت اللي بينحقن بالـ<head> بمتصفح وهمي
function run(storage) {
  const calls = [];
  const html = { style: {} };
  const ctx = { URL, location: { pathname: '/store', search: '?q=1', replace: (u) => calls.push(u) }, document: { documentElement: html } };
  Object.defineProperty(ctx, 'localStorage', { get: storage });
  vm.runInNewContext(code, ctx);
  return { calls, hidden: html.style.visibility === 'hidden' };
}
const mem = (obj) => () => ({ getItem: (k) => obj[k] ?? null, key: (i) => Object.keys(obj)[i] ?? null, length: Object.keys(obj).length });

test('signed-out page is hidden and sent to login', () => {
  assert.deepEqual(run(mem({})), { calls: ['/login?next=%2Fstore%3Fq%3D1'], hidden: true });
});
test('signed-in page stays and is not hidden', () => {
  assert.deepEqual(run(mem({ 'community.demo.v1': '{"authed":true}' })), { calls: [], hidden: false });
});
test('blocked storage (getter throws) fails closed', () => {
  const r = run(() => { throw new Error('SecurityError'); });
  assert.deepEqual(r, { calls: ['/login?next=%2Fstore%3Fq%3D1'], hidden: true });
});
