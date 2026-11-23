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
let runtimeCSS;
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
let paletteCss;
const dataUrl=file=>{let content=fs.readFileSync(path.join(out,file));if(file.endsWith('.svg'))content=Buffer.from(content.toString().replace(/href="\.\/([^"\s]+)"/g,(_,ref)=>'href="'+dataUrl(path.join(path.dirname(file),ref))+'"'));return 'data:'+(file.endsWith('.png')?'image/png':'image/svg+xml')+';base64,'+content.toString('base64');};
runtimeCSS=originalCSS.replace(/url\("\.\/([^"\)]+)"\)/g,(_,file)=>'url("'+dataUrl(file)+'")');
paletteCss=composition.styles.map(f=>fs.readFileSync(path.join(out,f),'utf8')).join('\n').replace(/url\("\.\/([^"\)]+)"\)/g,(_,file)=>'url("'+dataUrl(file)+'")');
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
const kind=path.basename(out).includes('warm')?'warm':'silver';
function gallery(){
 const title=kind==='warm'?'暖金 · 雪花周围留白':'银灰浅彩 · 雪花周围留白';
 const figures=['home','stats'].map(screen=>'<figure><figcaption>'+({home:'首页',stats:'统计页'}[screen])+'</figcaption><a href="clearance-'+screen+'.png"><img src="clearance-'+screen+'.png" width="390" height="844" alt="晕染避开雪花完整轮廓的实际页面"></a></figure>').join('');
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{margin:0;padding:24px 16px;background:#F8F8F8;color:#333;font:15px/1.6 system-ui}main{max-width:830px;margin:auto}h1{font-size:22px;margin:0 0 20px}.pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}figcaption{margin-bottom:10px}img{display:block;max-width:390px;width:100%;height:auto}footer{margin-top:20px}a{color:#657180}@media(max-width:740px){.pages{grid-template-columns:1fr}figure{max-width:390px;margin:auto}}</style><main><h1>'+title+'</h1><div class="pages">'+figures+'</div><footer><a href="composition.json">图层与避让范围清单</a><p>空账本实际页面预览；状态栏和安全区为展示模拟。</p></footer></main></html>');
}
function inside(point,polygon){let sign=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);if(Math.abs(cross)<1e-6)continue;const current=Math.sign(cross);if(sign&&current!==sign)return false;sign=current;}return true;}
(async()=>{
 const report=[],hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const previous=path.resolve(out,composition.baseline.replace('/composition.json',''));
 try{
  assert.equal(hash(path.join(out,composition.approvedSnowflake.file)),composition.approvedSnowflake.sha256);
  for(const file of['winter.css','layers/11-ink-color-filter.svg',...composition.icons.map(icon=>icon.file)])assert.equal(hash(path.join(out,file)),hash(path.join(previous,file)));
  report.push({kind,snowflakeAndInkArtworkUnchanged:true,onlyInkClearanceAdded:true});
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5274','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);server.on('exit',code=>{if(code)reject(Error('Vite exit '+code));});});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const{ctx,page}=await setup();
  const qa=await browser.newPage({viewport:{width:390,height:844}});
  await qa.setContent('<html data-preview-theme="winter"><style>html,body{margin:0;width:100%;height:100%;background:transparent}.pearl-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}</style><img class="pearl-layer" data-pearl-layer="original-ink"></html>');
  await qa.addStyleTag({content:paletteCss});await qa.addStyleTag({content:'html,body{background:transparent!important}'});
  await qa.locator('img').evaluate((img,src)=>{img.src=src;img.style.opacity='.62';return img.decode();},dataUrl('layers/11-ink-color-filter.svg'));
  for(const width of[320,390,480]){
   await qa.setViewportSize({width,height:844});
   const cleared=await qa.screenshot({omitBackground:true});
   await qa.locator('img').evaluate(el=>{el.style.maskImage='none';el.style.webkitMaskImage='none';});const original=await qa.screenshot({omitBackground:true});await qa.locator('img').evaluate(el=>{el.style.removeProperty('mask-image');el.style.removeProperty('-webkit-mask-image');});
   const a=await sharp(original).ensureAlpha().raw().toBuffer(),b=await sharp(cleared).ensureAlpha().raw().toBuffer();const corners=[{id:'top',x:width-340+115,y:-82,size:340},{id:'bottom',x:-145,y:844-300+100,size:300}];
   const checks=[];
   for(const corner of corners){let overlap=0,remaining=0;for(let y=0;y<844;y++)for(let x=0;x<width;x++){const p=[(x-corner.x)*740/corner.size,(y-corner.y)*740/corner.size];if(!inside(p,composition.clearance.contour))continue;const k=(y*width+x)*4+3;if(a[k]>3){overlap++;remaining=Math.max(remaining,b[k]);}}assert(remaining<=2,'Ink remains within '+corner.id+' snowflake: '+remaining);checks.push({corner:corner.id,overlappingInkPixelsRemoved:overlap,maxRemainingAlpha:remaining});}
   assert(checks.reduce((sum,check)=>sum+check.overlappingInkPixelsRemoved,0)>20,'No overlap was exercised at this viewport');
   const k=(420*width+width-40)*4+3;assert(Math.abs(a[k]-b[k])<=1,'Ink outside clearance was altered');report.push({width,clearance:checks});
   if(width===390){fs.writeFileSync(path.join(out,'ink-with-clearance.png'),cleared);fs.writeFileSync(path.join(out,'ink-before-clearance.png'),original);}
  }
  await qa.close();
  for(const screen of['home','stats']){await page.goto(origin+(screen==='home'?'/':'/stats'),{waitUntil:'networkidle'});await page.locator('main section').first().waitFor();const locked=await decorate(page,screen);await page.screenshot({path:path.join(out,'clearance-'+screen+'.png'),scale:'css'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.push({screen,...locked,overflow:false});}
  await ctx.close();gallery();const g=await browser.newPage({viewport:{width:1000,height:1100}});await g.goto('file:///'+path.join(out,'index.html').replaceAll('\\','/'));await g.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await g.screenshot({path:path.join(out,'comparison-pages.png'),fullPage:true});await g.close();
  fs.writeFileSync(path.join(out,'preview-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,report}));
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
