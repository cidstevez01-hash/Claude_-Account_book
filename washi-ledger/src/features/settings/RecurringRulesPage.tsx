import { AppLayout } from '../../design-system/components/AppLayout'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useRecurringRules } from '../../hooks/useRecurringRules'
import { useJpHolidays } from '../../hooks/useJpHolidays'
import { formatCurrency } from '../../data/currencyDisplay'
import { catLabel, subLabel, payLabel } from '../../lib/catalogLabel'
import { formatDateFull } from '../../lib/date'
import { computeNextOccurrence } from '../../lib/recurringGeneration'
import { loadCachedEntries } from '../../lib/entriesCache'
import { todayStr } from '../../lib/date'
import { useI18n } from '../../lib/i18n'

/** R-44：固定收支规则列表——设置页"固定收支"入口进来。旧App RECURRING_RULES/
 * RECURRING_BIWEEKLY_RULES写死在代码里，这里改成前台增删改查，绑定账户存数据库
 * (sql/2026-10-14_recurring_rules.sql)，复用useEntries.ts同款数据同步架构
 * (见useRecurringRules.ts) */
export function RecurringRulesPage() {
  const { t, lang } = useI18n()
  const navigate = useAppNavigate()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { rules } = useRecurringRules(user?.id ?? null)
  const jpHolidays = useJpHolidays()

  const categories = [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])]
  const paymentMethods = catalog?.paymentMethods ?? []
  // "次回予定"只用于显示：本机缓存里已有的记录id，判断某个月是否已经生成过
  const generatedIds = new Set(loadCachedEntries().map((e) => e.id))

  return (
    <AppLayout
      title={t('recurringRulesTitle')}
      leftButton="back"
      rightHeaderContent={
        <button
          type="button"
          aria-label={t('recurringRuleAddAria')}
          onClick={() => navigate('/settings/recurring-rules/form')}
          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
        >
          <ThemeIcon icon="add" effect="bare" className="papercut-text-shadow" />
        </button>
      }
    >
      {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
      ) : rules.length === 0 ? (
        <div className="text-center py-16 px-md text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">event_repeat</span>
          <p className="text-body-md">{t('recurringRuleEmptyState')}</p>
        </div>
      ) : (
        <div className="px-md pt-md flex flex-col gap-2">
          {rules.map((rule) => {
            const cat = categories.find((c) => c.code === rule.catCode)
            const sub = cat?.subs.find((s) => s.code === rule.subCode)
            const pm = paymentMethods.find((p) => p.code === rule.paymentMethod)
            const nextDate = computeNextOccurrence(rule, jpHolidays, todayStr(), (id) => generatedIds.has(id))
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => navigate(`/settings/recurring-rules/form?editId=${rule.id}`)}
                className={`w-full flex items-center p-3 text-left rounded-xl bg-surface-container-lowest border-b-2 border-outline-variant ${
                  rule.enabled ? '' : 'opacity-50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0"
                  style={{ background: cat ? 'var(--color-surface-container-high)' : 'var(--color-surface-container-highest)' }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: cat ? cat.color : 'var(--color-on-surface-variant)', fontVariationSettings: "'FILL' 1" }}
                  >
                    {cat?.icon ?? 'category'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-body-lg font-medium text-on-surface truncate">
                    {cat ? (sub ? `${catLabel(cat, lang)} · ${subLabel(sub, lang)}` : catLabel(cat, lang)) : rule.catCode}
                    {pm ? ` · ${payLabel(pm, lang)}` : ''}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {rule.ruleKind === 'dayOfMonth'
                      ? rule.dayOfMonth === 'last'
                        ? t('recurringRuleLastDayOption')
                        : `${t('recurringRuleDayOfMonthLabel')} ${rule.dayOfMonth}`
                      : `${rule.intervalDays}${t('recurringRuleIntervalDaysSuffix')}`}
                    {nextDate ? ` · ${t('recurringRuleNextDateLabel')} ${formatDateFull(nextDate)}` : ''}
                  </p>
                </div>
                <p
                  className="font-serif text-entry-amount shrink-0 ml-2"
                  style={{ color: rule.type === 'income' ? 'var(--color-secondary)' : 'var(--color-primary)' }}
                >
                  {rule.type === 'income' ? '+' : '-'}
                  {formatCurrency(rule.amount, rule.currency)}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
