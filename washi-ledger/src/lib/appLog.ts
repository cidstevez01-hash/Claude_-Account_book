/** 全局诊断日志——纯本地(localStorage)，不联网、不经过任何后端，为了解决这次
 * R-32真机排查"卡住了但看不到任何信息"的问题而加：用户手头没有Mac/Safari能连调试，
 * 我这边沙盒也连不上任何远程日志服务(ELK这类方案需要单独搭服务器，而且我这边网络
 * 到不了，搭了也白搭)，所以选了"日志直接存手机本地+App里有个页面能看能复制"这条
 * 最短路径——出问题时用户在App内打开日志页把内容复制/下载发过来就行，不需要额外
 * 工具/设备。
 *
 * 每条日志带模块(module)和可选的结构化字段(ctx)：日志页可以按模块筛选、单独清空、
 * 单独开关；ctx是key/value，日志页显示成小标签，复制时拼成key=value，方便抓取。 */

export type LogLevel = 'info' | 'warn' | 'error'

/** 日志模块——按功能分开记。旧版本存下来的日志没有模块字段，读取时归到'other' */
export type LogModule = 'recurring' | 'receipt' | 'other'
export const LOG_MODULES: LogModule[] = ['recurring', 'receipt', 'other']

/** 结构化字段，日志页显示成小标签 */
export type LogContext = Record<string, string | number | boolean | null>

export interface LogEntry {
  time: number // epoch毫秒
  level: LogLevel
  module: LogModule
  message: string
  ctx?: LogContext
}

const STORAGE_KEY = 'washi-ledger-diagnostic-log'
// 防止localStorage被日志无限撑爆——超过这个条数就把最旧的丢掉，只留最近的
const MAX_ENTRIES = 2000

let cache: LogEntry[] | null = null

function normalize(raw: Partial<LogEntry>): LogEntry {
  return {
    time: raw.time ?? 0,
    level: raw.level ?? 'info',
    module: raw.module && LOG_MODULES.includes(raw.module) ? raw.module : 'other',
    message: raw.message ?? '',
    ctx: raw.ctx,
  }
}

function loadCache(): LogEntry[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as Partial<LogEntry>[]).map(normalize) : []
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

export function logEvent(message: string, level: LogLevel = 'info', module: LogModule = 'other', ctx?: LogContext): void {
  const list = loadCache()
  list.push({ time: Date.now(), level, module, message, ctx })
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES)
  persist()
}

export function getLogEntries(): LogEntry[] {
  return [...loadCache()]
}

/** 不传模块：清空全部；传了模块：只清空这个模块的日志，其他模块保留 */
export function clearLog(module?: LogModule): void {
  const list = loadCache()
  cache = module ? list.filter((e) => e.module !== module) : []
  persist()
}

/** 一行文本，复制/下载用 */
export function formatLogLine(e: LogEntry): string {
  const ctxText = e.ctx ? Object.entries(e.ctx).map(([k, v]) => ` ${k}=${v == null ? '-' : String(v)}`).join('') : ''
  return `${new Date(e.time).toISOString()} [${e.level}] [${e.module}] ${e.message}${ctxText}`
}

// 诊断日志总开关——设置页/日志页可以手动关，但默认开着：现在这个阶段正是要靠它
// 排查真机问题，默认关闭的话用户还得先记得去打开才能采到要看的数据，等于白加
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

// 模块开关——关掉某个模块后这个模块不再记录，已经存下的日志保留
const MODULE_SWITCH_KEY = 'washi-ledger-diagnostic-log-modules'

function loadModuleSwitches(): Partial<Record<LogModule, boolean>> {
  try {
    const raw = localStorage.getItem(MODULE_SWITCH_KEY)
    return raw ? (JSON.parse(raw) as Partial<Record<LogModule, boolean>>) : {}
  } catch {
    return {}
  }
}

export function isModuleEnabled(module: LogModule): boolean {
  return loadModuleSwitches()[module] !== false
}

export function setModuleEnabled(module: LogModule, enabled: boolean): void {
  try {
    localStorage.setItem(MODULE_SWITCH_KEY, JSON.stringify({ ...loadModuleSwitches(), [module]: enabled }))
  } catch {
    // 同上
  }
}

/** 调用方统一用这个——同时尊重总开关和该模块的开关，任一关闭时是no-op，
 * 调用方不用每次自己判断 */
export function logModule(module: LogModule, message: string, level: LogLevel = 'info', ctx?: LogContext): void {
  if (isLogEnabled() && isModuleEnabled(module)) logEvent(message, level, module, ctx)
}
