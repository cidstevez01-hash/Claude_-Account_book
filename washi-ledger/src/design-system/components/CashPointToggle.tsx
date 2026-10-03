import type { CSSProperties } from 'react'
import pointCoinIcon from '../../assets/icons/point-coin.png'
import { useSettings } from '../../hooks/useSettings'

/** 現金图标——Material Symbols真实"payments"字形的SVG path，不是自己画的近似图形
 * (来源：fonts.gstatic.com短期release版，跟项目里.material-symbols-outlined字体
 * 渲染出来的payments字形逐像素比对过完全一致) */
const CASH_PATH =
  'M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm440 240H120q-33 0-56.5-23.5T40-240v-440h80v440h680v80ZM280-400v-320 320Z'

interface Pos {
  left: number
  top: number
  width: number
  height: number
}

/** 用户在调整工具里量出来的最终确认数值，按192px舞台量的，等比缩到真实40px徽章。
 * 这两套数值本身只是"两个图标的两种摆位"，跟現金/積分哪个该亮没有天然对应关系——
 * 下面apply时才按"左下角固定高亮"规则接到真正的页面mode上(真机验证时曾经接反过，
 * 现金内容显示时徽章却是积分图标亮，所以这里特意写清楚注释，不要再弄反) */
const STAGE = 192
const CASH_BOTTOM_LEFT: { cash: Pos; coin: Pos } = {
  cash: { left: 23, top: 63, width: 122, height: 86 },
  coin: { left: 69, top: 36, width: 79, height: 85 },
}
const POINT_BOTTOM_LEFT: { cash: Pos; coin: Pos } = {
  cash: { left: 44, top: 40, width: 122, height: 86 },
  coin: { left: 30, top: 68, width: 79, height: 85 },
}

interface CashPointToggleProps {
  mode: 'cash' | 'point'
  onToggle: () => void
  ariaLabel: string
}

/** 日历页"現金/積分"切换徽章——40px圆形按钮，底色用当前主题surface-container-highest。
 * 两个图标(现金/积分)叠压摆放，哪个位置在左下角哪个就固定是前层+高亮，跟模式名没有
 * 直接绑定关系(是用户明确纠正过的规则：不是"现金模式=现金亮"，是"左下角那个亮")。
 * 现金用真实payments图标(currentColor描边，能跟随主题色)；积分用去背景光晕/阴影后的
 * 硬币堆叠图(栅格图没法用currentColor，用filter:grayscale做未激活态) */
export function CashPointToggle({ mode, onToggle, ariaLabel }: CashPointToggleProps) {
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const pos = mode === 'cash' ? CASH_BOTTOM_LEFT : POINT_BOTTOM_LEFT
  const isCashActive = mode === 'cash'
  const scale = (v: number) => (v / STAGE) * 40

  const cashStyle = {
    left: scale(pos.cash.left),
    top: scale(pos.cash.top),
    width: scale(pos.cash.width),
    height: scale(pos.cash.height),
    zIndex: isCashActive ? 2 : 1,
    opacity: isCashActive ? 1 : 0.55,
    color: isCashActive ? 'var(--color-primary)' : 'var(--color-outline)',
  }
  const coinStyle = {
    left: scale(pos.coin.left),
    top: scale(pos.coin.top),
    width: scale(pos.coin.width),
    height: scale(pos.coin.height),
    zIndex: isCashActive ? 1 : 2,
    opacity: isCashActive ? 0.45 : 1,
    filter: isCashActive ? 'grayscale(1)' : 'none',
  }

  return (
    <span className="relative inline-block w-10 h-10 -mr-2">
      {/* R-29同款光效(.icon-ring-glow)——贴着圆形外沿发光。.icon-ring-glow自身用
          inset:-13px(固定像素，不受--icon-size影响——那个变量只控制mask渐变起点，
          不控制发光层整体尺寸，之前改--icon-size没用就是因为搞错了这点)，发光层尺寸
          = 它的定位父容器尺寸+26px。如果直接挂在40px的按钮容器上，发光层有66px宽，
          这个按钮紧贴屏幕右边缘(-mr-2)，66px的光晕会直接探出视口外被截断(真机截图
          发现，实测超出页头390px宽度3.5px)。改成单独包一层28px的定位容器(照抄
          AppLayout.tsx头像同一个位置已验证过不会溢出的尺寸)、绝对定位居中贴在
          40px徽章正中间，发光层挂在这个28px容器上(变成54px，贴着徽章边缘但不会
          再探出屏幕) */}
      {isSummer && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <span className="relative w-7 h-7">
            <span className="icon-ring-glow" style={{ '--icon-size': '28px' } as CSSProperties} />
          </span>
        </span>
      )}
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onToggle}
        className="relative z-[1] w-10 h-10 rounded-full overflow-hidden transition-transform hover:scale-[1.06] active:scale-[0.96]"
        style={{ background: 'var(--color-surface-container-highest)' }}
      >
        <span className="absolute transition-[left,top,width,height,opacity,color] duration-300 ease-out" style={cashStyle}>
          <svg viewBox="0 -960 960 960" className="w-full h-full block">
            <path fill="currentColor" d={CASH_PATH} />
          </svg>
        </span>
        <img
          src={pointCoinIcon}
          alt=""
          className="absolute object-contain block transition-[left,top,width,height,opacity,filter] duration-300 ease-out"
          style={coinStyle}
        />
      </button>
    </span>
  )
}
