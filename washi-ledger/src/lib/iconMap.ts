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
  cross: 'medical_services',
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
 * 支付方式图标——'pm-cash'/'pm-credit'/'pm-bank'这三个是通用概念，直接映射到对应
 * Material Symbols就够了。'pm-amazon'/'pm-rakuten'/'pm-merpay'/'pm-paidy'/'pm-suica'
 * 这五个不行——旧App里这些是真实品牌logo(amazon/rakuten是彩色SVG路径，merpay/
 * paidy/suica是真实品牌logo的PNG图片，从旧仓库index.html里的BRAND_LOGO_RASTER常量
 * 解码出来存到src/assets/payment-brands/)，Material Symbols字体没有品牌logo可以
 * 对应。用户明确要求保留真实图标——这五个不走这张映射表，改用
 * features/transactions/PaymentMethodIcon.tsx组件特殊渲染(品牌SVG/图片而不是字体)。
 */
const PAYMENT_METHOD_GENERIC_ICON_MAP: Record<string, string> = {
  'pm-cash': 'payments',
  'pm-credit': 'credit_card',
  'pm-bank': 'account_balance',
}

export function mapCategoryIcon(oldIconId: string): string {
  return CATEGORY_ICON_MAP[oldIconId] ?? 'category'
}

/** 只给"通用概念"支付方式图标用——品牌图标不经过这个函数，见上面注释 */
export function mapGenericPaymentMethodIcon(oldIconId: string | undefined): string | null {
  if (!oldIconId) return null
  return PAYMENT_METHOD_GENERIC_ICON_MAP[oldIconId] ?? null
}
