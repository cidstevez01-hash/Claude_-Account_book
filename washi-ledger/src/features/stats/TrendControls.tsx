import { useI18n } from '../../lib/i18n'

interface TrendControlsProps {
  dim: 'day' | 'month'
  onDimChange: (dim: 'day' | 'month') => void
}

/** 两张趋势图共用页顶月份，只在图内切换按日/按月。 */
export function TrendControls({ dim, onDimChange }: TrendControlsProps) {
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
    </div>
  )
}
