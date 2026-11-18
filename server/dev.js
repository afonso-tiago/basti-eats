import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const { handleBoard } = await import('../api/board.js');

const port = Number(process.env.PORT || 3000);
const host = process.env.BOARD_HOST || '127.0.0.1';
const root = fileURLToPath(new URL('../public', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
};

createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url, `http://${host}:${port}`);

  try {
    if (url.pathname === '/api/board') {
      const init = { method: incoming.method, headers: incoming.headers };
      if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
        init.body = Readable.toWeb(incoming);
        init.duplex = 'half';
      }
      const response = await handleBoard(new Request(url, init));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${sep}`) || !(await stat(file)).isFile()) {
      outgoing.writeHead(404).end();
      return;
    }
    outgoing.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    if (incoming.method === 'HEAD') outgoing.end();
    else createReadStream(file).pipe(outgoing);
  } catch (error) {
    if (error.code === 'ENOENT') outgoing.writeHead(404).end();
    else outgoing.writeHead(500).end();
  }
}).listen(port, host, () => console.log(`Basti Eats is running at http://${host}:${port}`));
