import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

export const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('Cache-Control', 'no-cache');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const isPdf = pathname.startsWith('/data/');
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const base = path.join(root, isPdf ? 'data' : 'public');
    const target = path.resolve(base, isPdf ? relative.slice(5) : relative);
    if (!target.startsWith(base + path.sep) || (isPdf && path.extname(target) !== '.pdf')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': content.length });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Page not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Daily Blessings is ready: http://localhost:${server.address().port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
