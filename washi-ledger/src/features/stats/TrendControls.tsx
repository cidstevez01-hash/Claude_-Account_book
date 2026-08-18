import { useI18n } from '../../lib/i18n'

interface TrendControlsProps {
  dim: 'day' | 'month'
  onDimChange: (dim: 'day' | 'month') => void
  periodLabel: string
  onPrev: () => void
  onNext: () => void
}

/** 趋势图的按日/按月切换+上一段/下一段导航——收支趋势和积分推移两张图各自独立一份状态
 * (照旧App的设计：两张图的年月导航互不干扰)，UI照抄一份，避免同样的按钮行写两遍 */
export function TrendControls({ dim, onDimChange, periodLabel, onPrev, onNext }: TrendControlsProps) {
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
        <button type="button" aria-label={t('prevPeriodAria')} onClick={onPrev} className="text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="text-body-md text-on-surface-variant min-w-[72px] text-center">{periodLabel}</span>
        <button type="button" aria-label={t('nextPeriodAria')} onClick={onNext} className="text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
