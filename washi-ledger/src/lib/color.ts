/**
 * 分类图标的"浅色底+分类本色图标"配色——照旧仓库index.html的tintColor()原样搬，
 * 算法是把十六进制色值往白色方向按比例混，不是简单调透明度(那样在深色卡片背景下
 * 会露出卡片色而不是纯白，跟旧App视觉对不上)。
 */
export function tintColor(hex: string | undefined, amount: number): string {
  if (!hex || hex[0] !== '#') return 'rgba(209,102,90,0.12)'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = Math.round(r + (255 - r) * amount)
  const ng = Math.round(g + (255 - g) * amount)
  const nb = Math.round(b + (255 - b) * amount)
  return `rgb(${nr},${ng},${nb})`
}
