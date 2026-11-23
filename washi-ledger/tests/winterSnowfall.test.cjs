const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),test=require('node:test');
const ts=require('typescript');
const app=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(app,'src/lib/winterSnowfall.ts'),'utf8');
const exported={};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exported);
const Model=exported.WinterSnowfallSchedule;
const seeded=initial=>{let seed=initial;return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
test('random occupied paths stay separate across 256 five-minute runs',()=>{
 const centers=new Set();
 for(const[width,height]of[[320,568],[390,844],[430,932],[480,844]])for(let seed=1;seed<=64;seed++){
  const model=new Model(width,height,seeded(seed));let previous=new Map(),peak=0;
  for(let at=0;at<=300000;at+=250){
   const active=model.advanceTo(at);peak=Math.max(peak,active.length);assert(active.length<=3);assert.equal(new Set(active.map(f=>f.speed)).size,active.length);
   for(const prior of previous.values())if(!model.active.has(prior.id))assert(at>=prior.endAt,'path released before full exit');
   for(const f of active){
    centers.add(f.center.toFixed(3));assert.equal(f.fromY,-80);assert.equal(model.pose(f,f.bornAt).opacity,0);assert(model.pose(f,f.endAt).y-60*Math.SQRT2/2>height);
   }
   for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)assert(Math.abs(active[i].center-active[j].center)>=60*Math.SQRT2+8+6-1e-6);
   previous=new Map(active.map(f=>[f.id,{...f}]));
  }
  assert.equal(peak,3);
 }
 assert(centers.size>500);
});
test('a busy route is held until exit and only then can a replacement start above the top',()=>{
 const model=new Model(320,568,seeded(1));model.advanceTo(5000);assert.equal(model.active.size,3);assert.equal(model.spawn(5000),false);
 const first=[...model.active.values()].sort((a,b)=>a.endAt-b.endAt)[0];model.advanceTo(first.endAt-1);assert(model.active.has(first.id));
 model.advanceTo(first.endAt);assert(!model.active.has(first.id));assert.equal(model.active.size,2);
 const next=model.nextSpawnAt;assert(next>first.endAt);const others=[...model.active.values()].map(f=>f.id);model.advanceTo(next+1);
 const fresh=[...model.active.values()].find(f=>!others.includes(f.id));assert(fresh);assert.equal(fresh.bornAt,next);assert.equal(model.pose(fresh,next).y,-80);
});
test('repeated starts generate different free positions and clocks never run backward',()=>{
 const a=new Model(390,844,seeded(1)),b=new Model(390,844,seeded(2));a.advanceTo(5000);b.advanceTo(5000);
 assert.notDeepEqual([...a.active.values()].map(f=>f.center),[...b.active.values()].map(f=>f.center));assert.throws(()=>a.advanceTo(0));
});
