import { AppLayout } from '../../design-system/components/AppLayout'
import { useI18n } from '../../lib/i18n'

/** 关于——照design-assets-v2/_19做，但去掉了"Version 2.4.1"(washi-ledger这个重写
 * 分支还没接入旧仓库CLAUDE.md那套版本号体系，编一个假版本号不如不写)、
 * "Terms of Service"/"Privacy Policy"/"Rate the App"这三行(没有真实条款页面/应用商店
 * 上架，点进去是死链接，不如不做)。只留下真实存在的内容：App名字+介绍+落款 */
export function AboutPage() {
  const { t } = useI18n()
  return (
    <AppLayout title={t('aboutTitle')} leftButton="back">
      <div className="flex flex-col items-center px-md pt-xl pb-lg text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary-fixed flex items-center justify-center mb-md">
          <span className="material-symbols-outlined text-4xl text-primary">menu_book</span>
        </div>
        <h1 className="font-serif text-headline-lg text-primary mb-2">Washi Ledger</h1>
        <p className="text-body-lg text-on-surface-variant max-w-[280px]">
          {t('aboutTagline')}
        </p>
      </div>

      <div className="text-center text-body-md text-outline mt-lg pb-lg">© 2026 Washi Ledger</div>
    </AppLayout>
  )
}
