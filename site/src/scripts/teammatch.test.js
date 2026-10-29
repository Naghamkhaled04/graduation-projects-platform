import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formTeams } from './teammatch.js';

const P = (id, ...roles) => ({ id, roles });

test('splits into full teams and leaves the rest waiting', () => {
  const r = formTeams([P('a', 'hw'), P('b', 'sw'), P('c', 'hw'), P('d', 'sw'), P('e', 'hw')], 2);
  assert.equal(r.teams.length, 2);
  assert.equal(r.left.length, 1);
  assert.equal(new Set([...r.teams.flat(), ...r.left]).size, 5, 'nobody lost or duplicated');
});

test('each team mixes roles instead of stacking the same one', () => {
  const r = formTeams([P('h1', 'hw'), P('h2', 'hw'), P('s1', 'sw'), P('s2', 'sw'), P('d1', 'data'), P('d2', 'data')], 3);
  const roleOf = Object.fromEntries([['h1', 'hw'], ['h2', 'hw'], ['s1', 'sw'], ['s2', 'sw'], ['d1', 'data'], ['d2', 'data']]);
  for (const t of r.teams) assert.equal(new Set(t.map((id) => roleOf[id])).size, 3, `team ${t} covers all three roles`);
});

test('fewer people than one team means everyone waits', () => {
  assert.deepEqual(formTeams([P('a', 'hw')], 3), { teams: [], left: ['a'] });
  assert.deepEqual(formTeams([], 3), { teams: [], left: [] });
});
