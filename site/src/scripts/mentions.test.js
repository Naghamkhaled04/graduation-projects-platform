import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaderMentions } from './mentions.js';

test('finds @TFC in any case and @السفير', () => {
  assert.deepEqual(leaderMentions('سؤال لـ @TFC'), { tfc: true, amb: false });
  assert.deepEqual(leaderMentions('@tfc و @السفير شو رأيكم؟'), { tfc: true, amb: true });
});
test('ignores other mentions and look-alikes', () => {
  assert.deepEqual(leaderMentions('@JUST @TFCx بدون منشن'), { tfc: false, amb: false });
  assert.deepEqual(leaderMentions(''), { tfc: false, amb: false });
});
