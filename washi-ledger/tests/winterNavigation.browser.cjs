// Reuse isolated account fixtures while retaining real native View Transitions.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'winterRuntime.browser.cjs');
const prefix=fs.readFileSync(file,'utf8').split('(async()=>{')[0];
const body=String.raw`
const capture=()=>({layer:document.querySelector('.winter-fall-layer'),flakes:[...document.querySelectorAll('.winter-flake')].map(el=>({el,animation:el.getAnimations()[0],id:el.dataset.snowId}))});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(app,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5275','--strictPort'],{cwd:app,windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  for(const theme of ['winter','winter-silver'])await scenario('live snowfall through native transitions and missed lifecycle events: '+theme,async({ctx,page})=>{
   // Exercise the actual App listener contract without needing an iPhone bridge.
   await ctx.route('**/@capacitor_app.js*',route=>route.fulfill({contentType:'text/javascript',body:
    'const handlers=new Set(); window.__nativeActive=true; window.__emitNativeAppState=active=>{window.__nativeActive=active;for(const fn of handlers)fn({isActive:active});}; export const App={getState:async()=>({isActive:window.__nativeActive}),addListener:async(name,fn)=>{if(name==="appStateChange")handlers.add(fn);return{remove:async()=>{handlers.delete(fn);}};}};'}));
   await page.addInitScript(()=>{
    const native=document.startViewTransition.bind(document);window.__transitions=[];
    document.startViewTransition=callback=>{const transition=native(callback);window.__currentVT=transition;const row={};window.__transitions.push(row);transition.ready.then(()=>{row.rootName=getComputedStyle(document.documentElement).viewTransitionName;row.contentCount=document.querySelectorAll('[data-route-transition-content]').length;row.contentName=getComputedStyle(document.querySelector('[data-route-transition-content]')).viewTransitionName;row.pseudos=document.getAnimations().map(a=>a.effect?.pseudoElement).filter(Boolean);}).catch(e=>row.error=String(e));return transition;};
   });
   await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:30000});await page.locator('.app-shell').waitFor({timeout:30000});await skin(page,theme);await page.waitForTimeout(3500);
   assert.equal(await page.evaluate(()=>typeof window.__emitNativeAppState),'function','native listener fixture was not loaded');
   await page.evaluate(()=>{window.__snowLayer=document.querySelector('.winter-fall-layer');window.__originalSnow=[...document.querySelectorAll('.winter-flake')].map(el=>({el,animation:el.getAnimations()[0]}));});
   for(let i=0;i<18;i++){
    const route=['/history','/stats','/'][i%3];
    const link=page.locator('.bottom-nav-shell a[href="'+route+'"]');
    if(i<6)await link.dispatchEvent('click',{button:0});
    else{await page.evaluate(()=>window.__currentVT?.finished);await link.click();}
    await page.waitForURL(origin+route,{waitUntil:'commit'});await page.evaluate(()=>window.__currentVT.ready);await page.waitForTimeout(i<6?45:100);
    assert.equal(await page.evaluate(()=>window.__snowLayer===document.querySelector('.winter-fall-layer')),true);
    assert.equal(await page.locator('.winter-background').count(),1);assert((await page.locator('.winter-flake').count())<=3);
   }
   const transitions=await page.evaluate(()=>window.__transitions);
   assert.equal(transitions.length,18);assert(transitions.every(t=>!t.error&&t.rootName==='none'&&t.contentCount===1&&t.contentName==='winter-page-content'));
   assert(transitions.every(t=>t.pseudos.some(p=>p.includes('winter-page-content'))&&!t.pseudos.some(p=>p.includes('(root)'))),'snowfall was captured in a root snapshot');
   assert.equal(await page.evaluate(()=>window.__originalSnow.every(({el,animation})=>el.isConnected&&el.getAnimations()[0]===animation)),true,'snowfall restarted across routes');
   const pauseSnapshot=async()=>{await page.evaluate(()=>Promise.all([...document.querySelectorAll('.winter-flake')].flatMap(el=>el.getAnimations().map(a=>a.ready))));return page.locator('.winter-flake').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.snowId,time:el.getAnimations()[0]?.currentTime})));};
   const runningSnapshot=()=>page.locator('.winter-flake').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.snowId,time:el.getAnimations()[0]?.currentTime,state:el.getAnimations()[0]?.playState})));
   const layer=page.locator('.winter-background');
   // Missing pageshow: a visible/focused document must resume existing flakes.
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const held=await pauseSnapshot();await page.waitForTimeout(120);assert.deepEqual(await pauseSnapshot(),held);
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(180);assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--snow-play-state')),'running');
   assert((await runningSnapshot()).every(n=>held.some(old=>old.id===n.id&&n.time>old.time)));
   // Native background cannot be overridden by focus; native resume preserves IDs.
   await page.evaluate(()=>window.__emitNativeAppState(false));const nativeHeld=await pauseSnapshot();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(120);assert.deepEqual(await pauseSnapshot(),nativeHeld);
   await page.evaluate(()=>window.__emitNativeAppState(true));await page.waitForTimeout(160);assert((await runningSnapshot()).every(n=>nativeHeld.some(old=>old.id===n.id&&n.time>old.time)));
   // A missed native resume callback is repaired by an authoritative state read.
   await page.evaluate(()=>window.__emitNativeAppState(false));const missed=await pauseSnapshot();await page.evaluate(()=>{window.__nativeActive=true;window.dispatchEvent(new Event('focus'));});await page.waitForTimeout(160);assert((await runningSnapshot()).every(n=>missed.some(old=>old.id===n.id&&n.time>old.time)));
   // A browser-paused animation is resumed without replacing its node or clock.
   await page.evaluate(()=>document.querySelector('.winter-flake').getAnimations()[0].pause());const browserHeld=await pauseSnapshot();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(160);assert((await runningSnapshot()).every(n=>browserHeld.some(old=>old.id===n.id&&n.time>old.time)));
   await page.emulateMedia({reducedMotion:'reduce'});const reduced=await pauseSnapshot();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(120);assert.deepEqual(await pauseSnapshot(),reduced);assert.equal(await page.locator('.winter-fall-layer').isVisible(),false);
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(160);assert((await runningSnapshot()).every(n=>reduced.some(old=>old.id===n.id&&n.time>old.time)));
  },{theme,nativeTransitions:true});
 }finally{await browser?.close();server?.kill();}
 fs.writeFileSync(path.join(out,'navigation-check.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.result!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
`;
const runner=new Module(__filename,module);runner.filename=__filename;runner.paths=module.paths;runner._compile(prefix+body,__filename);
