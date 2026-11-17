import { formatDateYMD } from './date'
import type { ReceiptTextRow } from './receiptTotal'

const WESTERN_DATE = /(?<![\d./-])(\d{4})\s*(?:年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日|([./-])\s*(\d{1,2})\s*\4\s*(\d{1,2})(?![\d./-]))/gu
const ERA_DATE = /(令和|平成)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/gu
const TRANSACTION = /(?:取引|決済|お買(?:い)?上(?:げ)?|購入|ご利用|お会計|売上)(?:日時|日付|日)/u
const OTHER_DATE = /期限|有効期間|キャンペーン|セール|対象期間|発行日|印刷日/u
const TIME = /^(?:\s*[（(]?[月火水木金土日](?:曜日)?[）)]?)?\s*\d{1,2}\s*[:時]\s*\d{2}/u
const RANGE_SEPARATOR = /[~〜～]/u

function readDates(text: string) {
  const western = Array.from(text.matchAll(WESTERN_DATE), (match) => ({
    year: Number(match[1]), month: Number(match[2] ?? match[5]), day: Number(match[3] ?? match[6]),
    era: null, start: match.index, end: match.index + match[0].length,
  }))
  const japanese = Array.from(text.matchAll(ERA_DATE), (match) => ({
    year: (match[1] === '令和' ? 2018 : 1988) + (match[2] === '元' ? 1 : Number(match[2])),
    month: Number(match[3]), day: Number(match[4]), era: match[1],
    start: match.index, end: match.index + match[0].length,
  }))
  return [...western, ...japanese].sort((a, b) => a.start - b.start)
}

export function selectReceiptDate(rows: ReceiptTextRow[]): string | null {
  const dates = new Map<string, number>()
  rows.forEach(({ text: raw }, index) => {
    const text = raw.normalize('NFKC')
    const previous = rows[index - 1]?.text.normalize('NFKC').trim() ?? ''
    const matches = readDates(text)
    if (matches.length > 1 && RANGE_SEPARATOR.test(text)) return
    for (const { year, month, day, era, start, end } of matches) {
      if (year < 1900 || year > 2099) continue
      const date = new Date(year, month - 1, day)
      if (date.getMonth() !== month - 1 || date.getDate() !== day) continue
      const value = formatDateYMD(date)
      if (era === '令和' && value < '2019-05-01') continue
      if (era === '平成' && (value < '1989-01-08' || value > '2019-04-30')) continue
      const prefix = text.slice(0, start)
      const explicit = TRANSACTION.test(prefix)
        || (!prefix.trim() && TRANSACTION.test(previous) && !/\d/u.test(previous))
      if (OTHER_DATE.test(text) || (!explicit && OTHER_DATE.test(previous) && !/\d/u.test(previous))) continue
      const time = TIME.test(text.slice(end))
      const score = explicit ? 2 : time ? 1 : 0
      dates.set(value, Math.max(score, dates.get(value) ?? 0))
    }
  })
  if (!dates.size) return null
  const strongest = Math.max(...dates.values())
  const supported = [...dates].filter(([, score]) => score === strongest)
  return supported.length === 1 ? supported[0][0] : null
}
