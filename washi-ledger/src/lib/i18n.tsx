import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'

// 完整词条要陆续从旧仓库index.html的I18N.zh/I18N.ja两个对象搬过来，这里先放当前
// 已经在用的页面需要的key，其余页面开发到的时候再补充对应词条，不要一次性瞎猜搬空。
const dict = {
  zh: {
    appTitle: '记账本',
    tabDashboard: '仪表盘',
    tabHistory: '明细',
    tabStats: '统计',
    balanceLabel: '本月结余',
    monthIncome: '本月收入',
    monthExpense: '本月支出',
    recent: '最近记录',
    viewAll: '查看全部',
    today: '今天',
    yesterday: '昨天',
    emptyLine1: '这本账还是空的',
    emptyLine2: '点右下角记下第一笔吧',
  },
  ja: {
    appTitle: '家計簿',
    tabDashboard: 'ダッシュボード',
    tabHistory: '明細',
    tabStats: '集計',
    balanceLabel: '今月の残高',
    monthIncome: '今月の収入',
    monthExpense: '今月の支出',
    recent: '最近の記録',
    viewAll: 'すべて見る',
    today: '今日',
    yesterday: '昨日',
    emptyLine1: 'まだ記録がありません',
    emptyLine2: '右下の + から記録しましょう',
  },
} as const

export type TranslationKey = keyof typeof dict.zh

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh')
  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key) => dict[lang][key] ?? dict.zh[key] ?? key,
    }),
    [lang]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n必须在I18nProvider内使用')
  return ctx
}
