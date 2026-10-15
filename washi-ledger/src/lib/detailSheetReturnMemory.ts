/** B-66：详情弹层点编辑/复制，会先关掉弹层再跳转到/add，返回时(不保存，点返回)
 * 应该重新打开发起这次编辑/复制的详情弹层，而不是直接落回列表页——之前完全没有
 * 这层记忆，/add的返回键固定navigate(-1)，详情弹层已经被关掉，只能落回最外层
 * 列表页，丢失上下文。
 *
 * 一次性的模块级信号，跟dashboardFocusMemory.ts同样"读取即消费"的模式：
 * - origin：标记是哪个入口发起的(仪表盘/仪表盘的分类钻取弹层/明细页/统计页的
 *   分类钻取弹层/日历页)，消费方只认自己对应的origin，不会误吃别处的信号
 * - entryId：要重新定位的那条记录
 * - categorySelection：只有dashboard-category/stats-category两个入口才用——这两处
 *   详情弹层嵌套在CategoryDetailSheet分类钻取弹层里面，而DashboardPage/StatsPage
 *   跳转/add时会整个卸载重新挂载(跟dashboardFocusMemory.ts踩过的坑一样)，
 *   CategoryDetailSheet的开关状态(选中了哪个分类)也会丢，所以要把当时选中的
 *   分类筛选条件(DashboardPage的DetailSelection对象/StatsPage的detailCatCode
 *   字符串)一起存下来，回来后先用它重新张开CategoryDetailSheet，再把entryId
 *   转发给CategoryDetailSheet自己的消费逻辑(用initialViewEntryId prop传下去，
 *   不是让CategoryDetailSheet自己也调一次consume——避免两处都想读同一份memory
 *   产生谁先读到的竞争) */
export type DetailSheetOrigin = 'dashboard' | 'dashboard-category' | 'history' | 'stats-category' | 'calendar'

interface DetailSheetReturnMemory {
  origin: DetailSheetOrigin
  entryId: string
  categorySelection?: unknown
}

let memory: DetailSheetReturnMemory | null = null

export function setDetailSheetReturnMemory(origin: DetailSheetOrigin, entryId: string, categorySelection?: unknown): void {
  memory = { origin, entryId, categorySelection }
}

/** 只有origin匹配才会真的消费(清空)并返回，不匹配原样保留给其它消费方，
 * 避免DashboardPage/CategoryDetailSheet谁先挂载谁先吃掉的竞争问题 */
export function consumeDetailSheetReturnMemory(origin: DetailSheetOrigin): DetailSheetReturnMemory | null {
  if (!memory || memory.origin !== origin) return null
  const m = memory
  memory = null
  return m
}

/** AddTransactionPage新建(FAB进来，mode==='add')保存成功时调用——新建没有"来源
 * 详情弹层"可言，这里只是防御性清空，避免残留的旧memory被误用 */
export function clearDetailSheetReturnMemory(): void {
  memory = null
}

/** R-XX：编辑/复制保存成功后调用——不再像原来那样保存成功就clearDetailSheetReturnMemory()
 * 把这套"重新打开详情弹层"机制让给取消/返回专用，而是让保存成功也走同一套机制(回去后
 * 一样重新弹出详情弹层，只是内容已经是保存后的新数据)。编辑复用原来记的id不用改；
 * 复制生成的是一条全新id的记录，要把这里记的entryId换成新记录的，origin/
 * categorySelection原样保留不变 */
export function updateDetailSheetReturnMemoryEntryId(entryId: string): void {
  if (memory) memory = { ...memory, entryId }
}
