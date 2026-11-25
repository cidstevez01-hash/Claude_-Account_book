// R-58: actual month selection, confirmation, cancellation and persistence.
// Reuse the existing isolated account fixture; never send live account writes.
const fs = require('fs'), path = require('path'), Module = require('module');
const file = path.join(__dirname, 'calendarUpdates.browser.cjs');
const prefix = fs.readFileSync(file, 'utf8').split('(async () => {')[0];
const body = String.raw`
const out = path.resolve(app, '../tmp/month-range-check');
const cases = [
  ['/', 'dashboard', 'winter', 'zh', 390],
  ['/history', 'history', 'winter-silver', 'zh', 320],
  ['/', 'dashboard', 'winter-silver', 'ja', 320],
  ['/history', 'history', 'winter', 'ja', 390],
  ['/', 'dashboard', 'default', 'zh', 390],
];
async function chooseMonth(page, year, month) {
  const panel = page.locator('.picker-panel-glass');
  await panel.getByRole('button', { name: /^\d{4}年\d{1,2}月$/ }).click();
  if (await panel.getByRole('button', { name: year + '年', exact: true }).count() === 0) {
    await panel.getByRole('button', { name: /^\d{4}年$/ }).click();
    await panel.getByRole('button', { name: String(year), exact: true }).click();
  }
  await panel.getByRole('button', { name: month + '月', exact: true }).click();
  await panel.getByRole('button', { name: year + '年' + month + '月', exact: true }).waitFor();
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  try {
    server = spawn(process.execPath, [path.join(app, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5272', '--strictPort'], { cwd: app, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Vite timeout')), 20000);
      server.stdout.on('data', d => { if (d.toString().includes('Local:')) { clearTimeout(timer); resolve(); } });
      server.on('error', reject);
    });
    browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    for (const [url, name, theme, lang, width] of cases) {
      await check('R-58 ' + name + ' ' + theme + ' ' + lang, async ({ page, ctx }) => {
        const errors = [], writes = [];
        page.on('pageerror', e => errors.push(e.message));
        ctx.on('request', req => { if (!req.url().startsWith(origin) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) writes.push(req.url()); });
        await page.setViewportSize({ width, height: 844 });
        await page.goto(origin + url);
        const bar = page.locator('[data-date-range-bar]');
        const panel = page.locator('.picker-panel-glass');
        const confirm = () => panel.getByRole('button', { name: lang === 'ja' ? '確定' : '确定', exact: true }).click();
        const cancel = () => panel.getByRole('button', { name: lang === 'ja' ? 'キャンセル' : '取消', exact: true }).click();
        const open = () => bar.click();

        // Browsing a year does not change the current interval.
        await open();
        await panel.getByRole('button', { name: '2026年11月', exact: true }).click();
        await panel.getByRole('button', { name: '2026年', exact: true }).click();
        await panel.getByRole('button', { name: '2024', exact: true }).click();
        await savedRange(page, name, '2026-11-10', '2026-11-20');
        await page.locator('div.fixed.inset-0.z-\\[200\\]').click({ position: { x: 3, y: 3 } });

        // Non-leap February is a draft until confirmation; cancel discards it.
        await open(); await chooseMonth(page, 2026, 2); await boundaries(page, [1, 28]);
        assert.equal(await rangeGrid(page).locator('button[aria-pressed="true"]').count(), 28);
        await savedRange(page, name, '2026-11-10', '2026-11-20');
        await cancel();
        await open(); await boundaries(page, [10, 20]); await cancel();

        for (const [year, month, lastDay] of [[2024, 2, 29], [2025, 2, 28], [2026, 11, 30], [2026, 12, 31], [2027, 1, 31]]) {
          await open(); await chooseMonth(page, year, month); await boundaries(page, [1, lastDay]);
          assert.equal(await rangeGrid(page).locator('button[aria-pressed="true"]').count(), lastDay);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          const bounds = await panel.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
          await confirm();
          const ym = year + '-' + String(month).padStart(2, '0');
          await savedRange(page, name, ym + '-01', ym + '-' + lastDay);
          await page.reload(); await open(); await boundaries(page, [1, lastDay]); await cancel();
        }

        // R-56 remains valid after selecting a complete month.
        await open(); await day(page, 15); await boundaries(page, [15, 31]);
        await day(page, 1); await boundaries(page, [1, 31]);
        await day(page, 31); await boundaries(page, [31]); await cancel();
        await savedRange(page, name, '2027-01-01', '2027-01-31');

        // The two pages keep independent persisted ranges.
        const other = name === 'dashboard' ? 'history' : 'dashboard';
        await savedRange(page, other, '2026-11-10', '2026-11-20');
        await page.goto(origin + (other === 'history' ? '/history' : '/'));
        await open(); await boundaries(page, [10, 20]); await cancel();
        assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      }, { theme, lang });
    }
  } finally {
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 2));
    await browser?.close(); server?.kill();
  }
  console.log(JSON.stringify(results));
  if (results.some(r => r.result !== 'passed')) process.exitCode = 1;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
`;
const compiled = new Module(file, module);
compiled.filename = file; compiled.paths = module.paths;
compiled._compile(prefix + body, file);
