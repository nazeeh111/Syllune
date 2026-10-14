import http from 'node:http';
import { readFile, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile),
  root = dirname(fileURLToPath(import.meta.url)),
  web = resolve(root, 'web');
let compiling;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const send = (res, status, obj) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
};
async function ocrBinary() {
  if (process.platform !== 'darwin')
    throw Error(
      'Local handwriting recognition needs macOS and Apple Vision. Typed checking works on every platform.',
    );
  if (!compiling)
    compiling = (async () => {
      const dir = resolve(root, '.cache');
      await mkdir(dir, { recursive: true });
      const bin = resolve(dir, 'recognize');
      await run(
        '/usr/bin/swiftc',
        [
          resolve(root, 'native/Recognize.swift'),
          '-module-cache-path',
          resolve(dir, 'modules'),
          '-O',
          '-o',
          bin,
        ],
        { timeout: 90000, maxBuffer: 1024 * 1024 },
      );
      return bin;
    })().catch((e) => {
      compiling = null;
      throw e;
    });
  return compiling;
}
export function createAppServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    const host = req.headers.host;
    if (!host || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
      return send(res, 403, {
        error: 'This companion accepts localhost requests only.',
      });
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    } catch {
      return send(res, 400, { error: 'Invalid URL.' });
    }
    if (path === '/api/status') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' });
      return send(res, 200, {
        recognition: process.platform === 'darwin',
        engine: process.platform === 'darwin' ? 'Apple Vision' : null,
        local: true,
      });
    }
    if (path === '/api/recognize') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
      if (req.headers.origin !== `http://${host}`)
        return send(res, 403, {
          error: 'Recognition requests must come from this local app.',
        });
      if (req.headers['content-type'] !== 'image/png')
        return send(res, 415, { error: 'Send a PNG image.' });
      const chunks = [];
      let size = 0;
      try {
        for await (const part of req) {
          size += part.length;
          if (size > 8_000_000) {
            send(res, 413, { error: 'Image must be smaller than 8 MB.' });
            req.resume();
            return;
          }
          chunks.push(part);
        }
      } catch {
        return send(res, 400, { error: 'Image upload interrupted.' });
      }
      const body = Buffer.concat(chunks);
      if (
        body.length < 8 ||
        !body
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        return send(res, 400, { error: 'Invalid PNG image.' });
      let dir;
      try {
        const bin = await ocrBinary();
        dir = await mkdtemp(resolve(tmpdir(), 'syllune-'));
        const image = resolve(dir, 'page.png');
        await writeFile(image, body);
        const { stdout } = await run(bin, [image], {
          timeout: 30000,
          maxBuffer: 2_000_000,
        });
        const result = JSON.parse(stdout);
        send(res, 200, result);
      } catch (e) {
        send(res, 503, {
          error:
            process.platform === 'darwin'
              ? 'Local recognition could not finish. Ensure Xcode Command Line Tools are installed, then try again. You can edit the transcript directly.'
              : e.message,
        });
      } finally {
        if (dir) await rm(dir, { recursive: true, force: true });
      }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method))
      return send(res, 405, { error: 'Use GET.' });
    const target = resolve(web, '.' + (path === '/' ? '/index.html' : path));
    if (!target.startsWith(web + '/'))
      return send(res, 404, { error: 'Not found.' });
    try {
      const body = await readFile(target);
      res.writeHead(200, {
        'Content-Type': types[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      send(res, 404, { error: 'Not found.' });
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4319);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('PORT must be 1–65535.');
  createAppServer().listen(port, '127.0.0.1', () =>
    console.log(
      `Syllune · http://127.0.0.1:${port}\nYour writing stays on this device. Ctrl+C to stop.`,
    ),
  );
}
