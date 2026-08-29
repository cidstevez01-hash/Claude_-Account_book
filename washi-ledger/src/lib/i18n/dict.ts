import { LEGACY_ZH, LEGACY_JA } from './legacy'

/**
 * 新App实际在用的词典——key名跟着新App组件里`t('xxx')`调用走(不是旧App的key命名)，
 * 但值尽量从./legacy.ts(旧App完整词典)里取，两边概念对得上就直接复用旧App的翻译，
 * 只有旧App没有对应概念的词条才用新App自己写的值(每条都在注释里写清楚来源，方便以后
 * 核对/修正——旧App里没有的词条，先按当前这个值显示，以后再回头修)。
 *
 * 有几处key名字面看着像能对上、实际语义不同，踩过坑要注意别对错：
 * - 新App的typeExpense/typeIncome是"记一笔"页面收支类型切换按钮的文字，对应旧App的
 *   segExpense/segIncome(“支出/收入”分段按钮)，不是旧App里typeExpense/typeIncome
 *   (那两个是分类构成图表的标题"支出构成/支出内訳"，语义完全不同)
 */
export const dict = {
  zh: {
    appTitle: LEGACY_ZH.appTitle,
    tabDashboard: '概览', // 用户明确要求，旧App没有完全对应的词(旧App叫"记账")
    tabHistory: LEGACY_ZH.ledgerSectionTitle, // 用户要求改成"出入金"，旧App正好有这个词
    tabStats: LEGACY_ZH.tabStats,
    // B-31：仪表盘顶部卡片这三个词条不能再叫"本月"——R-27放开自定义日期区间后，
    // 卡片统计的是当前选中的任意区间(不一定是当月)，继续用旧App"本月"系列翻译会
    // 跟实际区间对不上，改成"累计"措辞；旧App没有这个概念，不从legacy.ts取值。
    // monthIncome/monthExpense这两个key本身仍保留旧App"本月"语义，是统计页
    // (StatsPage.tsx，真正按月导航，不是自定义区间)在用，不能跟着改
    balanceLabel: '累计结余',
    rangeIncome: '累计收入',
    rangeExpense: '累计支出',
    monthIncome: LEGACY_ZH.monthIncome,
    monthExpense: LEGACY_ZH.monthExpense,
    recent: '最近记录', // 新App专属(旧App首页没有"最近记录"这个独立区块)
    viewAll: '查看全部', // 新App专属
    today: LEGACY_ZH.today,
    yesterday: LEGACY_ZH.yesterday,
    emptyLine1: LEGACY_ZH.emptyLine1,
    emptyLine2: LEGACY_ZH.emptyLine2,
    historySearchPlaceholder: LEGACY_ZH.detailSearchPlaceholder,
    filterAll: '全部', // 新App专属(旧App明细搜索没有"全部/支出/收入"筛选chip)
    filterExpense: LEGACY_ZH.expenseWord,
    filterIncome: LEGACY_ZH.incomeWord,
    startMonthLabel: '开始月份', // 新App专属，V3会重做成完整起止日期选择器
    endMonthLabel: '结束月份', // 同上
    historyNoResults: '没有符合条件的记录', // 新App专属
    addTitle: LEGACY_ZH.sheetAddTitle,
    editTitle: LEGACY_ZH.editEntryTitle,
    copyTitle: LEGACY_ZH.copyEntryTitle,
    typeExpense: LEGACY_ZH.segExpense, // 注意：对应旧App的segExpense，不是同名的typeExpense，见文件顶部说明
    typeIncome: LEGACY_ZH.segIncome,
    amountLabel: LEGACY_ZH.converterAmountFieldLabel,
    categoryLabel: LEGACY_ZH.catFieldLabel,
    subcategoryLabel: LEGACY_ZH.subFieldLabel, // 新App专属(R-09：子分类区块之前没有标题，照旧App补上)
    methodLabel: LEGACY_ZH.payFieldLabel,
    dateLabel: '日期', // 新App专属(旧App记账表单的日期字段没有单独的文字标签)
    tagsLabel: LEGACY_ZH.tagFieldLabel,
    pointsLabel: LEGACY_ZH.pointsFieldLabel,
    memoLabel: '备注', // 新App专属(旧App只有输入框占位文字，没有单独的字段标签)
    memoPlaceholder: LEGACY_ZH.notePlaceholder,
    saveEntry: LEGACY_ZH.saveBtn,
    rateUpdatedLabel: LEGACY_ZH.rateUpdateLabel,
    refreshRate: LEGACY_ZH.refreshRate,
    rateNeverFetched: LEGACY_ZH.neverFetched,
    rateLoading: LEGACY_ZH.loadingRate,
    rateSearchPlaceholder: '搜索货币…', // 新App专属(旧App汇率页是固定人民币↔日元，没有货币搜索)
    ratePopularTitle: '热门汇率', // 新App专属
    rateTrendLabel: '走势', // 新App专属(R-04汇率页重设计新增的趋势图标题，旧App没有这个走势图功能)
    rateNoHistory: '这段时间没有汇率数据', // 新App专属(周末/节假日frankfurter.dev没有发布数据时的真实提示，不补假数据)
    rateTimeframe1W: '近1周', // 新App专属(R-13：时间范围按钮去掉1D后，剩下三档改用翻译文案，不再直接显示英文缩写)
    rateTimeframe1M: '近1个月',
    rateTimeframe1Y: '近1年',
    // B-10：仪表盘/统计页环状图中间的小字之前写死英文"Total Expenses"/"Total Income"，
    // 不跟着语言切换。旧App对应的是typeExpense/typeIncome("支出构成"/"收入构成")这两个
    // 词条——但新App自己的typeExpense/typeIncome已经被"记一笔"页面的收支切换按钮占用了
    // (对应旧App的segExpense/segIncome，见文件顶部说明)，不能重名，这里另起donut专用的key
    donutExpenseTitle: LEGACY_ZH.typeExpense,
    donutIncomeTitle: LEGACY_ZH.typeIncome,

    // ↓↓↓ 下面是2026-08-18中日文混乱翻译校对新增的词条(见DEVLOG.md "翻译校对"一节)
    menuAria: '菜单', // 新App专属(左上角抽屉导航按钮，旧App没有这个汉堡菜单)
    backToDashboardAria: '返回仪表盘', // 新App专属(我的账户页左上角"小房子"按钮)
    accountTitle: '我的账户', // 新App专属(旧App没有独立的"我的账户"页面，账户信息混在设置里)
    rateNavLabel: '汇率换算', // 新App专属(旧App侧边栏/tab用词是"汇率"，新App这里是更完整的页面标题)
    settingsTitle: LEGACY_ZH.settingsTitle,
    aboutTitle: '关于', // 新App专属(旧App没有独立的"关于"页面)
    notSignedIn: '未登录', // 新App专属
    swapCurrencyAria: '交换货币', // 新App专属(汇率换算页的"⇅"互换按钮)
    accountSignInHint: '登录后可以在多个设备间同步账本', // 新App专属，旧App对应的cloudSyncHelpText文案更长，这里是精简版
    signInBtn: LEGACY_ZH.cloudSignInBtn,
    signUpBtn: LEGACY_ZH.cloudSignUpBtn,
    signOutBtn: LEGACY_ZH.cloudSignOutBtn,
    confirmSignOutTitle: '确定要退出登录吗？', // 新App专属(旧App退出登录没有二次确认弹窗)
    confirmSignOutMessage: '退出登录后仍可以查看本机已缓存的账目，重新登录后会自动与云端同步。', // 新App专属
    cloudDisconnectBannerText: '登录已掉线，账目仍会正常保存', // 新App专属(照抄旧App B-02修复引入的掉线提示文案)
    cloudReconnectBtn: '去登录', // 新App专属
    cancelLabel: LEGACY_ZH.alarmTrimCancelBtn, // 通用"取消"，借用旧App裁剪铃声弹窗的取消按钮词条
    deleteLabel: LEGACY_ZH.delete,
    editLabel: LEGACY_ZH.edit,
    copyLabel: LEGACY_ZH.copy,
    addLabel: '添加', // 新App专属(自定义细分/标签的新增按钮)
    langLabel: LEGACY_ZH.langFieldLabel,
    currencyRowLabel: '货币', // 新App专属，设置页这一行只放短标签(旧App对应的currencyFieldLabel是"本位货币（用于统计汇总）"这种带说明的长版本，跟这里单行列表的短标签风格不一致，没有直接复用)
    themeLabel: LEGACY_ZH.themeSheetTitle,
    aboutTagline: '有纸感的极简记账本，希望能让记账这件事多一点从容与清晰。', // 新App专属，关于页的App介绍文案
    aboutCopyright: '© 2026 PigBang', // 新App专属，关于页落款
    confirmDeleteTitle: '确定要删除这条记录吗？', // 新App专属(旧App的deleteConfirm文案里带{info}记录摘要，这里是不带摘要的通用版)
    confirmDeleteMessage: '删除后将无法恢复此条账单数据，您的账户余额将自动重新计算。', // 新App专属，比旧App的deleteConfirm多了"余额自动重新计算"这句提示
    noRecordsThisMonth: '这个月还没有记录', // 新App专属(旧App对应的emptyChart文案是"这段时间还没有相关记录"，这里是仪表盘/统计页donut卡片用的月份限定版)
    noPointsThisMonth: '这个月还没有积分记录', // 新App专属
    noRecordsThisDay: '这天还没有记录', // 新App专属(趋势图点某天柱子后的明细区空状态)
    prevMonthAria: '上个月', // 新App专属
    nextMonthAria: '下个月', // 新App专属
    prevPeriodAria: '上一段', // 新App专属(趋势图的上一段导航，"段"根据当前是按日/按月对应"上月/上年")
    nextPeriodAria: '下一段', // 新App专属
    closeAria: '关闭', // 新App专属(分类明细钻取sheet/趋势图明细面板的关闭按钮)
    rangePickerTitle: '选择时间范围', // 新App专属(R-27自绘日历弹层标题)
    rangePickerYearTitle: '选择年份', // 新App专属(R-27年份快速跳转页标题)
    rangePickerMonthTitle: '选择年月', // 新App专属(R-27月份快速跳转页标题)
    presetThisMonth: '本月', // 新App专属(R-27日历预设选项)
    presetPastMonth: '过去一个月', // 新App专属(R-25要求的是"过去一个月"这种滚动30天区间，不是"上个月"整月)
    presetPastYear: '过去一年', // 新App专属
    confirmLabel: '确定', // 新App专属，通用"确定"按钮
    statsTrendTitle: '收支趋势', // 新App专属(统计页收支栏趋势图标题，旧App没有单独抽出这个小标题)
    statsTabMoney: LEGACY_ZH.statsTabMoney,
    statsTabPoints: LEGACY_ZH.statsTabPoints,
    pointsTrendTitle: LEGACY_ZH.pointsTrendTitle,
    pointsDonutTitle: LEGACY_ZH.pointsDonutTitle,
    pointsDimDay: LEGACY_ZH.pointsDimDay,
    pointsDimMonth: LEGACY_ZH.pointsDimMonth,
    newSubPlaceholder: LEGACY_ZH.newSubPlaceholder, // 概念对应(新增细分输入框占位文字)，措辞跟旧App"新中项目名称"沿用
    newTagPlaceholder: LEGACY_ZH.newTagPlaceholder,
    themeDefaultName: 'PigBang', // 新App专属(默认主题卡片名字，R-19：App名称确定沿用PigBang)
    themeNostalgiaName: '怀旧', // 新App专属(R-14新增主题，颜色/背景改回旧App基本主题色调)
    emailLabel: LEGACY_ZH.cloudEmailPlaceholder,
    passwordLabel: LEGACY_ZH.cloudPasswordPlaceholder,
    confirmPasswordLabel: '确认密码', // 新App专属(旧App注册没有"确认密码"这一栏，只有设置新密码一栏)
    needEmailPasswordError: '请输入邮箱和密码', // 措辞跟旧App cloudNeedEmailPass的"请填写邮箱和密码"略有不同，同一概念
    passwordMismatchError: '两次密码不一致', // 同旧App cloudPasswordMismatch概念("两次输入的密码不一致")，措辞更短
    needVerifyCodeError: LEGACY_ZH.cloudVerifyNeedCode,
    signInSubmitLoading: '登录中…', // 新App专属
    noAccountText: '还没有账号？', // 呼应旧App goToSignUpBtn("没有账号？去注册")的前半句，新App拆成文字+独立链接两部分
    goToSignUpLink: '去注册',
    alreadyHaveAccountText: '已经有账号？', // 呼应旧App goToSignInBtn("已有账号？去登录")的前半句
    goToSignInLink: '去登录',
    backLabel: '返回', // 新App专属，通用"返回"文字按钮(主题子页面/注册验证码步骤)
    signUpTagline: '开始记录你的生活', // 新App专属，注册页副标题
    verifyTagline: '查收邮箱里的验证码', // 新App专属，验证码步骤副标题
    signUpSubmitLoading: '注册中…', // 新App专属
    signUpSubmitBtn: '创建账本', // 新App专属，比旧App的通用"注册"按钮更贴合"账本"这个概念
    verifyEmailSentPrefix: '验证邮件已发送到', // 新App专属，和下面的verifyEmailSentSuffix中间插入{email}变量
    verifyEmailSentSuffix: '，请输入验证码完成注册', // 新App专属
    verifyCodePlaceholder: '验证码', // 新App专属，比旧App cloudVerifyCodePlaceholder的"6位验证码"更简短
    verifySubmitLoading: '验证中…', // 新App专属
    verifySubmitBtn: '验证并完成注册', // 新App专属(旧App cloudVerifyBtn是"验证并登录"，场景是登录不是注册，故未直接复用)
    catalogLoadErrorHint: '分类数据加载失败，请检查网络后重试', // 新App专属(catalog请求失败时的兜底提示，避免转圈圈转个不停却没有任何反馈)
    retryLabel: '重试', // 新App专属
    dimCategoryOption: LEGACY_ZH.dimCategory,
    tagOtherBucket: LEGACY_ZH.tagOtherBucket,
  },
  ja: {
    appTitle: LEGACY_JA.appTitle,
    tabDashboard: LEGACY_JA.tabLedger, // 用户明确要求用"家計簿"，正好是旧App记账tab的日文
    tabHistory: LEGACY_JA.ledgerSectionTitle, // 旧App zh/ja都是"出入金"(中日通用汉字词，不是detailWord的"明細")
    tabStats: LEGACY_JA.tabStats,
    // B-31：同上zh块的说明——仪表盘卡片改用"累計"措辞，monthIncome/monthExpense
    // 保留给统计页用，不能跟着改
    balanceLabel: '累計残高',
    rangeIncome: '累計収入',
    rangeExpense: '累計支出',
    monthIncome: LEGACY_JA.monthIncome,
    monthExpense: LEGACY_JA.monthExpense,
    recent: '最近の記録',
    viewAll: 'すべて見る',
    today: LEGACY_JA.today,
    yesterday: LEGACY_JA.yesterday,
    emptyLine1: LEGACY_JA.emptyLine1,
    emptyLine2: LEGACY_JA.emptyLine2,
    historySearchPlaceholder: LEGACY_JA.detailSearchPlaceholder,
    filterAll: 'すべて',
    filterExpense: LEGACY_JA.expenseWord,
    filterIncome: LEGACY_JA.incomeWord,
    startMonthLabel: '開始月',
    endMonthLabel: '終了月',
    historyNoResults: '条件に合う記録がありません',
    addTitle: LEGACY_JA.sheetAddTitle,
    editTitle: LEGACY_JA.editEntryTitle,
    copyTitle: LEGACY_JA.copyEntryTitle,
    typeExpense: LEGACY_JA.segExpense,
    typeIncome: LEGACY_JA.segIncome,
    amountLabel: LEGACY_JA.converterAmountFieldLabel,
    categoryLabel: LEGACY_JA.catFieldLabel,
    subcategoryLabel: LEGACY_JA.subFieldLabel,
    methodLabel: LEGACY_JA.payFieldLabel,
    dateLabel: '日付',
    tagsLabel: LEGACY_JA.tagFieldLabel,
    pointsLabel: LEGACY_JA.pointsFieldLabel,
    memoLabel: 'メモ',
    memoPlaceholder: LEGACY_JA.notePlaceholder,
    saveEntry: LEGACY_JA.saveBtn,
    rateUpdatedLabel: LEGACY_JA.rateUpdateLabel,
    refreshRate: LEGACY_JA.refreshRate,
    rateNeverFetched: LEGACY_JA.neverFetched,
    rateLoading: LEGACY_JA.loadingRate,
    rateSearchPlaceholder: '通貨を検索…',
    ratePopularTitle: '人気の為替レート',
    rateTrendLabel: '推移',
    rateNoHistory: 'この期間のデータはありません',
    rateTimeframe1W: '過去1週間',
    rateTimeframe1M: '過去1か月',
    rateTimeframe1Y: '過去1年',
    donutExpenseTitle: LEGACY_JA.typeExpense,
    donutIncomeTitle: LEGACY_JA.typeIncome,

    // ↓↓↓ 下面是2026-08-18中日文混乱翻译校对新增的词条(见DEVLOG.md "翻译校对"一节)
    menuAria: 'メニュー',
    backToDashboardAria: 'ホームに戻る',
    accountTitle: 'マイアカウント',
    rateNavLabel: '為替換算',
    settingsTitle: LEGACY_JA.settingsTitle,
    aboutTitle: 'アプリについて',
    notSignedIn: '未ログイン',
    swapCurrencyAria: '通貨を入れ替え',
    accountSignInHint: 'ログインすると複数の端末で家計簿を同期できます',
    signInBtn: LEGACY_JA.cloudSignInBtn,
    signUpBtn: LEGACY_JA.cloudSignUpBtn,
    signOutBtn: LEGACY_JA.cloudSignOutBtn,
    confirmSignOutTitle: 'ログアウトしますか？',
    confirmSignOutMessage: 'ログアウト後もこの端末にキャッシュされた記録は引き続き閲覧できます。再ログインすると自動的にクラウドと同期されます。',
    cloudDisconnectBannerText: 'ログインが切断されました。家計簿は引き続き保存されます',
    cloudReconnectBtn: 'ログインへ',
    cancelLabel: LEGACY_JA.alarmTrimCancelBtn,
    deleteLabel: LEGACY_JA.delete,
    editLabel: LEGACY_JA.edit,
    copyLabel: LEGACY_JA.copy,
    addLabel: '追加',
    langLabel: LEGACY_JA.langFieldLabel,
    currencyRowLabel: '通貨',
    themeLabel: LEGACY_JA.themeSheetTitle,
    aboutTagline: '和紙のような温もりを感じるミニマルな家計簿。記録することに、もう少し余裕と落ち着きを。',
    aboutCopyright: '© 2026 PigBang',
    confirmDeleteTitle: 'この記録を削除しますか？',
    confirmDeleteMessage: '削除すると元に戻せません。アカウントの残高は自動的に再計算されます。',
    noRecordsThisMonth: '今月はまだ記録がありません',
    noPointsThisMonth: '今月はまだポイント記録がありません',
    noRecordsThisDay: 'この日はまだ記録がありません',
    prevMonthAria: '前の月',
    nextMonthAria: '次の月',
    prevPeriodAria: '前の期間',
    nextPeriodAria: '次の期間',
    closeAria: '閉じる',
    rangePickerTitle: '期間を選択',
    rangePickerYearTitle: '年を選択',
    rangePickerMonthTitle: '年月を選択',
    presetThisMonth: '今月',
    presetPastMonth: '過去1か月',
    presetPastYear: '過去1年',
    confirmLabel: '確定',
    statsTrendTitle: '収支の推移',
    statsTabMoney: LEGACY_JA.statsTabMoney,
    statsTabPoints: LEGACY_JA.statsTabPoints,
    pointsTrendTitle: LEGACY_JA.pointsTrendTitle,
    pointsDonutTitle: LEGACY_JA.pointsDonutTitle,
    pointsDimDay: LEGACY_JA.pointsDimDay,
    pointsDimMonth: LEGACY_JA.pointsDimMonth,
    newSubPlaceholder: LEGACY_JA.newSubPlaceholder,
    newTagPlaceholder: LEGACY_JA.newTagPlaceholder,
    themeDefaultName: 'PigBang',
    themeNostalgiaName: 'ノスタルジー',
    emailLabel: LEGACY_JA.cloudEmailPlaceholder,
    passwordLabel: LEGACY_JA.cloudPasswordPlaceholder,
    confirmPasswordLabel: 'パスワード（確認）',
    needEmailPasswordError: LEGACY_JA.cloudNeedEmailPass,
    passwordMismatchError: LEGACY_JA.cloudPasswordMismatch,
    needVerifyCodeError: LEGACY_JA.cloudVerifyNeedCode,
    signInSubmitLoading: 'ログイン中…',
    noAccountText: 'アカウントをお持ちでないですか？',
    goToSignUpLink: '新規登録',
    alreadyHaveAccountText: 'すでにアカウントをお持ちですか？',
    goToSignInLink: 'ログイン',
    backLabel: '戻る',
    signUpTagline: '毎日の暮らしを記録しよう',
    verifyTagline: 'メールに届いた確認コードをご確認ください',
    signUpSubmitLoading: '登録中…',
    signUpSubmitBtn: 'アカウントを作成',
    verifyEmailSentPrefix: '確認メールを',
    verifyEmailSentSuffix: ' 宛てに送信しました。確認コードを入力して登録を完了してください',
    verifyCodePlaceholder: '確認コード',
    verifySubmitLoading: '確認中…',
    verifySubmitBtn: '確認して登録を完了',
    catalogLoadErrorHint: 'カテゴリデータの読み込みに失敗しました。ネットワークをご確認の上、再試行してください',
    retryLabel: '再試行',
    dimCategoryOption: LEGACY_JA.dimCategory,
    tagOtherBucket: LEGACY_JA.tagOtherBucket,
  },
} as const
