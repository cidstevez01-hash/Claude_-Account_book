# 交接说明：账本App"Washi Ledger"重写项目

> 这份文档记录`washi-ledger-rewrite`分支上从零重写App的背景、架构决策、当前进度。新会话接手这条线之前请先读完这份文档，不要凭记忆/凭猜测重新出发——尤其是"已完成页面"和"已确认的设计原则"两节，里面很多结论是跟用户来回试错、被纠正过才定下来的，不用再重新问一遍。

## 背景

现有旧App是单文件`index.html`(Capacitor包成iOS原生App，Sideloadly/AltStore侧载分发)，功能已经很多（记账、分类/细分二级选择、支付方式、标签、积分自动计算、多币种汇率换算、统计图表、云同步、双语zh/ja——闹钟功能已暂时封存，见`ALARM_FEATURE_ENABLED`）。

用户委托Stitch设计了一套新视觉方向"Washi Ledger & Liquid Glass"（日式和纸质感），要求整体翻新。最初尝试"渐进式改造现有单文件"效果一直不理想（用户反馈"看起来一模一样"），根本原因是渐进式改造会不断被现有共享CSS类/sheet容器结构束缚，做不出设计稿要求的"完全不同的布局"。

**最终决定：不新建仓库（新仓库在这个会话环境里有session授权范围的限制，没法可靠接入），改成在同一个仓库里另开`washi-ledger-rewrite`分支，子目录`washi-ledger/`起一个真正组件化的新项目，数据库继续用现有Supabase项目（不迁移数据）。**

## 技术方案（已落地，不是计划）

- **框架**：Vite + React + TypeScript（用户在多个选项里明确选定）
- **样式**：Tailwind CSS v4（CSS-first `@theme`配置），关键原因是Stitch导出的设计稿本身就是Tailwind写的，能把设计稿HTML结构近似直接转成JSX，不用像旧仓库那样手工翻译成自定义CSS
- **路由**：React Router，`BrowserRouter`+`Routes`，见`washi-ledger/src/App.tsx`
- **后端**：复用现有Supabase项目，同一个URL+anon key（`washi-ledger/.env`），不迁移/不改数据库schema
- **i18n**：`washi-ledger/src/lib/i18n.tsx`，React Context+zh/ja两个字典，跟旧App一样"用到哪个key才补哪个"，不是一次性搬空

## 目录结构

```
washi-ledger/
  src/
    App.tsx                 路由入口
    lib/                    supabase client、i18n、图标映射(iconMap.ts)、appIcons.ts(全局chrome图标注册表)
    data/                   catalog.ts(分类/支付方式/标签/记账CRUD)、summary.ts(统计聚合函数)、settings.ts、rate.ts
    hooks/                  useCatalog/useEntries/useSettings，每个都是"拉数据+loading+reload"的薄封装
    types/                  跟数据库表结构对齐的TS类型
    design-system/components/  跨页面复用的纯UI组件：AppLayout/BottomNav/NavDrawer/ConfirmDialog/DonutRing/TrendBarChart
    features/                按页面/业务域分文件夹：ledger(仪表盘)/history/stats/add-entry/rate/settings/account/auth/about/transactions
    assets/                  自托管Material Symbols字体、支付方式品牌logo(从旧App提取)
```

新分类/标签/支付方式加一个字段、图标要换一批，理论上只需要动`lib/iconMap.ts`或`lib/appIcons.ts`这一两个文件，不用满仓库找字符串——这是当初特意问过用户"图标以后会不会常变"之后设计的。

## 已完成页面（十个，全部路由落地，`App.tsx`里没有占位路由）

| 路由 | 页面 | 主要设计稿源 | 备注 |
|---|---|---|---|
| `/` | 仪表盘 | `_44` | 月度结余+分类环状图(点图例钻取明细)+最近记录列表 |
| `/history` | 明细 | `_13` | 搜索+全部/支出/收入筛选+月份范围+按日分组 |
| `/stats` | 统计 | `_38`/`_39`/`_41` | 收支/积分双栏；积分维度按**支付方式**(不是设计稿里虚构的"Shopping Rewards"分类)；两栏各带横向滚动趋势柱状图 |
| `/add` | 记一笔 | `_21` | 两级分类+支付方式+标签+积分自动计算，独立整屏(不套AppLayout的tab shell) |
| `/rate` | 汇率换算 | `_6`/`_35` | 多货币(11种)自由切换，默认JPY↔CNY |
| `/settings` | 设置 | `_18` | 语言(真实生效)/货币/主题，接`user_settings`云同步 |
| `/account` | 我的账户 | `_30`/`_31`/`_32` | 未登录态引导登录/注册，已登录显示真实数据(加入天数/记录数) |
| `/signin` | 登录 | `_1` | 独立整屏页面，不嵌在设置弹层里 |
| `/register` | 注册 | `_14` | 独立整屏页面，含邮箱验证码步骤 |
| `/about` | 关于 | `_19` | 去掉了版本号/条款/评分这几个没有真实内容支撑的项 |

设计稿源目录：`design-assets/prototypes/washi-ledger-stitch-source-v2/`（**这是第二版，比第一版`washi-ledger-stitch-source/`新且权威，之前有过读错版本的教训**），每屏一个`_N/`文件夹，`code.html`是权威Tailwind实现，`screen.png`是预览图——**优先读code.html**，部分`screen.png`本身就是坏文件(导出失败，内容是纯文本报错)，且个别screen图和code.html对不上。

## 已确认的设计原则（不用再问，直接照做）

1. **底部导航**：悬浮胶囊(floating capsule)，3个tab：仪表盘/明细/统计。汇率换算/设置/我的账户/关于放左侧抽屉导航(`NavDrawer`)，不占底部tab位。
2. **记一笔**：分类+细分+支付方式+标签+积分全部合并在同一个页面，不拆成多个独立设计页面——照旧App的信息架构，只是视觉换皮。
3. **设计稿跟真实数据模型冲突时，以真实逻辑为准，不照搬设计稿字面内容**——这是整个项目里被反复验证、每次踩到都要遵守的原则，具体案例：
   - 统计页积分维度：设计稿`_39`/`_42`画的是"Shopping Rewards/Travel Redemptions"这种虚构分类，数据库里根本没有这个维度；真实逻辑(旧App`renderPointsDonut`)是按**支付方式**分组，已经照真实逻辑做
   - 我的账户页：设计稿有"Pro"会员徽章、"Premium Subscription"、"Change Password"，数据模型/旧App都没有这些功能，一律不做，换成真实能算出来的数据(加入天数/记录数)
   - 关于页：设计稿的版本号/条款/隐私政策/应用商店评分，这个重写项目还没有对应真实内容，不展示假数据/死链接
4. **图标**：真正的Google Material Symbols字体（自托管`src/assets/fonts/material-symbols-outlined.woff2`），分类图标/颜色、支付方式图标全部复用旧App`index.html`里的真实数据（`lib/iconMap.ts`里有旧图标编号→Material Symbols名的映射表），支付方式品牌logo(Amazon/Rakuten/Merpay/Paidy/Suica)从旧App的`BRAND_LOGO_COLORS`/`BRAND_LOGO_RASTER`常量原样提取成独立文件，不是重新画的。
5. **数据校验优先用真实数据，不用编的假数据**——之前有一次用记忆里的假分类数据做演示截图被用户发现，之后建立的规矩：改动前先说清楚读了哪个文件；Supabase域名加入代理白名单后，所有涉及真实字段结构的假设都要拿真实查询结果核对（已经靠这个流程抓出过`subcategories`表没有`sort_order`列这种真实的字段假设错误）。

## 已知的简化/缺口（不是漏做，是明确的取舍，commit message里都有说明）

- **趋势图纵轴刻度**按可见范围最大值固定算一次，不像旧App那样跟随横向滚动视口实时重算(那套逻辑接近200行，涉及scroll事件监听+DOM属性动态改写)
- **汇率换算**只接了frankfurter.dev一个数据源，旧App真实逻辑是4源兜底取最新日期，多源容错没做
- **累计残高自定义区间选择器**（旧App页面级的跨月份区间选择）简化成了各图表各自的单月/单年导航
- **自定义细分/标签**支持内联新增改名删除了，但没有拖拽排序等更高级的管理功能
- **原生iOS打包**(`.github/workflows/washi-ledger-ios-test-build.yml`)配置已经搭好(`washi-ledger/capacitor.config.json`，独立于旧App的appId)，但还没有真实的washi-ledger App图标(design-assets里只有`icon_specification_document.md`规格文档，没有生成的图标文件)，目前用Capacitor默认占位图标
- Playwright端到端可视化验证在这个开发沙箱里一直受阻——Chromium连不上代理(curl能连，浏览器连不上，是这个特定沙箱环境的兼容性问题，不是代码/数据问题)，功能正确性靠"真实数据curl核对+typecheck+build"把关，没有截图逐屏验证过

## 版本号/分支/CI

- 版本号：`washi-ledger/package.json`的`version`字段，还没合并/正式发布过，所以沿用"开发分支不用干净`vX.Y.Z`"的规则，格式是`0.0.0-{DEV_BUILD_DATE}-dev.{DEV_BUILD}`(semver prerelease语法承载`{DEV_BUILD_DATE}-dev.{DEV_BUILD}`)，当前`0.0.0-20260818-dev.1`，等真正合并/发布才跳到干净`vMAJOR.MINOR.PATCH`。记录见`VERSIONS.md`「Washi Ledger重写」一节
- 分支：`washi-ledger-rewrite`，已推送到远程，对`claude/upload-project-github-ww338s`开了PR #1
- CI：`.github/workflows/washi-ledger-ci.yml`(push/PR改到`washi-ledger/**`时自动typecheck+build)、`.github/workflows/washi-ledger-ios-test-build.yml`(手动触发，出未签名ipa，appId跟旧App的原生打包互不冲突)
- 每次改动的详细记录见`DEVLOG.md`里`washi-ledger-rewrite`分支那几行（跟`accountbook-YYYYMMDD`那条主线分开记录，见`DEVLOG.md`顶部的说明）

## 关于旧仓库/旧分支

旧App`index.html`及其`accountbook-YYYYMMDD`开发分支线不受这次重写影响，继续独立维护。`accountbook-20260817`分支上有第一轮"渐进式改造旧单文件"的尝试代码(已放弃，仅供历史参考)。
