# Washi Ledger 交接文档（2026-10-29）

接续 `HANDOFF-washi-ledger-20261021.md`。那份的第 3 到 5 节（数据库、Worker、前端架构）仍然有效；它的第 2 节工具表由本文件第 11 节替代。本文件记录 10-26 到 10-29 的改动、当前状态、完整工具清单和待办。

---

## 0. 接手前必读

- **仓库**：`cidstevez01-hash/Claude_-Account_book`（GitHub）。
- **当前开发分支**：`washi-ledger-ui-fixes`。HEAD 为 `70b34c9`（`0.0.0-20261028-dev.5`），已推送到 origin，本地干净。
- **系统指定分支**：会话配置里写的是 `claude/smartsheet-integration-hzubob`，但实际开发和推送一直在 `washi-ledger-ui-fixes`（用户 10-29 回复「推吧」确认过）。换分支前先问用户。
- **推送规则**（CLAUDE.md）：推送前报版本号，等用户明确说「推」。推送前先 `git fetch`；远程有新提交就 rebase 或合并；**禁止 `--force`**。不建 PR，除非用户明确要求。
- **stop-hook 提醒**：会话结束时 `~/.claude/stop-hook-git-check.sh` 会提醒「有未推送的提交」。这只是提醒，不是推送授权。
- **需求和 Bug 以 Smartsheet 为准**，不在聊天里记。开始处理前读两张表；处理完把状态字段改掉，并回填版本号。
- **需要用户做的事**（沙盒做不了）：执行 Supabase SQL（沙盒没有数据库写权限）、`npx wrangler deploy`（沙盒连不上 Cloudflare）、用 Sideloadly 装 IPA、真机验证。
- **指导用户在本机操作**：先确认他的仓库已经是最新分支（`git fetch` 再 `git checkout` / `git pull`）；一次只给一条命令，等他回报结果再给下一条。
- **设计产出物**：存进 `design-assets/<产出物名>/`，内部分 `final/`（当前接入的版本）和 `history/`（历次版本，只增不删）。做设计前先告诉用户存哪个目录；汇报时消息最前面先写「名称 · 路径」。
- **图标**：用 `baoyu-image-gen`，`--quality normal --ar 1:1`；生成后用 `baoyu-compress-image` 缩到 256×256 左右再交付。
- **提交信息**：标题写改动和版本号，正文写「为什么」，末尾加 `Claude-Session:` 行。**不写模型名称。** 只 `git add` 具体文件，不用 `git add -A`。
- **不写密钥**：token、service role key、数据库连接串、个人邮箱都不进仓库和文档。anon key 是公开的客户端 key，安全边界靠 RLS。

---

## 1. 版本与分支

- **版本号**：`washi-ledger/package.json` 的 `version`，当前 `0.0.0-20261028-dev.5`。格式 `0.0.0-YYYYMMDD-dev.N`，同一天第二次推送 N 加 1。
- **VERSIONS.md**：已有 `20261026-dev.1` 到 `20261028-dev.5` 的记录。
- **分支**：

| 分支 | 用途 |
|---|---|
| `washi-ledger-ui-fixes` | 当前开发线（washi-ledger）。iOS 测试包 workflow 读这个分支。 |
| `washi-ledger-rewrite` | 更早的 washi-ledger 重写线，见 `HANDOFF-washi-ledger-rewrite.md`。 |
| `claude/smartsheet-integration-hzubob` | 系统指定的分支，本条线目前没有用到。 |
| `accountbook-YYYYMMDD` | 旧 App（根目录 `index.html`）的开发分支。版本号规则不同，见 CLAUDE.md。 |

- 其他 `claude/*` 分支不是这条线的开发分支。

---

## 2. 10-26 到 10-29 的改动（按提交顺序）

| 版本 | 提交 | 内容 | Smartsheet |
|---|---|---|---|
| 20261026-dev.1 | `62d2ea0` | 增删改防重复：按钮加锁（`savingRef` / `deletingRef` / `receiptRemovingRef`），新建记录的 id 在打开页面时生成一次；Worker 删除接口幂等。 | Bug 表有对应条目（未逐条核对编号） |
| 20261026-dev.2 | `fe97c1b` | 其余写库按钮（小票删除、日历、统计等）防重复。 | 同上 |
| 20261026-dev.3 | `d46c5ee` | 分类/标签新增只忽略 id 冲突（upsert `onConflict: 'id'`，`ignoreDuplicates: true`）。 | 同上 |
| 20261028-dev.1 | `833ba74` | 固定收支：保存规则后补生成本月记录；本月已在云端的不动，新规则从下个月起生效；规则列表「次回予定」跳过本月已生成的记录。 | R-48 |
| 20261028-dev.2 | `238162f` | 规则保存流程加诊断日志。 | R-49 |
| 20261028-dev.3 | `f400f64` | 每笔生成记录写一条日志（来源、时间、内容）；每次首页检查写「生成检查」。 | R-49 |
| 20261028-dev.4 | `3ca3740` | 诊断日志改版：按模块分类、结构化字段、模块开关、级别/时间/关键字筛选、按天分组。 | R-49 |
| 20261028-dev.5 | `70b34c9` | 修复「生成记录」误报：写入带 `select('id')`，只对真正插入的记录记「生成记录」；被忽略的记「已存在，跳过」。 | B-85 |

- 以上全部已推送到 `origin/washi-ledger-ui-fixes`。
- Smartsheet 行的内部 id：R-48 为 `6163227523415940`，R-49 为 `3911427709730692`，B-85 为 `6258777660850052`。

---

## 3. 当前状态（2026-10-29 写本文件时）

- **CI**（`washi-ledger-ci.yml`，push 自动触发）：`70b34c9` 的 run #146 成功；`3ca3740` 的 run #145 成功。
- **iOS 测试包**（`washi-ledger-ios-test-build.yml`，手动触发）：run #105，ref `washi-ledger-ui-fixes`，commit `70b34c9`，已完成且成功。
  - 运行页面：https://github.com/cidstevez01-hash/Claude_-Account_book/actions/runs/40875844040
  - `.ipa` 在这个运行页面下载。
- **用户待验证**：dev.1 到 dev.5 的真机效果（见第 14 节第 1 条）。
- **Smartsheet**：R-48、R-49、B-85 的状态已设为「已处理」，「测试结果」留空。用户验证后再回填：
  - 通过：测试结果填 `passed`，状态改「已解决」。
  - 不通过：Bug 打回「待处理」，测试结果填 `failed`。

---

## 4. 固定收支（recurring）的行为约定

**数据模型**
- 规则表：`recurring_rules`（建表见 `sql/2026-10-14_recurring_rules.sql`）。规则 id 由客户端生成。
- 规则类型：
  - `day_of_month`：每月固定几号。`day_of_month` 可以是 `1` 到 `31`，或 `last`（月末）。`biz_day_adjust` 可选 `before` / `after`，遇到日本节假日或周末时向前或向后顺延。
  - `interval_days`：从 `anchor_date` 起每隔 `interval_days` 天一次，不做节假日顺延。
- 生成记录的 id：按月的是 `recur_<规则id>_<YYYY-MM>`；按间隔的是 `recur_<规则id>_<YYYY-MM-DD>`。

**保存规则**（`src/features/settings/RecurringRuleFormPage.tsx`）
1. upsert 规则。
2. 用 `buildCurrentMonthEntry` 算出本月应有的那一笔。
3. `hasEntryInCloud(id)` 按 id 查云端，**包括已软删除的行**。存在 → 不动，新规则从下个月起生效。
4. 不存在 → `insertGeneratedEntriesIgnoringDuplicates` 写入。返回的插入 id 里有它 → 记「生成记录」；没有 → 记「已存在，跳过」。

**首页补生成**（`src/features/ledger/DashboardPage.tsx`）
- `computeRecurringEntriesToGenerate` 根据本机缓存算出待生成的记录，写入后同样按插入结果记日志，然后 reload。
- 本机缓存没有、但云端已有的记录，写入会被忽略。这正是 dev.5 修的误报场景。

**其他规则**
- 编辑或删除规则，不影响已经生成的历史记录，只影响以后生成（R-44 需求 5）。
- 删除规则是软删除（`deleted_at`）。
- 节假日数据：`useJpHolidays`（公开接口 holidays-jp.github.io，本地缓存 `jpHolidaysCache.ts`）。沙盒连不上该接口，真实请求需真机确认。

---

## 5. 幂等（防重复）约定

- **原则**：靠 id 唯一，**不做内容去重**。用户明确否决过按名称或内容判重，因为名称不是唯一字段。
- **前端**：增删改写库的按钮用 ref 加锁（`savingRef` / `deletingRef` / `receiptRemovingRef`），同时禁用按钮。保存失败要有提示。
- **写库**：固定收支的自动生成和分类/标签新增，用 upsert 加 `ignoreDuplicates`，只忽略 id 冲突。其他唯一约束冲突仍然报错。
- **不要用 merge upsert 写自动生成的记录**：它会用生成值覆盖云端已有的行，而那一行可能已经被用户改过日期或金额。
- **Worker 删除接口**：`update ... set deleted_at = now() where ... and deleted_at is null`，重复删除不报错。**是否已部署见第 14 节第 2 条。**
- **已知未解决**：新增失败后，乐观显示的项会被撤回，重新输入会生成新 id。是否做「待发送队列」还没定（Bug 表里有备注）。

---

## 6. 服务器端定时生成（Supabase pg_cron）

**函数**：`public.generate_recurring_entries()`（`sql/2026-10-14_recurring_rules.sql`，`security definer`）。
- 对每条启用且未删除的规则：按月的生成本月这一笔；按间隔的生成到今天为止的所有周期。
- 写入用 `on conflict (id) do nothing`。

**调度**
- 每天 UTC 15:00 执行一次，即 JST 00:00。
- 命令里包含函数名，可以在 `cron.job` 里查到。
- 建表 SQL 已执行（App 的规则读写依赖这张表）。最近 10 次运行全部成功。过去 30 天的运行记录里，关联查询没有匹配到插入，因为这段时间没有需要新建的记录，属于正常。**但服务器真正插入时的归因查询还没有验证过**，见 6.3。

**已知限制**
- **时区**：函数用 `current_date`，session 时区是 UTC。JST 每月 1 日 00:00 那次执行时，UTC 日期还是上个月最后一天，算出来的仍是上个月。新月份的记录要等 JST 2 日 00:00 那次才会生成。`entry_date` 是对的，只是 `created_at` 晚一天。如果没人打开 App，新月份记录会晚一天出现。
- `cron.job_run_details` 不会自动清理，表会一直增长，需要时手动删。
- `cron.log_run` 默认开启，运行记录写入 `cron.job_run_details`。
- Supabase 日志的保留期按套餐不同：Free 1 天，Pro 7 天，Team 28 天，Enterprise 90 天（10-28 查阅的官方文档）。

**6.1 监控查询**（用户在 SQL Editor 或 DBeaver 执行）

看任务跑没跑、成功没有、报错是什么，以及插入了哪些记录：

```sql
select r.start_time, r.status, r.return_message, e.id, e.entry_date, e.amount, e.created_at
from cron.job_run_details r
left join entries e
  on e.created_at >= r.start_time and e.created_at <= r.end_time and e.recurring_id is not null
where r.command ilike '%generate_recurring_entries%'
  and r.start_time > now() - interval '2 days'
order by r.start_time desc, e.created_at;
```

- 调度器是否还活着：查 `pg_stat_activity`，`application_name = 'pg_cron scheduler'` 应该有一行。
- **注意**：时间窗口关联是推断。同一时间段内别的写入也可能被匹配到，要结合 `id` 和 `recurring_id` 判断。

**6.2 待定**
- 是否把函数改成按 `Asia/Tokyo` 日期计算月份，以消除第 1 日的延迟。这需要用户在 SQL Editor 执行新版本。
- 服务器生成的记录是否需要数据库日志表。目前没有建表，只靠 `cron.job_run_details` 加时间窗口关联。

**6.3 归因测试**（未做，可选）

目的：确认服务器插入的那一笔能被 6.1 的查询关联到。

步骤：
1. 在 JST 00:00 之前，用 SQL Editor 执行插入：

```sql
insert into public.recurring_rules (id, user_id, type, amount, currency, cat_code, rule_kind, day_of_month, enabled)
select 'rule_cron_test', user_id, 'expense', 1, 'JPY', cat_code, 'day_of_month', '1', true
from public.recurring_rules where deleted_at is null limit 1
on conflict (id) do nothing;
```

2. 插入之后、下一次 JST 00:00 之前，**先不要打开 App**。否则 App 会先生成同一条，服务器那边就测不出来。
3. 下一次 JST 00:00 之后，执行 6.1 的监控查询。应该能看到 `rule_cron_test` 对应的插入记录。
4. 清理：

```sql
delete from public.entries where recurring_id = 'rule_cron_test';
delete from public.recurring_rules where id = 'rule_cron_test';
```

---

## 7. 诊断日志（App 端）

- **入口**：设置页最后一行「诊断日志」，路由 `/settings/debug-log`（`src/App.tsx`）。
- **位置约定**：它必须保持在设置页最后一行，之后新增的设置项都放在它上面（`SettingsPage.tsx` 注释）。
- **模块**：固定收支（`recurring`）、小票（`receipt`）、其他（`other`）。
  - 每个模块有开关，关掉后该模块不再记录。
  - 清空只清当前模块，有确认框。
- **级别**：`info` / `warn` / `error`。
- **筛选**：模块、级别、时间（5 分钟 / 30 分钟 / 1 小时 / 今天 / 全部）、关键字。复制和下载的内容与当前筛选一致。
- **存储**：浏览器 localStorage，只在这台设备上，不上云。
  - `washi-ledger-diagnostic-log`：日志条目。
  - `washi-ledger-diagnostic-log-enabled`：总开关。
  - `washi-ledger-diagnostic-log-modules`：各模块开关。
- **代码**：
  - `src/lib/appLog.ts`：`logModule`、`getLogEntries`、`clearLog`、`formatLogLine`、模块开关。
  - `src/lib/recurringGenerationLog.ts`：生成检查、生成记录、已存在跳过。
  - `src/features/settings/DebugLogPage.tsx`：日志页。
- **「生成记录」的字段**：来源、生成时间、id、日期、金额、分类、支付、备注、规则。来源有两种：「保存规则时补本月」和「首页补生成」。
- **限制**：服务器 pg_cron 的生成不经过 App，日志里看不到。要看去查 `cron.job_run_details`。

---

## 8. 数据库、Worker、前端：本次新增或改动的部分

**数据库**（补充 10-21 文档第 3 节）
- 新增表 `recurring_rules`：`id`（text 主键）、`user_id`、`type`（expense / income）、`amount`、`currency`、`cat_code`、`sub_code`、`payment_method`、`tag_code`、`note`、`rule_kind`、`day_of_month`、`biz_day_adjust`、`anchor_date`、`interval_days`、`enabled`、`created_at`、`updated_at`、`deleted_at`。RLS：只能读写自己的行。
- 软删除：`entries`、`recurring_rules`、`subcategories`、`tags`、`alarms`、`alarm_sounds` 都有 `deleted_at`。
- SQL 文件放 `sql/`，文件名带日期，写成可重复执行的。已执行的：`2026-10-14_recurring_rules.sql`。

**Worker**（`washi-ledger/worker/`，补充 10-21 文档第 4 节）
- 文件结构：`src/index.ts`；`src/entries/`（router、handlers、types）；`src/recurring-rules/`（router、handlers、types）；`src/rate/`（handlers、router、centralBankRates、types）；`src/_shared/`（`cors.ts`、`errors.ts`、`supabaseClient.ts`）。
- CORS 白名单在 `src/_shared/cors.ts`，新增前端域名要改这里。
- 本次改动：删除接口幂等（entries 和 recurring-rules）。**需要用户本机部署才上线**：

```
cd washi-ledger/worker
npx wrangler deploy
```

- 10-21 踩过的坑：接口没部署，前端请求全部 404。

**前端**（补充 10-21 文档第 5 节）
- 固定收支：
  - `src/lib/recurringGeneration.ts`：纯函数，`buildCurrentMonthEntry`、`computeNextOccurrence`、`computeRecurringEntriesToGenerate`。
  - `src/hooks/useRecurringRules.ts`：规则读写，架构照抄 `useEntries.ts`。
  - `src/features/settings/RecurringRulesPage.tsx`：规则列表。
  - `src/features/settings/RecurringRuleFormPage.tsx`：规则表单，路由 `/settings/recurring-rules/form`。
- 保存后的高亮定位：`src/hooks/useEntryHighlight.ts`、`src/lib/dashboardFocusMemory.ts`。
- 节假日：`src/hooks/useJpHolidays.ts`、`src/lib/jpHolidaysCache.ts`。
- 本地缓存的 localStorage 键（验证时要 seed）：`washi_ledger_settings_cache_v1`、`washi_ledger_catalog_cache_v1`、`washi_ledger_entries_cache_v1`、`washi_ledger_recurring_rules_cache_v1`。其中规则缓存是 camelCase。

---

## 9. Smartsheet（需求与 Bug 追踪）

**工作区**：`washi-ledger 开发追踪`，workspace id `3865640789403524`。
https://app.smartsheet.com/workspaces/J6JCcX7cf2WPj93CjWCgPm6Fg4Gj5hG8RXjRQC51

**需求表**：sheet id `4497306844876676`
https://app.smartsheet.com/sheets/VJ6rc5vc57cH39pjhjgMVMRj3m8VgMm4qg6CWGh1
- 列：`id`（自动编号 R-xx）、`标题`、`模块`（多选）、`需求内容`、`状态`、`更新版本`、`测试结果`（passed / failed）、`备注`。
- 当前最新：R-49。

**Bug 表**：sheet id `3927270329634692`
https://app.smartsheet.com/sheets/fFVq6qrV62wwFGP64CxmH9PJ4V48FhhCpFJCjVj1
- 列：`id`（自动编号 B-xx）、`标题`、`模块`（多选）、`复现步骤`、`当前现象`、`预期现象`、`状态`、`发生版本`、`修复版本`、`测试结果`、`备注`。
- 当前最新：B-85。

**列 ID**（写入时用数字 ID，不用列名）

| 需求表 | ID | Bug 表 | ID |
|---|---|---|---|
| 标题 | 3497346585628548 | 标题 | 1654360012787588 |
| 模块 | 8000946212999044 | 模块 | 6157959640158084 |
| 需求内容 | 682596818521988 | 复现步骤 | 3906159826472836 |
| 状态 | 5186196445892484 | 当前现象 | 8409759453843332 |
| 更新版本 | 2934396632207236 | 预期现象 | 1091410059366276 |
| 测试结果 | 2426496432246660 | 状态 | 5595009686736772 |
| 备注 | 7437996259577732 | 发生版本 | 3343209873051524 |
| | | 修复版本 | 7846809500422020 |
| | | 测试结果 | 2217309966208900 |
| | | 备注 | 6720909593579396 |

**选项值**
- 模块（两张表相同）：仪表盘、明细、统计、记一笔、汇率换算、设置、我的账户、登录注册、底部导航、全局、其他。多选字段直接传字符串，如 `"设置"`，10-29 已验证显示正确。
- 状态：待处理、处理中、已处理、验证中、已解决。
- 测试结果：passed、failed。

**流程**
- 需求：待处理 → 处理中 → 已处理（回填「更新版本」）→ 测试通过后已解决。
- Bug：待处理 → 处理中 → 已处理（回填「修复版本」）→ 验证中 → 测试 failed 打回待处理，passed 改已解决。

**MCP 用法**
- 先调 `get_resource_guide`，`intents: ["smartsheet-intelligence"]`。
- 写入前调 `plan_change` 做预检，不改数据。
- 新增用 `add_rows`（`toBottom: true`），修改用 `update_rows`。
- `cells` 里不要放 `value: null` 的占位，会报 `invalid parameters`。
- 写入前要告诉用户改哪几行，等用户确认。

**注意**
- `get_sheet_summary` 整表返回超过约 68k 字符会报错。用 `columns` 和 `filters` 缩小范围，或用 `find_in_sheet` 按关键字找行。
- 2026-09-23 到 09-29 曾短暂改用 GitHub Issues，已作废，以 Smartsheet 为准。
- 遇到网页端「试用到期」之类弹窗，先实测 API 读写，不要因为弹窗就换工具（2026-09-29 的教训）。

---

## 10. 设计产出物（design-assets）

- 说明文件：`design-assets/README.md`。
- `icons/`：如 `washi-ledger-app-icon`、`ic-alarm-fw`、`rate-shortcut-fab`、`summer-fireworks-icon-effects`。
- `prototypes/`：如小票多凭证上传、日历统计、诊断日志页、汇率走势图等原型。
- 规则：
  - 每个产出物一个子文件夹。
  - `final/` 只放当前接入的版本，产出即同步更新。
  - `history/` 只增不删。
  - 每次新设计发布新的 Artifact，不复用旧链接覆盖。

---

## 11. 工具清单（完整，日常所用）

### A. 代码与构建（沙盒内）

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Git | 提交、fetch、推送 | 推送要用户说「推」；推送前 fetch；禁止 `--force`；只 `git add` 具体文件 |
| Node / npm | 安装依赖与构建 | `npm ci`；`npx tsc -b`（类型检查）；`npx oxlint`（退出码 0 即通过，警告不阻塞）；`npm run build`；`npm run dev -- --port 5181`（验证用） |
| patch-package | 应用 `washi-ledger/patches/` 的补丁 | `postinstall` 自动执行 |
| esbuild | 把 TS 模块打成独立 `.mjs`，用于单元测试 | 例：`npx esbuild src/lib/xxx.ts --bundle --format=esm --platform=node` |
| Python（PIL、WCAG 对比度） | 颜色对比度计算、像素分析 | 用脚本算，不靠肉眼 |
| npm audit | 查依赖的已知漏洞（只读） | `npm audit --omit=dev`，前端和 `worker/` 各跑一次 |

### B. 测试与验证

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Playwright（沙盒内 Chromium） | 跑真实页面、截图、量像素 | Chromium 路径 `/opt/pw-browsers/chromium`；脚本里 `require('/opt/node22/lib/node_modules/playwright')`；`chromium.launch({ executablePath })`；**不要执行 `playwright install`** |
| 真机（用户） | 最终验证 | 由用户装 IPA 后做，AI 做不了 |

Playwright 注意：
- 用 `page.route` 模拟 `*.workers.dev` 和 `supabase.co/rest/v1/*`。mock 要区分 GET 和 POST；POST 只返回实际插入的行。
- 用 `localStorage` seed 缓存（见第 8 节）。
- 设置缓存里的语言要设成 `zh`，否则日文界面的文字定位会失败。
- 手机宽度用 390×844。
- 沙盒连不上真实 Supabase 登录，所以涉及登录态的流程只能部分验证。

### C. 后端与数据

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Supabase（认证、Postgres、Storage、Realtime） | 数据库和存储 | 项目 URL 和 anon key 在 `washi-ledger/.env.example` 和 `worker/wrangler.toml`。SQL 由用户在 SQL Editor 执行，AI 没有写权限。 |
| Supabase 控制台 | 看定时任务和日志 | Integrations → Cron 看任务与运行记录；Logs 的保留期见第 6 节 |
| DBeaver（用户本机） | 用户自己查库，如 `pg_stat_activity`、`cron.job`、`cron.job_run_details` | 连接信息不写进文档 |
| Cloudflare Wrangler（用户本机） | 部署 Worker | `npx wrangler login`（一次性）；`npx wrangler deploy`。沙盒连不上 Cloudflare |
| Worker 本地开发 | 本地调试 Worker | `npx wrangler dev`，地址 `http://127.0.0.1:8787`；`.env` 里的 `VITE_API_BASE_URL` 指向它 |

### D. iOS 打包与安装

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Capacitor 7 | 把 `dist/` 打成 iOS 壳 | `washi-ledger/capacitor.config.json`：`appId` 为 `com.cidstevez01.washiledger`，`appName` 为 `PigBang`，`webDir` 为 `dist`（现有配置，不要随便改）。改配置或插件后要重新打 IPA |
| GitHub Actions（macOS runner） | 编译未签名 IPA | 按 10 倍分钟计费，只在需要真机测试时跑 |
| `washi-ledger-ios-test-build.yml` | 打 washi-ledger 的 IPA | 名称「Washi Ledger iOS 测试包(未签名 .ipa)」，workflow_id `336719691`。**只能手动触发**，`ref` 填分支名 |
| `washi-ledger-ci.yml` | 类型检查和构建 | workflow_id `336633145`。push 自动运行 |
| `ios-test-build.yml`、`ios-release.yml` | 旧 App（`index.html`）的打包 | 也是手动触发，与 washi-ledger 无关 |
| Sideloadly（用户本机） | 把未签名 IPA 装到 iPhone | 拖入 IPA，填 Apple ID 登录，Anisette 服务器可选本地或远程。**当前卡住**：Apple 登录报 GrandSlam 434 错误（validate 步骤）。切换 Anisette 本地或远程后，用户反馈仍然失败，待用户处理。沙盒无法操作设备 |

### E. 项目管理

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| GitHub MCP（`mcp__github__*`） | 触发和查看 Actions | `actions_run_trigger`：`method: "run_workflow"`，需要 `owner`、`repo`、`workflow_id`（文件名）、`ref`。`actions_list`：`list_workflows`、`list_workflow_runs`，可按 `branch`、`event` 过滤。**触发前要用户明确同意**（远程操作）。GitHub 操作优先用 MCP |
| Smartsheet MCP（`mcp__Smartsheet__*`） | 需求表和 Bug 表 | 见第 9 节。常用：`get_resource_guide`、`get_columns`、`get_sheet_summary`、`find_in_sheet`、`plan_change`、`add_rows`、`update_rows` |
| Smartsheet 网页（用户） | 查看和手动编辑 | 同一个账号，同一个工作区 |

### F. 设计

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Stitch MCP（Google 设计工具） | 生成界面设计稿 | 配置在仓库根目录 `.mcp.json`，key 从环境变量 `STITCH_API_KEY` 读取，**不写进仓库**。设计稿存进 `design-assets/` |
| `baoyu-image-gen`（skill） | AI 生图，主要用于图标 | 图标用 `--quality normal --ar 1:1`；不用 `2k` / `high`，除非用户明确要求 |
| `baoyu-compress-image`（skill） | 压缩生成的图片 | 缩到 256×256 左右（200 到 300px 区间）再交付 |
| Claude Artifact（claude.ai 私有页面） | 交互式预览，如节假日圆点位置的预览工具 | 每次更新用同一个链接覆盖，不新建。已发布过：https://claude.ai/artifact/CwLtSM65cKPr56BCEaqWiK（10-21 记录） |
| Figma / Netlify / Send MCP | 会话里可用，本项目没用过 | 不用 |

### G. Claude Code 自带工具（会话里用）

| 工具 | 用途 | 怎么用 / 规则 |
|---|---|---|
| Read / Edit / Write / Glob / Grep | 读改文件、搜索 | 能用专用工具就不用 shell 命令 |
| Bash | 跑命令 | 前台 `sleep` 会被拦，等待用 Monitor 或让脚本自己等 |
| AskUserQuestion | 关键决策点 | 只在真正需要用户决定时用，比如分支选择 |
| WebSearch / WebFetch | 调研资料 | 结论要带来源链接。部分域名可能被沙盒网络策略挡住（报 `EGRESS_BLOCKED`），以用户的网络设置为准 |
| ToolSearch | 加载延迟加载的工具 | `select:<工具名>` |
| SendUserFile | 把文件发给用户 | 写一句说明（caption） |
| Agent（Explore 子代理） | 大范围查代码结构 | 很少用 |
| Skill | 调用 skill，如 baoyu 系列 | 用户输入 `/<skill名>` 时调用 |

### H. 环境提醒

- **stop-hook**（`~/.claude/stop-hook-git-check.sh`）：会话结束时检查未推送的提交并提醒。只是提醒，不是推送授权。
- **沙盒连不上**：Cloudflare、Supabase 真实登录、iOS 真机、`holidays-jp.github.io`、`api.frankfurter.dev`。依赖这些的验证要用户在本机做。

---

## 12. 沙盒操作注意（给接手的 AI）

- 不要对 Supabase 真库做写操作。没有权限，而且 SQL 由用户执行。
- 验证脚本放在会话的 scratchpad，不进仓库。会话结束就没了，需要时按第 11 节 B 的 mock 思路重写。
- Worker 的 GET 要返回 snake_case 字段，因为 App 的 `dbRowToRule` 读的是 snake_case。mock 时别返回 camelCase。
- 指导用户在本机操作时，先确认他的仓库是最新的（`git fetch` 再 `git checkout washi-ledger-ui-fixes`），再一条一条给命令。

---

## 13. 本次验证记录

- `tsc -b` 通过。
- `oxlint` 退出码 0。警告都是已有的，不在本次改动的文件里。
- Playwright，dev.5 修复：`verify-misreport`（M1 到 M4）全部 PASS：
  - M1：保存，插入成功 → 记「生成记录」。
  - M2：保存，云端已存在 → 记「已存在，跳过」。
  - M3：首页，云端已存在 → 记「已存在，跳过」。
  - M4：首页，插入成功 → 记「生成记录」。
- Playwright，日志页回归 `verify-logs2`（T1 到 T6）全部 PASS：设置页顺序、保存生成记录字段、首页生成、模块计数与筛选、清空当前模块、模块开关。
- **未做**：真机（IPA）验证、真实 Supabase 写入验证、服务器归因验证。

---

## 14. 待办与待决定

1. **[用户]** 真机验证 dev.1 到 dev.5（用 run #105 的 IPA）。
   - 设置 → 固定收支 → 保存一条本月规则，看诊断日志：云端本月没有 → 「生成记录」；已有 → 「已存在，跳过」，不应再出现「生成记录」。
   - 首页补生成的日志。
   - 日志页的模块筛选和开关。
2. **[用户]** 确认 Worker 删除幂等改动已经 `npx wrangler deploy`。没部署的话，线上还是旧代码。
3. **[用户]** Sideloadly 装机，Apple 登录报 GrandSlam 434。
4. **[用户 → AI]** 验证结果回填 Smartsheet：R-48、R-49、B-85 的「测试结果」和状态。
5. **[用户，可选]** 服务器归因测试，见第 6.3 节。
6. **[待定]** pg_cron 第 1 日延迟：是否改函数为按 JST 计算月份（需要用户执行新 SQL）。
7. **[待定]** 服务器生成的记录是否需要数据库日志表。
8. **[待定]** 新增失败后重新输入会生成新 id：是否做待发送队列。
9. **[待确认]** 分支：系统指定 `claude/smartsheet-integration-hzubob`，实际一直在 `washi-ledger-ui-fixes`。是否统一。10-29 用户已确认推到 `washi-ledger-ui-fixes`，之后有变化再问。
10. **[待确认]** 10-26 的改动在 Bug 表里有对应条目，但没有逐条核对编号。

---

## 15. 参考文件

- `CLAUDE.md`：规则总表。修改前先说明理解、推送规则、设计产出物、图标规范、版本与分支、Smartsheet 流程、指导用户本机操作。
- `DEVLOG.md`：长期规则与各分支记录。
- `VERSIONS.md`：版本记录（开发版本表）。
- `HANDOFF-washi-ledger-20261021.md`：架构、数据库、Worker、前端的详细说明。第 3 到 5 节仍有效。第 2 节工具表已被本文件第 11 节替代。
- `HANDOFF-washi-ledger-rewrite.md`：washi-ledger-rewrite 线（较早）。
- `HANDOFF-session-20260915.md`：09-15 那次会话的记录（R-32 扫描、Capacitor 升级）。
- `HANDOFF-smartsheet-tracker.md`：08-19 Smartsheet 追踪表的交接。
- `sql/`：已执行的迁移脚本，文件名带日期。
- `design-assets/README.md`：设计产出物的说明。

---

本文件写于 2026-10-29。之后的改动请写在新的日期文件里，不要覆盖本文件。
