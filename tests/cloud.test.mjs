// Prueba de extremo a extremo de la parte online: el juego real contra las funciones SQL reales (supabase/schema*.sql)
// en un PostgreSQL local que hace de Supabase. Preparación: sh tests/pg-reset.sh   Ejecución: node tests/cloud.test.mjs
import { execFileSync } from 'node:child_process';
import { launch, devices, check, summary, watchErrors, open, tap, S, stopAt, idle, SB, madrid, noCombo, URL_LOGIN, blockAds } from './helpers.mjs';
const psql = (sql, role, uid) => execFileSync('psql', ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '5433', '-U', 'postgres', '-d', 'aap', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
  (role ? `set role ${role}; ` : '') + (uid ? `set request.jwt.claim.sub = '${uid}'; ` : '') + sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lit = v => typeof v === 'number' ? String(v) : v === null ? 'null' : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const COMPOSITE = new Set(['save_progress', 'upgrade_card', 'import_guest', 'claim_ad_reward', 'update_profile', 'set_title']);
const users = new Map(); // token -> usuario
const payRequests = [];
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
      if (p === '/auth/v1/user') return me ? json(200, me) : json(401, { msg: 'invalid token' });
      if (p === '/auth/v1/settings') return json(200, { external: { google: true, email: true } });
      // pagos: la función crear-pago (simulada) y la consulta de compras. El «webhook» se simula entregando el pack con la clave de servicio.
      if (p === '/functions/v1/crear-pago') {
        if (!me) return json(401, { message: 'Necesitas iniciar sesión para comprar' });
        payRequests.push(body);
        psql(`select public.grant_pack('cs_test_e2e', '${me.id}', ${lit(body.pack)}, 299, 'eur')`, 'service_role');
        return json(200, { url: 'http://localhost:8080/?debug&pago=ok&sesion=cs_test_e2e' });
      }
      if (p === '/rest/v1/purchases') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.purchases x where stripe_session = ${lit((u.searchParams.get('stripe_session') || '').replace(/^eq\./, ''))}`, 'authenticated', me?.id)));
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
const page = await ctx.newPage(); const errors = watchErrors(page); await bridge(page); await open(page, URL_LOGIN);
const txt = s => page.locator(s).innerText();
const email = `arlet${Date.now()}@test.com`;
const openChestUI = async sel => { await page.click(sel); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await page.click('#chest-btn'); await page.waitForTimeout(400); };

console.log('A. Acceso obligatorio: un jugador de antes (con partida en el navegador) crea su cuenta');
await page.evaluate(() => { AAP.giftTest.off = true; });   // el regalo de bienvenida se prueba en el apartado I
check('sin sesión no se puede jugar: pantalla de cuenta obligatoria', await page.evaluate(() => document.querySelector('#panel-account').classList.contains('forced') && document.querySelector('#panel-account').classList.contains('open')));
// partida guardada en el navegador de una versión anterior (sin cuenta)
await page.evaluate(() => { AAP.state.tutorialSeen = true; }); await noCombo(page);
await tap(page, 400); await page.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(page, 0, 10); await idle(page);
let s = await S(page); check('partida local: 400 clics, 1 caída, 1 peseta (+10 del regalo)', s.totalClicks === 400 && s.falls === 1 && s.pesetas === 11);
await page.click('.tab-s[data-tab="register"]');
await page.fill('#form-register [name=username]', 'Arlet'); await page.fill('#form-register [name=email]', email); await page.fill('#form-register [name=password]', 'secreto1'); await page.click('#form-register button'); await page.waitForTimeout(1200);
let row = db(email);
check('registro crea el perfil con el nombre y abre el juego', row.username === 'Arlet' && (await page.locator('#acc-short').textContent()) === 'Arlet' && !(await page.evaluate(() => document.querySelector('#panel-account').classList.contains('open'))));
check('el progreso de invitado (con el regalo) se importa a la cuenta', +row.total_clicks === 400 && row.falls === 1 && row.pesetas === 11 && row.tomatoes === 6, JSON.stringify({ c: row.total_clicks, f: row.falls, p: row.pesetas, t: row.tomatoes }));
await page.waitForSelector('#panel-profile.open', { timeout: 3000 }).catch(() => {});
check('la primera vez se invita a elegir bandera', await page.evaluate(() => document.querySelector('#panel-profile').classList.contains('open')));
await page.click('#flag-grid [data-flag="vox"]'); await page.waitForTimeout(600);
check('la bandera se guarda en el servidor y se ve en la pestaña', db(email).avatar === 'vox' && (await page.locator('#tab-av').innerHTML()).includes('#63be21') && !(await page.locator('#toast').innerText()).includes('No se ha podido'));
psql(`insert into auth.users (email, raw_user_meta_data) values ('rival${Date.now()}@test.com', '{"username":"Rival Fuerte"}')`);
await page.fill('#name-input', 'rival fuerte'); await page.click('#form-name button'); await page.waitForTimeout(600);
check('nombre ya cogido: rechazado con aviso', db(email).username === 'Arlet' && (await page.locator('#toast').innerText()).includes('ya lo tiene otro'));
await page.fill('#name-input', 'Arlet'); await page.click('#panel-profile [data-close]'); await page.waitForTimeout(200);

console.log('B. Guardado automático validado');
await tap(page, 400); await page.waitForTimeout(5200); row = db(email); s = await S(page);
check('autoguardado: el servidor tiene los 800 clics (200 por tomate)', +row.total_clicks === 800 && row.tomatoes_earned === 9 && s.totalClicks === 800);
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
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300);
await openChestUI('[data-daily]'); row = db(email); s = await S(page);
check('cofre diario: fecha del servidor guardada', row.daily_claimed_on === madrid(new Date()) && row.chests_opened === 1);
check('cartas y tomates del cofre iguales en cliente y servidor', Object.keys(s.cards).every(k => s.cards[k].level === row.cards[k].level && s.cards[k].frags === row.cards[k].frags) && Object.values(s.cards).some(c => c.level > 0 || c.frags > 0) && s.tomatoes === row.tomatoes && s.chestTomatoes === row.chest_tomatoes, `(tomates ${s.tomatoes}/${row.tomatoes})`);
check('segundo cofre diario rechazado por el servidor', await page.evaluate(() => AAP.backend.claimDaily().then(() => false, e => e.message.includes('Ya has reclamado'))));
check('cofre sin pesetas rechazado por el servidor', await page.evaluate(() => AAP.backend.openChest('diamond').then(() => false, e => e.message.includes('pesetas suficientes'))));
// pesetas legítimas (simuladas en la base de datos) y recarga
psql(`update public.profiles set falls = 300, hits = 300, perfects = 300, tomatoes_thrown = 300, total_clicks = 80000, pesetas_earned = 300, cards = jsonb_set(jsonb_set(cards, '{inflacion}', '{"level":1,"frags":4}'), '{mariscada}', '{"level":2,"frags":0}') where user_id = '${row.user_id}'`);
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready && AAP.state.stats.falls === 300, null, { timeout: 15000 }); await page.waitForTimeout(400);
check('la sesión se restaura y carga el progreso de la cuenta', (await S(page)).pesetas === db(email).pesetas && (await page.locator('#acc-short').textContent()) === 'Arlet');
let before = db(email);
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300); await openChestUI('[data-buy="diamond"]'); row = db(email); s = await S(page);
check('cofre de diamante en servidor: -40 pesetas, 3+ cartas', row.pesetas_spent === before.pesetas_spent + 40 && row.chests_opened === before.chests_opened + 1 && s.pesetas === row.pesetas);
await openChestUI('[data-buy="wood"]'); row = db(email); s = await S(page);
check('cofre de madera en servidor: -8 pesetas', row.pesetas_spent === before.pesetas_spent + 48 && s.pesetas === row.pesetas && s.tomatoes === row.tomatoes, JSON.stringify({ spent: [before.pesetas_spent, row.pesetas_spent], pes: [s.pesetas, row.pesetas], tom: [s.tomatoes, row.tomatoes] }));
await page.click('#panel-shop .close');

console.log('E. Mejora de cartas en el servidor');
before = db(email); await page.click('#tabs [data-panel="cards"]'); await page.waitForTimeout(300);
const cost = await page.evaluate(() => AAP.E.upgradeCost('inflacion', AAP.state.cards.inflacion.level, AAP.state.cards));
await page.click('[data-upgrade="inflacion"]'); await page.waitForTimeout(700); row = db(email); s = await S(page);
check('mejora validada: nivel +1, precio con descuento de Mariscada idéntico en cliente y servidor', row.cards.inflacion.level === before.cards.inflacion.level + 1 && row.pesetas_spent === before.pesetas_spent + cost && s.pesetas === row.pesetas, `(coste ${cost})`);
check('mejora imposible rechazada', await page.evaluate(() => AAP.backend.upgradeCard('amnistia').then(() => AAP.state.cards.amnistia.level === 0 ? false : 'ok', e => true)));
await page.click('#panel-cards .close');
check('sin anuncios aprobados, el servidor no concede vídeos', (() => { try { psql(`select public.claim_ad_reward('sobre', 'x')`, 'authenticated', row.user_id); return false; } catch (e) { return /no están disponibles/.test(String(e.stderr)); } })());
psql(`update public.aap_config set value = 'true' where key = 'rewarded_ads'`);   // como cuando Google apruebe los anuncios
await page.evaluate(async () => { const m = await import('./js/ads.js'); m.DEMO_AD.seconds = 1; m.adsTest.on = true; });
before = db(email); await page.evaluate(() => AAP.backend.watchAd('sobre')); await page.waitForTimeout(400); row = db(email); s = await S(page);
check('Sobre de la Moncloa en el servidor: +25 pesetas', row.chest_pesetas === before.chest_pesetas + 25 && s.pesetas === row.pesetas, `(${before.pesetas} → ${row.pesetas})`);
await page.evaluate(() => AAP.backend.watchAd('falcon')); await page.waitForTimeout(400);
check('El Falcón en el servidor (y no se puede repetir mientras dura)', !!db(email).falcon_until && await page.evaluate(() => AAP.backend.watchAd('falcon').then(() => false, e => /ya está en marcha/.test(e.message))));
psql(`update public.profiles set ad_claims = jsonb_build_object('day', ((now() at time zone 'Europe/Madrid')::date)::text, 'sobre', 10), falcon_until = null where user_id = '${row.user_id}'`);
check('límite diario de sobres', (() => { try { psql(`select public.claim_ad_reward('sobre', 'x')`, 'authenticated', row.user_id); return false; } catch (e) { return /Vuelve mañana/.test(String(e.stderr)); } })());
await page.evaluate(async () => { AAP.state.falconUntil = 0; (await import('./js/ads.js')).adsTest.on = false; });
psql(`update public.aap_config set value = 'false' where key = 'rewarded_ads'`);

console.log('I. Título del perfil y regalo de bienvenida en el servidor');
await page.click('#tabs [data-panel="profile"]'); await page.waitForTimeout(400);
await page.fill('#title-input', 'Azote de Ferraz'); await page.click('#form-title button'); await page.waitForTimeout(600);
check('el título se guarda en el servidor', db(email).title === 'Azote de Ferraz' && (await page.locator('#prof-title').textContent()) === 'Azote de Ferraz');
await page.click('#panel-profile [data-close]');
psql(`update public.profiles set welcome_offered_at = null, welcome_claimed = false where user_id = '${row.user_id}'`);
await page.evaluate(async () => { AAP.state.welcomeClaimed = false; AAP.state.welcomeOfferedAt = null; AAP.giftTest.off = false; });
await page.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(page, 0, 10); await idle(page);
await page.waitForSelector('#gift-overlay.open', { timeout: 10000 }).catch(() => {});
check('tras tirar a Pedro, el servidor ofrece el regalo y empieza la cuenta atrás', !!db(email).welcome_offered_at && await page.evaluate(() => document.querySelector('#gift-overlay').classList.contains('open')));
before = db(email);
await page.click('#gift-watch', { force: true }); await page.waitForSelector('#chest-overlay.open', { timeout: 10000 }); await page.click('#chest-btn');
await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 }); await page.click('#chest-btn'); await page.waitForTimeout(500);
row = db(email); s = await S(page);
check('regalo abierto en el servidor: 50–60 pesetas y 30–40 tomates, una sola vez', row.welcome_claimed && row.chest_pesetas - before.chest_pesetas >= 50 && row.chest_pesetas - before.chest_pesetas <= 60 && row.chest_tomatoes - before.chest_tomatoes >= 30 && s.pesetas === row.pesetas && s.tomatoes === row.tomatoes, `(+${row.chest_pesetas - before.chest_pesetas} pesetas)`);
check('abrirlo otra vez: rechazado por el servidor', await page.evaluate(() => AAP.backend.claimWelcome().then(() => false, e => /Ya has abierto/.test(e.message))));
await page.evaluate(() => { AAP.giftTest.off = true; });

console.log('J. Packs de pesetas con pago (Stripe simulado)');
await page.evaluate(async () => { (await import('./js/config.js')).CONFIG.PAYMENTS = true; });
before = db(email);
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(400); await page.click('.pack.maletin .pk-buy', { force: true }); await page.waitForTimeout(300);
check('elegir pack abre la compra, con el botón de pagar bloqueado hasta aceptar las condiciones', await page.evaluate(() => document.querySelector('#pay-overlay').classList.contains('open')) && await page.locator('#pay-go').isDisabled() && (await txt('#pay-price')) === '3,99 €');
await page.check('#pay-ok'); await page.click('#pay-go', { force: true });
await page.waitForURL(/localhost:8080\/\?debug/, { timeout: 15000 }); await page.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 });
await page.waitForFunction(() => /YA ES TUYO/.test(document.querySelector('#paid-title')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
row = db(email); s = await S(page);
check('la compra se pide al servidor con la sesión del jugador y el pack elegido', payRequests.length === 1 && payRequests[0].pack === 'maletin' && /^http:\/\/localhost:8080\//.test(payRequests[0].returnUrl), JSON.stringify(payRequests));
check('al volver del pago (Caso Koldo): +1.750 pesetas y +700 tomates, en el servidor y en el juego', row.chest_pesetas === before.chest_pesetas + 1750 && row.chest_tomatoes === before.chest_tomatoes + 700 && s.pesetas === row.pesetas, `(${before.pesetas} → ${row.pesetas})`);
check('pantalla «¡YA ES TUYO!» y la dirección queda limpia', /YA ES TUYO/.test(await txt('#paid-title')) && !page.url().includes('pago='), page.url());
check('el pago solo se entrega una vez', psql(`select public.grant_pack('cs_test_e2e', '${row.user_id}', 'maletin', 299, 'eur')`, 'service_role') === 'f' && db(email).chest_pesetas === row.chest_pesetas);
check('un jugador no puede entregarse pesetas a sí mismo', (() => { try { psql(`select public.grant_pack('cs_trampa', '${row.user_id}', 'camara', 0, 'eur')`, 'authenticated', row.user_id); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());
await page.click('#paid-ok', { force: true });
before = db(email);
psql(`select public.grant_pack('cs_test_psoe', '${row.user_id}', 'camara', 995, 'eur')`, 'service_role');
row = db(email);
const premium = JSON.parse(psql(`select reward from public.purchases where stripe_session = 'cs_test_psoe'`));
const fr = c => Object.values(c).reduce((a, x) => a + x.level * 100 + x.frags, 0);
check('Financiación ilegal PSOE: +5.000 pesetas, +2.000 tomates y 4 cartas épicas o legendarias', row.chest_tomatoes === before.chest_tomatoes + 2000 && row.chest_pesetas >= before.chest_pesetas + 5000
  && premium.cards.length === 4 && premium.cards.every(c => ['epic', 'legendary'].includes(c.rarity)) && fr(row.cards) > fr(before.cards), JSON.stringify(premium.cards.map(c => c.id)));

console.log('F. Ranking');
await page.click('#tabs [data-panel="rank"]'); await page.waitForTimeout(700); const rank = await txt('#rank-list');
check('ranking por tomates históricos con el jugador', rank.includes('Arlet') && rank.includes(String(db(email).tomatoes_earned.toLocaleString('es-ES'))), rank.replace(/\n/g, ' ').slice(0, 80));
await page.screenshot({ path: 'tests/out/12-ranking.png' }); await page.click('#panel-rank .close');

console.log('G. Cerrar sesión y entrar desde otro dispositivo');
const final = db(email);
await page.click('#tabs [data-panel="profile"]'); await page.waitForTimeout(400); await page.click('#btn-logout'); await page.waitForTimeout(600); s = await S(page);
check('al cerrar sesión el progreso local queda a cero y vuelve la pantalla de cuenta', s.totalClicks === 0 && s.pesetas === 0 && (await page.locator('#acc-short').textContent()) === 'Invitado' && await page.evaluate(() => document.querySelector('#panel-account').classList.contains('forced')));
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p2 = await ctx2.newPage(); const errors2 = watchErrors(p2); await bridge(p2); await open(p2, URL_LOGIN);
await p2.fill('#form-login [name=email]', email); await p2.fill('#form-login [name=password]', 'mal'); await p2.click('#form-login button'); await p2.waitForTimeout(500);
check('contraseña incorrecta: mensaje claro', (await p2.locator('#acc-msg').innerText()).includes('incorrectos'));
await p2.fill('#form-login [name=password]', 'secreto1'); await p2.click('#form-login button'); await p2.waitForTimeout(1200); s = await S(p2);
check('otro dispositivo: mismo progreso (tomates, pesetas, cartas)', s.totalClicks === +final.total_clicks && s.pesetas === final.pesetas && s.tomatoes === final.tomatoes && s.cards.inflacion.level === final.cards.inflacion.level, JSON.stringify({ c: [s.totalClicks, final.total_clicks], p: [s.pesetas, final.pesetas], t: [s.tomatoes, final.tomatoes], l: [s.cards.inflacion.level, final.cards.inflacion.level] }));
console.log('H. Entrar con Google');
const gid = psql(`insert into auth.users (email, raw_user_meta_data) values ('pepe${Date.now()}@gmail.com', '{"full_name":"Pepe Google","name":"Pepe Google"}') returning id`);
users.set('tok-google', { id: gid, email: 'pepe@gmail.com', user_metadata: { full_name: 'Pepe Google' } });
const ctx3 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p3 = await ctx3.newPage(); const errors3 = watchErrors(p3); await bridge(p3);
await blockAds(p3); await p3.goto(URL_LOGIN + '#access_token=tok-google&refresh_token=ref&expires_in=3600&token_type=bearer');
await p3.waitForFunction(() => window.AAP?.scene?.ready && document.querySelector('#acc-short').textContent === 'Pepe Google', null, { timeout: 15000 }).catch(() => {});
check('vuelta de Google: entra con el nombre de su cuenta de Google', (await p3.locator('#acc-short').textContent()) === 'Pepe Google' && !(await p3.evaluate(() => document.querySelector('#panel-account').classList.contains('open'))) && !p3.url().includes('access_token'));
await p3.waitForSelector('#panel-profile.open', { timeout: 3000 }).catch(() => {});
check('y se le invita a elegir bandera', await p3.evaluate(() => document.querySelector('#panel-profile').classList.contains('open')));
await p3.click('#flag-grid [data-flag="gadsden"]'); await p3.waitForTimeout(500); await p3.click('#panel-profile [data-close]');
await p3.click('#tabs [data-panel="rank"]'); await p3.waitForTimeout(700);
check('el ranking enseña la bandera de cada jugador', await p3.locator('#rank-list li .av').count() >= 2);
await p3.screenshot({ path: 'tests/out/15-ranking-banderas.png' }); await ctx3.close();
errors.push(...errors3);
check('sin errores de consola (salvo los 400 esperados)', [...errors, ...errors2].every(e => /status of 400/.test(e)), [...errors, ...errors2].filter(e => !/status of 400/.test(e)).join('|'));
await browser.close(); process.exit(summary() ? 1 : 0);
