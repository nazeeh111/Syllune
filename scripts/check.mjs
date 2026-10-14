import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const dir of ['web', 'scripts'])
  for (const name of await readdir(root + dir))
    if (name.endsWith('.js') || name.endsWith('.mjs'))
      execFileSync(process.execPath, ['--check', root + dir + '/' + name]);
execFileSync(process.execPath, ['--check', root + 'server.mjs']);
execFileSync(process.execPath, ['--check', root + 'local-tutor.mjs']);
const html = await readFile(root + 'web/index.html', 'utf8'),
  ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) throw Error('Duplicate HTML IDs');
const app = await readFile(root + 'web/app.js', 'utf8');
for (const m of app.matchAll(/\$\('([^']+)'\)/g))
  if (!ids.includes(m[1])) throw Error('Missing HTML control ' + m[1]);
const sw = await readFile(root + 'web/sw.js', 'utf8');
for (const m of sw.matchAll(/'\.\/([^']+)'/g))
  await readFile(root + 'web/' + m[1]);
JSON.parse(await readFile(root + 'web/manifest.webmanifest', 'utf8'));
console.log(
  'PASS: syntax, HTML control identities, manifest and offline asset inventory.',
);
