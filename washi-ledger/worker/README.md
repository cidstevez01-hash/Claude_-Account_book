# washi-ledger 自建后端（Cloudflare Worker）

前后端分家phase 1——只接管`entries`（记账记录）资源的读写，其它资源(catalog/settings/
自定义分类标签)暂时还是前端直连Supabase，见仓库根目录`DEVLOG.md`当天记录和
`/root/.claude/plans/purring-wibbling-clarke.md`(设计过程的完整方案)。

技术选型：Cloudflare Workers，不是Supabase Edge Functions（要真正独立于Supabase平台
本身），也不是免费档Node/Express（Railway/Render这类免费档常驻服务闲置会休眠，下次
请求冷启动能到30-60秒，跟这个App"偶尔打开记一笔"的间歇使用场景相性很差）。

登录鉴权和Realtime订阅**没有**搬过来，继续走前端直连`supabase-js`——这是有意的范围
限定，不是漏做，原因见上面提到的plan文档。

## 本地开发

```bash
cd washi-ledger/worker
npm install
npx wrangler dev
```

默认跑在`http://127.0.0.1:8787`，跟`washi-ledger/.env.example`里`VITE_API_BASE_URL`
的默认值一致，本地开发时前端不用额外配置就能连上。

`wrangler.toml`里`[vars]`已经直接写了Supabase项目的URL/anon key（这两个值本来就是
要打包进前端App的公开值，不是密钥），一般不需要额外建`.dev.vars`；只有想临时切到
另一个Supabase项目做隔离测试时，才需要参考`.dev.vars.example`建一份`.dev.vars`覆盖。

## 部署

```bash
npx wrangler login     # 一次性，交互式登录，需要一个免费Cloudflare账号
npx wrangler deploy
```

部署成功后会拿到一个`https://washi-ledger-api.<你的账号子域>.workers.dev`地址——
**这一步部署+拿到真实URL必须在你自己电脑上做**，这个开发环境的沙盒连不上
Cloudflare/Supabase的网络，没法代劳。

拿到真实URL之后，把它填进：
- 本地`washi-ledger/.env`的`VITE_API_BASE_URL`（用于本地对着真实部署的Worker调试）
- 正式构建用的`.env`（`washi-ledger-ci.yml`/`washi-ledger-ios-test-build.yml`目前是
  `cp .env.example .env`，在真实Worker部署好之前，CI构建出的App里entries读写会
  请求失败——部署完成、确认`.env.example`或CI里的值指向真实Worker地址之后，
  再触发新的ipa构建，不要在Worker还没部署时就急着出新包）

## 目录结构

```
worker/
  wrangler.toml          Worker配置(name/入口/环境变量)
  src/
    index.ts             Hono入口，CORS + 错误处理 + 挂载子router
    _shared/
      cors.ts             允许的origin列表
      supabaseClient.ts   JWT校验 + per-request RLS-scoped Supabase客户端
      errors.ts            统一HTTP错误类型
    entries/
      router.ts            GET / , POST /upsert-bulk , DELETE /:id
      handlers.ts           实际查询逻辑
      types.ts               EntryRow类型定义(跟前端data/catalog.ts的EntryRow逐字段对齐)
```
