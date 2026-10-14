import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { RouteFade } from '../../design-system/components/RouteFade'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { CategoryPicker } from '../add-entry/CategoryPicker'
import { TagPicker } from '../add-entry/TagPicker'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useRecurringRules } from '../../hooks/useRecurringRules'
import { upsertRecurringRule, deleteRecurringRule } from '../../data/recurringRules'
import { symbolFor } from '../../data/currencyDisplay'
import { useSettings } from '../../hooks/useSettings'
import { payLabel } from '../../lib/catalogLabel'
import { useI18n } from '../../lib/i18n'
import { todayStr } from '../../lib/date'
import type { EntryType, RecurringRule } from '../../types'

/** R-44：固定收支规则新建/编辑表单——跟AddTransactionPage.tsx同一套交互语言
 * (收支切换/金额大字输入/CategoryPicker/支付方式胶囊/TagPicker都是直接复用那边
 * 已经调好的组件)，只是把"日期"换成"重复方式"这组规则专属字段，没有小票扫描 */
export function RecurringRuleFormPage() {
  const { t, lang } = useI18n()
  const navigate = useAppNavigate()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { rules, removeLocal } = useRecurringRules(user?.id ?? null)
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editId')
  const sourceRule = editId ? (rules.find((r) => r.id === editId) ?? null) : null

  const categories = [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])]
  const tags = [...(catalog?.expenseTags ?? []), ...(catalog?.incomeTags ?? [])]
  const paymentMethods = catalog?.paymentMethods ?? []

  const [type, setType] = useState<EntryType>(() => sourceRule?.type ?? 'expense')
  const [amount, setAmount] = useState(() => (sourceRule ? String(sourceRule.amount) : ''))
  const [catCode, setCatCode] = useState<string | null>(() => sourceRule?.catCode ?? null)
  const [subCode, setSubCode] = useState<string | null>(() => sourceRule?.subCode ?? null)
  const [payCode, setPayCode] = useState<string | null>(() => sourceRule?.paymentMethod ?? null)
  const [tagCode, setTagCode] = useState<string | null>(() => sourceRule?.tagCode ?? null)
  const [note, setNote] = useState(() => sourceRule?.note ?? '')
  const [ruleKind, setRuleKind] = useState<'dayOfMonth' | 'intervalDays'>(() => sourceRule?.ruleKind ?? 'dayOfMonth')
  const [dayOfMonth, setDayOfMonth] = useState(() => sourceRule?.dayOfMonth ?? '1')
  const [bizDayAdjust, setBizDayAdjust] = useState<'none' | 'before' | 'after'>(() => sourceRule?.bizDayAdjust ?? 'none')
  const [anchorDate, setAnchorDate] = useState(() => sourceRule?.anchorDate ?? todayStr())
  const [intervalDays, setIntervalDays] = useState(() => (sourceRule?.intervalDays ? String(sourceRule.intervalDays) : '14'))
  const [enabled, setEnabled] = useState(() => sourceRule?.enabled ?? true)
  const [pendingDelete, setPendingDelete] = useState(false)

  function handleBack() {
    navigate(-1)
  }

  async function handleSave() {
    if (!user || !catCode) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    const rule: RecurringRule = {
      id: sourceRule?.id ?? crypto.randomUUID(),
      type,
      amount: amt,
      currency: sourceRule?.currency ?? settings.currency,
      catCode,
      subCode,
      paymentMethod: payCode,
      tagCode,
      note: note.trim() || null,
      ruleKind,
      dayOfMonth: ruleKind === 'dayOfMonth' ? dayOfMonth : null,
      bizDayAdjust: ruleKind === 'dayOfMonth' && bizDayAdjust !== 'none' ? bizDayAdjust : null,
      anchorDate: ruleKind === 'intervalDays' ? anchorDate : null,
      intervalDays: ruleKind === 'intervalDays' ? parseInt(intervalDays, 10) || 1 : null,
      enabled,
    }
    await upsertRecurringRule(rule, user.id)
    navigate(-1)
  }

  async function confirmDelete() {
    if (!user || !sourceRule) return
    removeLocal(sourceRule.id)
    setPendingDelete(false)
    await deleteRecurringRule(sourceRule.id, user.id)
    navigate(-1)
  }

  const pageTitle = sourceRule ? t('recurringRuleEditTitle') : t('recurringRuleAddTitle')

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <RouteFade className="flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface">
          <button
            type="button"
            aria-label="返回"
            onClick={handleBack}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
          >
            <ThemeIcon icon="arrow_back" effect="bare" className="papercut-text-shadow" />
          </button>
          <h1 className="font-serif text-headline-md text-app-title tracking-tight papercut-text-shadow">{pageTitle}</h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-40 paper-grid-bg">
          {!catalog ? (
            <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
          ) : (
            <>
              <div className="px-md pt-2 pb-6">
                <div className="flex p-1 bg-surface-container-highest rounded-xl border-2 border-dashed border-outline-variant relative">
                  {(['expense', 'income'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`flex-1 py-2 text-center rounded-lg text-label-caps font-sans font-normal transition-colors ${
                        type === key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      {key === 'expense' ? t('typeExpense').toUpperCase() : t('typeIncome').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-md pb-8 flex flex-col items-center">
                <div className="flex items-baseline justify-center border-b-2 border-primary pb-2 w-3/4 max-w-[240px]">
                  <span className="font-serif text-hero-balance text-primary mr-2">
                    {symbolFor(sourceRule?.currency ?? settings.currency)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent border-none outline-none font-serif text-hero-balance text-on-surface w-full text-left p-0 focus:ring-0 leading-none"
                  />
                </div>
              </div>

              <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

              <CategoryPicker
                categories={categories}
                selectedCatCode={catCode}
                selectedSubCode={subCode}
                onSelectCat={(code) => {
                  if (code !== catCode) {
                    setCatCode(code)
                    const newCat = categories.find((c) => c.code === code)
                    setSubCode(newCat?.subs[0]?.code ?? null)
                  }
                }}
                onSelectSub={setSubCode}
                userId={user?.id ?? null}
                onCatalogChanged={reloadCatalog}
              />

              <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

              {/* R-44专属：重复方式——两种类型二选一，字段互斥，照recurring_rules表
                  的check constraint设计一致(两种类型各自要求的字段不会同时出现) */}
              <div className="py-md px-md">
                <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm tracking-widest uppercase">
                  {t('recurringRuleKindLabel')}
                </h2>
                <div className="flex p-1 bg-surface-container-highest rounded-xl border-2 border-dashed border-outline-variant mb-md">
                  {(['dayOfMonth', 'intervalDays'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRuleKind(key)}
                      className={`flex-1 py-2 text-center rounded-lg text-body-sm font-sans transition-colors ${
                        ruleKind === key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      {key === 'dayOfMonth' ? t('recurringRuleKindDayOfMonth') : t('recurringRuleKindIntervalDays')}
                    </button>
                  ))}
                </div>

                {ruleKind === 'dayOfMonth' ? (
                  <div className="flex flex-col gap-md">
                    <div>
                      <span className="text-body-sm text-on-surface-variant block mb-1.5">{t('recurringRuleDayOfMonthLabel')}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          disabled={dayOfMonth === 'last'}
                          value={dayOfMonth === 'last' ? '' : dayOfMonth}
                          onChange={(e) => setDayOfMonth(e.target.value)}
                          className="appearance-none bg-surface-container border border-outline-variant rounded-xl px-3.5 h-[46px] text-body-md text-on-surface w-20 focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                        <label className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={dayOfMonth === 'last'}
                            onChange={(e) => setDayOfMonth(e.target.checked ? 'last' : '1')}
                          />
                          {t('recurringRuleLastDayOption')}
                        </label>
                      </div>
                    </div>
                    <div>
                      <span className="text-body-sm text-on-surface-variant block mb-1.5">{t('recurringRuleBizDayAdjustLabel')}</span>
                      <div className="flex flex-wrap gap-2">
                        {(['none', 'before', 'after'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setBizDayAdjust(opt)}
                            className={`py-2 px-3.5 rounded-full border text-[13px] font-sans transition-colors ${
                              bizDayAdjust === opt
                                ? 'border-primary bg-primary-fixed text-primary font-semibold'
                                : 'border-outline-variant bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {opt === 'none'
                              ? t('recurringRuleBizDayAdjustNone')
                              : opt === 'before'
                                ? t('recurringRuleBizDayAdjustBefore')
                                : t('recurringRuleBizDayAdjustAfter')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-md">
                    <div>
                      <span className="text-body-sm text-on-surface-variant block mb-1.5">{t('recurringRuleAnchorDateLabel')}</span>
                      <input
                        type="date"
                        value={anchorDate}
                        onChange={(e) => setAnchorDate(e.target.value)}
                        className="appearance-none bg-surface-container border border-outline-variant rounded-xl px-3.5 h-[46px] text-body-md text-on-surface max-w-[150px] focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <span className="text-body-sm text-on-surface-variant block mb-1.5">{t('recurringRuleIntervalDaysLabel')}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={intervalDays}
                          onChange={(e) => setIntervalDays(e.target.value)}
                          className="appearance-none bg-surface-container border border-outline-variant rounded-xl px-3.5 h-[46px] text-body-md text-on-surface w-20 focus:outline-none focus:border-primary"
                        />
                        <span className="text-body-sm text-on-surface-variant">{t('recurringRuleIntervalDaysSuffix')}</span>
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 mt-md text-body-md text-on-surface">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                  {t('recurringRuleEnabledLabel')}
                </label>
              </div>

              <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

              <div className="py-md px-md">
                <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm tracking-widest uppercase">
                  {t('methodLabel')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm) => {
                    const active = pm.code === payCode
                    return (
                      <button
                        key={pm.code}
                        type="button"
                        onClick={() => setPayCode(active ? null : pm.code)}
                        className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full border text-[13px] font-sans transition-colors ${
                          active
                            ? 'border-primary bg-primary-fixed text-primary font-semibold'
                            : 'border-outline-variant bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <PaymentMethodIcon method={pm} size={18} />
                        {payLabel(pm, lang)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

              <div className="px-md py-md">
                <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm tracking-widest uppercase">
                  {t('tagsLabel')}
                </h2>
                <TagPicker
                  tags={tags}
                  type={type}
                  selectedTagCode={tagCode}
                  onSelectTag={setTagCode}
                  userId={user?.id ?? null}
                  onCatalogChanged={reloadCatalog}
                />
              </div>

              <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

              <div className="px-md py-md">
                <h2 className="text-label-caps font-sans text-on-surface-variant mb-xs tracking-widest uppercase">
                  {t('memoLabel')}
                </h2>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('memoPlaceholder')}
                  className="w-full bg-transparent border-none outline-none resize-none min-h-24 overflow-y-auto p-0 text-body-lg text-on-surface focus:ring-0"
                />
              </div>

              {sourceRule && (
                <div className="px-md py-md">
                  <button
                    type="button"
                    onClick={() => setPendingDelete(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-error text-error text-body-md active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    {t('deleteLabel')}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {catalog && (
          <div
            className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] p-md bg-surface border-t-[1.5px] border-dashed border-outline-variant"
            style={{ paddingBottom: 'calc(var(--spacing-md) + env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={!amount || parseFloat(amount) <= 0 || !catCode}
              className="w-full h-[58px] bg-primary text-on-primary rounded-xl text-headline-md font-serif active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ boxShadow: '0 4px 0 var(--color-primary-container)' }}
            >
              <span className="material-symbols-outlined">how_to_reg</span>
              {t('recurringRuleSaveLabel')}
            </button>
          </div>
        )}
      </RouteFade>

      <ConfirmDialog
        open={pendingDelete}
        title={t('recurringRuleDeleteConfirmTitle')}
        message={t('recurringRuleDeleteConfirmMessage')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  )
}
