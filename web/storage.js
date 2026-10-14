export const STORAGE_KEY = 'syllune.workspace.v1';
export const uid = () => globalThis.crypto.randomUUID();
export const newPage = (title = 'Untitled page') => ({
  id: uid(),
  title,
  strokes: [],
  images: [],
  transcript: '',
  paper: 'dot',
  created: Date.now(),
  updated: Date.now(),
});
export const freshState = () => ({
  version: 1,
  notebooks: [
    { id: uid(), title: 'My notebook', pages: [newPage('A fresh start')] },
  ],
  activeNotebook: null,
  activePage: null,
  attempts: [],
  reviews: {},
  settings: { theme: 'light', quiet: true },
  focus: { end: null, remaining: 1500 },
});
const str = (v, n) => typeof v === 'string' && v.length <= n;
const finite = (v, min, max) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const insist = (b, m) => {
  if (!b) throw Error(m);
};
export function validateBackup(text) {
  insist(
    typeof text === 'string' && text.length <= 20_000_000,
    'Backup must be smaller than 20 MB.',
  );
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    throw Error('This is not a valid JSON backup.');
  }
  insist(
    s &&
      s.version === 1 &&
      Array.isArray(s.notebooks) &&
      s.notebooks.length > 0 &&
      s.notebooks.length <= 50,
    'Unsupported backup format.',
  );
  const ids = new Set();
  const id = (v) => {
    insist(str(v, 100) && v.length > 0 && !ids.has(v), 'IDs must be unique.');
    ids.add(v);
  };
  let points = 0,
    pages = 0;
  for (const book of s.notebooks) {
    insist(
      book &&
        str(book.title, 120) &&
        Array.isArray(book.pages) &&
        book.pages.length > 0 &&
        book.pages.length <= 200,
      'Invalid notebook.',
    );
    id(book.id);
    for (const p of book.pages) {
      pages++;
      insist(
        p &&
          str(p.title, 120) &&
          str(p.transcript, 20000) &&
          ['dot', 'line', 'blank'].includes(p.paper) &&
          finite(p.created, 0, 1e15) &&
          finite(p.updated, 0, 1e15),
        'Invalid page.',
      );
      id(p.id);
      insist(
        Array.isArray(p.strokes) &&
          p.strokes.length <= 10000 &&
          Array.isArray(p.images) &&
          p.images.length <= 10,
        'Invalid ink or images.',
      );
      for (const stroke of p.strokes) {
        insist(
          stroke &&
            /^#[\da-f]{6}$/i.test(stroke.color) &&
            finite(stroke.width, 0.2, 30) &&
            Array.isArray(stroke.points) &&
            stroke.points.length > 0 &&
            stroke.points.length <= 10000,
          'Invalid stroke.',
        );
        for (const pt of stroke.points) {
          points++;
          insist(
            pt &&
              finite(pt.x, -2000, 3000) &&
              finite(pt.y, -2400, 3600) &&
              finite(pt.p, 0, 1),
            'Invalid ink coordinate.',
          );
        }
      }
      for (const img of p.images)
        insist(
          img &&
            str(img.src, 8_000_000) &&
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
              img.src,
            ) &&
            finite(img.x, 0, 1000) &&
            finite(img.y, 0, 1200) &&
            finite(img.width, 1, 1000) &&
            finite(img.height, 1, 1200),
          'Invalid embedded image.',
        );
    }
  }
  insist(pages <= 500 && points <= 500000, 'Backup exceeds workspace limits.');
  insist(
    Array.isArray(s.attempts) && s.attempts.length <= 10000,
    'Invalid practice history.',
  );
  for (const a of s.attempts)
    insist(
      a &&
        str(a.id, 100) &&
        ['linear', 'quadratic', 'expand', 'fractions', 'derivative'].includes(
          a.topic,
        ) &&
        typeof a.correct === 'boolean' &&
        finite(a.at, 0, 1e15) &&
        str(a.answer, 600),
      'Invalid practice attempt.',
    );
  insist(
    s.settings &&
      ['light', 'dark'].includes(s.settings.theme) &&
      typeof s.settings.quiet === 'boolean',
    'Invalid settings.',
  );
  insist(
    s.reviews && typeof s.reviews === 'object' && !Array.isArray(s.reviews),
    'Invalid review schedule.',
  );
  for (const [topic, r] of Object.entries(s.reviews))
    insist(
      ['linear', 'quadratic', 'expand', 'fractions', 'derivative'].includes(
        topic,
      ) &&
        r &&
        finite(r.level, 0, 5) &&
        Number.isInteger(r.level) &&
        finite(r.due, 0, 1e15),
      'Invalid review entry.',
    );
  insist(
    s.focus &&
      finite(s.focus.remaining, 0, 86400) &&
      (s.focus.end === null || finite(s.focus.end, 0, 1e15)),
    'Invalid focus timer.',
  );
  return s;
}
export function mergeBackup(current, incoming) {
  const s = structuredClone(current);
  for (const b of incoming.notebooks) {
    const book = structuredClone(b);
    book.id = uid();
    book.title = (book.title + ' (imported)').slice(0, 120);
    book.pages.forEach((p) => (p.id = uid()));
    s.notebooks.push(book);
  }
  s.attempts = [
    ...s.attempts,
    ...incoming.attempts.map((a) => ({ ...a, id: uid() })),
  ].slice(-10000);
  validateBackup(JSON.stringify(s));
  return s;
}
export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return freshState();
  return validateBackup(raw);
}
export function saveState(storage, state, expectedRaw) {
  if (expectedRaw !== undefined && storage.getItem(STORAGE_KEY) !== expectedRaw)
    throw Error(
      'Another tab changed your saved notebook. Export this tab’s work and reload.',
    );
  const raw = JSON.stringify(state);
  validateBackup(raw);
  storage.setItem(STORAGE_KEY, raw);
  return raw.length;
}
