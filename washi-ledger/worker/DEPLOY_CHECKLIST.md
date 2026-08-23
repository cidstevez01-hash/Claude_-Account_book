# Cloudflare Worker 上线步骤（详细版，标注谁来做）

前提说明一下为什么会有"你做/我做"的区分：我(Claude)现在是在一个云端沙盒里操作
这个仓库，这个沙盒**连不上Cloudflare和Supabase的网络**，也没有浏览器/真机——
所以凡是要登录Cloudflare账号、跑`wrangler deploy`、真机测试的步骤，只能你在自己
电脑上做。我能做的是：改代码/配置文件、跑本地能跑通的检查(类型检查/构建)、
git提交推送、更新Smartsheet。

按顺序做，每步做完告诉我结果，我确认没问题再给你下一步——不用一次性看完整个
文档自己往下走，容易漏步骤。

---

## 步骤0【我做】推送分支

把`washi-ledger-backend-split`分支推到远程仓库，这样你才能在自己电脑上拉到这些
新代码(Worker项目本体+这份清单)。

我会执行：`git push -u origin washi-ledger-backend-split`

➡️ 做完我会告诉你，然后你进入步骤1。

---

## 步骤1【你做】把代码拉到你自己电脑上

如果你电脑上还没clone过这个仓库：
```bash
git clone https://github.com/cidstevez01-hash/claude_-account_book.git
cd claude_-account_book
git checkout washi-ledger-backend-split
```

如果之前已经clone过，只是没有这个新分支：
```bash
cd 你本地仓库的路径
git fetch origin washi-ledger-backend-split
git checkout washi-ledger-backend-split
```

**验证成功的标志**：`ls washi-ledger/worker/` 能看到 `wrangler.toml`、`src/`、
`package.json`、`README.md`、这份`DEPLOY_CHECKLIST.md`。

➡️ 确认能看到这些文件之后告诉我，进入步骤2。

---

## 步骤2【你做】注册/确认Cloudflare账号

1. 打开 https://dash.cloudflare.com/sign-up
2. 用邮箱注册（免费档，不需要绑卡，不需要买域名/购买任何服务）
3. 登录后你会进到Cloudflare的Dashboard首页，能看到左侧菜单——这就够了，
   这次不需要在Dashboard里手动创建任何东西，Worker会用命令行部署出来。

如果你已经有Cloudflare账号（比如之前用过它的CDN/DNS服务），跳过注册，
确认能正常登录进Dashboard就行。

➡️ 登录成功后告诉我，进入步骤3。

---

## 步骤3【你做】本机环境准备 + 登录Cloudflare CLI

**3.1 确认本机有Node.js**（版本18以上）：
```bash
node -v
```
如果没装或者版本太低，去 https://nodejs.org 装LTS版本（跟你打包washi-ledger
前端用的应该是同一个Node，不用额外装）。

**3.2 装Worker项目的依赖**：
```bash
cd claude_-account_book/washi-ledger/worker
npm install
```
跑完应该看到`node_modules/`生成，没有报错。

**3.3 登录Cloudflare（CLI跟Dashboard账号是同一套）**：
```bash
npx wrangler login
```
这一步会自动打开浏览器，跳到Cloudflare的授权页面，点"Allow"授权。授权完
终端会显示类似`Successfully logged in`。这个登录状态会保存在你电脑上，
以后不用重复登录。

➡️ 看到`Successfully logged in`之后告诉我，进入步骤4。

---

## 步骤4【你做，可选但建议做】本地跑通一遍再部署

这一步是在你本机模拟运行Worker，不会真的发布到网上，目的是先确认代码没问题，
避免直接部署上去才发现bug。

**4.1 起本地Worker**（保持这个终端窗口开着，不要关）：
```bash
cd claude_-account_book/washi-ledger/worker
npx wrangler dev
```
成功会显示类似：
```
⎔ Starting local server...
[wrangler:info] Ready on http://127.0.0.1:8787
```

**4.2 另开一个终端窗口，起前端**：
```bash
cd claude_-account_book/washi-ledger
cp .env.example .env   # 如果之前没建过.env
npm install             # 如果之前没装过依赖
npm run dev
```
终端会给你一个本地地址，通常是`http://localhost:5173`，浏览器打开它。

**4.3 在浏览器里实际操作**：
1. 正常登录一个真实账号（不是匿名/跳过登录）
2. 记一笔 → 刷新页面 → 数据还在，说明写入成功
3. 删掉这一笔 → 刷新页面 → 确认真的消失了
4. 打开浏览器devtools的Network面板，确认这些请求打到了
   `http://127.0.0.1:8787/entries...`，而不是`supabase.co`——这样才是真的
   走了Worker，不是还在直连Supabase

都通过的话，说明代码本身没问题，可以进入部署步骤了。

➡️ 告诉我测试结果（通过/哪里报错了），我确认后你再进入步骤5。

---

## 步骤5【你做】正式部署

步骤4的两个本地终端可以关掉了（`Ctrl+C`）。

```bash
cd claude_-account_book/washi-ledger/worker
npx wrangler deploy
```
如果你的Cloudflare账号下有多个account，命令行会让你选一个，选你步骤2注册的那个。

部署成功会显示类似：
```
Uploaded washi-ledger-api (x.xx sec)
Deployed washi-ledger-api triggers (x.xx sec)
  https://washi-ledger-api.<你的账号子域>.workers.dev
```

**把这个完整的URL复制下来**，下一步要用。

➡️ 把这个URL发给我，我进入步骤6。

---

## 步骤6【我做】把真实URL接回配置

拿到你发我的真实URL之后，我会：
1. 把`washi-ledger/.env.example`里的`VITE_API_BASE_URL`默认值改成这个真实URL
2. 提交、推送这个改动
3. 报告版本号，等你确认"推"了再实际推送（跟以前一样的流程，不会跳过确认这步）

➡️ 我推送完告诉你，你进入步骤7。

---

## 步骤7【你做】在真实部署上重新验证

```bash
cd claude_-account_book
git pull origin washi-ledger-backend-split
cd washi-ledger
cp .env.example .env    # 覆盖成新的、指向真实Worker的配置
npm run dev
```

重新走一遍步骤4.3的三项操作（记一笔/刷新/删除/刷新/Network面板确认），
这次Network面板里应该看到请求打到你的`workers.dev`域名，不是`127.0.0.1`。

**这次额外要测的（今天连续出过真实数据丢失事故的三个场景，切到HTTP之后必须
重新确认一遍，不能跳）**：
- **冷启动合并**：本机有还没同步的记录，云端也有其他设备/旧App写入的记录 →
  重新登录后，两边的记录应该都在，不能互相覆盖掉一边
- **空云端种子推送**：换一个全新账号登录、云端entries表是空的 → 本机现有记录
  能正常被推上云端
- **App切后台再切回前台** → 数据能正常刷新，不报错、不卡住

➡️ 都测过之后把结果告诉我（哪些通过、哪些有问题），进入步骤8。

---

## 步骤8【你做，如果条件允许】真机测试

如果手头有能装这个App测试包的iPhone/iOS设备：
1. 用步骤7同样的流程，在真机上（不是浏览器）打开App测一遍同样的场景
2. 重点确认没有CORS报错——`worker/src/_shared/cors.ts`里已经加了
   `capacitor://localhost`/`ionic://localhost`这两个真机WebView会用的origin，
   理论上没问题，但需要真机验证一次才能确认

没有设备在手边的话，这一步可以先跳过，等步骤9出了新ipa之后再一起测。

---

## 步骤9【你做】触发出新ipa

前提：步骤7的验证都通过了。

去GitHub仓库的Actions页面，找到`washi-ledger-ios-test-build.yml`这个workflow，
手动点"Run workflow"触发（这个workflow是`workflow_dispatch`，不会自动跑，
必须手动点）。

➡️ 出包之后装到真机上，实际测一遍（如果步骤8没做的话，这里就是第一次真机验证）。

---

## 步骤10【我做】收尾

你确认真机测试都没问题之后，我会：
- 更新Smartsheet相关记录的状态
- 在`VERSIONS.md`里补一行记录这次Worker部署的URL和日期

---

## 明确不在这次范围内（以后再说）

- CI自动部署Worker（`wrangler deploy`接进GitHub Actions，需要额外配置
  `CLOUDFLARE_API_TOKEN`密钥）——这次先手动部署验证，稳定了再考虑自动化
- Phase 2（catalog/settings/自定义分类标签也搬到Worker）——等你看完这次
  entries的实际效果再决定要不要做
- 旧App(`index.html`)接入这套后端——完全独立的决定，不在这次范围
