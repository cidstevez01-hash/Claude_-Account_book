/** 日期分组标题——今天/昨天用文案，更早的日期原样显示YYYY-MM-DD。
 * 仪表盘最近记录和明细页列表共用，避免两处各写一份同样的今天/昨天判断逻辑。 */
export function dayLabel(dateStr: string, t: (k: 'today' | 'yesterday') => string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return t('today')
  if (sameDay(d, yesterday)) return t('yesterday')
  return dateStr
}
