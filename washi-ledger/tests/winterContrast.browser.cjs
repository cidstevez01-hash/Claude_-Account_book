// B-93: exercise actual controls, composed colors and state changes with isolated data.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'winterRuntime.browser.cjs');
const prefix=fs.readFileSync(file,'utf8').split('(async()=>{')[0]
 .replace("const out=path.resolve(app,'../tmp/winter-release-check');","const out=path.resolve(app,'../tmp/winter-contrast-check');");
const body=String.raw`
const fixtureCategories=[
 {...categories[0],icon:'bowl',subs:[{id:'food-one',code:'food-one',zh:'食品',ja:'食品'},{id:'food-two',code:'food-two',zh:'外食',ja:'外食'}]},
 {...categories[0],id:'daily',code:'daily',zh:'日用品',ja:'日用品',icon:'basket',color:'#5d69c2'},
 categories[1],
];
const fixture={categories:fixtureCategories,catalog:{...catalog,expenseCategories:fixtureCategories.slice(0,2),
 paymentMethods:[...catalog.paymentMethods,{id:'merpay',code:'merpay',zh:'メルペイ',ja:'メルペイ',pointRate:null}],
 expenseTags:[{id:'daily',code:'daily',zh:'日常',ja:'日常'}]}};
const entry={id:'b93-entry',type:'expense',amount:2112,currency:'JPY',catCode:'food',subCode:'food-one',paymentMethod:'cash',tagCode:null,note:'B-93 isolated fixture',points:0,date:'2026-11-22',recurringId:null,createdAt:1795300000000,receiptPaths:[]};
const ratio=(fg,bg)=>{
 const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
 const a=lum(fg),b=lum(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
async function colors(locator,{label=false,range=false}={}){
 return locator.evaluate((el,{label,range})=>{
  const leaf=label?el.lastElementChild:el;
  const style=getComputedStyle(leaf);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const parse=c=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1);const a=ctx.getImageData(0,0,1,1).data;return[a[0],a[1],a[2],a[3]/255];};
  let rgb=[255,255,255],chain=[];
  for(let n=leaf;n;n=n.parentElement)chain.unshift(n);
  for(const n of chain){const c=parse(getComputedStyle(n).backgroundColor);rgb=c.slice(0,3).map((v,i)=>Math.round(v*c[3]+rgb[i]*(1-c[3])));}
  const band=range?el.parentElement.querySelector('span.absolute'):null;
  return{fg:style.color,bg:band&&style.backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(band).backgroundColor:'rgb('+rgb.join(',')+')',
   border:getComputedStyle(el).borderColor,marker:getComputedStyle(el,'::after').content,markerStroke:getComputedStyle(el,'::after').borderRightWidth};
 },{label,range});
}
async function readable(locator,options){const pair=await colors(locator,options);assert(ratio(pair.fg,pair.bg)>=4.5,JSON.stringify({label:await locator.textContent(),...pair}));return pair;}
async function choice(locator,{label=false}={}){
 assert.equal(await locator.getAttribute('aria-pressed'),'true');
 const pair=await readable(locator,{label});assert.equal(pair.marker,'""');assert.equal(pair.markerStroke,'2px');
 assert(ratio(pair.border,pair.bg)>=3,JSON.stringify(pair));
}
async function open(page,theme,route){
 await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('.app-shell').waitFor({timeout:30000});
 await skin(page,theme);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
}
async function settledClick(locator){await locator.click();await locator.page().waitForTimeout(220);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const theme of ['winter','winter-silver'])for(const lang of ['zh','ja'])await scenario('winter control readability and selection: '+theme+' '+lang,async({page,state})=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   const food=lang==='zh'?'食费':'食費',cash=lang==='zh'?'现金':'現金';
   for(const route of ['/','/history']){
    await open(page,theme,route);await settledClick(page.locator('[data-date-range-bar]'));
    const panel=page.locator('.picker-panel-glass'),day=n=>panel.getByRole('button',{name:String(n),exact:true});
    for(const n of [1,2,15,29,30])await readable(day(n).locator('span').last(),{range:true});
    if(route==='/'&&lang==='zh')await page.screenshot({path:path.join(out,theme+'-range.png'),scale:'css'});
    await day(15).click();assert.equal(await day(15).getAttribute('aria-pressed'),'true');assert.equal(await day(30).getAttribute('aria-pressed'),'true');assert.equal(await day(1).getAttribute('aria-pressed'),'false');
    const month=panel.getByRole('button',{name:'2026年11月',exact:true});await readable(month);await month.click();
    await readable(panel.getByRole('button',{name:'11月',exact:true}));await panel.getByRole('button',{name:'2026年',exact:true}).click();
    await readable(panel.getByRole('button',{name:'2026',exact:true}));await readable(panel.locator('[data-calendar-adjacent]').first());
   }
   for(const route of ['/add','/add?editId=b93-entry','/add?copyId=b93-entry']){
    await open(page,theme,route);const button=name=>page.getByRole('button',{name,exact:true});
    await settledClick(button(food));await choice(button(food),{label:true});
    if(await button('食品').getAttribute('aria-pressed')!=='true')await settledClick(button('食品'));await choice(button('食品'));
    await settledClick(button('外食'));await choice(button('外食'));assert.equal(await button('食品').getAttribute('aria-pressed'),'false');
    await settledClick(button('メルペイ'));await choice(button('メルペイ'));assert.equal(await button(cash).getAttribute('aria-pressed'),'false');
    await settledClick(button('日用品'));await choice(button('日用品'),{label:true});assert.equal(await button(food).getAttribute('aria-pressed'),'false');
    for(const width of [320,390]){
     await page.setViewportSize({width,height:844});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     const clipped=await page.locator('.choice-control').evaluateAll(nodes=>nodes.some(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth;}));assert.equal(clipped,false);
    }
    if(route.includes('editId')){const save=button(lang==='zh'?'保存':'保存');assert.equal(await save.isEnabled(),true);await readable(save);}
    if(route==='/add'&&lang==='zh'){
     await settledClick(button(food));await page.locator('main').evaluate(el=>el.scrollTo(0,0));await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:path.join(out,theme+'-add.png'),scale:'css'});
    }
   }
   for(const route of ['/rate','/settings/recurring-rules/form','/account','/signin','/register']){
    await open(page,theme,route);
    for(const el of await page.locator('button.text-action-ink, a.text-action-ink, button.bg-action').all())await readable(el);
    if(route.includes('recurring'))for(const el of await page.locator('.choice-control[aria-pressed="true"]').all())await choice(el);
   }
   assert.equal(state.writes.length,0,'audit attempted a remote write');
  },{theme,lang,entries:[entry],fixture});
  for(const theme of ['default','nostalgia','summer','autumn'])await scenario('other themes retain control palette: '+theme,async({page})=>{
   await open(page,theme,'/add');const values=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);const probe=document.createElement('span');document.body.append(probe);const resolve=n=>{probe.style.color='var('+n+')';return getComputedStyle(probe).color;};const pairs=[['--color-action','--color-primary'],['--color-on-action','--color-on-primary'],['--color-action-ink','--color-primary'],['--color-choice-fill','--color-primary-fixed'],['--color-range-day-ink','--color-selected-day-ink']].map(([a,b])=>[resolve(a),resolve(b)]);probe.remove();return pairs;});assert(values.every(([a,b])=>a===b),JSON.stringify(values));
   const selected=page.locator('.choice-control--tile[aria-pressed="true"]').first();assert.equal((await colors(selected,{label:true})).marker,'none');
  },{theme,fixture});
  // Re-capture the empty-book pages used in the current design asset index.
  for(const theme of ['winter','winter-silver']){
   const {page,ctx}=await setup({theme});await page.emulateMedia({reducedMotion:'reduce'});
   for(const [name,route]of [['home','/'],['stats','/stats']]){await open(page,theme,route);await page.screenshot({path:path.join(out,theme+'-'+name+'.png'),scale:'css'});}
   await ctx.close();
  }
 }finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));await browser?.close();server?.kill();}
 console.log(JSON.stringify(results));if(results.some(r=>r.result!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
`;
const compiled=new Module(file,module);compiled.filename=file;compiled.paths=module.paths;compiled._compile(prefix+body,file);
