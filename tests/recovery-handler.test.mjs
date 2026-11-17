import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { NotebookSession, STORAGE_KEY, freshState } from '../web/storage.js';
const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
function handler(start, end) { const a=source.indexOf(start), b=source.indexOf(end,a); assert.ok(a>=0&&b>a); return source.slice(a,b+end.length); }
function fixture(raw, writerAvailable=true) {
  const values=new Map(); if (raw !== null) values.set(STORAGE_KEY,raw);
  let failKey=null;
  const storage={ getItem:k=>values.has(k)?values.get(k):null, setItem:(k,v)=>{if(k===failKey)throw Error('quota');values.set(k,v);} };
  const notebook=new NotebookSession(storage); let recoveryRaw;
  try { notebook.open(); } catch { recoveryRaw=notebook.recoveryBytes; }
  const recover={removed:false,remove(){this.removed=true;}}, nodes={'settings-status':{},'save-status':{}};
  const context={recover,writerAvailable,notebook,state:freshState(),savingPaused:true,recoveryRaw,$:id=>nodes[id]};
  vm.runInNewContext(handler('  recover.onclick = () => {','\n  };'),context);
  return {values,storage,notebook,context,recover,nodes,fail:(k)=>{failKey=k;}};
}
test('actual recovery handler preserves admitted corrupt bytes and retries failed final write', () => {
  const f=fixture('{bad'); f.fail(STORAGE_KEY); f.recover.onclick();
  assert.equal(f.values.get(STORAGE_KEY),'{bad'); assert.equal(f.context.savingPaused,true);
  assert.ok([...f.values].some(([k,v])=>k.startsWith(STORAGE_KEY+'.recovery.')&&v==='{bad'));
  f.fail(null); f.recover.onclick(); assert.equal(f.context.savingPaused,false); assert.equal(f.recover.removed,true);
  assert.equal(JSON.parse(f.values.get(STORAGE_KEY)).version,1);
});
test('actual recovery handler refuses missing, stale or no-lock data', () => {
  const missing=fixture(null);missing.recover.onclick();assert.equal(missing.values.size,0);assert.equal(missing.context.savingPaused,true);
  const stale=fixture('{bad');stale.values.set(STORAGE_KEY,'{new');stale.recover.onclick();assert.equal(stale.values.get(STORAGE_KEY),'{new');assert.equal(stale.values.size,1);
  const locked=fixture('{bad',false);locked.recover.onclick();assert.equal(locked.values.get(STORAGE_KEY),'{bad');assert.equal(locked.values.size,1);
});
test('actual transcript handler clears old verdict immediately with quiet on or off', () => {
  for (const quiet of [false,true]) {
    const nodes={transcript:{value:'x=1\nx=2'},'check-results':{textContent:'old correct'}};
    const context={$:id=>nodes[id],page:{},state:{settings:{quiet}},invalidateReading(){},resetResults(){nodes['check-results'].textContent=''},updateTranscriptSummary(){},delayedSave(){},clearTimeout(){},setTimeout(){return 1},quietTimer:null,runCheck(){},Date};
    vm.runInNewContext(handler("$('transcript').oninput = () => {",'\n};'),context);nodes.transcript.oninput();
    assert.equal(nodes['check-results'].textContent,''); assert.equal(context.page.transcript,nodes.transcript.value);
  }
});
test('failed recovery-copy write retains original bytes and can be retried', () => {
  const f=fixture('{bad'), originalSet=f.storage.setItem;
  f.storage.setItem=(key,value)=>{if(key.startsWith(STORAGE_KEY+'.recovery.'))throw Error('quota');originalSet(key,value)};
  f.recover.onclick();assert.equal(f.values.get(STORAGE_KEY),'{bad');assert.equal(f.values.size,1);assert.equal(f.context.savingPaused,true);
  f.storage.setItem=originalSet;f.recover.onclick();assert.equal(f.context.savingPaused,false);assert.ok([...f.values.values()].includes('{bad'));
});

test('actual delayed save keeps a paused writer visibly paused without scheduling storage work', () => {
  for (const paused of [true, false]) {
    const status = {textContent: paused ? 'Saving paused' : 'Saved locally'};
    const calls = [];
    const context = {savingPaused: paused, saveTimer: 7, $: () => status,
      clearTimeout: id => calls.push(['clear', id]),
      setTimeout: (fn, delay) => { calls.push(['schedule', delay]); return 8; },
      persist() { throw Error('test must not execute a storage write'); }};
    vm.runInNewContext(handler('const delayedSave = () => {', '\n};') + '\nglobalThis.save = delayedSave;', context);
    context.save();
    assert.equal(status.textContent, paused ? 'Saving paused' : 'Saving…');
    assert.equal(calls.filter(x => x[0] === 'schedule').length, paused ? 0 : 1);
  }
});

test('actual manual reading completion keeps an already open dialog usable and leaves transcript adoption explicit', async () => {
  for (const modalOpen of [false, true]) {
    const result = {text: 'x=4'};
    const target = {id: 'page', transcript: 'x=3'};
    let reviewsOpened = 0;
    const nodes = {recognize: {disabled: false, textContent: 'Read ink ↗'},
      'review-reading': {click() { reviewsOpened++; }}};
    const context = {ocrPending: false, ocrAvailable: true, page: target,
      quiet: {readNow: async () => result}, invalidateReading() {},
      renderInkSuggestion(value) { assert.equal(value, result); },
      $: id => nodes[id], document: {querySelector: () => modalOpen ? {id: 'tutor'} : null},
      toast() {}};
    const start = source.indexOf('async function recognize() {');
    const end = source.indexOf('function renderTutorMessages', start);
    assert.ok(start >= 0 && end > start);
    vm.runInNewContext(source.slice(start, end) + '\nglobalThis.read = recognize;', context);
    await context.read();
    assert.equal(reviewsOpened, modalOpen ? 0 : 1);
    assert.equal(target.transcript, 'x=3');
    assert.equal(nodes.recognize.disabled, false);
  }
});
