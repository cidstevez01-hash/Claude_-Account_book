import { useI18n } from '../../lib/i18n'

interface TrendControlsProps {
  dim: 'day' | 'month'
  onDimChange: (dim: 'day' | 'month') => void
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  /** 同MonthNavBar.tsx：上一段/下一段(按日模式=上下一个月，按月模式=上下一年)完全没有
   * 任何记录时禁用对应箭头 */
  disablePrev?: boolean
  disableNext?: boolean
}

/** 趋势图的按日/按月切换+上一段/下一段导航——收支趋势和积分推移两张图各自独立一份状态
 * (照旧App的设计：两张图的年月导航互不干扰)，UI照抄一份，避免同样的按钮行写两遍 */
export function TrendControls({ dim, onDimChange, periodLabel, onPrev, onNext, disablePrev, disableNext }: TrendControlsProps) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between mb-sm">
      <div className="flex gap-1 bg-surface-container-highest rounded-lg p-0.5">
        {(['day', 'month'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDimChange(key)}
            className={`px-2.5 py-1 rounded text-tab-label font-sans ${
              dim === key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {key === 'day' ? t('pointsDimDay') : t('pointsDimMonth')}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t('prevPeriodAria')}
          onClick={onPrev}
          disabled={disablePrev}
          className="text-on-surface-variant disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="text-body-md text-on-surface-variant min-w-[72px] text-center">{periodLabel}</span>
        <button
          type="button"
          aria-label={t('nextPeriodAria')}
          onClick={onNext}
          disabled={disableNext}
          className="text-on-surface-variant disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
