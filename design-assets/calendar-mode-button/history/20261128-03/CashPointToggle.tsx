import type { CSSProperties } from 'react'
import type { ThemeSkin } from '../../types'
import pointCoinIcon from '../../icons/assets/point-gift-23.png'
import pointCoinNostalgiaIcon from '../../icons/assets/point-gift-23-nostalgia.png'
import pointCoinSummerIcon from '../../icons/assets/point-gift-23-summer.png'
import pointCoinAutumnIcon from '../../icons/assets/point-gift-23-autumn.png'
import pointCoinWarmIcon from '../../icons/assets/point-gift-23-warm.png'
import pointCoinSilverIcon from '../../icons/assets/point-gift-23-silver.png'
import cashDefaultIcon from '../../icons/assets/cash-gloss-default.png'
import cashNostalgiaIcon from '../../icons/assets/cash-gloss-nostalgia.png'
import cashSummerIcon from '../../icons/assets/cash-gloss-summer.png'
import cashAutumnIcon from '../../icons/assets/cash-gloss-autumn.png'
import cashWarmIcon from '../../icons/assets/cash-gloss-winter.png'
import cashSilverIcon from '../../icons/assets/cash-gloss-winter-silver.png'
import { useSettings } from '../../hooks/useSettings'

/** 已确认的256px透明素材直接使用原字节，避免运行时滤镜改变稿件颜色。
 * 纸币源SVG仍是原payments字形，仅增加受光和浅投影；源稿存design-assets。
 * 两类素材按同一主题配对，切换主题时保持纸币/硬币色阶一致。 */
const THEME_ICONS = {
  default: { cash: cashDefaultIcon, coin: pointCoinIcon },
  nostalgia: { cash: cashNostalgiaIcon, coin: pointCoinNostalgiaIcon },
  summer: { cash: cashSummerIcon, coin: pointCoinSummerIcon },
  autumn: { cash: cashAutumnIcon, coin: pointCoinAutumnIcon },
  winter: { cash: cashWarmIcon, coin: pointCoinWarmIcon },
  'winter-silver': { cash: cashSilverIcon, coin: pointCoinSilverIcon },
} satisfies Record<ThemeSkin, { cash: string; coin: string }>

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
  coin: { left: 70.1, top: 40.1, width: 76.8, height: 76.8 },
}
const POINT_BOTTOM_LEFT: { cash: Pos; coin: Pos } = {
  cash: { left: 44, top: 40, width: 122, height: 86 },
  coin: { left: 31.1, top: 72.1, width: 76.8, height: 76.8 },
}

interface CashPointToggleProps {
  mode: 'cash' | 'point'
  onToggle: () => void
  ariaLabel: string
}

/** 日历页"現金/積分"切换徽章——40px圆形按钮，底色用当前主题surface-container-highest。
 * 两个图标(现金/积分)叠压摆放，哪个位置在左下角哪个就固定是前层+高亮，跟模式名没有
 * 直接绑定关系(是用户明确纠正过的规则：不是"现金模式=现金亮"，是"左下角那个亮")。
 * 纸币保留真实payments镂空与确认稿光泽；积分采用23号礼物币，六主题配色成对。
 * 积分显示16px，两模式中心与原18px稿一致；原层级/透明度与灰度切换保持。 */
export function CashPointToggle({ mode, onToggle, ariaLabel }: CashPointToggleProps) {
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer' || settings.themeSkin === 'autumn'
  const pos = mode === 'cash' ? CASH_BOTTOM_LEFT : POINT_BOTTOM_LEFT
  const isCashActive = mode === 'cash'
  const { cash: cashIcon, coin: coinIcon } = THEME_ICONS[settings.themeSkin]
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
    <span
      className="relative inline-block w-10 h-10"
      style={{ marginRight: isSummer ? '6.4px' : '-8px' }}
    >
      {/* R-29同款光效(.icon-ring-glow)——贴着圆形外沿发光。.icon-ring-glow自身用
          inset:-13px(固定像素，不受--icon-size影响——那个变量只控制mask渐变起点，
          不控制发光层整体尺寸，之前改--icon-size没用就是因为搞错了这点)，发光层尺寸
          = 它的定位父容器尺寸+26px。如果直接挂在40px的按钮容器上，发光层有66px宽，
          这个按钮紧贴屏幕右边缘，66px的光晕会直接探出视口外被截断(真机截图发现，
          实测超出页头390px宽度3.5px)。改成单独包一层28px的定位容器(照抄
          AppLayout.tsx头像同一个位置已验证过不会溢出的尺寸)、绝对定位居中贴在
          40px徽章正中间，发光层挂在这个28px容器上(变成54px，贴着徽章边缘)。
          B-56续：光晕不溢出之后，真机截图比对又发现左右不对称——返回按钮是"裸"
          效果(.icon-bare-glow，inset:0，跟图标本身一样大=24px，缩在40px按钮内部，
          实际可见光晕离页头左边距≈16.5px)，这个徽章是"有圈"效果(54px，比40px按钮
          更大、向外凸出≈5.9px)，如果两边按钮热区都对称(8px)，实际"肉眼看到的发光
          圆圈"离边距会不对称(左16.5px/右2.1px)——这才是用户画线看到的真实问题，
          不是按钮热区偏了。只在summer主题下把margin从-8px(热区对称，等同原来的
          -mr-2)换成+6.4px(经Playwright实测校准，让发光圆圈的右边距也等于
          16.5px)——非summer主题没有发光层，肉眼只看得到按钮热区本身，这时必须
          保持跟返回按钮一样的-8px，否则会在没有光晕解释的情况下凭空多出一截空隙，
          反而制造新的不对称(这是本轮改之前漏掉的一个坑，改完务必在非夏主题下
          也验证一遍热区距离) */}
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
          <img src={cashIcon} alt="" className="w-full h-full object-contain block" />
        </span>
        <img
          src={coinIcon}
          alt=""
          className="absolute object-contain block transition-[left,top,width,height,opacity,filter] duration-300 ease-out"
          style={coinStyle}
        />
      </button>
    </span>
  )
}
