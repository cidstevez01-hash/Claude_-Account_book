// Winter theme checks use isolated account/data responses; live writes are blocked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),origin='http://127.0.0.1:5275';
const activeTheme=process.env.WINTER_SKIN||'winter';
assert(['winter','winter-silver'].includes(activeTheme));
const variant=activeTheme==='winter'?{kind:'warm',zh:'冬雪 · 暖金',ja:'冬雪・ウォームゴールド',other:'冬雪 · 银灰',otherSkin:'winter-silver'}:{kind:'silver',zh:'冬雪 · 银灰',ja:'冬雪・シルバー',other:'冬雪 · 暖金',otherSkin:'winter'};
const out=path.resolve(process.env.WINTER_TEST_OUTPUT||path.resolve(app,'../tmp/winter-app-validation'));
const env=fs.readFileSync(path.join(app,'.env'),'utf8');
const ref=new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]).hostname.split('.')[0];
const uid='00000000-0000-4000-8000-000000000093',encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated',is_anonymous:true})+'.isolated-winter';
const categories=[{id:'food',code:'food',type:'expense',zh:'食费',ja:'食費',icon:'restaurant',color:'#cc7111',subs:[]},{id:'salary',code:'salary',type:'income',zh:'工资',ja:'給与',icon:'work',color:'#32785f',subs:[]}];
const catalog={expenseCategories:[categories[0]],incomeCategories:[categories[1]],paymentMethods:[{id:'cash',code:'cash',zh:'现金',ja:'現金',pointRate:null}],expenseTags:[],incomeTags:[],pointRules:[]};
const fixture=[{id:'winter-expense',type:'expense',amount:200,catCode:'food',points:2},{id:'winter-income',type:'income',amount:500,catCode:'salary',points:null}].map(e=>({...e,currency:'JPY',subCode:null,paymentMethod:'cash',tagCode:null,note:'isolated fixture',date:'2026-11-22',recurringId:null,createdAt:1795300000000,receiptPaths:[]}));
const row=e=>({id:e.id,user_id:uid,type:e.type,amount:e.amount,currency:e.currency,cat_code:e.catCode,sub_code:e.subCode,payment_method:e.paymentMethod,tag_code:e.tagCode,note:e.note,points:e.points,entry_date:e.date,recurring_id:null,created_at:new Date(e.createdAt).toISOString(),receipt_path:null});
const results=[];let browser,server;
async function setup({theme=activeTheme,lang='zh',entries=[],remote=false,missingColumn=false}={}){
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
   if(url.pathname.endsWith('/categories'))return reply(categories.map(x=>({...x,sort_order:0})));
   if(url.pathname.endsWith('/payment_methods'))return reply([{id:'cash',code:'cash',zh:'现金',ja:'現金',sort_order:0}]);
   return reply([]);
  }
  if(url.pathname.endsWith('/recurring-rules'))return reply({rules:[]});
  return r.abort();
 });
 await ctx.addInitScript(({uid,ref,token,catalog,theme,lang,entries,remote})=>{
  document.startViewTransition=undefined;
  if(localStorage.getItem('winter-test-seeded'))return;localStorage.setItem('winter-test-seeded','yes');
  localStorage.setItem('washi_ledger_settings_cache_v1',JSON.stringify({lang,currency:'JPY',themeSkin:theme}));
  localStorage.setItem('washi_ledger_settings_last_synced_user_v1',remote?'previous-account':uid);
  localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify({access_token:token,refresh_token:'isolated-winter',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}}));
  localStorage.setItem('washi_ledger_catalog_cache_v2:'+uid,JSON.stringify(catalog));
  localStorage.setItem('washi_ledger_entries_cache_v2:'+uid,JSON.stringify(entries));
 },{uid,ref,token,catalog,theme,lang,entries,remote});
 const page=await ctx.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>state.pageErrors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-22T00:41:00Z'));
 return{ctx,page,state};
}
async function scenario(name,fn,options){let t;try{t=await setup(options);await fn(t);assert.deepEqual(t.state.pageErrors,[]);results.push({name,result:'passed'});}catch(e){results.push({name,result:'failed',error:e.message.slice(0,900)});}finally{if(t)await t.ctx.close();}}
async function skin(page,value){await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);}
async function go(page,route){await page.goto(origin+route,{waitUntil:'networkidle'});await page.locator('.app-shell').waitFor();}
async function photo(page,name){
 await page.evaluate(()=>{const shell=document.querySelector('.app-shell'),header=shell.querySelector('[data-app-header], header');if(header)header.parentElement.style.paddingTop='54px';shell.insertAdjacentHTML('afterbegin','<div aria-hidden="true" style="position:absolute;top:17px;left:29px;right:23px;z-index:20;color:#193b53;font:600 14px system-ui;display:flex;justify-content:space-between;pointer-events:none"><span>9:41</span><i style="position:absolute;left:50%;top:-5px;transform:translateX(-50%);width:112px;height:29px;border-radius:22px;background:#142632"></i><span>▮▮▮  ▰</span></div>');});
 await page.evaluate(()=>document.fonts.ready);if(name==='theme')await page.getByRole('button',{name:variant.zh,exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,name+'.png'),scale:'css'});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  await scenario('theme selector, local persistence and legacy skin switching',async({page,state})=>{
   await go(page,'/theme');await skin(page,'default');
   assert.equal(await page.getByRole('button',{name:variant.zh,exact:true}).count(),1);
   await page.getByRole('button',{name:variant.zh,exact:true}).click();await skin(page,activeTheme);
   assert.equal(await page.locator('.winter-background').count(),1);assert((await page.locator('.winter-flake').count())>=1);assert((await page.locator('.winter-flake').count())<=3);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('washi_ledger_settings_cache_v1')).themeSkin),activeTheme);
   await page.reload({waitUntil:'networkidle'});await skin(page,activeTheme);
   await page.getByRole('button',{name:variant.other,exact:true}).click();await skin(page,variant.otherSkin);
   assert.equal(await page.locator('.winter-background').count(),1);
   assert((await page.locator('.winter-background').evaluate(el=>getComputedStyle(el,'::after').backgroundImage)).includes(variant.kind==='warm'?'silver-snowflake':'warm-snowflake'));
   await page.getByRole('button',{name:variant.zh,exact:true}).click();await skin(page,activeTheme);
   for(const [name,value] of [['怀旧','nostalgia'],['夏 · 花火','summer'],['红叶 · 丹枫金秋','autumn'],['PigBang','default']]){
    await page.getByRole('button',{name,exact:true}).click();await skin(page,value);assert.equal(await page.locator('.winter-background').count(),0);
   }
   assert(state.writes.some(x=>x.theme_skin===activeTheme));
  },{theme:'default'});
  await scenario('Japanese theme selection and reload',async({page})=>{
   await go(page,'/theme');await page.getByRole('button',{name:variant.ja,exact:true}).click();await skin(page,activeTheme);
   await page.reload({waitUntil:'networkidle'});await skin(page,activeTheme);
   assert.equal(await page.getByRole('button',{name:variant.ja,exact:true}).count(),1);
  },{theme:'default',lang:'ja'});
  await scenario('remote winter decoding',async({page})=>{await go(page,'/');await skin(page,activeTheme);},{theme:'default',remote:true});
  await scenario('missing remote column preserves local theme and existing fallback',async({page,state})=>{
   await go(page,'/theme');await page.getByRole('button',{name:variant.zh,exact:true}).click();await skin(page,activeTheme);
   await page.waitForFunction(value=>JSON.parse(localStorage.getItem('washi_ledger_settings_cache_v1')).themeSkin===value,activeTheme);
   await page.waitForTimeout(100);assert(state.writes.some(x=>x.theme_skin===activeTheme));assert(state.writes.some(x=>!Object.hasOwn(x,'theme_skin')));
   await page.reload({waitUntil:'networkidle'});await skin(page,activeTheme);
  },{theme:'default',missingColumn:true});
  await scenario('single background survives route changes and does not intercept controls',async({page})=>{
   await go(page,'/');await skin(page,activeTheme);await page.evaluate(()=>window.__winterLayer=document.querySelector('.winter-background'));
   const bar=page.locator('[data-date-range-bar]');await bar.click();await page.getByRole('button',{name:'取消',exact:true}).click();
   for(const to of ['/stats','/history','/']){await page.locator('.bottom-nav-shell a[href="'+to+'"]').click();await page.waitForURL(origin+to);assert.equal(await page.evaluate(()=>window.__winterLayer===document.querySelector('.winter-background')),true);}
   assert.equal(await page.locator('.winter-background').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  });
  await scenario('animation, page lifecycle pause and reduced motion',async({page})=>{
   await go(page,'/');await skin(page,activeTheme);const flake=page.locator('.winter-flake').first(),layer=page.locator('.winter-background');
   const before=await flake.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(150);assert.notEqual(await flake.evaluate(el=>getComputedStyle(el).transform),before);
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'paused');
   await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'running');
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await page.locator('.winter-fall-layer').isVisible(),false);
   assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'paused');
   assert((await layer.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).includes(variant.kind+'-ink'));
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(50);assert.equal(await page.locator('.winter-fall-layer').isVisible(),true);
  });
  await scenario('expense and income semantics in donut and selected trend',async({page})=>{
   await go(page,'/');await skin(page,activeTheme);
   assert.equal(await page.locator('.ledger-card .text-expense').evaluate(el=>getComputedStyle(el).color),'rgb(179, 76, 85)');
   assert.equal(await page.locator('.ledger-card .text-income').evaluate(el=>getComputedStyle(el).color),'rgb(50, 120, 95)');
   assert.equal(await page.locator('main section .tabular-nums').first().evaluate(el=>getComputedStyle(el).color),'rgb(179, 76, 85)');
   await go(page,'/stats');const chart=page.locator('section').filter({has:page.getByRole('heading',{name:'收支趋势',exact:true})});
   await chart.locator('svg rect[fill="transparent"]').click();assert.equal(await chart.locator('.text-stat-figure.text-expense').evaluate(el=>getComputedStyle(el).color),'rgb(179, 76, 85)');
   await chart.getByRole('button',{name:'收入',exact:true}).click();await chart.locator('svg rect[fill="transparent"]').click();
   assert.equal(await chart.locator('.text-stat-figure.text-income').evaluate(el=>getComputedStyle(el).color),'rgb(50, 120, 95)');
  },{entries:fixture});
  await scenario('other skins do not mount or fetch winter artwork on home',async({page,state})=>{
   await go(page,'/');await skin(page,'default');assert.equal(await page.locator('.winter-background').count(),0);assert.deepEqual(state.assets,[]);
  },{theme:'default'});
  for(const width of [320,390,430,1280]){
   await scenario('layout and full background at width '+width,async({page})=>{
    await page.setViewportSize({width,height:844});for(const route of ['/','/history','/stats']){
     await go(page,route);await skin(page,activeTheme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     const box=await page.locator('.winter-background').boundingBox();assert.equal(box.width,Math.min(width,480));assert.equal(box.height,844);
    }
   });
  }
  for(const route of ['/add','/theme','/settings','/account','/account/avatar','/signin','/register','/rate','/calendar','/about','/settings/debug-log','/settings/recurring-rules','/settings/recurring-rules/form']){
   await scenario('winter shell '+route,async({page})=>{await go(page,route);await skin(page,activeTheme);assert.equal(await page.locator('.winter-background').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('.app-shell').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');});
  }
  await scenario('final empty-account screenshots',async({page})=>{
   for(const [name,route] of [['home','/'],['stats','/stats'],['theme','/theme'],['add','/add']]){await go(page,route);await skin(page,activeTheme);if(name==='theme')await page.getByRole('button',{name:variant.zh,exact:true}).scrollIntoViewIfNeeded();await photo(page,name);}
  });
 }finally{if(browser)await browser.close();if(server)server.kill();}
 fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>r.result!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
