import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { useAuth } from '../auth/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import type { Lang } from '../../types'

interface SettingsRowProps {
  icon: string
  label: string
  children: React.ReactNode
  onClick?: () => void
}

function SettingsRow({ icon, label, children, onClick }: SettingsRowProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className="w-full flex items-center justify-between p-sm rounded-lg bg-surface-container-lowest border-b-2 border-outline-variant"
    >
      <div className="flex items-center gap-sm">
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className="text-body-lg text-on-surface">{label}</span>
      </div>
      <div className="text-body-md text-on-surface-variant">{children}</div>
    </div>
  )
}

/** 设置页——照design-assets-v2/_18的列表布局做。Currency这项虽然真实存进
 * user_settings.currency(照旧App pushSettingsUpsert逻辑)，但仪表盘/记一笔页
 * 目前还是硬编码显示CNY，还没接到这个设置上——多币种金额展示是更大的一块
 * 工作，这次先只做设置本身的存取，跟数据联动留到以后。Theme这次只有一套
 * Washi Ledger视觉，先做成不可交互的占位行(照types.ts里ThemeSkin的注释) */
export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang } = useI18n()
  const { settings, update } = useSettings(user?.id ?? null)

  function handleLangChange(next: Lang) {
    setLang(next)
    update({ lang: next })
  }

  return (
    <AppLayout title="设置">
      <div className="px-md pt-md flex flex-col gap-2">
        <SettingsRow icon="language" label="语言">
          <div className="flex gap-1">
            {(['zh', 'ja'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleLangChange(l)}
                className={`px-2 py-1 rounded text-tab-label font-sans ${
                  lang === l ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
                }`}
              >
                {l === 'zh' ? '中文' : '日本語'}
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow icon="payments" label="货币">
          <div className="flex gap-1">
            {(['CNY', 'JPY'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ currency: c })}
                className={`px-2 py-1 rounded text-tab-label font-sans ${
                  settings.currency === c ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow icon="palette" label="主题">
          <span>Washi Ledger</span>
        </SettingsRow>

        <SettingsRow icon={APP_ICONS.account} label="我的账户" onClick={() => navigate('/account')}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </SettingsRow>

        <SettingsRow icon={APP_ICONS.about} label="关于" onClick={() => navigate('/about')}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </SettingsRow>
      </div>
    </AppLayout>
  )
}
