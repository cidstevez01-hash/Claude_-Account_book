/** 仪表盘"进新建/编辑/复制页面之前该记住什么、回来后该怎么定位"——一次性的
 * 模块级信号，跟lib/historyViewMemory.ts同样的模式，读取即消费，不是持久记忆：
 * - focusEntryId：保存成功后要定位/高亮到这条新建/编辑/复制出来的记录
 * - scrollTop：进入这几个页面之前仪表盘的滚动位置，点"返回"(不保存，取消)
 *   没有具体记录可高亮时，退回到这个位置而不是弹回顶部
 * - search：R-22加了"最近记录"搜索框之后新增——这个状态原来放在RecentEntriesList
 *   组件内部的useState，但这个App路由结构是各页面独立(不是共享Outlet布局)，跳去
 *   /add再返回时DashboardPage会整个卸载重新挂载，组件内部state留不住，跟scrollTop
 *   一样的坑，所以搬进这份memory一起管。用户确认过：搜索词无条件保留(不管保存成功
 *   与否)，哪怕保存/编辑出来的那条记录不满足当前搜索词、定位不到，也不自动清空
 *   搜索——用户自己有感知，要看就自己清空搜索框(方案B，不做静默清空或提示条)
 * 三者不是互斥关系——DashboardPage在点新建/编辑/复制跳转前先调
 * saveDashboardScrollTop/saveDashboardSearch记下当时的位置和搜索词，
 * AddTransactionPage.tsx只有真的保存成功时才额外调setDashboardFocusEntryId盖一层
 * "具体要定位到哪条"的信号，所以要用同一份memory对象合并写入，不能互相覆盖掉对方 */
interface DashboardReturnMemory {
  focusEntryId?: string
  scrollTop?: number
  search?: string
}

let memory: DashboardReturnMemory | null = null

export function saveDashboardScrollTop(scrollTop: number): void {
  memory = { ...memory, scrollTop }
}

export function saveDashboardSearch(search: string): void {
  memory = { ...memory, search }
}

export function setDashboardFocusEntryId(id: string): void {
  memory = { ...memory, focusEntryId: id }
}

export function consumeDashboardReturnMemory(): DashboardReturnMemory | null {
  const m = memory
  memory = null
  return m
}
