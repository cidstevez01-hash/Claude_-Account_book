/** 仪表盘/明细页的日期区间——真正跨App重启持久化(localStorage)，不是
 * historyViewMemory.ts那种只在App进程存活期间有效的模块级变量。用户明确要求过：
 * 选好的预设/自定义区间，关闭App重开也要还在，不能每次都被打回默认(当月/全部
 * 数据范围)。仪表盘/明细页各自的区间是独立的两份设置，用不同的key分开存，不共用
 * 一份(两个页面的区间选择本来就可能不一样，仪表盘"看当月"、明细"看全部"是完全
 * 合理的两种默认，用户各自调过之后也应该各自记住) */
interface StoredRange {
  startDate: string
  endDate: string
}

const DASHBOARD_KEY = 'washi_ledger_dashboard_range_v1'
const HISTORY_KEY = 'washi_ledger_history_range_v1'

function load(key: string): StoredRange | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredRange>
    if (typeof parsed.startDate !== 'string' || typeof parsed.endDate !== 'string') return null
    return { startDate: parsed.startDate, endDate: parsed.endDate }
  } catch (e) {
    console.error('读取日期区间本地存储失败', e)
    return null
  }
}

function save(key: string, range: StoredRange): void {
  try {
    localStorage.setItem(key, JSON.stringify(range))
  } catch (e) {
    console.error('写入日期区间本地存储失败', e)
  }
}

export function loadDashboardRange(): StoredRange | null {
  return load(DASHBOARD_KEY)
}

export function saveDashboardRange(range: StoredRange): void {
  save(DASHBOARD_KEY, range)
}

export function loadHistoryRange(): StoredRange | null {
  return load(HISTORY_KEY)
}

export function saveHistoryRange(range: StoredRange): void {
  save(HISTORY_KEY, range)
}
