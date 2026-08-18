/**
 * 字体/字号/字重参考表——照旧仓库index.html里各真实CSS选择器的font-family/
 * font-size/font-weight原样整理，不是凭感觉定的。新App各组件的className应该照这张表
 * 对号入座，改字体相关问题时先查这里，不用再回去翻index.html全文。
 *
 * 新App用Tailwind的`--text-*`token定size(见index.css的@theme)，family用
 * `font-serif`/`font-sans`，weight目前Tailwind没有做成token，只能每处手写
 * `font-normal`/`font-medium`/`font-semibold`/`font-bold`这类工具类——这张表就是
 * 用来对照该写哪一个，避免像之前那样凭感觉给标签栏/切换按钮都套了偏重的font-semibold/
 * font-bold，结果比旧App实际效果粗一整级。
 *
 * 字重速查(Tailwind类 → 数值)：font-normal=400 font-medium=500 font-semibold=600
 * font-bold=700。Noto Sans SC只加载了400/500/600(见index.css的Google Fonts导入)，
 * Noto Serif SC只加载了500/600/700——写font-weight前先确认对应字重真的被加载了，
 * 不然浏览器会拿最近的已加载字重做"合成粗体"(synthetic bold)，看起来会比正常字重更粗/糊。
 */
export const TYPOGRAPHY_REFERENCE = {
  // 页面大标题(AppLayout header h1)——旧App .header h1
  pageTitle: { family: 'serif', weight: 700, size: '26px', token: 'text-headline-lg', tailwind: 'font-serif text-headline-lg font-bold' },
  // 弹层/子页面标题(如ConfirmDialog/CategoryDetailSheet的h2)——旧App .sheet h2(浏览器h2默认加粗，等效700)
  sheetTitle: { family: 'serif', weight: 700, size: '19px', token: 'text-headline-md', tailwind: 'font-serif text-headline-md font-bold' },
  // 仪表盘大额结余数字——旧App .balance-amount
  heroBalance: { family: 'serif', weight: 700, size: '38px', token: 'text-hero-balance', tailwind: 'font-serif text-hero-balance font-bold' },
  // 记一笔金额大输入框——旧App .amount-input-wrap input
  amountInput: { family: 'serif', weight: 600, size: '32px', token: 'text-input-amount', tailwind: 'font-serif text-input-amount font-semibold' },
  // 本月收入/支出统计数字——旧App .stat .val
  statFigure: { family: 'serif', weight: 600, size: '18px', token: 'text-stat-figure', tailwind: 'font-serif text-stat-figure font-semibold' },
  // 按日分组的当日合计——旧App .day-header .day-total
  dayTotal: { family: 'serif', weight: 700, size: '16px', token: 'text-entry-amount', tailwind: 'font-serif text-entry-amount font-bold' },
  // 单条记账记录的金额——旧App .entry .amount
  entryAmount: { family: 'serif', weight: 600, size: '16px', token: 'text-entry-amount', tailwind: 'font-serif text-entry-amount font-semibold' },
  // 单条记账记录的"分类·子分类"标题——旧App .entry .cat
  entryTitle: { family: 'sans', weight: 500, size: '15px', token: 'text-body-lg', tailwind: 'font-sans text-body-lg font-medium' },
  // 支付方式徽章/备注小字——旧App .pay-badge / .note-text，均无weight override即默认400
  entryMeta: { family: 'sans', weight: 400, size: '12px', token: 'text-body-md', tailwind: 'font-sans text-body-md font-normal' },
  // 底部导航标签文字——旧App .tab-btn，无weight override即默认400(选中态.tab-btn.active
  // 只变color，不变粗细，别再套font-semibold/font-bold)
  tabLabel: { family: 'sans', weight: 400, size: '11px', token: 'text-tab-label', tailwind: 'font-sans text-tab-label font-normal' },
  // 展开操作抽屉的"编辑/复制/删除"小字——旧App .action-btn .lb，无weight override
  actionLabel: { family: 'sans', weight: 400, size: '10px', tailwind: 'font-sans text-[10px] font-normal' },
  // 收支/类型切换的segment按钮——旧App .segment button，选中态.segment button.active也只变
  // 背景/文字色，不加粗，别再套font-bold
  segmentButton: { family: 'sans', weight: 400, size: '14px', token: 'text-body-md', tailwind: 'font-sans text-body-md font-normal' },
  // 字段标签(分类/支付方式/金额等field-label)——旧App .field-label，无weight override
  fieldLabel: { family: 'sans', weight: 400, size: '12px', token: 'text-label-caps', tailwind: 'font-sans text-label-caps font-normal' },
  // 分类网格下方的小字标签——旧App .cat-btn .lb(400)/.cat-btn.selected .lb(600，选中态才加粗)
  categoryGridLabel: { family: 'sans', weightDefault: 400, weightSelected: 600, size: '11px', tailwind: 'font-sans text-[11px]' },
} as const
