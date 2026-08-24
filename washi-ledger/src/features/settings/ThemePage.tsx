import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { useSettings } from '../../hooks/useSettings'
import type { ThemeSkin } from '../../types'

/** 主题选择——独立整屏子页面，照design-assets-v2/_25的Bento卡片布局做。_25设计稿画了
 * "Midnight Ink/Forest Moss/Ocean Glass"另外三套配色，这些在真实代码里没有实现，照旧编
 * 几张能点但点了没有真实效果的假卡片会误导用户，所以没有照抄设计稿字面内容，只做真实
 * 存在的主题。R-14之前整个App只有一套视觉，这里曾经只放"当前唯一主题"的占位卡片；
 * R-14新增"怀旧"主题后改成真的可以点选切换，两张卡都有效。
 *
 * 预览色块直接写死两套主题各自的真实hex值，不能用var(--color-*)——那些变量此刻反映的
 * 是"当前已生效"的主题，不管点开这页时选的是哪个，两张卡的CSS变量取值会是同一份，
 * 预览就失去意义了；这两组hex要跟index.css里:root默认值/:root[data-theme="nostalgia"]
 * 覆盖值手动保持一致。 */
const THEME_PREVIEWS: Record<ThemeSkin, { primary: string; surface: string; outlineVariant: string }> = {
  default: { primary: '#d1665a', surface: '#fff8f5', outlineVariant: '#dcc0bc' },
  nostalgia: { primary: '#d1665a', surface: '#f7f1e7', outlineVariant: '#e7dcc4' },
}

export function ThemePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { settings, update } = useSettings()

  const cards: { skin: ThemeSkin; nameKey: 'themeDefaultName' | 'themeNostalgiaName' }[] = [
    { skin: 'default', nameKey: 'themeDefaultName' },
    { skin: 'nostalgia', nameKey: 'themeNostalgiaName' },
  ]

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface paper-grid-bg overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center px-md h-16 w-full shrink-0 bg-surface border-b-[1.5px] border-dashed border-outline-variant">
        <button
          type="button"
          aria-label={t('backLabel')}
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center font-serif text-headline-md text-on-surface tracking-tight -ml-10">
          {t('themeLabel')}
        </h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-md pt-lg">
        <div className="flex justify-center gap-md flex-wrap">
          {cards.map(({ skin, nameKey }) => {
            const active = settings.themeSkin === skin
            const preview = THEME_PREVIEWS[skin]
            return (
              <button
                key={skin}
                type="button"
                onClick={() => update({ themeSkin: skin })}
                className={`w-32 text-center rounded-xl border-[1.5px] p-3 flex flex-col items-center gap-2 shadow-sm transition-colors ${
                  active ? 'border-dashed border-primary bg-surface-container-highest' : 'border-outline-variant bg-surface-container-lowest'
                }`}
              >
                <div className="w-full aspect-[9/16] rounded-lg overflow-hidden border border-outline-variant shadow-inner flex flex-col gap-1">
                  <div className="h-1/2 w-full" style={{ background: preview.primary }} />
                  <div className="h-1/2 w-full flex">
                    <div className="h-full w-1/2" style={{ background: preview.surface }} />
                    <div className="h-full w-1/2" style={{ background: preview.outlineVariant }} />
                  </div>
                </div>
                <span className="text-body-md text-on-surface leading-tight">{t(nameKey)}</span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    active ? 'bg-primary text-on-primary' : 'bg-transparent border border-outline-variant text-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
