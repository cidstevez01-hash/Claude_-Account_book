# Cloudflare Worker 上线前置步骤清单

这份清单只覆盖代码已经写完之后、需要在**你自己电脑上**做的事——沙盒这边连不上
Cloudflare/Supabase的网络，`wrangler login`/`wrangler deploy`这类步骤代劳不了。
按顺序做完，最后一步之前**不要**触发washi-ledger的ipa构建（详见README.md里的原因）。

## 一、一次性环境准备

- [ ] **注册Cloudflare账号**（如果还没有）：https://dash.cloudflare.com/sign-up ，免费档够用，不需要绑卡。
- [ ] 确认本机有Node.js（跑`node -v`，18+就行，前端已经在用了应该现成有）。
- [ ] 进入worker目录装依赖：
  ```bash
  cd washi-ledger/worker
  npm install
  ```
- [ ] 登录Cloudflare（会打开浏览器走一次OAuth授权，只需要做一次，之后本机会记住）：
  ```bash
  npx wrangler login
  ```

## 二、本地跑通（部署前先确认代码本身没问题）

- [ ] 启动本地Worker：
  ```bash
  npx wrangler dev
  ```
  默认跑在`http://127.0.0.1:8787`，跟`washi-ledger/.env.example`里`VITE_API_BASE_URL`
  默认值一致。

- [ ] 前端指向本地Worker跑起来，正常登录一个账号（真实登录，不是匿名）：
  ```bash
  cd washi-ledger
  npm run dev
  ```
  确认`.env`里`VITE_API_BASE_URL=http://127.0.0.1:8787`（`.env.example`已经是这个默认值，
  没有`.env`就先`cp .env.example .env`）。

- [ ] 在App里实际操作一遍，确认走的是Worker而不是直连Supabase：
  - 记一笔 → 刷新页面 → 数据还在（验证`upsert-bulk`）
  - 删一笔 → 刷新页面 → 确认真的没了（验证`delete`）
  - 浏览器Network面板里能看到请求打到`127.0.0.1:8787`，不是`supabase.co`

- [ ] （可选，更严谨）用两个不同账号分别登录测试，确认A账号看不到B账号的数据——
  这是在验证Worker那层JWT校验+RLS没有被意外绕过，不是走个形式。

## 三、部署到真实Cloudflare

- [ ] 部署：
  ```bash
  npx wrangler deploy
  ```
  第一次部署如果Cloudflare账号下有多个account，会让你选一个。

- [ ] 部署成功后记下命令行输出的真实URL，形如：
  ```
  https://washi-ledger-api.<你的账号子域>.workers.dev
  ```

## 四、把真实URL接回前端

- [ ] 本地`washi-ledger/.env`里的`VITE_API_BASE_URL`改成上一步拿到的真实URL，
  本地`npm run dev`重新跑一遍第二步"本地跑通"里的验证项（这次是对着真实部署验证，
  不是对着`wrangler dev`本地模拟）。

- [ ] 正式构建用的配置也要同步改，否则CI出的包还是指向本地地址：
  - `washi-ledger/.env.example`里的`VITE_API_BASE_URL`默认值改成真实URL
    （或者去改`washi-ledger-ci.yml`/`washi-ledger-ios-test-build.yml`里
    `cp .env.example .env`那一步之后追加一行覆盖，两种方式选一种，改`.env.example`
    更省事，说一声我可以帮你改）

## 五、上线前最后验证（今天B-02修复过的三个敏感场景，切换成HTTP之后必须重新过一遍）

这三个是今天连续出过真实生产事故的场景，优先级最高，不能跳：

- [ ] **冷启动合并**：本机有未同步的记录 + 云端也有其他设备写入的记录 → 登录后两边
  数据都要在，不能互相覆盖
- [ ] **空云端种子推送**：全新账号第一次登录、云端entries表是空的 → 本机现有记录要能
  正常推上去
- [ ] **App前台恢复重新同步**：切后台一段时间再切回前台 → 数据能正常刷新，
  不报错、不卡住

- [ ] 用真机（Capacitor WebView，不是浏览器）测一遍，确认CORS放行——`worker/src/_shared/cors.ts`
  里已经加了`capacitor://localhost`/`ionic://localhost`，理论上没问题，但没有真机
  验证过。

- [ ] Realtime订阅（`subscribeEntriesRealtime`）确认没受影响——这条本来就没有搬到
  Worker，理论上零改动，但既然是entries数据流的另一半，顺手确认一下比较放心。

## 六、都过了之后

- [ ] 触发`washi-ledger-ios-test-build.yml`出新ipa（Actions页面手动`Run workflow`）。
- [ ] 回来跟我说一声部署好了、真实URL是什么，我这边把Smartsheet相关行的状态更新一下。

## 明确不在这份清单里（留到以后再说，不用现在做）

- CI自动部署Worker（`wrangler deploy`接进GitHub Actions，需要新增`CLOUDFLARE_API_TOKEN`
  这类secret）——先手动部署跑通，稳定了再考虑要不要自动化。
- Phase 2（catalog/settings/自定义分类标签也搬到Worker）——等你看完phase 1实际效果
  再定要不要做。
