import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DonutRing } from '../../design-system/components/DonutRing'
import { ScrollLegendList } from '../../design-system/components/ScrollLegendList'
import { useI18n } from '../../lib/i18n'
import { formatCurrency } from '../../data/currencyDisplay'
import { tagBreakdownRange, type CategoryShare } from '../../data/summary'
import { tagLabel } from '../../lib/catalogLabel'
import { activeTintColor } from '../../lib/color'
import type { Entry, EntryType, Tag } from '../../types'

interface TagDimensionProps {
  entries: Entry[]
  expenseTags: Tag[]
  incomeTags: Tag[]
  startDate: string
  endDate: string
}

export interface TagGroupSelection {
  tagCode: string
  /** true=点的是"其他"那组(没打这个标签的)，false=点的是匹配这个标签的那组——
   * 照旧App openMonthDetail()的tagExclude参数语义 */
  tagExclude: boolean
  tagLabelText: string
  type: EntryType
}

interface CategoryDonutCardProps {
  expenseShares: CategoryShare[]
  incomeShares: CategoryShare[]
  onSelectCategory?: (catCode: string, type: EntryType) => void
  /** 标签维度(#7)下点图例行——照旧App openMonthDetail({tagCode, tagExclude,
   * tagLabelText, type})真实逻辑，点的是"匹配标签"还是"其他"这两组都能钻取，
   * 不是像之前那样直接禁用点击 */
  onSelectTagGroup?: (selection: TagGroupSelection) => void
  /** 数据源整体切换时(比如翻月)传一个变化的值进来，图例滚动位置跟着回到顶部——
   * 照旧App resetScroll=true的场景("翻月"也算)，不只是切支出/收入这一种情况 */
  resetKey?: string | number
  /** 传入的shares.amount已经是按这个币种换算好的(调用方用toDisplayEntries()统一
   * 转换过)，这里只管用对应币种符号格式化显示，不做换算。默认CNY是兼容旧调用点，
   * 实际调用方都应该显式传settings.currency */
  currency?: string
  /** 传了这几项才会显示右上角"分类/标签"维度切换下拉框(#7，照旧App renderHomeDonut()的
   * homeDonutDimSelect真实逻辑)——目前只有仪表盘接了这个，统计页donut卡片没有这个维度
   * 切换需求，不传就还是纯分类模式，跟原来行为一样 */
  tagDimension?: TagDimensionProps
}

export function CategoryDonutCard({
  expenseShares,
  incomeShares,
  onSelectCategory,
  onSelectTagGroup,
  resetKey,
  currency = 'CNY',
  tagDimension,
}: CategoryDonutCardProps) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<EntryType>('expense')
  const [dimTagCode, setDimTagCode] = useState<string | null>(null)

  const currentTags = tagDimension ? (tab === 'expense' ? tagDimension.expenseTags : tagDimension.incomeTags) : []
  // 标签维度是"某个具体标签"，切支出/收入tab后这个标签可能在另一边根本不存在——
  // 照旧App renderDonutDimOptions()的容错逻辑，此时自动退回分类维度，不留一个选不中的空值
  useEffect(() => {
    if (dimTagCode && !currentTags.some((tg) => tg.code === dimTagCode)) setDimTagCode(null)
  }, [dimTagCode, currentTags])

  const categoryShares = tab === 'expense' ? expenseShares : incomeShares
  const selectedTag = currentTags.find((tg) => tg.code === dimTagCode) ?? null
  const shares = useMemo(() => {
    if (tagDimension && selectedTag) {
      return tagBreakdownRange(
        tagDimension.entries,
        selectedTag,
        tab,
        tagDimension.startDate,
        tagDimension.endDate,
        lang,
        t('tagOtherBucket')
      )
    }
    return categoryShares
  }, [tagDimension, selectedTag, tab, lang, t, categoryShares])
  const total = shares.reduce((sum, s) => sum + s.amount, 0)

  return (
    <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
      <div className="flex border-b border-dashed border-outline-variant mb-3">
        {(['expense', 'income'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 font-serif text-headline-md transition-colors border-b-2 ${
              tab === key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'
            }`}
          >
            {key === 'expense' ? t('typeExpense') : t('typeIncome')}
          </button>
        ))}
      </div>

      {/* 维度切换下拉框(#7)——照旧App".donut-row .dim-select"真实定位：绝对定位浮在
          donut右上角本来就空着的地方，不挤占donut/图例的居中布局 */}
      <div className="relative">
        {tagDimension && (
          <select
            value={dimTagCode ?? ''}
            onChange={(e) => setDimTagCode(e.target.value || null)}
            className="absolute top-0 right-0 z-10 appearance-none bg-surface-container border-[1.5px] border-outline-variant rounded-xl pl-3 pr-6 py-1.5 font-sans font-bold text-tab-label text-on-surface-variant bg-[url('data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23a99c86%22 stroke-width=%222.3%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_6px_center] bg-[length:9px]"
          >
            <option value="">{t('dimCategoryOption')}</option>
            {currentTags.map((tg) => (
              <option key={tg.code} value={tg.code}>
                {tagLabel(tg, lang)}
              </option>
            ))}
          </select>
        )}

        {shares.length === 0 ? (
          <p className="text-center text-body-md text-on-surface-variant py-8">{t('noRecordsThisMonth')}</p>
        ) : (
          <div className="flex flex-col items-center py-2">
            <div className="relative w-48 h-48 mb-3">
              <DonutRing shares={shares.map((s) => ({ key: s.catCode, color: s.color, ratio: s.ratio }))} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-sans text-on-surface-variant uppercase">
                  {tab === 'expense' ? t('donutExpenseTitle') : t('donutIncomeTitle')}
                </span>
                <span className={`font-serif text-stat-figure ${tab === 'expense' ? 'text-expense' : 'text-income'}`}>
                  {formatCurrency(total, currency)}
                </span>
              </div>
            </div>

            <ScrollLegendList key={`${tab}-${dimTagCode ?? ''}-${resetKey ?? ''}`}>
              <div className="flex flex-col gap-y-2 w-full px-2 mt-2">
                {shares.map((share) => (
                  <button
                    key={share.catCode}
                    type="button"
                    onClick={() => {
                      if (selectedTag) {
                        onSelectTagGroup?.({
                          tagCode: selectedTag.code,
                          tagExclude: share.catCode === '__other__',
                          tagLabelText: share.label,
                          type: tab,
                        })
                      } else {
                        onSelectCategory?.(share.catCode, tab)
                      }
                    }}
                    // B-13：点击图例的选中/按压反馈——照旧App.legend-row.clickable-legend
                    // 真实样式搬：按下时用这一行分类自己的颜色轻轻染一下背景(不是通用的
                    // opacity变暗)，圆角+左右负margin把按压区域撑得比内容宽一点
                    style={{ '--legend-bg': activeTintColor(share.color, 0.22) } as CSSProperties}
                    className="flex items-center gap-3 py-1 px-1.5 -mx-1.5 rounded-[10px] border-b border-dashed border-outline-variant/30 text-left transition-colors active:bg-[var(--legend-bg)]"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: share.color }} />
                    <span className="text-body-md text-on-surface flex-1 truncate">{share.label}</span>
                    {/* 百分比/金额字号+对齐照旧App .legend-row .pct/.amt真实样式：固定宽度右对齐避免
                        位数不同时错位，颜色按支出/收入(tab)着色而不是各分类自己的颜色 */}
                    <span className="text-xs text-on-surface-variant w-[42px] text-right shrink-0">
                      {Math.round(share.ratio * 100)}%
                    </span>
                    <span
                      className="font-serif text-[13px] tabular-nums w-[82px] text-right shrink-0"
                      style={{ color: tab === 'expense' ? 'var(--color-primary)' : 'var(--color-secondary)' }}
                    >
                      {formatCurrency(share.amount, currency)}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollLegendList>
          </div>
        )}
      </div>
    </section>
  )
}
