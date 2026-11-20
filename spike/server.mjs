// 스파이크용 로컬 서버: keylog.html을 제공하고, 측정 결과(JSON)를 results/에 저장한다.
// 같은 와이파이의 태블릿에서도 접속할 수 있도록 모든 네트워크 인터페이스에서 대기한다.
// 의존성 없음 (Node 18+).
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(ROOT, 'results');
const PAGE_PATH = path.join(ROOT, 'keylog.html');
const PORT = Number(process.env.PORT) || 5173;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function safeLabel(label) {
  const cleaned = String(label ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return cleaned || 'device';
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) {
      throw Object.assign(new Error('upload too large'), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleUpload(req, res) {
  const raw = await readBody(req);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.events)) {
    sendJson(res, 400, { ok: false, error: 'events array missing' });
    return;
  }
  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${safeLabel(data.label)}-${stamp}.json`;
  await writeFile(path.join(RESULTS_DIR, file), JSON.stringify(data, null, 1), 'utf8');
  process.stdout.write(`[upload] ${file} 저장 (이벤트 ${data.events.length}개)\n`);
  sendJson(res, 200, { ok: true, file });
}

async function handlePage(res) {
  const html = await readFile(PAGE_PATH);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/keylog.html')) {
      await handlePage(res);
    } else if (req.method === 'POST' && url.pathname === '/upload') {
      await handleUpload(req, res);
    } else {
      sendJson(res, 404, { ok: false, error: 'not found' });
    }
  } catch (err) {
    const status = err.status ?? 500;
    process.stderr.write(`[error] ${req.method} ${url.pathname}: ${err.message}\n`);
    if (!res.headersSent) sendJson(res, status, { ok: false, error: status === 413 ? 'too large' : 'server error' });
  }
});

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`키 입력 측정 서버 실행 중\n`);
  process.stdout.write(`  PC:     http://localhost:${PORT}/\n`);
  for (const ip of lanAddresses()) process.stdout.write(`  태블릿: http://${ip}:${PORT}/\n`);
});
