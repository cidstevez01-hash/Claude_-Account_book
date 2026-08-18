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
    balanceLabel: LEGACY_ZH.balanceLabel,
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
  },
  ja: {
    appTitle: LEGACY_JA.appTitle,
    tabDashboard: LEGACY_JA.tabLedger, // 用户明确要求用"家計簿"，正好是旧App记账tab的日文
    tabHistory: '明細', // 新App专属中文侧改了("出入金")，日文沿用旧App detailWord的措辞
    tabStats: LEGACY_JA.tabStats,
    balanceLabel: LEGACY_JA.balanceLabel,
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
  },
} as const
