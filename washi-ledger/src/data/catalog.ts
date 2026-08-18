import { supabase } from '../lib/supabase'
import { mapCategoryIcon } from '../lib/iconMap'
import type {
  Category,
  Entry,
  EntryType,
  PaymentMethod,
  PaymentMethodPointRule,
  Subcategory,
  Tag,
} from '../types'

/** 自定义细分/标签的code生成规则——照抄旧仓库index.html的genCustomKey()，
 * 时间戳+随机串，跟预设的语义化code(比如'bowl'/'ic-tag-work')不会撞 */
function genCustomKey(): string {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

interface CategoryRow {
  id: string
  code: string
  type: 'expense' | 'income'
  zh: string
  ja: string
  icon: string
  color: string
  sort_order: number | null
}

// 注意：subcategories表实测没有sort_order列(跟categories/payment_methods/tags不一样，
// 之前假设它也有，2026-08-17拉通真实数据库验证时发现字段不对，改正)。真实列表顺序目前
// 就是查询返回的顺序，没有专门的排序字段
interface SubcategoryRow {
  id: string
  code: string
  cat_code: string
  zh: string
  ja: string
  is_preset: boolean
}

interface PaymentMethodRow {
  id: string
  code: string
  zh: string
  ja: string
  icon: string | null
  badge_bg: string | null
  badge_text: string | null
  default_point_rate: number | null
  sort_order: number | null
}

interface TagRow {
  id: string
  code: string
  type: 'expense' | 'income'
  zh: string
  ja: string
  is_preset: boolean
  sort_order: number | null
}

export interface Catalog {
  expenseCategories: Category[]
  incomeCategories: Category[]
  paymentMethods: PaymentMethod[]
  expenseTags: Tag[]
  incomeTags: Tag[]
  pointRules: PaymentMethodPointRule[]
}

function rowsToCategories(
  catRows: CategoryRow[],
  subRows: SubcategoryRow[],
  type: 'expense' | 'income'
): Category[] {
  return catRows
    .filter((c) => c.type === type)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c) => ({
      id: c.id,
      code: c.code,
      type,
      zh: c.zh,
      ja: c.ja,
      icon: mapCategoryIcon(c.icon),
      color: c.color,
      subs: subRows
        .filter((s) => s.cat_code === c.code)
        .map((s) => ({ id: s.id, code: s.code, zh: s.zh, ja: s.ja, custom: !s.is_preset })),
    }))
}

function rowsToTags(tagRows: TagRow[], type: 'expense' | 'income'): Tag[] {
  return tagRows
    .filter((t) => t.type === type)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => ({ id: t.id, code: t.code, type, zh: t.zh, ja: t.ja, custom: !t.is_preset }))
}

/** 分类/支付方式是核心数据，拉取失败要整体报错；tags和point_rules是后加的表，
 * 单独try/catch，没跑迁移SQL也不该拖累前面两个的加载(照抄旧仓库index.html的容错逻辑) */
export async function fetchCatalog(): Promise<Catalog> {
  const [catRes, subRes, payRes] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('subcategories').select('*'),
    supabase.from('payment_methods').select('*'),
  ])
  if (catRes.error) throw catRes.error
  if (subRes.error) throw subRes.error
  if (payRes.error) throw payRes.error

  const catRows = (catRes.data ?? []) as CategoryRow[]
  const subRows = (subRes.data ?? []) as SubcategoryRow[]
  const payRows = (payRes.data ?? []) as PaymentMethodRow[]

  const paymentMethods: PaymentMethod[] = payRows
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => ({
      id: p.id,
      code: p.code,
      zh: p.zh,
      ja: p.ja,
      icon: p.icon ?? undefined, // 原样保留(比如'pm-amazon')，不在这里转换——支付方式图标
      // 有品牌logo特殊渲染需求(见PaymentMethodIcon组件)，不是单纯的图标名替换
      badge: p.badge_bg ? { bg: p.badge_bg, text: p.badge_text ?? '' } : undefined,
      pointRate: p.default_point_rate ?? null,
    }))

  let expenseTags: Tag[] = []
  let incomeTags: Tag[] = []
  try {
    const tagRes = await supabase.from('tags').select('*')
    if (tagRes.error) throw tagRes.error
    const tagRows = (tagRes.data ?? []) as TagRow[]
    expenseTags = rowsToTags(tagRows, 'expense')
    incomeTags = rowsToTags(tagRows, 'income')
  } catch (e) {
    console.error('拉取标签失败，标签列表暂时为空', e)
  }

  let pointRules: PaymentMethodPointRule[] = []
  try {
    const ruleRes = await supabase.from('payment_method_point_rules').select('*')
    if (ruleRes.error) throw ruleRes.error
    pointRules = (ruleRes.data ?? []) as PaymentMethodPointRule[]
  } catch (e) {
    console.error('拉取支付方式还元率特殊规则失败，暂时按默认还元率算', e)
  }

  return {
    expenseCategories: rowsToCategories(catRows, subRows, 'expense'),
    incomeCategories: rowsToCategories(catRows, subRows, 'income'),
    paymentMethods,
    expenseTags,
    incomeTags,
    pointRules,
  }
}

/** 支付方式还元率解析：特殊日期规则优先，没有就退到该支付方式默认还元率，
 * 都没有返回null——逻辑照抄旧仓库index.html的resolvePointRate() */
export function resolvePointRate(
  pointRules: PaymentMethodPointRule[],
  paymentMethods: PaymentMethod[],
  payCode: string | null,
  dateStr: string | null
): number | null {
  if (!payCode || !dateStr) return null
  const day = parseInt(dateStr.split('-')[2] ?? '', 10)
  const rule = pointRules.find((r) => r.payment_method_code === payCode && r.day_of_month === day)
  if (rule) return rule.rate
  const pm = paymentMethods.find((p) => p.code === payCode)
  return pm?.pointRate ?? null
}

interface EntryRow {
  id: string
  user_id: string
  type: 'expense' | 'income'
  amount: number
  currency: string
  cat_code: string
  sub_code: string | null
  payment_method: string | null
  tag_code: string | null
  note: string | null
  points: number | null
  entry_date: string
  recurring_id: string | null
  created_at: string | null
}

function dbRowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    catCode: row.cat_code,
    subCode: row.sub_code,
    paymentMethod: row.payment_method,
    tagCode: row.tag_code,
    note: row.note,
    points: row.points,
    date: row.entry_date,
    recurringId: row.recurring_id,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }
}

export async function fetchEntries(userId: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select('*').eq('user_id', userId)
  if (error) throw error
  return ((data ?? []) as EntryRow[]).map(dbRowToEntry)
}

export function entryToDbRow(entry: Entry, userId: string): Omit<EntryRow, 'created_at'> {
  return {
    id: entry.id,
    user_id: userId,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    cat_code: entry.catCode,
    sub_code: entry.subCode,
    payment_method: entry.paymentMethod,
    tag_code: entry.tagCode,
    note: entry.note,
    points: entry.points,
    entry_date: entry.date,
    recurring_id: entry.recurringId,
  }
}

export async function upsertEntry(entry: Entry, userId: string) {
  const { error } = await supabase.from('entries').upsert(entryToDbRow(entry, userId))
  if (error) throw error
}

export async function deleteEntry(id: string, userId: string) {
  const { error } = await supabase.from('entries').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

/** 登录时如果云端还没有账目数据(全新账号/数据库还没数据)，把本地缓存现有的记录批量
 * 推上去做种子数据——照旧仓库index.html的handleCloudSignedIn()真实逻辑
 * (pushEntriesBulkUpsert)，不是简单互相覆盖 */
export async function pushEntriesBulkUpsert(entries: Entry[], userId: string) {
  if (entries.length === 0) return
  const { error } = await supabase.from('entries').upsert(entries.map((e) => entryToDbRow(e, userId)))
  if (error) throw error
}

/** 自定义细分/标签的新增/改名/删除——逻辑照抄旧仓库index.html的addCustomSub/
 * updateCustomSub/deleteCustomSub(细分)和addCustomTag/updateCustomTag/deleteCustomTag
 * (标签)。预设的(is_preset=true)不允许改/删，这几个函数只处理is_preset=false的自定义项，
 * 调用方(UI)要保证只对custom===true的项调用这几个函数 */
export async function addCustomSubcategory(catCode: string, label: string, userId: string): Promise<Subcategory> {
  const id = crypto.randomUUID()
  const code = genCustomKey()
  const { error } = await supabase
    .from('subcategories')
    .insert({ id, code, cat_code: catCode, zh: label, ja: label, is_preset: false, user_id: userId })
  if (error) throw error
  return { id, code, zh: label, ja: label, custom: true }
}

export async function updateCustomSubcategory(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('subcategories').update({ zh: label, ja: label }).eq('id', id)
  if (error) throw error
}

export async function deleteCustomSubcategory(id: string): Promise<void> {
  const { error } = await supabase.from('subcategories').delete().eq('id', id)
  if (error) throw error
}

export async function addCustomTag(type: EntryType, label: string, userId: string): Promise<Tag> {
  const id = crypto.randomUUID()
  const code = genCustomKey()
  const { error } = await supabase
    .from('tags')
    .insert({ id, code, type, zh: label, ja: label, is_preset: false, user_id: userId })
  if (error) throw error
  return { id, code, type, zh: label, ja: label, custom: true }
}

export async function updateCustomTag(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('tags').update({ zh: label, ja: label }).eq('id', id)
  if (error) throw error
}

export async function deleteCustomTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
