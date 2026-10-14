# Contributing

Use Node.js 22+ and keep runtime dependencies at zero unless a concrete capability justifies a change. Run npm test and npm run check. Changes to UI or persistence also need npm run test:browser after installing development dependencies and Chromium.

New mathematical syntax needs cases that fail before the implementation, domain restrictions, and an honest unverified path. Never replace exact comparisons with a few numerical samples while retaining “exact” copy.

For notebook changes, maintain backup compatibility or add an explicit versioned migration. Preserve original bytes on failure. For a new release, bump package.json and the service-worker cache version together and rerun offline checks.

Keep controls accessible, support reduced motion and mobile layouts, and use textContent for untrusted notebook text. The local OCR endpoint must remain loopback-only and bounded. Never add telemetry or a paid/model-key requirement to the core studio.
