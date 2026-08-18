/**
 * 全局导航/系统级图标统一注册表——用户明确说了图标以后大概率还会变，这张表
 * 是唯一改动点：以后想换某个图标，只改这一个文件，不用去BottomNav/NavDrawer/
 * AppLayout这些组件文件里分别找字符串。
 *
 * 不包含分类图标(见lib/iconMap.ts的mapCategoryIcon，那是从数据库动态数据映射
 * 出来的，跟这里的"App固定chrome图标"是两回事)和支付方式品牌图标(见
 * features/transactions/PaymentMethodIcon.tsx，那些是真实品牌logo图片/svg，
 * 不是Material Symbols字体图标，不适合放进这张纯字符串表)。
 *
 * 图标名对照icon_specification_document.md的Core Icon Map。
 */
export const APP_ICONS = {
  dashboard: 'grid_view',
  history: 'history',
  stats: 'bar_chart',
  // icon_specification_document.md给的是'add_circle'或'edit_square'，但实际设计稿
  // (_44等)FAB按钮本身已经是圆形容器了，图标用的是裸'add'加号，不是自带圆圈的'add_circle'
  // (不然会套娃出两层圆)，照真实设计稿画面来，不是照文档字面
  addTransaction: 'add',
  settings: 'settings',
  rate: 'currency_exchange',
  account: 'person',
  about: 'info',
  menu: 'menu',
} as const

export type AppIconKey = keyof typeof APP_ICONS
