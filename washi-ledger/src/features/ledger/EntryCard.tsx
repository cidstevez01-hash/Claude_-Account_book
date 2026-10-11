import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { formatCurrency } from '../../data/currencyDisplay'
import { catLabel, subLabel, payLabel } from '../../lib/catalogLabel'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import type { Category, Entry, PaymentMethod } from '../../types'

interface EntryCardProps {
  entry: Entry
  category?: Category
  paymentMethod?: PaymentMethod
  expanded: boolean
  onToggle: () => void
  /** R-40：查看详情——5个复用EntryCard的地方(仪表盘/我的账户和统计页的分类钻取弹层/
   * 明细页/日历页)全部开放，是必传的基础功能，不像onEdit/onCopy/onDelete那样可选 */
  onView: (entry: Entry) => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  /** DOM id，配合仪表盘"保存后定位到这条记录"用scrollIntoView找它——只有
   * RecentEntriesList(仪表盘)会传，明细页不需要 */
  id?: string
  /** 仪表盘新建/编辑/复制保存后跳回来，需要有个视觉提示告诉用户"就是这条"，
   * 短暂高亮几秒后自动退场 */
  highlighted?: boolean
  /** 日历页积分模式用——右侧金额改显示这笔记录的积分数(entry.points)而不是金额，
   * 不传就是原来的金额展示(其它所有调用处都不传，行为不变) */
  amountDisplay?: 'currency' | 'points'
}

/** 单条记账记录的可展开卡片(点击展开查看详情/编辑/复制/删除操作抽屉)，照
 * design-assets-v2/_44的"Expanded Action Drawer"实现。仪表盘的最近记录列表和明细页的
 * 完整列表共用这个组件，避免同一段UI在两个页面各写一遍。编辑/复制/删除操作只在仪表盘
 * 提供(用户明确要求"全放在首页操作")，明细页/日历页/分类钻取弹层不传这三个handler，
 * 下面按有没有传来决定要不要显示对应按钮；R-40续：查看详情没有这个限制，5处全部开放，
 * 所以点击展开抽屉这个交互本身现在总是生效的，不再像之前那样只在有编辑/复制/删除时
 * 才响应点击(hasActions这个判断已经去掉) */
export function EntryCard({
  entry,
  category,
  paymentMethod,
  expanded,
  onToggle,
  onView,
  onEdit,
  onCopy,
  onDelete,
  id,
  highlighted,
  amountDisplay = 'currency',
}: EntryCardProps) {
  const { t, lang } = useI18n()
  const isIncome = entry.type === 'income'
  // "分类·子分类"——照旧App renderEntry()的catLine真实格式(有子分类才拼，没有就只显示分类)；
  // 名字按当前语言取(catLabel/subLabel)，不是硬编码.zh
  const sub = category?.subs.find((s) => s.code === entry.subCode)
  const title = category
    ? sub
      ? `${catLabel(category, lang)} · ${subLabel(sub, lang)}`
      : catLabel(category, lang)
    : entry.note || '—'
  return (
    <div
      id={id}
      className={`entry-card relative flex flex-col bg-surface-container-lowest mb-4 transition-shadow duration-500 ${
        highlighted ? 'ring-2 ring-primary' : ''
      }`}
    >
      {/* R-32续：overflow-hidden从外层.entry-card本体挪到这个内层wrapper——.entry-card
          自己的圆角是靠:nth-child(odd/even)交替出18px/8px不对称角，外层要是直接套一层
          新的<div>包起来，.entry-card会变成永远是自己那层wrapper的第1个子元素，nth-child
          交替规律就全废了。改成外层.entry-card不变(还是列表里直接相邻的那个元素，
          交替规律不受影响)，只在内部单独包一层裁切容器(rounded-[inherit]跟随外层圆角，
          不用关心具体是哪一种角) */}
      <div className="overflow-hidden rounded-[inherit]">
        <button type="button" className="w-full flex items-center p-3 text-left" onClick={onToggle}>
          <div
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center mr-3 shrink-0"
            style={{ background: category ? tintColor(category.color, 0.85) : 'var(--color-surface-container-highest)' }}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                color: category ? category.color : 'var(--color-on-surface-variant)',
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {category?.icon || (isIncome ? 'payments' : 'category')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans text-body-lg font-medium text-on-surface truncate">{title}</p>
            {/* R-15：账目明细补上支付方式(图标+文字)，照旧App.entry-meta/.pay-badge真实结构——
                支付方式徽标和备注同一行并排展示，不是备注单独占一行 */}
            {(paymentMethod || entry.note) && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {paymentMethod && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant bg-surface-container rounded-md px-1.5 py-px shrink-0">
                    <PaymentMethodIcon method={paymentMethod} size={12} />
                    {payLabel(paymentMethod, lang)}
                  </span>
                )}
                {/* R-XO：flex-wrap容器里flex子项默认min-width是auto(按内容撑开)，
                    单靠truncate(overflow:hidden)不会生效——备注要真的超长省略显示，
                    得让这一项能在行内被压缩到剩余空间以内(min-w-0)才行，不是
                    只加truncate就够 */}
                {entry.note && (
                  <span className="min-w-0 flex-1 text-xs text-on-surface-variant truncate">{entry.note}</span>
                )}
              </div>
            )}
          </div>
          {amountDisplay === 'points' ? (
            <p className="font-serif text-entry-amount shrink-0 ml-2" style={{ color: 'var(--color-tertiary)' }}>
              +{entry.points ?? 0}
              {t('calendarPointsUnit')}
            </p>
          ) : (
            <p
              className="font-serif text-entry-amount shrink-0 ml-2"
              style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)' }}
            >
              {isIncome ? '+' : '-'}
              {formatCurrency(entry.amount, entry.currency)}
            </p>
          )}
        </button>

        {expanded && (
          <div className="flex items-center justify-around py-2 px-md bg-surface-container-low border-t border-dashed border-outline-variant/30">
            <button
              type="button"
              aria-label={t('viewDetailAria')}
              className="flex flex-col items-center gap-1 text-on-surface-variant active:text-primary active:scale-90 transition-[color,transform]"
              onClick={() => onView(entry)}
            >
              <span className="material-symbols-outlined text-[20px]">visibility</span>
              <span className="text-[10px] font-sans uppercase">{t('viewDetailLabel')}</span>
            </button>
            {onEdit && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 text-on-surface-variant active:text-primary active:scale-90 transition-[color,transform]"
                onClick={() => onEdit(entry)}
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
                <span className="text-[10px] font-sans uppercase">{t('editLabel')}</span>
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 text-on-surface-variant active:text-primary active:scale-90 transition-[color,transform]"
                onClick={() => onCopy(entry)}
              >
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
                <span className="text-[10px] font-sans uppercase">{t('copyLabel')}</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="flex flex-col items-center gap-1 text-primary active:opacity-50 active:scale-90 transition-[opacity,transform]"
                onClick={() => onDelete(entry)}
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
                <span className="text-[10px] font-sans uppercase">{t('deleteLabel')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
