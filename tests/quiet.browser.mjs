import assert from 'node:assert/strict';
import { createAppServer } from '../server.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const server = createAppServer({
  tutor: {
    models: async () => [{ name: 'fixture:local' }],
    ask: async () => ({
      answer: 'A fixture reply about the inner derivative.',
      model: 'fixture:local',
      local: true,
      verified: false,
    }),
  },
});
await new Promise((r, j) => {
  server.on('error', j);
  server.listen(0, '127.0.0.1', r);
});
let b;
try {
  b = await chromium.launch({
    headless: true,
    ...(process.env.SYLLUNE_CHROME
      ? { executablePath: process.env.SYLLUNE_CHROME }
      : {}),
  });
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**/api/status', (r) =>
    r.fulfill({ json: { recognition: true, local: true } }),
  );
  await p.route('**/api/recognize', (r) =>
    r.fulfill({
      json: {
        lines: [
          {
            text: '2x+6=14',
            box: { x: 0.1, y: 0.1, width: 0.4, height: 0.05 },
          },
          { text: '2x=20', box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 } },
          { text: 'x=10', box: { x: 0.1, y: 0.3, width: 0.2, height: 0.05 } },
        ],
      },
    }),
  );
  await p.goto(`http://127.0.0.1:${server.address().port}`);
  await p.locator('#quiet-toggle').uncheck();
  await p.locator('#example').click();
  const original = await p.locator('#transcript').inputValue();
  await p.locator('#quiet-toggle').check();
  await p.waitForFunction(
    () =>
      document
        .querySelector('#quiet-suggestion')
        .textContent.includes('Possible issue'),
    null,
    { timeout: 10000 },
  );
  assert.equal(await p.locator('#transcript').inputValue(), original);
  assert.equal(await p.locator('.ink-mark').count(), 1);
  await p.locator('.drawing-options > summary').click();
  for (const paper of ['dot', 'line', 'blank']) {
    await p.locator('#paper-type').selectOption(paper);
    const geometry = await p.evaluate(() => {
      const ink = document.querySelector('#ink').getBoundingClientRect(),
        mark = document.querySelector('.ink-mark').getBoundingClientRect();
      return { actual: mark.top - ink.top, expected: ink.height * 0.2 };
    });
    assert.ok(
      Math.abs(geometry.actual - geometry.expected) < 1,
      `Ink region must follow canvas, ${paper}: ${JSON.stringify(geometry)}`,
    );
  }
  if (await p.locator('.drawing-options').getAttribute('open') !== null) await p.keyboard.press('Escape');
  await p.locator('#zoom-out').click();
  await p.locator('#zoom-out').click();
  const zoomed = await p.evaluate(() => {
    const ink = document.querySelector('#ink').getBoundingClientRect(),
      mark = document.querySelector('.ink-mark').getBoundingClientRect();
    return { actual: mark.top - ink.top, expected: ink.height * 0.2 };
  });
  assert.ok(
    Math.abs(zoomed.actual - zoomed.expected) < 1,
    'Ink region must remain aligned at 50% zoom',
  );
  await p.locator('#zoom-in').click();
  await p.locator('#zoom-in').click();

  await p.locator('#review-reading').click();
  await p.locator('#recognized-preview').fill('2x+6=14\n2x=8\nx=4');
  p.once('dialog', (d) => d.accept());
  await p.locator('#apply-reading').click();
  assert.equal(
    await p.locator('#transcript').inputValue(),
    '2x+6=14\n2x=8\nx=4',
  );
  assert.equal(await p.locator('.step-result.correct').count(), 2);
  await p.locator('#tutor-open').click();
  await p.waitForFunction(() => !document.querySelector('#tutor-ask').disabled);
  await p
    .locator('#tutor-question')
    .fill('Why does the chain rule need the inner derivative?');
  await p.locator('#tutor-ask').click();
  await p.waitForFunction(
    () => document.querySelectorAll('.tutor-message').length === 2,
  );
  assert.match(
    await p.locator('#tutor-messages').innerText(),
    /UNVERIFIED GUIDANCE/,
  );
  await p.getByRole('button', { name: 'Close local tutor' }).click();
  await p.reload();
  await p.locator('#tutor-open').click();
  assert.equal(await p.locator('.tutor-message').count(), 2);
  await p.locator('#tutor-question').fill('A question to keep across reloads.');
  await p.getByRole('button', { name: 'Close local tutor' }).click();
  await p.reload();
  await p.locator('#tutor-open').click();
  assert.equal(
    await p.locator('#tutor-question').inputValue(),
    'A question to keep across reloads.',
  );
  await p.locator('#tutor-question').fill('');

  await p.getByRole('button', { name: 'Close local tutor' }).click();
  // Finishing manual OCR cannot reset a tutor opened while the reading runs.
  await p.locator('#quiet-toggle').uncheck();
  await p.route('**/api/recognize', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await r.fulfill({
      json: { lines: [{ text: '2x+6=14' }, { text: '2x=8' }, { text: 'x=4' }] },
    });
  });
  p.once('dialog', (d) => d.accept());
  await p.locator('#transcript-editor > summary').click();
  await p.locator('#recognize').click();
  await p.locator('#tutor-open').click();
  await p.waitForFunction(() => !document.querySelector('#tutor-ask').disabled);
  await p.waitForFunction(() => !document.querySelector('#recognize').disabled);
  await p
    .locator('#tutor-question')
    .fill('Does my earlier question still work?');
  await p.locator('#tutor-ask').click();
  await p.waitForFunction(
    () => document.querySelectorAll('.tutor-message').length === 4,
    null,
    { timeout: 3000 },
  );
  await p.getByRole('button', { name: 'Close local tutor' }).click();
  // Recognition finishing after navigation cannot put a suggestion on a different page.
  await p.route('**/api/recognize', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      await r.fulfill({
        json: { lines: [{ text: 'x=999' }, { text: 'x=998' }] },
      });
    } catch {}
  });
  await p.locator('#quiet-toggle').uncheck();
  await p.locator('#quiet-toggle').check();
  await p.waitForFunction(
    () =>
      document.querySelector('#quiet-status').textContent ===
      'Reading ink locally…',
    null,
    { timeout: 10000 },
  );
  await p.locator('#new-page').click();
  await p.waitForTimeout(300);
  assert.equal(await p.locator('#quiet-reading').isVisible(), false);
  assert.equal(await p.locator('#transcript').inputValue(), '');
  assert.deepEqual(errors, []);
  console.log(
    'PASS: uncertain quiet ink flag and region, unchanged transcript, explicit reviewed adoption, stale-page cancellation, local tutor UI labels and conversation persistence. Fixture transport checks wiring; native recognition/model quality are verified separately.',
  );
} finally {
  await b?.close();
  await new Promise((r) => server.close(r));
}
