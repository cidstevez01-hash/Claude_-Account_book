import { formatDateYMD, todayStr } from './date'
import type { Category, Entry, RecurringRule } from '../types'

/** R-44：按固定收支规则算出"这次该补生成哪些记录"——纯函数，不做任何网络/存储
 * 副作用，方便单测。照抄旧App(index.html) isBizDay()/adjustToBizDay()/
 * ensureRecurringEntries()/ensureBiweeklyRecurringEntries()的算法，只是从
 * "写死的两个规则数组"改成"读传进来的规则列表"，逻辑本身不变：
 * - 固定id(`recur_${规则id}_${周期}`)判重，已经生成过的不会重复生成，也不会
 *   往更早的周期倒着补
 * - 规则引用的分类在当前目录里找不到(比如分类后来被删了，或分类数据还没加载好)，
 *   跳过这条规则，不报错中断其它规则 */

function isBizDay(dateStr: string, holidays: Record<string, string>): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false
  if (holidays[dateStr]) return false
  return true
}

function adjustToBizDay(dateStr: string, direction: 'before' | 'after', holidays: Record<string, string>): string {
  let d = new Date(dateStr + 'T00:00:00')
  const step = direction === 'after' ? 1 : -1
  while (!isBizDay(formatDateYMD(d), holidays)) {
    d.setDate(d.getDate() + step)
  }
  return formatDateYMD(d)
}

function lastDayOfMonthStr(year: number, month1to12: number): string {
  // month传0会被Date自动折算成上个月最后一天，是标准写法(照抄date.ts的
  // lastOfMonthStr同款技巧)
  return formatDateYMD(new Date(year, month1to12, 0))
}

/** 规则列表页用——"下次预计生成日期"展示，纯预览用途，不做判重/不受已生成记录
 * 影响，方便用户核对规则配置是不是自己想要的效果 */
export function computeNextOccurrence(
  rule: RecurringRule,
  holidays: Record<string, string> = {},
  today: string = todayStr(),
): string | null {
  if (rule.ruleKind === 'dayOfMonth') {
    let [y, m] = today.split('-').map(Number)
    for (let i = 0; i < 2; i++) {
      // 最多往后看2个月：这个月该发生的日期如果已经过了，看下个月
      let targetDate = rule.dayOfMonth === 'last' ? lastDayOfMonthStr(y, m) : `${y}-${String(m).padStart(2, '0')}-${String(rule.dayOfMonth).padStart(2, '0')}`
      if (rule.bizDayAdjust) targetDate = adjustToBizDay(targetDate, rule.bizDayAdjust, holidays)
      if (targetDate >= today) return targetDate
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
    return null
  }
  if (!rule.anchorDate || !rule.intervalDays) return null
  let d = new Date(rule.anchorDate + 'T00:00:00')
  const todayD = new Date(today + 'T00:00:00')
  while (d < todayD) {
    d.setDate(d.getDate() + rule.intervalDays)
  }
  return formatDateYMD(d)
}

export function computeRecurringEntriesToGenerate(
  rules: RecurringRule[],
  existingEntries: Entry[],
  categories: Category[],
  holidays: Record<string, string>,
  today: string = todayStr(),
): Entry[] {
  const existingIds = new Set(existingEntries.map((e) => e.id))
  const [todayY, todayM] = today.split('-').map(Number)
  const toCreate: Entry[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const catObj = categories.find((c) => c.code === rule.catCode)
    if (!catObj) continue // 分类数据没加载好/分类已被删，跳过，下次再补

    if (rule.ruleKind === 'dayOfMonth') {
      let targetDate =
        rule.dayOfMonth === 'last'
          ? lastDayOfMonthStr(todayY, todayM)
          : `${todayY}-${String(todayM).padStart(2, '0')}-${String(rule.dayOfMonth).padStart(2, '0')}`
      if (rule.bizDayAdjust) targetDate = adjustToBizDay(targetDate, rule.bizDayAdjust, holidays)

      const periodKey = `${todayY}-${String(todayM).padStart(2, '0')}`
      const id = `recur_${rule.id}_${periodKey}`
      if (existingIds.has(id)) continue

      toCreate.push({
        id,
        type: rule.type,
        amount: rule.amount,
        currency: rule.currency,
        catCode: rule.catCode,
        subCode: rule.subCode,
        paymentMethod: rule.paymentMethod,
        tagCode: rule.tagCode,
        note: rule.note,
        points: null,
        date: targetDate,
        recurringId: rule.id,
        createdAt: Date.now(),
        receiptPaths: [],
      })
    } else {
      // intervalDays：从anchorDate起每隔intervalDays天补一笔，补到今天为止，
      // 不补anchorDate之前的——照抄ensureBiweeklyRecurringEntries()的while循环
      if (!rule.anchorDate || !rule.intervalDays) continue
      let d = new Date(rule.anchorDate + 'T00:00:00')
      const todayD = new Date(today + 'T00:00:00')
      while (d <= todayD) {
        const dateStr = formatDateYMD(d)
        const id = `recur_${rule.id}_${dateStr}`
        if (!existingIds.has(id)) {
          toCreate.push({
            id,
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            catCode: rule.catCode,
            subCode: rule.subCode,
            paymentMethod: rule.paymentMethod,
            tagCode: rule.tagCode,
            note: rule.note,
            points: null,
            date: dateStr,
            recurringId: rule.id,
            createdAt: Date.now(),
            receiptPaths: [],
          })
        }
        d.setDate(d.getDate() + rule.intervalDays)
      }
    }
  }

  return toCreate
}
