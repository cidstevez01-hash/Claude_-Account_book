/** OCR 的原始坐标保留到金额判定，避免标签和右侧金额因字号不同被拆开后失去关联。 */
export interface ReceiptTextBlock {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

export interface ReceiptTextRow {
  text: string
  y: number
  blocks?: ReceiptTextBlock[]
}

type TotalKind = 'total' | 'settlement'
interface TotalCandidate {
  rowIndex: number
  amount: number
  kind: TotalKind
  source: 'field' | 'position'
}

export interface ReceiptTotalResult {
  amount: number | null
  rowIndex: number
  reason: string
  candidates: TotalCandidate[]
  rejectedRows: number[]
}

const LABELS: { kind: TotalKind; pattern: RegExp }[] = [
  { kind: 'total', pattern: /^(?:(?:総|税込(?:み)?|(?:お|御)?買(?:い)?上(?:げ)?)\s*)?合\s*計(?:\s*(?:金\s*)?額)?/u },
  { kind: 'total', pattern: /^(?:お|御)\s*会\s*計(?:\s*(?:金\s*)?額)?/u },
  { kind: 'total', pattern: /^(?:grand\s+)?total\b/i },
  { kind: 'settlement', pattern: /^(?:支\s*払(?:い)?|決\s*済)\s*合\s*計(?:\s*(?:金\s*)?額)?/u },
]
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`
const COUNT = String.raw`(?:\(\s*)?\d+\s*(?:点|品|個)(?:\s*\))?`
const TAX_NOTE = String.raw`\((?:税込(?:み)?|税抜(?:き)?|内税|外税|本体価格)(?:\s*\d+(?:\.\d+)?\s*%)?\)`
// 整个字段必须能解释为数量/税制说明/金额。金额后有“以上のご購入で”等句子就不成立。
const VALUE_FIELD = new RegExp(
  String.raw`^\s*[:=/]?\s*(?:${COUNT}\s*)?(?:${TAX_NOTE}\s*)?(?:¥\s*|JPY\s*)?(${NUMBER})\s*円?\s*(?:${TAX_NOTE}\s*)?(?:${COUNT}\s*)?[*★☆】\])]*\s*$`, 'iu',
)
const ONLY_VALUE = new RegExp(String.raw`^\s*(?:¥\s*|JPY\s*)?(${NUMBER})\s*円?\s*$`, 'iu')
const EMPTY_FIELD = new RegExp(String.raw`^\s*[:=/]?\s*(?:${COUNT}\s*)?(?:${TAX_NOTE}\s*)?[*★☆】\])]*\s*$`, 'u')

function normalize(text: string): string {
  return text.normalize('NFKC').replace(/^[\s※*★☆●○■□◆◇【[（(]+/u, '').trim()
}

function numberValue(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''))
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null
}

function fieldValue(suffix: string): number | null {
  const match = suffix.replace(/^[\s:：=)】\]]+/u, '').match(VALUE_FIELD)
  return match ? numberValue(match[1]) : null
}

function positionValue(row: ReceiptTextRow, rows: ReceiptTextRow[], pattern: RegExp): number | null {
  if (!row.blocks) return null
  const matches: number[] = []
  for (const label of row.blocks) {
    const text = normalize(label.text)
    const match = text.match(pattern)
    if (!match || !EMPTY_FIELD.test(text.slice(match[0].length))) continue
    const labelHeight = label.top - label.bottom
    if (labelHeight <= 0) continue
    for (const otherRow of rows) for (const block of otherRow.blocks ?? []) {
      if (block === label || block.left < label.right - 0.005) continue
      const height = block.top - block.bottom
      const overlap = Math.min(label.top, block.top) - Math.max(label.bottom, block.bottom)
      if (height <= 0 || overlap < Math.min(labelHeight, height) * 0.35) continue
      const money = normalize(block.text).match(ONLY_VALUE)
      const value = money ? numberValue(money[1]) : null
      if (value != null && value > 0) matches.push(value)
    }
  }
  const values = [...new Set(matches)]
  return values.length === 1 ? values[0] : null
}

/** 只对明确的“税前小计 + 外税”提供辅助证据；内税、优惠/积分等复杂结算不套此公式。 */
function externalTaxTotal(rows: ReceiptTextRow[], rowIndex: number): number | null {
  let subtotalIndex = -1
  let subtotal: number | null = null
  for (let i = rowIndex - 1; i >= 0; i--) {
    const match = normalize(rows[i].text).match(/^小\s*計\s*/u)
    if (!match) continue
    subtotalIndex = i
    subtotal = fieldValue(normalize(rows[i].text).slice(match[0].length))
    break
  }
  if (subtotal == null) return null
  const taxes = new Map<string, number>()
  for (let i = subtotalIndex + 1; i < rowIndex; i++) {
    const text = normalize(rows[i].text)
    if (/割引|値引|クーポン|ポイント|調整|端数|内税/u.test(text)) return null
    const match = text.match(/^外\s*(?:税\s*(?:額\s*)?)?(?:(\d+(?:\.\d+)?)\s*%\s*)?/u)
    if (!match) continue
    const value = fieldValue(text.slice(match[0].length))
    if (value == null) continue // 外税対象額は税額ではない。
    const key = match[1] ?? 'all'
    if (taxes.has(key) && taxes.get(key) !== value) return null
    taxes.set(key, value)
  }
  if (taxes.size === 0) return null
  const rateValues = [...taxes].filter(([key]) => key !== 'all').map(([, value]) => value)
  const rateSum = rateValues.reduce((sum, value) => sum + value, 0)
  const all = taxes.get('all')
  if (all != null && rateValues.length && Math.abs(all - rateSum) > 0.01) return null
  return subtotal + (all ?? rateSum)
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}

export function selectReceiptTotal(rows: ReceiptTextRow[]): ReceiptTotalResult {
  const candidates: TotalCandidate[] = []
  const rejectedRows: number[] = []
  rows.forEach((row, rowIndex) => {
    const text = normalize(row.text)
    for (const { kind, pattern } of LABELS) {
      const match = text.match(pattern)
      if (!match) continue
      const suffix = text.slice(match[0].length)
      let amount = fieldValue(suffix)
      let source: TotalCandidate['source'] = 'field'
      // 仅对“标签本身没有金额”启用坐标配对；广告/乱码字段不能借此绕过完整字段校验。
      if (amount == null && EMPTY_FIELD.test(suffix)) {
        amount = positionValue(row, rows, pattern)
        source = 'position'
      }
      if (amount != null && amount > 0) candidates.push({ rowIndex, amount, kind, source })
      else rejectedRows.push(rowIndex)
      break
    }
  })

  const empty = (reason: string): ReceiptTotalResult => ({ amount: null, rowIndex: -1, reason, candidates, rejectedRows })
  if (!candidates.length) return empty('没有可确认的完整合计金额字段')
  let possible = [...new Set(candidates.map((candidate) => candidate.amount))]
  const arithmetic = candidates.map((candidate) => externalTaxTotal(rows, candidate.rowIndex))
    .filter((value): value is number => value != null)
  if (arithmetic.length) {
    possible = possible.filter((amount) => arithmetic.some((value) => sameAmount(amount, value)))
    if (!possible.length) return empty('合计金额与明确的税前小计及外税不一致')
  }
  let reason = arithmetic.length ? '完整合计字段通过外税结算核对' : '完整合计金额字段'
  if (possible.length > 1) {
    // 核对的是不同语义字段，不是全票数字出现次数。
    const agreed = possible.filter((amount) => {
      const kinds = new Set(candidates.filter((candidate) => candidate.amount === amount).map((candidate) => candidate.kind))
      return kinds.has('total') && kinds.has('settlement')
    })
    if (agreed.length !== 1) return empty('多个合计字段金额冲突，需要用户确认')
    possible = agreed
    reason = '合计与支払/決済合计一致'
  }
  const amount = possible[0]
  const selected = candidates.find((candidate) => candidate.amount === amount && candidate.kind === 'total')
    ?? candidates.find((candidate) => candidate.amount === amount)!
  return { amount, rowIndex: selected.rowIndex, reason, candidates, rejectedRows }
}
