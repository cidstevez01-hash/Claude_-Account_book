// Actual scan sheet and add/edit/copy pages; native camera/OCR and storage are isolated mocks.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'winterRuntime.browser.cjs');
const prefix=fs.readFileSync(file,'utf8').split('(async()=>{')[0]
 .replace('http://127.0.0.1:5275','http://127.0.0.1:5277')
 .replace("const out=path.resolve(app,'../tmp/winter-release-check');","const out=path.resolve(app,'../tmp/receipt-autofill-check');");
const body=String.raw`
const entry={id:'receipt-source',type:'expense',amount:2112,currency:'JPY',catCode:'food',subCode:null,paymentMethod:'cash',tagCode:null,note:'original-note',points:0,date:'2026-11-22',recurringId:null,createdAt:1795300000000,receiptPaths:[]};
async function instrument({ctx,state}) {
 state.uploads=[];state.failUpload=false;
 await ctx.route('**/src/lib/receiptCamera.ts*',r=>r.fulfill({contentType:'application/javascript',body:
  'async function image(){const c=document.createElement("canvas");c.width=300+(window.__scanNumber=(window.__scanNumber||0)+1);c.height=600;c.getContext("2d").fillRect(0,0,c.width,c.height);return new Promise(resolve=>c.toBlob(resolve,"image/jpeg"));}export const scanDocumentNative=image,pickFromGallery=image;'}));
 await ctx.route('**/node_modules/.vite/deps/*image-to-text*',r=>r.fulfill({contentType:'application/javascript',body:
  'window.__ocrJobs=[];function run(engine,base64){return new Promise((resolve,reject)=>window.__ocrJobs.push({engine,base64,resolve,reject}));}export const Ocr={detectTextMlkit:({base64})=>run("mlkit",base64),detectText:({base64})=>run("vision",base64)};'}));
 await ctx.route('**/storage/v1/object/receipts/**',async r=>{
  state.uploads.push({method:r.request().method(),pdf:r.request().postDataBuffer()?.includes(Buffer.from('%PDF-'))});
  return r.fulfill({status:state.failUpload?500:200,contentType:'application/json',body:JSON.stringify(state.failUpload?{message:'isolated upload failure'}:{Key:'isolated-receipt.pdf'})});
 });
}
async function begin(page,more=false,ja=false) {
 await page.getByRole('button',{name:ja?(more?'追加でスキャン':'レシートをスキャン'):(more?'继续扫描':'扫描小票'),exact:true}).click();
 await page.getByRole('heading',{name:ja?'スキャン結果を確認':'确认扫描结果',exact:true}).waitFor();
 await page.locator('button[aria-label="'+(ja?'撮り直す':'重新拍摄')+'"]').waitFor();
}
async function complete(page,index,lines) {
 await page.waitForFunction(index=>window.__ocrJobs?.length>index,index);
 return page.evaluate(({index,lines})=>{
  const job=window.__ocrJobs[index];job.resolve({textDetections:lines.map((text,i)=>({text,
   topLeft:[.1,.9-i*.045],topRight:[.9,.9-i*.045],bottomLeft:[.1,.88-i*.045],bottomRight:[.9,.88-i*.045]}))});
  return job.engine;
 },{index,lines});
}
const lines=amount=>['店舗','2026年11月17日(火)19:51','合計 ¥'+amount];
async function confirm(page,state,count,ja=false) {
 await page.getByRole('button',{name:ja?'PDFとして保存':'存为PDF',exact:true}).click();
 await page.getByRole('heading',{name:ja?'スキャン結果を確認':'确认扫描结果',exact:true}).waitFor({state:'hidden'});
 assert.equal(state.uploads.length,count);assert(state.uploads.every(x=>x.pdf));
}
async function visit(page,route) {await page.goto(origin+route,{waitUntil:'networkidle'});await page.locator('input[inputmode="decimal"]').waitFor();}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try {
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5277','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const route of ['/add','/add?editId=receipt-source','/add?copyId=receipt-source'])await scenario('ML Kit autofill, manual values and multiple receipts: '+route,async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,route);await begin(page);
   assert.equal(await complete(page,0,lines(1204)),'mlkit');await confirm(page,state,1);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'1204');
   assert.equal(await page.locator('input[type=date]').inputValue(),'2026-11-17');
   assert((await page.locator('textarea').inputValue()).includes('店舗'));
   await begin(page,true);await complete(page,1,lines(967));await confirm(page,state,2);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'2171');
   await page.locator('input[inputmode="decimal"]').fill('777');await page.locator('input[type=date]').fill('2026-11-01');
   await begin(page,true);await complete(page,2,lines(999));await confirm(page,state,3);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'777');
   assert.equal(await page.locator('input[type=date]').inputValue(),'2026-11-01');
   assert.equal(state.writes.length,0);
  },{theme:'winter',entries:[entry]});
  await scenario('ML Kit failure uses same image Vision fallback',async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,'/add');await begin(page);
   await page.waitForFunction(()=>window.__ocrJobs?.length===1);await page.evaluate(()=>window.__ocrJobs[0].reject(Error('MLKIT_RECOGNITION_FAILED')));
   assert.equal(await complete(page,1,lines(537)),'vision');
   assert.equal(await page.evaluate(()=>window.__ocrJobs[0].base64===window.__ocrJobs[1].base64),true);
   await confirm(page,state,1);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'537');
  },{theme:'winter-silver'});
  await scenario('no confirmed total restores original edit amount',async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,'/add?editId=receipt-source');await begin(page);
   await complete(page,0,['店舗']);await complete(page,1,['店舗']);await confirm(page,state,1);
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'2112');
  },{entries:[entry]});
  await scenario('saving waits past five seconds for OCR and disables retake',async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,'/add');await begin(page);
   await page.getByRole('button',{name:'存为PDF',exact:true}).click();await page.waitForTimeout(5200);
   assert.equal(await page.getByRole('button',{name:'正在识别小票…',exact:true}).isDisabled(),true);
   assert.equal(await page.getByRole('button',{name:'重新拍摄',exact:true}).isDisabled(),true);assert.equal(state.uploads.length,0);
   await complete(page,0,lines(1204));await page.getByRole('heading',{name:'确认扫描结果',exact:true}).waitFor({state:'hidden'});
   assert.equal(state.uploads.length,1);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'1204');
  });
  await scenario('close and retake discard late OCR from earlier scan',async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,'/add');await begin(page);
   await page.getByRole('button',{name:'关闭',exact:true}).click();await complete(page,0,lines(5000));
   assert.equal(state.uploads.length,0);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'');
   await begin(page);await page.getByRole('button',{name:'重新拍摄',exact:true}).click();
   await page.waitForFunction(()=>window.__ocrJobs?.length===3);await complete(page,1,lines(8888));await complete(page,2,lines(430));
   await confirm(page,state,1);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'430');
   assert(!(await page.locator('textarea').inputValue()).includes('8888'));
  });
  await scenario('upload failure keeps preview and retry adds receipt only once (Japanese)',async(test)=>{
   const {page,state}=test;await instrument(test);await visit(page,'/add');await begin(page,false,true);await complete(page,0,lines(1880));
   state.failUpload=true;await page.getByRole('button',{name:'PDFとして保存',exact:true}).click();await page.getByText('保存に失敗しました。もう一度お試しください',{exact:true}).waitFor();
   assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'');
   state.failUpload=false;await confirm(page,state,2,true);assert.equal(await page.locator('input[inputmode="decimal"]').inputValue(),'1880');
   await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  },{theme:'winter-silver',lang:'ja'});
 }finally {fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({scope:'Actual application and parser; native SDK and storage mocked. No live account, database or cloud OCR calls.',results},null,2));await browser?.close();server?.kill();}
 console.log(JSON.stringify(results));if(results.some(x=>x.result!=='passed'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(prefix+body,file);
