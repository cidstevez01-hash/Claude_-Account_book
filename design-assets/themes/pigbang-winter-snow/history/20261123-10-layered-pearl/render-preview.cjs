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
  await page.clock.setFixedTime(new Date('2026-11-23T00:41:00Z'));
  return { ctx, page };
}
const assert=require('node:assert/strict'),crypto=require('crypto');
const sharp=require('C:/Users/Zero1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const composition=JSON.parse(fs.readFileSync(path.join(out,'composition.json'),'utf8'));
const paletteCss=composition.styles.map(f=>fs.readFileSync(path.join(out,f),'utf8')).join('\n');
const dataUrl=file=>'data:'+(file.endsWith('.png')?'image/png':'image/svg+xml')+';base64,'+fs.readFileSync(path.join(out,file)).toString('base64');
const layers=composition.layers.map(layer=>({...layer,src:dataUrl(layer.file)}));
const icons=composition.icons.map(icon=>({...icon,svg:fs.readFileSync(path.join(out,icon.file),'utf8')}));
async function geometry(page){return page.locator('[data-app-header], [data-app-header] button, main section, [data-date-range-bar], nav, nav a, .stamp-shadow, main button, .pb-navigation-icon').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{tag:el.tagName,text:el.textContent.trim(),rect:[r.x,r.y,r.width,r.height],font:s.font,borderRadius:s.borderRadius};}));}
async function glyphGeometry(page){return page.locator('.pb-navigation-icon svg').evaluateAll(svgs=>svgs.map(svg=>({viewBox:svg.getAttribute('viewBox'),shapes:[...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,g[transform]')].map(el=>({tag:el.tagName,geometry:[...el.attributes].filter(a=>!['fill','stroke','color','id','class','style','xmlns'].includes(a.name)).map(a=>[a.name,a.value])}))})));}
async function decorate(page,screen){
 await page.addStyleTag({content:runtimeCSS});
 await page.evaluate(({status,screen})=>{document.documentElement.dataset.previewTheme='winter';document.documentElement.dataset.previewScreen=screen;const shell=document.querySelector('.app-shell'),header=shell.querySelector('[data-app-header]');if(header)header.parentElement.style.paddingTop='54px';if(header&&screen==='home')header.querySelector('h1').textContent='PigBang';shell.insertAdjacentHTML('afterbegin',status);},{status,screen});
 await page.evaluate(()=>document.fonts.ready);
 const before=await geometry(page),glyphs=await glyphGeometry(page);
 await page.evaluate(({layers,icons})=>{
  const shell=document.querySelector('.app-shell'),container=document.createElement('div');container.className='pearl-composition';container.setAttribute('aria-hidden','true');
  for(const layer of layers.filter(x=>!x.instances)){
   const img=document.createElement('img');img.src=layer.src;img.alt='';img.dataset.pearlLayer=layer.id;img.style.zIndex=String(layer.z);img.style.opacity=String(layer.opacity);
   if(layer.fit==='fill')img.className='pearl-layer';else{img.className='pearl-snow';img.style.width=layer.width+'px';for(const side of ['left','right','top','bottom'])if(layer[side]!=null)img.style[side]=layer[side]+'px';}
   container.appendChild(img);
  }
  const falling=layers.find(x=>x.instances),fall=document.createElement('div');fall.className='winter-fall-layer';fall.dataset.pearlLayer='snow-fall';
  const spots=[4,12,24,35,44,56,67,78,88,96,18,61,82,39];
  for(let i=0;i<falling.instances;i++){const f=document.createElement('span');f.className='winter-flake';f.style.cssText='--snow-x:'+spots[i]+'%;--snow-size:'+[14,20,16,28,18,12,24][i%7]+'px;--snow-duration:'+(23+i%6*2)+'s;--snow-delay:-'+(i*4.7+3)+'s;--snow-drift:'+(i%2?-35:25)+'px;animation-play-state:paused';fall.appendChild(f);}
  container.appendChild(fall);shell.prepend(container);
  for(const icon of icons){let i=0;for(const el of document.querySelectorAll('.pb-navigation-icon[data-icon="'+icon.key+'"] svg')){const local=icon.svg.replaceAll('pearl-'+icon.key,'pearl-'+icon.key+'-'+i++);const doc=new DOMParser().parseFromString(local,'image/svg+xml');el.innerHTML=doc.documentElement.innerHTML;}}
 },{layers,icons});
 await page.addStyleTag({content:paletteCss});
 await page.locator('.pearl-composition img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
 assert.deepEqual(await geometry(page),before,'Layout or typography changed');
 assert.deepEqual(await glyphGeometry(page),glyphs,'Icon geometry changed');
 return{layoutAndTypographyUnchanged:true,iconGeometryUnchanged:true};
}
async function difference(a,b,roi){const aa=await sharp(a).extract(roi).removeAlpha().raw().toBuffer(),bb=await sharp(b).extract(roi).removeAlpha().raw().toBuffer();let sum=0;for(let i=0;i<aa.length;i++)sum+=Math.abs(aa[i]-bb[i]);return Number((sum/aa.length).toFixed(3));}
function gallery(){
 const figures=[['home','实际首页'],['stats','实际统计页']].map(([key,label])=>'<figure><figcaption>'+label+'</figcaption><a href="layered-pearl-'+key+'.png" target="_blank"><img src="layered-pearl-'+key+'.png" alt="分层珠光墨染 · '+label+'" width="390" height="844"></a></figure>').join('');
 const layerLinks=composition.layers.filter(l=>!l.instances&&l.fit==='fill').map(l=>'<li><a href="'+l.file+'" target="_blank">'+l.name+'</a> · 透明度 '+Math.round(l.opacity*100)+'%</li>').join('')+'<li><a href="layers/40-pearl-snowflake.png" target="_blank">珠光雪花原图抠背景版</a></li>';
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PigBang 分层珠光墨染预览</title><style>body{margin:0;padding:28px 18px 40px;background:#F8F7F9;color:#37323F;font:15px/1.6 system-ui,sans-serif}main{max-width:840px;margin:auto}h1{margin:0 0 8px;font-size:23px}p{margin:0;color:#69616F}header{margin-bottom:22px}.pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}figure{margin:0}figcaption{margin-bottom:12px;font-weight:500}figure a{display:block}img{width:100%;max-width:390px;height:auto;display:block;border-radius:24px;box-shadow:0 6px 24px #0000000B}details{margin-top:24px}a{color:#735198}footer{margin-top:18px;font-size:13px;color:#69616F}@media(max-width:740px){.pages{grid-template-columns:1fr;gap:28px}figure{max-width:390px;width:100%;margin:auto}body{padding:22px 12px}}</style><main><header><h1>分层珠光墨染 · 加深混色</h1><p>紫、浅青、薄荷绿进入中间卡片；图标与切换按钮同步配色。</p></header><section class="pages">'+figures+'</section><details><summary>查看独立图层与配色文件</summary><ul>'+layerLinks+'<li><a href="composition.json" target="_blank">组合清单：层级、位置、透明度</a></li><li><a href="palette.json" target="_blank">颜色参数</a></li><li><a href="styles/icon-palette.css" target="_blank">图标与按钮配色</a></li><li><a href="icons/book.svg" target="_blank">书本图标</a> · <a href="icons/history.svg" target="_blank">明细图标</a> · <a href="icons/bar_chart.svg" target="_blank">统计图标</a></li></ul></details><footer>空账本预览；布局、字体和图表结构未变。状态栏和安全区为展示模拟。</footer></main></html>';
 fs.writeFileSync(path.join(out,'index.html'),html);
}
(async()=>{
 const report=[];
 try{
  const snow=fs.readFileSync(path.join(out,'layers/40-pearl-snowflake.png'));
  assert.equal(crypto.createHash('sha256').update(snow).digest('hex'),composition.snowflakeSha256);
  for(const layer of composition.layers.filter(x=>x.fit==='fill'&&x.id!=='paper')){const stats=await sharp(path.join(out,layer.file)).ensureAlpha().stats();assert.equal(stats.channels[3].min,0);assert(stats.channels[3].max>0);}
  report.push({independentInkLayers:3,transparentBackgrounds:true,originalSnowflakeUnchanged:true});
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5274','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const{ctx,page}=await setup();
  for(const screen of ['home','stats']){
   await page.goto(origin+(screen==='home'?'/':'/stats'),{waitUntil:'networkidle'});await page.locator('main section').first().waitFor();
   const locked=await decorate(page,screen);
   assert.equal(await page.locator('.pearl-composition > img').count(),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const png=path.join(out,'layered-pearl-'+screen+'.png');await page.screenshot({path:png,scale:'css'});await sharp(png).webp({lossless:true}).toFile(path.join(out,'layered-pearl-'+screen+'.webp'));
   report.push({screen,...locked,overflow:false});
   if(screen==='stats'){
    const roi={left:40,top:430,width:300,height:180};
    const previous=path.join(out,'../20261123-09-pearl-ink/pearl-ink-stats.png');
    const delta=await difference(png,previous,roi);assert(delta>3,'Middle card tint is still indistinguishable');
    const contributions=[];
    for(const name of ['lavender','cyan','mint']){
     const image=page.locator('[data-pearl-layer="'+name+'"]'),opacity=await image.evaluate(el=>el.style.opacity);await image.evaluate(el=>el.style.opacity='0');
     const missing=await page.screenshot();await image.evaluate((el,value)=>el.style.opacity=value,opacity);
     const contribution=await difference(png,missing,roi);assert(contribution>.15,'Ink color missing in middle region: '+name);contributions.push({name,middleRegionRgbChange:contribution});
    }
    report.push({middleRegionRgbChangeFromPrevious:delta,contributions,trendCardBackground:await page.locator('main section').first().evaluate(el=>getComputedStyle(el).backgroundColor)});
    const card=page.locator('main section').first();await card.getByRole('button',{name:'按月',exact:true}).click();assert(await card.getByRole('button',{name:'按月',exact:true}).evaluate(el=>el.classList.contains('bg-surface')));await card.getByRole('button',{name:'收入',exact:true}).click();assert(await card.getByRole('button',{name:'收入',exact:true}).evaluate(el=>el.classList.contains('bg-surface')));report.push({trendControlsStillWork:true});
   }
   for(const width of [320,430,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.push({screen,width,overflow:false});}await page.setViewportSize({width:390,height:844});
  }
  await ctx.close();gallery();
  const g=await browser.newPage({viewport:{width:1000,height:1100}});await g.goto('file:///'+path.join(out,'index.html').replaceAll('\\','/'));await g.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await g.screenshot({path:path.join(out,'comparison-pages.png'),fullPage:true});await g.setViewportSize({width:390,height:1100});assert.equal(await g.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await g.close();
  fs.writeFileSync(path.join(out,'preview-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,report}));
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
