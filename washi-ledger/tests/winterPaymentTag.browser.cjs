// B-94: actual payment/tag controls, including wide labels and existing brand artwork.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'winterRuntime.browser.cjs');
const prefix=fs.readFileSync(file,'utf8').split('(async()=>{')[0]
 .replace("const out=path.resolve(app,'../tmp/winter-release-check');","const out=path.resolve(app,'../tmp/winter-payment-tag-check');")
 .replace('viewport:{width:390,height:844}','viewport:{width:390,height:844},deviceScaleFactor:3');
const helpers=fs.readFileSync(path.join(__dirname,'winterContrast.browser.cjs'),'utf8').split('const body=String.raw`')[1].split('(async()=>{')[0];
const body=String.raw`
const sharp=require(process.env.SHARP_MODULE||'sharp');
fixture.catalog.paymentMethods=[
 ['cash','现金','現金','pm-cash'],['credit','信用卡','クレジットカード','pm-credit'],
 ['merpay','メルペイ','メルペイ','pm-merpay'],['rakuten','楽天ペイ','楽天ペイ','pm-rakuten'],
 ['bank','银行转账','銀行振込','pm-bank'],['paidy','ペイディ','ペイディ','pm-paidy'],
 ['amazon','Amazon','Amazon','pm-amazon'],['suica','Suica','Suica','pm-suica'],['paypay','ペイペイ','ペイペイ','pm-paypay'],
].map(([code,zh,ja,icon])=>({id:code,code,zh,ja,icon,pointRate:null}));
fixture.catalog.expenseTags=[{id:'fixed',code:'fixed',zh:'固定费用',ja:'固定費用'},
 {id:'custom',code:'custom',zh:'自定义标签',ja:'カスタム',custom:true}];
const evidence=[];
async function inkState(control){return control.evaluate(el=>{const p=getComputedStyle(el,'::before');return{pressed:el.getAttribute('aria-pressed'),content:p.content,image:p.backgroundImage,opacity:p.opacity,blend:p.mixBlendMode,mask:p.maskImage};});}
async function tagColors(control){return control.evaluate(el=>{const style=getComputedStyle(el),probe=document.createElement('i');el.append(probe);const resolve=name=>{probe.style.color='var('+name+')';return getComputedStyle(probe).color;};const v={bg:style.backgroundColor,ink:style.color,border:style.borderColor,expectedBg:resolve(el.getAttribute('aria-pressed')==='true'?'--color-secondary-container':'--color-surface-container'),expectedInk:resolve(el.getAttribute('aria-pressed')==='true'?'--color-on-secondary-container':'--color-on-surface-variant')};probe.remove();return v;});}
async function verifyTag(control,enabled){
 const s=await inkState(control);assert.equal(s.pressed,String(enabled));const c=await tagColors(control);assert.equal(c.bg,c.expectedBg);assert.equal(c.ink,c.expectedInk);await readable(control);
 assert.equal(s.content,enabled?'""':'none');if(enabled){assert(s.image.includes('-ink.webp'));assert.equal(s.blend,'luminosity');}
 return c;
}
async function paintedCoverage(control){
 await control.scrollIntoViewIfNeeded();await control.page().waitForTimeout(220);
 const texture=await control.screenshot({scale:'device',animations:'disabled'});
 await control.evaluate(el=>el.setAttribute('data-without-ink',''));
 const plain=await control.screenshot({scale:'device',animations:'disabled'});
 await control.evaluate(el=>el.removeAttribute('data-without-ink'));
 const a=await sharp(texture).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(plain).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(a.info.width,b.info.width);assert.equal(a.info.height,b.info.height);
 const changed=[0,0,0];for(let y=8;y<a.info.height-8;y++)for(let x=8;x<a.info.width-8;x++){const i=(y*a.info.width+x)*4;let diff=0;for(let c=0;c<3;c++)diff+=Math.abs(a.data[i+c]-b.data[i+c]);if(diff>6)changed[Math.min(2,Math.floor(x/a.info.width*3))]++;}
 const minimum=(a.info.width-16)*(a.info.height-16)/3*.10;
 const theme=await control.page().evaluate(()=>document.documentElement.dataset.theme);
 fs.writeFileSync(path.join(out,theme+'-wide-texture.png'),texture);fs.writeFileSync(path.join(out,theme+'-wide-plain.png'),plain);
 const style=await control.evaluate(el=>{const s=getComputedStyle(el,'::before');return{background:s.backgroundPosition,maskPosition:s.maskPosition,mask:s.maskImage,size:s.maskSize};});
 assert(changed.every(n=>n>minimum),'texture does not sufficiently cover all three parts: '+JSON.stringify({changed,minimum,style}));return changed;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(t);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const theme of ['winter','winter-silver'])for(const lang of ['zh','ja'])await scenario('payment ink and unchanged tag palette: '+theme+' '+lang,async({page,state})=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   const rows=[];
   for(const route of (process.env.WINTER_PAYMENT_PIXELS_ONLY?['/add']:['/add','/add?editId=b93-entry','/add?copyId=b93-entry','/settings/recurring-rules/form'])){
    await open(page,theme,route);await page.addStyleTag({content:'[data-without-ink]::before{opacity:0!important}'});
    const group=page.locator('[data-payment-picker]');await group.waitFor();
    const logos=await group.locator('img,svg').evaluateAll(nodes=>nodes.map(n=>n.tagName.toLowerCase()==='img'?n.getAttribute('src'):n.innerHTML));
    for(const pm of fixture.catalog.paymentMethods){
     const control=group.locator('button').filter({hasText:pm[lang]}).first();if(await control.getAttribute('aria-pressed')!=='true')await settledClick(control);await choice(control);
     assert.equal(await group.locator('[aria-pressed="true"]').count(),1);
     const ink=await inkState(control);assert(ink.image.includes('-ink.webp'));assert.equal(ink.content,'""');
    }
    assert.deepEqual(await group.locator('img,svg').evaluateAll(nodes=>nodes.map(n=>n.tagName.toLowerCase()==='img'?n.getAttribute('src'):n.innerHTML)),logos,'brand artwork changed');
    assert.equal(await group.locator('img').evaluateAll(nodes=>nodes.some(el=>!el.complete||!el.naturalWidth||getComputedStyle(el).filter!=='none')),false);
    const tags=page.locator('[data-tag-picker]'),fixed=tags.getByRole('button',{name:lang==='zh'?'#固定费用':'#固定費用',exact:true}),custom=tags.getByRole('button',{name:lang==='zh'?'#自定义标签':'#カスタム',exact:true});
    await verifyTag(fixed,false);await settledClick(fixed);const before=await verifyTag(fixed,true);
    await settledClick(custom);await verifyTag(custom,true);await verifyTag(fixed,false);
    await settledClick(custom);await verifyTag(custom,false);
    const menu=custom.locator('..').getByRole('button',{name:'⋯',exact:true});await menu.click();const edit=page.getByRole('button',{name:lang==='zh'?'编辑':'編集',exact:true});await edit.click();await tags.locator('input').press('Escape');assert.equal(await custom.isVisible(),true);
    await settledClick(fixed);assert.deepEqual(await tagColors(fixed),before,'tag colors changed after selection cycle');
    for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await group.locator('button').evaluateAll(nodes=>nodes.some(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth;})),false);}
    if(route==='/add'&&lang==='ja'){
     const credit=group.locator('button').filter({hasText:'クレジットカード'}).first();await settledClick(credit);const wideCoverage=await paintedCoverage(credit);
     const merpay=group.locator('button').filter({hasText:'メルペイ'}).first();await settledClick(merpay);await merpay.scrollIntoViewIfNeeded();await page.waitForTimeout(220);
     await group.screenshot({path:path.join(out,theme+'-payments.png'),scale:'css'});await tags.screenshot({path:path.join(out,theme+'-tags.png'),scale:'css'});
     await page.screenshot({path:path.join(out,theme+'-page.png'),scale:'css'});await group.screenshot({path:path.join(out,theme+'-payments@3x.png'),scale:'device'});
     evidence.push({theme,tagPalette:before,widePaymentTexturePixels:wideCoverage});
    }
    rows.push(route);
   }
   assert.equal(state.writes.length,0);evidence.push({theme,lang,routes:rows,remoteWrites:0});
  },{theme,lang,fixture,entries:[entry]});
  for(const theme of ['default','nostalgia','summer','autumn'])await scenario('other themes do not acquire winter textures: '+theme,async({page})=>{
   await open(page,theme,'/add');const tags=page.locator('[data-tag-picker]');const tag=tags.getByRole('button',{name:'#固定费用',exact:true});await settledClick(tag);
   const c=await tagColors(tag);assert.equal(c.bg,c.expectedBg);assert.equal(c.ink,c.expectedInk);assert.equal((await inkState(tag)).content,'none');
   const method=page.locator('[data-payment-picker] button').filter({hasText:'メルペイ'}).first();await settledClick(method);assert.equal((await inkState(method)).content,'none');
  },{theme,fixture});
 }finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({results,evidence},null,2));await browser?.close();server?.kill();}
 console.log(JSON.stringify(results));if(results.some(r=>r.result!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
`;
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(prefix+helpers+body,file);
