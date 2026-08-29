import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDayPinned, matchesEntrySearch } from '../../data/summary'
import { EntryCard } from './EntryCard'
import { dayLabel } from './dayLabel'
import type { Category, Entry, PaymentMethod, Tag } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  tags: Tag[]
  paymentMethods: PaymentMethod[]
  /** 搜索关键词——受控，状态实际存在DashboardPage(不是这个组件自己的useState)，
   * 因为goToAdd()跳转去新建/编辑/复制页面之前要能读到当前搜索词存进
   * dashboardFocusMemory，返回时才能把它还原回来(不然这个App路由结构下，每次
   * 去/add再回来DashboardPage都会整个卸载重挂载，组件内部state留不住) */
  search: string
  onSearchChange: (value: string) => void
  onViewAll?: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  /** 新建/编辑/复制保存后跳回仪表盘，要定位/高亮到这条记录——见
   * lib/dashboardFocusMemory.ts，DashboardPage挂载后consume一次传下来 */
  focusEntryId?: string | null
}

export function RecentEntriesList({
  entries,
  categories,
  tags,
  paymentMethods,
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
  // 点一条记录展开操作抽屉(编辑/复制/删除)，照design-assets-v2/_44的"Expanded Action Drawer"，
  // 同一时间只展开一条，不用给每条记录单独维护一个boolean状态
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
            <span className="material-symbols-outlined text-[16px]">search</span>
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
        {groups.map((group) => (
          <div key={group.date}>
            <div className="mt-3 mb-1">
              <span className="inline-block bg-surface-variant text-on-surface-variant text-[10px] font-sans px-2 py-1 rounded-md">
                {dayLabel(group.date, t)}
              </span>
            </div>
            {group.entries.map((entry) => {
              const cat = categories.find((c) => c.code === entry.catCode)
              const pm = paymentMethods.find((p) => p.code === entry.paymentMethod)
              return (
                <EntryCard
                  key={entry.id}
                  id={`entry-${entry.id}`}
                  highlighted={focusEntryId === entry.id}
                  entry={entry}
                  category={cat}
                  paymentMethod={pm}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onDelete={onDelete}
                />
              )
            })}
          </div>
        ))}
      </div>
      )}
    </section>
  )
}
