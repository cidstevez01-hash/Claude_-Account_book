// 数据结构照旧仓库index.html里的Supabase表结构原样对齐，字段名/命名习惯保持一致，
// 方便以后对照旧代码排查问题。详见 HANDOFF-washi-ledger-rewrite.md。

export type EntryType = 'expense' | 'income'

export interface Subcategory {
  id: string
  code: string
  zh: string
  ja: string
  custom: boolean
}

export interface Category {
  id: string
  code: string
  type: EntryType
  zh: string
  ja: string
  icon: string
  color: string
  subs: Subcategory[]
}

export interface PaymentMethodBadge {
  bg: string
  text: string
}

export interface PaymentMethod {
  id: string
  code: string
  zh: string
  ja: string
  /** 原样保留旧App数据库里的图标编号(比如'pm-amazon')，渲染时用PaymentMethodIcon
   * 组件按品牌特殊处理，不是单纯的图标名映射 */
  icon?: string
  badge?: PaymentMethodBadge
  pointRate: number | null
}

export interface PaymentMethodPointRule {
  payment_method_code: string
  day_of_month: number
  rate: number
}

export interface Tag {
  id: string
  code: string
  type: EntryType
  zh: string
  ja: string
  custom: boolean
}

export interface Entry {
  id: string
  type: EntryType
  amount: number
  currency: string
  catCode: string
  subCode: string | null
  paymentMethod: string | null
  tagCode: string | null
  note: string | null
  points: number | null
  date: string // YYYY-MM-DD
  recurringId: string | null
  createdAt: number
}

export type Lang = 'zh' | 'ja'
// R-14：新增'nostalgia'("怀旧")主题——颜色/背景改回旧仓库index.html基本主题(--paper/
// --ink/--grid等)那套暖色调，布局/组件结构完全不变，只切CSS变量(见index.css
// :root[data-theme="nostalgia"]覆盖块)
// 新增'summer'("夏 · 花火")——旧仓库index.html的data-skin="summerB"移植：深藏青底配
// 朱红/金黄/翡翠绿，卡片/图标发光描边，外加canvas实时烟花+星空动态背景(见
// FireworksBackground.tsx)，是当前唯一带动态背景的主题
export type ThemeSkin = 'default' | 'nostalgia' | 'summer'

export interface UserSettings {
  lang: Lang
  currency: string
  themeSkin: ThemeSkin
}
