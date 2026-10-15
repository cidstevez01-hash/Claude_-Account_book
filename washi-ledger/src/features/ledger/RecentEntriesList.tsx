import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDayPinned, matchesEntrySearch } from '../../data/summary'
import { formatCurrency } from '../../data/currencyDisplay'
import { EntryCard } from './EntryCard'
import { EntryDetailSheet } from './EntryDetailSheet'
import { dayLabel } from './dayLabel'
import { consumeDetailSheetReturnMemory } from '../../lib/detailSheetReturnMemory'
import { useEntryHighlight } from '../../hooks/useEntryHighlight'
import type { Category, Entry, PaymentMethod, Tag } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  tags: Tag[]
  paymentMethods: PaymentMethod[]
  /** 当日净额的显示币种——调用方(DashboardPage)传入前已经用
   * data/currencyDisplay.ts的toDisplayEntries()把entries统一换算成这个币种了，
   * 这里只管格式化显示，不做换算(照HistoryEntryList.tsx同款currency prop搬) */
  currency: string
  /** 搜索关键词——受控，状态实际存在DashboardPage(不是这个组件自己的useState)，
   * 因为goToAdd()跳转去新建/编辑/复制页面之前要能读到当前搜索词存进
   * dashboardFocusMemory，返回时才能把它还原回来(不然这个App路由结构下，每次
   * 去/add再回来DashboardPage都会整个卸载重挂载，组件内部state留不住) */
  search: string
  onSearchChange: (value: string) => void
  onViewAll?: () => void
  onEdit: (entry: Entry) => void
  onCopy: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  /** 新建/编辑/复制保存后跳回仪表盘，要定位/高亮到这条记录——见
   * lib/dashboardFocusMemory.ts，DashboardPage挂载后consume一次传下来 */
  focusEntryId?: string | null
}

export function RecentEntriesList({
  entries,
  categories,
  tags,
  paymentMethods,
  currency,
  search,
  onSearchChange,
  onViewAll,
  onEdit,
  onCopy,
  onDelete,
  focusEntryId,
}: RecentEntriesListProps) {
  const { t } = useI18n()
  // R-22搜索框放在"最近记录"小标题下方、列表上方。传进来的entries只是按顶部时间
  // 范围筛过，还没经过搜索关键词这一层，这里再叠一层matchesEntrySearch
  const filteredEntries = useMemo(
    () => entries.filter((e) => matchesEntrySearch(e, search, categories, tags, paymentMethods)),
    [entries, search, categories, tags, paymentMethods]
  )
  // 传入的entries已经在DashboardPage按顶部时间范围筛选过了，这里只管排序(照旧App
  // buildDayGroupedHtml的置顶逻辑，见groupByDayPinned的说明)——之前这里还会再截取前
  // limit(=6)条，那是"仪表盘固定显示最近几条"的旧设计；现在顶部有了真正可调的日期
  // 范围，范围内该有多少条就得显示多少条，不然调节范围时列表看起来"没反应"(范围内
  // 已经有6条以上时，不管怎么调都还是那6条)
  const groups = groupByDayPinned(filteredEntries)
  // R-40→R-42：点一条记录直接打开详情弹层(原来点了先展开操作抽屉那套在R-42去掉了，
  // 编辑/复制/删除现在是详情弹层自己头部的图标)
  const [viewEntry, setViewEntry] = useState<Entry | null>(null)
  const { highlightedId, highlightEntry } = useEntryHighlight('entry')

  // B-66→R-XX：从详情弹层点编辑/复制跳去/add后，不管是点返回(不保存)还是保存成功，
  // 都应该重新打开那条记录的详情弹层——DashboardPage跳转/add会整个卸载重挂载，这个
  // 组件自己的viewEntry状态也跟着没了，回来后从detailSheetReturnMemory里找回来。
  // 复制保存后这里的entryId已经被AddTransactionPage换成新记录的id了，而新记录要
  // 等真的同步回本地entries才会出现——用pendingEntryIdRef存住、配合下面依赖entries
  // 的effect持续轮询，不能只在挂载这一刻查一次就放弃(编辑/取消返回因为是老id本来
  // 就在本地缓存里，不受影响，第一次就能查到)
  const pendingEntryIdRef = useRef<string | null>(null)
  useEffect(() => {
    const m = consumeDetailSheetReturnMemory('dashboard')
    if (!m) return
    pendingEntryIdRef.current = m.entryId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const pendingId = pendingEntryIdRef.current
    if (!pendingId) return
    const found = entries.find((e) => e.id === pendingId)
    if (found) {
      setViewEntry(found)
      pendingEntryIdRef.current = null
    }
  }, [entries])

  // B-66：删除确认框现在盖在详情弹层上面而不是先关掉详情弹层(见EntryDetailSheet.tsx
  // handleDelete的说明)，确认删除后entries会把这条记录移除，这里跟着自动关掉详情
  // 弹层，不然会留一个显示着已经不存在的记录的"僵尸"详情弹层
  useEffect(() => {
    if (viewEntry && !entries.some((e) => e.id === viewEntry.id)) setViewEntry(null)
  }, [entries, viewEntry])
  // 搜索框收起/展开——照旧仓库index.html的#ledgerSearch真实交互搬：默认是30x30
  // 圆形虚线图标按钮，点了才展开成圆角矩形(12px，不是整胶囊)。失焦时如果没输入
  // 内容才收起，有内容就保持展开(用户还能看到/清空自己搜的词)
  const [searchExpanded, setSearchExpanded] = useState(false)
  function collapseIfEmpty() {
    if (search.trim() === '') setSearchExpanded(false)
  }

  // 时间范围内本来就一条记录都没有(不是搜索筛没的)——保留原来的"引导记第一笔"大提示，
  // 不显示标题/搜索框，这时候搜什么都没有意义
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 px-md text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">receipt_long</span>
        <p className="text-body-md">{t('emptyLine1')}</p>
        <p className="text-body-md">{t('emptyLine2')}</p>
      </div>
    )
  }

  return (
    <section className="px-md">
      {/* "最近记录"单独一行做标题，下面一行左边"查看全部"、右边搜索——三样东西挤
          一行太挤，拆成两行。搜索展开时"查看全部"不能直接卸载(卸载=瞬间消失，
          一跳一跳的)，也不能只opacity-0(还占着flex布局的位置，搜索框没法真正占满
          整行)——改成一直挂载，但用max-width(不是width:auto，auto没法平滑过渡)从
          一个够宽的固定值(120px，中日文"查看全部"这几个字都装得下)过渡到0，配合
          opacity/margin-right一起变，视觉上是平滑收缩+淡出，不是突然消失；搜索框
          那边flex-1会跟着"查看全部"腾出来的空间同步平滑变宽，两边是同一个过渡时长 */}
      <h3 className="font-serif text-headline-md text-on-surface mb-1">{t('recent')}</h3>
      <div className="flex items-center justify-between mb-3 h-[30px]">
        <button
          type="button"
          onClick={onViewAll}
          className={`shrink-0 overflow-hidden whitespace-nowrap font-sans text-label-caps text-tertiary uppercase tracking-wider transition-[max-width,opacity,margin-right] duration-200 ease-out ${
            searchExpanded ? 'max-w-0 opacity-0 mr-0 pointer-events-none' : 'max-w-[120px] opacity-100 mr-2'
          }`}
        >
          {t('viewAll')}
        </button>
        <div
          className={`relative flex items-center h-[30px] border-[1.5px] border-dashed border-outline-variant bg-surface-container-lowest overflow-hidden transition-[flex-grow,width,border-radius] duration-200 ease-out ${
            searchExpanded ? 'flex-1 rounded-xl' : 'flex-none w-[30px] rounded-full'
          }`}
        >
          <button
            type="button"
            aria-label={t('historySearchPlaceholder')}
            onClick={() => setSearchExpanded(true)}
            className="w-[30px] h-[30px] shrink-0 flex items-center justify-center text-outline"
          >
            <span className="material-symbols-outlined text-[14px]">search</span>
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchExpanded(true)}
            onBlur={collapseIfEmpty}
            placeholder={t('historySearchPlaceholder')}
            className={`min-w-0 bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none transition-opacity ${
              searchExpanded ? 'flex-1 opacity-100 pr-2' : 'w-0 opacity-0'
            }`}
          />
          {searchExpanded && search && (
            <button
              type="button"
              aria-label={t('cancelLabel')}
              onClick={() => onSearchChange('')}
              className="w-[18px] h-[18px] shrink-0 mr-2 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {filteredEntries.length === 0 ? (
        <p className="text-center text-body-md text-on-surface-variant py-8">{t('historyNoResults')}</p>
      ) : (
      <div className="space-y-2">
        {groups.map((group) => {
          // 当日净额——照HistoryEntryList.tsx同款算法(收入+/支出-求和)，group.entries
          // 是筛过关键词之后的结果(见上面filteredEntries)，搜索词一变这里跟着重算，
          // 不用额外处理"检索后要重新计算"这个要求
          const dayNet = group.entries.reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0)
          return (
          <div key={group.date}>
            {/* R-32续：mb-1→mb-4——レシート角标现在会探出卡片顶部最多16px(44×44pt热区)，
                这里跟.entry-card自己的mb-2→mb-4是同一次改动，两处都要跟着调，不然
                当天第一条记录如果带角标，会跟上面这行日期标题的虚线底边撞在一起 */}
            <div className="mt-3 mb-4 flex items-center justify-between">
              <span className="inline-block bg-surface-variant text-on-surface-variant text-[10px] font-sans px-2 py-1 rounded-md">
                {dayLabel(group.date, t)}
              </span>
              <span
                className="font-serif text-stat-figure font-semibold"
                style={{ color: dayNet >= 0 ? 'var(--color-secondary)' : 'var(--color-primary)' }}
              >
                {dayNet >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(dayNet), currency)}
              </span>
            </div>
            {group.entries.map((entry) => {
              const cat = categories.find((c) => c.code === entry.catCode)
              const pm = paymentMethods.find((p) => p.code === entry.paymentMethod)
              return (
                <EntryCard
                  key={entry.id}
                  id={`entry-${entry.id}`}
                  highlighted={focusEntryId === entry.id || highlightedId === entry.id}
                  entry={entry}
                  category={cat}
                  paymentMethod={pm}
                  onOpenDetail={setViewEntry}
                />
              )
            })}
          </div>
          )
        })}
      </div>
      )}
      <EntryDetailSheet
        open={!!viewEntry}
        entry={viewEntry}
        category={viewEntry ? categories.find((c) => c.code === viewEntry.catCode) : undefined}
        paymentMethod={viewEntry ? paymentMethods.find((p) => p.code === viewEntry.paymentMethod) : undefined}
        tag={viewEntry ? tags.find((tg) => tg.code === viewEntry.tagCode) : undefined}
        onClose={() => {
          if (viewEntry) highlightEntry(viewEntry.id)
          setViewEntry(null)
        }}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    </section>
  )
}
