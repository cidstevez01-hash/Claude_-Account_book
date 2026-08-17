/**
 * 旧仓库index.html里categories/subcategories/payment_methods表的icon字段存的是
 * 旧App自己那套手绘SVG图标编号(比如'bowl'渲染成<use href="#ic-bowl">)，不是Material
 * Symbols图标名——新App统一用Material Symbols字体，所以要把旧编号翻译成语义对应的
 * Material Symbols图标名，保留"这个分类一直用这个图标概念"，只换渲染技术。
 *
 * 旧编号全集来自旧仓库index.html里所有`id="ic-xxx"`的symbol定义(grep核对过)。
 * 颜色(color字段)是十六进制色值，直接透传不用转换。
 */
const CATEGORY_ICON_MAP: Record<string, string> = {
  bowl: 'restaurant',
  car: 'directions_car',
  bus: 'directions_bus',
  house: 'home',
  shirt: 'checkroom',
  gift: 'redeem',
  briefcase: 'work',
  basket: 'shopping_basket',
  box: 'inventory_2',
  bulb: 'lightbulb',
  cap: 'school',
  controller: 'sports_esports',
  doc: 'description',
  envelope: 'mail',
  party: 'celebration',
  question: 'help',
  shield: 'shield',
  star: 'star',
  tag: 'sell',
  trend: 'trending_up',
  wallet: 'account_balance_wallet',
  wifi: 'wifi',
  bank: 'account_balance',
  bill: 'receipt_long',
  book: 'menu_book',
  building: 'apartment',
  card: 'credit_card',
  coin: 'paid',
  chart: 'bar_chart',
  exchange: 'currency_exchange',
  gear: 'settings',
  alarm: 'alarm',
}

/**
 * 支付方式图标——'cash'/'credit'/'bank'这几个是通用概念，能找到对应Material Symbols。
 * 'amazon'/'rakuten'这两个不行——旧App里这两个是真实品牌logo的SVG路径(不是概念图标)，
 * Material Symbols字体里没有品牌logo，翻译不出对应关系。这两个先退回到一个通用的
 * "钱包/商店"图标占位，具体怎么处理品牌识别(比如靠payment_methods表本来就有的
 * badge_bg/badge_text徽章颜色+文字来区分，不一定需要图标本身还原品牌)，需要用户确认，
 * 已经在下面单独提出来问了，不要自己下结论。
 */
const PAYMENT_METHOD_ICON_MAP: Record<string, string> = {
  cash: 'payments',
  credit: 'credit_card',
  bank: 'account_balance',
  amazon: 'storefront', // 占位，见上面注释，需要用户确认
  rakuten: 'storefront', // 占位，见上面注释，需要用户确认
}

export function mapCategoryIcon(oldIconId: string): string {
  return CATEGORY_ICON_MAP[oldIconId] ?? 'category'
}

export function mapPaymentMethodIcon(oldIconId: string | undefined | null): string {
  if (!oldIconId) return 'account_balance_wallet'
  return PAYMENT_METHOD_ICON_MAP[oldIconId] ?? 'account_balance_wallet'
}
