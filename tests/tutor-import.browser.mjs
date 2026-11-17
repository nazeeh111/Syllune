import assert from 'node:assert/strict';
import { createAppServer } from '../server.mjs';
import { freshState } from '../web/storage.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let release, started;
const requested = new Promise(resolve => { started = resolve; });
const reply = new Promise(resolve => { release = resolve; });
const server = createAppServer({ tutor: {
  models: async () => [{ name: 'fixture:local' }],
  ask: async () => { started(); await reply; return { answer: 'Retained delayed reply', model: 'fixture:local', local: true, verified: false }; },
} });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.SYLLUNE_CHROME ? { executablePath: process.env.SYLLUNE_CHROME } : {}) });
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}`);
  await p.locator('#quiet-toggle').uncheck();
  const originalId = await p.evaluate(() => JSON.parse(localStorage.getItem('syllune.workspace.v1')).activePage);
  await p.locator('#tutor-open').click();
  await p.waitForFunction(() => !document.querySelector('#tutor-ask').disabled);
  await p.locator('#tutor-question').fill('Explain this step');
  await p.locator('#tutor-ask').click();
  await requested;
  await p.getByRole('button', { name: 'Close local tutor' }).click();
  await p.locator('#settings-button').click();
  const incoming = freshState();
  incoming.notebooks[0].pages[0].title = 'Imported control';
  await p.locator('#backup-file').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await p.waitForFunction(() => document.querySelector('#settings-status').textContent.includes('Imported safely'));
  release();
  // Observe completion through the actual UI before inspecting the saved workspace.
  await p.waitForFunction(() => !document.querySelector('#tutor-question').disabled);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('syllune.workspace.v1')));
  const original = saved.notebooks.flatMap(b => b.pages).find(page => page.id === originalId);
  assert.equal(original.tutor?.at(-1)?.content, 'Retained delayed reply', 'An in-flight reply must reach the retained original page after import');
  assert.equal(original.tutorDraft, '');
  assert.equal(saved.notebooks.at(-1).pages[0].tutor.length, 0, 'Imported page must not receive another page’s reply');
  assert.deepEqual(errors, []);
  await p.reload();
  const reloaded = await p.evaluate(() => JSON.parse(localStorage.getItem('syllune.workspace.v1')));
  assert.equal(reloaded.notebooks.flatMap(b => b.pages).find(page => page.id === originalId).tutor.at(-1).content, 'Retained delayed reply');
  console.log('PASS: delayed tutor reply survives backup import on its original page and reload; imported page untouched.');
} finally {
  release();
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
