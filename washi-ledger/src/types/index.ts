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
export type ThemeSkin = 'default' // 现有App只有默认+summerB(花火)两套皮肤，新设计只有一套Washi Ledger视觉，
// 主题选择页(_25)先只做"当前唯一主题"的占位，等以后真的要做多主题再扩展这个union type

export interface UserSettings {
  lang: Lang
  currency: string
  themeSkin: ThemeSkin
}
