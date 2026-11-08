const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')

function fixture(initial={}) {
  const store=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]))
  const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))}
  const exports={}
  const file=path.join(__dirname,'../src/lib/entriesCache.ts')
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
  vm.runInNewContext(code,{exports,localStorage,console,require(id){
    assert.equal(id,'./legacyCacheOwner')
    return {getLegacyCacheOwner:()=>null}
  }},{filename:file})
  return {cache:exports,read:key=>JSON.parse(store.get(key)??'null'),raw:key=>store.get(key)}
}
const key=id=>'washi_ledger_entries_cache_v2:'+encodeURIComponent(id)
const original={id:'entry-1',amount:100,note:'before',currency:'JPY',date:'2026-11-08',receiptPaths:['account/entry/receipt.pdf'],createdAt:1000}

test('successful edit replaces the cached record, preserving all other records and metadata',()=>{
  const other={...original,id:'entry-2',note:'keep'}
  const {cache,read}=fixture({[key('A')]:[original,other]})
  const updated={...original,amount:250,note:'after',date:'2020-01-01',catCode:'different-category'}
  cache.upsertCachedEntry('A',updated)
  assert.deepEqual(read(key('A')),[updated,other])
})
test('copy/new save appends one record without replacing the source record',()=>{
  const {cache,read}=fixture({[key('A')]:[original]})
  const copy={...original,id:'copied-entry',amount:300}
  cache.upsertCachedEntry('A',copy)
  cache.upsertCachedEntry('A',{...copy,note:'updated copy'})
  assert.deepEqual(read(key('A')),[original,{...copy,note:'updated copy'}])
})
test('same record ID in another account is left unchanged',()=>{
  const privateB={...original,note:'account B',amount:9999}
  const {cache,read}=fixture({[key('A')]:[original],[key('B')]:[privateB]})
  cache.upsertCachedEntry('A',{...original,note:'account A changed'})
  assert.deepEqual(read(key('B')),[privateB])
})
test('an unowned legacy cache is neither migrated nor overwritten by a successful save',()=>{
  const legacy='washi_ledger_entries_cache_v1'
  const {cache,read,raw}=fixture({[legacy]:[original]})
  const before=raw(legacy),fresh={...original,id:'new-account-entry'}
  cache.upsertCachedEntry('new-account',fresh)
  assert.deepEqual(read(key('new-account')),[fresh])
  assert.equal(raw(legacy),before)
})
