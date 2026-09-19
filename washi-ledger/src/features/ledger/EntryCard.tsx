import { useState } from 'react'
import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { useSettings } from '../../hooks/useSettings'
import { formatCurrency } from '../../data/currencyDisplay'
import { catLabel, subLabel, payLabel } from '../../lib/catalogLabel'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import { getReceiptSignedUrl } from '../../data/receiptStorage'
import { ReceiptPreviewSheet } from './ReceiptPreviewSheet'
import type { Category, Entry, PaymentMethod } from '../../types'

/** R-32续：レシート凭证常驻角标图标——用户从Stitch的8款变体里选定No.06
 * "右上折角(Dog-ear)纸张质感"，线条从设计稿1:1量取转换成viewBox 0 0 36 49的
 * 干净坐标(原设计稿以圆心为原点，这里整体平移+18/+28归零)。stroke用currentColor，
 * 颜色由调用处的文字色(var(--color-primary))决定，不在图标内部写死颜色 */
function ReceiptStampIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 49"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M0 4 C0 2 2 0 4 0 H25 L36 11 V49 L30 45 L24 49 L18 45 L12 49 L6 45 L0 49 Z" strokeWidth={2.6} />
      <path d="M25 0 V11 H36" strokeWidth={2.2} />
      <line x1={8} y1={19} x2={25} y2={19} strokeWidth={2.2} />
      <line x1={8} y1={27} x2={28} y2={27} strokeWidth={2.2} />
      <line x1={8} y1={35} x2={20} y2={35} strokeWidth={2.2} />
    </svg>
  )
}

interface EntryCardProps {
  entry: Entry
  category?: Category
  paymentMethod?: PaymentMethod
  expanded: boolean
  onToggle: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  /** DOM id，配合仪表盘"保存后定位到这条记录"用scrollIntoView找它——只有
   * RecentEntriesList(仪表盘)会传，明细页不需要 */
  id?: string
  /** 仪表盘新建/编辑/复制保存后跳回来，需要有个视觉提示告诉用户"就是这条"，
   * 短暂高亮几秒后自动退场 */
  highlighted?: boolean
}

/** 单条记账记录的可展开卡片(点击展开编辑/复制/删除操作抽屉)，照design-assets-v2/_44的
 * "Expanded Action Drawer"实现。仪表盘的最近记录列表和明细页的完整列表共用这个组件，
 * 避免同一段UI在两个页面各写一遍。编辑/复制/删除操作现在只在仪表盘提供(用户明确
 * 要求"全放在首页操作")，明细页不传onEdit/onCopy/onDelete这三个handler，下面按
 * 有没有传来决定要不要显示对应按钮/整个操作抽屉——不是靠调用方各自维护一份不同的
 * 卡片实现 */
export function EntryCard({
  entry,
  category,
  paymentMethod,
  expanded,
  onToggle,
  onEdit,
  onCopy,
  onDelete,
  id,
  highlighted,
}: EntryCardProps) {
  const { t, lang } = useI18n()
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const [receiptBusy, setReceiptBusy] = useState(false)
  // R-32续：查看凭证改成App内弹层展示(ReceiptPreviewSheet)，取代之前
  // window.open(url,'_blank')直接跳出系统浏览器——用户反馈"外跳不好"。签名URL有
  // 时效性，previewUrl只在弹层实际打开期间持有，不长期缓存
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isIncome = entry.type === 'income'
  // R-32续：查看凭证从"展开抽屉里的第4个按钮"改成卡片右上角常驻角标(骑缝章)，
  // 单独一次点击直接弹出预览，不再占用展开抽屉的位置，也不再计入hasActions——
  // 明细页(HistoryEntryList不传onEdit/onCopy/onDelete)如果只是因为有凭证才能展开，
  // 现在角标本身已经能直接点开预览，展开抽屉对这种卡片就没有存在的意义了
  const hasReceipt = !!entry.receiptPath
  const hasActions = !!(onEdit || onCopy || onDelete)

  async function handleViewReceipt() {
    if (!entry.receiptPath || receiptBusy) return
    setReceiptBusy(true)
    try {
      const url = await getReceiptSignedUrl(entry.receiptPath)
      setPreviewUrl(url)
      setPreviewOpen(true)
    } catch (e) {
      console.error('查看レシート凭证失败', e)
    } finally {
      setReceiptBusy(false)
    }
  }
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
          不用关心具体是哪一种角)，レシート角标作为.entry-card的直接子元素、绝对定位，
          天然不受这层内部裁切影响，能探出卡片边框外
          R-XH：这层wrapper是个普通<div>，不是flex容器——之前<button>直接是.entry-card
          (flex flex-col)的子元素时，靠flex子元素默认的align-items:stretch自动撑满宽度；
          套进这层普通div之后<button>脱离了flex-stretch上下文，退回浏览器默认的"按内容
          收缩宽度"，分类名短/没有支付方式标签的行按钮整体变窄，金额虽然还贴在按钮右边
          但按钮右边不等于卡片右边，看起来就是"各行金额没对齐"——这是当时漏加w-full
          导致的真实回归，用户真机截图揪出来的，补上w-full找回原来的满宽行为 */}
      <div className="overflow-hidden rounded-[inherit]">
        <button
          type="button"
          className="w-full flex items-center p-3 text-left"
          onClick={hasActions ? onToggle : undefined}
        >
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
                {entry.note && <span className="text-xs text-on-surface-variant truncate">{entry.note}</span>}
              </div>
            )}
          </div>
          <p
            className="font-serif text-entry-amount shrink-0 ml-2"
            style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)' }}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(entry.amount, entry.currency)}
          </p>
        </button>

        {expanded && hasActions && (
          <div className="flex items-center justify-around py-2 px-md bg-surface-container-low border-t border-dashed border-outline-variant/30">
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

      {/* R-32续：レシート凭证常驻角标——"骑缝章"效果，圆心压在卡片右上角边框线上，
          一半在卡片内一半探出卡片外(Stitch设计稿确认稿No.06图标+此定位)。
          stopPropagation()避免跟上面主体的展开/收起点击冲突；只有hasReceipt才渲染，
          背景/描边用color-mix(in srgb, var(--color-primary) ...)跟随var(--color-primary)，
          三套主题(default/nostalgia/summer)颜色各不相同，这样自动跟着对应主题走，
          不用为每个主题单独判断颜色(color-mix在这个代码库里已经是索性用开的既有写法，
          见index.css大量同类用法)。
          按钮本体是44×44px的透明热区(iOS HIG最小点击尺寸44×44pt，这是Stitch设计稿里
          明确写的要求，之前漏做了)，视觉上看到的32px圆章只是内层一个span，热区比
          视觉图形大一圈但居中对齐，不会看起来"点偏了"——外层44px的定位数值(-top-4
          -right-3.5)是反推出来的：让内层32px圆章视觉位置跟之前单纯32px按钮时完全一样。
          悬浮阴影(boxShadow)+summer主题呼吸光晕，照抄RateShortcutFab(同样是"小圆形
          常驻浮标"这个类型，不是SettingsPage行那种列表内icon，跟IconEffects.tsx的
          RingIconEffect不是同一挂——那一套是给ICON_GLYPHS里有形状数据的图标用的，
          这个角标是Stitch给的自定义线条图标，没有登记进那个glyph库，直接复用
          RateShortcutFab同款的阴影数值/光晕渐变颜色(rgba(232,93,74,...)是summer主题
          --color-primary的真实rgb值，只在summer分支渲染，硬编码没有跨主题风险，
          见RateShortcutFab.tsx同款注释)+呼吸关键帧(rate-fab-breathe，见index.css)，
          不是另起一套新数值 */}
      {hasReceipt && (
        <button
          type="button"
          aria-label={t('receiptViewAria')}
          title={t('receiptViewAria')}
          disabled={receiptBusy}
          onClick={(e) => {
            e.stopPropagation()
            handleViewReceipt()
          }}
          className="absolute -top-4 -right-3.5 z-10 w-11 h-11 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
        >
        <span
          className="relative w-8 h-8 rounded-full flex items-center justify-center border-[1.5px]"
          style={{
            borderColor: 'var(--color-primary)',
            background: 'color-mix(in srgb, var(--color-primary) 15%, white)',
            color: 'var(--color-primary)',
            boxShadow: '0 3px 10px -4px rgba(0,0,0,.3)',
          }}
        >
          {isSummer && (
            <span
              aria-hidden="true"
              className="receipt-badge-glow absolute rounded-full pointer-events-none"
              style={{
                inset: -8,
                background: 'radial-gradient(circle, rgba(232, 93, 74, 0.45) 0%, rgba(232, 93, 74, 0) 70%)',
              }}
            />
          )}
          <ReceiptStampIcon className="relative z-[1] w-4 h-4" />
        </span>
        </button>
      )}
      <ReceiptPreviewSheet open={previewOpen} url={previewUrl} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}
