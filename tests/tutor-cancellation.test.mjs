import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from '../server.mjs';
import { createLocalTutor } from '../local-tutor.mjs';
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const close = async (server) => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
};
const json = (res, value) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};

test('disconnecting the companion question aborts its model transport and releases tutor ownership', async () => {
  let started,
    release,
    chatClosed = false;
  const chatStarted = new Promise((resolve) => {
    started = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const model = http.createServer(async (req, res) => {
    if (req.url === '/api/tags')
      return json(res, {
        models: [
          { name: 'fixture:local', size: 1, details: { format: 'gguf' } },
        ],
      });
    if (req.url === '/api/show')
      return json(res, { details: { format: 'gguf' } });
    if (req.url === '/api/chat') {
      req.resume();
      res.on('close', () => {
        if (!res.writableEnded) chatClosed = true;
      });
      started();
      await held;
      if (!res.destroyed)
        json(res, { done: true, message: { content: 'Fixture answer' } });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await listen(model);
  const tutor = createLocalTutor({
    fetchImpl: (url, options) => {
      assert.equal(new URL(url).origin, 'http://127.0.0.1:11434');
      return fetch(
        `http://127.0.0.1:${model.address().port}${new URL(url).pathname}`,
        options,
      );
    },
  });
  const server = createAppServer({ tutor });
  await listen(server);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = http.request(origin + '/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
  });
  request.on('error', () => {});
  try {
    request.end(
      JSON.stringify({
        model: 'fixture:local',
        question: 'Hold this question',
      }),
    );
    let startTimer;
    await Promise.race([
      chatStarted,
      new Promise((_, reject) => {
        startTimer = setTimeout(
          () => reject(Error('Fixture chat did not start')),
          3000,
        );
      }),
    ]);
    clearTimeout(startTimer);
    request.destroy();
    const deadline = Date.now() + 1500;
    while (!chatClosed && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(
      chatClosed,
      true,
      'Closing the client must close the held model HTTP response before manual fixture release',
    );
    release();
    const next = await tutor.ask({
      model: 'fixture:local',
      question: 'A subsequent question',
    });
    assert.equal(next.answer, 'Fixture answer');
  } finally {
    release();
    request.destroy();
    await close(server);
    await close(model);
  }
});

const inventory = {
  models: [{ name: 'fixture:local', size: 1, details: { format: 'gguf' } }],
};
const show = { details: { format: 'gguf' } };
const answer = {
  done: true,
  message: { content: 'A subsequent fixture answer' },
};
const input = { model: 'fixture:local', question: 'Why?' };
const response = (data) => ({ ok: true, json: async () => data });

test('a pre-cancelled question cannot acquire ownership or contact the model service', async () => {
  let calls = 0;
  const tutor = createLocalTutor({
    fetchImpl: async (url) => {
      calls++;
      return response(
        url.endsWith('/tags')
          ? inventory
          : url.endsWith('/show')
            ? show
            : answer,
      );
    },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(tutor.ask(input, { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(calls, 0);
  assert.equal((await tutor.ask(input)).answer, 'A subsequent fixture answer');
});

for (const stage of ['/tags', '/show', '/chat'])
  test(`cancellation reaches ${stage} and releases the next question`, async () => {
    let started,
      blocked = true;
    const entered = new Promise((resolve) => {
      started = resolve;
    });
    const tutor = createLocalTutor({
      fetchImpl: async (url, { signal }) => {
        if (blocked && url.endsWith(stage)) {
          started();
          return new Promise((resolve, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            }),
          );
        }
        return response(
          url.endsWith('/tags')
            ? inventory
            : url.endsWith('/show')
              ? show
              : answer,
        );
      },
    });
    const controller = new AbortController(),
      pending = tutor.ask(input, { signal: controller.signal });
    await entered;
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    blocked = false;
    assert.equal(
      (await tutor.ask(input)).answer,
      'A subsequent fixture answer',
    );
  });

test('late response after cancellation is rejected while uncooperative work retains ownership until settled', async () => {
  let entered,
    release,
    held = true;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tutor = createLocalTutor({
    fetchImpl: async (url) => {
      if (url.endsWith('/tags')) return response(inventory);
      if (url.endsWith('/show')) return response(show);
      return {
        ok: true,
        json: async () => {
          if (held) {
            entered();
            await gate;
          }
          return answer;
        },
      };
    },
  });
  const controller = new AbortController(),
    pending = tutor.ask(input, { signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(tutor.ask(input), { status: 429 });
  held = false;
  release();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal((await tutor.ask(input)).answer, 'A subsequent fixture answer');
});
