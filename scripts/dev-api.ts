// Локальный сервер /api для разработки: npm run dev (порт 3001), фронт: cd app && npm run dev
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const root = path.resolve('api');

// те же rewrites, что в vercel.json
const REWRITE: Record<string, string> = { hint: 'check', grade: 'check', why: 'check' };

function route(pathname: string): string | undefined {
  const rel = pathname.replace(/^\/api\/?/, '');
  if (!/^[\w-]+(\/[\w-]+)?$/.test(rel)) return;
  return [`${rel}.ts`, `${rel}/index.ts`, rel.replace(/[^/]+$/, '[code].ts')].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3001');
    const name = url.pathname.replace(/^\/api\//, '');
    if (REWRITE[name]) {
      url.pathname = `/api/${REWRITE[name]}`;
      url.searchParams.set('r', name);
    }
    const file = route(url.pathname);
    const fn = file && (require(file) as Record<string, ((r: Request) => Promise<Response>) | undefined>)[req.method ?? ''];
    if (!fn) return void res.writeHead(file ? 405 : 404, { 'content-type': 'application/json' }).end('{"error":"Нет такого адреса"}');
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const r = await fn(new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: chunks.length ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
  })
  .listen(3001, '127.0.0.1', () => console.log('API: http://localhost:3001/api/pack?v=1'));
