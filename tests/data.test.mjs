import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, validateBackup, mergeBackup } from '../web/storage.js';
import { makeProblem, gradeAnswer, scheduleReview } from '../web/practice.js';
test('new workspace has no invented activity', () => {
  const s = freshState();
  assert.equal(s.attempts.length, 0);
  assert.equal(s.notebooks[0].pages.length, 1);
});
test('backup round-trip and merge retain both workspaces', () => {
  const a = freshState(),
    b = freshState();
  b.notebooks[0].pages[0].transcript = 'x=5';
  const r = mergeBackup(a, validateBackup(JSON.stringify(b)));
  assert.equal(r.notebooks.length, 2);
  assert.equal(r.notebooks[1].pages[0].transcript, 'x=5');
  assert.equal(a.notebooks.length, 1);
});
test('backup rejects malformed and hostile structures', () => {
  for (const s of [
    '{}',
    'null',
    '{"version":99}',
    JSON.stringify({
      ...freshState(),
      notebooks: [
        {
          id: 'a',
          title: 'a',
          pages: [{ id: 'x', strokes: [{ points: [{ x: Infinity }] }] }],
        },
      ],
    }),
  ])
    assert.throws(() => validateBackup(s));
  const s = freshState();
  s.notebooks.push(structuredClone(s.notebooks[0]));
  assert.throws(() => validateBackup(JSON.stringify(s)));
});
test('practice generators produce checkable correct and incorrect answers', () => {
  for (const topic of [
    'linear',
    'quadratic',
    'expand',
    'fractions',
    'derivative',
  ])
    for (let n = 0; n < 504; n++) {
      const p = makeProblem(topic, n);
      assert.equal(gradeAnswer(p, p.answer).status, 'correct', p.prompt);
      assert.equal(gradeAnswer(p, '123456').status, 'incorrect', p.prompt);
    }
});
test('scheduling moves successful reviews later, failed reviews sooner', () => {
  const now = 100000;
  assert.equal(scheduleReview(0, false, now).due, now + 86400000);
  assert.equal(scheduleReview(1, true, now).due, now + 3 * 86400000);
});
test('stale snapshot cannot replace newer saved bytes', async () => {
  const { saveState } = await import('../web/storage.js');
  let raw = null;
  const storage = { getItem: () => raw, setItem: (key, v) => (raw = v) };
  const a = freshState(),
    b = structuredClone(a);
  saveState(storage, a, null);
  const old = raw;
  a.notebooks[0].pages[0].transcript = 'x=123';
  saveState(storage, a, old);
  assert.throws(() => saveState(storage, b, old), /another tab/i);
  assert.equal(JSON.parse(raw).notebooks[0].pages[0].transcript, 'x=123');
});
