import { AppLayout } from '../../design-system/components/AppLayout'
import { useI18n } from '../../lib/i18n'

/** 关于——R-19照Stitch"关于我们（PigBang版）"设计稿重做。跟设计稿的差异：
 * 1. 去掉设计稿里"Terms of Service"/"Privacy Policy"/"Rate the App"这类链接
 *    (没有真实条款页/应用商店上架，点进去是死链接，延续原页面就定下的原则)。
 * 2. 版本号不是设计稿里编的"Version 1.0.4 (Build 2026)"假值，是接入vite.config.ts
 *    的__APP_VERSION__，取package.json真实版本号(照CLAUDE.md"不编假版本号"的原则)。
 * 3. Logo用design-assets/icons/washi-ledger-app-icon/final/里用户已确认的真实PigBang
 *    图标(设计稿里那张图就是这个)，拷贝进public/pigbang-logo.jpg引用，不是外链Google URL。
 */
export function AboutPage() {
  const { t } = useI18n()
  return (
    <AppLayout title={t('aboutTitle')} leftButton="back">
      <div className="flex flex-col items-center px-md pt-xl pb-lg">
        <img
          src="/pigbang-logo.jpg"
          alt="PigBang"
          className="w-32 h-32 mb-md rounded-[2rem] shadow-sm border-b-2 border-outline-variant object-cover"
        />
        <h1 className="font-serif text-headline-lg text-primary tracking-tight mb-2">PigBang</h1>
        <div className="inline-flex items-center px-3 py-1 bg-surface-container-high rounded-full border border-dashed border-outline-variant mb-lg">
          <span className="text-label-caps text-on-surface-variant uppercase tracking-wider">v{__APP_VERSION__}</span>
        </div>

        <div className="relative w-full bg-surface-container/50 rounded-2xl p-lg border border-dashed border-outline-variant shadow-sm">
          <div className="absolute -top-3 -left-3 w-8 h-4 bg-tertiary rotate-[-15deg] opacity-80 rounded-sm" />
          <p className="text-body-lg text-on-surface-variant italic leading-relaxed text-center">
            {t('aboutTagline')}
          </p>
        </div>
      </div>

      <div className="text-center text-body-md text-outline mt-lg pb-lg">{t('aboutCopyright')}</div>
    </AppLayout>
  )
}
