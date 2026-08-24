import { createContext, useContext, useState, type ReactNode } from 'react'

interface DrawerContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

/** 左侧抽屉的展开状态(R-18)——之前是AppLayout组件内部的本地useState，每个页面各自
 * 独立的AppLayout实例互不相干。汇率/设置/about这三个"从抽屉进来的子页面"改成不再
 * 渲染抽屉本身(没有汉堡按钮可以重新打开它)、左上角换成返回按钮，要求"返回后保持
 * 左侧抽屉展开的样式，停留页面为展开之前所在的那个页面"——这就要求"抽屉是否展开"
 * 这个状态要跨路由跳转存活：从Dashboard打开抽屉(open=true)→点"汇率换算"跳到/rate
 * (Dashboard连同它那个AppLayout实例一起卸载)→在/rate点返回→回到Dashboard，此时
 * open这个值如果是存在AppLayout本地state里的，早就跟着上一个实例一起被卸载重置
 * 成false了。提到App根节点用Context共享，naturally"记得"上一次的展开状态。 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <DrawerContext.Provider value={{ open, setOpen }}>{children}</DrawerContext.Provider>
}

export function useDrawer() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer必须在DrawerProvider内使用')
  return ctx
}
