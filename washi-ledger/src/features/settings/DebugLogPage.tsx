import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { useI18n } from '../../lib/i18n'
import { clearLog, getLogEntries, isLogEnabled, setLogEnabled, type LogEntry } from '../../lib/appLog'

type FilterKey = 'all' | '5m' | '30m' | '1h' | 'today'

const FILTER_MS: Record<Exclude<FilterKey, 'all' | 'today'>, number> = {
  '5m': 5 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function entriesToText(entries: LogEntry[]): string {
  return entries
    .map((e) => `${new Date(e.time).toISOString()} [${e.level}] ${e.message}`)
    .join('\n')
}

// 等级配色——Stitch设计稿要求三档用明确的底色区分(不只是文字变色)：
// ERROR朱红淡粉底+朱红字，WARN琥珀底+深黄字，INFO纸墨灰底+墨色字
const LEVEL_BADGE: Record<LogEntry['level'], string> = {
  info: 'bg-surface-container-high text-on-surface-variant',
  warn: 'bg-tertiary-fixed text-tertiary',
  error: 'bg-primary-fixed text-primary',
}

/** R-32排查真机卡住问题新加的诊断日志查看页——纯本地localStorage日志(见lib/appLog.ts
 * 的说明)，不是给普通用户用的功能，从设置页"诊断日志"这一行进来。Stitch两次生成
 * 请求都超时失败(list_screens确认没有新画面产生，不是还在后台跑)，这是纯功能性的
 * 开发调试页面，没有等Stitch，直接照App现有设计token(和纸虚线框/圆角/朱红主色)
 * 手写的，跟这次修R-32真机卡住bug本身比起来，这个工具页的视觉打磨优先级更低 */
export function DebugLogPage() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(() => isLogEnabled())
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogEntries())
  const [filter, setFilter] = useState<FilterKey>('all')
  const [copyToast, setCopyToast] = useState(false)

  function refresh() {
    setEntries(getLogEntries())
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const now = Date.now()
    let list = entries
    if (filter === 'today') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      list = list.filter((e) => e.time >= startOfDay.getTime())
    } else if (filter !== 'all') {
      const cutoff = now - FILTER_MS[filter]
      list = list.filter((e) => e.time >= cutoff)
    }
    // 最新的日志排最上面，方便卡住的时候不用滑到底找最后一条
    return [...list].reverse()
  }, [entries, filter])

  function handleToggleEnabled() {
    const next = !enabled
    setEnabled(next)
    setLogEnabled(next)
  }

  function handleClear() {
    if (!window.confirm(t('debugLogClearConfirm'))) return
    clearLog()
    refresh()
  }

  async function handleCopy() {
    const text = entriesToText(filtered)
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
    const text = entriesToText(filtered)
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

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('debugLogFilterAll') },
    { key: '5m', label: t('debugLogFilter5m') },
    { key: '30m', label: t('debugLogFilter30m') },
    { key: '1h', label: t('debugLogFilter1h') },
    { key: 'today', label: t('debugLogFilterToday') },
  ]

  return (
    <AppLayout title={t('debugLogTitle')} leftButton="back">
      <div className="px-md pt-md pb-lg flex flex-col gap-md">
        {/* 记录开关+状态行——照Stitch设计稿加了"实时捕获中"+呼吸点+日志计数，
            不只是一个孤零零的开关；跟设置页其他行同一套视觉(圆角+底部实线) */}
        <div className="w-full flex items-center justify-between p-sm rounded-lg bg-surface-container-lowest border-b-2 border-outline-variant">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${enabled ? 'bg-secondary animate-pulse' : 'bg-outline-variant'}`}
              />
              <span className="text-body-lg text-on-surface">
                {enabled ? t('debugLogActiveLabel') : t('debugLogPausedLabel')}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant pl-3.5">
              {t('debugLogCountLabel').replace('{n}', String(entries.length))}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('debugLogEnableLabel')}
            onClick={handleToggleEnabled}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
              enabled ? 'bg-primary' : 'bg-surface-container-high border border-outline-variant'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-surface shadow-sm transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* 时间筛选——横向滚动的胶囊chip，跟支付方式选择那一排(AddTransactionPage)
            同一种"文字撑开+自动换行/滚动"的胶囊风格 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full border text-[13px] font-sans whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'border-primary bg-primary-fixed text-primary font-semibold'
                  : 'border-outline-variant bg-surface-container text-on-surface-variant'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 操作按钮——复制/下载/清空，放在列表上方(不是fixed贴底)，AppLayout的
            children渲染在RouteFade包着的<main>里，RouteFade的入场动画会给fixed
            定位的后代元素引入新的containing block(见AddTransactionPage.tsx同类
            说明)，贴底fixed容易出问题，这个工具页不需要"操作按钮必须一直悬浮可见"，
            放在滚动区顶部更简单可靠 */}
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
            onClick={handleClear}
            className="w-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-primary active:bg-surface-container-high transition-colors"
            aria-label={t('debugLogClearLabel')}
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          </button>
        </div>

        {copyToast && (
          <div className="text-center text-xs text-primary">{t('debugLogCopiedToast')}</div>
        )}

        {/* 日志列表——等宽字体，条目间极细虚线分隔，最新的排最上面 */}
        {filtered.length === 0 ? (
          <p className="text-center text-body-md text-on-surface-variant py-lg">{t('debugLogEmptyHint')}</p>
        ) : (
          <div className="flex flex-col rounded-lg border border-outline-variant overflow-hidden bg-surface-container-lowest">
            {filtered.map((e, i) => (
              <div
                key={`${e.time}-${i}`}
                className={`px-2.5 py-2 font-mono text-[11px] leading-snug break-all ${
                  i > 0 ? 'border-t border-dashed border-outline-variant/60' : ''
                }`}
              >
                <span className="text-on-surface-variant">{formatTime(e.time)}</span>{' '}
                <span className={`inline-block px-1 rounded font-semibold uppercase ${LEVEL_BADGE[e.level]}`}>
                  {e.level}
                </span>{' '}
                <span className="text-on-surface">{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
