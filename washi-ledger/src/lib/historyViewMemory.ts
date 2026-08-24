/** 明细页(HistoryPage)跨路由的筛选/滚动位置记忆——每次路由切换(比如去记一笔/编辑
 * 页面再回来)HistoryPage组件实例都会被整个卸载再重新挂载(这个App的路由结构是
 * <Routes>各页面各自独立，不是共享Outlet布局)，组件自身的useState记不住上一次
 * 停在哪。这里只是一个模块级别的普通变量(不是React state/Context)，纯粹起"跨
 * unmount的暂存"作用，不需要触发任何组件重渲染，也不需要跨App重启持久化(数据
 * 本来就可能变化，重启后记着旧筛选意义不大)，所以不用localStorage，App进程内
 * 存活即可。 */
export interface HistoryViewMemory {
  startDate: string
  endDate: string
  typeFilter: 'all' | 'expense' | 'income'
  search: string
  scrollTop: number
}

let memory: HistoryViewMemory | null = null

export function loadHistoryViewMemory(): HistoryViewMemory | null {
  return memory
}

export function saveHistoryViewMemory(next: HistoryViewMemory) {
  memory = next
}
