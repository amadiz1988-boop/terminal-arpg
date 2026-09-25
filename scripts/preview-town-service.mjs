// Local-only preview server for the town-service prototype.
//   node scripts/preview-town-service.mjs [--port 8799] [--private-public <dir>]
// Serves this checkout's Dashboard and public/ tree. Private runtime art that
// is not materialized here may be read from another checkout's public/ tree
// (read-only). /api/* never reaches a real server.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const port = Number(option('--port', 8799));
const dashboardRoot = join(root, 'ops', 'ro-stack', 'dashboard');
const publicRoots = [join(root, 'public'), option('--private-public', null)].filter(Boolean);
const previewRoot = join(root, 'scripts', 'preview');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.bmp': 'image/bmp', '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.bin': 'application/octet-stream', '.gz': 'application/gzip',
};

async function fromRoots(roots, relative) {
  for (const base of roots) {
    const path = normalize(join(base, relative));
    if (!path.startsWith(normalize(base))) continue;
    try { return { path, body: await readFile(path) }; } catch {}
  }
  return null;
}

const head = '<script>document.documentElement.dataset.townServicePreview="1";' +
  'localStorage.setItem("ghost-island.ui-theme.v1","default");</script>';
const tail = '<script src="/__preview/town-service-preview.js"></script>';

http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://preview');
  const send = (status, body, type = 'application/json; charset=utf-8') => {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  };
  if (url.pathname === '/api/config') {
    const schema = await import(pathToFileURL(join(dashboardRoot, 'config-schema.mjs')).href);
    const caps = await import(pathToFileURL(join(dashboardRoot, 'config-capabilities.mjs')).href);
    return send(200, JSON.stringify({ config: schema.defaultCanonicalConfig(0), migration: null,
      source: 'stored', execution: { editable: true, capabilities: caps.m1ConfigExecutionCapabilities(true, true) } }));
  }
  if (url.pathname.startsWith('/api/')) return send(401, '{"error":"preview"}');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    let html = await readFile(join(dashboardRoot, 'index.html'), 'utf8');
    html = html.replace('<head>', '<head>' + head).replace('</body>', tail + '</body>');
    return send(200, html, mime['.html']);
  }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const hit = relative.startsWith('__preview/')
    ? await fromRoots([previewRoot], relative.slice('__preview/'.length))
    : relative.startsWith('ro/')
      ? await fromRoots(publicRoots, relative)
      : await fromRoots([dashboardRoot], relative);
  if (!hit) return send(404, '{"error":"not_found"}');
  return send(200, hit.body, mime[extname(hit.path).toLowerCase()] ?? 'application/octet-stream');
}).listen(port, '127.0.0.1', () => console.log(`TOWN_SERVICE_PREVIEW http://127.0.0.1:${port}/`));
