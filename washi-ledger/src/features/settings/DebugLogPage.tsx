import { ThemeIcon } from '../../icons/Icon'
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

const LEVEL_ACCENT: Record<LogLevel, string> = {
  info: 'border-l-outline-variant',
  warn: 'border-l-tertiary',
  error: 'border-l-primary',
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

  const hasActiveFilters = moduleFilter !== 'all' || levelFilter !== 'all' || timeFilter !== 'all' || query.trim() !== ''

  function resetFilters() {
    setModuleFilter('all')
    setLevelFilter('all')
    setTimeFilter('all')
    setQuery('')
  }

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
          <section className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm">
            <div className="flex items-start gap-3 min-w-0">
              <ThemeIcon className={`material-symbols-outlined shrink-0 mt-0.5 ${enabled ? 'text-secondary' : 'text-on-surface-variant'}`} icon={enabled ? 'sensors' : 'sensors_off'} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${enabled ? 'bg-secondary animate-pulse' : 'bg-outline-variant'}`} />
                  <h2 className="text-body-lg font-semibold text-on-surface">
                    {enabled ? t('debugLogActiveLabel') : t('debugLogPausedLabel')}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {t('debugLogCountLabel').replace('{n}', String(entries.length))}
                </p>
              </div>
            </div>
            <Toggle on={enabled} label={t('debugLogEnableLabel')} onToggle={handleToggleEnabled} />
          </section>

          <details className="group rounded-2xl bg-surface-container-lowest border border-outline-variant overflow-hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 p-4 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <ThemeIcon className="material-symbols-outlined text-on-surface-variant" icon="settings_suggest" />
                <div>
                  <h2 className="text-body-md font-semibold text-on-surface">{t('debugLogCaptureSettings')}</h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{t('debugLogCaptureSettingsHint')}</p>
                </div>
              </div>
              <ThemeIcon className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180" icon="expand_more" />
            </summary>
            <div className="px-3 pb-3 flex flex-col gap-2">
              {LOG_MODULES.map((m) => (
                <div key={m} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-surface-container">
                  <span className="text-body-sm text-on-surface">{moduleNames[m]}</span>
                  <Toggle
                    on={switches[m]}
                    label={t('debugLogModuleSwitchAria').replace('{m}', moduleNames[m])}
                    onToggle={() => handleToggleModule(m)}
                  />
                </div>
              ))}
            </div>
          </details>

          <section className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ThemeIcon className="material-symbols-outlined text-primary" icon="filter_list" />
              <h2 className="text-body-lg font-semibold text-on-surface">{t('debugLogFilterSection')}</h2>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="debug-log-module-filter" className="text-sm font-semibold text-on-surface">
                  {t('debugLogModuleFilterLabel')}
                </label>
                <select
                  id="debug-log-module-filter"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value as ModuleKey)}
                  className="w-full min-h-11 px-3 rounded-xl border border-outline-variant bg-surface text-body-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="all">{`${t('debugLogModuleAll')} (${entries.length})`}</option>
                  {LOG_MODULES.map((m) => (
                    <option key={m} value={m}>{`${moduleNames[m]} (${counts[m]})`}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label htmlFor="debug-log-level-filter" className="text-sm font-semibold text-on-surface">
                    {t('debugLogLevelFilterLabel')}
                  </label>
                  <select
                    id="debug-log-level-filter"
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value as LevelKey)}
                    className="w-full min-h-11 px-2.5 rounded-xl border border-outline-variant bg-surface text-body-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    {LEVEL_KEYS.map((key) => <option key={key} value={key}>{levelLabels[key]}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label htmlFor="debug-log-time-filter" className="text-sm font-semibold text-on-surface">
                    {t('debugLogTimeFilterLabel')}
                  </label>
                  <select
                    id="debug-log-time-filter"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as TimeKey)}
                    className="w-full min-h-11 px-2.5 rounded-xl border border-outline-variant bg-surface text-body-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    {timeFilters.map((filter) => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="debug-log-search" className="text-sm font-semibold text-on-surface">
                  {t('debugLogKeywordLabel')}
                </label>
                <div className="relative">
                  <ThemeIcon className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]" icon="search" />
                  <input
                    id="debug-log-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('debugLogSearchPlaceholder')}
                    className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-outline-variant bg-surface text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="self-start min-h-9 px-3 rounded-full text-sm font-semibold text-primary bg-primary-fixed active:opacity-80"
                >
                  {t('debugLogResetFilters')}
                </button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-2 px-1">
              <div>
                <h2 className="text-body-lg font-semibold text-on-surface">
                  {t('debugLogResultCount').replace('{n}', String(filtered.length))}
                </h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {t('debugLogCountLabel').replace('{n}', String(entries.length))}
                </p>
              </div>
              {copyToast && <span className="text-xs font-semibold text-primary">{t('debugLogCopiedToast')}</span>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={filtered.length === 0}
                className="min-h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 active:opacity-80"
              >
                <ThemeIcon className="material-symbols-outlined text-[18px]" icon="content_copy" />
                {t('debugLogCopyLabel')}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={filtered.length === 0}
                className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm font-semibold disabled:opacity-40 active:bg-surface-container-high"
              >
                <ThemeIcon className="material-symbols-outlined text-[18px]" icon="download" />
                {t('debugLogDownloadLabel')}
              </button>
              <button
                type="button"
                onClick={refresh}
                className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm font-semibold active:bg-surface-container-high"
              >
                <ThemeIcon className="material-symbols-outlined text-[18px]" icon="refresh" />
                {t('debugLogRefreshAria')}
              </button>
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                disabled={entries.length === 0}
                className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary-fixed text-primary text-sm font-semibold disabled:opacity-40 active:opacity-80"
              >
                <ThemeIcon className="material-symbols-outlined text-[18px]" icon="delete_sweep" />
                {t('debugLogClearLabel')}
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest text-center">
                <ThemeIcon className="material-symbols-outlined text-3xl text-outline-variant" icon={entries.length === 0 ? 'notes' : 'search_off'} />
                <p className="text-body-md text-on-surface-variant">
                  {entries.length === 0 ? t('debugLogEmptyHint') : t('debugLogNoMatches')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <section key={group.day} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-sm font-semibold text-on-surface">{group.day}</span>
                      <span className="flex-1 h-px bg-outline-variant/70" />
                      <span className="text-xs text-on-surface-variant">
                        {t('debugLogGroupCount').replace('{n}', String(group.items.length))}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.items.map((entry, index) => (
                        <article
                          key={`${entry.time}-${index}`}
                          className={`p-3 rounded-xl border border-outline-variant border-l-4 ${LEVEL_ACCENT[entry.level]} bg-surface-container-lowest shadow-sm`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            <time className="text-on-surface-variant">{formatTime(entry.time)}</time>
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${MODULE_BADGE[entry.module]}`}>
                              {moduleNames[entry.module]}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${LEVEL_BADGE[entry.level]}`}>
                              {levelLabels[entry.level]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-on-surface break-all whitespace-pre-wrap">{entry.message}</p>
                          {entry.ctx && Object.keys(entry.ctx).length > 0 && (
                            <div className="mt-2 flex flex-col gap-1 pt-2 border-t border-dashed border-outline-variant/70">
                              {Object.entries(entry.ctx).map(([key, value]) => (
                                <div key={key} className="grid grid-cols-[auto_1fr] gap-x-2 font-mono text-[11px] leading-relaxed break-all">
                                  <span className="font-semibold text-on-surface">{key}</span>
                                  <span className="text-on-surface-variant">{value == null ? '-' : String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
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
