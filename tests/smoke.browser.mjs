import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const server = createAppServer();
await new Promise((r, j) => {
  server.on('error', j);
  server.listen(0, '127.0.0.1', r);
});
const url = `http://127.0.0.1:${server.address().port}`,
  temp = await mkdtemp(join(tmpdir(), 'syllune-browser-'));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SYLLUNE_CHROME
      ? { executablePath: process.env.SYLLUNE_CHROME }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const p = await context.newPage(),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await p.locator('#example').click();
  assert.equal(await p.locator('.step-result.incorrect').count(), 1);
  await p.locator('#transcript').fill('2x+6=14\n2x=8\nx=4');
  await p.locator('#check').click();
  assert.equal(await p.locator('.step-result.correct').count(), 2);
  const r = await p.locator('#ink').boundingBox();
  await p.mouse.move(r.x + 100, r.y + 320);
  await p.mouse.down();
  await p.mouse.move(r.x + 160, r.y + 350, { steps: 8 });
  await p.mouse.up();
  assert.equal(await p.locator('#stroke-count').innerText(), '27 strokes');
  await p.locator('#undo').click();
  assert.equal(await p.locator('#stroke-count').innerText(), '26 strokes');
  await p.locator('#redo').click();
  assert.equal(await p.locator('#stroke-count').innerText(), '27 strokes');
  await p.reload();
  assert.equal(
    await p.locator('#transcript').inputValue(),
    '2x+6=14\n2x=8\nx=4',
  );
  assert.equal(await p.locator('#stroke-count').innerText(), '27 strokes');
  await p.locator('#tool-select').click();
  const rect = await p.locator('#ink').boundingBox();
  await p.mouse.move(rect.x + 45, rect.y + 55);
  await p.mouse.down();
  await p.mouse.move(rect.x + 320, rect.y + 140, { steps: 5 });
  await p.mouse.up();
  const before = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem('syllune.workspace.v1')).notebooks[0]
        .pages[1].strokes[0].points[0].x,
  );
  await p.mouse.move(rect.x + 100, rect.y + 100);
  await p.mouse.down();
  await p.mouse.move(rect.x + 130, rect.y + 110, { steps: 3 });
  await p.mouse.up();
  const after = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem('syllune.workspace.v1')).notebooks[0]
        .pages[1].strokes[0].points[0].x,
  );
  assert.ok(after > before);
  await p.locator('#undo').click();
  await p.locator('#clear-ink').click();
  await p.locator('#confirm-yes').click();
  assert.equal(await p.locator('#stroke-count').innerText(), '0 strokes');
  await p.locator('#undo').click();
  assert.equal(await p.locator('#stroke-count').innerText(), '27 strokes');
  const png = await Promise.all([
    p.waitForEvent('download'),
    p.locator('#export-page').click(),
  ]);
  await png[0].saveAs(join(temp, 'ink.png'));
  assert.ok((await readFile(join(temp, 'ink.png'))).length > 1000);
  await p.locator('#new-page').click();
  await p.locator('#image-file').setInputFiles(join(temp, 'ink.png'));
  await p.waitForFunction(() => document.querySelector('#blank-hint').hidden);
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem('syllune.workspace.v1'),
        ).notebooks[0].pages.at(-1).images.length,
    ),
    1,
  );
  await p.locator('#undo').click();
  assert.equal(await p.locator('#blank-hint').isVisible(), true);
  await p.locator('#page-title').fill('A browser-tested page');
  await p.locator('#transcript').fill('1/3+1/6\n1/2');
  await p.locator('#check').click();
  assert.equal(await p.locator('.step-result.correct').count(), 1);
  await p.locator('[data-view=practice]').click();
  const prompt = await p.locator('#problem-prompt').innerText(),
    m = prompt.match(/Solve (\d+)x \+ (\d+) = (\d+)/);
  assert.ok(m);
  await p.locator('#practice-answer').fill('x=' + (+m[3] - m[2]) / m[1]);
  await p.locator('#grade').click();
  assert.match(
    await p.locator('#practice-feedback').innerText(),
    /That clicks/,
  );
  await p.locator('[data-view=progress]').click();
  assert.match(await p.locator('#progress-stats').innerText(), /100%/);
  await p.locator('#settings-button').click();
  const download = await Promise.all([
    p.waitForEvent('download'),
    p.locator('#backup').click(),
  ]);
  await download[0].saveAs(join(temp, 'backup.json'));
  assert.equal(
    JSON.parse(await readFile(join(temp, 'backup.json'), 'utf8')).attempts
      .length,
    1,
  );
  await p.locator('#backup-file').setInputFiles(join(temp, 'backup.json'));
  await p.waitForFunction(() =>
    document
      .querySelector('#settings-status')
      .textContent.includes('Imported safely'),
  );
  assert.match(
    await p.locator('#settings-status').innerText(),
    /Imported safely/,
  );
  await p.getByRole('button', { name: 'Close settings' }).click();
  assert.equal(await p.locator('.notebook-head').count(), 2);
  const second = await context.newPage();
  await second.goto(url);
  assert.equal(
    await second.locator('#save-status').innerText(),
    'Saving paused',
  );
  await p.locator('#transcript').fill('x=123');
  await p.locator('#check').click();
  await second.locator('#theme-toggle').click();
  assert.ok(
    await second.evaluate(() =>
      localStorage.getItem('syllune.workspace.v1').includes('x=123'),
    ),
  );
  await second.close();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await context.setOffline(true);
  await p.reload();
  await p.locator('#transcript').fill('3x=12\nx=4');
  await p.locator('#check').click();
  assert.equal(await p.locator('.step-result.correct').count(), 1);
  await context.setOffline(false);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload();
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), true);
  await p.keyboard.press('Tab');
  assert.equal(await p.locator('.skip').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Tab');
  assert.equal(await p.locator('#mobile-menu').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Enter');
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), false);
  assert.equal(await p.locator('[data-view=studio]').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#mobile-menu').getAttribute('aria-expanded'), 'false');
  assert.equal(await p.locator('#mobile-menu').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Enter');
  await p.keyboard.press('Tab');
  assert.equal(await p.locator('[data-view=practice]').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Enter');
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(
    await p.locator('.sidebar').evaluate((e) => e.classList.contains('open')),
    false,
  );
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), true);
  assert.equal(await p.locator('#mobile-menu').evaluate((e) => e === document.activeElement), true);
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.waitForFunction(() => !document.querySelector('.sidebar').inert);
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), false);
  assert.equal(await p.locator('[data-view=practice]').evaluate((e) => e === document.activeElement), true);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForFunction(() => document.querySelector('.sidebar').inert);
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), true);
  assert.equal(await p.locator('#mobile-menu').evaluate((e) => e === document.activeElement), true);
  await p.keyboard.press('Enter');
  await p.locator('#save-status').click();
  assert.equal(await p.locator('#mobile-menu').getAttribute('aria-expanded'), 'false');
  assert.equal(await p.locator('.sidebar').evaluate((e) => e.inert), true);
  const badContext = await browser.newContext();
  await badContext.addInitScript(() =>
    localStorage.setItem('syllune.workspace.v1', '{"broken":true}'),
  );
  const bad = await badContext.newPage();
  await bad.goto(url);
  assert.equal(
    await bad.evaluate(() => localStorage.getItem('syllune.workspace.v1')),
    '{"broken":true}',
  );
  assert.equal(await bad.locator('#settings').isVisible(), true);
  assert.equal(await bad.locator('#save-status').innerText(), 'Saving paused');
  await badContext.close();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: exact feedback, ink/history/selection, PNG/image import, persistence, practice/progress, backup import, multi-tab guard, recovery, offline use and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await rm(temp, { recursive: true, force: true });
}
