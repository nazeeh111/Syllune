<p align="center"><img src="docs/assets/banner.svg" alt="Syllune. Make the next step click. Private ink, exact checks, practice that sticks." width="100%"></p>

<p align="center"><a href="https://nazeeh111.github.io/Syllune/">Open the studio</a> · <a href="https://github.com/nazeeh111/Syllune/releases/latest">Download</a> · <a href="docs/CHECKING.md">Checking guide</a> · <a href="docs/PRIVACY.md">Privacy & recovery</a></p>
<p align="center"><a href="https://github.com/nazeeh111/Syllune/actions/workflows/release.yml"><img src="https://github.com/nazeeh111/Syllune/actions/workflows/release.yml/badge.svg" alt="Verification and deployment status"></a> <img src="https://img.shields.io/badge/license-MIT-153f37" alt="MIT license"> <img src="https://img.shields.io/badge/runtime_dependencies-0-153f37" alt="Zero runtime dependencies"></p>

**Syllune is a private math studio by Nazeeh.** Write by hand, keep your thinking intact, and find the first step that needs another look. Turn that moment into a useful practice session.

<p align="center"><img src="docs/assets/demo.gif" alt="Actual Syllune workflow: catch a sign error, correct the steps, practice with hints and inspect real progress." width="100%"></p>

### A studio that stays out of your way

- **Ink that belongs to you.** Pressure-aware pen, eraser, selection and movement, undo/redo, paper styles, images and page zoom. Organize notebooks and rename pages.
- **Checks you can inspect.** Exact arithmetic compares supported steps, locates the first incorrect or unverified transition, explains the limit, and leaves later work untouched.
- **Practice with a purpose.** Five topic families, progressive hints, worked solutions, real attempt history and spaced review dates. Mistakes lead directly to a relevant topic.
- **On-device recognition.** The optional Mac companion uses Apple Vision. Review its editable transcript before checking. No model key, paid API or cloud upload.
- **A durable workspace.** Local autosave, a single saving tab, validated backups, non-destructive imports, PNG export and browser Print / PDF. Corrupt storage pauses saving and preserves original bytes.
- **Quiet by design.** Optional checks after a typing pause, focus timer, light/dark themes, responsive layouts, keyboard controls and offline use after the first successful load.

### Start in seconds

The [hosted studio](https://nazeeh111.github.io/Syllune/) works immediately with ink, typed checks and practice. An account is unnecessary. Install it using your browser’s app/install option when supported.

For the local companion, install **Node.js 22 or newer**, then:

```sh
git clone https://github.com/nazeeh111/Syllune.git
cd Syllune
npm start
```

Open **http://127.0.0.1:4319**. No `npm install` is needed to run the app.

Mac recognition additionally needs macOS with Apple Vision and Xcode Command Line Tools (`xcode-select --install`). Click **Read ink**, check the recognized symbols, then **Check my steps**. The first recognition request compiles the small native helper locally. Windows and Linux support the complete ink/typed-check/practice workflow; native recognition is unavailable there. The hosted app does not connect to your localhost companion.

### What a check means

Syllune supports exact rational arithmetic, polynomial expressions in **x** through degree 8, linear and quadratic equations over the real numbers, and polynomial derivatives written as `d/dx(...)`.

```text
2x + 6 = 14
2x = 8
x = 4
```

Both transitions hold. Changing the second line to `2x = 20` flags that line. `x^2 = 4` followed only by `x = 2` flags a lost solution; use `x = -2 or x = 2`.

**Unverified means unverified.** General trigonometry, variable denominators, inequalities, multiple variables and nonproportional higher-degree equations need a broader solver. Syllune compares the lines you provide; it does not prove that the starting problem was transcribed correctly. OCR confidence is not mathematical certainty. Read [the full checking guide](docs/CHECKING.md).

### Keep your work portable

Use **Settings & backups → Export backup** before clearing browser data or changing devices. Import adds copies of notebooks and retains existing notebooks. PNG export contains ink and images; Print / PDF uses the current page. Hosted and local studios have separate browser storage. Private browsing and storage quotas can limit persistence. See [privacy and recovery](docs/PRIVACY.md).

<p align="center"><img src="docs/assets/studio.png" alt="Syllune’s ink notebook and step feedback, with an explicitly labeled example." width="100%"></p>

### Develop and verify

```sh
npm test
npm run check
# Optional browser test tooling:
npm ci
npx playwright install chromium
npm run test:browser
```

`npm test` covers exact checking, all 504 generator seed residues across five topics, backup validation, stale-save protection and local HTTP boundaries. The browser suite exercises drawing/history/selection, images, exports, persistence, practice, backup import, multi-tab protection, malformed-storage recovery, offline checking and mobile layout. GitHub Actions repeats these checks before publishing Pages. See [verification evidence](docs/VERIFICATION.md).

```text
web/engine.js       exact rational polynomial checker
web/ink.js          pressure ink, selection and page history
web/storage.js      bounded versioned snapshots and safe imports
web/practice.js     exercises, hints and review scheduling
web/app.js          accessible studio flows and writer lock
server.mjs          localhost server and bounded recognition API
native/Recognize.swift  on-device Apple Vision helper
```

Created by **Nazeeh**. Source and original visual assets are available under [MIT](LICENSE). Playwright is development-only tooling under Apache-2.0; Apple Vision is a system framework supplied with macOS.
