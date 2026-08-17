import type { Category, Entry, EntryType } from '../types'

export function isSameMonth(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export interface MonthSummary {
  balance: number
  income: number
  expense: number
  points: number
}

export function summarizeMonth(entries: Entry[], ref: Date = new Date()): MonthSummary {
  let income = 0
  let expense = 0
  let points = 0
  for (const e of entries) {
    if (!isSameMonth(e.date, ref)) continue
    if (e.type === 'income') income += e.amount
    else expense += e.amount
    points += e.points ?? 0
  }
  return { balance: income - expense, income, expense, points }
}

export interface CategoryShare {
  catCode: string
  label: string
  color: string
  amount: number
  ratio: number // 0~1
}

/** 仪表盘分类环状图用——按分类聚合某个类型(收入/支出)在给定月份内的金额占比，
 * 照design-assets-v2/_44这屏的"Expenses/Income tabs + donut + legend"实现 */
export function categoryBreakdown(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  ref: Date = new Date()
): CategoryShare[] {
  const totals = new Map<string, number>()
  let grandTotal = 0
  for (const e of entries) {
    if (e.type !== type || !isSameMonth(e.date, ref)) continue
    totals.set(e.catCode, (totals.get(e.catCode) ?? 0) + e.amount)
    grandTotal += e.amount
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .map(([catCode, amount]) => {
      const cat = categories.find((c) => c.code === catCode)
      return {
        catCode,
        label: cat?.zh ?? catCode,
        color: cat?.color ?? '#85736d',
        amount,
        ratio: amount / grandTotal,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export function groupByDay(entries: Entry[]): { date: string; entries: Entry[] }[] {
  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, entries: list }))
}
