import { checkWork } from './engine.js';
const coordinate = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export function assessRecognition(data) {
  if (!data || !Array.isArray(data.lines) || data.lines.length > 80)
    throw Error('Recognition returned an unsupported set of lines.');
  const lines = data.lines
    .map((line) => {
      if (!line || typeof line.text !== 'string' || line.text.length > 600)
        throw Error('Recognition returned invalid text.');
      const b = line.box;
      const box =
        b &&
        ['x', 'y', 'width', 'height'].every((k) => coordinate(b[k])) &&
        b.x + b.width <= 1.01 &&
        b.y + b.height <= 1.01
          ? b
          : null;
      return {
        text: line.text.trim(),
        box,
        confidence: coordinate(line.confidence) ? line.confidence : null,
      };
    })
    .filter((l) => l.text);
  const text = lines.map((l) => l.text).join('\n');
  if (text.length > 20000)
    throw Error(
      'An ink reading must stay within 20,000 characters. Use a page with fewer lines.',
    );
  const check = checkWork(text);
  return { text, lines, check, firstIssue: check.firstIssue, verified: false };
}
// Background reads are cancellable suggestions. This class never mutates a notebook or transcript.
export class QuietInk {
  constructor({
    capture,
    recognize,
    onResult,
    onStart = () => {},
    onError = () => {},
    delay = 2200,
  }) {
    Object.assign(this, {
      capture,
      recognize,
      onResult,
      onStart,
      onError,
      delay,
    });
    this.revision = 0;
    this.enabled = true;
    this.timer = null;
    this.controller = null;
  }
  invalidate() {
    this.revision++;
    clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }
  stop() {
    this.enabled = false;
    this.invalidate();
  }
  start() {
    this.enabled = true;
  }
  schedule() {
    if (!this.enabled) return;
    this.invalidate();
    const revision = this.revision;
    this.timer = setTimeout(() => this.read(revision), this.delay);
  }
  async read(revision) {
    if (!this.enabled || revision !== this.revision) return;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const image = await this.capture();
      if (revision !== this.revision || controller.signal.aborted) return;
      this.onStart();
      const data = await this.recognize(image, controller.signal);
      if (
        this.enabled &&
        revision === this.revision &&
        !controller.signal.aborted
      )
        this.onResult(assessRecognition(data));
    } catch (e) {
      if (!controller.signal.aborted && revision === this.revision)
        this.onError(e);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
