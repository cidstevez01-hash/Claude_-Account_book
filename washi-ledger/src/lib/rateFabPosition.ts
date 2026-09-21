/** 汇率悬浮按钮(RateShortcutFab)拖拽后的位置——真正跨App重启持久化(localStorage)，
 * 照dateRangeStorage.ts同一套"try/catch包一层、读到脏数据当不存在处理"的写法。
 * 存的是右下角像素偏移(right/bottom，单位px)，不是绝对左上角坐标——这样能跟组件
 * 原本"贴右下角"的默认定位方式(CSS right/bottom)保持同一套坐标系，不用来回换算 */
export interface RateFabPosition {
  right: number
  bottom: number
}

const KEY = 'washi_ledger_rate_fab_position_v1'

export function loadRateFabPosition(): RateFabPosition | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RateFabPosition>
    if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return null
    if (!Number.isFinite(parsed.right) || !Number.isFinite(parsed.bottom)) return null
    return { right: parsed.right, bottom: parsed.bottom }
  } catch (e) {
    console.error('读取汇率悬浮按钮位置本地存储失败', e)
    return null
  }
}

export function saveRateFabPosition(pos: RateFabPosition): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos))
  } catch (e) {
    console.error('写入汇率悬浮按钮位置本地存储失败', e)
  }
}
