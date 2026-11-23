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
const assert=require('node:assert/strict');
const sharp=require('C:/Users/Zero1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const variants=JSON.parse(fs.readFileSync(path.join(out,'variants.json'),'utf8'));
async function decorate(page,variant,screen){
  await page.addStyleTag({content:runtimeCSS});
  await page.evaluate(({status,gradient,screen})=>{
    document.documentElement.dataset.previewTheme='winter';
    document.documentElement.style.setProperty('--winter-preview-gradient',gradient);
    const shell=document.querySelector('.app-shell');
    const header=shell.querySelector('[data-app-header]');
    if(header)header.parentElement.style.paddingTop='54px';
    if(header&&screen==='home')header.querySelector('h1').textContent='PigBang';
    shell.insertAdjacentHTML('afterbegin',status);
    const layer=document.createElement('div');layer.className='winter-fall-layer';layer.setAttribute('aria-hidden','true');
    const spots=[4,12,24,35,44,56,67,78,88,96,18,61,82,39];
    for(let i=0;i<spots.length;i++){
      const flake=document.createElement('span');flake.className='winter-flake';
      flake.style.cssText='--snow-x:'+spots[i]+'%;--snow-size:'+[14,20,16,28,18,12,24][i%7]+'px;--snow-duration:'+(23+i%6*2)+'s;--snow-delay:-'+(i*4.7+3)+'s;--snow-drift:'+(i%2?-35:25)+'px;animation-play-state:paused';
      layer.appendChild(flake);
    }
    shell.prepend(layer);
  },{status,gradient:variant.css,screen});
  await page.evaluate(()=>document.fonts.ready);
}
async function signature(page){
  return page.locator('[data-app-header], main section, [data-date-range-bar], nav, .stamp-shadow').evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return{tag:el.tagName,text:el.textContent.trim(),rect:[r.x,r.y,r.width,r.height],color:s.color,font:s.font,border:s.border,borderRadius:s.borderRadius,backgroundColor:s.backgroundColor};
  }));
}
function gallery(){
 const cards=variants.map(v=>'<figure><figcaption><h2>'+v.name+'</h2><p>'+v.stops.join(' → ')+'</p></figcaption><a data-full="'+v.id+'" href="'+v.id+'-home.png" target="_blank"><img data-page="'+v.id+'" src="'+v.id+'-home.png" alt="'+v.name+'渐变·实际首页" width="390" height="844"></a></figure>').join('');
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PigBang 实际页面渐变对比</title><style>body{margin:0;padding:26px 18px 40px;background:#f7f7f7;color:#303030;font:15px/1.65 system-ui,sans-serif}main{max-width:1240px;margin:auto}h1{font-size:24px;margin:0 0 8px}h2{font-size:18px;margin:0}p{margin:0;color:#646464}header{margin-bottom:22px}.tabs{display:flex;gap:10px;margin:18px 0 24px}button{font:inherit;background:#fff;border:1px solid #ccc;border-radius:22px;padding:8px 23px;color:#303030;cursor:pointer}button[aria-pressed=true]{background:#303030;color:white;border-color:#303030}.comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}figure{margin:0}figcaption{margin-bottom:12px}figcaption p{font-size:12px;overflow-wrap:anywhere}img{display:block;max-width:390px;width:100%;height:auto;border-radius:24px;box-shadow:0 5px 20px #0000000d}a{display:block}footer{margin-top:20px;color:#646464;font-size:13px}@media(max-width:760px){.comparison{grid-template-columns:1fr;gap:30px}figure{max-width:390px;margin:auto;width:100%}body{padding:22px 12px}}</style><main><header><h1>实际页面 · 渐变背景对比</h1><p>同一套首页与统计页，仅背景变化。雪花为原图抠背景版本。</p><div class="tabs" aria-label="选择页面"><button type="button" data-screen="home" aria-pressed="true">首页</button><button type="button" data-screen="stats" aria-pressed="false">统计</button></div></header><section class="comparison">'+cards+'</section><footer>空账本预览；状态栏与安全区为展示模拟。点击页面可查看原尺寸图片。</footer></main><script>document.querySelectorAll("[data-screen]").forEach(button=>button.onclick=()=>{const page=button.dataset.screen;document.querySelectorAll("[data-screen]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));document.querySelectorAll("[data-page]").forEach(img=>{img.src=img.dataset.page+"-"+page+".png";img.alt=img.dataset.page+"渐变·实际"+(page==="home"?"首页":"统计页");});document.querySelectorAll("[data-full]").forEach(a=>a.href=a.dataset.full+"-"+page+".png");});</script></html>';
 fs.writeFileSync(path.join(out,'index.html'),html);
}
(async()=>{
 const report=[],baseline={};
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5274','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const{ctx,page}=await setup();
  for(const screen of ['home','stats']){
   await page.goto(origin+(screen==='home'?'/':'/stats'),{waitUntil:'networkidle'});
   await page.locator('main section').first().waitFor();
   await decorate(page,variants[0],screen);
   baseline[screen]=await signature(page);
   for(const v of variants){
    await page.evaluate(gradient=>document.documentElement.style.setProperty('--winter-preview-gradient',gradient),v.css);
    assert.deepEqual(await signature(page),baseline[screen],'Non-background UI changed across variants');
    const actual=await page.locator('.app-shell').evaluate(el=>getComputedStyle(el).backgroundImage);
    assert(actual.includes('linear-gradient'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const png=path.join(out,v.id+'-'+screen+'.png');
    await page.screenshot({path:png,scale:'css'});
    await sharp(png).webp({lossless:true}).toFile(path.join(out,v.id+'-'+screen+'.webp'));
    report.push({variant:v.id,screen,background:actual,otherUiIdentical:true,overflow:false});
   }
   for(const width of [320,430,1280]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    report.push({screen,width,overflow:false});
   }
   await page.setViewportSize({width:390,height:844});
  }
  await ctx.close();gallery();
  const g=await browser.newPage({viewport:{width:1280,height:1100},reducedMotion:'reduce'});
  await g.goto('file:///'+path.join(out,'index.html').replaceAll('\\','/'));
  await g.screenshot({path:path.join(out,'comparison-home.png'),fullPage:true});
  await g.getByRole('button',{name:'统计',exact:true}).click();
  await g.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await g.screenshot({path:path.join(out,'comparison-stats.png'),fullPage:true});
  assert((await g.locator('img').evaluateAll(imgs=>imgs.every(img=>img.src.endsWith('-stats.png')))));
  await g.setViewportSize({width:390,height:1100});
  assert.equal(await g.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.push({gallerySwitchesPages:true,galleryMobileOverflow:false});
  await g.close();
  fs.writeFileSync(path.join(out,'preview-check.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(out,'locked-ui-signatures.json'),JSON.stringify(baseline,null,2));
  console.log(JSON.stringify({out,report}));
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
