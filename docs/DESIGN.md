# Syllune design

A private handwritten-math studio by Nazeeh. Primary job: preserve a student's work, locate the first unsupported or incorrect transition, explain it without taking over, and turn mistakes into useful practice.

## Product
- Ink workspace with pen pressure, eraser, selection/move, undo/redo, page switching, paper styles, image insertion and PNG export.
- Editable line transcript. Exact rational polynomial arithmetic checks expressions, linear/quadratic equation solution sets, and polynomial derivatives. Unsupported syntax or high-degree nonproportional equations stays unverified. A successful finite check is never described as universal correctness.
- Quiet ink reads use cancellable local recognition after a writing pause, flag possible issues by OCR region and require reviewed adoption before replacing a transcript. Optional local tutor uses installed local Ollama models for fallible broader guidance, separate from exact checks.
- Optional local Mac companion uses Apple Vision for OCR, returning editable text. Recognition is explicitly fallible; student reviews it before checking. No cloud processing, paid API or model credentials.
- Notebook/page data autosaves locally. Schema validation, bounded input, export/import backup, visible storage errors, non-destructive import and recovery handling preserve work.
- Practice in linear equations, quadratic equations, expansion, fractions and polynomial derivatives. Progressive hints, explanation, attempt history and review scheduling. Real attempts only drive progress.
- Focus timer, dark/light themes, keyboard shortcuts, responsive layouts, semantic controls, reduced motion and screen-reader feedback. Installable offline app; local storage remains device/browser-specific.

## Architecture
ES modules in web/, no runtime npm dependencies. engine.js owns exact checks; practice.js owns problem generation/scheduling; storage.js owns validated snapshots; ink.js owns drawing/history; app.js connects accessible UI. server.mjs serves local app and bounded local OCR API; native/Recognize.swift owns OCR. Static hosting excludes native features and presents that limit clearly.

## Release contract
Original source and art. MIT license, clear capability limits, installation, privacy, recovery, contribution guidance, screenshots and recorded demo. GitHub Actions runs domain tests and publishes static app via Pages. Verify repository identity, tests, real browser flows and remote release state before reporting completion.
