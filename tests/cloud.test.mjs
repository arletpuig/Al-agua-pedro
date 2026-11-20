// Prueba de extremo a extremo de la parte online: el juego real contra las funciones SQL reales (supabase/schema*.sql)
// en un PostgreSQL local que hace de Supabase. Preparación: sh tests/pg-reset.sh   Ejecución: node tests/cloud.test.mjs
import { execFileSync } from 'node:child_process';
import { launch, devices, check, summary, watchErrors, open, tap, S, stopAt, idle, SB, madrid, noCombo, URL_LOGIN, blockAds, fakeGoogle } from './helpers.mjs';
const psql = (sql, role, uid) => execFileSync('psql', ['-h', process.env.PGHOST || '/tmp', '-p', process.env.PGPORT || '5433', '-U', 'postgres', '-d', 'aap', '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
  (role ? `set role ${role}; ` : '') + (uid ? `set request.jwt.claim.sub = '${uid}'; ` : '') + sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lit = v => typeof v === 'number' ? String(v) : v === null ? 'null' : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const COMPOSITE = new Set(['save_progress', 'buy_armory_item', 'daily_sync', 'upgrade_card', 'import_guest', 'claim_ad_reward', 'update_profile', 'set_title', 'set_region']);
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
      if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'id_token') {   // botón oficial de Google
        if (body.provider !== 'google' || body.id_token !== 'gsi-token-ok') return json(400, { msg: 'Bad ID token' });
        let id = psql(`select id from auth.users where email = 'gsi@gmail.com'`);
        if (!id) id = psql(`insert into auth.users (email, raw_user_meta_data) values ('gsi@gmail.com', '{"full_name":"Lola Google"}') returning id`);
        return json(200, session({ id, email: 'gsi@gmail.com', user_metadata: { full_name: 'Lola Google' } }));
      }
      if (p === '/auth/v1/token') {
        const id = body.password === 'secreto1' ? psql(`select id from auth.users where email = ${lit(body.email)}`) : '';
        return id ? json(200, session({ id, email: body.email, user_metadata: {} })) : json(400, { msg: 'Invalid login credentials' });
      }
      if (p === '/auth/v1/logout') return json(204, {});
      // entrar por la página de Google: aquí se simula que la persona cancela y vuelve al juego con el motivo
      if (p === '/auth/v1/authorize') return route.fulfill({ status: 302, headers: { location: u.searchParams.get('redirect_to') + '#error=access_denied&error_description=' + encodeURIComponent('Acceso cancelado') } });
      if (p === '/auth/v1/user') return me ? json(200, me) : json(401, { msg: 'invalid token' });
      if (p === '/auth/v1/settings') return json(200, { external: { google: true, email: true } });
      // pagos: la función crear-pago (simulada) y la consulta de compras. El «webhook» se simula entregando el pack con la clave de servicio.
      if (p === '/functions/v1/crear-pago' || p === '/functions/v1/rapid-handler') {
        if (!me) return json(401, { message: 'Necesitas iniciar sesión para comprar' });
        payRequests.push(body);
        psql(`select public.grant_pack('cs_test_e2e', '${me.id}', ${lit(body.pack)}, 299, 'eur')`, 'service_role');
        return json(200, { url: 'http://localhost:8080/?debug&pago=ok&sesion=cs_test_e2e' });
      }
      if (p === '/rest/v1/purchases') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.purchases x where stripe_session = ${lit((u.searchParams.get('stripe_session') || '').replace(/^eq\./, ''))}`, 'authenticated', me?.id)));
      if (p === '/rest/v1/profiles') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.profiles p`, 'authenticated', me?.id)));
      if (p === '/rest/v1/region_ranking') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.region_ranking l`, 'anon')));
      if (p === '/rest/v1/region_leaders') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(l) order by l.tomatoes_earned desc), '[]') from public.region_leaders l where region = ${lit((u.searchParams.get('region') || '').replace(/^eq\./, ''))}`, 'anon')));
      if (p === '/rest/v1/leaderboard') return json(200, JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.leaderboard l`, 'anon')));
      if (p.startsWith('/rest/v1/rpc/')) {
        const fn = p.split('/').pop(), args = Object.entries(body).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
        const sql = COMPOSITE.has(fn) ? `select to_jsonb(x) from public.${fn}(${args}) x` : fn === 'ack_invites' ? `select public.${fn}(${args})` : `select to_jsonb(public.${fn}(${args}))`;   // como PostgREST: un texto llega como texto JSON
        const out = psql(sql, me ? 'authenticated' : 'anon', me?.id);   // texto o vacío (void): como PostgREST, un texto JSON o null
        let v; try { v = out === '' ? null : JSON.parse(out); } catch { v = out; }
        return json(200, v);
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
check('cartas y tomates del cofre iguales en cliente y servidor', Object.keys(s.cards).every(k => s.cards[k].level === (row.cards[k]?.level || 0) && s.cards[k].frags === (row.cards[k]?.frags || 0)) && Object.values(s.cards).some(c => c.level > 0 || c.frags > 0) && s.tomatoes === row.tomatoes && s.chestTomatoes === row.chest_tomatoes, `(tomates ${s.tomatoes}/${row.tomatoes})`);
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
await page.click('#region-grid button[data-region="valencia"]', { force: true }); await page.waitForTimeout(600);
check('la comunidad se guarda en el servidor', db(email).region === 'valencia' && (await page.locator('#prof-title').textContent()) === 'Comunidad Valenciana');
check('elegida la comunidad, la lista se esconde y se ve solo su nombre', await page.locator('#region-grid.hidden').count() === 1);
await page.click('#prof-title'); await page.waitForTimeout(300);
await page.click('#region-grid button[data-region="madrid"]', { force: true }); await page.waitForTimeout(600);
check('la primera vez se puede corregir enseguida (tocando su nombre)', db(email).region === 'madrid');
await page.click('#prof-title'); await page.waitForTimeout(300);
await page.click('#region-grid button[data-region="galicia"]', { force: true }); await page.waitForTimeout(600);
check('después, solo una vez por semana (avisa)', db(email).region === 'madrid' && /una vez por semana/.test(await page.locator('#toast').textContent()));
check('una comunidad inventada: rechazada', await page.evaluate(() => import('./js/supabase.js').then(m => m.setRegion('narnia')).then(() => false, e => /no existe/.test(e.message))));
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
await page.evaluate(async () => { const c = (await import('./js/config.js')).CONFIG; c.PAYMENTS = true; c.PAY_LINKS = { calderilla: '', maletin: '', camara: '' }; });   // primero, el sistema de «crear-pago»
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

console.log('P. Enlaces de pago de Stripe');
{
  // con enlace de pago, PAGAR lleva al enlace de Stripe diciendo quién compra (el pack lo sabe Stripe por el importe)
  await page.evaluate(async () => { const c = (await import('./js/config.js')).CONFIG; c.PAYMENTS = true; c.PAY_LINKS.calderilla = 'https://buy.stripe.com/test_enlace199'; });
  let went = null; await page.route('https://buy.stripe.com/**', r => { went = r.request().url(); return r.fulfill({ status: 200, contentType: 'text/html', body: 'stripe' }); });
  const uid = db(email).user_id; payRequests.length = 0;
  await page.evaluate(() => { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); AAP.ui.closeAll(); });
  await page.evaluate(() => import('./js/payments.js').then(m => m.openPack('calderilla'))); await page.waitForTimeout(300);
  await page.check('#pay-ok', { force: true }); await page.click('#pay-go', { force: true }); await page.waitForTimeout(1500);
  const u = went ? new URL(went) : null;
  await page.goBack(); await page.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }); await page.waitForTimeout(800);
  await page.evaluate(async () => { AAP.giftTest.off = true; AAP.levelTest.off = true; (await import('./js/config.js')).CONFIG.PAY_LINKS.calderilla = ''; });
  check('PAGAR lleva al enlace de Stripe con el jugador (y sin pasar por «crear-pago»)', !!u && u.origin + u.pathname === 'https://buy.stripe.com/test_enlace199' && u.searchParams.get('client_reference_id') === uid && !!u.searchParams.get('prefilled_email') && payRequests.length === 0, went);
}

console.log('K. Niveles y ruleta en el servidor');
{
  const LVjs = await page.evaluate(async () => { const L = await import('./js/levels.js'); const xs = Array.from({ length: 300 }, (_, i) => Math.floor(Math.pow(i / 299, 2.2) * 900000)); return { xs, lv: xs.map(L.levelOfXp), ids: L.WHEEL.map(w => w.id), ws: L.WHEEL.map(w => w.weight) }; });
  const lvSql = psql(`select string_agg(public.fn_level_of_xp(x)::text, ',' order by o) from unnest(array[${LVjs.xs.join(',')}]::bigint[]) with ordinality t(x, o)`);
  check('el nivel se calcula igual en el juego y en el servidor (300 casos)', lvSql === LVjs.lv.join(','));
  const sqlText = (await import('node:fs')).readFileSync('supabase/schema_v13.sql', 'utf8');
  const ids = /ids text\[\] := array\[([^\]]+)\]/.exec(sqlText)[1].replace(/'/g, '').split(',').map(x => x.trim()), ws = /weights integer\[\] := array\[([^\]]+)\]/.exec(sqlText)[1].split(',').map(Number);
  check('la ruleta tiene las mismas casillas y probabilidades en el juego y en el servidor', ids.join() === LVjs.ids.join() && ws.join() === LVjs.ws.join(), ids.join());
  row = db(email); const lvl = +psql(`select public.fn_player_level(${row.tomatoes_thrown}, ${row.hits}, ${row.falls})`);
  check('cuenta nueva: empieza sin tiradas gastadas y con tiradas por los niveles subidos', row.wheel_level === 1 && lvl >= 2, `(nivel ${lvl}, ruleta ${row.wheel_level})`);
  await page.evaluate(() => { AAP.levelTest.off = false; AAP.levelTest.fast = true; });
  before = db(email); s = await S(page);
  const spinResp = page.waitForResponse(r => r.url().includes('/rpc/spin_level_wheel'), { timeout: 20000 });
  await page.evaluate(() => import('./js/levelup.js').then(m => m.checkPending()));
  await page.waitForFunction(() => document.querySelector('#lvlup-overlay').classList.contains('ready'), null, { timeout: 10000 });
  check('al entrar con tiradas pendientes se presentan los niveles', /NIVELES|PREMIO PENDIENTE/.test(await txt('#lvlup-banner')) && (await txt('#lvlup-num')) === String(lvl));
  await page.evaluate(() => document.querySelector('#lvlup-overlay.open #lvlup-spin')?.click()); await page.waitForSelector('#wheel-overlay.open'); await page.click('#wheel-btn', { force: true });
  const out = await (await spinResp).json(); await page.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 10000 });
  row = db(email); s = await S(page);
  check('el servidor decide el premio y la ruleta se para en esa casilla', (await page.locator('#wheel-svg .seg.win').getAttribute('data-i')) === String(out.seg), `(casilla ${out.seg}: ${out.reward.id})`);
  check('premio guardado en el servidor y igual en el juego', row.wheel_level === before.wheel_level + 1 && row.chest_pesetas === before.chest_pesetas + out.reward.pesetas && row.chest_tomatoes === before.chest_tomatoes + out.reward.tomatoes
    && s.pesetas === row.pesetas && s.tomatoes === row.tomatoes, JSON.stringify(out.reward).slice(0, 120));
  await page.click('#wheel-btn', { force: true }); await page.waitForTimeout(400);
  if (await page.locator('#chest-overlay.open').count()) { await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 }); await page.click('#chest-btn'); await page.waitForTimeout(300); }
  while (await page.locator('#wheel-overlay.open').count()) { await page.click('#wheel-close', { force: true }); await page.waitForTimeout(200); }
  if (db(email).wheel_level < lvl) psql(`update public.profiles set wheel_level = ${lvl} where user_id = '${row.user_id}'`);
  check('sin tiradas pendientes, el servidor no deja girar', await page.evaluate(() => AAP.backend.spinWheel().then(() => false, e => /No tienes tiradas/.test(e.message))));
  check('un jugador no puede cambiarse las tiradas', (() => { try { psql(`update public.profiles set wheel_level = 0`, 'authenticated', row.user_id); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());
  // ruleta de la tienda (pesetas) y tirada legendaria pagada, en el servidor
  psql(`update public.profiles set chest_pesetas = chest_pesetas + 500 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  before = db(email);
  const buy = await page.evaluate(() => AAP.backend.buySpin().then(r => ({ cost: r.cost, p: r.reward.pesetas, t: r.reward.tomatoes, w: r.wheel }), e => ({ err: e.message })));
  row = db(email); s = await S(page);
  const lvNow = +psql(`select public.fn_player_level(${row.tomatoes_thrown}, ${row.hits}, ${row.falls})`);
  check('ruleta de la tienda en el servidor: cobra 40 + 3 por nivel y entrega el premio', buy.w === 'normal' && buy.cost === 40 + 3 * lvNow && row.pesetas_spent === before.pesetas_spent + buy.cost
    && row.chest_pesetas === before.chest_pesetas + buy.p && row.chest_tomatoes === before.chest_tomatoes + buy.t && s.pesetas === row.pesetas, JSON.stringify(buy));
  check('sin tirada legendaria pagada, el servidor no deja girarla', await page.evaluate(() => AAP.backend.spinLegend().then(() => false, e => /No tienes tiradas legendarias/.test(e.message))));
  check('la tirada legendaria ya no se vende', (() => { try { psql(`select public.grant_pack('cs_test_ruleta', '${row.user_id}', 'ruleta', 99, 'eur')`, 'service_role'); return false; } catch (e) { return /Pack desconocido/.test(String(e.stderr)); } })());
  psql(`insert into public.aap_config (key, value) values ('rewarded_ads', 'true') on conflict (key) do update set value = 'true'`);
  const vids = await page.evaluate(async () => { const m = await import('./js/ads.js'); m.adsTest.on = true; m.DEMO_AD.seconds = 0; const r = []; for (let i = 0; i < 3; i++) { await AAP.backend.watchAd('ruleta'); r.push(AAP.state.legendAds + '/' + AAP.state.legendSpins); } m.adsTest.on = false; return r.join(' '); });
  check('3 vídeos = 1 tirada legendaria, guardada en el servidor', vids === '1/0 2/0 0/1' && db(email).legend_spins === 1 && db(email).legend_ads === 0, vids);
  psql(`update public.aap_config set value = 'false' where key = 'rewarded_ads'`);
  await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(400);
  check('la tienda enseña la tirada comprada', /GIRAR! \(1\)/.test(await page.locator('[data-wheel="legend"]').textContent()));
  before = db(email);
  const leg = await page.evaluate(() => AAP.backend.spinLegend().then(r => ({ w: r.wheel, p: r.reward.pesetas, t: r.reward.tomatoes, n: r.reward.cards.length, m: r.reward.minutes, id: r.reward.id }), e => ({ err: e.message })));
  row = db(email); s = await S(page);
  check('tirada legendaria en el servidor: se gasta y entrega su premio', leg.w === 'legend' && row.legend_spins === 0 && row.chest_pesetas === before.chest_pesetas + leg.p && row.chest_tomatoes === before.chest_tomatoes + leg.t && s.pesetas === row.pesetas
    && (!leg.m || Date.parse(row.falcon_until) > Date.now() + (leg.m - 1) * 60000), JSON.stringify(leg));
  await page.click('#panel-shop [data-close]'); await page.waitForTimeout(200);
  await page.evaluate(() => { AAP.levelTest.off = true; });
}

console.log('K2. Subir de nivel jugando (con cuenta): siempre sale la ruleta');
{
  await page.evaluate(() => { AAP.levelTest.off = false; AAP.levelTest.fast = true; AAP.giftTest.off = true; });
  const res = [];
  for (let round = 0; round < 4; round++) {
    // tomates para lanzar justo lo necesario para subir 1 nivel
    const need = await page.evaluate(async () => { const L = await import('./js/levels.js'), st = AAP.state.stats, i = L.levelInfo(st); return Math.ceil((i.need - i.into) / 35) + 1; });
    row = db(email);
    psql(`update public.profiles set chest_tomatoes = chest_tomatoes + ${need} where user_id = '${row.user_id}'`);
    await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
    const lv0 = await page.evaluate(() => import('./js/levels.js').then(L => L.levelOf(AAP.state.stats)));
    await page.evaluate(n => import('./js/play.js').then(m => { m.throwTomatoes(n); }), need); await stopAt(page, 0, 8); await idle(page);
    const lv1 = await page.evaluate(() => import('./js/levels.js').then(L => L.levelOf(AAP.state.stats)));
    const shown = await page.waitForFunction(() => document.querySelector('#lvlup-overlay').classList.contains('ready'), null, { timeout: 12000 }).then(() => true, () => false);
    const btn = shown ? await page.locator('#lvlup-spin').textContent() : '';
    let prize = '';
    if (shown) {
      await page.evaluate(() => document.querySelector('#lvlup-overlay.open #lvlup-spin')?.click());
      const w = await page.waitForSelector('#wheel-overlay.open', { timeout: 8000 }).then(() => true, () => false);
      if (w) { await page.click('#wheel-btn', { force: true }); prize = await page.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 15000 }).then(() => page.locator('#wheel-prize').textContent(), async () => 'SIN PREMIO: ' + (await page.locator('#toast').textContent())); }
      for (let k = 0; k < 4; k++) {
        if (await page.locator('#chest-overlay.open').count()) { await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await page.click('#chest-btn'); await page.waitForTimeout(300); }
        else if (await page.locator('#wheel-overlay.open').count()) { await page.click('#wheel-close', { force: true }); await page.waitForTimeout(300); }
      }
    }
    const srv = db(email), srvLv = +psql(`select public.fn_player_level(${srv.tomatoes_thrown}, ${srv.hits}, ${srv.falls})`);
    res.push({ lv0, lv1, shown, btn, prize: prize.slice(0, 40), srvLv, wl: srv.wheel_level });
  }
  check('subiendo de nivel jugando, cada vez sale la celebración y la ruleta da su premio (4 veces seguidas)', res.every(r => r.lv1 > r.lv0 && r.shown && /GIRAR/.test(r.btn) && /PREMIO|BOTE|LEGENDARIO/.test(r.prize) && r.wl === r.srvLv), JSON.stringify(res));
  // el juego cree que hay una tirada pero el servidor ya la dio (p. ej. girada en otro dispositivo): se pone al día sin colgarse
  await page.evaluate(() => { const t = document.querySelector('#toast'); window.__toasts = []; new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
  await page.evaluate(() => { AAP.state.wheelLevel -= 1; return import('./js/levelup.js').then(m => m.syncChip()); });
  await page.click('#lvl-chip'); await page.waitForSelector('#wheel-overlay.open', { timeout: 8000 });
  await page.click('#wheel-btn', { force: true }); await page.waitForTimeout(2500);
  const stale = await page.evaluate(() => ({ open: document.querySelector('#wheel-overlay').classList.contains('open'), toast: window.__toasts.join(' · '), dot: !document.querySelector('#lvl-dot').classList.contains('hidden'), wl: AAP.state.wheelLevel }));
  check('si el servidor ya había dado esa tirada, el juego se pone al día y avisa (sin colgarse)', !stale.open && /ya estaba girada/.test(stale.toast) && !stale.dot && stale.wl === db(email).wheel_level, JSON.stringify(stale));
  await page.evaluate(() => { AAP.levelTest.off = true; });
}

console.log('L. Racha de lanzamientos en el servidor');
{
  await page.evaluate(() => { AAP.streakTest.off = false; AAP.state.streak = 0; });
  row = db(email); psql(`update public.profiles set chest_tomatoes = chest_tomatoes + 10 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  before = db(email);
  for (let i = 0; i < 5; i++) { await page.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(page, 0, 6); await idle(page); }
  await page.waitForTimeout(5500); row = db(email); s = await S(page);
  check('5 aciertos seguidos: las 3 pesetas de la racha se guardan en el servidor y cuentan en tus pesetas', row.streak_pesetas === before.streak_pesetas + 3 && row.pesetas === s.pesetas && s.streakPesetas === row.streak_pesetas, JSON.stringify({ srv: row.streak_pesetas, loc: s.streakPesetas }));
  const before2 = row.streak_pesetas;
  await page.evaluate(async () => { AAP.state.stats.streakPesetas += 100000; (await import('./js/state.js')).changed(); });
  await page.waitForTimeout(5500); row = db(email); s = await S(page);
  check('pesetas de racha inventadas: el servidor solo admite las de las caídas nuevas', row.streak_pesetas === before2 && s.streakPesetas === row.streak_pesetas, `(${before2} → ${row.streak_pesetas})`);
  await page.evaluate(() => { AAP.streakTest.off = true; AAP.state.streak = 0; });
}

console.log('M. Carta nueva: Chantaje Pegasus en el servidor');
{
  row = db(email);
  psql(`update public.profiles set cards = jsonb_set(cards, '{pegasus}', '{"level": 1, "frags": 50}'), chest_pesetas = chest_pesetas + 500 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  const up = await page.evaluate(() => AAP.backend.upgradeCard('pegasus').then(() => 'ok', e => e.message));
  check('Chantaje Pegasus se mejora en el servidor como las demás', up === 'ok' && db(email).cards.pegasus.level === 2, up);
  check('y sale en los cofres como carta épica', psql(`select 'pegasus' = any (public.fn_rarity_cards('epic'))`) === 't');
}

console.log('N. Regalo por instalar la app, en el servidor');
{
  before = db(email);
  const r1 = await page.evaluate(() => AAP.backend.claimInstall().then(r => ({ p: r.pesetas, n: r.cards.length }), e => ({ err: e.message })));
  row = db(email);
  check('regalo de la app: cofre de diamante + 150 pesetas, guardado en el servidor', row.install_claimed === true && r1.n >= 0 && r1.p >= 150 && row.chest_pesetas === before.chest_pesetas + r1.p && row.chests_opened === before.chests_opened + 1, JSON.stringify(r1));
  check('y solo una vez por cuenta', await page.evaluate(() => AAP.backend.claimInstall().then(() => false, e => /Ya has recogido/.test(e.message))));
}

console.log('O. La Armería en el servidor');
{
  row = db(email); const orig = { t: row.tomatoes_thrown, h: row.hits, f: row.falls, w: row.wheel_level, ct: row.chest_tomatoes };
  await page.evaluate(() => localStorage.setItem('alaguapedro.armory50', '1'));   // la gran celebración del nivel 50 se prueba en el juego
  check('antes del nivel 50, el regalo de la app no da todavía el martillo', !JSON.stringify(row.armory).includes('hammer'), JSON.stringify(row.armory));
  // por debajo del nivel 50, el servidor no vende
  psql(`update public.profiles set tomatoes_thrown = 10, hits = 0, falls = 0 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  check('por debajo del nivel 50 el servidor no vende', await page.evaluate(() => AAP.backend.buyArmory('slipper', 30000).then(() => false, e => /nivel 50/.test(e.message))));
  psql(`update public.profiles set tomatoes_thrown = 200000, chest_tomatoes = chest_tomatoes + 200000, hits = 0, falls = 0, wheel_level = 50, chest_pesetas = chest_pesetas + 100000 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  await page.waitForFunction(() => AAP.state.armory.includes('hammer'), null, { timeout: 8000 }).catch(() => {});
  check('al llegar al nivel 50, el martillo de la app llega solo (en el servidor)', JSON.stringify(db(email).armory).includes('hammer'), JSON.stringify(db(email).armory));
  before = db(email);
  const r1 = await page.evaluate(() => AAP.backend.buyArmory('slipper', 30000).then(() => 'ok', e => e.message));
  row = db(email); s = await S(page);
  check('comprar en el servidor: cobra 30.000 y guarda el objeto', r1 === 'ok' && row.pesetas_spent === before.pesetas_spent + 30000 && row.armory.includes('slipper') && s.pesetas === row.pesetas
    && await page.evaluate(() => AAP.state.armory.includes('slipper')), JSON.stringify({ r1, a: row.armory }));
  check('no se puede comprar dos veces (ni cobrar dos veces)', await page.evaluate(() => AAP.backend.buyArmory('slipper', 30000).then(() => false, e => /Ya tienes/.test(e.message))) && db(email).pesetas_spent === row.pesetas_spent);
  check('sin pesetas suficientes, el servidor no vende', await page.evaluate(() => AAP.backend.buyArmory('stamp', 480000).then(() => false, e => /pesetas suficientes/.test(e.message))) && !db(email).armory.includes('stamp'));
  check('el martillo no se vende (es regalo) y un objeto inventado tampoco', await page.evaluate(() => Promise.all(['hammer', 'misil'].map(id => AAP.backend.buyArmory(id, 1).then(() => false, e => /no se vende/.test(e.message))))).then(r => r.every(Boolean)));
  check('un jugador no puede darse objetos a sí mismo', (() => { try { psql(`update public.profiles set armory = '["stamp"]'`, 'authenticated', row.user_id); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());
  // dos compras a la vez: solo se cobra una
  psql(`update public.profiles set chest_pesetas = chest_pesetas + 125000 where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  before = db(email);
  const twice = await page.evaluate(() => Promise.allSettled([AAP.backend.buyArmory('goose', 60000), AAP.backend.buyArmory('goose', 60000)]).then(r => r.map(x => x.status).join()));
  row = db(email);
  check('dos compras seguidas del mismo objeto: se cobra una sola vez', row.pesetas_spent === before.pesetas_spent + 60000 && row.armory.filter(x => x === 'goose').length === 1, twice);
  // vuelta al nivel de antes (las pruebas de después cuentan con él)
  psql(`update public.profiles set tomatoes_thrown = ${orig.t}, hits = ${orig.h}, falls = ${orig.f}, wheel_level = ${orig.w}, chest_tomatoes = ${orig.ct} where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
}

console.log('Q. Logros diarios e invitaciones en el servidor');
{
  const today = psql(`select ((now() at time zone 'Europe/Madrid')::date)::text`);
  await page.evaluate(() => AAP.backend.dailySync()); row = db(email);
  check('logros: el servidor guarda el día y los contadores del principio', row.daily.date === today && row.daily.base && +row.daily.base.t <= row.tomatoes_thrown && +row.daily.base.k <= row.taps && row.daily.lv >= 1, JSON.stringify(row.daily).slice(0, 120));
  // los contadores del principio del día = los de ahora: ninguna misión cumplida todavía
  psql(`update public.profiles set daily = jsonb_set(daily, '{base}', jsonb_build_object('t', tomatoes_thrown, 'f', falls, 'k', taps, 'h', hits, 'p', perfects, 'o', chests_opened)) where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  check('misión sin completar: el servidor no la da', await page.evaluate(() => AAP.backend.claimMission(0).then(() => false, e => /Todavía no/.test(e.message))));
  // se ponen los contadores del principio del día a 0: todas las misiones quedan cumplidas
  psql(`update public.profiles set daily = jsonb_set(daily, '{base}', '{"t":0,"f":0,"k":0,"h":0,"p":0,"o":0}') where user_id = '${row.user_id}'`);
  psql(`update public.profiles set tomatoes_thrown = greatest(tomatoes_thrown, 200), hits = greatest(hits, 100), perfects = greatest(perfects, 30), falls = greatest(falls, 60), chests_opened = greatest(chests_opened, 5), total_clicks = greatest(total_clicks, 50000), taps = greatest(taps, 5000) where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  before = db(email);
  const m0 = await page.evaluate(() => AAP.backend.claimMission(0).then(r => r, e => ({ err: e.message })));
  row = db(email); const L = +psql(`select least(50, public.fn_player_level(${row.tomatoes_thrown}, ${row.hits}, ${row.falls}))`);
  check('misión fácil en el servidor: tomates según el nivel', m0.tomatoes === 15 + L && row.chest_tomatoes === before.chest_tomatoes + 15 + L && row.daily.done.includes('0'), JSON.stringify(m0));
  check('y no se cobra dos veces', await page.evaluate(() => AAP.backend.claimMission(0).then(() => false, e => /Ya has recogido/.test(e.message))));
  await page.evaluate(() => AAP.backend.claimMission(1)); await page.evaluate(() => AAP.backend.claimMission(2));
  before = db(email); const bo = await page.evaluate(() => AAP.backend.claimDailyBonus().then(r => r.cards.length, e => e.message)); row = db(email);
  check('cofre de la jornada en el servidor (tras las 3 misiones)', bo >= 3 && row.chests_opened === before.chests_opened + 1 && row.daily.bonus === true, String(bo));
  before = db(email); const d1 = await page.evaluate(() => AAP.backend.claimLoginDay().then(r => r, e => ({ err: e.message }))); row = db(email);
  check('calendario: día 1 = +20 tomates, una vez al día', d1.day === 1 && row.chest_tomatoes === before.chest_tomatoes + 20 && await page.evaluate(() => AAP.backend.claimLoginDay().then(() => false, e => /Ya has recogido/.test(e.message))), JSON.stringify(d1));
  psql(`update public.profiles set daily = daily || jsonb_build_object('login_date', ((now() at time zone 'Europe/Madrid')::date - 1)::text, 'login_streak', 6) where user_id = '${row.user_id}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  before = db(email); const d7 = await page.evaluate(() => AAP.backend.claimLoginDay().then(r => r, e => ({ err: e.message }))); row = db(email);
  check('calendario: día 7 seguido = cofre de diamante + 200 pesetas', d7.day === 7 && d7.cards?.length >= 3 && row.chest_pesetas >= before.chest_pesetas + 200 && row.chests_opened === before.chests_opened + 1, JSON.stringify({ day: d7.day, err: d7.err }));
  // jugador veterano que entra por primera vez hoy, con unos logros viejos en el móvil (contados desde 0):
  // los retos empiezan a contar desde ahora, no desde que tiene el juego
  psql(`update public.profiles set daily = '{}'::jsonb, tomatoes_thrown = tomatoes_thrown + 5000, falls = falls + 4000, perfects = perfects + 4000, hits = hits + 5000, total_clicks = total_clicks + 900000, chests_opened = chests_opened + 50 where user_id = '${row.user_id}'`);
  await page.evaluate(() => { const k = 'alaguapedro.v2', d = JSON.parse(localStorage.getItem(k)); d.daily = { date: AAP.backend.todayKey(), base: { t: 0, f: 0, c: 0, h: 0, p: 0, o: 0 }, done: [], bonus: false, local: true }; localStorage.setItem(k, JSON.stringify(d)); });
  await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready && AAP.backend.cloud, null, { timeout: 15000 }); await page.waitForTimeout(1500);
  await page.click('#daily-btn', { force: true }); await page.waitForTimeout(1200);
  const fresh = await page.evaluate(() => ({ claim: document.querySelectorAll('[data-mission]:not(:disabled)').length, pct: [...document.querySelectorAll('.dl-mis')].map(e => e.textContent.match(/(\d+)%/)?.[1]), bar: document.querySelector('#daily-fill').style.width }));
  row = db(email);
  check('veterano que entra hoy: los retos empiezan a contar desde ahora (0%, nada por recoger)', fresh.claim === 0 && fresh.pct.every(x => x === '0') && fresh.bar === '0%' && +row.daily.base.t === row.tomatoes_thrown, JSON.stringify(fresh));
  check('y el servidor tampoco da una misión sin hacerla', await page.evaluate(() => AAP.backend.claimMission(2).then(() => false, e => /Todavía no/.test(e.message))));
  await page.click('#panel-daily [data-close]', { force: true }).catch(() => {}); await page.waitForTimeout(300);
  // invitaciones: un amigo nuevo usa el código
  const code = await page.evaluate(() => AAP.backend.inviteCode());
  check('cada jugador tiene su código de invitación', /^[0-9A-F]{6}$/.test(code) && db(email).invite_code === code, code);
  const fid = psql(`insert into auth.users (email, raw_user_meta_data) values ('amigo${Date.now()}@test.com', '{"username":"Amiguete"}') returning id`);
  const fr0 = JSON.parse(psql(`select to_jsonb(p) from public.profiles p where user_id = '${fid}'`));
  const red = JSON.parse(psql(`select public.redeem_invite('${code.toLowerCase()}')`, 'authenticated', fid));
  const fr = JSON.parse(psql(`select to_jsonb(p) from public.profiles p where user_id = '${fid}'`));
  check('el amigo recibe su regalo al registrarse (300 pesetas y 150 tomates) y sabe quién le invitó', red.reward.pesetas === 300 && fr.chest_pesetas === fr0.chest_pesetas + 300 && fr.chest_tomatoes === fr0.chest_tomatoes + 150 && red.inviter === row.username,
    JSON.stringify({ rw: red.reward, inv: red.inviter, me: row.username, p: [fr0.chest_pesetas, fr.chest_pesetas], t: [fr0.chest_tomatoes, fr.chest_tomatoes] }));
  const again = (() => { try { psql(`select public.redeem_invite('${code}')`, 'authenticated', fid); return false; } catch (e) { return /Ya has usado/.test(String(e.stderr)); } })();
  const self = await page.evaluate(c => AAP.backend.redeemInvite(c).then(() => false, e => /ti mismo/.test(e.message)), code);
  check('una invitación por amigo y nadie se invita a sí mismo', again && self);
  const old = psql(`insert into auth.users (email) values ('viejo${Date.now()}@test.com') returning id`); psql(`update public.profiles set created_at = now() - interval '10 days' where user_id = '${old}'`);
  check('solo cuentas nuevas', (() => { try { psql(`select public.redeem_invite('${code}')`, 'authenticated', old); return false; } catch (e) { return /cuentas nuevas/.test(String(e.stderr)); } })());
  before = db(email); const c1 = await page.evaluate(() => AAP.backend.claimInvites()); row = db(email);
  check('quien invita aún no cobra si su amigo no ha jugado (pendiente)', c1.paid === 0 && c1.total === 1 && c1.pending === 1 && row.chest_pesetas === before.chest_pesetas, JSON.stringify({ paid: c1.paid, total: c1.total, pending: c1.pending }));
  psql(`update public.profiles set tomatoes_thrown = 10, hits = 0, falls = 0, chest_tomatoes = 200 where user_id = '${fid}'`);
  before = db(email); const c2 = await page.evaluate(() => AAP.backend.claimInvites()); row = db(email);
  check('cuando su amigo juega 10 tomates: +700 pesetas (una vez)', c2.paid === 1 && row.chest_pesetas === before.chest_pesetas + 700 && row.invites_paid === 1 && (await page.evaluate(() => AAP.backend.claimInvites())).paid === 0, JSON.stringify({ paid: c2.paid }));
  // el amigo, en su móvil: entra con el enlace, se registra y le sale su regalo
  const cf = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const pf = await cf.newPage(); const ef = watchErrors(pf); await bridge(pf);
  await open(pf, URL_LOGIN + '&amigo=' + code); await pf.evaluate(() => { AAP.giftTest.off = true; });
  check('el enlace de invitación se guarda y se quita de la dirección', !/amigo=/.test(pf.url()) && await pf.evaluate(() => localStorage.getItem('alaguapedro.invite')) === code);
  await pf.click('.tab-s[data-tab="register"]'); const femail = `amiga${Date.now()}@test.com`;
  await pf.fill('#form-register [name=username]', 'Amiga'); await pf.fill('#form-register [name=email]', femail); await pf.fill('#form-register [name=password]', 'secreto1'); await pf.click('#form-register button');
  await pf.waitForSelector('#reward-pop.open', { timeout: 8000 }).catch(() => {});
  const fp = await pf.evaluate(() => ({ open: document.querySelector('#reward-pop').classList.contains('open'), t: document.querySelector('#reward-pop').innerText }));
  const frow = db(femail);
  check('al amigo le sale «REGALO POR INVITACIÓN» de quien le invitó, y lo tiene en su cuenta', fp.open && /REGALO POR INVITACI/i.test(fp.t) && fp.t.includes(row.username) && /300/.test(fp.t) && frow.chest_pesetas >= 300 && frow.chest_tomatoes >= 150, fp.t.replace(/\s+/g, ' ').slice(0, 200));
  await pf.screenshot({ path: 'tests/out/Q-regalo-invitacion.png' });
  check('amigo: sin errores en consola', ef.length === 0, ef.join(' | ')); await cf.close();
  before = db(email); const c3 = await page.evaluate(() => AAP.backend.claimInvites());
  check('el segundo amigo queda pendiente hasta que juegue', c3.total === 2 && c3.pending === 1 && c3.paid === 0, JSON.stringify({ t: c3.total, p: c3.pending }));
  check('nadie puede leer ni tocar la tabla de invitaciones', (() => { try { psql(`select count(*) from public.referrals`, 'authenticated', row.user_id); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());
}

console.log('R. Falcón: los clics hechos con él no se pierden; la ruleta del nivel no se queda esperando');
{
  await page.evaluate(() => AAP.backend.dailySync()); row = db(email);
  const uid = row.user_id, cpt1 = 1 + +psql(`select public.fn_card_level(cards, 'inflacion') from public.profiles where user_id = '${uid}'`);
  const save = clicks => JSON.parse(psql(`select to_jsonb(x) from public.save_progress(${clicks}, ${row.tomatoes_thrown}, ${row.hits}, ${row.perfects}, ${row.falls}, ${row.pesetas_earned}, ${row.tomatoes_refunded}, ${row.paguitas_pesetas}, ${row.streak_pesetas}) x`, 'authenticated', uid));
  // último guardado hace 60 s con el Falcón en marcha; terminó hace 5 s y se guarda ahora: 60 s pulsando ×5 (×3 de racha) = 13.500 pulsaciones-clic
  const got = 60 * 10 * 3 * 5 * cpt1;
  psql(`update public.profiles set updated_at = now() - interval '60 seconds', falcon_until = now() - interval '5 seconds' where user_id = '${uid}'`);
  let r1 = save(row.total_clicks + got);
  check('Falcón que termina justo antes de guardar: el servidor acepta todos los clics hechos con él', +r1.total_clicks === row.total_clicks + got, JSON.stringify({ sent: got, ok: r1.total_clicks - row.total_clicks }));
  row = db(email);
  psql(`update public.profiles set updated_at = now() - interval '60 seconds', falcon_until = now() - interval '2 hours' where user_id = '${uid}'`);
  r1 = save(row.total_clicks + got);
  check('sin Falcón, el límite contra trampas sigue igual', +r1.total_clicks < row.total_clicks + got, String(r1.total_clicks - row.total_clicks));
  psql(`update public.profiles set falcon_until = null where user_id = '${uid}'`);
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  // pulsando sin parar: se guarda mientras juegas (antes cada toque retrasaba el guardado y no se guardaba hasta parar)
  const n0 = calls.filter(c => c.endsWith('/rpc/save_progress')).length;
  await page.evaluate(() => { AAP.guardTest && (AAP.guardTest.off = true); });
  for (let i = 0; i < 30; i++) { await tap(page, 1); await page.waitForTimeout(300); }
  const n1 = calls.filter(c => c.endsWith('/rpc/save_progress')).length;
  check('pulsando sin parar 9 s: se guarda por el camino', n1 - n0 >= 1, `${n1 - n0} guardados`);
  await idle(page);
  // el juego creía que el servidor iba por detrás (tiradas en espera): en el siguiente guardado se pone al día solo
  const w = await page.evaluate(async () => { const LU = await import('./js/levelup.js'), S = await import('./js/state.js'), L = (await import('./js/levels.js')).levelOf(AAP.state.stats);
    AAP.state.wheelLevel = Math.max(1, L - 1); AAP.state.wheelCap = AAP.state.wheelLevel; const before = LU.pending();
    AAP.state.stats.totalClicks += 5; S.changed(); await AAP.backend.dailySync(); return { before, after: LU.pending(), cap: AAP.state.wheelCap }; });
  check('las tiradas «en espera» se desbloquean en el siguiente guardado (sin cerrar el juego)', w.before === 0 && w.after >= 1 && w.cap === null, JSON.stringify(w));
  const w2 = await page.evaluate(async () => { const L = (await import('./js/levels.js')).levelOf(AAP.state.stats); AAP.state.wheelCap = AAP.state.wheelLevel; (await import('./js/levelup.js')).syncChip();
    document.querySelector('#lvl-chip').click(); await new Promise(r => setTimeout(r, 1500)); return { wheel: document.querySelector('#wheel-overlay').classList.contains('open'), cap: AAP.state.wheelCap }; });
  check('y al tocar el nivel se comprueba con el servidor y sale la ruleta', w2.wheel && w2.cap === null, JSON.stringify(w2));
  await page.evaluate(() => { document.querySelector('#wheel-close').click(); }); await page.waitForTimeout(400);
  // con mala cobertura: el servidor no contesta mientras gira. La ruleta no se queda girando para siempre: avisa y se puede cerrar
  await page.evaluate(async () => { (await import('./js/supabase.js')).netTest.timeout = 1500; AAP.levelTest.fast = true; });
  await page.route('**/rest/v1/rpc/spin_level_wheel', () => {});   // nunca responde
  await page.evaluate(() => document.querySelector('#lvl-chip').click()); await page.waitForSelector('#wheel-overlay.open', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('#wheel-btn').click()); await page.waitForTimeout(3500);
  const hang = await page.evaluate(() => ({ spinning: document.querySelector('#wheel-overlay').classList.contains('spinning'), toast: document.querySelector('#toast').textContent }));
  await page.unroute('**/rest/v1/rpc/spin_level_wheel');
  await page.evaluate(() => document.querySelector('#wheel-close').click()); await page.waitForTimeout(400);
  check('si el servidor no contesta, la ruleta deja de girar, avisa y se puede cerrar', !hang.spinning && /conexión/.test(hang.toast) && await page.locator('#wheel-overlay.open').count() === 0, JSON.stringify(hang));
  await page.evaluate(async () => { (await import('./js/supabase.js')).netTest.timeout = 15000; AAP.levelTest.fast = false; });
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
}

console.log('S. Pulsaciones, martillo de la app y avisos en el servidor');
{
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); AAP.guardTest && (AAP.guardTest.off = true); });
  await idle(page); before = db(email);
  await tap(page, 30); await page.evaluate(() => AAP.backend.dailySync()); row = db(email);
  check('las pulsaciones con el dedo se guardan en el servidor (una por toque)', +row.taps === +before.taps + 30 && +row.total_clicks >= +before.total_clicks + 30, `${row.taps - before.taps} pulsaciones, ${row.total_clicks - before.total_clicks} clics`);
  const uid = row.user_id;
  psql(`update public.profiles set updated_at = now() - interval '10 seconds' where user_id = '${uid}'`);
  const capped = JSON.parse(psql(`select to_jsonb(x) from public.save_progress(${row.total_clicks + 900000}, ${row.tomatoes_thrown}, ${row.hits}, ${row.perfects}, ${row.falls}, ${row.pesetas_earned}, ${row.tomatoes_refunded}, ${row.paguitas_pesetas}, ${row.streak_pesetas}, ${+row.taps + 999999}) x`, 'authenticated', uid));
  check('y no se pueden inventar: como mucho 25 por segundo', +capped.taps - +row.taps <= 600 + 25 * 12 && +capped.taps > +row.taps, String(capped.taps - row.taps));
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
  // los retos de hoy se fijan con el nivel del principio del día
  const lvNow = +psql(`select least(50, public.fn_player_level(tomatoes_thrown, hits, falls)) from public.profiles where user_id = '${uid}'`);
  psql(`update public.profiles set daily = '{}'::jsonb where user_id = '${uid}'`); await page.evaluate(() => AAP.backend.dailySync()); row = db(email);
  const goals = JSON.parse(psql(`select jsonb_agg(public.fn_daily_mission((daily->>'date')::date, i, (daily->>'lv')::integer)) from public.profiles, generate_series(0, 2) i where user_id = '${uid}'`));
  const jsGoals = await page.evaluate(async () => { const D = await import('./js/daily-rules.js'), d = AAP.state.daily; return [0, 1, 2].map(i => { const m = D.missionFor(d.date, i, d.lv); return [m.id, m.k, m.goal]; }); });
  check('retos de nivel en el servidor: los mismos objetivos que en el juego', row.daily.lv === lvNow && JSON.stringify(goals) === JSON.stringify(jsGoals), JSON.stringify({ lv: row.daily.lv, goals, jsGoals }));
  // martillo: regalo de la app antes del nivel 50 → llega al llegar al 50
  const fid = psql(`insert into auth.users (email) values ('app${Date.now()}@test.com') returning id`);
  const inst = JSON.parse(psql(`select public.claim_install_reward()`, 'authenticated', fid));
  const f1 = JSON.parse(psql(`select to_jsonb(p) from public.profiles p where user_id = '${fid}'`));
  check('regalo de la app en el nivel 1: cofre y 150 pesetas, el martillo todavía no', inst.reward.hammer_at === 50 && !inst.reward.item && f1.install_claimed && !JSON.stringify(f1.armory).includes('hammer'), JSON.stringify(inst.reward).slice(0, 120));
  const early = (() => { try { psql(`select public.claim_app_hammer()`, 'authenticated', fid); return false; } catch (e) { return /nivel 50/.test(String(e.stderr)); } })();
  psql(`update public.profiles set tomatoes_thrown = 200000, hits = 0, chest_tomatoes = 200000 where user_id = '${fid}'`);
  const got = JSON.parse(psql(`select to_jsonb(x) from public.claim_app_hammer() x`, 'authenticated', fid));
  const twice = (() => { try { psql(`select public.claim_app_hammer()`, 'authenticated', fid); return false; } catch (e) { return /Ya tienes/.test(String(e.stderr)); } })();
  check('en el nivel 50 llega el martillo (antes no; y solo una vez)', early && JSON.stringify(got.armory).includes('hammer') && twice);
  const noApp = psql(`insert into auth.users (email) values ('noapp${Date.now()}@test.com') returning id`); psql(`update public.profiles set tomatoes_thrown = 200000, chest_tomatoes = 200000 where user_id = '${noApp}'`);
  check('sin la app no hay martillo gratis', (() => { try { psql(`select public.claim_app_hammer()`, 'authenticated', noApp); return false; } catch (e) { return /instálala/.test(String(e.stderr)); } })());
  // avisos
  const ep = 'https://fcm.googleapis.com/fcm/send/prueba-' + Date.now(), pk = 'B' + 'x'.repeat(86), au = 'a'.repeat(22);
  await page.evaluate(([e, p, a]) => import('./js/supabase.js').then(m => m.savePushSub(e, p, a)), [ep, pk, au]);
  check('cada aparato guarda su suscripción a los avisos', psql(`select count(*) from public.push_subs where endpoint = '${ep}' and user_id = '${uid}'`) === '1');
  check('suscripciones raras no se aceptan', await page.evaluate(() => import('./js/supabase.js').then(m => m.savePushSub('http://malo', 'x', 'y')).then(() => false, e => /no es válida/.test(e.message))));
  check('nadie puede leer las suscripciones ni las claves desde el juego', ['push_subs', 'push_config'].every(t => { try { psql(`select count(*) from public.${t}`, 'authenticated', uid); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })
    && (() => { try { psql(`select public.push_due(10)`, 'authenticated', uid); return false; } catch (e) { return /permission denied/.test(String(e.stderr)); } })());
  psql(`update public.push_config set vapid_public = 'BClavePublicaDePrueba' where id = 1`);
  check('la clave pública se puede pedir (sin cuenta también)', await page.evaluate(() => import('./js/supabase.js').then(m => m.pushPublicKey())) === 'BClavePublicaDePrueba');
  psql(`update public.profiles set daily_claimed_on = null, updated_at = now() - interval '2 days', daily = daily || jsonb_build_object('login_date', ((now() at time zone 'Europe/Madrid')::date - 1)::text, 'login_streak', 4) where user_id = '${uid}'`);
  const due10 = JSON.parse(psql(`select public.push_due(10)`, 'service_role')), again10 = JSON.parse(psql(`select public.push_due(10)`, 'service_role'));
  check('a las 10: aviso del cofre diario a quien no lo ha abierto (una vez al día)', due10.some(x => x.endpoint === ep && x.kind === 'chest') && !again10.some(x => x.endpoint === ep), JSON.stringify(due10.map(x => x.kind)));
  const due19 = JSON.parse(psql(`select public.push_due(19)`, 'service_role'));
  check('a las 19: recordatorio a quien no ha jugado hoy, con su racha', due19.some(x => x.endpoint === ep && x.kind === 'play' && x.streak === 4), JSON.stringify(due19.map(x => [x.kind, x.streak])));
  check('a otras horas no se avisa', JSON.parse(psql(`select public.push_due(15)`, 'service_role')).length === 0);
  psql(`update public.profiles set updated_at = now() where user_id = '${uid}'`);
  await page.evaluate(([e]) => import('./js/supabase.js').then(m => m.deletePushSub(e)), [ep]);
  check('y se pueden quitar', psql(`select count(*) from public.push_subs where endpoint = '${ep}'`) === '0');
  const pv = await page.evaluate(async () => { localStorage.removeItem('alaguapedro.pushAsked'); Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true }); const P = await import('./js/push.js'); await P.checkReady(); const perm = Notification.permission; await P.offer();
    const open = document.querySelector('#push-overlay').classList.contains('open'), txt = document.querySelector('#push-overlay').innerText;
    document.querySelector('#push-no').click(); await P.offer(); return { perm, open, txt: txt.replace(/\s+/g, ' ').trim().slice(0, 40), closed: !document.querySelector('#push-overlay').classList.contains('open') }; });
  check('tras el cofre diario: «¿Te aviso mañana?» (y si dices «Ahora no», no insiste)', pv.perm === 'default' && pv.open && /Te aviso/.test(pv.txt) && pv.closed, JSON.stringify(pv));
  await page.screenshot({ path: 'tests/out/S-ajustes.png' });
  await page.evaluate(() => { document.querySelector('#btn-settings')?.click(); }); await page.waitForTimeout(300);
  check('en Ajustes: fila «Avisos» con su interruptor', await page.locator('#btn-push #sw-push').count() === 1 && /Avisos/.test(await page.locator('#btn-push').innerText()));
  await page.evaluate(() => document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open')));
  await page.evaluate(async () => { const r = await (await import('./js/supabase.js')).getProfile(); AAP.state.updatedAt = null; (await import('./js/state.js')).applyServer(r); });
}

console.log('F. Ranking');
await page.click('#tabs [data-panel="rank"]'); await page.waitForTimeout(700); const rank = await txt('#panel-rank .sheet-body');
check('ranking con podio para los tres primeros', await page.locator('#rank-podium .pd:not(.empty)').count() >= 2 && await page.locator('#rank-podium .crown').count() === 1);
check('el ranking enseña el nivel de cada jugador', /Nv \d+ · /.test(rank), rank.replace(/\n/g, ' ').slice(0, 80));
await page.click('#rank-tabs [data-rt="regions"]'); await page.waitForTimeout(700);
const regs = await page.evaluate(() => [...document.querySelectorAll('#region-list > li')].map(li => li.dataset.region + ':' + li.querySelector('.sc').textContent + (li.classList.contains('me') ? ':me' : '')));
check('ranking por comunidades: salen las 19, la tuya marcada y primero las que más tomates tienen', regs.length === 19 && regs[0].startsWith('madrid:') && regs[0].endsWith(':me'), regs.slice(0, 3).join(' '));
await page.click('#region-list li[data-region="madrid"]'); await page.waitForTimeout(700);
check('al tocar tu comunidad se ven sus mejores jugadores', (await page.locator('#rg-madrid li').first().textContent()).includes('Arlet'));
await page.screenshot({ path: 'tests/out/12-ranking-comunidades.png' });
await page.click('#rank-tabs [data-rt="players"]'); await page.waitForTimeout(500);
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
console.log('H2. Botón oficial de Google en alaguapedro.es');
const ctx4 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p4 = await ctx4.newPage(); watchErrors(p4); await bridge(p4); await fakeGoogle(p4, 'gsi-token-ok');
await p4.goto(URL_LOGIN); await p4.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }); await p4.waitForSelector('#fake-gsi', { timeout: 8000 }).catch(() => {});
check('se ve el botón oficial de Google (y no el de siempre)', await p4.locator('#fake-gsi').isVisible() && !(await p4.locator('#btn-google').isVisible()));
check('y debajo, siempre, una segunda forma de entrar con Google', await p4.locator('#google-alt').isVisible());
// un token que Supabase rechaza: se dice el motivo y se ofrece la otra forma
const viaPage = p4.waitForRequest(r => r.url().includes('/auth/v1/authorize?provider=google'), { timeout: 10000 }).then(() => true, () => false);
await p4.evaluate(() => window.__gsi.callback({ credential: 'token-malo' }));
check('si el botón oficial falla, se entra solo por la página de Google', await viaPage);
await p4.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }); await p4.waitForSelector('#fake-gsi', { timeout: 8000 }).catch(() => {}); await p4.waitForTimeout(500);
check('y si tampoco se puede, se explica el motivo', /No se ha podido entrar con Google \(Acceso cancelado\)/.test(await p4.locator('#acc-msg').textContent()), await p4.locator('#acc-msg').textContent());
await p4.click('#fake-gsi'); await p4.waitForFunction(() => document.querySelector('#acc-short').textContent === 'Lola Google', null, { timeout: 10000 }).catch(() => {});
check('con el token de Google se entra en la cuenta (sin pasar por la página de Supabase)', (await p4.locator('#acc-short').textContent()) === 'Lola Google' && !(await p4.evaluate(() => document.querySelector('#panel-account').classList.contains('open'))));
await ctx4.close();

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
check('el ranking enseña la bandera de cada jugador', await p3.locator('#rank-podium .av, #rank-list li .av').count() >= 2);
await p3.screenshot({ path: 'tests/out/15-ranking-banderas.png' }); await ctx3.close();
errors.push(...errors3);
check('sin errores de consola (salvo los 400 esperados)', [...errors, ...errors2].every(e => /status of 400/.test(e)), [...errors, ...errors2].filter(e => !/status of 400/.test(e)).join('|'));
await browser.close(); process.exit(summary() ? 1 : 0);
