import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { useSettings } from '../../hooks/useSettings'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { RouteFade } from '../../design-system/components/RouteFade'
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
  // R-29：数值抄自index.css :root[data-theme="summer"]的--color-primary/--color-surface/
  // --color-outline-variant，跟旧App--seal/--paper/--grid对应
  summer: { primary: '#E85D4A', surface: '#101B33', outlineVariant: '#2A3D63' },
}

export function ThemePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { settings, update } = useSettings()
  // B-XX：这页是独立整屏子页面，不走AppLayout.tsx，R-29做summer主题(FireworksBackground
  // 透出来+去掉方格纸背景)那批只改了AppLayout，这页当时漏了——一直是不透明bg-surface+
  // paper-grid-bg，summer下背景变成一片网格纸，跟其它页面(能看到星空烟花)不一致
  const isSummer = settings.themeSkin === 'summer'

  const cards: { skin: ThemeSkin; nameKey: 'themeDefaultName' | 'themeNostalgiaName' | 'themeSummerName' }[] = [
    { skin: 'default', nameKey: 'themeDefaultName' },
    { skin: 'nostalgia', nameKey: 'themeNostalgiaName' },
    { skin: 'summer', nameKey: 'themeSummerName' },
  ]

  return (
    <div
      className={`fixed inset-0 mx-auto max-w-[480px] flex flex-col overflow-hidden ${
        isSummer ? 'bg-transparent' : 'bg-surface'
      }`}
    >
      {/* B-08：paper-grid-bg只贴main(内容滚动区)，不贴根容器——不然顶部安全区(header
          上方没被header遮住的那一小条)会透出方格纹理，跟header纯色背景不一致
          B-XX：summer下safe-area这段padding和header的背景/blur要挂在同一层div上，
          否则真机上能看出两段拼接的接缝(参照AppLayout.tsx同一个修复)
          B-XX：路由切换入场渐显(见AppLayout.tsx的RouteFade说明)——这页是独立整屏
          子页面不走AppLayout，之前一直没有这个效果，切进/退出这页都是硬切 */}
      <RouteFade className="flex flex-col flex-1 min-h-0">
      <div
        style={
          isSummer
            ? {
                paddingTop: 'env(safe-area-inset-top)',
                background: 'color-mix(in srgb, var(--color-surface) 1%, transparent)',
                backdropFilter: 'blur(1px) saturate(150%)',
                WebkitBackdropFilter: 'blur(1px) saturate(150%)',
              }
            : { paddingTop: 'env(safe-area-inset-top)' }
        }
      >
      <header
        className={`flex items-center justify-between px-md h-16 w-full shrink-0 border-b-[1.5px] border-dashed border-outline-variant ${
          isSummer ? '' : 'bg-surface'
        }`}
      >
        <button
          type="button"
          aria-label={t('backLabel')}
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
        >
          <ThemeIcon icon="arrow_back" effect="bare" className="papercut-text-shadow" />
        </button>
        <h1 className="font-serif text-headline-md text-app-title tracking-tight papercut-text-shadow">{t('themeLabel')}</h1>
        {/* B-14根因：原来h1是flex-1+text-center+-ml-10模拟居中，负margin让h1的不可见
            边界盖住了左边返回按钮的可点击区域，按钮"看得到点不动"。改成跟AppLayout.tsx
            同款的"两侧等宽占位+justify-between"布局，不用负margin就不会有点击区域重叠 */}
        <div className="w-10 h-10 -mr-2" />
      </header>
      </div>

      <main
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-md pt-lg ${
          isSummer ? '' : 'paper-grid-bg'
        }`}
      >
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
      </RouteFade>
    </div>
  )
}
