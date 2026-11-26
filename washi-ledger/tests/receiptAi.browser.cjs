// Real scan and entry forms, with isolated camera, native OCR, API and storage responses.
const fs=require('fs'),path=require('path'),Module=require('module')
const file=path.join(__dirname,'winterRuntime.browser.cjs')
const prefix=fs.readFileSync(file,'utf8').split('(async()=>{')[0]
 .replace('http://127.0.0.1:5275','http://127.0.0.1:5281')
 .replace("const out=path.resolve(app,'../tmp/winter-release-check');","const out=path.resolve(app,'../tmp/receipt-ai-check');")
const helpers=fs.readFileSync(path.join(__dirname,'receiptAutofill.browser.cjs'),'utf8')
 .split('const body=String.raw`')[1].split('(async()=>{')[0]
const body=String.raw`
const aiFields={amount:258,currency:'JPY',date:'2026-11-26',storeName:'FamilyMart',items:['グリルチキン ¥258'],paymentAmount:258,taxAmount:19,totalEvidence:'合計 ¥258',paymentEvidence:'メルペイ支払 ¥258',uncertain:false};
async function mockAi(test,{status=200,fields=aiFields,delay=0,wrongId=false}={}){
 test.state.aiCalls=[];
 await test.ctx.route('**/receipts/recognize',async route=>{
  const req=route.request(),data=req.postDataJSON();test.state.aiCalls.push(data);
  assert.equal(req.headers().authorization,'Bearer '+token);
  assert(data.image.startsWith('data:image/jpeg;base64,'));assert(!('model'in data));
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  try{await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?
   {receiptId:wrongId?'wrong-id':data.receiptId,fields}:{error:status===503?'RECEIPT_AI_NOT_CONFIGURED':'RECEIPT_AI_RATE_LIMITED'})});}catch{}
 });
}
async function start(test,route='/add',ja=false){await instrument(test);await visit(test.page,route);await begin(test.page,false,ja);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5281','--strictPort'],{cwd:app,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const route of ['/add','/add?editId=receipt-source','/add?copyId=receipt-source'])await scenario('AI 258 fills actual entry form: '+route,async test=>{
   const {page,state}=test;await mockAi(test);await start(test,route);
   assert.equal(state.aiCalls.length,0);
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();
   await page.getByRole('status').filter({hasText:'AI 识别结果'}).waitFor();
   assert((await page.getByRole('status').filter({hasText:'AI 识别结果'}).textContent()).includes('258'));
   assert.equal(state.aiCalls.length,1);
   // Native OCR finishing late must not replace AI fields.
   await complete(page,0,lines(9999));await confirm(page,state,1);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'258');
   assert.equal(await page.locator('input[type=date]').inputValue(),'2026-11-26');
   assert((await page.locator('textarea').inputValue()).includes('FamilyMart'));assert.equal(state.writes.length,0);
  },{entries:[entry]});
  await scenario('AI error retains native fields and explains missing configuration',async test=>{
   const {page,state}=test;await mockAi(test,{status:503});await start(test);await complete(page,0,lines(1204));
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();await page.getByRole('alert').waitFor();
   assert((await page.getByRole('alert').textContent()).includes('尚未配置'));
   await confirm(page,state,1);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'1204');
  });
  await scenario('double click makes one call and save waits while AI is running',async test=>{
   const {page,state}=test;await mockAi(test,{delay:600});await start(test);
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).dblclick({delay:1});
   assert.equal(await page.getByRole('button',{name:'存为PDF',exact:true}).isDisabled(),true);
   await page.getByRole('status').filter({hasText:'AI 识别结果'}).waitFor();assert.equal(state.aiCalls.length,1);
  });
  await scenario('close and retake discard late AI responses',async test=>{
   const {page,state}=test;await mockAi(test,{delay:600});await start(test);
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();await page.waitForTimeout(80);
   await page.getByRole('button',{name:'关闭',exact:true}).click();await page.waitForTimeout(700);
   await begin(page);await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();await page.waitForTimeout(80);
   await page.getByRole('button',{name:'重新拍摄',exact:true}).click();await page.waitForTimeout(700);
   assert.equal(await page.getByRole('status').filter({hasText:'AI 识别结果'}).count(),0);
   await complete(page,2,lines(430));await confirm(page,state,1);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'430');
  });
  await scenario('Japanese AI UI, mobile width, and unchanged PDF canvas dimensions',async test=>{
   const {page,state}=test;await mockAi(test);await start(test,'/add',true);
   await page.evaluate(()=>{window.__pdfDimensions=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){if(args[0]instanceof HTMLCanvasElement)window.__pdfDimensions.push([args[0].width,args[0].height]);return draw.apply(this,args)}});
   await page.getByRole('button',{name:'AIで再読み取り',exact:true}).click();
   await page.getByRole('status').filter({hasText:'AI読み取り結果'}).waitFor();
   await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByRole('status').filter({hasText:'AI読み取り結果'}).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'ai-review-ja.png')});
   const dims=await page.evaluate(()=>window.__pdfDimensions);assert.deepEqual(dims,[[301,600]]);
   await confirm(page,state,1,true);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'258');
  },{lang:'ja',theme:'winter-silver'});
  await scenario('uncertain result leaves manual amount intact',async test=>{
   const {page,state}=test;await mockAi(test,{fields:{...aiFields,uncertain:true}});await start(test);
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();
   await page.getByRole('status').filter({hasText:'AI 识别结果'}).waitFor();await confirm(page,state,1);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'');
  });
  await scenario('response from different receipt ID is rejected and native result retained',async test=>{
   const {page,state}=test;await mockAi(test,{wrongId:true});await start(test);await complete(page,0,lines(430));
   await page.getByRole('button',{name:'AI 重新识别',exact:true}).click();await page.getByRole('alert').waitFor();
   await confirm(page,state,1);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'430');
  });
 }finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({scope:'Real UI with isolated responses; no paid API or live account writes.',results},null,2));await browser?.close();server?.kill();}
 console.log(JSON.stringify(results));if(results.some(x=>x.result!=='passed'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
`;
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(prefix+helpers+body,file)
