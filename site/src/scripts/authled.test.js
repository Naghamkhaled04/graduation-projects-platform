import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledState } from './authled.js';

const base = { filled: false, busy: false, error: false, ok: false };

test('off until the needed fields are filled', () => {
  assert.equal(ledState(base), 'off');
  assert.equal(ledState({ ...base, filled: true }), 'on');
});
test('blinks while signing in', () => {
  assert.equal(ledState({ ...base, filled: true, busy: true }), 'busy');
});
test('turns red on an error, even if fields are filled', () => {
  assert.equal(ledState({ ...base, filled: true, error: true }), 'err');
  assert.equal(ledState({ ...base, filled: true, busy: true, error: true }), 'err', 'error wins over busy');
});
test('a success message (e.g. reset link sent) lights it up', () => {
  assert.equal(ledState({ ...base, ok: true }), 'on');
});
