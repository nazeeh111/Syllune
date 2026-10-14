# Privacy and recovery

Syllune does not create accounts, analytics events or remote math requests. The static host serves app assets and may keep its ordinary access logs. README badges are served by GitHub and Shields; those are documentation images, not requests made by the studio.

## Storage

Notebooks, ink, imported images, transcripts, practice history, settings and focus timer live in browser localStorage under syllune.workspace.v1. This is local storage, not encryption. Anyone with access to the browser profile may access the notebook. Each origin has its own storage; GitHub Pages and the local companion do not share data.

An origin-scoped Web Lock gives only one open tab permission to save. Other tabs keep their changes in memory and show “Saving paused.” Export that tab’s work before closing it. Close the writing tab and reload to resume saving. A stale-byte guard also rejects unexpected changes to persisted bytes. Current Chromium, Firefox and Safari support Web Locks in secure contexts; unsupported browsers keep work in memory and require export.

A failed save reports that the newest changes remain in memory. Export a backup before leaving. Browser data clearing, private browsing and quotas can remove or prevent persistent storage. Bounds: 50 notebooks, 200 pages per notebook, 500 pages total, 500,000 ink points, 10 images per page, 10,000 practice attempts and a 20 MB serialized workspace. Avoid using localStorage as your only long-term copy.

## Export and import

Backups are versioned JSON. Import validates structure, sizes, finite coordinates and identifiers before applying changes. It adds renamed copies with fresh identifiers and preserves current notebooks. If the merged workspace cannot be saved, the current workspace remains active. A backup carries handwriting and images; share it only with people you intend to give that data to.

PNG export is a page image. Print / PDF exports the currently selected page through your browser. Neither substitutes for an editable JSON backup.

## Recovery

Malformed stored data pauses saving instead of replacing the bytes. Export the original bytes in Settings. “Preserve old data & start fresh” first stores a recovery copy under a timestamped recovery key; if that write fails, the old workspace is not replaced. Keep an external copy. Clear recovery keys only after confirming that you have the files you need.

## Native recognition

The optional server binds only to 127.0.0.1. It accepts loopback Host values and same-origin recognition requests. PNG uploads are bounded at 8 MB. A fixed Swift helper processes a task-specific temporary file with Apple Vision, and the server deletes that temporary directory afterward. It does not send the image to a network service. The helper is compiled into ignored .cache/; it can be rebuilt from source.

Do not expose the localhost companion through a public reverse proxy. The hosted studio offers typed checks and does not call the local server. Native recognition requires macOS and Command Line Tools. Windows/Linux receive an explicit unavailable message.
