import { useState } from 'react'
import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { formatCurrency } from '../../data/currencyDisplay'
import { catLabel, subLabel, payLabel } from '../../lib/catalogLabel'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { getReceiptSignedUrl } from '../../data/receiptStorage'
import { ReceiptPreviewSheet } from './ReceiptPreviewSheet'
import type { Category, Entry, PaymentMethod } from '../../types'

interface EntryCardProps {
  entry: Entry
  category?: Category
  paymentMethod?: PaymentMethod
  /** R-42：点击整张卡片直接打开EntryDetailSheet——原来的展开操作抽屉(编辑/复制/
   * 删除/查看详情四个按钮)整个废弃，这几个操作全部挪进详情弹层自己的头部图标，
   * EntryCard不再需要expanded/onToggle/onEdit/onCopy/onDelete这些 */
  onOpenDetail: (entry: Entry) => void
  /** DOM id，配合仪表盘/明细页"保存后定位到这条记录"用scrollIntoView找它 */
  id?: string
  /** 新建/编辑/复制保存后跳回来，需要有个视觉提示告诉用户"就是这条"，
   * 短暂高亮几秒后自动退场 */
  highlighted?: boolean
  /** 日历页积分模式用——右侧金额改显示这笔记录的积分数(entry.points)而不是金额，
   * 不传就是原来的金额展示(其它所有调用处都不传，行为不变) */
  amountDisplay?: 'currency' | 'points'
}

/** 单条记账记录卡片——R-42改版：不再是"点击展开操作抽屉"，点击整张卡片直接打开
 * EntryDetailSheet(查看详情只读弹层，编辑/复制/删除三个图标现在挂在那个弹层自己的
 * 头部，见EntryDetailSheet.tsx)。之前"编辑/复制/删除只在仪表盘提供"这条限制随这次
 * 改版一起取消了——操作入口统一收进详情弹层，复用EntryCard的5个地方(仪表盘/明细页/
 * 日历页/仪表盘和统计页各自的分类钻取弹层)现在都一样，不再需要按调用方传不传
 * handler来决定要不要显示按钮 */
export function EntryCard({ entry, category, paymentMethod, onOpenDetail, id, highlighted, amountDisplay = 'currency' }: EntryCardProps) {
  const { t, lang } = useI18n()
  const isIncome = entry.type === 'income'

  // R-43：恢复卡片右上角"骑缝章"小票角标(2026-09-16定稿，R-41合并进详情弹层时被
  // 删掉)——方便不点进详情弹层就能一眼看出哪条记录带凭证，角标本身也是独立的
  // "快速预览"入口。跟详情弹层里逐行点开单张不同，这里一次性把整条记录的
  // receiptPaths都传给ReceiptPreviewSheet，默认打开第1张，弹层内可以左右切换
  // 查看其余几张(R-41之前是单张receiptPath，角标点了直接原生优先/网页兜底；
  // 现在是多张数组，原生QuickLook插件不支持"1/2"这种自定义页码+左右切换，只能
  // 一次开一个文档，所以角标统一走网页内弹层，不区分张数，保持行为一致可预期)
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false)
  const [receiptIndex, setReceiptIndex] = useState(0)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  async function openReceiptAt(i: number) {
    setReceiptIndex(i)
    setReceiptUrl(null)
    try {
      const url = await getReceiptSignedUrl(entry.receiptPaths[i])
      setReceiptUrl(url)
    } catch (e) {
      console.error('查看レシート凭证失败', e)
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
          不用关心具体是哪一种角) */}
      <div className="overflow-hidden rounded-[inherit]">
        <button type="button" className="w-full flex items-center p-3 text-left" onClick={() => onOpenDetail(entry)}>
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
      </div>

      {/* R-43：角标是.entry-card(relative)的直接子节点，跟上面overflow-hidden的
          裁切容器是兄弟关系而不是嵌套在它里面——这样"一半探出卡片外"才不会被
          overflow-hidden裁掉。不能嵌进上面那个<button>内部(HTML不允许button套
          button)，所以只能放在这里，用stopPropagation()防止点击角标时顺带冒泡
          触发卡片整体的onOpenDetail */}
      {entry.receiptPaths.length > 0 && (
        <button
          type="button"
          aria-label={t('receiptViewAria')}
          onClick={(e) => {
            e.stopPropagation()
            setReceiptPreviewOpen(true)
            openReceiptAt(0)
          }}
          // R-43：定位数值(-top-4 -right-3.5)不是随手写的——2026-09-16历史设计
          // 就反推验证过这组数值，让44px透明热区内居中的32px视觉圆章落在"圆心压在
          // 卡片右上角边框线上，一半在卡片内一半探出卡片外"这个位置，之前随手写的
          // -top-2 -right-2偏了，这次改回历史定稿的数值，不是另起一套
          className="absolute -top-4 -right-3.5 z-10 w-11 h-11 flex items-center justify-center"
        >
          <span
            className="relative w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-md"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-container-lowest) 70%, transparent)',
              border: '1.5px dashed var(--color-primary)',
              color: 'var(--color-primary)',
            }}
          >
            <ThemeIcon icon="receipt_long" effect="ring" size={16} className="text-[16px]" />
          </span>
        </button>
      )}

      <ReceiptPreviewSheet
        open={receiptPreviewOpen}
        url={receiptUrl}
        onClose={() => setReceiptPreviewOpen(false)}
        paths={entry.receiptPaths}
        index={receiptIndex}
        onIndexChange={openReceiptAt}
      />
    </div>
  )
}
