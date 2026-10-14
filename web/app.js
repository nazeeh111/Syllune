import { checkWork } from './engine.js';
import { QuietInk, assessRecognition } from './quiet-ink.js';
import { Ink, exampleInk } from './ink.js';
import {
  freshState,
  newPage,
  uid,
  loadState,
  saveState,
  mergeBackup,
  validateBackup,
  STORAGE_KEY,
} from './storage.js';
import {
  TOPICS,
  makeProblem,
  gradeAnswer,
  scheduleReview,
} from './practice.js';
const $ = (id) => document.getElementById(id),
  el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
let state,
  loadError,
  recoveryRaw,
  expectedRaw,
  savingPaused = false,
  writerAvailable = false;
// Hold one origin-scoped writer lock for the life of this page. Other tabs can export their copy.
if (navigator.locks)
  await new Promise((resolve) => {
    navigator.locks
      .request('syllune.workspace.writer', { ifAvailable: true }, (lock) => {
        writerAvailable = !!lock;
        resolve();
        return lock ? new Promise(() => {}) : undefined;
      })
      .catch(() => resolve());
  });
if (!writerAvailable) savingPaused = true;
try {
  expectedRaw = localStorage.getItem(STORAGE_KEY);
} catch {}
try {
  state = loadState(localStorage);
} catch (e) {
  state = freshState();
  loadError = e.message;
  savingPaused = true;
  try {
    recoveryRaw = localStorage.getItem(STORAGE_KEY);
  } catch {}
}
let book,
  page,
  currentView = 'studio',
  problem,
  topic = 'linear',
  problemNumber = 1,
  hintNumber = 0,
  graded = false,
  zoom = 1,
  quietTimer,
  saveTimer,
  toastTimer,
  ocrAvailable = false,
  ocrPending = false,
  lastReading = null,
  tutorPending = false,
  tutorPage = null;
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 7000);
}
function persist() {
  clearTimeout(saveTimer);
  if (savingPaused) {
    $('save-status').textContent = 'Saving paused';
    return false;
  }
  try {
    saveState(localStorage, state, expectedRaw);
    expectedRaw = localStorage.getItem(STORAGE_KEY);
    $('save-status').textContent = 'Saved locally';
    return true;
  } catch (e) {
    $('save-status').textContent = 'Not saved · export backup';
    toast(
      'Your latest changes are in memory. ' +
        e.message +
        ' Export a backup before leaving.',
    );
    return false;
  }
}
const delayedSave = () => {
  clearTimeout(saveTimer);
  $('save-status').textContent = 'Saving…';
  saveTimer = setTimeout(persist, 200);
};
function refreshInk() {
  const count = page.strokes.length;
  $('blank-hint').hidden = count > 0 || page.images.length > 0;
  $('stroke-count').textContent =
    `${count} ${count === 1 ? 'stroke' : 'strokes'}`;
}
const ink = new Ink(
  $('ink'),
  () => {
    refreshInk();
    persist();
    scheduleInkRead();
  },
  (u, r) => {
    $('undo').disabled = !u;
    $('redo').disabled = !r;
  },
);
const quiet = new QuietInk({
  capture: async () => {
    if (ink.active) throw Error('Writing is still in progress.');
    return ink.blob();
  },
  recognize: async (blob, signal) => {
    const r = await fetch('./api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'Local recognition unavailable.');
    return d;
  },
  onStart: () => {
    $('quiet-reading').hidden = false;
    $('quiet-status').textContent = 'Reading ink locally…';
  },
  onResult: (result) => {
    if (!ink.active) renderInkSuggestion(result);
  },
  onError: () => {
    $('quiet-reading').hidden = false;
    $('quiet-status').textContent =
      'Ink read unavailable. Typed checking still works.';
  },
});
if (!state.settings.quiet) quiet.stop();
function invalidateReading() {
  quiet.invalidate();
  lastReading = null;
  $('ink-marks').replaceChildren();
  $('quiet-suggestion').replaceChildren();
  $('review-reading').hidden = true;
  $('quiet-reading').hidden = true;
}
function scheduleInkRead() {
  invalidateReading();
  if (
    state.settings.quiet &&
    ocrAvailable &&
    writerAvailable &&
    currentView === 'studio' &&
    (page.strokes.length || page.images.length)
  )
    quiet.schedule();
}
$('ink').addEventListener('pointerdown', invalidateReading);
function renderInkSuggestion(result) {
  lastReading = { result, pageId: page.id, revision: quiet.revision };
  $('quiet-reading').hidden = false;
  $('quiet-suggestion').replaceChildren();
  $('ink-marks').replaceChildren();
  $('review-reading').hidden = !result.text;
  $('quiet-status').textContent = result.text
    ? 'Automatic ink reading · not yet reviewed'
    : 'No readable math found.';
  if (result.firstIssue !== null && result.check.steps[result.firstIssue]) {
    const step = result.check.steps[result.firstIssue];
    const card = el('div', 'ink-suggestion');
    card.append(
      el(
        'strong',
        '',
        step.status === 'incorrect'
          ? `Possible issue in ink · step ${result.firstIssue + 1}`
          : 'Recognized notation needs a look',
      ),
      el('p', '', step.detail),
    );
    $('quiet-suggestion').append(card);
    const b = result.lines[result.firstIssue]?.box;
    if (b) {
      const mark = el('div', 'ink-mark');
      mark.style.left = b.x * 100 + '%';
      mark.style.top = b.y * 100 + '%';
      mark.style.width = b.width * 100 + '%';
      mark.style.height = b.height * 100 + '%';
      mark.append(el('span', '', `Review step ${result.firstIssue + 1}`));
      $('ink-marks').append(mark);
    }
  } else if (result.check.steps.length > 1)
    $('quiet-status').textContent =
      'No issue found in the reading. Review before relying on it.';
}
$('review-reading').onclick = () => {
  if (!lastReading || lastReading.pageId !== page.id) return;
  quiet.invalidate();
  lastReading.revision = quiet.revision;
  $('recognized-preview').value = lastReading.result.text;
  $('ink-review').showModal();
};
$('apply-reading').onclick = () => {
  if (!lastReading || lastReading.pageId !== page.id) return;
  if ($('recognized-preview').value.length > 20000)
    return toast(
      'Keep the reviewed transcript within 20,000 characters before using it.',
    );
  if (
    page.transcript &&
    !confirm(
      'Replace this page’s existing transcript with the reading you reviewed?',
    )
  )
    return;
  page.transcript = $('recognized-preview').value;
  $('transcript').value = page.transcript;
  $('ink-review').close();
  invalidateReading();
  runCheck();
};
function selectPage(bookId, pageId) {
  invalidateReading();
  clearTimeout(quietTimer);
  clearTimeout(saveTimer);
  if (page) persist();
  book = state.notebooks.find((b) => b.id === bookId) || state.notebooks[0];
  page = book.pages.find((p) => p.id === pageId) || book.pages[0];
  state.activeNotebook = book.id;
  state.activePage = page.id;
  $('page-title').value = page.title;
  $('transcript').value = page.transcript;
  $('paper-type').value = page.paper;
  $('paper').className = 'paper ' + page.paper;
  $('breadcrumb').replaceChildren(
    document.createTextNode(book.title + ' '),
    el('span', '', '/'),
    document.createTextNode(' Studio'),
  );
  ink.bind(page);
  refreshInk();
  renderNotebooks();
  resetResults();
  showView('studio');
  persist();
  scheduleInkRead();
}
function renderNotebooks() {
  const container = $('notebooks');
  container.replaceChildren();
  state.notebooks.forEach((b) => {
    const head = el('div', 'notebook-head');
    const button = el('button', 'book-button', b.title);
    button.onclick = () => selectPage(b.id, b.pages[0].id);
    head.append(button);
    const rename = el('button', 'icon-button rename-book', '✎');
    rename.setAttribute('aria-label', 'Rename ' + b.title);
    rename.onclick = () => {
      const name = prompt('Notebook name', b.title);
      if (name?.trim()) {
        b.title = name.trim().slice(0, 120);
        renderNotebooks();
        persist();
        if (b.id === book.id) selectPage(b.id, page.id);
      }
    };
    head.append(rename);
    container.append(head);
    if (b.id === book.id)
      for (const p of b.pages) {
        const btn = el(
          'button',
          'page-button' + (p.id === page.id ? ' active' : ''),
          p.title || 'Untitled page',
        );
        btn.onclick = () => selectPage(b.id, p.id);
        if (p.id === page.id) btn.setAttribute('aria-current', 'page');
        container.append(btn);
      }
  });
  $('page-count').textContent = state.notebooks.reduce(
    (a, b) => a + b.pages.length,
    0,
  );
}
function showView(view) {
  if (view !== 'studio') quiet.invalidate();
  currentView = view;
  document
    .querySelectorAll('.view')
    .forEach((e) => (e.hidden = e.id !== view + '-view'));
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
  });
  if (view === 'practice') {
    if (!problem) nextProblem();
    renderReviews();
  }
  if (view === 'progress') renderProgress();
  document.querySelector('.sidebar').classList.remove('open');
  $('mobile-menu').setAttribute('aria-expanded', 'false');
}
function resetResults() {
  $('check-results').replaceChildren();
  const d = el('div', 'check-empty');
  d.append(el('span', 'mini-label', 'LET’S MAKE IT CLICK'));
  const h = el('h3', '', 'Keep the thinking. Lose the guesswork.');
  d.append(
    h,
    el(
      'p',
      '',
      'Write your steps, then check the chain. We’ll find the first step to revisit.',
    ),
  );
  $('check-results').append(d);
}
function runCheck() {
  clearTimeout(quietTimer);
  const text = $('transcript').value;
  page.transcript = text;
  persist();
  const result = checkWork(text);
  const box = $('check-results');
  box.replaceChildren();
  if (!result.steps.length) {
    box.append(
      el(
        'p',
        'small',
        result.error || 'Add at least two lines to compare your steps.',
      ),
    );
    return;
  }
  for (let i = 0; i < result.steps.length; i++) {
    const r = result.steps[i];
    if (r.status === 'start') {
      box.append(
        el(
          'p',
          'small',
          `${String(i + 1).padStart(2, '0')} · Starting point, not a verified answer.`,
        ),
      );
      continue;
    }
    if (r.status === 'blocked') {
      box.append(
        el(
          'p',
          'small',
          `${String(i + 1).padStart(2, '0')} · Waiting for the earlier step to be resolved.`,
        ),
      );
      continue;
    }
    const card = el('div', 'step-result ' + r.status);
    card.append(
      el('div', 'step-line', `${String(i + 1).padStart(2, '0')} · ${r.line}`),
      el('h3', '', r.title),
      el('p', '', r.detail),
    );
    if (r.hint && r.status === 'incorrect') {
      card.append(el('p', '', r.hint));
      const btn = el('button', 'text-button', 'Practice this idea →');
      btn.onclick = () => {
        topic =
          r.line.includes('^2') || text.includes('^2')
            ? 'quadratic'
            : text.includes('d/dx')
              ? 'derivative'
              : text.includes('=')
                ? 'linear'
                : 'expand';
        nextProblem();
        showView('practice');
      };
      card.append(btn);
    }
    box.append(card);
  }
  if (result.steps.length === 1)
    box.append(el('p', 'small', 'Add a second line to check a transition.'));
}
function loadExample() {
  if (book.pages.length >= 200)
    return toast('This notebook is full. Create another notebook.');
  const p = newPage('Example · sign check');
  p.strokes = exampleInk();
  p.transcript = '2x + 6 = 14\n2x = 20\nx = 10';
  book.pages.push(p);
  selectPage(book.id, p.id);
  runCheck();
  toast(
    'Example loaded into its own page. Try changing 20 to 8, then 10 to 4.',
  );
}
function nextProblem() {
  problem = makeProblem(topic);
  hintNumber = 0;
  graded = false;
  $('grade').disabled = false;
  $('hint').disabled = false;
  $('practice-answer').value = '';
  $('practice-feedback').replaceChildren();
  $('hint-text').hidden = true;
  $('solution').open = false;
  $('solution-text').textContent = problem.explanation;
  $('problem-prompt').textContent = problem.prompt;
  $('practice-topic').textContent = TOPICS[topic].toUpperCase();
  $('practice-index').textContent = String(problemNumber++).padStart(2, '0');
  renderTopics();
}
function renderTopics() {
  $('topic-list').replaceChildren();
  for (const [key, name] of Object.entries(TOPICS)) {
    const btn = el(
      'button',
      'topic-button' + (key === topic ? ' active' : ''),
      name,
    );
    btn.setAttribute('aria-pressed', key === topic);
    btn.onclick = () => {
      topic = key;
      nextProblem();
    };
    $('topic-list').append(btn);
  }
}
function grade() {
  if (graded) return;
  const value = $('practice-answer').value.trim();
  if (!value) {
    toast('Write an answer first.');
    $('practice-answer').focus();
    return;
  }
  const r = gradeAnswer(problem, value);
  const good = r.status === 'correct';
  const box = $('practice-feedback');
  box.replaceChildren();
  const card = el('div', 'step-result ' + r.status);
  card.append(
    el(
      'h3',
      '',
      good
        ? 'That clicks.'
        : r.status === 'unverified'
          ? 'Let’s review the notation.'
          : 'One more look.',
    ),
    el('p', '', good ? problem.explanation : r.detail),
  );
  box.append(card);
  if (r.status === 'unverified') return;
  state.attempts.push({
    id: uid(),
    topic,
    correct: good,
    at: Date.now(),
    answer: value,
  });
  if (state.attempts.length > 10000) state.attempts.shift();
  state.reviews[topic] = scheduleReview(state.reviews[topic]?.level || 0, good);
  persist();
  graded = good;
  $('grade').disabled = good;
  renderReviews();
}
function renderReviews() {
  const c = $('review-summary');
  c.replaceChildren();
  const now = Date.now();
  for (const [key, r] of Object.entries(state.reviews)) {
    const row = el('div', 'review-item');
    row.append(
      el('span', '', TOPICS[key]),
      el(
        'strong',
        '',
        r.due <= now
          ? 'Ready to review'
          : `In ${Math.ceil((r.due - now) / 86400000)}d`,
      ),
    );
    c.append(row);
  }
  if (!c.children.length)
    c.append(
      el('p', 'small', 'Your first answer starts your review schedule.'),
    );
}
function renderProgress() {
  const total = state.attempts.length,
    correct = state.attempts.filter((a) => a.correct).length;
  const days = new Set(state.attempts.map((a) => new Date(a.at).toDateString()))
    .size;
  $('progress-stats').replaceChildren();
  for (const [v, l] of [
    [total, 'Answers practiced'],
    [
      total ? Math.round((100 * correct) / total) + '%' : '—',
      'Correct answers',
    ],
    [days, 'Days you showed up'],
  ]) {
    const d = el('div', 'stat');
    d.append(el('strong', '', v), el('span', '', l));
    $('progress-stats').append(d);
  }
  $('mastery-list').replaceChildren();
  for (const [key, name] of Object.entries(TOPICS)) {
    const attempts = state.attempts.filter((a) => a.topic === key),
      success = attempts.filter((a) => a.correct).length;
    const row = el('div', 'mastery-row');
    const track = el('div', 'mastery-track');
    const bar = el('span');
    bar.style.width =
      (attempts.length ? (100 * success) / attempts.length : 0) + '%';
    track.append(bar);
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', name + ' correct-answer rate');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute(
      'aria-valuenow',
      attempts.length ? Math.round((100 * success) / attempts.length) : 0,
    );
    row.append(
      el('span', '', name),
      track,
      el('small', '', `${success}/${attempts.length} correct`),
    );
    $('mastery-list').append(row);
  }
  $('attempt-list').replaceChildren();
  for (const a of state.attempts.slice(-10).reverse()) {
    const r = el('div', 'attempt-row');
    r.append(
      el('strong', '', TOPICS[a.topic]),
      el('span', '', a.correct ? 'Correct' : 'Needs practice'),
      el('span', '', new Date(a.at).toLocaleDateString()),
    );
    $('attempt-list').append(r);
  }
  if (!total)
    $('attempt-list').append(
      el(
        'p',
        'small',
        'No practice attempts yet. Your progress begins with your first answer.',
      ),
    );
}
function download(blob, name) {
  const a = el('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function theme() {
  document.documentElement.dataset.theme = state.settings.theme;
  $('theme-toggle').setAttribute(
    'aria-label',
    state.settings.theme === 'light'
      ? 'Switch to dark theme'
      : 'Switch to light theme',
  );
}
function timerTick() {
  const remaining = state.focus.end
    ? Math.max(0, Math.ceil((state.focus.end - Date.now()) / 1000))
    : state.focus.remaining;
  $('timer').textContent =
    `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('timer-toggle').textContent = state.focus.end ? 'Ⅱ' : '▷';
  $('timer-toggle').setAttribute(
    'aria-label',
    state.focus.end ? 'Pause focus timer' : 'Start focus timer',
  );
  if (state.focus.end && remaining === 0) {
    state.focus.end = null;
    state.focus.remaining = 0;
    persist();
    toast('A little space to breathe. Your focus session is complete.');
  }
}
async function recognize() {
  invalidateReading();
  const revision = quiet.revision;
  if (ocrPending) return;
  if (!ocrAvailable)
    return toast(
      'For on-device recognition, run npm start on a Mac and open the local studio. Here you can type your transcript.',
    );
  ocrPending = true;
  $('recognize').disabled = true;
  $('recognize').textContent = 'Reading…';
  const target = page;
  try {
    const blob = await ink.blob();
    const res = await fetch('./api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'Recognition unavailable.');
    if (page !== target || quiet.revision !== revision)
      throw Error(
        'The ink or transcript changed while reading. Recognized text was not applied.',
      );
    const text = assessRecognition(data).text;
    if (!text)
      throw Error(
        'No readable text found. Try larger, clearer writing, or type the steps.',
      );
    if (
      target.transcript &&
      !confirm(
        'Replace this page’s transcript with recognized text? Your ink will stay.',
      )
    )
      return;
    target.transcript = text.slice(0, 20000);
    $('transcript').value = target.transcript;
    resetResults();
    persist();
    toast(
      'Recognition is a suggestion. Review each symbol, then check your steps.',
    );
  } catch (e) {
    toast(e.message);
  } finally {
    ocrPending = false;
    $('recognize').disabled = false;
    $('recognize').textContent = 'Read ink ↗';
  }
}
function renderTutorMessages(target) {
  const box = $('tutor-messages');
  box.replaceChildren();
  for (const message of target.tutor || []) {
    const card = el('div', 'tutor-message ' + message.role);
    card.append(
      el(
        'strong',
        '',
        message.role === 'user'
          ? 'YOUR QUESTION'
          : 'LOCAL MODEL · UNVERIFIED GUIDANCE',
      ),
      el('span', '', message.content),
    );
    box.append(card);
  }
  box.scrollTop = box.scrollHeight;
}
async function openTutor() {
  tutorPage = page;
  $('tutor-question').value = page.tutorDraft || '';
  renderTutorMessages(page);
  $('tutor').showModal();
  $('tutor-model').replaceChildren();
  $('tutor-ask').disabled = true;
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
    $('tutor-status').textContent =
      'Open the local companion and start Ollama with an installed text model for private tutoring. The hosted studio offers exact supported checks and practice.';
    return;
  }
  $('tutor-status').textContent = tutorPending
    ? 'A local reply is still running. You can close this panel and keep writing.'
    : 'Looking for installed local models…';
  try {
    const r = await fetch('./api/tutor/models', {
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    if (!r.ok || !Array.isArray(d.models) || !d.models.length)
      throw Error(
        'Start Ollama with an installed local text model, then reopen this panel. No model is downloaded automatically.',
      );
    for (const m of d.models) {
      const option = el('option', '', m.name);
      option.value = m.name;
      $('tutor-model').append(option);
    }
    $('tutor-ask').disabled = tutorPending;
    $('tutor-status').textContent =
      'Runs on this computer. Replies may be wrong; exact checks remain separate.';
  } catch (e) {
    $('tutor-status').textContent = e.message;
  }
}
async function askTutor() {
  if (tutorPending || !tutorPage) return;
  const question = $('tutor-question').value.trim();
  if (!question) return toast('Write a question first.');
  const target = tutorPage;
  target.tutorDraft = question;
  persist();
  const model = $('tutor-model').value;
  if (!model) return;
  tutorPending = true;
  $('tutor-ask').disabled = true;
  $('tutor-question').disabled = true;
  $('tutor-status').textContent =
    'Thinking locally… You can close this panel and keep writing.';
  try {
    const r = await fetch('./api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        question,
        transcript: target.transcript,
        history: (target.tutor || [])
          .slice(-12)
          .map(({ role, content }) => ({ role, content })),
      }),
      signal: AbortSignal.timeout(125000),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'The local tutor could not finish.');
    if (
      typeof d.answer !== 'string' ||
      d.answer.length > 6000 ||
      d.verified !== false ||
      d.local !== true
    )
      throw Error('The local tutor returned an unsupported reply.');
    target.tutor = [
      ...(target.tutor || []),
      { role: 'user', content: question, at: Date.now() },
      { role: 'assistant', content: d.answer, at: Date.now() },
    ].slice(-40);
    target.tutorDraft = '';
    target.updated = Date.now();
    persist();
    if (tutorPage === target) {
      renderTutorMessages(target);
      $('tutor-question').value = '';
      $('tutor-status').textContent = d.truncated
        ? 'This model reply was cut short. Treat it as incomplete guidance.'
        : d.contextTruncated
          ? 'Only the first part of the page transcript was included. Guidance is unverified.'
          : 'Local model guidance. Check the reasoning yourself before using it.';
    }
  } catch (e) {
    $('tutor-status').textContent = e.message;
  } finally {
    tutorPending = false;
    $('tutor-ask').disabled = !$('tutor-model').value;
    $('tutor-question').disabled = false;
  }
}
$('tutor-open').onclick = openTutor;
$('tutor-ask').onclick = askTutor;
$('tutor-question').oninput = () => {
  if (tutorPage) {
    tutorPage.tutorDraft = $('tutor-question').value;
    delayedSave();
  }
};
$('tutor-clear').onclick = () => {
  if (tutorPending)
    return toast('Wait for the local reply before clearing this conversation.');
  if (
    tutorPage?.tutor?.length &&
    !confirm(
      'Clear this page’s saved tutor conversation? Export a backup first if you want to keep it.',
    )
  )
    return;
  tutorPage.tutor = [];
  renderTutorMessages(tutorPage);
  persist();
};
$('new-book').onclick = () => {
  if (state.notebooks.length >= 50)
    return toast(
      'Workspace limit: 50 notebooks. Export a backup to keep your work portable.',
    );
  const b = {
    id: uid(),
    title: `Notebook ${state.notebooks.length + 1}`,
    pages: [newPage('A fresh start')],
  };
  state.notebooks.push(b);
  selectPage(b.id, b.pages[0].id);
};
$('new-page').onclick = () => {
  if (book.pages.length >= 200)
    return toast('Notebook limit: 200 pages. Create another notebook.');
  const p = newPage();
  book.pages.push(p);
  selectPage(book.id, p.id);
};
$('page-title').oninput = () => {
  page.title = $('page-title').value.slice(0, 120);
  page.updated = Date.now();
  renderNotebooks();
  delayedSave();
};
$('transcript').oninput = () => {
  invalidateReading();
  page.transcript = $('transcript').value;
  page.updated = Date.now();
  delayedSave();
  clearTimeout(quietTimer);
  if (state.settings.quiet) quietTimer = setTimeout(runCheck, 1100);
};
$('quiet-toggle').checked = state.settings.quiet;
$('quiet-toggle').onchange = () => {
  state.settings.quiet = $('quiet-toggle').checked;
  state.settings.quiet ? quiet.start() : quiet.stop();
  invalidateReading();
  if (state.settings.quiet) scheduleInkRead();
  clearTimeout(quietTimer);
  persist();
};
$('check').onclick = runCheck;
$('recognize').onclick = recognize;
$('example').onclick = loadExample;
$('blank-example').onclick = loadExample;
document
  .querySelectorAll('[data-view]')
  .forEach((b) => (b.onclick = () => showView(b.dataset.view)));
document.querySelectorAll('[data-tool]').forEach(
  (b) =>
    (b.onclick = () => {
      ink.setTool(b.dataset.tool);
      document.querySelectorAll('[data-tool]').forEach((t) => {
        t.classList.toggle('active', t === b);
        t.setAttribute('aria-pressed', t === b);
      });
    }),
);
document.querySelectorAll('[data-color]').forEach(
  (b) =>
    (b.onclick = () => {
      ink.color = b.dataset.color;
      document.querySelectorAll('[data-color]').forEach((t) => {
        t.classList.toggle('active', t === b);
        t.setAttribute('aria-pressed', t === b);
      });
    }),
);
$('pen-width').oninput = () => (ink.width = Number($('pen-width').value));
$('undo').onclick = () => ink.undo();
$('redo').onclick = () => ink.redo();
$('clear-ink').onclick = () => $('confirm').showModal();
$('confirm-yes').onclick = () => {
  ink.clear();
  $('confirm').close();
  toast('Ink cleared. Undo restores it.');
};
$('confirm-no').onclick = () => $('confirm').close();
$('paper-type').onchange = () => {
  page.paper = $('paper-type').value;
  $('paper').className = 'paper ' + page.paper;
  persist();
};
$('insert-image').onclick = () => $('image-file').click();
$('image-file').onchange = async () => {
  const file = $('image-file').files[0];
  if (file)
    try {
      await ink.insertImage(file);
      toast('Image inserted. Write directly over it.');
    } catch (e) {
      toast(e.message);
    }
  $('image-file').value = '';
};
$('export-page').onclick = async () =>
  download(
    await ink.blob(),
    (page.title || 'syllune-page').replace(/[^a-z0-9-]/gi, '-').slice(0, 80) +
      '.png',
  );
const setZoom = () => {
  $('paper').style.width = zoom * 100 + '%';
  $('zoom-label').textContent = Math.round(zoom * 100) + '%';
};
$('zoom-in').onclick = () => {
  zoom = Math.min(2, zoom + 0.25);
  setZoom();
};
$('zoom-out').onclick = () => {
  zoom = Math.max(0.5, zoom - 0.25);
  setZoom();
};
$('settings-button').onclick = () => $('settings').showModal();
$('help-button').onclick = () => $('help').showModal();
document
  .querySelectorAll('.close-dialog')
  .forEach((b) => (b.onclick = () => b.closest('dialog').close()));
$('theme-toggle').onclick = () => {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  theme();
  persist();
};
$('backup').onclick = () => {
  download(
    new Blob([recoveryRaw || JSON.stringify(state, null, 2)], {
      type: 'application/json',
    }),
    recoveryRaw
      ? 'syllune-recovery-original.json'
      : `syllune-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  $('settings-status').textContent = recoveryRaw
    ? 'Original stored bytes exported. Keep them safe.'
    : 'Backup exported. Keep a copy outside this browser.';
};
$('import-backup').onclick = () => $('backup-file').click();
$('backup-file').onchange = async () => {
  const file = $('backup-file').files[0];
  try {
    if (!file) return;
    if (file.size > 20_000_000)
      throw Error('Backup must be smaller than 20 MB.');
    const incoming = validateBackup(await file.text());
    const merged = mergeBackup(state, incoming);
    if (savingPaused)
      throw Error('Resolve the storage recovery warning before importing.');
    saveState(localStorage, merged, expectedRaw);
    expectedRaw = localStorage.getItem(STORAGE_KEY);
    state = merged;
    selectPage(merged.notebooks.at(-1).id, merged.notebooks.at(-1).pages[0].id);
    $('settings-status').textContent =
      'Imported safely. Existing notebooks were preserved.';
    toast('Your work is here. Original notebooks preserved.');
  } catch (e) {
    $('settings-status').textContent = e.message;
  } finally {
    $('backup-file').value = '';
  }
};
$('print-page').onclick = () => {
  $('settings').close();
  showView('studio');
  window.print();
};
$('grade').onclick = grade;
$('practice-answer').oninput = () => {
  graded = false;
  $('grade').disabled = false;
};
$('practice-answer').onkeydown = (e) => {
  if (e.key === 'Enter') grade();
};
$('hint').onclick = () => {
  $('hint-text').hidden = false;
  $('hint-text').textContent =
    problem.hints[Math.min(hintNumber++, problem.hints.length - 1)];
  $('hint').disabled = hintNumber >= problem.hints.length;
};
$('next-problem').onclick = nextProblem;
$('timer-toggle').onclick = () => {
  if (state.focus.end) {
    state.focus.remaining = Math.max(
      0,
      Math.ceil((state.focus.end - Date.now()) / 1000),
    );
    state.focus.end = null;
  } else {
    if (!state.focus.remaining) state.focus.remaining = 1500;
    state.focus.end = Date.now() + state.focus.remaining * 1000;
  }
  persist();
  timerTick();
};
$('timer-reset').onclick = () => {
  state.focus = { end: null, remaining: 1500 };
  persist();
  timerTick();
};
setInterval(timerTick, 1000);
$('mobile-menu').onclick = () => {
  const open = document.querySelector('.sidebar').classList.toggle('open');
  $('mobile-menu').setAttribute('aria-expanded', open);
};
document.addEventListener('click', (e) => {
  if (
    innerWidth <= 650 &&
    !e.target.closest('.sidebar') &&
    !e.target.closest('#mobile-menu')
  ) {
    document.querySelector('.sidebar').classList.remove('open');
    $('mobile-menu').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  const editing = e.target.matches('input,textarea,select,[contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (currentView === 'studio') runCheck();
    return;
  }
  if (editing || document.querySelector('dialog[open]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? ink.redo() : ink.undo();
  } else if (!e.ctrlKey && !e.metaKey) {
    const tools = { p: 'tool-pen', e: 'tool-erase', v: 'tool-select' };
    if (tools[e.key.toLowerCase()]) $(tools[e.key.toLowerCase()]).click();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});
window.addEventListener('beforeunload', (e) => {
  if (!persist()) {
    e.preventDefault();
    e.returnValue = 'Your latest changes have not been saved.';
  }
});
theme();
selectPage(state.activeNotebook, state.activePage);
timerTick();
renderTopics();
if (!writerAvailable && !loadError) {
  $('settings-status').textContent = navigator.locks
    ? 'Saving is paused because another Syllune tab owns the notebook. This tab keeps changes in memory. Export its backup before leaving, then close the other tab and reload.'
    : 'This browser cannot provide a safe writing lock. Changes remain in memory; export a backup or use a current Chrome, Safari, Edge or Firefox.';
  toast($('settings-status').textContent);
}
if (loadError) {
  $('settings-status').textContent =
    'Saving is paused: ' +
    loadError +
    ' Original stored bytes are preserved. Export them first. A recovery copy must be stored before starting fresh.';
  const recover = el(
    'button',
    'button subtle',
    'Preserve old data & start fresh',
  );
  recover.onclick = () => {
    try {
      if (!writerAvailable)
        throw Error('Close other Syllune tabs and reload before recovery.');
      if (localStorage.getItem(STORAGE_KEY) !== expectedRaw)
        throw Error(
          'Saved bytes changed. Export this copy and reload before recovery.',
        );
      if (recoveryRaw)
        localStorage.setItem(
          STORAGE_KEY + '.recovery.' + Date.now(),
          recoveryRaw,
        );
      savingPaused = false;
      if (!persist()) {
        savingPaused = true;
        throw Error(
          'Storage is unavailable. Keep exporting your in-memory work.',
        );
      }
      recoveryRaw = null;
      recover.remove();
      $('settings-status').textContent =
        'Original bytes retained in a recovery key. Fresh workspace saving is enabled.';
    } catch (e) {
      savingPaused = true;
      $('settings-status').textContent = e.message;
    }
  };
  $('settings').append(recover);
  $('settings').showModal();
}
if (['localhost', '127.0.0.1'].includes(location.hostname))
  fetch('./api/status')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      ocrAvailable = !!d?.recognition;
      scheduleInkRead();
      $('recognize').title = ocrAvailable
        ? 'Recognize on-device with Apple Vision'
        : 'Typed checking is available. Mac companion needed for recognition.';
    })
    .catch(() => {});
else
  $('recognize').title =
    'Run the Mac companion locally for on-device recognition.';
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js').catch(() => {});
