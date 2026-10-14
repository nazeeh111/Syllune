import test from 'node:test';
import assert from 'node:assert/strict';
import { QuietInk, assessRecognition } from '../web/quiet-ink.js';
const tick = () => new Promise((r) => setTimeout(r, 10));
test('recognized math is a suggestion, not an ink verdict', () => {
  const r = assessRecognition({
    lines: [{ text: '2x+6=14' }, { text: '2x=20' }, { text: 'x=10' }],
  });
  assert.equal(r.firstIssue, 1);
  assert.equal(r.verified, false);
  assert.equal(r.check.steps[1].status, 'incorrect');
});
test('quiet scheduler batches strokes and never overwrites a transcript', async () => {
  let reads = 0,
    result;
  const q = new QuietInk({
    delay: 1,
    capture: async () => 'image',
    recognize: async () => {
      reads++;
      return { lines: [{ text: 'x=2' }, { text: '2x=4' }] };
    },
    onResult: (r) => (result = r),
  });
  q.schedule();
  q.schedule();
  await tick();
  assert.equal(reads, 1);
  assert.equal(result.text, 'x=2\n2x=4');
  q.stop();
});
test('stale recognition is discarded after new ink or page switch', async () => {
  let finish,
    applied = false;
  const q = new QuietInk({
    delay: 1,
    capture: async () => 'image',
    recognize: () => new Promise((r) => (finish = r)),
    onResult: () => (applied = true),
  });
  q.schedule();
  await tick();
  q.invalidate();
  finish({ lines: [{ text: 'x=2' }] });
  await tick();
  assert.equal(applied, false);
  q.stop();
});
test('disabled quiet mode and failed recognition remain quiet', async () => {
  let errors = 0,
    reads = 0;
  const q = new QuietInk({
    delay: 1,
    capture: async () => 'image',
    recognize: async () => {
      reads++;
      throw Error('unavailable');
    },
    onError: () => errors++,
  });
  q.stop();
  q.schedule();
  await tick();
  assert.equal(reads, 0);
  q.start();
  q.schedule();
  await tick();
  assert.equal(errors, 1);
  q.stop();
});
test('recognition rejects malformed text and ignores invalid boxes', () => {
  assert.throws(() => assessRecognition({ lines: [{ text: 123 }] }));
  const r = assessRecognition({
    lines: [{ text: 'x=2', box: { x: Infinity, y: 0, width: 1, height: 1 } }],
  });
  assert.equal(r.lines[0].box, null);
});
test('combined reading respects the workspace transcript limit', () =>
  assert.throws(
    () =>
      assessRecognition({
        lines: Array.from({ length: 40 }, () => ({ text: 'x'.repeat(599) })),
      }),
    /20,000/,
  ));
