import pointCoinIcon from '../../assets/icons/point-coin.png'

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

/** 用户在调整工具里量出来的最终确认数值，按192px舞台量的，等比缩到真实40px徽章 */
const STAGE = 192
const POSITIONS: Record<'cashMode' | 'pointMode', { cash: Pos; coin: Pos }> = {
  cashMode: { cash: { left: 44, top: 40, width: 122, height: 86 }, coin: { left: 30, top: 68, width: 79, height: 85 } },
  pointMode: { cash: { left: 23, top: 63, width: 122, height: 86 }, coin: { left: 69, top: 36, width: 79, height: 85 } },
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
  const pos = POSITIONS[mode === 'cash' ? 'cashMode' : 'pointMode']
  const isCashActive = pos.cash.top > pos.coin.top
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
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onToggle}
      className="relative w-10 h-10 -mr-2 rounded-full overflow-hidden transition-transform hover:scale-[1.06] active:scale-[0.96]"
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
  )
}
