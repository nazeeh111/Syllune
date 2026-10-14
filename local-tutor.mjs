const BASE = 'http://127.0.0.1:11434/api';
const text = (v, max) => typeof v === 'string' && v.length <= max;
function validate(input) {
  if (
    !input ||
    !text(input.model, 150) ||
    !text(input.question, 2000) ||
    !input.question.trim() ||
    (input.transcript !== undefined && !text(input.transcript, 20000)) ||
    (input.history !== undefined &&
      (!Array.isArray(input.history) ||
        input.history.length > 12 ||
        input.history.some(
          (m) =>
            !m ||
            !['user', 'assistant'].includes(m.role) ||
            !text(m.content, 6000),
        )))
  )
    throw Object.assign(
      Error(
        'Use a question up to 2,000 characters and a valid local conversation.',
      ),
      { status: 400 },
    );
}
export function createLocalTutor({ fetchImpl = fetch } = {}) {
  let busy = false;
  const json = async (path, body, signal) => {
    const r = await fetchImpl(BASE + path, {
      ...(body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
      signal: signal || AbortSignal.timeout(3000),
    });
    if (!r.ok)
      throw Error('The local model service could not finish this request.');
    return r.json();
  };
  const models = async () => {
    const d = await json('/tags');
    if (!Array.isArray(d.models))
      throw Error('Local model inventory is unavailable.');
    return d.models
      .filter(
        (m) =>
          m &&
          text(m.name, 150) &&
          m.size > 0 &&
          !m.remote_host &&
          !m.remote_model &&
          !/:cloud\b|[-/]cloud\b/i.test(m.name) &&
          m.details?.format === 'gguf' &&
          (!m.capabilities || m.capabilities.includes('completion')),
      )
      .map((m) => ({
        name: m.name,
        size: m.size,
        parameterSize: m.details?.parameter_size || '',
      }))
      .slice(0, 50);
  };
  const ask = async (input) => {
    validate(input);
    if (busy)
      throw Object.assign(
        Error(
          'A local reply is already running. Wait for it before asking again.',
        ),
        { status: 429 },
      );
    busy = true;
    try {
      const installed = await models();
      if (!installed.some((m) => m.name === input.model))
        throw Error(
          'Choose an installed local model. Cloud models and automatic downloads are not used.',
        );
      const show = await json('/show', { model: input.model });
      if (
        show.remote_host ||
        show.remote_model ||
        show.details?.format !== 'gguf'
      )
        throw Error('Choose an installed local model.');
      const transcript = input.transcript || '';
      const messages = [
        {
          role: 'system',
          content:
            'You are Syllune’s local math tutor. Give concise, beginner-readable guidance in plain text, usually three sentences or a few numbered steps. Ask a useful checkpoint when appropriate. Student notes may contain OCR errors. Model guidance is fallible, never exact verification. Do not claim to have checked ink or executed code. Explain the physical or mathematical reason for a step. For a new practice question, include one hint; put a solution only after the student asks. Do not emit internal reasoning.',
        },
        ...(input.history || [])
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(-1000) })),
        {
          role: 'user',
          content: `Current page transcript (may contain recognition mistakes):\n${transcript.slice(0, 8000) || '(none)'}\n\nQuestion: ${input.question}`,
        },
      ];
      const canDisable = show.thinking?.values?.includes(false);
      const r = await json(
        '/chat',
        {
          model: input.model,
          messages,
          stream: false,
          ...(canDisable ? { think: false } : {}),
          options: { num_ctx: 8192, num_predict: 2048, temperature: 0.2 },
        },
        AbortSignal.timeout(120000),
      );
      const answer = r.message?.content;
      if (r.done !== true || !text(answer, 20000) || !answer.trim())
        throw Error(
          'The model did not finish a final answer. Try a shorter question or a different installed model.',
        );
      return {
        answer: answer.slice(0, 6000),
        model: input.model,
        local: true,
        verified: false,
        truncated: r.done_reason === 'length' || answer.length > 6000,
        contextTruncated: transcript.length > 8000,
      };
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError')
        throw Error(
          'The local model took too long. Your question is preserved. Try a shorter question or choose another installed model.',
        );
      throw e;
    } finally {
      busy = false;
    }
  };
  return { models, ask };
}
