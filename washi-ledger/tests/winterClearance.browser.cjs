// Winter theme checks use isolated account/data responses; live writes are blocked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=path.resolve(__dirname,'..'),origin='http://127.0.0.1:5275';
const activeTheme=process.env.WINTER_SKIN||'winter';
assert(['winter','winter-silver'].includes(activeTheme));
const variant=activeTheme==='winter'?{kind:'warm',zh:'冬雪 · 暖金',ja:'冬雪・ウォームゴールド',other:'冬雪 · 银灰',otherSkin:'winter-silver'}:{kind:'silver',zh:'冬雪 · 银灰',ja:'冬雪・シルバー',other:'冬雪 · 暖金',otherSkin:'winter'};
const out=path.resolve(app,'../tmp/winter-clearance-'+variant.kind);
const env=fs.readFileSync(path.join(app,'.env'),'utf8');
const ref=new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]).hostname.split('.')[0];
const uid='00000000-0000-4000-8000-000000000093',encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated',is_anonymous:true})+'.isolated-winter';
const categories=[{id:'food',code:'food',type:'expense',zh:'食费',ja:'食費',icon:'restaurant',color:'#cc7111',subs:[]},{id:'salary',code:'salary',type:'income',zh:'工资',ja:'給与',icon:'work',color:'#32785f',subs:[]}];
const catalog={expenseCategories:[categories[0]],incomeCategories:[categories[1]],paymentMethods:[{id:'cash',code:'cash',zh:'现金',ja:'現金',pointRate:null}],expenseTags:[],incomeTags:[],pointRules:[]};
const row=e=>({id:e.id,user_id:uid,type:e.type,amount:e.amount,currency:e.currency,cat_code:e.catCode,sub_code:e.subCode,payment_method:e.paymentMethod,tag_code:e.tagCode,note:e.note,points:e.points,entry_date:e.date,recurring_id:null,created_at:new Date(e.createdAt).toISOString(),receipt_path:null});
let browser,server;
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
async function skin(page,value){await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);}
async function go(page,route){await page.goto(origin+route,{waitUntil:'networkidle'});await page.locator('.app-shell').waitFor();}
async function photo(page,name){
 await page.evaluate(()=>{const shell=document.querySelector('.app-shell'),header=shell.querySelector('[data-app-header], header');if(header)header.parentElement.style.paddingTop='54px';shell.insertAdjacentHTML('afterbegin','<div aria-hidden="true" style="position:absolute;top:17px;left:29px;right:23px;z-index:20;color:#193b53;font:600 14px system-ui;display:flex;justify-content:space-between;pointer-events:none"><span>9:41</span><i style="position:absolute;left:50%;top:-5px;transform:translateX(-50%);width:112px;height:29px;border-radius:22px;background:#142632"></i><span>▮▮▮  ▰</span></div>');});
 await page.evaluate(()=>document.fonts.ready);if(name==='theme')await page.getByRole('button',{name:variant.zh,exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,name+'.png'),scale:'css'});
}
const sharp=require('C:/Users/Zero1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const crypto=require('crypto');
const design=path.resolve(app,'../design-assets/themes/pigbang-winter-snow/history/'+(activeTheme==='winter'?'20261123-22-warm-clearance':'20261123-23-silver-clearance'));
const composition=JSON.parse(fs.readFileSync(path.join(design,'composition.json'),'utf8'));
function inside(point,polygon){let sign=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);if(Math.abs(cross)<1e-6)continue;const current=Math.sign(cross);if(sign&&current!==sign)return false;sign=current;}return true;}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report=[];
 try{
  const asset=path.join(app,'src/assets/themes/winter/'+variant.kind+'-snowflake.png');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex'),composition.approvedSnowflake.sha256);
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);server.on('exit',code=>{if(code)reject(Error('Vite exit '+code));});});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const{ctx,page,state}=await setup();await go(page,'/');await skin(page,activeTheme);
  assert.equal(await page.getByRole('heading',{name:'PigBang',exact:true}).count(),1);
  const isolate=await page.addStyleTag({content:'.app-shell{visibility:hidden!important}html,body,#root{background:transparent!important}.winter-background{background:transparent!important}.winter-background::after{display:none!important}.winter-fall-layer{display:none!important}'});
  for(const width of[320,390,1280]){
   await page.setViewportSize({width,height:844});const visibleWidth=Math.min(width,480),layer=page.locator('.winter-background');
   const cleared=await layer.screenshot({omitBackground:true});
   const removeMask=await page.addStyleTag({content:'.winter-background::before{mask-image:none!important;-webkit-mask-image:none!important}'});const original=await layer.screenshot({omitBackground:true});await removeMask.evaluate(el=>el.remove());
   const a=await sharp(original).ensureAlpha().raw().toBuffer(),b=await sharp(cleared).ensureAlpha().raw().toBuffer();const corners=[{id:'top',x:visibleWidth-340+115,y:-82,size:340},{id:'bottom',x:-145,y:644,size:300}],checks=[];
   for(const corner of corners){let overlap=0,remaining=0;for(let y=0;y<844;y++)for(let x=0;x<visibleWidth;x++){if(!inside([(x-corner.x)*740/corner.size,(y-corner.y)*740/corner.size],composition.clearance.contour))continue;const k=(y*visibleWidth+x)*4+3;if(a[k]>3){overlap++;remaining=Math.max(remaining,b[k]);}}assert(remaining<=2);checks.push({corner:corner.id,overlappingInkPixelsRemoved:overlap,maxRemainingAlpha:remaining});}
   assert(checks.reduce((sum,c)=>sum+c.overlappingInkPixelsRemoved,0)>20);report.push({viewport:width,backgroundWidth:visibleWidth,clearance:checks});
   if(width===390){
    fs.writeFileSync(path.join(out,'actual-ink-with-clearance.png'),cleared);const expected=await sharp(path.join(design,'ink-with-clearance.png')).ensureAlpha().raw().toBuffer();assert.equal(expected.length,b.length);let error=0;for(let i=3;i<b.length;i+=4)error+=Math.abs(b[i]-expected[i]);error/=(b.length/4);assert(error<.6,'App pigment placement differs from approved preview');report.push({meanAlphaErrorAgainstApprovedPreview:Number(error.toFixed(4))});
   }
  }
  await isolate.evaluate(el=>el.remove());await page.setViewportSize({width:390,height:844});
  for(const[name,route]of[['home','/'],['stats','/stats'],['theme','/theme'],['add','/add']]){await go(page,route);await skin(page,activeTheme);if(name==='theme'){assert.equal(await page.getByRole('button',{name:variant.zh,exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:variant.other,exact:true}).count(),1);await page.getByRole('button',{name:'冬雪 · 暖金',exact:true}).scrollIntoViewIfNeeded();}await photo(page,name);}
  assert.deepEqual(state.pageErrors,[]);await ctx.close();report.push({theme:activeTheme,integrated:true,approvedSnowflakeHashLocked:true,pageErrors:[]});
  fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
