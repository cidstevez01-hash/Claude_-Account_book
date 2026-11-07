# PigBang 红叶主题 · 页面与图片清单

确认依据：`20261104-02/pigbang-lineart-two-petioles.png`。后面的轮廓修复版均不采用。

| 类别 | 数量 | 交付 |
|---|---:|---|
| 独立页面 | 16 | 16张页面样式预览 |
| 共用弹层 | 7 | 7张预览 |
| 内嵌选择器 | 2 | 2张组件预览 |
| 图标标识 | 86 | 86张独立透明图 |
| 专用支付/积分图形 | 4 | 4张独立透明图 |
| 背景/装饰 | 6 | 6张独立图 |
| 合计 | **121** | 不含参考图、SVG源码与总览缩略图 |

图标保留项目既有造型、制作红叶主题配色；背景枝叶直接从确认稿拆分。页面样式稿按当前代码结构制作，使用占位/空态，无真实账户数据。本轮没有新增生图API请求。

## 页面及共用组件

| 编号 | 页面/组件 | 路由/类型 | 图片 |
|---|---|---|---|
| P-01 | 首页/概览 | / | [780×1688](pages/P-01-DashboardPage.png) |
| P-02 | 明细/出入金 | /history | [780×1688](pages/P-02-HistoryPage.png) |
| P-03 | 统计 | /stats | [780×1688](pages/P-03-StatsPage.png) |
| P-04 | 记一笔（含编辑/复制） | /add | [780×1688](pages/P-04-AddTransactionPage.png) |
| P-05 | 汇率换算 | /rate | [780×1688](pages/P-05-RatePage.png) |
| P-06 | 设置 | /settings | [780×1688](pages/P-06-SettingsPage.png) |
| P-07 | 主题选择 | /theme | [780×1688](pages/P-07-ThemePage.png) |
| P-08 | 诊断日志 | /settings/debug-log | [780×1688](pages/P-08-DebugLogPage.png) |
| P-09 | 固定收支规则列表 | /settings/recurring-rules | [780×1688](pages/P-09-RecurringRulesPage.png) |
| P-10 | 固定收支规则表单（新增/编辑） | /settings/recurring-rules/form | [780×1688](pages/P-10-RecurringRuleFormPage.png) |
| P-11 | 我的账户（登录/未登录） | /account | [780×1688](pages/P-11-AccountPage.png) |
| P-12 | 头像选择 | /account/avatar | [780×1688](pages/P-12-ChangeAvatarPage.png) |
| P-13 | 登录 | /signin | [780×1688](pages/P-13-SignInPage.png) |
| P-14 | 注册（含验证码步骤） | /register | [780×1688](pages/P-14-SignUpPage.png) |
| P-15 | 关于 | /about | [780×1688](pages/P-15-AboutPage.png) |
| P-16 | 日历 | /calendar | [780×1688](pages/P-16-CalendarPage.png) |
| D-01 | 抽屉导航 | 共用弹层 | [780×1688](pages/D-01-NavDrawer.png) |
| D-02 | 记账详情弹层 | 共用弹层 | [780×1688](pages/D-02-EntryDetailSheet.png) |
| D-03 | 分类统计明细弹层 | 共用弹层 | [780×1688](pages/D-03-CategoryDetailSheet.png) |
| D-04 | 小票/PDF预览 | 共用弹层 | [780×1688](pages/D-04-ReceiptPreviewSheet.png) |
| D-05 | 小票扫描弹层 | 共用弹层 | [780×1688](pages/D-05-ReceiptScanSheet.png) |
| D-06 | 日期区间选择器 | 共用弹层 | [780×1688](pages/D-06-RangeCalendarPicker.png) |
| D-07 | 分类/子分类选择器 | 内嵌选择器 | [780×1688](pages/D-07-CategoryPicker.png) |
| D-08 | 标签选择器 | 内嵌选择器 | [780×1688](pages/D-08-TagPicker.png) |
| D-09 | 确认弹窗 | 共用弹层 | [780×1688](pages/D-09-ConfirmDialog.png) |

## 背景与装饰

| 编号 | 名称 | 尺寸 | 制作方式 |
|---|---|---|---|
| B-01 | [和纸底纹](backgrounds/B-01-paper.png) | 512×512 | 依据确认稿色调制作可平铺底纹 |
| B-02 | [右上角线稿枝叶](backgrounds/B-02-branch.png) | 1024×768 | 从确认稿提取线条，透明底 |
| B-03 | [左下角线稿叶组](backgrounds/B-03-corner.png) | 512×640 | 从确认稿提取，保留当时叶形 |
| B-04 | [飘落小叶](backgrounds/B-04-falling.png) | 256×256 | 从确认稿提取，透明底 |
| B-05 | [卡片枫叶水印](backgrounds/B-05-watermark.png) | 512×512 | 从确认稿提取，透明底 |
| B-06 | [和纸胶带](backgrounds/B-06-tape.png) | 256×128 | 按确认稿制作透明胶带 |

## 图标逐张清单

同一造型只做一张，多页面复用。下表包含分类可选映射池；实际云端分类使用情况未查询。完整代码位置见 manifest.json。

| 编号 | 图标 | 标识 | 使用页面/组件 |
|---|---|---|---|
| I-001 | [记账本](icons/I-001-book.png) | `book` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-002 | [明细/历史](icons/I-002-history.png) | `history` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-003 | [统计](icons/I-003-bar_chart.png) | `bar_chart` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-004 | [添加](icons/I-004-add.png) | `add` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-09 固定收支规则列表；P-10 固定收支规则表单（新增/编辑）；D-08 标签选择器 |
| I-005 | [菜单](icons/I-005-menu.png) | `menu` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-006 | [账户](icons/I-006-person.png) | `person` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-007 | [日历](icons/I-007-calendar_month.png) | `calendar_month` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历；D-01 抽屉导航 |
| I-008 | [汇率](icons/I-008-currency_exchange.png) | `currency_exchange` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历；D-01 抽屉导航 |
| I-009 | [设置](icons/I-009-settings.png) | `settings` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历；D-01 抽屉导航 |
| I-010 | [关于/提示](icons/I-010-info.png) | `info` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历；D-01 抽屉导航；D-05 小票扫描弹层 |
| I-011 | [返回](icons/I-011-arrow_back.png) | `arrow_back` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-05 汇率换算；P-06 设置；P-07 主题选择；P-08 诊断日志；P-09 固定收支规则列表；P-10 固定收支规则表单（新增/编辑）；P-11 我的账户（登录/未登录）；P-12 头像选择；P-14 注册（含验证码步骤）；P-15 关于；P-16 日历 |
| I-012 | [关闭](icons/I-012-close.png) | `close` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层；D-04 小票/PDF预览；D-05 小票扫描弹层；D-06 日期区间选择器 |
| I-013 | [语言](icons/I-013-language.png) | `language` | P-06 设置 |
| I-014 | [现金/货币](icons/I-014-payments.png) | `payments` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-015 | [主题](icons/I-015-palette.png) | `palette` | P-06 设置 |
| I-016 | [周期记账](icons/I-016-event_repeat.png) | `event_repeat` | P-06 设置；P-09 固定收支规则列表 |
| I-017 | [诊断日志](icons/I-017-bug_report.png) | `bug_report` | P-06 设置 |
| I-018 | [银行](icons/I-018-account_balance.png) | `account_balance` | P-05 汇率换算 |
| I-019 | [钱包](icons/I-019-account_balance_wallet.png) | `account_balance_wallet` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-020 | [账户头像](icons/I-020-account_circle.png) | `account_circle` | P-11 我的账户（登录/未登录） |
| I-021 | [闹钟](icons/I-021-alarm.png) | `alarm` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-022 | [楼房](icons/I-022-apartment.png) | `apartment` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-023 | [支出方向](icons/I-023-arrow_downward.png) | `arrow_downward` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-024 | [收入方向](icons/I-024-arrow_upward.png) | `arrow_upward` | P-01 首页/概览 |
| I-025 | [日期选择](icons/I-025-calendar_today.png) | `calendar_today` | P-01 首页/概览；P-02 明细/出入金 |
| I-026 | [分类默认](icons/I-026-category.png) | `category` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-09 固定收支规则列表；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-027 | [庆祝](icons/I-027-celebration.png) | `celebration` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-028 | [勾选](icons/I-028-check.png) | `check` | P-04 记一笔（含编辑/复制）；P-07 主题选择；P-10 固定收支规则表单（新增/编辑）；P-12 头像选择；D-07 分类/子分类选择器；D-08 标签选择器 |
| I-029 | [服饰](icons/I-029-checkroom.png) | `checkroom` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-030 | [上一项](icons/I-030-chevron_left.png) | `chevron_left` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-16 日历；D-06 日期区间选择器 |
| I-031 | [下一项](icons/I-031-chevron_right.png) | `chevron_right` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-06 设置；P-16 日历；D-03 分类统计明细弹层；D-06 日期区间选择器 |
| I-032 | [云断连](icons/I-032-cloud_off.png) | `cloud_off` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-10 固定收支规则表单（新增/编辑）；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-033 | [复制](icons/I-033-content_copy.png) | `content_copy` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-08 诊断日志；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-034 | [信用卡](icons/I-034-credit_card.png) | `credit_card` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-035 | [删除](icons/I-035-delete.png) | `delete` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-08 诊断日志；P-10 固定收支规则表单（新增/编辑）；P-11 我的账户（登录/未登录）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层；D-07 分类/子分类选择器；D-08 标签选择器；D-09 确认弹窗 |
| I-036 | [批量清除](icons/I-036-delete_sweep.png) | `delete_sweep` | P-08 诊断日志 |
| I-037 | [文档](icons/I-037-description.png) | `description` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-038 | [公交](icons/I-038-directions_bus.png) | `directions_bus` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-039 | [汽车](icons/I-039-directions_car.png) | `directions_car` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-040 | [下载](icons/I-040-download.png) | `download` | P-08 诊断日志 |
| I-041 | [编辑](icons/I-041-edit.png) | `edit` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑）；P-11 我的账户（登录/未登录）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层；D-07 分类/子分类选择器；D-08 标签选择器 |
| I-042 | [错误](icons/I-042-error.png) | `error` | P-04 记一笔（含编辑/复制）；D-05 小票扫描弹层 |
| I-043 | [事件](icons/I-043-event.png) | `event` | P-16 日历 |
| I-044 | [无日程](icons/I-044-event_busy.png) | `event_busy` | P-16 日历 |
| I-045 | [展开](icons/I-045-expand_more.png) | `expand_more` | P-06 设置；P-08 诊断日志 |
| I-046 | [筛选](icons/I-046-filter_list.png) | `filter_list` | P-08 诊断日志 |
| I-047 | [帮助](icons/I-047-help.png) | `help` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-048 | [首页](icons/I-048-home.png) | `home` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-15 关于；P-16 日历 |
| I-049 | [注册](icons/I-049-how_to_reg.png) | `how_to_reg` | P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑） |
| I-050 | [图片](icons/I-050-image.png) | `image` | P-12 头像选择 |
| I-051 | [物品](icons/I-051-inventory_2.png) | `inventory_2` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-052 | [灯泡](icons/I-052-lightbulb.png) | `lightbulb` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-053 | [密码锁](icons/I-053-lock.png) | `lock` | P-13 登录 |
| I-054 | [退出登录](icons/I-054-logout.png) | `logout` | P-11 我的账户（登录/未登录） |
| I-055 | [邮件](icons/I-055-mail.png) | `mail` | P-13 登录 |
| I-056 | [医疗](icons/I-056-medical_services.png) | `medical_services` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-057 | [翻开书本](icons/I-057-menu_book.png) | `menu_book` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-05 汇率换算；P-06 设置；P-08 诊断日志；P-09 固定收支规则列表；P-11 我的账户（登录/未登录）；P-12 头像选择；P-13 登录；P-15 关于；P-16 日历；D-01 抽屉导航 |
| I-058 | [空记录](icons/I-058-notes.png) | `notes` | P-08 诊断日志 |
| I-059 | [外部打开](icons/I-059-open_in_new.png) | `open_in_new` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层；D-04 小票/PDF预览 |
| I-060 | [硬币](icons/I-060-paid.png) | `paid` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-061 | [拍照扫描](icons/I-061-photo_camera.png) | `photo_camera` | P-04 记一笔（含编辑/复制）；D-05 小票扫描弹层 |
| I-062 | [PDF](icons/I-062-picture_as_pdf.png) | `picture_as_pdf` | P-04 记一笔（含编辑/复制）；D-05 小票扫描弹层 |
| I-063 | [加载](icons/I-063-progress_activity.png) | `progress_activity` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-09 固定收支规则列表；P-10 固定收支规则表单（新增/编辑）；P-16 日历 |
| I-064 | [账单/明细](icons/I-064-receipt_long.png) | `receipt_long` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-16 日历；D-03 分类统计明细弹层 |
| I-065 | [礼物](icons/I-065-redeem.png) | `redeem` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-066 | [刷新](icons/I-066-refresh.png) | `refresh` | P-08 诊断日志 |
| I-067 | [重置](icons/I-067-restart_alt.png) | `restart_alt` | P-05 汇率换算 |
| I-068 | [餐饮](icons/I-068-restaurant.png) | `restaurant` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-069 | [教育](icons/I-069-school.png) | `school` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-070 | [搜索](icons/I-070-search.png) | `search` | P-01 首页/概览；P-02 明细/出入金；P-08 诊断日志 |
| I-071 | [无搜索结果](icons/I-071-search_off.png) | `search_off` | P-08 诊断日志 |
| I-072 | [标签](icons/I-072-sell.png) | `sell` | P-01 首页/概览 |
| I-073 | [诊断开启](icons/I-073-sensors.png) | `sensors` | P-08 诊断日志 |
| I-074 | [诊断关闭](icons/I-074-sensors_off.png) | `sensors_off` | P-08 诊断日志 |
| I-075 | [规则设置](icons/I-075-settings_suggest.png) | `settings_suggest` | P-08 诊断日志 |
| I-076 | [保障](icons/I-076-shield.png) | `shield` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-077 | [购物](icons/I-077-shopping_basket.png) | `shopping_basket` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-078 | [游戏](icons/I-078-sports_esports.png) | `sports_esports` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-079 | [星标](icons/I-079-star.png) | `star` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-080 | [积分星星](icons/I-080-stars.png) | `stars` | P-04 记一笔（含编辑/复制） |
| I-081 | [交换方向](icons/I-081-swap_vert.png) | `swap_vert` | P-05 汇率换算 |
| I-082 | [趋势](icons/I-082-trending_up.png) | `trending_up` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-083 | [显示密码](icons/I-083-visibility.png) | `visibility` | P-13 登录 |
| I-084 | [隐藏密码](icons/I-084-visibility_off.png) | `visibility_off` | P-13 登录 |
| I-085 | [网络](icons/I-085-wifi.png) | `wifi` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-086 | [工作](icons/I-086-work.png) | `work` | 分类/细分选择、列表与统计中可用的映射候选；非云端实际使用证明 |
| I-087 | [现金支付](icons/I-087-pm-cash.png) | `pm-cash` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-088 | [信用卡支付](icons/I-088-pm-credit.png) | `pm-credit` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-089 | [银行转账支付](icons/I-089-pm-bank.png) | `pm-bank` | P-01 首页/概览；P-02 明细/出入金；P-03 统计；P-04 记一笔（含编辑/复制）；P-10 固定收支规则表单（新增/编辑）；P-16 日历；D-02 记账详情弹层；D-03 分类统计明细弹层 |
| I-090 | [积分硬币](icons/I-090-point-coin.png) | `point-coin` | P-16 日历 |

## 原样保留

Amazon / Rakuten / Merpay / Paidy / Suica / PayPay 六个品牌Logo；现有App图标；12个预设头像及用户头像；小票原图。

## 用代码处理的效果（不另计图片）

- 背景小叶飘落
- 线稿轮廓暖金流光
- 有圈图标外沿柔光
- 裸图标随形柔光
- 卡片纸感/阴影
- 导航选中气泡
- 金色微粒

## 状态与验证

121张均已制作，待用户确认。90张图标均为256×256透明PNG；6张背景/装饰尺寸已核对；25张预览均为780×1688。各图片有单独编号和文件。

尚未接入App，未推送。CSV使用UTF-8 BOM，便于Excel打开。页面新增/编辑/复制、登录状态等沿用同一主题，未按状态重复制作。
