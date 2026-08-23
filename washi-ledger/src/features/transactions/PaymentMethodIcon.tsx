import type { ReactElement } from 'react'
import amazonLogo from '../../assets/payment-brands/amazon.svg'
import rakutenLogo from '../../assets/payment-brands/rakuten.svg'
import merpayLogo from '../../assets/payment-brands/pm-merpay.png'
import paidyLogo from '../../assets/payment-brands/pm-paidy.png'
import suicaLogo from '../../assets/payment-brands/pm-suica.png'
import { mapGenericPaymentMethodIcon } from '../../lib/iconMap'
import { useI18n } from '../../lib/i18n'
import { payLabel } from '../../lib/catalogLabel'
import type { PaymentMethod } from '../../types'

// 品牌logo原样保留(不走Material Symbols字体)——照旧仓库index.html的BRAND_LOGO_RASTER/
// BRAND_LOGO_COLORS取出来的真实资源，amazon/rakuten是矢量(取出SVG path单独存成文件)，
// merpay/paidy/suica是位图(从base64解码存成png)。
const BRAND_LOGOS: Record<string, string> = {
  'pm-amazon': amazonLogo,
  'pm-rakuten': rakutenLogo,
  'pm-merpay': merpayLogo,
  'pm-paidy': paidyLogo,
  'pm-suica': suicaLogo,
}

/** 现金/信用卡/银行转账不是具体品牌、没有真实Logo，但旧App没有让它们退化成单色线框图标，
 * 而是手绘了实心多色SVG(照旧仓库index.html的MULTI_TONE_PM_ICONS+#ic-pm-cash/#ic-pm-credit/
 * #ic-pm-bank symbol原样搬颜色/路径数值)，视觉上跟amazon/rakuten这些真实品牌色图标统一，
 * 不是巧合般地比其它支付方式"灰一截" */
const MULTI_TONE_ICONS: Record<string, ReactElement> = {
  'pm-cash': (
    <>
      <rect x="2" y="6.5" width="20" height="11" rx="2.2" fill="#7a9b6e" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#eef3ea" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="1" fill="#eef3ea" />
    </>
  ),
  'pm-credit': (
    <>
      <rect x="2" y="5.2" width="20" height="13.6" rx="2.4" fill="#C23B3B" />
      <rect x="2" y="9" width="20" height="2.8" fill="#8C2222" />
      <rect x="4.5" y="14" width="6" height="2" rx="1" fill="#fbe9e9" />
    </>
  ),
  'pm-bank': (
    <>
      <path d="M3.2 9.6 12 4.4l8.8 5.2" fill="none" stroke="#c99a3a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="10" width="16" height="8" rx="1" fill="#e3b23c" />
      <rect x="6" y="11.6" width="1.5" height="4.8" fill="#fdf6e6" />
      <rect x="10.3" y="11.6" width="1.5" height="4.8" fill="#fdf6e6" />
      <rect x="14.6" y="11.6" width="1.5" height="4.8" fill="#fdf6e6" />
      <rect x="3.5" y="18.4" width="17" height="1.6" fill="#a97c22" />
    </>
  ),
}

interface PaymentMethodIconProps {
  method: PaymentMethod
  size?: number
}

export function PaymentMethodIcon({ method, size = 20 }: PaymentMethodIconProps) {
  const { lang } = useI18n()
  // 有徽章配置(badge_bg/badge_text)的优先显示徽章——照旧仓库pmIconHtml()的优先级
  if (method.badge) {
    return (
      <span
        className="inline-flex items-center justify-center rounded font-bold text-white shrink-0"
        style={{ background: method.badge.bg, width: size, height: size, fontSize: size * 0.4, lineHeight: 1 }}
      >
        {method.badge.text}
      </span>
    )
  }
  const brandLogo = method.icon ? BRAND_LOGOS[method.icon] : undefined
  if (brandLogo) {
    return (
      <img
        src={brandLogo}
        alt={payLabel(method, lang)}
        className="shrink-0 rounded-sm object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  const multiTone = method.icon ? MULTI_TONE_ICONS[method.icon] : undefined
  if (multiTone) {
    return (
      <svg viewBox="0 0 24 24" className="shrink-0" style={{ width: size, height: size }}>
        {multiTone}
      </svg>
    )
  }
  const genericIcon = mapGenericPaymentMethodIcon(method.icon)
  return (
    <span
      className="material-symbols-outlined shrink-0 text-on-surface-variant"
      style={{ fontSize: size }}
    >
      {genericIcon ?? 'account_balance_wallet'}
    </span>
  )
}
