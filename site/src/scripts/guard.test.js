import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSession, loginUrl, safeNext } from './guard.js';

const store = (obj) => {
  const keys = Object.keys(obj);
  return { getItem: (k) => (k in obj ? obj[k] : null), key: (i) => keys[i] ?? null, length: keys.length };
};

test('signed-out when storage is empty', () => {
  assert.equal(hasSession(store({})), false);
});
test('demo session counts when authed is true', () => {
  assert.equal(hasSession(store({ 'community.demo.v1': '{"authed":true}' })), true);
  assert.equal(hasSession(store({ 'community.demo.v1': '{"authed":false}' })), false);
});
test('supabase session counts when token has access_token', () => {
  assert.equal(hasSession(store({ 'sb-abcd-auth-token': '{"access_token":"x"}' })), true);
  assert.equal(hasSession(store({ 'sb-abcd-auth-token': '{}' })), false);
  assert.equal(hasSession(store({ 'other-auth-token': '{"access_token":"x"}' })), false);
});
test('corrupt demo JSON is signed-out, not a crash', () => {
  assert.equal(hasSession(store({ 'community.demo.v1': '{oops' })), false);
});
test('throwing storage is signed-out, not a crash', () => {
  const bad = { getItem() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, get length() { throw new Error('blocked'); } };
  assert.equal(hasSession(bad), false);
});
test('loginUrl keeps path and query', () => {
  assert.equal(loginUrl({ pathname: '/store/all', search: '?q=esp32' }), '/login?next=%2Fstore%2Fall%3Fq%3Desp32');
  assert.equal(loginUrl({ pathname: '/city', search: '' }), '/login?next=%2Fcity');
});
test('safeNext only allows same-site paths', () => {
  assert.equal(safeNext('/store/all?q=esp32'), '/store/all?q=esp32');
  assert.equal(safeNext(null), '/home');
  assert.equal(safeNext(''), '/home');
  assert.equal(safeNext('https://evil.com'), '/home');
  assert.equal(safeNext('//evil.com'), '/home');
  assert.equal(safeNext('/\\evil.com'), '/home');
  assert.equal(safeNext('javascript:alert(1)'), '/home');
  assert.equal(safeNext('/x', '/profile'), '/x');
  assert.equal(safeNext(null, '/profile'), '/profile');
});
