/** 新建/编辑/复制保存后回到仪表盘，需要定位/高亮到那一条记录——一次性的模块级
 * 信号，跟lib/historyViewMemory.ts同样的模式：AddTransactionPage保存成功后写入，
 * DashboardPage挂载时读一次就清空(读取即消费，不是持久记忆，不会影响下次正常
 * 进入仪表盘) */
let pendingFocusEntryId: string | null = null

export function setDashboardFocusEntryId(id: string): void {
  pendingFocusEntryId = id
}

export function consumeDashboardFocusEntryId(): string | null {
  const id = pendingFocusEntryId
  pendingFocusEntryId = null
  return id
}
