// Prueba de extremo a extremo de la parte online: el juego real contra las funciones SQL reales (supabase/schema*.sql)
// en un PostgreSQL local que hace de Supabase. Preparación: sh tests/pg-reset.sh   Ejecución: node tests/cloud.test.mjs
import { execFileSync } from 'node:child_process';
import { launch, devices, check, summary, watchErrors, open, tap, S, stopAt, idle, SB, madrid, noCombo } from './helpers.mjs';
const psql = (sql, role, uid) => execFileSync('psql', ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '5433', '-U', 'postgres', '-d', 'aap', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
  (role ? `set role ${role}; ` : '') + (uid ? `set request.jwt.claim.sub = '${uid}'; ` : '') + sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lit = v => typeof v === 'number' ? String(v) : v === null ? 'null' : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const COMPOSITE = new Set(['save_progress', 'upgrade_card', 'import_guest', 'claim_ad_reward']);
const users = new Map(); // token -> usuario
const calls = [];
// Puente PostgREST/GoTrue mínimo sobre PostgreSQL
async function bridge(page) {
  await page.route(SB, async route => {
    const r = route.request(), u = new URL(r.url()), p = u.pathname, body = r.postDataJSON?.() || {}, token = (r.headers()['authorization'] || '').replace('Bearer ', ''), me = users.get(token);
    const json = (status, b) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const session = user => { const t = 'tok-' + user.id; users.set(t, user); return { access_token: t, refresh_token: 'ref', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }; };
    calls.push(r.method() + ' ' + p);
    try {
      if (p === '/auth/v1/signup') {
        if (psql(`select count(*) from auth.users where email = ${lit(body.email)}`) !== '0') return json(422, { msg: 'User already registered' });
        const id = psql(`insert into auth.users (email, raw_user_meta_data) values (${lit(body.email)}, ${lit(body.data || {})}) returning id`);
        return json(200, session({ id, email: body.email, user_metadata: body.data || {} }));
      }
      if (p === '/auth/v1/token') {
        const id = body.password === 'secreto1' ? psql(`select id from auth.users where email = ${lit(body.email)}`) : '';
        return id ? json(200, session({ id, email: body.email, user_metadata: {} })) : json(400, { msg: 'Invalid login credentials' });
      }
      if (p === '/auth/v1/logout') return json(204, {});
      if (p === '/rest/v1/profiles') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.profiles p`, 'authenticated', me?.id)));
      if (p === '/rest/v1/leaderboard') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.leaderboard l`, 'anon')));
      if (p.startsWith('/rest/v1/rpc/')) {
        const fn = p.split('/').pop(), args = Object.entries(body).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
        const sql = COMPOSITE.has(fn) ? `select to_jsonb(x) from public.${fn}(${args}) x` : `select public.${fn}(${args})`;
        return json(200, JSON.parse(psql(sql, me ? 'authenticated' : 'anon', me?.id)));
      }
      return json(404, { message: 'no route ' + p });
    } catch (e) { const m = /ERROR:\s+(.*)/.exec(String(e.stderr || e.message)); return json(400, { message: m ? m[1] : 'error' }); }
  });
}
const db = email => JSON.parse(psql(`select to_jsonb(p) from public.profiles p join auth.users u on u.id = p.user_id where u.email = ${lit(email)}`));
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errors = watchErrors(page); await bridge(page); await open(page);
const txt = s => page.locator(s).innerText();
const email = `arlet${Date.now()}@test.com`;
const openChestUI = async sel => { await page.click(sel); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await page.click('#chest-btn'); await page.waitForTimeout(400); };

console.log('A. Invitado juega y luego crea cuenta');
await page.evaluate(() => { AAP.state.tutorialSeen = true; }); await noCombo(page);
await tap(page, 250); await page.click('#throws button[data-n="1"]'); await stopAt(page, 0, 10); await idle(page);
let s = await S(page); check('invitado: 250 clics, 1 caída, 1 peseta (+10 del regalo)', s.totalClicks === 250 && s.falls === 1 && s.pesetas === 11);
const openAccount = async pg => { await pg.click('#btn-settings'); await pg.waitForTimeout(250); await pg.click('#btn-account'); await pg.waitForTimeout(250); };
await openAccount(page); await page.click('.tab-s[data-tab="register"]');
await page.fill('#form-register [name=username]', 'Arlet'); await page.fill('#form-register [name=email]', email); await page.fill('#form-register [name=password]', 'secreto1'); await page.click('#form-register button'); await page.waitForTimeout(1200);
let row = db(email);
check('registro crea el perfil con el nombre', row.username === 'Arlet' && (await txt('#acc-name')) === 'Arlet');
check('el progreso de invitado (con el regalo) se importa a la cuenta', +row.total_clicks === 250 && row.falls === 1 && row.pesetas === 11 && row.tomatoes === 6, JSON.stringify({ c: row.total_clicks, f: row.falls, p: row.pesetas, t: row.tomatoes }));
await page.click('#panel-account .close');

console.log('B. Guardado automático validado');
await tap(page, 150); await page.waitForTimeout(5200); row = db(email); s = await S(page);
check('autoguardado: el servidor tiene los 400 clics', +row.total_clicks === 400 && row.tomatoes_earned === 9 && s.totalClicks === 400);
await page.click('#throws button[data-n="3"]'); await stopAt(page, 0, 10);
await idle(page); await page.waitForTimeout(1500); row = db(email); s = await S(page);
check('lanzamiento ×3 (un tiro) guardado: 4 caídas, 14 pesetas, 5 tomates', row.falls === 4 && row.pesetas === 14 && row.tomatoes === 5 && row.perfects === 4 && s.pesetas === 14, JSON.stringify({ f: row.falls, p: row.pesetas, t: row.tomatoes }));

console.log('C. Intento de trampa desde el navegador');
await page.evaluate(async () => { const s = AAP.state.stats; s.pesetasEarned += 5000; s.totalClicks += 10000000; s.falls += 900; (await import('./js/state.js')).changed(); });
await page.waitForTimeout(5200); row = db(email); s = await S(page);
check('el servidor recorta pesetas y caídas inventadas', row.pesetas_earned <= row.falls * 3 && row.falls <= row.hits && row.hits <= row.tomatoes_thrown && row.pesetas <= 12 + 10, `(pesetas ${row.pesetas}, caídas ${row.falls})`);
check('el servidor limita los clics imposibles', +row.total_clicks < 100000, `(${row.total_clicks})`);
check('el cliente adopta los valores del servidor', s.pesetas === row.pesetas && s.totalClicks === +row.total_clicks && s.falls === row.falls);
check('escritura directa en la tabla prohibida', (() => { try { psql(`update public.profiles set pesetas_earned = 99999`, 'authenticated', row.user_id); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());

console.log('D. Cofres y cofre diario en el servidor');
await page.click('#tabs [data-panel="chests"]'); await page.waitForTimeout(300);
await openChestUI('[data-daily]'); row = db(email); s = await S(page);
check('cofre diario: fecha del servidor guardada', row.daily_claimed_on === madrid(new Date()) && row.chests_opened === 1);
check('cartas y tomates del cofre iguales en cliente y servidor', Object.keys(s.cards).every(k => s.cards[k].level === row.cards[k].level && s.cards[k].frags === row.cards[k].frags) && Object.values(s.cards).some(c => c.level > 0) && s.tomatoes === row.tomatoes && s.chestTomatoes === row.chest_tomatoes, `(tomates ${s.tomatoes}/${row.tomatoes})`);
check('segundo cofre diario rechazado por el servidor', await page.evaluate(() => AAP.backend.claimDaily().then(() => false, e => e.message.includes('Ya has reclamado'))));
check('cofre sin pesetas rechazado por el servidor', await page.evaluate(() => AAP.backend.openChest('diamond').then(() => false, e => e.message.includes('pesetas suficientes'))));
// pesetas legítimas (simuladas en la base de datos) y recarga
psql(`update public.profiles set falls = 300, hits = 300, perfects = 300, tomatoes_thrown = 300, total_clicks = 40000, pesetas_earned = 300, cards = jsonb_set(jsonb_set(cards, '{inflacion}', '{"level":1,"frags":4}'), '{mariscada}', '{"level":2,"frags":0}') where user_id = '${row.user_id}'`);
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready && AAP.state.stats.falls === 300, null, { timeout: 15000 }); await page.waitForTimeout(400);
check('la sesión se restaura y carga el progreso de la cuenta', (await S(page)).pesetas === db(email).pesetas && (await page.locator('#acc-short').textContent()) === 'Arlet');
let before = db(email);
await page.click('#tabs [data-panel="chests"]'); await page.waitForTimeout(300); await openChestUI('[data-buy="diamond"]'); row = db(email); s = await S(page);
check('cofre de diamante en servidor: -40 pesetas, 3+ cartas', row.pesetas_spent === before.pesetas_spent + 40 && row.chests_opened === before.chests_opened + 1 && s.pesetas === row.pesetas);
await openChestUI('[data-buy="wood"]'); row = db(email); s = await S(page);
check('cofre de madera en servidor: -8 pesetas', row.pesetas_spent === before.pesetas_spent + 48 && s.pesetas === row.pesetas && s.tomatoes === row.tomatoes);
await page.click('#panel-chests .close');

console.log('E. Mejora de cartas en el servidor');
before = db(email); await page.click('#tabs [data-panel="cards"]'); await page.waitForTimeout(300);
const cost = await page.evaluate(() => AAP.E.upgradeCost('inflacion', AAP.state.cards.inflacion.level, AAP.state.cards));
await page.click('[data-upgrade="inflacion"]'); await page.waitForTimeout(700); row = db(email); s = await S(page);
check('mejora validada: nivel +1, precio con descuento de Mariscada idéntico en cliente y servidor', row.cards.inflacion.level === before.cards.inflacion.level + 1 && row.pesetas_spent === before.pesetas_spent + cost && s.pesetas === row.pesetas, `(coste ${cost})`);
check('mejora imposible rechazada', await page.evaluate(() => AAP.backend.upgradeCard('amnistia').then(() => AAP.state.cards.amnistia.level === 0 ? false : 'ok', e => true)));
await page.click('#panel-cards .close');
check('anuncio: el servidor no concede nada', (() => { try { psql(`select public.claim_ad_reward('falcon', 'x')`, 'authenticated', row.user_id); return false; } catch (e) { return /no están disponibles/.test(String(e.stderr)); } })() && db(email).falcon_until === null);

console.log('F. Ranking');
await page.click('#tabs [data-panel="rank"]'); await page.waitForTimeout(700); const rank = await txt('#rank-list');
check('ranking por tomates históricos con el jugador', rank.includes('Arlet') && rank.includes(String(db(email).tomatoes_earned.toLocaleString('es-ES'))), rank.replace(/\n/g, ' ').slice(0, 80));
await page.screenshot({ path: 'tests/out/12-ranking.png' }); await page.click('#panel-rank .close');

console.log('G. Cerrar sesión y entrar desde otro dispositivo');
const final = db(email);
await openAccount(page); await page.click('#btn-logout'); await page.waitForTimeout(600); s = await S(page);
check('al cerrar sesión el progreso local queda a cero', s.totalClicks === 0 && s.pesetas === 0 && (await page.locator('#acc-short').textContent()) === 'Invitado');
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p2 = await ctx2.newPage(); const errors2 = watchErrors(p2); await bridge(p2); await open(p2);
await openAccount(p2); await p2.fill('#form-login [name=email]', email); await p2.fill('#form-login [name=password]', 'mal'); await p2.click('#form-login button'); await p2.waitForTimeout(500);
check('contraseña incorrecta: mensaje claro', (await p2.locator('#acc-msg').innerText()).includes('incorrectos'));
await p2.fill('#form-login [name=password]', 'secreto1'); await p2.click('#form-login button'); await p2.waitForTimeout(1200); s = await S(p2);
check('otro dispositivo: mismo progreso (tomates, pesetas, cartas)', s.totalClicks === +final.total_clicks && s.pesetas === final.pesetas && s.tomatoes === final.tomatoes && s.cards.inflacion.level === final.cards.inflacion.level);
check('sin errores de consola (salvo los 400 esperados)', [...errors, ...errors2].every(e => /status of 400/.test(e)), [...errors, ...errors2].filter(e => !/status of 400/.test(e)).join('|'));
await browser.close(); process.exit(summary() ? 1 : 0);
