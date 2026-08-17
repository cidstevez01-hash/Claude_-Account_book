import type { Entry } from '../types'

export function isSameMonth(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export interface MonthSummary {
  balance: number
  income: number
  expense: number
}

export function summarizeMonth(entries: Entry[], ref: Date = new Date()): MonthSummary {
  let income = 0
  let expense = 0
  for (const e of entries) {
    if (!isSameMonth(e.date, ref)) continue
    if (e.type === 'income') income += e.amount
    else expense += e.amount
  }
  return { balance: income - expense, income, expense }
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
