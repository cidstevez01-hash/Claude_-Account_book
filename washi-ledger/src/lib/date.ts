/** 通用日期字符串工具——统一用YYYY-MM-DD(跟entry.date同一种格式)，避免各处各写一套 */
export function formatDateYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayStr(): string {
  return formatDateYMD(new Date())
}

export function firstOfMonthStr(ref: Date = new Date()): string {
  return formatDateYMD(new Date(ref.getFullYear(), ref.getMonth(), 1))
}

/** 起止日期区间的展示文案——区间正好是"当月1日到当月某天"这种最常见的默认情况时，
 * 显示成"Y年M月"(照旧App月份标题的习惯)；其余任意自定义起止才显示完整的"起 ~ 止" */
export function formatDateRangeLabel(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  if (sy === ey && sm === em && sd === 1) {
    return `${sy}年${sm}月`
  }
  return `${startDate} ~ ${endDate}`
}
