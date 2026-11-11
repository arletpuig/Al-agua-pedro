import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(m.type()+': '+m.text()); });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
await page.goto('http://localhost:8080/'); await page.waitForTimeout(500);
const txt = s => page.locator(s).innerText();
const click = n => page.evaluate(n => { const b=document.querySelector('#btn-click'); for(let i=0;i<n;i++) b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:100,clientY:600})); }, n);
await click(250); await page.waitForTimeout(900);
console.log('clics:', await txt('#clicks-num'), 'tomates:', await txt('#tomato-num'), '|', await txt('#bar-text'));
// lanzar: tutorial primero
await page.click('#btn-throw'); await page.waitForTimeout(300);
console.log('tutorial visible:', await page.locator('#modal-tutorial').evaluate(e => e.classList.contains('open')));
await page.click('#modal-tutorial [data-close]'); await page.waitForTimeout(300);
console.log('track on:', await page.locator('#track').evaluate(e => e.classList.contains('on')), 'btn:', await txt('#btn-throw-text'), 'tomates:', await txt('#tomato-num'));
const stopAt = (lo, hi) => page.evaluate(([lo,hi]) => new Promise(res => { const t=document.querySelector('#tomato'); let last=null; const f=()=>{ const m=/translate\(([\d.]+)/.exec(t.getAttribute('transform')); const x=m?+m[1]:0; const d=Math.abs(x-430); if(d>=lo && d<=hi){ document.querySelector('#tap-layer').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); res(x);} else requestAnimationFrame(f); }; f(); }), [lo,hi]);
const x1 = await stopAt(0, 6); console.log('parado en x=', x1.toFixed(1));
await page.waitForTimeout(520); await page.screenshot({ path: 'tests/out/t1-splat.png' });
await page.waitForTimeout(1000); await page.screenshot({ path: 'tests/out/t2-fall.png' });
await page.waitForTimeout(1500); await page.screenshot({ path: 'tests/out/t3-water.png' });
await page.waitForTimeout(3200); await page.screenshot({ path: 'tests/out/t4-back.png' });
await page.click('#btn-stats'); await page.waitForTimeout(300); console.log('STATS:', (await txt('#stats-list')).replace(/\n/g,' | ')); await page.screenshot({ path: 'tests/out/t5-stats.png' }); await page.click('#modal-stats [data-close]');
// fallo
await page.waitForTimeout(500);
await page.click('#btn-throw'); await page.waitForTimeout(200);
const x2 = await stopAt(200, 400); console.log('parado en x=', x2.toFixed(1));
await page.waitForTimeout(1300); await page.screenshot({ path: 'tests/out/t6-miss.png' });
await page.waitForTimeout(2500);
console.log('tomates:', await txt('#tomato-num'), 'throw disabled:', await page.locator('#btn-throw').isDisabled());
// cercano
await click(100); await page.waitForTimeout(900);
await page.click('#btn-throw'); await page.waitForTimeout(200);
const x3 = await stopAt(22, 40); console.log('parado en x=', x3.toFixed(1));
await page.waitForTimeout(900); await page.screenshot({ path: 'tests/out/t7-near.png' });
await page.waitForTimeout(2800);
await page.click('#btn-stats'); await page.waitForTimeout(300); console.log('STATS:', (await txt('#stats-list')).replace(/\n/g,' | ')); await page.click('#modal-stats [data-close]');
// persistencia
await page.reload(); await page.waitForTimeout(500);
console.log('tras recargar -> clics:', await txt('#clicks-num'), 'tomates:', await txt('#tomato-num'), '|', await txt('#bar-text'));
await page.click('#btn-account'); await page.waitForTimeout(300); await page.screenshot({ path: 'tests/out/t8-account.png' });
console.log('errors:', JSON.stringify(errors));
await browser.close();
