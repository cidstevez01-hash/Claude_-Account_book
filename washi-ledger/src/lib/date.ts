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

/** 当月最后一天——月份+1、日期给0会被Date自动折算成上个月的最后一天，是标准写法 */
export function lastOfMonthStr(ref: Date = new Date()): string {
  return formatDateYMD(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
}

/** B-12：给定"YYYY-MM-DD"字符串(比如某条记账记录的date字段)求它所在月份的起止日期——
 * 直接从字符串拆年月，不经过new Date(dateStr)这条路：那样解析出来是UTC零点，负时区
 * (比如美洲)下会被折算成本地时间的前一天，月末最后一天/月初第一天这种边界日期会错算成
 * 上/下个月，这里手写拆解避免这个坑，跟同文件formatDateFull()的做法一致 */
export function firstOfMonthStrFor(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return firstOfMonthStr(new Date(y, m - 1, 1))
}

export function lastOfMonthStrFor(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return lastOfMonthStr(new Date(y, m - 1, 1))
}

/** 完整日期的展示文案——固定用"Y年M月D日"，中日文共用汉字，不依赖设备系统语言/浏览器
 * locale(原生<input type="date">收起状态的文字是被动跟随设备系统语言的，跟App内切换的
 * 语言设置是两回事，会出现"App设置中文但选择器显示英文"的错位，所以起止日期选择器的
 * 收起态改成盖一层这里生成的文字，输入框本身只留着接收点击/唤起原生选择器) */
export function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}年${m}月${d}日`
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
