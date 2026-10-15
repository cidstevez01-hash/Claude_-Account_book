import { useState } from 'react'

/** R-XX：编辑/复制保存后改落到详情弹层而不是列表+高亮(见AddTransactionPage.tsx
 * handleSave的说明)，"列表定位高亮"这个动作挪到了"关闭详情弹层"这一步——不分这条
 * 记录是不是刚编辑/复制过，只要是从详情弹层关闭/返回回列表，就定位高亮这条记录。
 * 这个时候entry一定已经在本地entries里(打开详情弹层看的就是它)，不用像新建那样
 * 等服务端同步，直接查DOM定位即可。
 *
 * 被RecentEntriesList/HistoryEntryList/CalendarPage/两个CategoryDetailSheet共5处
 * 复用——idPrefix用来避免分类钻取弹层打开时跟仪表盘自己RecentEntriesList里同一条
 * entry的DOM id撞车(那边还在DOM里没卸载，只是被盖住)：钻取弹层内部的卡片用
 * 'cat-entry'前缀，跟外层列表的'entry'前缀区分开，不会互相定位错 */
export function useEntryHighlight(idPrefix = 'entry') {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  function highlightEntry(id: string) {
    requestAnimationFrame(() => {
      document.getElementById(`${idPrefix}-${id}`)?.scrollIntoView({ block: 'center' })
      setHighlightedId(id)
      window.setTimeout(() => {
        setHighlightedId((cur) => (cur === id ? null : cur))
      }, 2000)
    })
  }

  return { highlightedId, highlightEntry }
}
