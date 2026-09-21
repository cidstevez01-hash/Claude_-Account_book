import { useEffect, useState } from 'react'

// 视口收缩超过这个才认为是软键盘弹出，不是地址栏收起/来回细微抖动这类噪音
const KEYBOARD_OPEN_THRESHOLD_PX = 80

/** 返回当前软键盘挡住的高度(px)，没弹出时是0——用window.visualViewport的尺寸变化
 * 判断。这个App整体外壳是`position:fixed;inset:0`钉死在视口上的(见AppLayout.tsx的
 * 说明，是为了避免document级滚动/橡皮筋回弹踩过的坑)，真机上iOS键盘弹出时不会让
 * 这套自定义的fixed布局跟着收缩——`<main>`可滚动区域还以为自己有原来那么高，
 * 键盘挡住的那一截内容(比如搜索结果)会悬在键盘底下、浏览器也不会主动帮你把它
 * 滚上来；`fixed bottom:...`的悬浮元素(底部导航栏/悬浮按钮)也会被顶到键盘上方
 * 悬空显示，脱离正常的贴底位置。用visualViewport算出键盘实际挡住的高度，调用方
 * (AppLayout.tsx给<main>加额外底部内边距/BottomNav、RateShortcutFab、MainActionFab
 * 键盘弹出时滑出隐藏)按这个值各自处理，不是每处各写一份判断逻辑 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const diff = window.innerHeight - vv!.height - vv!.offsetTop
      setInset(diff > KEYBOARD_OPEN_THRESHOLD_PX ? diff : 0)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
