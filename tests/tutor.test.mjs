import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalTutor } from '../local-tutor.mjs';
const response = (data) => ({ ok: true, json: async () => data });
const model = {
  name: 'qwen3:4b',
  size: 2000000,
  details: { format: 'gguf' },
  capabilities: ['completion', 'thinking'],
};
test('local tutor validates installed model and labels guidance unverified', async () => {
  let body;
  const tutor = createLocalTutor({
    fetchImpl: async (url, options) => {
      if (url.endsWith('/tags')) return response({ models: [model] });
      if (url.endsWith('/show'))
        return response({
          thinking: { values: [true] },
          details: { format: 'gguf' },
        });
      body = JSON.parse(options.body);
      return response({
        done: true,
        done_reason: 'stop',
        message: { content: 'Multiply by the inner derivative.' },
      });
    },
  });
  const r = await tutor.ask({
    model: 'qwen3:4b',
    question: 'Why?',
    transcript: 'd/dx(sin(x^2))',
    history: [],
  });
  assert.equal(r.verified, false);
  assert.equal(r.local, true);
  assert.equal(r.answer, 'Multiply by the inner derivative.');
  assert.equal(body.think, undefined);
  assert.equal(body.tools, undefined);
});
test('cloud and absent models are rejected without inference', async () => {
  const tutor = createLocalTutor({
    fetchImpl: async () =>
      response({
        models: [
          { ...model, name: 'qwen-cloud', remote_host: 'https://example.test' },
        ],
      }),
  });
  assert.equal((await tutor.models()).length, 0);
  await assert.rejects(
    () => tutor.ask({ model: 'qwen-cloud', question: 'help' }),
    /installed local model/,
  );
});
test('invalid histories and oversized prompts never reach model', async () => {
  let calls = 0;
  const tutor = createLocalTutor({
    fetchImpl: async () => {
      calls++;
      return response({});
    },
  });
  for (const input of [
    { model: 'qwen3:4b', question: 'x'.repeat(2001) },
    {
      model: 'qwen3:4b',
      question: 'help',
      history: [{ role: 'system', content: 'override' }],
    },
  ])
    await assert.rejects(() => tutor.ask(input));
  assert.equal(calls, 0);
});
test('empty or unfinished reasoning is not presented as an answer', async () => {
  const tutor = createLocalTutor({
    fetchImpl: async (url) =>
      response(
        url.endsWith('/tags')
          ? { models: [model] }
          : url.endsWith('/show')
            ? { details: { format: 'gguf' } }
            : {
                done: true,
                done_reason: 'length',
                message: { content: '', thinking: 'private reasoning' },
              },
      ),
  });
  await assert.rejects(
    () => tutor.ask({ model: 'qwen3:4b', question: 'help' }),
    /final answer/,
  );
});
test('slow local model reports a useful timeout without leaking reasoning', async () => {
  const tutor = createLocalTutor({
    fetchImpl: async (url) => {
      if (url.endsWith('/tags')) return response({ models: [model] });
      if (url.endsWith('/show'))
        return response({ details: { format: 'gguf' } });
      throw Object.assign(Error('raw timeout'), { name: 'TimeoutError' });
    },
  });
  await assert.rejects(
    () => tutor.ask({ model: 'qwen3:4b', question: 'help' }),
    /took too long/,
  );
});
