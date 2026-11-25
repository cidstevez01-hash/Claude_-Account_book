// Winter theme checks use isolated account/data responses; live writes are blocked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),origin='http://127.0.0.1:5275';
const activeTheme=process.env.WINTER_SKIN||'winter';
assert(['winter','winter-silver'].includes(activeTheme));
const variant=activeTheme==='winter'?{kind:'warm',zh:'冬雪 · 暖金',ja:'冬雪・ウォームゴールド',other:'冬雪 · 银灰',otherSkin:'winter-silver'}:{kind:'silver',zh:'冬雪 · 银灰',ja:'冬雪・シルバー',other:'冬雪 · 暖金',otherSkin:'winter'};
const out=path.resolve(app,'../tmp/winter-release-check');
const env=fs.readFileSync(path.join(app,'.env'),'utf8');
const ref=new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]).hostname.split('.')[0];
const uid='00000000-0000-4000-8000-000000000093',encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated',is_anonymous:true})+'.isolated-winter';
const categories=[{id:'food',code:'food',type:'expense',zh:'食费',ja:'食費',icon:'restaurant',color:'#cc7111',subs:[]},{id:'salary',code:'salary',type:'income',zh:'工资',ja:'給与',icon:'work',color:'#32785f',subs:[]}];
const catalog={expenseCategories:[categories[0]],incomeCategories:[categories[1]],paymentMethods:[{id:'cash',code:'cash',zh:'现金',ja:'現金',pointRate:null}],expenseTags:[],incomeTags:[],pointRules:[]};
const row=e=>({id:e.id,user_id:uid,type:e.type,amount:e.amount,currency:e.currency,cat_code:e.catCode,sub_code:e.subCode,payment_method:e.paymentMethod,tag_code:e.tagCode,note:e.note,points:e.points,entry_date:e.date,recurring_id:null,created_at:new Date(e.createdAt).toISOString(),receipt_path:null});
const results=[];let browser,server;
async function setup({theme=activeTheme,lang='zh',entries=[],remote=false,missingColumn=false,nativeTransitions=false,fixture}={}){
 const activeCatalog=fixture?.catalog??catalog,activeCategories=fixture?.categories??categories;
 const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',reducedMotion:'no-preference'});
 const state={writes:[],assets:[],pageErrors:[]};
 await ctx.routeWebSocket('**/*',ws=>ws.close());
 await ctx.route('**/*',async r=>{
  const req=r.request(),url=new URL(req.url());
  if(req.url().startsWith(origin)){if(/themes\/winter\/.+\.(webp|png)/.test(url.pathname))state.assets.push(url.pathname);return r.continue();}
  const reply=data=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='GET'&&url.pathname.endsWith('/entries'))return reply({entries:entries.map(row)});
  if(url.pathname.endsWith('/user_settings')){
   if(req.method()==='GET')return reply(remote?{user_id:uid,lang,currency:'JPY',theme_skin:activeTheme}:null);
   if(req.method()==='POST'){
    const payload=req.postDataJSON();state.writes.push(payload);
    if(missingColumn&&payload.theme_skin)return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'PGRST204',message:'missing theme_skin'})});
    return reply(null);
   }
  }
  if(req.method()==='GET'&&url.pathname.startsWith('/rest/v1/')){
   if(url.pathname.endsWith('/categories'))return reply(activeCategories.map(x=>({...x,sort_order:0})));
   if(url.pathname.endsWith('/payment_methods'))return reply(activeCatalog.paymentMethods.map((p,i)=>({...p,sort_order:i,default_point_rate:null,badge_bg:null,badge_text:null})));
   if(url.pathname.endsWith('/subcategories'))return reply(activeCategories.flatMap(c=>c.subs.map(s=>({...s,cat_code:c.code,is_preset:true}))));
   if(url.pathname.endsWith('/tags'))return reply(['expense','income'].flatMap(type=>activeCatalog[type+'Tags'].map((t,i)=>({...t,type,is_preset:!t.custom,sort_order:i}))));
   return reply([]);
  }
  if(url.pathname.endsWith('/recurring-rules'))return reply({rules:[]});
  return r.abort();
 });
 await ctx.addInitScript(({uid,ref,token,catalog,theme,lang,entries,remote,nativeTransitions})=>{
  if(!nativeTransitions)document.startViewTransition=undefined;
  if(localStorage.getItem('winter-test-seeded'))return;localStorage.setItem('winter-test-seeded','yes');
  localStorage.setItem('washi_ledger_settings_cache_v1',JSON.stringify({lang,currency:'JPY',themeSkin:theme}));
  localStorage.setItem('washi_ledger_settings_last_synced_user_v1',remote?'previous-account':uid);
  localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify({access_token:token,refresh_token:'isolated-winter',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}}));
  localStorage.setItem('washi_ledger_catalog_cache_v2:'+uid,JSON.stringify(catalog));
  localStorage.setItem('washi_ledger_entries_cache_v2:'+uid,JSON.stringify(entries));
 },{uid,ref,token,catalog:activeCatalog,theme,lang,entries,remote,nativeTransitions});
 const page=await ctx.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>state.pageErrors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-22T00:41:00Z'));
 return{ctx,page,state};
}
async function scenario(name,fn,options){if(process.env.WINTER_RUNTIME_CASE&&!name.includes(process.env.WINTER_RUNTIME_CASE))return;let t;try{t=await setup(options);await fn(t);assert.deepEqual(t.state.pageErrors,[]);results.push({name,result:'passed'});}catch(e){results.push({name,result:'failed',error:e.message.slice(0,900)});}finally{if(t)await t.ctx.close();}}
async function skin(page,value){await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);}
async function go(page,route){await page.goto(origin+route,{waitUntil:'networkidle'});await page.locator('.app-shell').waitFor();}
async function photo(page,name){
 await page.evaluate(()=>{const shell=document.querySelector('.app-shell'),header=shell.querySelector('[data-app-header], header');if(header)header.parentElement.style.paddingTop='54px';shell.insertAdjacentHTML('afterbegin','<div aria-hidden="true" style="position:absolute;top:17px;left:29px;right:23px;z-index:20;color:#193b53;font:600 14px system-ui;display:flex;justify-content:space-between;pointer-events:none"><span>9:41</span><i style="position:absolute;left:50%;top:-5px;transform:translateX(-50%);width:112px;height:29px;border-radius:22px;background:#142632"></i><span>▮▮▮  ▰</span></div>');});
 await page.evaluate(()=>document.fonts.ready);if(name==='theme')await page.getByRole('button',{name:variant.zh,exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,name+'.png'),scale:'css'});
}
const themes=[['default','PigBang','PigBang'],['nostalgia','怀旧','ノスタルジー'],['summer','夏 · 花火','夏・花火'],['autumn','红叶 · 丹枫金秋','紅葉・丹楓の秋'],['winter','冬雪 · 暖金','冬雪・ウォームゴールド'],['winter-silver','冬雪 · 银灰','冬雪・シルバー']];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);server.on('exit',code=>{if(code)reject(Error('Vite exit '+code));});});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const lang of['zh','ja'])await scenario('current settings name follows all six selected themes, return and reload: '+lang,async({page})=>{
   for(const[key,zh,ja]of themes){
    const label=lang==='zh'?zh:ja,heading=lang==='zh'?'主题':'着せ替え';
    await go(page,'/settings');const row=page.getByRole('button').filter({has:page.getByText(heading,{exact:true})});await row.click();await page.waitForURL('**/theme');
    await page.getByRole('button',{name:label,exact:true}).click();await skin(page,key);await page.goBack();await page.waitForURL('**/settings');
    assert((await row.textContent()).includes(label));await page.reload({waitUntil:'networkidle'});await skin(page,key);assert((await row.textContent()).includes(label));
   }
   await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await photo(page,lang+'-settings');
  },{theme:'default',lang});
  for(const[kind,key]of[['warm','winter'],['silver','winter-silver']])for(const[width,height]of[[320,568],[390,844],[430,932],[1280,844]]){
   await scenario('native random snowfall: '+kind+' '+width+'x'+height,async({page})=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(scale=>{
     const nativeNow=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>nativeNow()*scale});
     const nativeTimer=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...args)=>nativeTimer(fn,Number(delay||0)/scale,...args);
     const nativeAnimate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const cfg=typeof options==='number'?options/scale:{...options,duration:Number(options.duration)/scale,delay:Number(options.delay||0)/scale};return nativeAnimate.call(this,frames,cfg);};
     window.__snowBirths=[];window.__snowPeak=0;
     new MutationObserver(records=>{for(const record of records)for(const el of record.addedNodes){if(!(el instanceof Element)||!el.matches('.winter-flake')||!el.isConnected)continue;const box=el.getBoundingClientRect();const active=[...document.querySelectorAll('.winter-flake')].map(n=>({id:n.dataset.snowId,center:Number(n.dataset.snowCenter),speed:Number(n.dataset.snowSpeed)}));window.__snowBirths.push({id:el.dataset.snowId,bottom:box.bottom,center:Number(el.dataset.snowCenter),speed:Number(el.dataset.snowSpeed),active});window.__snowPeak=Math.max(window.__snowPeak,active.length);}}).observe(document,{subtree:true,childList:true});
    },40);
    await go(page,'/');await skin(page,key);await page.waitForTimeout(300);
    for(let i=0;i<14;i++){
     const snapshot=await page.locator('.winter-flake').evaluateAll(nodes=>nodes.filter(el=>el.isConnected).map(el=>{const box=el.getBoundingClientRect(),s=getComputedStyle(el);return{width:el.offsetWidth,height:el.offsetHeight,center:Number(el.dataset.snowCenter),speed:Number(el.dataset.snowSpeed),box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},image:s.backgroundImage};}));
     assert(snapshot.length<=3);assert.equal(new Set(snapshot.map(x=>x.speed)).size,snapshot.length);assert(snapshot.every(x=>x.width===60&&x.height===60&&x.image.includes(kind+'-snowflake.png')),JSON.stringify(snapshot));
     for(let a=0;a<snapshot.length;a++)for(let b=a+1;b<snapshot.length;b++)assert(Math.abs(snapshot[a].center-snapshot[b].center)>=60*Math.SQRT2+14-1e-5);
     await page.waitForTimeout(220);
    }
    const info=await page.evaluate(()=>({births:window.__snowBirths,peak:window.__snowPeak}));assert.equal(info.peak,3);assert(info.births.length>=6);assert(info.births.every(b=>b.bottom<=0.5),'a new flake appeared halfway down');
    assert(new Set(info.births.map(b=>b.center.toFixed(3))).size>3,'replacement positions did not change');
    for(const birth of info.births)for(const other of birth.active)if(other.id!==birth.id)assert(Math.abs(other.center-birth.center)>=60*Math.SQRT2+14-1e-5);
    const layer=page.locator('.winter-background');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'paused');
    await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.target?.classList.contains('winter-flake')).map(a=>a.ready)));const before=await page.locator('.winter-flake').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).transform));await page.waitForTimeout(100);assert.deepEqual(await page.locator('.winter-flake').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).transform)),before);
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'running');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'paused');assert.equal(await page.locator('.winter-fall-layer').isVisible(),false);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>window.__snowLayer=document.querySelector('.winter-background'));
    await page.locator('.bottom-nav-shell a[href="/stats"]').click();await page.waitForURL('**/stats');assert.equal(await page.evaluate(()=>window.__snowLayer===document.querySelector('.winter-background')),true);
   },{theme:key});
  }
  await scenario('final actual pages with native random snowfall and selected theme labels',async({page})=>{
   for(const[key,kind,label]of[['winter','warm','冬雪 · 暖金'],['winter-silver','silver','冬雪 · 银灰']]){
    await go(page,'/theme');await page.getByRole('button',{name:label,exact:true}).click();await skin(page,key);
    for(const[name,route]of[['home','/'],['stats','/stats'],['settings','/settings']]){await go(page,route);await skin(page,key);await photo(page,kind+'-'+name);}
   }
  });
 }finally{if(browser)await browser.close();if(server)server.kill();}
 fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.result!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
