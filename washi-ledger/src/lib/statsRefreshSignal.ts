/** R-42：统计页新增"+"记一笔/编辑/复制入口后，保存成功跳回统计页要求"同时刷新页面"——
 * 统计页展示的是图表汇总，不像仪表盘/明细页有具体某一行可以高亮定位，所以这里只是
 * 一个"下次挂载时该不该强制刷新一次"的布尔信号，一次性消费 */
let needsRefresh = false

export function markStatsNeedsRefresh(): void {
  needsRefresh = true
}

export function consumeStatsNeedsRefresh(): boolean {
  const v = needsRefresh
  needsRefresh = false
  return v
}
