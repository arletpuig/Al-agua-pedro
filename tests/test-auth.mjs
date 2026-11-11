import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [], calls = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(m.type()+': '+m.text()); });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
// backend simulado
let db = null; const user = { id: 'u1', email: 'a@b.com', user_metadata: { username: 'Arlet' } };
const session = () => ({ access_token: 'tok', refresh_token: 'ref', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, user });
await page.route('https://xfsvruccotcymcvxzymy.supabase.co/**', async route => {
  const r = route.request(); const u = new URL(r.url()); const p = u.pathname + u.search; calls.push(r.method()+' '+p);
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const body = r.postDataJSON?.() || {};
  if (p.startsWith('/auth/v1/signup')) { db = { user_id: 'u1', username: body.data.username, total_clicks: 0, tomatoes_thrown: 0, hits: 0, falls: 0, tomatoes_earned: 0, clicks_progress: 0, tomatoes: 0 }; return json(200, session()); }
  if (p.startsWith('/auth/v1/token?grant_type=password')) return body.password === 'secreto' ? json(200, session()) : json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
  if (p.startsWith('/auth/v1/logout')) return json(204, {});
  if (p.startsWith('/auth/v1/recover')) return json(200, {});
  if (p.startsWith('/rest/v1/profiles')) return json(200, db ? [db] : []);
  if (p.startsWith('/rest/v1/rpc/save_progress')) {
    if (r.headers()['authorization'] !== 'Bearer tok') return json(401, { message: 'JWT' });
    const tc = Math.max(db.total_clicks, body.p_total_clicks); const th = Math.min(Math.max(db.tomatoes_thrown, body.p_tomatoes_thrown), Math.floor(tc/100));
    db = { ...db, total_clicks: tc, tomatoes_thrown: th, hits: Math.min(body.p_hits, th), falls: Math.min(body.p_falls, body.p_hits), tomatoes_earned: Math.floor(tc/100), clicks_progress: tc%100, tomatoes: Math.floor(tc/100)-th };
    return json(200, db);
  }
  if (p.startsWith('/rest/v1/leaderboard')) return json(200, [{ username: 'Arlet', falls: 3, hits: 5 }, { username: 'Otro', falls: 1, hits: 1 }]);
  return json(404, { message: 'no route ' + p });
});
await page.goto('http://localhost:8080/'); await page.waitForTimeout(400);
const txt = s => page.locator(s).innerText();
const click = n => page.evaluate(n => { const b=document.querySelector('#btn-click'); for(let i=0;i<n;i++) b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:100,clientY:600})); }, n);
await click(120); await page.waitForTimeout(300);
// login erróneo
await page.click('#btn-account'); await page.fill('#form-login [name=email]', 'a@b.com'); await page.fill('#form-login [name=password]', 'mal'); await page.click('#form-login button'); await page.waitForTimeout(300);
console.log('login mal ->', await txt('#acc-msg'));
// registro
await page.click('.tab[data-tab=register]'); await page.fill('#form-register [name=username]', 'Arlet'); await page.fill('#form-register [name=email]', 'a@b.com'); await page.fill('#form-register [name=password]', 'secreto'); await page.click('#form-register button'); await page.waitForTimeout(600);
console.log('registro ->', await txt('#acc-msg'), '| logged:', await txt('#acc-name'), '| db:', JSON.stringify(db));
await page.click('#modal-account [data-close]');
await click(30); await page.waitForTimeout(4600);
console.log('autosave -> db.total_clicks:', db.total_clicks, '| estado:', await txt('#save-status'), '| clics UI:', await txt('#clicks-num'), await txt('#tomato-num'));
// recarga: restaurar sesión y cargar de la nube
db.total_clicks = 500; db.tomatoes_earned = 5; db.tomatoes = 4; db.tomatoes_thrown = 1; db.clicks_progress = 0;
await page.reload(); await page.waitForTimeout(800);
console.log('tras recargar -> clics:', await txt('#clicks-num'), 'tomates:', await txt('#tomato-num'), '| cuenta:', await page.locator('#btn-account').evaluate(e => e.classList.contains('logged')));
await page.click('#btn-rank'); await page.waitForTimeout(400); console.log('ranking:', (await txt('#rank-list')).replace(/\n/g,' | ')); await page.screenshot({ path: 'tests/out/a1-rank.png' }); await page.click('#modal-rank [data-close]');
await page.click('#btn-account'); await page.waitForTimeout(200); await page.screenshot({ path: 'tests/out/a2-account.png' }); await page.click('#btn-logout'); await page.waitForTimeout(400);
console.log('logout -> logged:', await page.locator('#btn-account').evaluate(e => e.classList.contains('logged')), '| clics:', await txt('#clicks-num'));
// recuperación de contraseña por enlace
await page.goto('http://localhost:8080/#access_token=rec&refresh_token=x&expires_in=3600&type=recovery'); await page.waitForTimeout(500);
console.log('recovery -> modal:', await page.locator('#modal-account').evaluate(e => e.classList.contains('open')), 'pane:', await page.locator('#form-newpass').evaluate(e => e.classList.contains('active')), 'hash:', await page.evaluate(() => location.hash));
console.log('calls:', calls.join('\n  '));
console.log('errors:', JSON.stringify(errors));
await browser.close();
