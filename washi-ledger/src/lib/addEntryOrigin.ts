/** R-42："+"记一笔按钮/编辑/复制入口现在三大页签(仪表盘/明细/统计)都有了，
 * AddTransactionPage保存成功后"该怎么收尾"要按发起页面分流：仪表盘保持原有的
 * dashboardFocusMemory高亮定位，明细页一样做高亮定位(见historyFocusMemory.ts)，
 * 统计页则是标记"下次回去要刷新数据"(见statsRefreshSignal.ts)。这个模块就是这三者
 * 共用的"发起页是谁"信号——跳转去/add之前(FAB点击、详情弹层编辑/复制按钮)由发起页
 * 自己调setAddEntryOrigin()写一下，AddTransactionPage.tsx的handleSave保存成功那一刻
 * 消费掉、决定分流到哪一条收尾逻辑。
 *
 * 默认值'other'（不是某个具体页面）——日历页、以及两个分类钻取弹层目前都没有被
 * 要求做这套特殊收尾，不显式调用setAddEntryOrigin()的话就保持'other'，
 * handleSave收到'other'时什么收尾信号都不发，只是单纯navigate(-1)，这是最安全的
 * 缺省行为，不会把"仪表盘要高亮哪条"这种信号错发给不相关的页面 */
export type AddEntryOrigin = 'dashboard' | 'history' | 'stats' | 'other'

let origin: AddEntryOrigin = 'other'

export function setAddEntryOrigin(next: AddEntryOrigin): void {
  origin = next
}

export function consumeAddEntryOrigin(): AddEntryOrigin {
  const current = origin
  origin = 'other'
  return current
}
