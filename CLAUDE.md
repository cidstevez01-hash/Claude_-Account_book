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

## 需求 / Bug 追踪表(GitHub Issues)
- Smartsheet 已停用(Business plan trial到期)。2026-09-23起改用本仓库的 GitHub Issues 记需求/报bug，**每次会话开始处理任务前，应该去读一遍open状态的issues**(`mcp__github__list_issues` state=open，或直接看下面的Issues页面)，不要只等用户在对话里重复描述。
- **仓库**：`cidstevez01-hash/Claude_-Account_book`
  Issues 总览：https://github.com/cidstevez01-hash/Claude_-Account_book/issues
  新建需求：https://github.com/cidstevez01-hash/Claude_-Account_book/issues/new?template=requirement.yml
  新建Bug：https://github.com/cidstevez01-hash/Claude_-Account_book/issues/new?template=bug.yml
  两个模板文件在 `.github/ISSUE_TEMPLATE/`(requirement.yml / bug.yml)，只存在于仓库默认分支(`claude/upload-project-github-ww338s`)——GitHub"New issue"模板选择器只认默认分支的模板文件，这是平台规则，改模板要提交到那条分支，和具体在开发哪个项目(旧App/washi-ledger)无关。
- **类型**：用GitHub原生Issue Type区分，不额外加标签——`Feature`=需求，`Bug`=Bug(仓库已有这两个type，`list_issue_types`可查)。
- **字段映射**(对应原Smartsheet的两张表)：
  - `id` → issue号(#N)，GitHub自动生成
  - `标题` → issue title
  - `模块` → issue body里的下拉字段(仪表盘/明细/统计/记一笔/汇率换算/设置/我的账户/登录注册/底部导航/全局/其他，和原Smartsheet选项一致)，同时打一个`模块:xxx`标签方便筛选
  - 需求的`需求内容`、Bug的`复现步骤`/`当前现象`/`预期现象`/`发生版本` → 模板里对应的body字段
  - `备注` → body字段，处理过程中的补充说明可以继续往这个字段或issue评论里加
  - `状态` → 用`状态:xxx`标签追踪(新建issue默认自动带`状态:待处理`标签，模板`labels:`字段里配好的)
  - `更新版本`/`修复版本` → 处理完毕时编辑issue body回填对应字段(需求填"更新版本"、Bug填"修复版本")，不新开字段
  - `测试结果` → Bug专用，验证阶段打`测试结果:passed`或`测试结果:failed`标签
- **状态流转**(用`issue_write`改`labels`和`state`/`state_reason`实现，标签名不存在时GitHub会自动新建，不需要额外建标签的工具)：
  - 需求：`状态:待处理`(初始) → `状态:处理中`(开始处理时改) → `状态:已处理`(处理完毕时改，并回填body里的`更新版本`)，需求没有验证环节，回填完版本号后可以直接关闭issue(`state: closed`, `state_reason: completed`)
  - Bug：`状态:待处理`(初始) → `状态:处理中` → `状态:已处理`(回填body里的`修复版本`) → `状态:验证中` → 真机验证后：`测试结果:failed`时改回`状态:待处理`标签重新处理；`测试结果:passed`时关闭issue(`state: closed`, `state_reason: completed`)，对应原来的"已解决"
- 处理某个issue后要把标签/状态实际改掉、该关的要关闭(不是只在对话里说"处理完了")，这样其他会话/用户刷新Issues列表就能看到真实进度。
- 2026-09-23迁移时，Smartsheet两张表里除B-50外全部已是"已解决"状态，未再逐条搬来GitHub(历史记录留在Smartsheet原表里可查)；B-50(汇率走势图1年/1月档折线被压扁)当时是"已处理"等待真机验证，已建到 issue #3，之后按上面的状态流转在GitHub里继续走完。

## 指导用户在本机操作(如wrangler deploy这类沙盒连不上的步骤)
- 第一步永远先确认/拉取最新代码(`git fetch`+`git checkout`到目标分支，或`git pull`)，不能假设用户本机的仓库是最新的——本机可能是很久之前clone的旧checkout，没有最新分支/最新提交，直接给后续命令会导致后面的步骤全部基于旧代码，白折腾。
- 一次只发一条命令，等用户回报结果(或发终端截图)确认这一步真的执行成功了，再给下一条——不要一次性把多条命令连着发给用户，容易因为终端还在跑上一条、用户又粘贴了下一条导致输入互相打架、终端花屏。

## 其他长期规则
详见 `DEVLOG.md` 的"⚠️ 长期规则"一节，版本号/分支完整规则见 `VERSIONS.md`。
