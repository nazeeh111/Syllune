import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server.mjs';
let server, url;
test.before(async () => {
  server = createAppServer();
  await new Promise((r, j) => {
    server.on('error', j);
    server.listen(0, '127.0.0.1', r);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((r) => server.close(r)));
test('serves app and blocks private files', async () => {
  assert.equal((await fetch(url + '/engine.js')).status, 200);
  assert.equal((await fetch(url + '/../package.json')).status, 404);
  assert.equal((await fetch(url + '/native/Recognize.swift')).status, 404);
});
test('rejects foreign origins and DNS rebinding host', async () => {
  assert.equal(
    (
      await fetch(url + '/api/recognize', {
        method: 'POST',
        headers: { Origin: 'https://evil.test', 'Content-Type': 'image/png' },
        body: 'abc',
      })
    ).status,
    403,
  );
  assert.equal(
    await new Promise((resolve, reject) => {
      const req = http.get(url, { headers: { Host: 'evil.test' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      });
      req.on('error', reject);
    }),
    403,
  );
});
test('validates recognition content before executing native tool', async () => {
  const r = await fetch(url + '/api/recognize', {
    method: 'POST',
    headers: { Origin: url, 'Content-Type': 'text/plain' },
    body: 'abc',
  });
  assert.equal(r.status, 415);
  const bad = await fetch(url + '/api/recognize', {
    method: 'POST',
    headers: { Origin: url, 'Content-Type': 'image/png' },
    body: 'abc',
  });
  assert.equal(bad.status, 400);
});
test('local tutor rejects foreign origins and malformed requests', async () => {
  assert.equal(
    (
      await fetch(url + '/api/tutor', {
        method: 'POST',
        headers: {
          Origin: 'https://evil.test',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(url + '/api/tutor', {
        method: 'POST',
        headers: { Origin: url, 'Content-Type': 'application/json' },
        body: 'not json',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(url + '/api/tutor', {
        method: 'POST',
        headers: { Origin: url, 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    400,
  );
});
