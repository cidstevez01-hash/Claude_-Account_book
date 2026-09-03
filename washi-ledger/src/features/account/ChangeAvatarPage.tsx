import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { useI18n } from '../../lib/i18n'
import { AVATAR_PRESETS } from '../../lib/avatarPresets'
import { loadAvatarId, saveAvatarId } from '../../lib/avatarStorage'

/** 更换头像——R-XX照Stitch"更换头像(第1版)"设计稿做：顶部当前头像预览+"从相册选择"
 * 入口(这次先隐藏，自定义上传是后续需求)+4列预设头像网格+底部"保存"按钮。
 * 头像本体只是本机偏好(avatarStorage.ts)，不接入useSettings.tsx那套Supabase同步——
 * 这次需求范围就是"挑个预设图案"，没有"跨端同步头像"这条，不为此改user_settings表。 */
export function ChangeAvatarPage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [initialId] = useState(() => loadAvatarId())
  const [selectedId, setSelectedId] = useState(initialId)
  const current = AVATAR_PRESETS.find((p) => p.id === selectedId) ?? AVATAR_PRESETS[0]

  function handleSave() {
    saveAvatarId(selectedId)
    navigate(-1)
  }

  return (
    <AppLayout title={t('changeAvatarTitle')} leftButton="back">
      <div className="px-md pt-lg pb-xl flex flex-col gap-lg">
        <div className="flex flex-col items-center gap-2">
          {/* 不需要border-primary装饰环——这是预览，不是选择态；选中态的环留在下面
              网格里表示"当前选中哪一个" */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden">
            <img src={current.src} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-body-md text-on-surface-variant">{t('currentAvatarLabel')}</span>
        </div>

        <div>
          <h3 className="text-label-caps font-sans text-on-surface-variant mb-3">{t('choosePresetAvatarLabel')}</h3>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4">
            {AVATAR_PRESETS.map((preset) => {
              const active = preset.id === selectedId
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedId(preset.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="relative w-[60px] h-[60px]">
                    <div
                      className={`w-full h-full rounded-full overflow-hidden transition-shadow ${
                        active ? 'shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-primary)]' : ''
                      }`}
                    >
                      <img src={preset.src} alt="" className="w-full h-full object-cover" />
                    </div>
                    {active && (
                      <div className="absolute -right-0.5 -bottom-0.5 w-[18px] h-[18px] rounded-full bg-primary border-2 border-surface flex items-center justify-center">
                        <span className="material-symbols-outlined text-[10px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-on-surface-variant text-center leading-tight">
                    {lang === 'ja' ? preset.labelJa : preset.labelZh}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="w-full h-12 flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-outline-variant text-on-surface-variant opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">image</span>
          {t('chooseFromAlbumBtn')}
          <span className="text-label-caps">({t('chooseFromAlbumComingSoon')})</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={selectedId === initialId}
          className="w-full h-[58px] bg-primary text-on-primary rounded-xl text-headline-md font-serif active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
        >
          {t('saveEntry')}
        </button>
      </div>
    </AppLayout>
  )
}
