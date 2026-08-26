import { useI18n } from '../../lib/i18n'

interface MonthNavBarProps {
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
  /** 照旧App monthHasAnyEntries()的真实逻辑：上一个/下一个月份完全没有任何记录时禁用
   * 对应箭头，不让用户切到一张必定是空的图 */
  disablePrev?: boolean
  disableNext?: boolean
}

/** 单月导航条——照design-assets-v2/_12的"‹ October 2023 ›"胶囊样式，统计页的收支/积分
 * 两个分栏共用同一个月份状态，不用各自维护一份 */
export function MonthNavBar({ monthLabel, onPrevMonth, onNextMonth, disablePrev, disableNext }: MonthNavBarProps) {
  const { t } = useI18n()
  return (
    <div className="mx-md flex items-center justify-between bg-surface-container-low border border-outline-variant rounded-xl px-md py-3">
      <button
        type="button"
        aria-label={t('prevMonthAria')}
        onClick={onPrevMonth}
        disabled={disablePrev}
        className="text-on-surface-variant disabled:opacity-30"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <span className="font-serif text-body-lg text-on-surface">{monthLabel}</span>
      <button
        type="button"
        aria-label={t('nextMonthAria')}
        onClick={onNextMonth}
        disabled={disableNext}
        className="text-on-surface-variant disabled:opacity-30"
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  )
}
