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
