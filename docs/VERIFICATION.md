# Release verification

Verified locally on October 14, 2026 with Node.js 24.14.0, installed Chrome 155 and macOS. GitHub Actions also runs the portable suite on Node.js 22/Linux before Pages deployment.

| Check | Evidence |
| --- | --- |
| Domain/data/HTTP tests | 33 tests passed. Includes exact arithmetic, lost roots, unsupported syntax, every alternative after identities, malformed inputs, non-destructive backups, stale snapshots, local Host/Origin and input boundaries. |
| Practice generator | All 504 seed residues across five families produce checkable answers; correct answers pass and a distinct wrong answer fails. This covers the full parameter cycle, not arbitrary future generators. |
| Static checks | JavaScript syntax, unique control identities, manifest JSON and offline asset inventory passed. |
| Real browser suite | Ink/history/selection, PNG and image import, refresh, typed feedback, practice/progress, backup import, multi-tab guard, malformed-storage pause, offline reload/checking and mobile overflow passed in isolated Chrome. |
| Quiet ink and tutor wiring | Cancellable reads, unchanged transcripts, explicit adoption, OCR/tutor concurrency, oversize rejection, model selection and conversation persistence passed. Browser fixture transport proves wiring, not model accuracy. |
| Native recognition | Swift helper compiled. Actual example ink was recognized by Apple Vision through the local HTTP companion: 2X+6=14, 2X=20, X=10. The transcript remained editable and was not automatically treated as verified math. |
| Visual QA | Studio, practice, light/dark and 390-pixel mobile views inspected. README GIF/MP4 records real browser interactions; banner is original SVG. |
| Independent review | A fresh reviewer identified stale-tab overwrite, out-of-range derivative generation and skipped alternative validation. All were reproduced and fixed, with regression checks. A further focused review reproduced oversized OCR adoption and OCR cleanup resetting tutor state; these also received regression checks. Native visual QA found a shared-selector/overlay-height error; browser geometry checks now pin correct placement across paper styles and 50% zoom. |

## Limits

These checks establish the listed behavior on the tested environments. They do not prove general math correctness, handwriting recognition accuracy across people, or operation on every browser/device. Safari, Firefox, real stylus hardware and Windows/Linux desktop use were not manually exercised locally. The CI browser suite covers Linux Chromium. Native recognition is macOS-only and deliberately separate from static hosting. Syllune does not promise grading correctness or measured speed improvements.

Browser saves are local to an origin. Keep editable backups outside browser storage. The single-writer lock deliberately pauses saves in additional tabs. If Web Locks are unavailable, saving stays paused rather than risking conflicting writes.

Run the commands in README.md to reproduce the portable checks. macOS native OCR additionally needs Xcode Command Line Tools and a real PNG input. Remote GitHub Actions and Pages status are available from the repository’s live Actions and deployment pages.

## Added native flow evidence

The expanded studio was exercised against actual local services, without transport fixtures: Apple Vision produced an uncertain step-two ink-region flag and left the existing transcript unchanged; the installed Qwen3 4B model replied through the bounded local tutor endpoint and explained the missing 2x chain-rule factor. The reply was saved per page and visibly labeled “UNVERIFIED GUIDANCE.” No model was downloaded. This one example establishes integration and useful output, not general tutoring accuracy.

A subsequent local-model replay reached the 120-second deadline under CPU inference. The API/UI handle that case as a failed reply, preserve the pending question, and keep exact checks and ink working. A friendly-timeout regression and bounded portable-draft check cover recovery. Successful model examples do not establish reliable completion or accuracy for every question.
