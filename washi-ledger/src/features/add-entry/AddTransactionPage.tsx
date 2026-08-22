import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CategoryPicker } from './CategoryPicker'
import { TagPicker } from './TagPicker'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { upsertEntry, resolvePointRate } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { payLabel } from '../../lib/catalogLabel'
import type { Entry, EntryType } from '../../types'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 记一笔——照design-assets-v2/_21(功能全开版)做布局，表单字段的默认值/联动规则
 * (积分自动计算、切收入清空积分、编辑复制锁定收支类型等)照旧仓库index.html里
 * 记账表单的真实逻辑搬过来，不是照Stitch静态稿猜的。自定义细分(CategoryPicker)/
 * 标签(TagPicker)的内联新增改名删除也已经接上了，逻辑照旧App renderSubGrid/
 * renderTagGrid的"⋯"菜单搬。 */
export function AddTransactionPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editId')
  const copyId = searchParams.get('copyId')
  const sourceId = editId || copyId
  const mode: 'add' | 'edit' | 'copy' = editId ? 'edit' : copyId ? 'copy' : 'add'
  const typeLocked = mode !== 'add' // 编辑/复制都锁定收支类型，照旧App的setTypeSegmentLocked(true)

  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries } = useEntries(user?.id ?? null)
  const { settings } = useSettings()

  const [type, setType] = useState<EntryType>('expense')
  const [amount, setAmount] = useState('')
  const [catCode, setCatCode] = useState<string | null>(null)
  const [subCode, setSubCode] = useState<string | null>(null)
  const [payCode, setPayCode] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr)
  const [tagCode, setTagCode] = useState<string | null>(null)
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [sourceEntry, setSourceEntry] = useState<Entry | null>(null)
  const [prefilled, setPrefilled] = useState(mode === 'add')

  // 积分自动计算只在用户真正改过金额/支付方式/日期之后才触发，预填表单(编辑/复制)时
  // 不能被这个effect覆盖掉原本保存的积分值——照旧App"程序赋值不触发input/change事件、
  // 只有真实用户操作才会重算"的行为
  const pointsArmed = useRef(mode === 'add')

  useEffect(() => {
    if (prefilled || !sourceId) return
    const src = entries.find((e) => e.id === sourceId)
    if (!src) return
    setSourceEntry(src)
    setType(src.type)
    setAmount(String(src.amount))
    setCatCode(src.catCode)
    setSubCode(src.subCode)
    setPayCode(src.paymentMethod)
    setDate(mode === 'copy' ? todayStr() : src.date)
    setTagCode(src.tagCode)
    setPoints(src.points != null ? String(src.points) : '')
    setNote(src.note ?? '')
    setPrefilled(true)
  }, [entries, sourceId, prefilled, mode])

  const categories = useMemo(
    () => (catalog ? (type === 'expense' ? catalog.expenseCategories : catalog.incomeCategories) : []),
    [catalog, type]
  )
  const tags = useMemo(
    () => (catalog ? (type === 'expense' ? catalog.expenseTags : catalog.incomeTags) : []),
    [catalog, type]
  )
  const paymentMethods = catalog?.paymentMethods ?? []

  // 分类默认值——新记录/切换收支类型后，若当前catCode不在新的分类列表里，兜底选第一个
  useEffect(() => {
    if (categories.length === 0) return
    if (!catCode || !categories.find((c) => c.code === catCode)) {
      setCatCode(categories[0].code)
      setSubCode(null)
    }
  }, [categories, catCode])

  // 标签不属于当前收支类型时清空(比如编辑数据切了类型这种边界情况)
  useEffect(() => {
    if (tagCode && !tags.find((tg) => tg.code === tagCode)) setTagCode(null)
  }, [tags, tagCode])

  useEffect(() => {
    if (payCode || paymentMethods.length === 0) return
    setPayCode(paymentMethods[0].code)
  }, [paymentMethods, payCode])

  // 收入没有积分这个概念，切收入时清空——照旧App updatePointsFieldVisibility()
  useEffect(() => {
    if (type === 'income') setPoints('')
  }, [type])

  useEffect(() => {
    if (!pointsArmed.current) return
    if (type !== 'expense' || !payCode || !catalog) return
    const amt = parseFloat(amount)
    const rate = resolvePointRate(catalog.pointRules, catalog.paymentMethods, payCode, date || todayStr())
    if (rate == null || isNaN(amt) || amt <= 0) {
      setPoints('')
      return
    }
    setPoints(String(Math.floor(amt * rate)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, payCode, date, type])

  function touchAmount(v: string) {
    pointsArmed.current = true
    setAmount(v)
  }
  function touchPayCode(code: string) {
    pointsArmed.current = true
    setPayCode(code)
  }
  function touchDate(v: string) {
    pointsArmed.current = true
    setDate(v)
  }

  async function handleSave() {
    if (!user) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    const cat = categories.find((c) => c.code === catCode) ?? categories[0]
    if (!cat) return
    const pointsRaw = parseInt(points, 10)
    const finalPoints = type === 'expense' && !isNaN(pointsRaw) && pointsRaw > 0 ? pointsRaw : null
    const base = mode === 'edit' && sourceEntry ? sourceEntry : null
    const entry: Entry = {
      id: base ? base.id : `${Date.now()}${Math.random().toString(16).slice(2)}`,
      type,
      amount: amt,
      currency: base?.currency ?? settings.currency,
      catCode: cat.code,
      subCode,
      paymentMethod: payCode ?? 'cash',
      tagCode,
      note: note.trim() || null,
      points: finalPoints,
      date: date || todayStr(),
      recurringId: base?.recurringId ?? null,
      createdAt: base?.createdAt ?? Date.now(),
    }
    await upsertEntry(entry, user.id)
    navigate(-1)
  }

  const pageTitle = mode === 'edit' ? t('editTitle') : mode === 'copy' ? t('copyTitle') : t('addTitle')

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface">
        <button type="button" aria-label="返回" onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-serif text-headline-md text-on-surface tracking-tight [text-shadow:0_2px_4px_rgba(35,26,19,0.18)]">{pageTitle}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-40">
       {/* entries缓存优先(见useEntries.ts)比catalog先就绪，catalog没到位前渲染分类/支付方式
           选择器会闪一下"英文图标名+统一灰色"的半成品画面——之前用if(!catalog)return null
           整页提前返回，连header/返回按钮都出不来，真机上就是"进App白屏一段时间"；改成
           只在main内容区域挡一个轻量的loading占位，外壳(header)立刻能看到、能点返回 */}
       {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
       ) : (
        <>
        <div className="px-md pt-2 pb-6">
          <div className="flex p-1 bg-surface-container-highest rounded-xl border border-outline-variant/30 relative">
            {(['expense', 'income'] as const).map((key) => (
              <button
                key={key}
                type="button"
                disabled={typeLocked}
                onClick={() => setType(key)}
                className={`flex-1 py-2 text-center rounded-lg text-label-caps font-sans font-normal transition-colors ${
                  type === key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                } ${typeLocked ? 'opacity-60' : ''}`}
              >
                {key === 'expense' ? t('typeExpense').toUpperCase() : t('typeIncome').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="px-md pb-8 flex flex-col items-center">
          <span className="text-on-surface-variant text-label-caps font-sans mb-4 tracking-widest uppercase">
            {t('amountLabel')}
          </span>
          <div className="flex items-baseline justify-center border-b-2 border-primary pb-2 w-3/4 max-w-[240px]">
            <span className="font-serif text-hero-balance text-primary mr-2">¥</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => touchAmount(e.target.value)}
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
              setSubCode(null)
            }
          }}
          onSelectSub={setSubCode}
          userId={user?.id ?? null}
          onCatalogChanged={reloadCatalog}
        />

        <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

        <div className="py-md px-md">
          <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm tracking-widest uppercase">
            {t('methodLabel')}
          </h2>
          <div className="flex overflow-x-auto gap-sm pb-1 -mx-1 px-1">
            {paymentMethods.map((pm) => {
              const active = pm.code === payCode
              return (
                <button
                  key={pm.code}
                  type="button"
                  onClick={() => touchPayCode(pm.code)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-body-md font-sans transition-colors ${
                    active
                      ? 'border-primary bg-primary-fixed text-primary'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <PaymentMethodIcon method={pm} size={18} />
                  {payLabel(pm, lang)}
                </button>
              )
            })}
          </div>

          <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm mt-md tracking-widest uppercase">
            {t('dateLabel')}
          </h2>
          {/* B-04：真机上日期框显示被截断——iOS Safari原生input[type=date]的日/月/年
              字段+日历图标在窄容器里没有足够空间时会被WebKit自己的渲染直接裁掉，不是我们
              这边的flex/grid挤压导致宽度不够(Chromium 375px下实测过w-full没有任何横向溢出，
              问题出在WebKit控件内部渲染，不是CSS布局)。右侧padding和左侧留一样多，等于给
              图标预留区域之外又额外挤了一次空间，缩小右侧padding把多出来的空间还给控件本身 */}
          <input
            type="date"
            value={date}
            onChange={(e) => touchDate(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-xl py-3 pl-3 pr-1.5 text-body-md text-on-surface w-full min-w-0 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

        <div className="px-md py-md grid grid-cols-2 gap-md">
          <div>
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
          {type === 'expense' && (
            <div>
              <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm tracking-widest uppercase">
                {t('pointsLabel')}
              </h2>
              <div className="flex items-center border-b border-outline-variant pb-2">
                <span
                  className="material-symbols-outlined text-tertiary mr-2 text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  stars
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  className="bg-transparent border-none outline-none w-full p-0 font-serif text-stat-figure text-on-surface focus:ring-0"
                />
              </div>
            </div>
          )}
        </div>

        <div className="w-full border-b-[1.5px] border-dashed border-outline-variant" />

        <div className="px-md py-md pb-[120px]">
          <h2 className="text-label-caps font-sans text-on-surface-variant mb-xs tracking-widest uppercase">
            {t('memoLabel')}
          </h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('memoPlaceholder')}
            className="w-full bg-transparent border-none outline-none resize-none h-32 p-0 text-body-lg text-on-surface focus:ring-0"
          />
        </div>
        </>
       )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-md pb-6 bg-gradient-to-t from-surface via-surface to-transparent">
        <button
          type="button"
          onClick={handleSave}
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full h-[58px] bg-primary text-on-primary rounded-xl text-headline-md font-serif active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ boxShadow: '0 4px 0 var(--color-primary-container)' }}
        >
          <span className="material-symbols-outlined">how_to_reg</span>
          {t('saveEntry')}
        </button>
      </div>
    </div>
  )
}
