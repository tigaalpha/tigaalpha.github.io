// เซิร์ฟเวอร์สำหรับรันในเครื่อง (local dev) — ไม่ใช้ตอน deploy บน Vercel (Vercel ใช้
// api/*.js เป็น serverless function โดยตรง และเสิร์ฟไฟล์ static เองโดยอัตโนมัติ)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, models } from './lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3210;

const STATIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/style.css': 'style.css',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function readJsonBody(req) {
  return new Promise((resolvePromise, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) req.destroy(new Error('request body ใหญ่เกินไป'));
    });
    req.on('end', () => {
      try {
        resolvePromise(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  const file = STATIC_FILES[req.url];
  if (!file) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try {
    const data = await readFile(join(__dirname, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end(`Error: ${err.message}`);
  }
}

async function handleChat(req, res) {
  try {
    const body = await readJsonBody(req);
    const result = await chat(body);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function handleModels(req, res) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(models()));
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return void handleChat(req, res);
  if (req.method === 'GET' && req.url === '/api/models') return void handleModels(req, res);
  if (req.method === 'GET') return void serveStatic(req, res);
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`TIGACODE web กำลังทำงานที่ http://localhost:${PORT}`);
});
