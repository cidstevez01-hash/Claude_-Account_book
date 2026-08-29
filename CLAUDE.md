# 给 Claude Code 的强制规则(每次会话自动加载,不用去翻DEVLOG.md才想起来)

## 修改前必须先确认理解
- 用户报一个问题/bug/需求后，**第一步必须是用文字说明"问题是什么、错在哪里、打算怎么改"**，不能上来就读文件、定位代码、一路改下去。
- 必须等用户明确确认（比如"对"/"是的"/"可以"），确认过理解无误，才能开始真正动手改代码。
- 这条不分任务大小、不分是否"看起来很明确"——哪怕自己觉得问题已经很清楚，也要先过一遍文字确认这一步，不能自己判断"这个不用问"就跳过。
- 用户可能会连续追问/催促，但只要没有明确说"对"/"改吧"这类确认词，都不能开始改代码。

## 推送前必须确认
- 推送(git push)之前，**必须先报版本号**，等用户明确说"可以推"/"推"这类清晰指令才能执行 `git push`。
- 用户解释"为什么想推"、抱怨看不到东西、催促，都**不算**确认，不能当成"可以推"来推送。
- 每次push前用 `git fetch` 检查远程是否被其他会话推进过，有冲突就 `git rebase`/合并，不要用 `--force`。

## 设计产出物(图标/原型/图片等)
- **不许覆盖**：每做一次新设计发布成新的Artifact，不复用旧链接反复覆盖。
- **必须存进仓库**：用户确认后，设计资产本体(图片/SVG/HTML)必须提交进 `design-assets/`，不能只留在Artifact或聊天记录里。
- **目录结构**：每个产出物单独开子文件夹(如 `design-assets/icons/ic-alarm-fw/`)，内部再分：
  - `final/`：当前 `index.html` 里实际接入的内容，只保留这一份，产出即同步更新（不需要等用户确认才存）
  - `history/`：被取代的历次版本，只增不删，用于追溯
- **汇报格式固定**：每次汇报设计产出物，**消息最前面先给"名称 · 路径"**，再接效果说明/截图，不要把名字路径埋在后面。
- **动手做设计前**：先告诉用户这次产出物准备存进 `design-assets/` 哪个目录。

## 图标生成规范(baoyu-image-gen)
使用 `baoyu-image-gen` 技能生成图标（App 图标、按键图标等）时，始终遵循：
- **生成阶段**：使用 `--quality normal --ar 1:1`（正方形、低成本档位），不要用 `2k`/`high` 档位，除非用户明确要求更高画质。
- **最终尺寸**：服务商通常不支持直接生成 200-300px 的小图，所以按正常最小尺寸生成后，用 `baoyu-compress-image` 技能把最终图片缩小到 200-300px 区间(如 256x256)再交付给用户。
- 不需要用户每次重复提醒这个尺寸要求，每次做图标类任务都按此流程执行。

## 版本号 / 分支
- 分支命名固定用 `accountbook-YYYYMMDD`，不是版本号格式，两者不要混用。
- 版本号定版规则见 `VERSIONS.md` 的"命名规则"一节(开发分支版本号 `YYYYMMDD-dev.N`，跟 `APP_VERSION` 脱钩)。
- `index.html` 里 `DEV_BUILD`/`DEV_BUILD_DATE` 常量要跟实际报给用户的版本号对齐——报版本号前先读一下这两个常量的当前值，不要凭记忆/上一轮猜的数字直接报。

## 发版流程

### 发开发版本（日常推送开发分支）
1. 分支用 `accountbook-YYYYMMDD`（当天第一个），同一天需要另开就加 `-2`/`-3` 后缀。
2. 每次要推送前，先读 `index.html` 里当前的 `DEV_BUILD_DATE`/`DEV_BUILD` 常量实际值（不要凭上一轮记的数字），换了新的一天就把 `DEV_BUILD_DATE` 改成当天日期、`DEV_BUILD` 重置成 1；同一天再推一次就把 `DEV_BUILD` 在当前值上 +1。`IS_DEV_BUILD` 保持 `true`。
3. 把这次改动内容 + 版本号（`{DEV_BUILD_DATE}-dev.{DEV_BUILD}`）**报给用户**，等用户明确说"可以推"/"推"再执行 `git push`（先 `git fetch` 确认远程没被其他会话推进，有的话 `rebase` 再推）。
4. 推送后，在 `VERSIONS.md`「开发版本」表里加一行记录（版本号/日期/说明/分支）。

### 发正式版本（合并进主分支发布）
1. 确认这次要合入主分支发布的内容都已经在开发分支上验证过。
2. 把 `index.html` 里 `APP_VERSION` 跳到新的语义化版本号（`vMAJOR.MINOR.PATCH`），`IS_DEV_BUILD` 改成 `false`（正式版设置页只显示干净的 `v{APP_VERSION}`，不带 `-dev.N`）。**`VERSION` 文件也要同步改成同一个版本号**——这是`.github/workflows/ios-release.yml`编译原生ipa时读取的版本号来源，跟`index.html`里的`APP_VERSION`是两处独立的地方，漏改一处就会导致原生App版本号和网页版对不上（这个坑已经踩过一次）。
3. 在主分支上提交一个 `release: vX.Y.Z` 提交，**不额外拉同名快照分支**（`v1.0.0`~`v2.0.4`是旧规则留下的快照分支，之后不再新增同类分支；需要回滚时直接在主分支提交历史里找对应的 `release: vX.Y.Z` 提交）。
4. 在 `VERSIONS.md`「正式版本」表里加一行记录。
5. 同样要先报版本号、等用户明确确认才能推送到主分支——正式发布影响面更大，这一步不能省。
6. 推送到主分支**不会**自动触发任何GitHub Action——`.github/workflows/`下的iOS相关workflow都是`workflow_dispatch`纯手动触发，要出新的原生ipa/发GitHub Release，需要用户自己去仓库Actions页面手动点"Run workflow"。

## 另一条独立开发线：washi-ledger重写
- 上面"版本号/分支/发版流程"这几节说的都是旧App(`index.html`，`DEV_BUILD`/`APP_VERSION`那套)，**不适用**于`washi-ledger-rewrite`分支下`washi-ledger/`子目录这个从零重写的新项目——它是独立的Vite+React+TypeScript+Tailwind项目，版本号在`washi-ledger/package.json`里，记录见`VERSIONS.md`「Washi Ledger重写」一节。
- 推送前依然要报版本号、等用户明确说"推"/"可以推"——这条规矩不分项目，两条线都适用。
- 完整背景/架构/已完成页面/设计原则见根目录`HANDOFF-washi-ledger-rewrite.md`，接手这条线之前必须先读完，不要凭记忆重新猜方向。
- 两条线的CI/开发记录分开维护，`DEVLOG.md`里`washi-ledger-rewrite`分支的行单独记录，不跟`accountbook-YYYYMMDD`那条线的行混着理解。

## 需求 / Bug 追踪表(Smartsheet)
- 用户不再用聊天原文提需求/报 bug，而是写进 Smartsheet 的两张在线表，**每次会话开始处理任务前，应该去读这两张表**，不要只等用户在对话里重复描述。
- 通过 Smartsheet MCP connector 读写（`mcp__Smartsheet__*` 工具，先调 `get_resource_guide` 拿编排指南）。如果调用被权限拦住且没有弹出确认提示，跟用户说明这是会话权限模式的问题，不是表本身的问题。
- **workspace**：`washi-ledger 开发追踪`（workspace id `3865640789403524`）
  https://app.smartsheet.com/workspaces/J6JCcX7cf2WPj93CjWCgPm6Fg4Gj5hG8RXjRQC51
- **需求表**（sheet id `4497306844876676`）
  https://app.smartsheet.com/sheets/VJ6rc5vc57cH39pjhjgMVMRj3m8VgMm4qg6CWGh1
  字段：`id`(自动编号 R-01/R-02...) / `标题` / `模块`(下拉) / `需求内容` / `状态`(下拉) / `更新版本` / `备注`
  状态流转：**待处理**(初始) → **处理中**(开始处理时改) → **已处理**(处理完毕时改，并回填`更新版本`列的版本号)
- **Bug 表**（sheet id `3927270329634692`）
  https://app.smartsheet.com/sheets/fFVq6qrV62wwFGP64CxmH9PJ4V48FhhCpFJCjVj1
  字段：`id`(自动编号 B-01/B-02...) / `标题` / `模块`(下拉) / `复现步骤` / `当前现象` / `预期现象` / `状态`(下拉) / `发生版本` / `修复版本` / `测试结果`(下拉 passed/failed) / `备注`
  状态流转：**待处理**(初始) → **处理中** → **已处理**(回填`修复版本`) → **验证中** → 测试结果填 `failed` 时状态打回**待处理**；填 `passed` 时状态改**已解决**
- 两张表的 `id` 都是新增一行时 Smartsheet 自动生成，不用手动编号。
- 处理某一行后要把状态字段实际改掉（不是只在对话里说"处理完了"），这样其他会话/用户刷新表就能看到真实进度。

## 其他长期规则
详见 `DEVLOG.md` 的"⚠️ 长期规则"一节，版本号/分支完整规则见 `VERSIONS.md`。
