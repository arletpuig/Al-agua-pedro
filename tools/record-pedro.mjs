// Graba las animaciones de Pedro a vídeo (MP4) o saca fotogramas sueltos para revisar.
//   node tools/record-pedro.mjs                    -> .build/pedro/<clip>.mp4 para todas
//   node tools/record-pedro.mjs idle catchNose     -> solo esas
//   node tools/record-pedro.mjs --stills catchNose 0.5 1 2   -> PNG de esos instantes
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '.build/pedro'); fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.woff2': 'font/woff2', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => m.type() === 'error' && console.error('console:', m.text()));
await page.goto(`http://localhost:${port}/tools/pedro-demo.html?manual`);
await page.waitForFunction(() => window.ready === true);
const grab = async (clip, t, type = 'image/png') => Buffer.from((await page.evaluate(([c, tt, ty]) => { window.frame(c, tt); return document.getElementById('c').toDataURL(ty, 0.94); }, [clip, t, type])).split(',')[1], 'base64');

const args = process.argv.slice(2);
if (args[0] === '--stills') {
  const clip = args[1];
  for (const t of args.slice(2).map(Number)) { const f = path.join(OUT, `${clip}-${t}.png`); fs.writeFileSync(f, await grab(clip, t)); console.log(f); }
} else {
  const clips = args.length ? args : ['idle', 'catchNose', 'peineta'];
  const FPS = Number(process.env.FPS || 60);
  for (const clip of clips) {
    const dur = await page.evaluate(c => window.clipDur(c), clip);
    const file = path.join(OUT, `${clip}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) { const buf = await grab(clip, i / FPS, 'image/jpeg'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(file, n, 'fotogramas');
  }
}
await browser.close(); server.close();
