import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeHref } from './navmatch.js';

const NAV = [
  { href: '/home' },
  { href: '/projects', match: ['/projects', '/p'] },
  { href: '/store' },
  { href: '/communities', match: ['/communities', '/c'] },
  { href: '/store/services' },
];

test('exact page is active', () => {
  assert.equal(activeHref('/home', NAV), '/home');
  assert.equal(activeHref('/store', NAV), '/store');
});
test('sub-pages light up their section', () => {
  assert.equal(activeHref('/store/sensors', NAV), '/store');
  assert.equal(activeHref('/projects/air', NAV), '/projects');
  assert.equal(activeHref('/c/ahu', NAV), '/communities');
  assert.equal(activeHref('/p', NAV), '/projects');
});
test('the most specific item wins (consultation inside the store)', () => {
  assert.equal(activeHref('/store/services', NAV), '/store/services');
});
test('trailing slash and no match', () => {
  assert.equal(activeHref('/store/', NAV), '/store');
  assert.equal(activeHref('/settings', NAV), null);
  assert.equal(activeHref('/storefront', NAV), null, 'prefix must end at a path boundary');
});
