const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = __dirname, root = path.resolve(out, '../../../../..'), app = path.join(root, 'washi-ledger');
const origin = 'http://127.0.0.1:5274';
const env = fs.readFileSync(path.join(app, '.env'), 'utf8');
const ref = new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]).hostname.split('.')[0];
const uid = '00000000-0000-4000-8000-000000000092', encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const token = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: uid, exp: Math.floor(Date.now()/1000)+86400, role: 'authenticated', is_anonymous: true }) + '.design-preview';
const catalog = { expenseCategories: [], incomeCategories: [], paymentMethods: [], expenseTags: [], incomeTags: [], pointRules: [] };
const originalCSS = fs.readFileSync(path.join(out, 'winter.css'), 'utf8');
const runtimeCSS = originalCSS.replace(/url\("\.\/([^"\)]+)"\)/g, (_, file) => 'url("data:' + (file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/svg+xml') + ';base64,' + fs.readFileSync(path.join(out, file)).toString('base64') + '")');
let browser, server;
const status = '<div class="winter-preview-status" aria-hidden="true"><span>9:41</span><i class="winter-preview-island"></i><span class="winter-preview-status-right"><span class="winter-preview-signal"><b></b><b></b><b></b><b></b></span><span class="winter-preview-battery"></span></span></div>';
async function setup() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'no-preference' });
  await ctx.routeWebSocket('**/*', ws => ws.close());
  await ctx.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    if (req.url().startsWith(origin)) return route.continue();
    const reply = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'GET' && url.pathname.endsWith('/entries')) return reply({ entries: [] });
    if (req.method() === 'GET' && url.pathname.startsWith('/rest/v1/')) return reply([]);
    if (url.pathname.endsWith('/recurring-rules')) return reply({ rules: [] });
    return route.abort();
  });
  await ctx.addInitScript(({ uid, ref, token, catalog }) => {
    document.startViewTransition = undefined;
    if (localStorage.getItem('winter-preview-initialized')) return;
    localStorage.setItem('winter-preview-initialized', 'yes');
    localStorage.setItem('washi_ledger_settings_cache_v1', JSON.stringify({ lang: 'zh', currency: 'JPY', themeSkin: 'default' }));
    localStorage.setItem('washi_ledger_settings_last_synced_user_v1', uid);
    localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify({ access_token: token, refresh_token: 'design-preview', expires_at: Math.floor(Date.now()/1000)+86400, expires_in: 86400, token_type: 'bearer', user: { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' } }));
    localStorage.setItem('washi_ledger_catalog_cache_v2:' + uid, JSON.stringify(catalog));
    localStorage.setItem('washi_ledger_entries_cache_v2:' + uid, JSON.stringify([]));
  }, { uid, ref, token, catalog });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.clock.setFixedTime(new Date('2026-11-22T00:41:00Z'));
  return { ctx, page };
}
async function decorate(page, screen) {
  await page.addStyleTag({ content: runtimeCSS });
  await page.evaluate(({ status, screen }) => {
    document.documentElement.setAttribute('data-preview-theme', 'winter');
    const shell = document.querySelector('.app-shell');
    const header = shell.querySelector('[data-app-header]');
    if (header) header.parentElement.style.paddingTop = '54px';
    if (header && screen === 'home') header.querySelector('h1').textContent = 'PigBang';
    shell.insertAdjacentHTML('afterbegin', status);
    const layer = document.createElement('div'); layer.className = 'winter-fall-layer'; layer.setAttribute('aria-hidden', 'true');
    const spots = [4, 12, 24, 35, 44, 56, 67, 78, 88, 96, 18, 61, 82, 39];
    for (let i = 0; i < spots.length; i++) {
      const flake = document.createElement('span'); flake.className = 'winter-flake';
      flake.style.cssText = '--snow-x:' + spots[i] + '%;--snow-size:' + [14, 20, 16, 28, 18, 12, 24][i % 7] + 'px;--snow-duration:' + (23 + i % 6 * 2) + 's;--snow-delay:-' + (i * 4.7 + 3) + 's;--snow-opacity:' + [0.24, 0.36, 0.28][i % 3] + ';--snow-drift:' + (i % 2 ? -35 : 25) + 'px';
      layer.appendChild(flake);
    }
    shell.prepend(layer);
  }, { status, screen });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
async function snapshotDOM(page) {
  return page.locator('.app-shell').evaluate(shell => {
    const clone = shell.cloneNode(true);
    for (const el of clone.querySelectorAll('.fixed')) el.style.position = 'absolute';
    for (const el of clone.querySelectorAll('[style]')) if (el.style.position === 'fixed') el.style.position = 'absolute';
    return clone.outerHTML;
  });
}
function generateGallery(pages) {
  const dist = path.join(app, 'dist/assets');
  const cssName = fs.readdirSync(dist).find(n => /^index-.*\.css$/.test(n));
  const prefix = path.relative(out, dist).replaceAll('\\', '/');
  const baseCSS = fs.readFileSync(path.join(dist, cssName), 'utf8').replace(/url\((['"]?)(?:\.\/|\/assets\/)([^)'"\s]+)\1\)/g, (_, quote, file) => 'url("' + prefix + '/' + file + '")');
  fs.writeFileSync(path.join(out, 'app-base.css'), baseCSS);
  const icon = name => '<span class="material-symbols-outlined" aria-hidden="true">' + name + '</span>';
  const uiIcons = [['calendar_today','日期'],['receipt_long','小票'],['currency_exchange','汇率'],['settings','设置'],['edit','编辑'],['add','记一笔']].map(([key,label]) => '<div class="icon-sample"><span class="icon-circle">' + icon(key) + '</span><span>' + label + '</span></div>').join('');
  const templates = Object.entries(pages).map(([key, html]) => '<template id="screen-' + key + '">' + html + '</template>').join('');
  const html = `<!doctype html><html lang="zh-CN" data-theme="default" data-preview-theme="winter"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PigBang 冬雪主题 · 原图版预览</title><link rel="stylesheet" href="app-base.css"><link rel="stylesheet" href="winter.css">
<style>
body{margin:0;padding:28px 20px 50px;color:#203d53;background:radial-gradient(ellipse at 100% 5%,#d5e9f5,transparent 55%),#f0f6fa;font:14px/1.7 system-ui,sans-serif}.design-board{max-width:1080px;margin:auto}.design-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:30px}.design-name{font:600 34px/1.2 'Noto Serif SC',serif;letter-spacing:.1em}.design-caption{color:#526d80;margin-top:10px}.design-kicker{letter-spacing:.25em;font-size:11px;color:#58798e;margin-bottom:12px}.design-content{display:grid;grid-template-columns:minmax(0,440px) minmax(240px,1fr);align-items:start;gap:50px}.preview-shell{max-width:390px;width:100%;height:844px;overflow:hidden;border-radius:34px;box-shadow:0 25px 70px #476e8726,0 0 0 1px #fff;position:relative}.preview-shell .app-shell{position:relative!important;inset:auto!important;height:844px;max-width:100%;margin:0}.preview-shell .app-shell .fixed{position:absolute!important}.preview-shell .stamp-shadow{position:absolute!important}.preview-shell nav{position:absolute!important}.preview-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.preview-tabs button{font:inherit;color:#326c97;background:#ffffff80;border:1px solid #b9d1df;border-radius:99px;padding:6px 18px;cursor:pointer}.preview-tabs button[aria-pressed=true]{background:#326c97;border-color:#326c97;color:white}.design-side{padding-top:50px}.side-title{font:500 22px/1.4 'Noto Serif SC',serif;margin:0 0 24px}.swatches{display:flex;gap:20px;margin-bottom:38px}.swatch{width:52px;height:52px;border-radius:50%;border:1px solid #9bbacb55;box-shadow:inset 0 1px 0 #fff;margin-bottom:8px}.swatch-label{font-size:12px;color:#526d80}.icon-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px 12px;margin-bottom:38px}.icon-sample{display:flex;align-items:center;flex-direction:column;gap:8px;font-size:12px;color:#526d80}.icon-circle{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(145deg,#fff,#e3f0f9);border:1px solid #b8d2e2;box-shadow:0 0 14px #b7d8ed66;color:#326c97}.icon-circle .material-symbols-outlined{font-size:21px}.design-specimen{display:block;width:200px;height:185px;object-fit:contain;margin:0 0 28px}.design-note{font-size:13px;color:#526d80;line-height:1.9;max-width:340px}.design-foot{margin-top:26px;font-size:12px;color:#526d80}.design-side hr{border:0;border-top:1px solid #c5dae7;margin:28px 0}.full-stats{display:none}.preview-shell main{scrollbar-width:none}.preview-shell .app-shell *{scrollbar-width:none}
@media(max-width:720px){body{padding:22px 12px}.design-head{display:block}.design-name{font-size:28px}.design-content{grid-template-columns:1fr;gap:30px}.design-side{padding-top:0}.preview-shell{margin:auto}.swatches{margin-bottom:26px}.design-side .side-title{margin-bottom:18px}.design-side{max-width:390px;margin:auto;width:100%}}
</style>
<main class="design-board"><header class="design-head"><div><p class="design-kicker">PIGBANG · WINTER COLLECTION</p><h1 class="design-name">冬雪 · 水彩初雪</h1><p class="design-caption">原始图片直接使用：保留雪花、蓝色与周边墨点。</p></div></header><div class="design-content"><section aria-label="主题页面预览"><div class="preview-tabs"><button type="button" data-screen="home" aria-pressed="true">首页</button><button type="button" data-screen="stats" aria-pressed="false">统计</button><button type="button" id="toggle-snow" aria-pressed="true">飘雪开</button></div><div class="preview-shell" id="preview-shell"></div></section><aside class="design-side"><h2 class="side-title">水彩的轻盈</h2><div class="swatches"><div><div class="swatch" style="background:#f9fcfd"></div><span class="swatch-label">雪白</span></div><div><div class="swatch" style="background:#bad7eb"></div><span class="swatch-label">冰蓝</span></div><div><div class="swatch" style="background:#92a7b5"></div><span class="swatch-label">银灰</span></div></div><h2 class="side-title">选定的水彩雪花</h2><img class="design-specimen" src="original-preview.jpg" alt="从原站找回的原图，未重绘、未改色，保留原有灰白格"><h2 class="side-title">图标 · 冰蓝配色</h2><div class="icon-grid">${uiIcons}</div><hr><p class="design-note">雪花与周边墨点直接来自原文件，没有重绘、滤色或图层降透明处理。卡片保留约 72% 不透明度。这份公开预览文件的灰白格也原样保留；官方 PNG 下载需登录。</p><p class="design-foot">主题设计预览 · 空账本状态<br>状态栏与安全区为展示模拟。<br><a href="https://www.rawpixel.com/image/12065853/png-white-background-paper">用户选定的水彩图来源</a></p></aside></div></main>${templates}
<script>
const stage=document.getElementById('preview-shell');let snow=true;
function show(key){stage.replaceChildren(document.getElementById('screen-'+key).content.cloneNode(true));document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===key)));stage.style.setProperty('--snow-play-state',snow?'running':'paused');}
document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>show(b.dataset.screen));
document.getElementById('toggle-snow').onclick=function(){snow=!snow;this.textContent=snow?'飘雪开':'飘雪停';this.setAttribute('aria-pressed',String(snow));stage.style.setProperty('--snow-play-state',snow?'running':'paused');};
stage.addEventListener('click',event=>{const link=event.target.closest('a');if(link){event.preventDefault();if(link.getAttribute('href')==='/stats')show('stats');else if(link.getAttribute('href')==='/')show('home');}});
document.addEventListener('visibilitychange',()=>stage.style.setProperty('--snow-play-state',document.hidden?'paused':snow?'running':'paused'));
show('home');
</script></html>`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
}
(async () => {
  try {
    server = spawn(process.execPath, [path.join(app, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5274', '--strictPort'], { cwd: app, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const { ctx, page } = await setup(), pages = {}, report = [];
    for (const [key, route] of [['home','/'],['stats','/stats']]) {
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      await page.locator('main section').first().waitFor();
      await decorate(page, key);
      await page.screenshot({ path: path.join(out,key+'.png'), scale:'css' });
      pages[key] = await snapshotDOM(page);
      report.push({ screen:key, width:390, overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), cardBackground:await page.locator('main section').first().evaluate(el=>getComputedStyle(el).backgroundColor) });
    }
    const first = page.locator('.winter-flake').first();
    const before = await first.evaluate(el=>getComputedStyle(el).transform);
    await page.waitForTimeout(400);
    report.push({ snowMoves:before!==await first.evaluate(el=>getComputedStyle(el).transform), count:await page.locator('.winter-flake').count() });
    for (const width of [320,430,1280]) {await page.setViewportSize({width,height:844});report.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
    await ctx.close();
    generateGallery(pages);
    const gallery = await browser.newPage({ viewport:{width:1080,height:1120},reducedMotion:'reduce' });
    await gallery.goto('file:///'+path.join(out,'index.html').replaceAll('\\','/'));
    await gallery.evaluate(()=>document.fonts.ready);
    await gallery.screenshot({path:path.join(out,'design-board.png'),fullPage:true,scale:'css'});
    await gallery.getByRole('button',{name:'统计',exact:true}).click();
    report.push({gallerySwitches:await gallery.locator('#preview-shell h1').textContent()==='统计'});
    await gallery.setViewportSize({width:390,height:1100});
    report.push({galleryMobileOverflow:await gallery.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    await gallery.close();
    fs.writeFileSync(path.join(out,'preview-check.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({out,report}));
  } finally {if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
