# Syllune implementation plan

Goal: deliver an original, usable math studio with verifiable checks and a polished GitHub release.
Architecture: zero-dependency browser ES modules, exact rational polynomial core and optional localhost Mac OCR companion. See DESIGN.md.
Constraints: free tools only; no credentials; original branding and assets; preserve data; user has authorized GitHub release.

1. engine.js + engine.test.js: exact rational arithmetic and bounded parser; compare expressions and equation roots; polynomial derivative; diagnose first bad transition. Pin division-by-variable refusal, lost quadratic roots, decimal exactness, malformed input, complexity bounds and derivative syntax.
2. storage.js/practice.js + tests: validated bounded versioned backup, non-destructive merge, distinct page IDs, generated solutions/hints and due dates. Pin hostile backups, unique IDs, no fake activity, and scheduling.
3. ink.js + accessible index.html/style.css/app.js: write/move/erase, undo/redo, persistent pages, transcript checks, feedback, practice, progress, settings, exports/import, focus timer. Browser exercise critical paths, refresh and mobile overflow.
4. server.mjs + native/Recognize.swift: localhost-only server, bounded image input, temporary OCR files cleaned, request origin checks, OCR unavailable errors. Compile and run native recognition with a real local image; keep transcript review mandatory.
5. Offline manifest/service worker + CI + docs/art: check offline boot, packaging, README screenshot/demo and independent whole-product review. Fix findings; rerun relevant checks.
6. Close core fidelity gap: quiet ink suggestions and explicit reviewed adoption, stale-result cancellation, bounded saved local tutor with installed-local-model filtering. Reproduce review findings and verify native OCR/model output separately from fixture UI tests.
7. GitHub repository, version tag/release, Pages workflow. Verify remote links and deployment, save final receipt in TASK_STATE.md.
