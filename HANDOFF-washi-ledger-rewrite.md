# 交接说明：账本App"Washi Ledger"重写项目

> 这份文档是在旧仓库(`cidstevez01-hash/Claude_-Account_book`)的一次会话里，跟用户反复讨论/试错后确定的重写方案。
> 新会话请先读完这份文档再动手，不要重新猜测方向。

## 背景

现有App是单文件`index.html`(Capacitor包成iOS原生App，Sideloadly/AltStore侧载分发)，功能已经很多（记账、分类/细分二级选择、支付方式、标签、积分自动计算、多币种汇率换算、统计图表、云同步、双语zh/ja、多主题皮肤、原生闹钟——闹钟功能目前已封存不可见）。

用户委托Stitch设计了一套新视觉方向"Washi Ledger & Liquid Glass"（日式和纸质感+iOS液态玻璃），要求整体翻新。在旧仓库里尝试"渐进式改造现有单文件"效果一直不理想（用户反馈"看起来一模一样""你到底哪里听不懂"），根本原因是渐进式改造会不断被现有共享CSS类/sheet容器结构束缚，做不出设计稿要求的"完全不同的布局"。

**最终决定：另起新仓库，用真正的组件化技术栈重写，数据库继续用现有Supabase项目（不迁移数据）。**

## 技术方案

- **框架**：Vite + React + TypeScript
- **样式**：Tailwind CSS —— 关键选择，因为Stitch导出的设计稿本身就是Tailwind写的，用同一套方案可以把设计稿HTML结构近似直接搬过去（转成JSX），而不是像旧仓库那样手工翻译成自定义CSS
- **路由**：React Router
- **后端**：复用现有Supabase项目，同一个URL+anon key，不迁移/不改数据库schema。具体连接凭据在旧仓库`index.html`里搜`supabaseClient`初始化那段能找到（`createClient(url, anonKey)`）
- **新仓库**：`https://github.com/cidstevez01-hash/Claude_Account_book`（用户已建好空仓库，只有一个README.md）

## 设计稿源文件位置

旧仓库：`design-assets/prototypes/washi-ledger-stitch-source/`
- `washi_ledger_liquid_glass/DESIGN.md`——设计系统规范文档（配色/字体/圆角/间距/组件规则），**这是最高优先级参考**，比具体某一屏的截图更权威
- `_1/` ~ `_12/`：每个文件夹是Stitch导出的一屏，`code.html`是权威的Tailwind实现，`screen.png`是预览图（**优先读code.html，screen.png可能跟code.html对不上**——旧会话里发现过这个问题）

12屏对应关系：
| 文件夹 | 内容 | 备注 |
|---|---|---|
| _1 | Dashboard(首页仪表盘) | 底部导航是贴底通栏——**不采用**，见下面"已确认的设计决策" |
| _2 | Settings | 跟_9重复，**不采用**，用_9 |
| _3 | Navigation Drawer(左侧抽屉导航) | 跟_8重复，**不采用**，用_8 |
| _4 | 汇率换算 | 采用，入口放左侧抽屉导航里 |
| _5 | Add Transaction(记账/入力) | 只有简化的8宫格分类，**不采用它的分类UI**，见下面 |
| _6 | Reports and Analytics(统计) | 采用 |
| _7 | Transaction History(明细) | 采用，作为新增的"明细"tab |
| _8 | Navigation Drawer | **采用**(比_3新) |
| _9 | Settings | **采用**(比_2新) |
| _10 | Sign In(登录) | 采用——**必须做成独立全屏页面**，不能塞进设置弹层里 |
| _11 | Account(个人中心) | 参考，但底部导航跟_1不一致，已重新定夺见下 |
| _12 | Register(注册) | 采用——同样是独立全屏页面，floating label输入框风格 |

## 已确认的设计决策（这些不用再问用户，直接照做）

1. **底部导航**：悬浮胶囊(floating capsule)样式，不是_1截图里那种贴底通栏——DESIGN.md原文写的是"A floating capsule with a backdrop-filter"，这是权威依据。4个tab从左到右：**仪表盘(概览) / 明细 / 统计 / 设置**。
   - 汇率换算**不在底部tab里**，入口放在左侧抽屉导航中
2. **左侧抽屉导航**：保留(照_8做)，即使底部4个tab已经覆盖主要入口，抽屉作为补充入口（放汇率换算等次要功能）
3. **明细(History) tab**：新增页面，照_7(Transaction History)设计稿做
4. **设置页**：照_9做（不是_2）
5. **登录/注册**：必须是独立的全屏页面(照_10/_12)，**不能**像旧仓库那样塞进设置弹层/sheet里跟语言、货币选项挤在一起——这是用户反复强调的点
6. **记账/分类选择逻辑**：**完全复用现有App的逻辑，不按Stitch _5那个简化8宫格重做**。现有逻辑是：
   - 分类(category) + 细分(subcategory)二级选择
   - 支付方式(payment method)选择
   - 标签(tag)选择（可新建/改名/删除）
   - 积分(points)输入，支持按支付方式+日期自动计算还元率(有`payment_method_point_rules`特殊日期规则，比如"メルペイ每月8号9%")
   - 这些字段现有App里**全部合并在同一个"入力"(记账)页面里**，没有拆成多个独立设计页面——新App也应该照这个信息架构做，只是视觉换成Washi Ledger风格，不要重新设计交互流程
   - 具体字段/数据结构/计算逻辑，去旧仓库`index.html`搜索这些函数/变量作参考：`renderCatGrid`、`resolvePointRate`、`updatePointsAutoFill`、`categories`/`subcategories`/`paymentMethods`/`tags`这几个数据结构，以及Supabase表：`categories`、`subcategories`、`payment_methods`、`payment_method_point_rules`、`tags`、`entries`

## 还没覆盖到的缺口（开发到对应功能时需要用户补充设计方向，不要自己瞎猜）

- 分类管理、支付方式管理、标签管理的**独立管理页面**（如果现有App有独立管理页的话，需要去旧仓库确认；如果没有，新App要不要加也需要问）
- 编辑已有记录的页面/流程（现有逻辑是复用"入力"表单，传入已有数据）
- 搜索结果展示（现有ledger页面有搜索框功能）
- 闹钟相关——**现有App闹钟功能已经暂时封存**(`ALARM_FEATURE_ENABLED=false`，因为免费Apple ID侧载拿不到AlarmKit等系统权限，后台响铃不可靠)，新App**不需要**做这部分
- 中日双语文案——所有Stitch设计稿文字都是英文，需要照旧仓库`index.html`里的`I18N.zh`/`I18N.ja`两个对象把对应文案抄过去，日语文案通常比中英文长，卡片/按钮宽度要留余量测试

## 图标方案

用户明确要求用**真正的Google Material Symbols字体**，不要用旧仓库那套手绘SVG图标（这点在旧仓库来回拉扯了好几轮才定下来）。新项目里直接按npm包或者字体文件正常引入即可（新项目有构建系统，不用像旧仓库单文件那样纠结"要不要base64内嵌"的取舍）。

## 关于旧仓库

旧仓库`cidstevez01-hash/Claude_-Account_book`保留，不删除，`accountbook-20260817`分支上有这次翻新尝试到一半的代码（已提交未推送/未合并），可以当参考，但**新仓库不是从这个分支继续，是全新项目**。
