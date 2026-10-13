/** R-42：明细页(出入金)新增"+"记一笔/编辑/复制入口后，保存成功跳回明细页需要
 * 跟仪表盘(见dashboardFocusMemory.ts)一样，能定位/高亮到刚新建/编辑/复制出来的
 * 那条记录——一次性信号，读取即消费，不是持久记忆。明细页的筛选/滚动位置已经由
 * historyViewMemory.ts单独管了，这里只管"该高亮哪条" */
let focusEntryId: string | undefined

export function setHistoryFocusEntryId(id: string): void {
  focusEntryId = id
}

export function consumeHistoryFocusEntryId(): string | undefined {
  const id = focusEntryId
  focusEntryId = undefined
  return id
}
