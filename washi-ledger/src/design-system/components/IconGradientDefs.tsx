/** "夏 · 花火"图标效果的唯一颜色来源——共享一份渐变定义，任何效果图标只要fill用
 * url(#icon-fill-grad)引用这一份，改色只用改这一处，图标形状(lib/iconGlyphs.ts)/
 * 发光效果(index.css的.icon-ring-glow等)都不用跟着动。挂在App.tsx根部常驻渲染，
 * 不随路由切换重新创建——同一个id在整个文档里只应该定义一次，多个<svg>各自重复
 * 定义会导致重复id，虽然浏览器仍取第一个生效，但不该依赖这种隐式行为 */
export function IconGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="icon-fill-grad" cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e4ca95" />
          <stop offset="55%" stopColor="#d98668" />
          <stop offset="100%" stopColor="#d67966" />
        </radialGradient>
      </defs>
    </svg>
  )
}
