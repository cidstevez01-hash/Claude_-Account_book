const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app=path.resolve(__dirname,'..'),origin='http://127.0.0.1:5261';
const env=fs.readFileSync(path.join(app,'.env'),'utf8'),service=new URL(env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/)[1]),ref=service.hostname.split('.')[0];
const uid='00000000-0000-4000-8000-000000000090',encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated',is_anonymous:true})+'.isolated-b90';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const categories=[{id:'food',code:'food',type:'expense',zh:'食费',ja:'食費',icon:'restaurant',color:'#cc7111',subs:[]},{id:'other',code:'other',type:'expense',zh:'其他',ja:'その他',icon:'category',color:'#55aa33',subs:[]}];
const catalog={expenseCategories:categories,incomeCategories:[],paymentMethods:[{id:'cash',code:'cash',zh:'现金',ja:'現金',pointRate:null}],expenseTags:[],incomeTags:[],pointRules:[]};
const oldEntry={id:'b90-entry',type:'expense',amount:1234,currency:'JPY',catCode:'food',subCode:null,paymentMethod:'cash',tagCode:null,note:'before-b90',points:null,date:today,recurringId:null,createdAt:Date.now()-60000,receiptPaths:[]};
const otherAccount={...oldEntry,id:'other-account-entry',amount:9000,note:'must-not-change'};
const row=e=>({id:e.id,user_id:uid,type:e.type,amount:e.amount,currency:e.currency,cat_code:e.catCode,sub_code:e.subCode,payment_method:e.paymentMethod,tag_code:e.tagCode,note:e.note,points:e.points,entry_date:e.date,recurring_id:e.recurringId,created_at:new Date(e.createdAt).toISOString(),receipt_path:e.receiptPaths.length?JSON.stringify(e.receiptPaths):null});
let browser,server;const results=[];
async function setup(){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',timezoneId:'Asia/Tokyo'});
  await ctx.routeWebSocket('**/*',ws=>ws.close());
  const state={rows:[row(oldEntry)],held:[],hold:false,failSave:false,saveCount:0};
  await ctx.route('**/*',async r=>{
    const req=r.request(),u=new URL(req.url());if(req.url().startsWith(origin))return r.continue();
    const reply=body=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(u.pathname.endsWith('/entries')&&req.method()==='GET'){
      if(state.hold){state.held.push(r);return;}return reply({entries:state.rows});
    }
    if(u.pathname.endsWith('/entries/upsert-bulk')){
      state.saveCount++;
      if(state.failSave)return r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'test save rejected'})});
      for(const item of req.postDataJSON().entries){const next={...item,created_at:state.rows.find(x=>x.id===item.id)?.created_at??new Date().toISOString()};state.rows=[...state.rows.filter(x=>x.id!==item.id),next];}
      state.hold=true;return reply({});
    }
    if(req.method()==='DELETE'&&u.pathname.includes('/entries/')){state.rows=state.rows.filter(x=>x.id!==decodeURIComponent(u.pathname.split('/').pop()));return reply({});}
    if(u.pathname.startsWith('/rest/v1/')){
      const table=u.pathname.split('/').pop();
      if(table==='categories')return reply(categories.map(x=>({...x,sort_order:0})));
      if(table==='payment_methods')return reply([{id:'cash',code:'cash',zh:'现金',ja:'現金',icon:null,default_point_rate:null,sort_order:0}]);
      return reply([]);
    }
    if(u.pathname.endsWith('/recurring-rules'))return reply({rules:[]});
    return r.abort();
  });
  await ctx.addInitScript(({uid,ref,token,catalog,oldEntry,otherAccount})=>{
    document.startViewTransition=undefined;
    if(localStorage.getItem('b90-initialized'))return;
    localStorage.setItem('b90-initialized','yes');
    localStorage.setItem('washi_ledger_settings_cache_v1',JSON.stringify({lang:'zh',currency:'JPY',themeSkin:'default'}));
    localStorage.setItem('washi_ledger_settings_last_synced_user_v1',uid);
    localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify({access_token:token,refresh_token:'isolated-b90',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00Z'}}));
    localStorage.setItem('washi_ledger_catalog_cache_v2:'+uid,JSON.stringify(catalog));
    localStorage.setItem('washi_ledger_entries_cache_v2:'+uid,JSON.stringify([oldEntry]));
    localStorage.setItem('washi_ledger_entries_cache_v2:other-account',JSON.stringify([otherAccount]));
  },{uid,ref,token,catalog,oldEntry,otherAccount});
  const page=await ctx.newPage();page.setDefaultTimeout(7000);
  return {ctx,page,state};
}
const detail=p=>p.getByRole('heading',{name:'详情',exact:true}).locator('..').locator('..');
async function open(page,entrypoint){
  await page.goto(origin+(entrypoint==='history'?'/history':entrypoint==='calendar'?'/calendar':entrypoint==='stats-category'?'/stats':'/'),{waitUntil:'domcontentloaded'});
  if(entrypoint.endsWith('category')){
    await page.getByRole('button').filter({hasText:'食费'}).first().click();
    await page.locator('.entry-card').last().click();
  }else await page.locator('.entry-card').first().click();
  await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});
}
async function release(state){state.hold=false;for(const r of state.held.splice(0))await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({entries:state.rows})});}
async function scenario(name,fn){if(process.env.B90_CASE&&!name.includes(process.env.B90_CASE))return;let test;try{test=await setup();await fn(test);results.push({name,result:'passed'});}catch(e){results.push({name,result:'failed',error:e.message.slice(0,500)});}finally{if(test){await release(test.state).catch(()=>{});await test.ctx.close();}}}
(async()=>{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5261','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve()}});server.on('exit',c=>reject(Error('server exit '+c)))});
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  for(const entrypoint of ['history','dashboard','dashboard-category','stats-category','calendar']){
    await scenario(entrypoint+' 编辑返回即显示最新数据，并跟随随后同步',async({page,state})=>{
      await open(page,entrypoint);await page.getByRole('button',{name:'编辑',exact:true}).click();await page.waitForURL('**/add?editId=*');
      await page.locator('input[inputmode=decimal]').fill('2345');await page.locator('textarea').fill('after-b90');await page.getByRole('button',{name:'保存',exact:true}).click();
      await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});
      assert((await detail(page).innerText()).includes('after-b90'),'Return detail still shows the stale entry');
      assert((await detail(page).innerText()).includes('2,345'),'Return detail has wrong amount');
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('washi_ledger_entries_cache_v2:other-account'))),[otherAccount]);
      state.rows=state.rows.map(x=>({...x,amount:3456,note:'server-fresh-b90'}));await release(state);
      await page.waitForFunction(()=>document.querySelector('h2')&&document.body.innerText.includes('server-fresh-b90'));
      assert((await detail(page).innerText()).includes('3,456'),'Open detail did not follow updated parent records');
    });
  }
  await scenario('日期移出首页范围仍恢复新详情',async({page,state})=>{
    await open(page,'dashboard');await page.getByRole('button',{name:'编辑',exact:true}).click();await page.locator('input[type=date]').fill('2020-01-01');await page.locator('textarea').fill('outside-date-b90');await page.getByRole('button',{name:'保存',exact:true}).click();
    await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});assert((await detail(page).innerText()).includes('outside-date-b90'));await release(state);
  });
  await scenario('分类移出钻取范围仍恢复新详情',async({page,state})=>{
    await open(page,'dashboard-category');await page.getByRole('button',{name:'编辑',exact:true}).click();await page.getByRole('button',{name:'其他',exact:true}).click();await page.locator('textarea').fill('outside-category-b90');await page.getByRole('button',{name:'保存',exact:true}).click();
    await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});assert((await detail(page).innerText()).includes('outside-category-b90'));assert((await detail(page).innerText()).includes('其他'));await release(state);
  });
  await scenario('复制返回新记录，原记录保留',async({page,state})=>{
    await open(page,'history');await page.getByRole('button',{name:'复制',exact:true}).click();await page.waitForURL('**/add?copyId=*');await page.locator('input[inputmode=decimal]').fill('4567');await page.locator('textarea').fill('copy-b90');await page.getByRole('button',{name:'保存',exact:true}).click();
    await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});assert((await detail(page).innerText()).includes('copy-b90'));assert.equal(state.rows.length,2);assert.equal(state.rows.find(x=>x.id===oldEntry.id).note,oldEntry.note);await release(state);
  });
  await scenario('取消编辑不污染缓存或详情',async({page,state})=>{
    await open(page,'history');await page.getByRole('button',{name:'编辑',exact:true}).click();await page.locator('textarea').fill('unsaved-b90');await page.getByRole('button',{name:'返回',exact:true}).click();
    await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'visible'});assert((await detail(page).innerText()).includes('before-b90'));assert.equal(state.saveCount,0);assert.equal(await page.evaluate(uid=>JSON.parse(localStorage.getItem('washi_ledger_entries_cache_v2:'+uid))[0].note,uid),'before-b90');
  });
  await scenario('保存失败不返回或覆盖已确认缓存',async({page,state})=>{
    await open(page,'history');await page.getByRole('button',{name:'编辑',exact:true}).click();state.failSave=true;await page.locator('textarea').fill('rejected-b90');await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForFunction(()=>document.body.innerText.includes('保存失败'));
    assert(page.url().includes('/add?editId='));assert.equal(await page.evaluate(uid=>JSON.parse(localStorage.getItem('washi_ledger_entries_cache_v2:'+uid))[0].note,uid),'before-b90');
  });
  await scenario('删除确认取消保留详情，确认删除关闭详情',async({page,state})=>{
    await open(page,'history');await page.getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert(await page.getByRole('heading',{name:'详情',exact:true}).isVisible());
    await page.getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'删除',exact:true}).last().click();await page.getByRole('heading',{name:'详情',exact:true}).waitFor({state:'hidden'});assert.equal(state.rows.length,0);
  });
  if(process.env.B90_RESULTS_FILE)fs.writeFileSync(process.env.B90_RESULTS_FILE,JSON.stringify({scope:'Actual app and HTTP mocks only. No real account/database/storage calls. UI styles unchanged.',results},null,2));console.log(JSON.stringify(results,null,2));if(results.some(x=>x.result!=='passed'))process.exitCode=1;
})().finally(async()=>{if(browser)await browser.close();if(server)server.kill()}).catch(e=>{console.error(e);process.exitCode=1});
