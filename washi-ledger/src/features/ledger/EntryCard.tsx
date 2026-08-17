import type { Category, Entry } from '../../types'

interface EntryCardProps {
  entry: Entry
  category?: Category
  expanded: boolean
  onToggle: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

/** 单条记账记录的可展开卡片(点击展开编辑/复制/删除操作抽屉)，照design-assets-v2/_44的
 * "Expanded Action Drawer"实现。仪表盘的最近记录列表和明细页的完整列表共用这个组件，
 * 避免同一段UI在两个页面各写一遍。 */
export function EntryCard({ entry, category, expanded, onToggle, onEdit, onCopy, onDelete }: EntryCardProps) {
  const isIncome = entry.type === 'income'
  return (
    <div className="flex flex-col bg-surface-container-lowest rounded-lg mb-2 border border-outline-variant papercut-shadow overflow-hidden">
      <button type="button" className="flex items-center p-3 text-left" onClick={onToggle}>
        <div
          className="w-[38px] h-[38px] rounded-full border-2 flex items-center justify-center bg-surface-container-highest mr-3 shrink-0"
          style={{ borderColor: isIncome ? 'var(--color-secondary)' : 'var(--color-primary-container)' }}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{
              color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)',
              fontVariationSettings: "'FILL' 1",
            }}
          >
            {isIncome ? 'payments' : category?.icon || 'category'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-lg text-on-surface truncate">{category ? category.zh : entry.note || '—'}</p>
          <p className="text-body-md text-on-surface-variant text-xs truncate">{entry.note || category?.zh || ''}</p>
        </div>
        <p
          className="font-serif text-entry-amount shrink-0 ml-2"
          style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-on-surface)' }}
        >
          {isIncome ? '+' : '-'}¥{entry.amount.toLocaleString()}
        </p>
      </button>

      {expanded && (
        <div className="flex items-center justify-around py-2 px-md bg-surface-container-low border-t border-dashed border-outline-variant/30">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={() => onEdit?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
            <span className="text-[10px] font-sans uppercase">编辑</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={() => onCopy?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">content_copy</span>
            <span className="text-[10px] font-sans uppercase">复制</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-primary"
            onClick={() => onDelete?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            <span className="text-[10px] font-sans uppercase">删除</span>
          </button>
        </div>
      )}
    </div>
  )
}
