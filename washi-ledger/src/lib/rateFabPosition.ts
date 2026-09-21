import { loadFabPosition, saveFabPosition, type FabPosition } from './fabPosition'

/** 汇率悬浮按钮(RateShortcutFab)拖拽后的位置——具体存取逻辑见fabPosition.ts，这里只是
 * 绑定固定key的薄封装，调用方(RateShortcutFab.tsx)不用关心key字符串本身 */
export type RateFabPosition = FabPosition

const KEY = 'washi_ledger_rate_fab_position_v1'

export function loadRateFabPosition(): RateFabPosition | null {
  return loadFabPosition(KEY)
}

export function saveRateFabPosition(pos: RateFabPosition): void {
  saveFabPosition(KEY, pos)
}
