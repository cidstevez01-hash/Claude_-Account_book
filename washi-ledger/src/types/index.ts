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
  /** R-32→R-41：レシート扫描存档——Supabase Storage里的对象路径数组(不是完整URL，
   * bucket是private的，查看时要现取一次签名URL，见data/receiptStorage.ts)。存的是
   * 原生扫描器裁边+透视校正后的图片生成的PDF，不是原始照片本身(拍摄的原图不会保留)。
   * 一条记录可以有多张凭证(R-41多图上传)，空数组=没有凭证。数据库那列(receipt_path)
   * 还是单个text字段没有改schema——这个数组在存库前/读库后用JSON.stringify/parse转换
   * (见data/catalog.ts的fromRow/toRow)，省掉一次要求用户手动跑Supabase迁移SQL的
   * 操作(旧版本单路径数据读取时做兼容，见fromRow里的说明) */
  receiptPaths: string[]
}

/** R-44：固定收支规则——App启动时/服务器pg_cron按这些规则自动生成记账记录，
 * 原来是旧App里写死的RECURRING_RULES/RECURRING_BIWEEKLY_RULES，这次改成前台
 * 可增删改查、存数据库(sql/2026-10-14_recurring_rules.sql)。两种规则类型用
 * ruleKind区分，二选一，互不混用：
 * - 'dayOfMonth'：每月固定几号(dayOfMonth: '1'~'31' 或 'last')，可选节假日顺延
 *   (bizDayAdjust)；anchorDate/intervalDays这两个此时应为null
 * - 'intervalDays'：从anchorDate起每隔intervalDays天一次，不支持节假日顺延
 *   (bizDayAdjust应为null)；dayOfMonth应为null
 */
export interface RecurringRule {
  id: string
  type: EntryType
  amount: number
  currency: string
  catCode: string
  subCode: string | null
  paymentMethod: string | null
  tagCode: string | null
  note: string | null
  ruleKind: 'dayOfMonth' | 'intervalDays'
  dayOfMonth: string | null
  bizDayAdjust: 'before' | 'after' | null
  anchorDate: string | null // YYYY-MM-DD
  intervalDays: number | null
  enabled: boolean
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
