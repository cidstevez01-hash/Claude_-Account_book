/** 全局诊断日志——纯本地(localStorage)，不联网、不经过任何后端，为了解决这次
 * R-32真机排查"卡住了但看不到任何信息"的问题而加：用户手头没有Mac/Safari能连调试，
 * 我这边沙盒也连不上任何远程日志服务(ELK这类方案需要单独搭服务器，而且我这边网络
 * 到不了，搭了也白搭)，所以选了"日志直接存手机本地+App里有个页面能看能复制"这条
 * 最短路径——出问题时用户在App内打开日志页把内容复制/下载发过来就行，不需要额外
 * 工具/设备。
 *
 * 不是只给R-32用的专属日志——设计成通用的app-wide工具，以后别的功能真机排查
 * 也能顺手调用同一套(logEvent)，不用每个功能各自发明一遍。 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  time: number // epoch毫秒
  level: LogLevel
  message: string
}

const STORAGE_KEY = 'washi-ledger-diagnostic-log'
// 防止localStorage被日志无限撑爆——超过这个条数就把最旧的丢掉，只留最近的
const MAX_ENTRIES = 2000

let cache: LogEntry[] | null = null

function loadCache(): LogEntry[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage满了/隐私模式不可用时静默失败——日志本身是辅助排查用的，
    // 不能因为存不下就把日志功能本身变成新的崩溃点
  }
}

export function logEvent(message: string, level: LogLevel = 'info'): void {
  const list = loadCache()
  list.push({ time: Date.now(), level, message })
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES)
  persist()
}

export function getLogEntries(): LogEntry[] {
  return [...loadCache()]
}

export function clearLog(): void {
  cache = []
  persist()
}

// 诊断日志开关——设置页可以手动关(见SettingsPage.tsx)，但默认开着：现在这个
// 阶段正是要靠它排查R-32真机卡住的问题，默认关闭的话用户还得先记得去设置页打开
// 才能采到这次要看的数据，等于白加。以后这条问题真正定位解决、不再需要频繁开着
// 记日志时，用户自己去设置页关掉就行
const ENABLED_KEY = 'washi-ledger-diagnostic-log-enabled'

export function isLogEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

export function setLogEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // 同上，存不下就算了，不阻塞用户操作
  }
}

/** 调用方统一用这个而不是直接调logEvent——自动尊重开关状态，关闭时是no-op，
 * 调用方不用每次自己判断isLogEnabled() */
export function logIfEnabled(message: string, level: LogLevel = 'info'): void {
  if (isLogEnabled()) logEvent(message, level)
}
