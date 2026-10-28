import { useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { useI18n } from '../../lib/i18n'
import {
  clearLog,
  formatLogLine,
  getLogEntries,
  isLogEnabled,
  isModuleEnabled,
  LOG_MODULES,
  setLogEnabled,
  setModuleEnabled,
  type LogEntry,
  type LogLevel,
  type LogModule,
} from '../../lib/appLog'

type TimeKey = 'all' | '5m' | '30m' | '1h' | 'today'
type LevelKey = 'all' | LogLevel
type ModuleKey = 'all' | LogModule

const TIME_MS: Record<'5m' | '30m' | '1h', number> = {
  '5m': 5 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
}

const LEVEL_KEYS: LevelKey[] = ['all', 'info', 'warn', 'error']

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 等级配色：ERROR朱红淡粉底+朱红字，WARN琥珀底+深黄字，INFO纸墨灰底+墨色字
const LEVEL_BADGE: Record<LogLevel, string> = {
  info: 'bg-surface-container-high text-on-surface-variant',
  warn: 'bg-tertiary-fixed text-tertiary',
  error: 'bg-primary-fixed text-primary',
}

// 模块配色：固定收支用墨绿字、小票用琥珀底、其他用纸墨灰，一眼能区分来源
const MODULE_BADGE: Record<LogModule, string> = {
  recurring: 'bg-surface-container-high text-secondary',
  receipt: 'bg-tertiary-fixed text-tertiary',
  other: 'bg-surface-container text-on-surface-variant',
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full border text-[12px] font-sans whitespace-nowrap transition-colors ${
        active
          ? 'border-primary bg-primary-fixed text-primary font-semibold'
          : 'border-outline-variant bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  )
}

function Toggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        on ? 'bg-primary' : 'bg-surface-container-high border border-outline-variant'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/** 诊断日志查看页——纯本地localStorage日志(见lib/appLog.ts)，从设置页"诊断日志"进来。
 * 可以按模块(固定收支/小票/其他)、级别、时间和关键字筛选；每个模块可以单独开关、
 * 单独清空；复制/下载的内容跟当前筛选结果一致 */
export function DebugLogPage() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(() => isLogEnabled())
  const [switches, setSwitches] = useState(
    () => Object.fromEntries(LOG_MODULES.map((m) => [m, isModuleEnabled(m)])) as Record<LogModule, boolean>,
  )
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogEntries())
  const [moduleFilter, setModuleFilter] = useState<ModuleKey>('all')
  const [levelFilter, setLevelFilter] = useState<LevelKey>('all')
  const [timeFilter, setTimeFilter] = useState<TimeKey>('all')
  const [query, setQuery] = useState('')
  const [copyToast, setCopyToast] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const moduleNames: Record<LogModule, string> = {
    recurring: t('debugLogModuleRecurring'),
    receipt: t('debugLogModuleReceipt'),
    other: t('debugLogModuleOther'),
  }

  function refresh() {
    setEntries(getLogEntries())
  }

  const counts = useMemo(() => {
    const c: Record<LogModule, number> = { recurring: 0, receipt: 0, other: 0 }
    for (const e of entries) c[e.module] += 1
    return c
  }, [entries])

  const filtered = useMemo(() => {
    const now = Date.now()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const q = query.trim().toLowerCase()
    const list = entries.filter((e) => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      if (levelFilter !== 'all' && e.level !== levelFilter) return false
      if (timeFilter === 'today' && e.time < startOfDay.getTime()) return false
      if (timeFilter !== 'all' && timeFilter !== 'today' && e.time < now - TIME_MS[timeFilter]) return false
      if (q) {
        const hay = [e.message, ...(e.ctx ? Object.entries(e.ctx).map(([k, v]) => `${k} ${v ?? ''}`) : [])]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    // 最新的排最上面
    return [...list].reverse()
  }, [entries, moduleFilter, levelFilter, timeFilter, query])

  // 按天分组：filtered已经是最新在前，同一天的连续记录归到一组
  const groups = useMemo(() => {
    const out: { day: string; items: LogEntry[] }[] = []
    for (const e of filtered) {
      const day = dayKey(e.time)
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(e)
      else out.push({ day, items: [e] })
    }
    return out
  }, [filtered])

  function handleToggleEnabled() {
    const next = !enabled
    setEnabled(next)
    setLogEnabled(next)
  }

  function handleToggleModule(m: LogModule) {
    const next = !switches[m]
    setSwitches({ ...switches, [m]: next })
    setModuleEnabled(m, next)
  }

  function handleClearConfirm() {
    clearLog(moduleFilter === 'all' ? undefined : moduleFilter)
    setClearOpen(false)
    refresh()
  }

  async function handleCopy() {
    const text = filtered.map(formatLogLine).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Capacitor WebView某些版本clipboard API可能不可用，兜底用隐藏textarea+
      // execCommand，是浏览器端"复制"最古老但兼容性最广的写法
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 1500)
  }

  function handleDownload() {
    const text = filtered.map(formatLogLine).join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `washi-ledger-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const timeFilters: { key: TimeKey; label: string }[] = [
    { key: 'all', label: t('debugLogFilterAll') },
    { key: '5m', label: t('debugLogFilter5m') },
    { key: '30m', label: t('debugLogFilter30m') },
    { key: '1h', label: t('debugLogFilter1h') },
    { key: 'today', label: t('debugLogFilterToday') },
  ]

  const levelLabels: Record<LevelKey, string> = {
    all: t('debugLogLevelAll'),
    info: t('debugLogLevelInfo'),
    warn: t('debugLogLevelWarn'),
    error: t('debugLogLevelError'),
  }

  return (
    <>
      <AppLayout title={t('debugLogTitle')} leftButton="back">
        <div className="px-md pt-md pb-lg flex flex-col gap-md">
          {/* 总开关 + 计数 */}
          <div className="w-full flex items-center justify-between p-sm rounded-lg bg-surface-container-lowest border-b-2 border-outline-variant">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-secondary animate-pulse' : 'bg-outline-variant'}`} />
                <span className="text-body-lg text-on-surface">
                  {enabled ? t('debugLogActiveLabel') : t('debugLogPausedLabel')}
                </span>
              </div>
              <span className="text-xs text-on-surface-variant pl-3.5">
                {t('debugLogCountLabel').replace('{n}', String(entries.length))}
              </span>
            </div>
            <Toggle on={enabled} label={t('debugLogEnableLabel')} onToggle={handleToggleEnabled} />
          </div>

          {/* 模块开关：关掉某个模块后它不再记录，已经存下的日志保留 */}
          <div className="grid grid-cols-3 gap-2">
            {LOG_MODULES.map((m) => (
              <div
                key={m}
                className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant"
              >
                <span className="text-[12px] text-on-surface truncate">{moduleNames[m]}</span>
                <Toggle
                  on={switches[m]}
                  label={t('debugLogModuleSwitchAria').replace('{m}', moduleNames[m])}
                  onToggle={() => handleToggleModule(m)}
                />
              </div>
            ))}
          </div>

          {/* 模块筛选 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip
              active={moduleFilter === 'all'}
              label={`${t('debugLogModuleAll')} ${entries.length}`}
              onClick={() => setModuleFilter('all')}
            />
            {LOG_MODULES.map((m) => (
              <Chip
                key={m}
                active={moduleFilter === m}
                label={`${moduleNames[m]} ${counts[m]}`}
                onClick={() => setModuleFilter(m)}
              />
            ))}
          </div>

          {/* 级别筛选 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {LEVEL_KEYS.map((k) => (
              <Chip key={k} active={levelFilter === k} label={levelLabels[k]} onClick={() => setLevelFilter(k)} />
            ))}
          </div>

          {/* 时间筛选 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {timeFilters.map((f) => (
              <Chip key={f.key} active={timeFilter === f.key} label={f.label} onClick={() => setTimeFilter(f.key)} />
            ))}
          </div>

          {/* 搜索：匹配内容和字段 */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('debugLogSearchPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-[13px] font-sans text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
          />

          {/* 操作按钮：复制/下载/刷新/清空(清空只作用于当前模块筛选) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-[13px] font-sans active:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              {t('debugLogCopyLabel')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-[13px] font-sans active:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {t('debugLogDownloadLabel')}
            </button>
            <button
              type="button"
              aria-label={t('debugLogRefreshAria')}
              onClick={refresh}
              className="w-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant active:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
            <button
              type="button"
              aria-label={t('debugLogClearLabel')}
              onClick={() => setClearOpen(true)}
              className="w-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary active:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
          </div>

          {copyToast && <div className="text-center text-xs text-primary">{t('debugLogCopiedToast')}</div>}

          {/* 日志列表：按天分组，最新在上；每条第一行是时间/模块/级别，然后是内容，结构化字段显示成小标签 */}
          {groups.length === 0 ? (
            <p className="text-center text-body-md text-on-surface-variant py-lg">{t('debugLogEmptyHint')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <section key={g.day}>
                  <div className="flex items-center justify-between px-1 pb-1 text-[12px] font-semibold text-on-surface-variant">
                    <span>{g.day}</span>
                    <span>{t('debugLogGroupCount').replace('{n}', String(g.items.length))}</span>
                  </div>
                  <div className="flex flex-col rounded-lg border border-outline-variant overflow-hidden bg-surface-container-lowest">
                    {g.items.map((e, i) => (
                      <div
                        key={`${e.time}-${i}`}
                        className={`px-3 py-2 ${i > 0 ? 'border-t border-dashed border-outline-variant/60' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-on-surface-variant">{formatTime(e.time)}</span>
                          <span className={`px-1.5 rounded font-semibold ${MODULE_BADGE[e.module]}`}>
                            {moduleNames[e.module]}
                          </span>
                          <span className={`px-1 rounded font-semibold uppercase ${LEVEL_BADGE[e.level]}`}>
                            {e.level}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] leading-snug text-on-surface break-all">{e.message}</div>
                        {e.ctx && Object.keys(e.ctx).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(e.ctx).map(([k, v]) => (
                              <span
                                key={k}
                                className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant break-all"
                              >
                                <span className="text-on-surface">{k}</span>={v == null ? '-' : String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </AppLayout>

      <ConfirmDialog
        open={clearOpen}
        title={t('debugLogClearLabel')}
        message={
          moduleFilter === 'all'
            ? t('debugLogClearConfirm')
            : t('debugLogClearModuleConfirm').replace('{m}', moduleNames[moduleFilter])
        }
        confirmLabel={t('debugLogClearLabel')}
        tone="error"
        onConfirm={handleClearConfirm}
        onCancel={() => setClearOpen(false)}
      />
    </>
  )
}
