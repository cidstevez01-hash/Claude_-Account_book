// Isolated browser regressions for R-55/R-56/R-57/B-91. No live account requests.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app = path.resolve(__dirname, '..'), origin = 'http://127.0.0.1:5272';
const env = fs.readFileSync(path.join(app, '.env'), 'utf8');
const service = new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]), ref = service.hostname.split('.')[0];
const uid = '00000000-0000-4000-8000-000000000091';
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const token = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: uid, exp: Math.floor(Date.now() / 1000) + 86400, role: 'authenticated', is_anonymous: false }) + '.isolated-calendar';
const categories = [{ id: 'food', code: 'food', type: 'expense', zh: '食费', ja: '食費', icon: 'restaurant', color: '#cc7111', subs: [] }];
const catalog = { expenseCategories: categories, incomeCategories: [], paymentMethods: [{ id: 'cash', code: 'cash', zh: '现金', ja: '現金', pointRate: null }], expenseTags: [], incomeTags: [], pointRules: [] };
const seed = ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15'].map((date, i) => ({ id: 'fixture-' + i, type: 'expense', amount: (i + 1) * 100, currency: 'JPY', catCode: 'food', subCode: null, paymentMethod: 'cash', tagCode: null, note: 'isolated fixture', points: (i + 1) * 10, date, recurringId: null, createdAt: 1793500000000, receiptPaths: [] }));
const row = e => ({ id: e.id, user_id: uid, type: e.type, amount: e.amount, currency: e.currency, cat_code: e.catCode, sub_code: e.subCode, payment_method: e.paymentMethod, tag_code: e.tagCode, note: e.note, points: e.points, entry_date: e.date, recurring_id: null, created_at: new Date(e.createdAt).toISOString(), receipt_path: null });
let browser, server;
const results = [];
async function setup({ theme = 'default', lang = 'zh', desktop = false } = {}) {
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1280, height: 900 } : { width: 390, height: 844 }, isMobile: !desktop, hasTouch: !desktop, reducedMotion: 'reduce', timezoneId: 'Asia/Tokyo' });
  await ctx.routeWebSocket('**/*', ws => ws.close());
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.url().startsWith(origin)) return route.continue();
    const reply = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/entries') && req.method() === 'GET') return reply({ entries: seed.map(row) });
    if (req.method() === 'GET' && url.pathname.startsWith('/rest/v1/')) {
      if (url.pathname.endsWith('/categories')) return reply(categories.map(x => ({ ...x, sort_order: 0 })));
      if (url.pathname.endsWith('/payment_methods')) return reply([{ id: 'cash', code: 'cash', zh: '现金', ja: '現金', sort_order: 0 }]);
      return reply([]);
    }
    if (url.pathname.endsWith('/recurring-rules')) return reply({ rules: [] });
    return route.abort();
  });
  await ctx.addInitScript(({ uid, ref, token, catalog, seed, theme, lang }) => {
    document.startViewTransition = undefined;
    if (localStorage.getItem('calendar-test-initialized')) return;
    localStorage.setItem('calendar-test-initialized', 'yes');
    localStorage.setItem('washi_ledger_settings_cache_v1', JSON.stringify({ lang, currency: 'JPY', themeSkin: theme }));
    localStorage.setItem('washi_ledger_settings_last_synced_user_v1', uid);
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify({ access_token: token, refresh_token: 'isolated-calendar', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, token_type: 'bearer', user: { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' } }));
    localStorage.setItem('washi_ledger_catalog_cache_v2:' + uid, JSON.stringify(catalog));
    localStorage.setItem('washi_ledger_entries_cache_v2:' + uid, JSON.stringify(seed));
    for (const name of ['dashboard', 'history']) localStorage.setItem('washi_ledger_' + name + '_range_v1', JSON.stringify({ v: 2, startDate: '2026-11-10', endDate: '2026-11-20' }));
  }, { uid, ref, token, catalog, seed, theme, lang });
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-11-21T03:00:00Z'));
  return { ctx, page };
}
async function check(name, fn, options) {
  if (process.env.CALENDAR_CASE && !name.includes(process.env.CALENDAR_CASE)) return;
  let test;
  try { test = await setup(options); await fn(test); results.push({ name, result: 'passed' }); }
  catch (e) { results.push({ name, result: 'failed', error: e.message.slice(0, 700) }); }
  finally { if (test) await test.ctx.close(); }
}
async function touch(page, target, dx, dy, cancel = false) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 4; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 4, y: y + dy * i / 4 }] });
    await page.waitForTimeout(20);
  }
  await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  await client.detach();
}
async function month(page, label) { await page.getByText(label, { exact: true }).first().waitFor({ state: 'visible' }); }
const rangeGrid = page => page.locator('.picker-panel-glass .grid-slide-in-left, .picker-panel-glass .grid-slide-in-right');
async function day(page, number) { await rangeGrid(page).getByRole('button', { name: String(number), exact: true }).click(); }
async function boundaries(page, expected) {
  const actual = await rangeGrid(page).locator('button:has(span.bg-primary)').allTextContents();
  assert.deepEqual(actual.map(x => x.trim()), expected.map(String));
}
async function savedRange(page, name, startDate, endDate) {
  assert.deepEqual(await page.evaluate(name => JSON.parse(localStorage.getItem('washi_ledger_' + name + '_range_v1')), name), { v: 2, startDate, endDate });
}
(async () => {
  try {
    server = spawn(process.execPath, [path.join(app, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5272', '--strictPort'], { cwd: app, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Vite timeout')), 20000); server.stdout.on('data', d => { if (d.toString().includes('Local:')) { clearTimeout(timer); resolve(); } }); server.on('error', reject); });
    browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    await check('R-55 real touch swipes, year boundary, disabled month and selected day', async ({ page }) => {
      await page.goto(origin + '/calendar'); await month(page, '2026年11月');
      const card = page.locator('main div[style*="touch-action"]'), selected = page.locator('main h2').first();
      const before = await selected.textContent();
      await touch(page, card, -110, 3); await month(page, '2026年12月');
      assert.equal(await selected.textContent(), before, 'swipe must not select a day');
      await touch(page, card, -110, 3); await month(page, '2027年1月');
      await touch(page, card, -110, 3); await month(page, '2027年1月');
      assert.equal(await page.getByRole('button', { name: '下个月', exact: true }).isDisabled(), true);
      await touch(page, card, 110, 3); await month(page, '2026年12月');
      assert.equal(await selected.textContent(), before);
    });
    await check('R-55 vertical, diagonal, short and cancelled gestures keep month', async ({ page }) => {
      await page.goto(origin + '/calendar'); await month(page, '2026年11月');
      const card = page.locator('main div[style*="touch-action"]');
      for (const [dx, dy, cancel] of [[3, -90], [70, -90], [20, 0], [-110, 3, true]]) {
        await touch(page, card, dx, dy, cancel); await month(page, '2026年11月');
      }
      await card.locator('button:enabled').filter({ hasText: /^9$/ }).click();
      assert.match(await page.locator('main h2').first().textContent(), /9/);
    });
    for (const [url, name] of [['/', 'dashboard'], ['/history', 'history']]) {
      await check('R-56 ' + name + ' extend either endpoint, cancel, confirm, persist, single day', async ({ page }) => {
        await page.goto(origin + url); await page.locator('[data-date-range-bar]').click();
        await boundaries(page, [10, 20]); await day(page, 5); await boundaries(page, [5, 20]);
        await page.getByRole('button', { name: '取消', exact: true }).click();
        await savedRange(page, name, '2026-11-10', '2026-11-20');
        await page.locator('[data-date-range-bar]').click();
        await day(page, 5); await day(page, 25); await boundaries(page, [5, 25]);
        assert.equal(await page.getByRole('button', { name: '确定', exact: true }).isEnabled(), true);
        await page.getByRole('button', { name: '确定', exact: true }).click();
        await savedRange(page, name, '2026-11-05', '2026-11-25');
        await page.reload(); await page.locator('[data-date-range-bar]').click(); await boundaries(page, [5, 25]);
        await day(page, 15); assert.equal(await page.getByRole('button', { name: '确定', exact: true }).isDisabled(), true);
        await day(page, 15); await page.getByRole('button', { name: '确定', exact: true }).click();
        await savedRange(page, name, '2026-11-15', '2026-11-15');
      });
      await check('R-56 ' + name + ' extend across months and year', async ({ page }) => {
        await page.goto(origin + url); await page.locator('[data-date-range-bar]').click();
        await touch(page, rangeGrid(page), 110, 0); await month(page, '2026年10月');
        await day(page, 31); await boundaries(page, [31]);
        for (const label of ['2026年11月', '2026年12月', '2027年1月']) { await touch(page, rangeGrid(page), -110, 0); await month(page, label); }
        await day(page, 2); await boundaries(page, [2]);
        await page.getByRole('button', { name: '确定', exact: true }).click();
        await savedRange(page, name, '2026-10-31', '2027-01-02');
      });
    }
    await check('R-57 cashflow follows top month, clears selected bar, annual year and details', async ({ page }) => {
      await page.goto(origin + '/stats'); await month(page, '2026年11月');
      const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: '收支趋势', exact: true }) });
      assert.equal(await chart.locator('button[aria-label]').count(), 0);
      assert.equal(await chart.locator('svg rect[fill="transparent"]').count(), 1);
      await chart.locator('svg rect[fill="transparent"]').click();
      await chart.getByText('2026-11-15', { exact: true }).waitFor();
      await page.getByRole('button', { name: '下个月', exact: true }).click(); await month(page, '2026年12月');
      assert.equal(await chart.getByText('2026-11-15', { exact: true }).count(), 0);
      await chart.locator('svg rect[fill="transparent"]').click(); await chart.getByText('2026-12-15', { exact: true }).waitFor();
      await chart.getByRole('button', { name: '按月', exact: true }).click();
      assert.equal(await chart.locator('svg rect[fill="transparent"]').count(), 3);
      await page.getByRole('button', { name: '下个月', exact: true }).click(); await month(page, '2027年1月');
      assert.equal(await chart.locator('svg rect[fill="transparent"]').count(), 1);
      await chart.locator('svg rect[fill="transparent"]').click(); await chart.getByText('2027-01', { exact: true }).waitFor();
      await page.getByRole('button', { name: '上个月', exact: true }).click();
      await chart.getByRole('button', { name: '按日', exact: true }).click();
      await chart.getByRole('button', { name: /食费/ }).first().click();
      assert.match(await page.locator('.entry-card').last().textContent(), /300/);
    });
    await check('R-57 points shares the month and annual year after tab switches', async ({ page }) => {
      await page.goto(origin + '/stats'); await month(page, '2026年11月');
      await page.getByRole('button', { name: '下个月', exact: true }).click();
      await page.getByRole('button', { name: '积分', exact: true }).click();
      const chart = page.locator('section').filter({ has: page.locator('svg rect[fill="transparent"]') }).last();
      await chart.locator('svg rect[fill="transparent"]').click(); await chart.getByText('2026-12-15', { exact: true }).waitFor();
      await chart.getByRole('button', { name: '按月', exact: true }).click();
      await page.getByRole('button', { name: '下个月', exact: true }).click(); await month(page, '2027年1月');
      assert.equal(await chart.getByText('2026-12-15', { exact: true }).count(), 0);
      assert.equal(await chart.locator('svg rect[fill="transparent"]').count(), 1);
      await chart.locator('svg rect[fill="transparent"]').click(); await chart.getByText('2027-01', { exact: true }).waitFor();
    });
    for (const theme of ['default', 'autumn', 'summer']) {
      for (const desktop of [false, true]) {
        await check('B-91 ' + theme + ' ' + (desktop ? 'desktop' : 'mobile') + ' icon size, hit target, glow and route', async ({ page }) => {
          await page.goto(origin + '/account');
          const link = page.locator('a[href="/account/avatar"]'); await link.waitFor();
          await page.evaluate(() => document.fonts.ready);
          const hit = await link.boundingBox(), circle = await link.locator(':scope > span').boundingBox();
          assert.equal(hit.width, 44); assert.equal(hit.height, 44); assert.equal(circle.width, 26); assert.equal(circle.height, 26);
          const icon = await link.locator('svg, .material-symbols-outlined').boundingBox(); assert.equal(icon.width, 12); assert.equal(icon.height, 12);
          if (theme !== 'default') {
            const glow = await link.locator('.icon-ring-glow').boundingBox();
            assert(glow.x >= 0 && glow.x + glow.width <= (desktop ? 1280 : 390));
            assert(Math.abs(glow.x + glow.width / 2 - circle.x - circle.width / 2) < 0.1);
          }
          await link.click({ position: { x: 3, y: 22 } });
          await page.waitForURL('**/account/avatar');
        }, { theme, desktop });
      }
    }
  } finally { if (browser) await browser.close(); if (server) server.kill(); }
  console.log(JSON.stringify(results, null, 2));
  if (results.some(x => x.result !== 'passed')) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
