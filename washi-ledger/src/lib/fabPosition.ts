/** 悬浮按钮拖拽后的位置——真正跨App重启持久化(localStorage)，照dateRangeStorage.ts
 * 同一套"try/catch包一层、读到脏数据当不存在处理"的写法。存的是右下角像素偏移
 * (right/bottom，单位px)，不是绝对左上角坐标——这样能跟按钮原本"贴右下角"的默认
 * 定位方式(CSS right/bottom)保持同一套坐标系，不用来回换算。
 *
 * 抽成通用函数(不是每个按钮各写一份)，按key分开存——汇率按钮(rateFabPosition.ts)、
 * 合并的新建+汇率按钮(mainFabPosition.ts)各自是独立的一份位置记忆，不共用同一个key */
export interface FabPosition {
  right: number
  bottom: number
}

export function loadFabPosition(key: string): FabPosition | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FabPosition>
    if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return null
    if (!Number.isFinite(parsed.right) || !Number.isFinite(parsed.bottom)) return null
    return { right: parsed.right, bottom: parsed.bottom }
  } catch (e) {
    console.error(`读取悬浮按钮位置本地存储失败(${key})`, e)
    return null
  }
}

export function saveFabPosition(key: string, pos: FabPosition): void {
  try {
    localStorage.setItem(key, JSON.stringify(pos))
  } catch (e) {
    console.error(`写入悬浮按钮位置本地存储失败(${key})`, e)
  }
}
