# Washi Ledger（家計簿）交接文档

更新日期：2026-10-21
用途：交接给下一位接手的 AI 助手（ChatGPT 等）。写明项目现状、第三方工具、数据库与后端、使用规则、待办。
**本文档不包含任何密钥或密码。** 需要的值请看对应文件（见每节说明）。

---

## 0. 先读这几条

1. 这是 **washi-ledger**（日本家计簿 App，中文/日文双语）。代码在仓库子目录 `washi-ledger/`，是一个 Vite + React + TypeScript + Tailwind 项目。
2. 仓库根目录还有一个 **旧 App**（单文件 `index.html`，`accountbook-YYYYMMDD` 分支系列）。两条线的版本号、发版流程**完全独立**，不要混用。
3. 用户习惯：**每次推送前必须先报版本号，用户明确说"推"/"可以推"才能 `git push`**。用户催促、解释原因、抱怨看不到东西，都不算确认。
4. 修改代码前，先用文字说明"问题是什么、错在哪、打算怎么改"，等用户明确确认（"对"/"改吧"）再动手。
5. 项目有 `CLAUDE.md`（仓库根目录），是项目的强制规则，接手前必读。

---

## 1. 仓库与分支现状

### 1.1 仓库
- GitHub：`cidstevez01-hash/Claude_-Account_book`（`origin`）
- **没有 `main`/`master` 分支。** 远程 HEAD（默认分支）指向 `claude/upload-project-github-ww338s`，那是旧 App 的临时分支，不是 washi-ledger 的主线。
- 远程现有分支（节选）：
  - `accountbook-20260731` … `accountbook-20260903`：旧 App 的开发分支。
  - `washi-ledger-rewrite`：washi-ledger 这条线的**基底分支**（我们的开发分支是它的后代）。
  - `washi-ledger-ui-fixes`：**当前开发分支**（近期所有 washi-ledger 修复都在这里）。
  - `claude/*`：若干临时分支，不要当主线用。

### 1.2 当前开发分支：`washi-ledger-ui-fixes`
- 远程最新已推送提交：`9774a8b`（2026-10-21 推送，包含下面 3 个提交和交接文档）。
  - `ee7ca3d` B-77：日期区间日历只显示当月日期、按当月行数排（版本 `0.0.0-20261021-dev.1`，已改 `washi-ledger/package.json`）。
  - `6277047` B-78：小票"存为PDF"点击无反应、重复上传的修复。
  - `9774a8b` 本交接文档。
- 上一个已推送的功能版本是 `b7f3628`（B-76 + R-46，版本 `0.0.0-20261016-dev.1`）。
- 最近一次 iOS 测试包：#100，提交 `9774a8b`，见第 7 节。

### 1.3 近期已推送的版本（新→旧）
| 版本 | 内容 | 提交 |
|---|---|---|
| 0.0.0-20261016-dev.1 | B-76 OCR 割引前合計读错（改用 findLastIndex）、R-46 多张小票金额累加 | b7f3628 |
| 0.0.0-20261015-dev.2 | B-75 设置页图标萤火虫装饰统一 | 5059125 |
| 0.0.0-20261015-dev.1 | R-45 详情/编辑/复制/删除导航改版、B-71 角标转圈、B-72 统计字重统一、B-73 角标压金额、B-74 节假日标记 | 0ddcb65 |
| 0.0.0-20261014-dev.3 | R-44 收尾（繰り返し入力、删除按钮） | 0a49ece |

### 1.4 合并/主线待决定事项（用户还没确认）
- 用户希望把开发成果"合一版到默认分支"。我的建议：washi-ledger 这条线合到 `washi-ledger-rewrite`（我们的分支是它的后代，快进即可）。**需要用户确认目标分支和名字。**
- 是否新建 `main`：用户还没确认。建 `main` 的做法是：以 `washi-ledger-rewrite` 为基底，`git push origin origin/washi-ledger-rewrite:refs/heads/main`，然后到 GitHub 网页 Settings → General → Default branch 改默认分支。**这些都需要用户确认后再做。**

---

## 2. 第三方工具（用途、用法、规则）

### 2.1 Git / GitHub
- **用途**：版本管理、远程仓库、GitHub Actions 构建。
- **用法**：
  - 推送前先 `git fetch origin <分支>`，确认远程没被其他会话推进；有冲突用 `rebase` 或合并，**禁止 `--force`**。
  - 提交信息格式：标题简述改动 + 版本号，例如 `B-77: ... (0.0.0-20261021-dev.1)`。正文写"为什么"，并加 `Claude-Session` 行。**提交信息里不要写模型名称。**
  - 只 `git add` 具体文件，不要 `git add -A`，避免把 `.env` 之类的文件带进去（`.env` 已在 `.gitignore`）。
- **规则**：推送前必须报版本号、等用户明确说"推"。不建 PR，除非用户明确要求。

### 2.2 GitHub Actions（iOS 打包）
- **用途**：把 Web App 打包成 iOS 未签名 `.ipa`，用于真机测试。
- **工作流**：
  - `.github/workflows/washi-ledger-ios-test-build.yml`：**手动触发**（`workflow_dispatch`），打包 washi-ledger 的 App。
  - `.github/workflows/washi-ledger-ci.yml`：`push` 时自动跑，做 `cp .env.example .env` → `npm ci` → `npx tsc -b --noEmit` → `npm run build`。
  - `ios-release.yml`、`ios-test-build.yml`：旧 App 的打包流程，也是手动触发。
- **用法**：通过 GitHub MCP 或网页触发。触发时指定 `ref` 为要打包的分支（例如 `washi-ledger-ui-fixes`）。运行结果在 Actions 页面下载 `.ipa`。
- **规则**：推送到主分支**不会**自动触发 iOS 打包，必须手动触发。iOS 打包有成本（macOS runner 按 10 倍分钟数计费），只在需要真机测试时才跑。

### 2.3 Capacitor（原生壳）
- **用途**：把 `dist/` 打包成 iOS App。
- **配置**：`washi-ledger/capacitor.config.json`，`appId` 为 `com.cidstevez01.washiledger`，`webDir` 为 `dist`，`appName` 为 `PigBang`（这是现有配置，不要随便改）。
- **用到的原生插件**（见 `washi-ledger/package.json`）：
  - `@capacitor/camera`：拍照/选图。
  - `@capgo/capacitor-document-scanner`：原生文档扫描（小票扫描）。
  - `@capacitor/file-viewer`：用系统 QuickLook 打开 PDF。
  - `@capacitor-community/image-to-text`：iOS Vision 文字识别（小票 OCR）。**有本地补丁**，见 `washi-ledger/patches/`，由 `patch-package` 在 `postinstall` 自动应用。
  - `@capacitor/app`、`@capacitor/ios`、`@capacitor/core`。
- **规则**：修改 Capacitor 配置或插件版本后，要重新打 `.ipa` 验证。

### 2.4 Supabase（认证、数据库、存储、实时同步）
- **用途**：用户登录（匿名 + 邮箱）、Postgres 数据库、私有文件存储（小票）、Realtime 订阅。
- **项目**：URL 和 anon key 在 `washi-ledger/.env.example` 和 `washi-ledger/worker/wrangler.toml` 里。**anon key 是公开的客户端 key，安全边界靠 RLS，不是靠保密。** 不要改用 service role key，前端和 Worker 都不能用它。
- **前端用法**：`src/lib/supabase.ts` 初始化客户端。读取的表：`categories`、`subcategories`、`tags`、`payment_methods`、`payment_method_point_rules`、`user_settings`，以及直连的 `entries`、`recurring_rules`（读写都走 Worker，见第 4 节）。
- **未登录时的行为**：`src/features/auth/` 里有匿名注册逻辑（`ensureCloudSession`），未登录也会匿名写库。真机测试时会在网络请求里看到 `auth/v1/signup`。
- **规则**：
  - 所有数据表必须开 RLS。
  - 新增的 SQL 脚本要放 `sql/` 目录，文件名带日期，写成可重复执行的（`create ... if not exists`、`create or replace`）。
  - SQL 由用户在 Supabase 的 SQL Editor 里手动执行，沙盒没有数据库写权限，不能代劳。

### 2.5 Cloudflare Workers（后端 API）
- **用途**：`washi-ledger-api`，接管记账记录和固定收支规则的读写，以及汇率查询。
- **配置**：`washi-ledger/worker/wrangler.toml`（名字、入口、`[vars]` 里的 Supabase 公开配置）。**没有使用 wrangler secret。**
- **部署**：**只能由用户在自己电脑上执行**（沙盒连不上 Cloudflare）。命令：
  ```
  cd washi-ledger/worker
  npm install
  npx wrangler login      # 一次性
  npx wrangler deploy
  ```
- **本地开发**：`npx wrangler dev`，地址 `http://127.0.0.1:8787`。`washi-ledger/.env` 里的 `VITE_API_BASE_URL` 指向它。
- **规则**：
  - 改了 Worker 代码后，必须由用户重新 `wrangler deploy`，否则线上还是旧代码。**这个坑踩过一次**（R-44 的接口没部署，前端请求全部 404）。
  - CORS 白名单在 `worker/src/_shared/cors.ts`，新增前端域名要改这里。
  - 客户端请求头带 `Authorization: Bearer <Supabase access token>`，Worker 用 anon key + 用户 token 访问 Supabase，RLS 仍然生效。

### 2.6 Smartsheet（需求与 Bug 追踪）
- **用途**：所有需求（R-xx）和 Bug（B-xx）都记在 Smartsheet，**不在聊天里记**。
- **工作区**：`washi-ledger 开发追踪`（workspace id `3865640789403524`）。
- **需求表**：sheet id `4497306844876676`。字段：`id`（自动编号 R-xx）、`标题`、`模块`（多选）、`需求内容`、`状态`、`更新版本`、`备注`。
- **Bug 表**：sheet id `3927270329634692`。字段：`id`（自动编号 B-xx）、`标题`、`模块`（多选）、`复现步骤`、`当前现象`、`预期现象`、`状态`、`发生版本`、`修复版本`、`测试结果`（passed/failed）、`备注`。
- **模块可选值**：仪表盘、明细、统计、记一笔、汇率换算、设置、我的账户、登录注册、底部导航、全局、其他。
- **状态流转**：
  - 需求：待处理 → 处理中 → 已处理（回填 `更新版本`）。
  - Bug：待处理 → 处理中 → 已处理（回填 `修复版本`）→ 验证中 → 测试结果 `failed` 则打回待处理，`passed` 则改已解决。
- **用法（MCP）**：
  - 先调 `get_resource_guide`（intent `smartsheet-intelligence`）拿编排指南。
  - 新增用 `add_rows`，修改用 `update_rows`。列用**列 ID**（数字）指定，不是列名。
  - 多选字段的写法：`{"objectType": "MULTI_PICKLIST", "values": ["仪表盘", "明细"]}`。
  - **不要在 cells 里放 `value: null` 的占位**，会导致 `invalid parameters` 报错（踩过一次）。
- **规则**：每次处理完要把状态字段真正改掉，并回填版本号。没有 Smartsheet 的会话，需要用户手动同步或给对应的 Smartsheet 连接。

### 2.7 Stitch（设计稿，MCP）
- **用途**：Google Stitch 设计工具，用于生成界面设计稿（用户确认过的设计稿存在 `design-assets/`）。
- **配置**：仓库根目录 `.mcp.json`，key 从环境变量 `STITCH_API_KEY` 读取。**密钥不能写进仓库。**
- **规则**：设计产出物要存进 `design-assets/`，每个产出物一个子文件夹，内部分 `final/`（当前接入的那份）和 `history/`（历次版本，只增不删）。

### 2.8 其他前端依赖
- **React 19 + React Router 7 + TypeScript + Vite 8 + Tailwind CSS 4**：界面和构建。
- **oxlint**：代码检查，`npm run lint`。
- **jspdf**：把小票图片生成 PDF（`src/lib/receiptPdf.ts`）。
- **patch-package**：应用 `patches/` 里的补丁。
- **外部汇率数据源**（在 `worker/src/rate/` 里）：`api.frankfurter.dev`、`api.exchangerate.fun`、`unirateapi.com`、日本银行（`stat-search.boj.or.jp`）。这些是公开接口，不需要 key。

### 2.9 Playwright（沙盒里的浏览器测试）
- **用途**：本地跑真实页面、截图、量像素，用来验证 UI。
- **用法**：
  - 浏览器路径 `/opt/pw-browsers/chromium`。
  - 脚本里用 `require('/opt/node22/lib/node_modules/playwright')`。
  - **不要执行 `playwright install`**，沙盒里已经装好了。
- **前提**：需要 `washi-ledger/.env`（从 `.env.example` 复制，已被 `.gitignore` 忽略）。否则页面会报 `缺少 VITE_SUPABASE_URL`。
- **限制**：沙盒连不上真实 Supabase 登录，只能用 `localStorage` 伪造缓存数据（`washi_ledger_*_cache_v1`）验证界面。涉及真实上传、登录态的流程只能部分验证。

---

## 3. 数据库（Supabase Postgres）

### 3.1 表
| 表 | 用途 | 备注 |
|---|---|---|
| `entries` | 记账记录 | 通过 Worker 读写；有软删除字段；有 `receipt_path` 列；Realtime 订阅 |
| `recurring_rules` | 固定收支规则（繰り返し入力） | 通过 Worker 读写；Realtime 订阅；RLS 已开 |
| `categories` / `subcategories` | 分类、子分类 | 前端直连 |
| `tags` | 标签 | 前端直连 |
| `payment_methods` | 支付方式 | 前端直连 |
| `payment_method_point_rules` | 支付方式的积分规则 | 前端直连；RLS 已开 |
| `user_settings` | 用户设置（语言、货币、主题等）| 前端直连，设置云同步 |
| `alarms`、`alarm_sounds`、`alarm_schedule_state`、`device_push_tokens` | 闹钟与推送相关（旧 App 的功能） | RLS 已开；washi-ledger 前端目前没有使用 |

**注意**：`entries` 表的完整 `CREATE TABLE` 不在仓库的 `sql/` 目录里（早期是在 Supabase 后台直接建的）。`sql/` 里只有后续的增量改动（软删除、子分类可空等）。要看完整结构，要请用户在 Supabase 的 Table Editor 里查看。

### 3.2 `sql/` 目录（已执行的迁移脚本）
- `2026-08-13_alarm_tables.sql` / `alarms_v2.sql` / `drop_alarm_tables.sql` / `alarm_sounds.sql`：闹钟相关表。
- `2026-08-14_payment_method_points.sql`：支付方式积分。
- `2026-08-23_entries_soft_delete.sql`、`entries_sub_code_nullable.sql`：记账表软删除、子分类可空。
- `2026-08-24_soft_delete_all_tables.sql`：其他表也加软删除。
- `2026-08-24_user_settings_theme_skin.sql`：设置里的主题字段。
- `2026-09-16_payment_method_paypay.sql`：支付方式 PayPay。
- `2026-10-14_recurring_rules.sql`：固定收支规则表 + `generate_recurring_entries()` 函数（用 `create or replace` 替换，不改 pg_cron 的调度）。已在 Supabase 执行，`recurring_rules` 有 5 条迁移数据。

### 3.3 函数与定时任务
- `generate_recurring_entries()`：按 `recurring_rules` 生成记账记录，由 pg_cron 每天调用一次。
- `is_biz_day()`、`adjust_to_biz_day()`：判断工作日、顺延日期（节假日顺延用）。
- 客户端也有一份等价的生成逻辑：`src/lib/recurringGeneration.ts`（仪表盘挂载时运行）。两边都用固定 id 判重，避免重复生成。

### 3.4 Storage
- bucket：`receipts`（**私有**，不要设为 public）。
- 路径：`<用户 id>/<记录 id>/<随机 UUID>.pdf`（每次上传都是新文件，同一条记录可以有多张小票，不覆盖）。
- RLS：只允许登录用户读写自己文件夹（第一段路径是 `auth.uid()`）的文件。
- 访问方式：`createSignedUrl`，有效期 1 小时。
- 完整设置步骤见 `washi-ledger/worker/RECEIPT_STORAGE_SETUP.md`。

### 3.5 Realtime
- `entries` 和 `recurring_rules` 开了 Realtime 订阅（`src/hooks/useEntries.ts`、`src/data/recurringRules.ts`）。跨设备修改会推送过来。

### 3.6 数据库的规则
- 所有表必须开 RLS，策略要限定 `auth.uid()`。
- 迁移脚本放 `sql/`，文件名带日期，可重复执行。
- 不能用 service role key。
- SQL 只能由用户手动执行，并且要告诉用户"执行后去前台核对"。

---

## 4. 后端 Worker（washi-ledger-api）

### 4.1 接口
| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/entries` | 列出当前用户的记账记录 |
| POST | `/entries/upsert-bulk` | 批量新增/更新记账记录 |
| DELETE | `/entries/:id` | 删除记账记录（软删除） |
| GET | `/recurring-rules` | 列出固定收支规则 |
| POST | `/recurring-rules/upsert-bulk` | 批量新增/更新规则 |
| DELETE | `/recurring-rules/:id` | 删除规则 |
| GET | `/rate/history-stats` | 汇率历史统计 |
| GET | `/rate/central-bank-rates` | 中央银行汇率 |

### 4.2 鉴权
- 请求头：`Authorization: Bearer <Supabase access token>`。
- Worker 用 anon key + 这个 token 创建 Supabase 客户端，所以 RLS 按用户生效。
- 不信任客户端传来的 `user_id`，需要的时候用 `getVerifiedUserId()` 从 token 里取。

### 4.3 代码结构
```
worker/
  wrangler.toml          配置
  src/index.ts           Hono 入口：CORS、错误处理、挂载路由
  src/_shared/           cors.ts、supabaseClient.ts（鉴权）、errors.ts
  src/entries/           router.ts / handlers.ts / types.ts
  src/recurring-rules/   同上
  src/rate/              汇率接口（有缓存）
  DEPLOY_CHECKLIST.md    首次上线步骤（写给用户看的）
  RECEIPT_STORAGE_SETUP.md  Supabase 存储设置
```

### 4.4 部署状态
- 2026-08-23 首次部署（`.env.example` 注释里有记录）。
- 2026-10-14 用户重新部署，`/recurring-rules` 接口才上线（之前前端全部 404）。
- **每次改 Worker 代码后，都要用户手动 `wrangler deploy`。** 合并到分支不等于上线。

### 4.5 Worker 的规则
- 修改接口时，前端类型（`src/data/*.ts`）和 Worker 的 `types.ts` 要保持字段一致。
- 新增接口要同步更新 CORS 白名单（如果有新的前端域名）。
- 部署和拿真实 URL 必须在用户电脑上做。

---

## 5. 前端架构要点

### 5.1 目录（`washi-ledger/src/`）
- `features/`：按页面组织，如 `ledger/`（仪表盘）、`history/`（明细）、`stats/`（统计）、`calendar/`（日历）、`add-entry/`（记一笔、小票扫描）、`settings/`、`rate/`、`auth/`。
- `design-system/components/`：共享组件，如 `DateRangeBar`、`RangeCalendarPicker`、`ThemeIcon`、`IconEffects`。
- `data/`：数据层（`catalog.ts`、`recurringRules.ts`、`receiptStorage.ts`、`summary.ts`、`rate.ts`）。
- `hooks/`：`useEntries`（记账数据：本地缓存优先 + 远端合并 + Realtime）、`useSettings`、`useEntryHighlight` 等。
- `lib/`：工具与缓存（`entriesCache.ts`、`recurringGeneration.ts`、`receiptFieldExtract.ts`、`i18n/dict.ts` 中英日文案）。
- `design-system/typography.ts`：字体/字号的规范 token（`statFigure` 等）。

### 5.2 本地缓存
- localStorage 键名：`washi_ledger_settings_cache_v1`、`washi_ledger_catalog_cache_v1`、`washi_ledger_entries_cache_v1`、`washi_ledger_recurring_rules_cache_v1`、`washi_ledger_jp_holidays_cache_v1`。
- 启动时同步读缓存，然后后台拉远端合并。

### 5.3 主题与图标
- 三套主题：`default`、`nostalgia`、`summer`（夏·花火，有萤火虫和光晕效果）。颜色都用 CSS 变量（token），不要写死颜色。
- 图标：`lib/iconGlyphs.ts` 存的是字体提取的真实路径数据；summer 主题下 `ThemeIcon` 用 `RingIconEffect`。
- 萤火虫只在 `fireflies` 为真的图标上显示（设置页 5 行都已统一开启）。

### 5.4 小票流程（R-32 / B-70 / B-78）
1. 记一笔页点"レシートをスキャン" → `ReceiptScanSheet`。
2. 原生文档扫描（`@capgo/capacitor-document-scanner`）；web 端没有这个能力，会降级为相册选图。
3. 预览页后台跑 OCR（`receiptFieldExtract.ts`，Vision 文字识别，按行聚类、按关键词找金额）。
4. 点"存为PDF"：生成 PDF（`jspdf`）→ 等 OCR（最多 5 秒）→ 上传到 Storage → 把路径加到 `receiptPaths` → 金额累加、备注自动填。
5. 金额关键词优先级：合計 > お会計 > 御会計 > total > 小計，用 `findLastIndex` 从下往上找，避开排在上面的"割引前合計"。

---

## 6. 发版与推送规则（摘要）

- **版本号格式**：`washi-ledger/package.json` 的 `version`，`0.0.0-YYYYMMDD-dev.N`。同一天第二次推送 N+1，新的一天 N 重置为 1。
- **推送前**：报版本号 → 用户说"推" → `git fetch` 检查远程 → 有冲突就 rebase → 推送。
- **推送后**：在 `VERSIONS.md`「Washi Ledger 重写」一节的开发版本表里加一行（版本号/日期/说明/分支）。
- **Smartsheet**：每个修复都要登记（需求表或 Bug 表），状态和版本号要真正改掉。
- **打包**：推送不会触发 iOS 打包，需要手动触发 `washi-ledger-ios-test-build.yml`，并指定分支。
- **正式版**：washi-ledger 这条线还没有正式版。旧 App 的正式版流程（`APP_VERSION`、`VERSION` 文件、`release:` 提交）**不适用于** washi-ledger。

---

## 7. 当前待办与待用户决定

| 事项 | 状态 | 需要谁做 |
|---|---|---|
| 推送 `ee7ca3d`（B-77）和 `6277047`（B-78） | 本地已提交，未推送 | 用户确认版本号后说"推" |
| B-78 的失败分支（上传失败时的提示）| 沙盒里没测到（沙盒上传成功） | 真机上测一次"保存失败→重试" |
| 合并到哪个分支 | 未定。建议 `washi-ledger-rewrite` | 用户确认 |
| 是否新建 `main` | 未定。远程目前没有 main | 用户确认 |
| Worker 是否要重新部署 | 本次改动不涉及 Worker，不需要 | — |
| iOS 测试包 #100 | 2026-10-21 已触发，分支 `washi-ledger-ui-fixes`，提交 `9774a8b`，排队中：https://github.com/cidstevez01-hash/Claude_-Account_book/actions/runs/39611127164 。结果出来后要把 `.ipa` 结果和真机测试情况记录在这里 | 查看运行结果、真机安装测试 |
| Smartsheet 里 B-78 的"验证中"状态 | 已登记为"已处理" | 真机测试通过后由用户改状态 |

---

## 8. 沙盒环境注意事项（给接手的 AI 用）

- 沙盒**连不上** Cloudflare、Supabase 的真实登录、Apple/真机。涉及这些的部分要让用户在本机验证。
- GitHub 访问走 MCP（`mcp__github__*`），`gh` CLI 不可用。
- Smartsheet 走 MCP（`mcp__Smartsheet__*`）。
- 本地运行：
  ```
  cd washi-ledger
  cp .env.example .env     # 只需一次；.env 不进 git
  npm ci                   # 只需一次
  npm run dev -- --port 5181
  npx tsc -b && npx oxlint <文件>
  npm run build
  ```
- 临时文件放 scratchpad 目录，不要放进仓库。
- 沙盒环境可能会被重置：如果发现工作区和预期不一样，先用 `git status`、`git reflog`、`git log origin/<分支>` 确认，再动手。

---

## 9. 已知风险与注意

1. **OCR 是规则式解析**：排版花哨或手写的小票会读错，所以金额和备注都允许用户手动修改。
2. **没有自动化测试**：目前只有 `tsc`、`oxlint`、`build` 和手动 Playwright 检查。改动后要自己验证关键流程。
3. **Worker 部署是手动的**：改了后端没部署，线上会继续用旧代码，前端会请求失败。
4. **旧 App 和新 App 共用 Supabase 项目**：数据表、Storage 和 RLS 的改动会同时影响两边，改之前要先确认。
5. **匿名账号**：未登录也会创建匿名账号写库。清数据、换设备时要注意账号的归属。
6. **文档引用**：`CLAUDE.md` 和 `worker/README.md` 里提到的 `/root/.claude/plans/...` 是本机的设计文档，不在仓库里，接手的人看不到。

---

## 10. 参考文件索引

| 文件 | 内容 |
|---|---|
| `CLAUDE.md` | 项目强制规则（先读） |
| `VERSIONS.md` | 版本记录（两条线都有） |
| `DEVLOG.md` | 历史开发日志（很长，按需查） |
| `HANDOFF-washi-ledger-rewrite.md` | washi-ledger 这条线的背景、架构、设计原则（接手前必读） |
| `HANDOFF-smartsheet-tracker.md` | Smartsheet 追踪的使用说明 |
| `washi-ledger/worker/README.md` | Worker 本地开发与部署 |
| `washi-ledger/worker/DEPLOY_CHECKLIST.md` | Worker 首次上线步骤 |
| `washi-ledger/worker/RECEIPT_STORAGE_SETUP.md` | 小票存储的 Supabase 设置 |
| `washi-ledger/.env.example` | 前端需要的环境变量名称（值在文件里） |
| `washi-ledger/worker/wrangler.toml` | Worker 配置 |
| `.github/workflows/` | CI 和 iOS 打包工作流 |
| `sql/` | 数据库迁移脚本 |
| `design-assets/` | 设计稿（final/history） |
| `.mcp.json` | MCP 配置（Stitch，密钥从环境变量读取） |
