import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import { ThemeIcon } from './ThemeIcon'

// 悬浮胶囊样式——DESIGN.md原文"A floating capsule with a backdrop-filter"。
// 3个tab：仪表盘/明细/统计，设置+汇率不在这里，放左侧抽屉导航(见NavDrawer)。
// 这条规则来自washi_ledger_markdown.md"交互逻辑提醒"一节，详见HANDOFF文档。
// R-29：仪表盘/统计两个tab在"夏 · 花火"主题下换成旧App对应的-fw图标(书本→花束
// 烟花、柱状图→孔明灯，旧App本身就是这样交叉换的，见index.html applyThemeIcons())。
// 明细没有对应的旧App资源(旧App压根没有这个独立tab)——另外找Stitch画了张新的
// (捞金鱼网+游动的金鱼)，ic-history-fw.svg
const items = [
  { to: '/', icon: APP_ICONS.dashboard, fwIcon: '/icons/fw/ic-book-fw.svg', labelKey: 'tabDashboard' as const },
  { to: '/history', icon: APP_ICONS.history, fwIcon: '/icons/fw/ic-history-fw.svg', labelKey: 'tabHistory' as const },
  { to: '/stats', icon: APP_ICONS.stats, fwIcon: '/icons/fw/ic-lantern-fw.svg', labelKey: 'tabStats' as const },
]

/** 记录"上一次停在哪个tab"——必须放在组件外面(模块级)，不能放进组件内部的useRef。
 * React Router在tab之间切换时，是把DashboardPage/HistoryPage/StatsPage整个换掉，这三个
 * 页面又都各自单独套了一层AppLayout(BottomNav就嵌在里面)，等于每切一次tab，BottomNav
 * 这个组件本身就被销毁重建一次——不是同一个实例持续存在。如果"是不是第一次加载"这个
 * 标记存在组件自己的useRef里，每次重建都会被重置，导致动画分支永远判断成"第一次加载"，
 * 只会瞬间摆位、动画代码根本没机会跑。放到模块级变量就不会跟着组件销毁而丢失。 */
let lastActiveTab: string | null = null

/** B-33修的字体加载纠偏只该在整个App会话里生效一次(真冷启动那一次)，不能每次
 * BottomNav重建(=每次切tab)都重跑——document.fonts.ready这个Promise只resolve一次，
 * 第一次切tab之后的每次重建，这个effect(空依赖数组，但组件是全新实例)都会重新
 * 订阅，而这时Promise早就resolve过了，.then()几乎立刻触发，place()又会把正在跑的
 * slideTo()动画cancel掉、瞬间摆位——这正是"切tab从滑动变成瞬移"这个回归的根因。
 * 用同样的模块级变量模式挡住，保证只在这个变量还是false的那一次(=lastActiveTab
 * 还是null、真正的冷启动)才生效，此后切tab不会再被这个effect打断 */
let coldStartFontFixApplied = false

/** 玻璃气泡指示器(#4)——照旧仓库index.html的tabBubble真实实现搬：选中态是一个绝对定位、
 * 跟随active tab左右滑动的毛玻璃色块(见index.css的.tab-bubble)，用Web Animations API
 * 手动摆位/动画，不是CSS transition——切换时先算出"起点∪终点"的并集区域，动画中途先
 * 拉伸盖住经过的中间tab再收回到目标tab的宽度，制造"液态挤压"的观感(跟位移滤镜结合，
 * 透过玻璃看被盖住的图标会有轻微折射变形)。
 *
 * 跟旧App的差异：旧App的tab宽度是内容自适应的固定值(REST_W=78px)，新App的tab是
 * flex-1等宽平分(见BottomNav自身之前的间距自适应改动)，所以气泡宽度改成读取目标
 * 按钮当下的真实渲染宽度，而不是硬编码常量——不然气泡宽度会跟tab本身对不上 */
export function BottomNav() {
  const { t } = useI18n()
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const currentAnimRef = useRef<Animation | null>(null)

  const activeItem =
    items.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))) ??
    items[0]

  function restRectOf(btn: HTMLElement) {
    const navRect = navRef.current!.getBoundingClientRect()
    const r = btn.getBoundingClientRect()
    return { left: r.left - navRect.left, width: r.width }
  }

  function currentRect() {
    const navRect = navRef.current!.getBoundingClientRect()
    const b = bubbleRef.current!.getBoundingClientRect()
    return { left: b.left - navRect.left, width: b.width }
  }

  function place(btn: HTMLElement | null) {
    if (!btn || !bubbleRef.current) return
    if (currentAnimRef.current) {
      currentAnimRef.current.cancel()
      currentAnimRef.current = null
    }
    const { left, width } = restRectOf(btn)
    bubbleRef.current.style.left = `${left}px`
    bubbleRef.current.style.width = `${width}px`
    bubbleRef.current.classList.add('show')
  }

  function slideTo(btn: HTMLElement | null) {
    if (!btn || !bubbleRef.current) return
    const bubble = bubbleRef.current
    const target = restRectOf(btn)
    const cur = bubble.classList.contains('show') ? currentRect() : target
    if (currentAnimRef.current) {
      currentAnimRef.current.cancel()
      currentAnimRef.current = null
    }
    bubble.classList.add('show')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bubble.style.left = `${target.left}px`
      bubble.style.width = `${target.width}px`
      return
    }
    const unionLeft = Math.min(cur.left, target.left)
    const unionRight = Math.max(cur.left + cur.width, target.left + target.width)
    const anim = bubble.animate(
      [
        { left: `${cur.left}px`, width: `${cur.width}px` },
        { left: `${unionLeft}px`, width: `${unionRight - unionLeft}px`, offset: 0.48 },
        { left: `${target.left}px`, width: `${target.width}px` },
      ],
      { duration: 380, easing: 'ease' }
    )
    currentAnimRef.current = anim
    anim.onfinish = () => {
      bubble.style.left = `${target.left}px`
      bubble.style.width = `${target.width}px`
      if (currentAnimRef.current === anim) currentAnimRef.current = null
    }
    anim.oncancel = () => {
      if (currentAnimRef.current === anim) currentAnimRef.current = null
    }
  }

  useLayoutEffect(() => {
    const btn = btnRefs.current[activeItem.to]
    const fromTab = lastActiveTab
    const fromBtn = fromTab ? btnRefs.current[fromTab] : null
    if (fromTab && fromTab !== activeItem.to && fromBtn) {
      // 这个组件实例是刚重建出来的(见上面lastActiveTab的说明)，气泡还没摆过位置；
      // 先把它瞬间摆到"上一个tab"应该在的位置(这个新实例自己也渲染了那个按钮，
      // 位置读得到)，再正常触发滑动动画到当前tab，做出"接着上次动画"的效果
      place(fromBtn)
      slideTo(btn)
    } else {
      place(btn)
    }
    lastActiveTab = activeItem.to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem.to])

  // B-35：冷启动(关闭App重开)时气泡摆位错位——useLayoutEffect里的place()是浏览器
  // 画面绘制前的同步测量，如果这一刻网页字体(日文衬线字体/Material Symbols图标
  // 字体)还没加载完成，量出来的按钮宽度是字体换上之前的临时尺寸，摆位摆的是这个
  // 临时尺寸对应的位置；字体后续异步加载完成后会重新排版变宽，但气泡是写死的
  // 内联left/width，不会跟着自动重新摆位。只会在真冷启动(字体还没被浏览器缓存过)
  // 出现，跟"App内切tab不会错位"这个现象吻合——切tab时字体早就加载完了。
  // 回归修复：document.fonts.ready在字体已经就绪时会立刻resolve——一开始以为这对
  // 热切换场景"无害"，但实际上每次切tab、这个effect(空依赖数组，但组件是全新实例)
  // 都会重新订阅，Promise早就resolve过了，.then()几乎立刻触发，place()会把正在跑
  // 的slideTo()动画cancel掉、瞬间摆位到位——切tab从"滑过去"变成"跳过去"就是这么
  // 回归的。用coldStartFontFixApplied挡住，只在这个effect第一次真正跑起来时生效
  // 一次(对应App这次会话的冷启动)，之后每次切tab重建都会看到这个标记已经是true、
  // 直接跳过，不会再打断正常的滑动动画。
  // activeToRef用来在字体加载这段异步等待期间读到"当时真正生效的tab"，不是effect
  // 创建那一刻闭包住的旧值
  const activeToRef = useRef(activeItem.to)
  useEffect(() => {
    activeToRef.current = activeItem.to
  })
  useEffect(() => {
    if (coldStartFontFixApplied) return
    coldStartFontFixApplied = true
    document.fonts?.ready?.then(() => {
      place(btnRefs.current[activeToRef.current])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onResize() {
      place(btnRefs.current[activeItem.to])
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem.to])

  return (
    <nav
      ref={navRef}
      className="fixed bottom-6 inset-x-0 mx-auto w-[90%] max-w-[400px] z-50
                 flex items-center px-lg py-xs
                 bg-surface/80 backdrop-blur-md border border-white/20 rounded-full shadow-lg"
    >
      <div ref={bubbleRef} className="tab-bubble" />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          ref={(el) => {
            btnRefs.current[item.to] = el
          }}
          className={({ isActive }) =>
            `relative z-[1] flex-1 flex flex-col items-center gap-1 py-2 transition-colors active:opacity-60 ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <ThemeIcon
                icon={item.icon}
                fw={item.fwIcon}
                className="w-6 h-6"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              />
              <span className="text-tab-label font-sans font-normal">{t(item.labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
