import { loadFabPosition, saveFabPosition, type FabPosition } from './fabPosition'

/** 合并的"新建+汇率"悬浮按钮(MainActionFab)拖拽后的位置——跟rateFabPosition.ts
 * 是同一套存取逻辑(见fabPosition.ts)，key不一样，两个按钮的拖拽位置互不影响 */
export type MainFabPosition = FabPosition

const KEY = 'washi_ledger_main_fab_position_v1'

export function loadMainFabPosition(): MainFabPosition | null {
  return loadFabPosition(KEY)
}

export function saveMainFabPosition(pos: MainFabPosition): void {
  saveFabPosition(KEY, pos)
}
