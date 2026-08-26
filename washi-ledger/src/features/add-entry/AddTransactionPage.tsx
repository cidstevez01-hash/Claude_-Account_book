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
import { symbolFor } from '../../data/currencyDisplay'
import { useI18n } from '../../lib/i18n'
import { payLabel } from '../../lib/catalogLabel'
import { setDashboardFocusEntryId } from '../../lib/dashboardFocusMemory'
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

  // entries的初始值来自useEntries里loadCachedEntries()的同步本地缓存读取，不是异步
  // 请求——从列表页点编辑/复制进来时，这条记录早就在缓存里了，能在首次渲染就同步
  // 找到，直接拿去给下面每个useState做初始值。不再是"先渲染一遍空表单，effect里
  // 再补填"，避免用户看到表单先闪一下空白/默认值、再"跳"到真实内容这个可见跳变
  // (2026-08-23真机反馈发现的——B-06那次只修了"填进去又被覆盖"，没解决"填之前
  // 会先闪一下"这个更早的问题)
  const initialSourceEntry = sourceId ? (entries.find((e) => e.id === sourceId) ?? null) : null

  const [type, setType] = useState<EntryType>(() => initialSourceEntry?.type ?? 'expense')
  const [amount, setAmount] = useState(() => (initialSourceEntry ? String(initialSourceEntry.amount) : ''))
  const [catCode, setCatCode] = useState<string | null>(() => initialSourceEntry?.catCode ?? null)
  const [subCode, setSubCode] = useState<string | null>(() => initialSourceEntry?.subCode ?? null)
  const [payCode, setPayCode] = useState<string | null>(() => initialSourceEntry?.paymentMethod ?? null)
  const [date, setDate] = useState(() =>
    initialSourceEntry ? (mode === 'copy' ? todayStr() : initialSourceEntry.date) : todayStr()
  )
  const [tagCode, setTagCode] = useState<string | null>(() => initialSourceEntry?.tagCode ?? null)
  const [points, setPoints] = useState(() => (initialSourceEntry?.points != null ? String(initialSourceEntry.points) : ''))
  const [note, setNote] = useState(() => initialSourceEntry?.note ?? '')
  const [sourceEntry, setSourceEntry] = useState<Entry | null>(() => initialSourceEntry)
  const [prefilled, setPrefilled] = useState(() => mode === 'add' || initialSourceEntry != null)

  // 积分自动计算只在用户真正改过金额/支付方式/日期之后才触发，预填表单(编辑/复制)时
  // 不能被这个effect覆盖掉原本保存的积分值——照旧App"程序赋值不触发input/change事件、
  // 只有真实用户操作才会重算"的行为
  const pointsArmed = useRef(mode === 'add')

  // 兜底：极少数情况下(比如直接深链接打开编辑页，entries本地缓存还没来得及有这条数据)
  // 首次渲染时在entries里找不到，等entries真正拉到之后再补填一次——正常"从列表页点
  // 编辑/复制进来"这条最常见路径走的是上面的同步初始值，不会经过这个effect
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

  // 分类默认值——新记录/切换收支类型后，若当前catCode不在新的分类列表里，兜底选第一个。
  // !prefilled时直接跳过：编辑/复制模式下，这个effect和上面的预填effect在同一次
  // commit里都会跑，但各自读到的还是没更新前的旧闭包值(setState要等下一轮渲染才生效)，
  // 如果不加这个判断，这里会用"还没被预填更新"的catCode(还是初始的null)误判成
  // "没选分类"，把预填的src.catCode又覆盖回categories[0]——这正是B-06的真实原因，
  // 分类/子分类/支付方式编辑时都记不住就是被这几个"默认值兜底"effect覆盖掉的
  useEffect(() => {
    if (!prefilled) return
    if (categories.length === 0) return
    if (!catCode || !categories.find((c) => c.code === catCode)) {
      setCatCode(categories[0].code)
      // 同上面onSelectCat：默认落到第一个分类时也要默认选中它的第一个子分类
      setSubCode(categories[0].subs[0]?.code ?? null)
    }
  }, [categories, catCode, prefilled])

  // 标签不属于当前收支类型时清空(比如编辑数据切了类型这种边界情况)
  useEffect(() => {
    if (tagCode && !tags.find((tg) => tg.code === tagCode)) setTagCode(null)
  }, [tags, tagCode])

  // 同上一个分类兜底effect的道理——!prefilled时跳过，避免编辑/复制模式下用没更新前的
  // 旧payCode(初始值null)误判成"没选支付方式"，把预填的src.paymentMethod覆盖掉
  useEffect(() => {
    if (!prefilled) return
    if (payCode || paymentMethods.length === 0) return
    setPayCode(paymentMethods[0].code)
  }, [paymentMethods, payCode, prefilled])

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
    // 新建/编辑/复制保存后统一navigate(-1)，回到进来之前那个底部大导航页签(仪表盘/
    // 明细都可能是来源)，不强制跳明细页——"新建"入口目前只在仪表盘的悬浮按钮上，
    // 保存完跳去明细页反而是跑题了。编辑/复制/删除操作现已收拢到仪表盘("全放在
    // 首页操作"，明细页不再提供这几个按钮)，回到仪表盘后要定位/高亮到这条记录，
    // 不能让它埋没在整页列表里——写一次性信号给DashboardPage.tsx挂载时消费
    setDashboardFocusEntryId(entry.id)
    navigate(-1)
  }

  // 点"返回"(不保存，放弃改动)，回到进来之前那个页面，跟保存后的行为一致
  function handleBack() {
    navigate(-1)
  }

  const pageTitle = mode === 'edit' ? t('editTitle') : mode === 'copy' ? t('copyTitle') : t('addTitle')

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* B-08：paper-grid-bg只贴main(内容滚动区)，不贴根容器——不然顶部安全区(header
          上方没被header遮住的那一小条)会透出方格纹理，跟header纯色背景不一致 */}
      <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface">
        <button type="button" aria-label="返回" onClick={handleBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-variant/50 active:bg-surface-variant/50 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-serif text-headline-md text-on-surface tracking-tight">{pageTitle}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-40 paper-grid-bg">
       {/* entries缓存优先(见useEntries.ts)比catalog先就绪，catalog没到位前渲染分类/支付方式
           选择器会闪一下"英文图标名+统一灰色"的半成品画面——之前用if(!catalog)return null
           整页提前返回，连header/返回按钮都出不来，真机上就是"进App白屏一段时间"；改成
           只在main内容区域挡一个轻量的loading占位，外壳(header)立刻能看到、能点返回 */}
       {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
       ) : (
        <>
        {/* R-10：收支页签栏改成虚线围绕，照旧App`.segment{border:2px dashed var(--grid)}`真实值 */}
        <div className="px-md pt-2 pb-6">
          <div className="flex p-1 bg-surface-container-highest rounded-xl border-2 border-dashed border-outline-variant relative">
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

        {/* R-10："金额"字样去掉(照旧App没有单独的金额字段标题)；货币符号改成symbolFor()，
            日元/人民币都显示"JP¥"/"CN¥"这种带国别前缀的完整写法，不能只显示裸的"¥"
            (两种货币符号本来就长得一样，裸符号分不清是哪种货币) */}
        <div className="px-md pb-8 flex flex-col items-center">
          <div className="flex items-baseline justify-center border-b-2 border-primary pb-2 w-3/4 max-w-[240px]">
            <span className="font-serif text-hero-balance text-primary mr-2">{symbolFor(settings.currency)}</span>
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
              // 切换分类后默认选中新分类下的第一个子分类，不是清空成"不选"——
              // 没有子分类的分类(subs为空数组)才落回null
              const newCat = categories.find((c) => c.code === code)
              setSubCode(newCat?.subs[0]?.code ?? null)
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
          {/* R-11修正：grid-cols-3强制等分三列会把长一点的支付方式名字(比如"クレジットカード")
              截断——改回照旧App`.sub-wrap`(flex flex-wrap)+`.sub-pill`真实值，每个胶囊按
              文字内容自身宽度撑开、自动换行，短的名字自然一行能排下3个左右，长的也能完整
              显示，不强制等宽三列 */}
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((pm) => {
              const active = pm.code === payCode
              return (
                <button
                  key={pm.code}
                  type="button"
                  onClick={() => touchPayCode(pm.code)}
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

          <h2 className="text-label-caps font-sans text-on-surface-variant mb-sm mt-md tracking-widest uppercase">
            {t('dateLabel')}
          </h2>
          {/* B-04：真机上日期框被截断的真正原因(照旧App index.html dateInput实测有效的
              真实解法搬过来，不是猜的)——iOS Safari原生input[type=date]带自己的WebKit
              控件外观(日/月/年分段+日历图标)，这套外观在被撑成整行宽度时会被自己内部的
              渲染裁切。旧App的dateInput从来不是w-full，而是appearance:none去掉原生外观
              渲染 + 限定一个较窄的固定宽度(max-width:150px)，把控件交给CSS完全接管尺寸，
              不依赖WebKit自己去适配一个不确定的宽度 */}
          <input
            type="date"
            value={date}
            onChange={(e) => touchDate(e.target.value)}
            className="appearance-none bg-surface-container border border-outline-variant rounded-xl px-3.5 h-[46px] text-body-md text-on-surface max-w-[150px] focus:outline-none focus:border-primary"
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
