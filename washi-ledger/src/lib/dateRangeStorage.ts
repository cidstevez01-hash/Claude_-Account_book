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

// 存储版本标记——dev.17之前的旧代码会把组件挂载时自动算出来的默认区间也当成
// "用户选择"存进来(每次state变化就无脑存，不分默认值/真实手动选择)，导致"每月1日该
// 自动变成新的当月"这类需求实现不了。dev.17改成只在用户真的点过日历"确定"/预设选项
// 才写入(见DashboardPage.tsx/HistoryPage.tsx的DateRangeBar onChange)，但已经装过
// 旧版本的设备上localStorage里可能还留着旧代码写的、没有这个标记的存量值——不能拿
// "内容是不是正好一整个月"去猜是不是旧值，猜不准(用户也可能就是手动选了某个月)，
// 所以老老实实加一个版本号：只有新逻辑写入时才带v:2标记，读到没有这个标记的值一律
// 当成"不存在"处理(顺手删掉，不留着占地方)，回退到重新计算的默认区间；新逻辑存的
// 值不管是不是当月都不受影响，不会被误当成旧值清掉
interface StoredRangeV2 extends StoredRange {
  v: 2
}

const DASHBOARD_KEY = 'washi_ledger_dashboard_range_v1'
const HISTORY_KEY = 'washi_ledger_history_range_v1'

function load(key: string): StoredRange | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredRangeV2>
    if (parsed.v !== 2) {
      try {
        localStorage.removeItem(key)
      } catch {
        // 删不掉就算了，不影响"当成不存在处理"这个结果
      }
      return null
    }
    if (typeof parsed.startDate !== 'string' || typeof parsed.endDate !== 'string') return null
    return { startDate: parsed.startDate, endDate: parsed.endDate }
  } catch (e) {
    console.error('读取日期区间本地存储失败', e)
    return null
  }
}

function save(key: string, range: StoredRange): void {
  try {
    const withVersion: StoredRangeV2 = { ...range, v: 2 }
    localStorage.setItem(key, JSON.stringify(withVersion))
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
