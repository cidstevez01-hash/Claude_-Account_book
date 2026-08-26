/** 仪表盘"进新建/编辑/复制页面之前该记住什么、回来后该怎么定位"——一次性的
 * 模块级信号，跟lib/historyViewMemory.ts同样的模式，读取即消费，不是持久记忆：
 * - focusEntryId：保存成功后要定位/高亮到这条新建/编辑/复制出来的记录
 * - scrollTop：进入这几个页面之前仪表盘的滚动位置，点"返回"(不保存，取消)
 *   没有具体记录可高亮时，退回到这个位置而不是弹回顶部
 * 两者不是互斥关系——DashboardPage在点新建/编辑/复制跳转前先调
 * saveDashboardScrollTop记下当时的位置，AddTransactionPage.tsx只有真的保存
 * 成功时才额外调setDashboardFocusEntryId盖一层"具体要定位到哪条"的信号，
 * 所以要用同一份memory对象合并写入，不能互相覆盖掉对方 */
interface DashboardReturnMemory {
  focusEntryId?: string
  scrollTop?: number
}

let memory: DashboardReturnMemory | null = null

export function saveDashboardScrollTop(scrollTop: number): void {
  memory = { ...memory, scrollTop }
}

export function setDashboardFocusEntryId(id: string): void {
  memory = { ...memory, focusEntryId: id }
}

export function consumeDashboardReturnMemory(): DashboardReturnMemory | null {
  const m = memory
  memory = null
  return m
}
