// Capturas y vídeo de la propuesta de interfaz (tools/ui-propuesta.html) a 1080x1920.
//   node tools/record-ui.mjs still 1.0 principal       -> .build/ui/principal.png
//   node tools/record-ui.mjs still 1.0 cofres cofres   -> .build/ui/cofres.png (con el panel abierto)
//   node tools/record-ui.mjs video 6                   -> .build/ui/interfaz.mp4
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '.build/ui'); fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.woff2': 'font/woff2', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 1080 / 390 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://localhost:${server.address().port}/tools/ui-propuesta.html?manual`);
await page.waitForFunction(() => window.ready === true);
const shot = async (t, opts, type = 'png') => {
  await page.evaluate(([tt, o]) => window.frame(tt, o), [t, opts]);
  return page.locator('#app').screenshot({ type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
};
const [mode, a, b, c] = process.argv.slice(2);
if (mode === 'still') {
  const f = path.join(OUT, `${b || 'principal'}.png`);
  fs.writeFileSync(f, await shot(Number(a || 1), { cofres: c === 'cofres' }));
  console.log(f);
} else {
  const FPS = 30, dur = Number(a || 6), file = path.join(OUT, 'interfaz.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < dur * FPS; i++) { const buf = await shot(i / FPS, {}, 'jpeg'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(file);
}
await browser.close(); server.close();
