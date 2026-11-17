import test from 'node:test';
import assert from 'node:assert/strict';
import { Ink } from '../web/ink.js';

test('an image decode from a previous page generation cannot insert after switching away and back', async () => {
  let finish;
  const oldBitmap = globalThis.createImageBitmap, oldDocument = globalThis.document, oldImage = globalThis.Image;
  globalThis.createImageBitmap = () => new Promise((resolve) => { finish = resolve; });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,AA==' }) };
  globalThis.Image = class { set src(v) { this.onload(); } };
  try {
    const target = { images: [], strokes: [] };
    const ink = Object.create(Ink.prototype);
    Object.assign(ink, { page: target, generation: 1, images: new Map() });
    const pending = ink.insertImage({ size: 1 });
    ink.page = { images: [], strokes: [] }; ink.generation++;
    ink.page = target; ink.generation++;
    finish({ width: 5, height: 5, close() {} });
    await assert.rejects(pending, /changed pages/);
    assert.equal(target.images.length, 0);
  } finally { globalThis.createImageBitmap = oldBitmap; globalThis.document = oldDocument; globalThis.Image = oldImage; }
});
