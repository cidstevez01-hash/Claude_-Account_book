import { useI18n } from '../../lib/i18n'
import type { MonthSummary } from '../../data/summary'
import { formatCurrency, symbolFor } from '../../data/currencyDisplay'

interface BalanceCardProps {
  summary: MonthSummary
  currency: string
}

export function BalanceCard({ summary, currency }: BalanceCardProps) {
  const { t } = useI18n()
  return (
    <section className="relative bg-surface-container-lowest rounded-xl p-md mx-md mt-sm mb-lg border-[1.5px] border-dashed border-outline-variant papercut-shadow">
      {/* 和纸胶带装饰角 */}
      <div
        className="absolute -top-1.5 right-5 w-8 h-3.5 rounded-sm opacity-70"
        style={{ background: 'var(--color-tertiary-fixed-dim)', transform: 'rotate(4deg)' }}
      />
      <div className="text-center mb-lg">
        <p className="font-sans text-label-caps text-on-surface-variant uppercase tracking-wider mb-1">
          {t('balanceLabel')}
        </p>
        <h2 className="font-serif text-hero-balance font-bold text-on-surface flex items-baseline justify-center flex-wrap">
          <span className="text-2xl font-normal mr-1 text-on-surface-variant">{symbolFor(currency)}</span>
          {summary.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {summary.points > 0 && (
            <span className="ml-2 text-sm font-sans text-outline font-normal">
              {summary.points.toLocaleString()} Points
            </span>
          )}
        </h2>
      </div>
      <div className="flex items-center justify-between border-t-[1.5px] border-dashed border-outline-variant pt-sm">
        <div className="flex-1 text-center">
          <p className="font-sans text-label-caps text-secondary mb-1 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
            {t('monthIncome')}
          </p>
          <p className="font-serif text-stat-figure text-secondary">{formatCurrency(summary.income, currency)}</p>
        </div>
        <div className="w-[1.5px] h-10 bg-outline-variant" />
        <div className="flex-1 text-center">
          <p className="font-sans text-label-caps text-primary mb-1 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
            {t('monthExpense')}
          </p>
          <p className="font-serif text-stat-figure text-primary">{formatCurrency(summary.expense, currency)}</p>
        </div>
      </div>
    </section>
  )
}
