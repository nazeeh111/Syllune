import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from '../server.mjs';
import { createLocalTutor } from '../local-tutor.mjs';
// The task guard disables global fetch. Capture transport solely for the owned fixture.
const fixtureFetch = globalThis.fetch;
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
let started,
  thirdStarted,
  release,
  requests = 0,
  disconnected = false,
  reloadDisconnected = false;
const firstStarted = new Promise((resolve) => {
  started = resolve;
});
const held = new Promise((resolve) => {
  release = resolve;
});
const thirdRequest = new Promise((resolve) => {
  thirdStarted = resolve;
});
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(label)), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const json = (res, value) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};
const model = http.createServer(async (req, res) => {
  if (req.url === '/api/tags')
    return json(res, {
      models: [{ name: 'fixture:local', size: 1, details: { format: 'gguf' } }],
    });
  if (req.url === '/api/show')
    return json(res, { details: { format: 'gguf' } });
  if (req.url === '/api/chat') {
    req.resume();
    requests++;
    if (requests === 1 || requests === 3) {
      const number = requests;
      res.on('close', () => {
        if (!res.writableEnded) {
          if (number === 1) disconnected = true;
          else reloadDisconnected = true;
        }
      });
      if (number === 1) started();
      else thirdStarted();
      await held;
      if (res.destroyed) return;
    }
    return json(res, {
      done: true,
      message: { content: 'New synthetic answer.' },
    });
  }
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));
const tutor = createLocalTutor({
  fetchImpl: (url, options) => {
    const target = new URL(url);
    assert.equal(target.origin, 'http://127.0.0.1:11434');
    return fixtureFetch(
      `http://127.0.0.1:${model.address().port}${target.pathname}`,
      options,
    );
  },
});
const server = createAppServer({ tutor });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SYLLUNE_CHROME
      ? { executablePath: process.env.SYLLUNE_CHROME }
      : {}),
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/status', (route) =>
    route.fulfill({ json: { recognition: false, local: true } }),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(
    () => localStorage.getItem('syllune.workspace.v1') !== null,
  );
  const originalId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('syllune.workspace.v1')).activePage,
  );
  await page.locator('#tutor-open').click();
  await page.waitForFunction(
    () => !document.querySelector('#tutor-ask').disabled,
  );
  await page.locator('#tutor-question').fill('Keep this cancelled question');
  await page.locator('#tutor-ask').click();
  await bounded(firstStarted, 'First fixture chat did not start');
  await page.getByRole('button', { name: 'Close local tutor' }).click();
  assert.equal(
    disconnected,
    false,
    'Closing a panel deliberately keeps the reply running',
  );
  await page.locator('#new-page').click();
  await page.locator('#tutor-open').click();
  await page.waitForFunction(
    () => document.querySelector('#tutor-model').options.length > 0,
  );
  assert.match(
    await page.locator('#tutor-status').innerText(),
    /another page.*still running/,
  );
  assert.equal(await page.locator('#tutor-question').isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.SYLLUNE_CANCEL_SCREENSHOT)
    await page.screenshot({ path: process.env.SYLLUNE_CANCEL_SCREENSHOT });
  await page.locator('#tutor-cancel').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    document
      .querySelector('#tutor-status')
      .textContent.includes('Reply cancelled.'),
  );
  const deadline = Date.now() + 2000;
  while (!disconnected && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    disconnected,
    true,
    'Actual companion disconnect must close the held model response',
  );
  assert.equal(await page.locator('#tutor-cancel').isVisible(), false);
  assert.equal(await page.locator('#tutor-question').isDisabled(), false);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    'tutor-question',
    'Keyboard cancellation returns focus to the question',
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('syllune.workspace.v1')),
  );
  const original = saved.notebooks
    .flatMap((book) => book.pages)
    .find((p) => p.id === originalId);
  assert.equal(original.tutorDraft, 'Keep this cancelled question');
  assert.equal(original.tutor.length, 0);
  assert.equal(
    saved.notebooks
      .flatMap((book) => book.pages)
      .find((p) => p.id === saved.activePage).tutorDraft,
    '',
  );
  await page.getByRole('button', { name: 'Close local tutor' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .locator('.page-button')
    .filter({ hasText: 'A fresh start' })
    .click();
  await page.locator('#tutor-open').click();
  await page.waitForFunction(
    () => !document.querySelector('#tutor-ask').disabled,
  );
  assert.equal(
    await page.locator('#tutor-question').inputValue(),
    'Keep this cancelled question',
  );
  await page.locator('#tutor-ask').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.tutor-message').length === 2,
  );
  assert.match(
    await page.locator('#tutor-messages').innerText(),
    /New synthetic answer./,
  );
  assert.equal(requests, 2);
  assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Close local tutor' }).click();
  await page.reload();
  await page.locator('#tutor-open').click();
  assert.equal(await page.locator('.tutor-message').count(), 2);
  await page.waitForFunction(
    () => !document.querySelector('#tutor-ask').disabled,
  );
  await page
    .locator('#tutor-question')
    .fill('Keep this question across reload');
  await page.locator('#tutor-ask').click();
  await bounded(thirdRequest, 'Reload fixture chat did not start');
  await page.reload();
  const reloadDeadline = Date.now() + 2000;
  while (!reloadDisconnected && Date.now() < reloadDeadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    reloadDisconnected,
    true,
    'Page reload must close the pending model response',
  );
  await page.locator('#tutor-open').click();
  await page.waitForFunction(
    () => !document.querySelector('#tutor-ask').disabled,
  );
  assert.equal(
    await page.locator('#tutor-question').inputValue(),
    'Keep this question across reload',
  );
  assert.equal(await page.locator('.tutor-message').count(), 2);
  assert.equal(requests, 3, 'Reload must not automatically retry a question');
  console.log(
    'PASS: real browser Cancel closes companion/model transport, preserves the original page’s draft across navigation, accepts a new answer and retains it after reload; panel close keeps work running; reload cancels the request and keeps its draft without automatic retry.',
  );
} finally {
  release();
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  model.closeAllConnections();
  await new Promise((resolve) => model.close(resolve));
}
