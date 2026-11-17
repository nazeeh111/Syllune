# Keep the ink. Check the transcript.

An actual local journey recorded 17 November 2026 on source [`62811f5`](https://github.com/nazeeh111/Syllune/tree/62811f5a6a36e0ac3cf62996af2c9db43d762b42), version1.0.3-dev.1. The [responsive worked-example sheet](journey.html) combines an actual ink export with observed recognition and exact-check results. It is an explanatory composition, not a screenshot of an invented UI.

[Open the synthetic editable notebook](worked-notebook.json) · [Exact execution record](journey.json) · [Full untouched ink PNG](worked-ink.png) · [Current studio](https://nazeeh111.github.io/Syllune/)

## One error, three different kinds of evidence

The real **Try an example** control creates26 editable strokes and this typed transcript:

```text
2x + 6 = 14
2x = 20
x = 10
```

The ink is supplied by the bundled example; it is not a recording of a person's handwriting. The typed checker marks step2 as incorrect because the real solution set changes from {4} to {10}. It keeps step3 visible but blocks a green verdict until the earlier problem is resolved. The starting line is never established as the correct problem statement.

### Recognition needs a review

In the actual Mac companion, **Read ink** ran the repository's Swift helper against the synthetic page through Apple Vision. It returned:

```text
2X+6=14
2Х=20
Х=10
```

The last two lines contain Cyrillic **Х, U+0425**, rather than Latin x/X. Apple Vision reported confidence1 on each line. Raw recognized text therefore remains outside this checker's supported notation; the raw checker result is preserved in `journey.json`. Confidence is not mathematical certainty, and one reading is not an OCR accuracy study.

The app kept the existing transcript until explicit reviewed adoption. In **Review the transcript**, we manually used Latin x, chose **Use reviewed transcript**, confirmed replacement, and checked the resulting text. No recognition transport was substituted, no tutor model or provider service was called, and no user ink was used. Native helper compilation occurred only in this isolated checkout's ignored cache.

The hosted studio supports typed checking and ink, but does not connect to the localhost companion. Native recognition additionally requires macOS/Apple Vision and Command Line Tools. The complete typed/correction/practice/backup journey needs neither recognition nor a model.

### Exact checking belongs to reviewed text

**Edit step2** selected exactly `2x = 20` in the transcript. We changed the working to:

```text
2x + 6 = 14
2x = 8
x = 4
```

Both transitions now hold as equal real solution sets. This changes the text, **not the ink**: the original26 strokes still show the sign-error example. The PNG intentionally retains that original ink. Check and correct the page yourself when you want the ink and transcript to agree.

A separate actual `1/x` → `x/x^2` input stayed unverified because division by x can change the domain. A check is an exact comparison inside the supported language, not a general solver or a verdict on image pixels. [Full checking language, arithmetic and bounds](../CHECKING.md).

### Practice is a real attempt

From the incorrect transition, **Practice this idea** opened a linear-equation exercise. The recorded prompt was `Solve 2x + 8 = 14`; the first hint was `Subtract 8 from both sides.` Entering `x=3` produced **That clicks.** and recorded one correct attempt. Practice exercises vary; this is one observed exercise, not a fixed lesson or an educational-effectiveness result.

## Save, close, reopen

We returned to the corrected transcript, chose **Settings & backups → Export backup**, and used **Export PNG**. The actual JSON backup includes ink, corrected text and the practice attempt. The PNG contains ink/images, not the editable notebook state.

The original disposable browser context was closed. In a fresh context with empty storage, **Import backup** added a copied notebook while retaining the existing empty notebook. Selecting the imported example showed all26 identical stroke arrays, the corrected transcript and one practice attempt. Reloading retained the page; checking again produced two correct transitions. Desktop1280×1000 and375×812 light/dark phone layouts were inspected.

To repeat this portable part:

1. Download [`worked-notebook.json`](worked-notebook.json).
2. Open the hosted studio or the local companion and choose **Settings & backups → Import backup**. Imports add copies; they do not replace your notebooks.
3. Select the imported **Example · sign check** page. Its ink still shows the original sign error, while the transcript contains the reviewed correction.
4. Open **Step transcript**, choose **Check my steps**, and inspect both exact transitions.
5. Inspect **Progress** for the one retained practice attempt. Export your own backup before clearing browser storage.

Recorded artifact hashes:

| Artifact | Bytes / identity |
| --- | --- |
| Editable JSON |15,997 bytes; SHA-256 `cbf08ddbde439b12a4e93235494d303962a2832fad1391e6a6d711a6ab7e82c7` |
| Untouched PNG |SHA-256 `f6659f015d2e2372357964c25b6e6beff7f3e92eaf60a9aafac43d61f9d00933` |
| Retained editable ink |26 stroke arrays, compared exactly after import |

The backup is synthetic public example data, not a private notebook. Backups of your own work can contain private handwriting/images; use [privacy and recovery guidance](../PRIVACY.md). Browser storage is local, not encryption or a substitute for an external backup.

## Verify from source

Node22+ is sufficient to run the current app; no `npm install` is needed:

```sh
git clone https://github.com/nazeeh111/Syllune.git
cd Syllune
npm start
# Open http://127.0.0.1:4319
```

This case passed44 Node tests, the syntax/control/offline check, and the existing real-browser smoke suite. The smoke suite exercised ink/history/selection, PNG/image import, persistence, practice/progress, backup import, multi-tab guard, malformed-storage recovery, capacity, offline use and mobile layout. Recognition above was a separate real native invocation, not a fixture result. No optional tutor/model inference or future branch cancellation features were used.

The figure's editable source is [`journey.html`](journey.html); its adjacent text and JSON preserve the information beyond the PNG. The upper ink viewport is explicitly cropped by layout only; the full original exported PNG is retained unchanged. No ink pixels or mathematical outcomes were invented or enhanced. Original Syllune source/assets are MIT; Apple Vision is a macOS system framework. See [the project license](../../LICENSE) and [verification scope](../VERIFICATION.md).
