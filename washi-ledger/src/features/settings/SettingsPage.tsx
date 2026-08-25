import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { useSettings } from '../../hooks/useSettings'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import { CURRENCIES } from '../../data/rate'
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

/** 设置项右侧的下拉选择——照design-assets-v2/_18的真实结构用原生<select>(不是自己拼
 * 按钮组)，因为货币这类选项不止两个(CURRENCIES有11种)，按钮组这种"每个选项一个按钮"
 * 的样式选项一多就会挤成一团；<select>本身就是给"任意数量选项"设计的控件，iOS上点开
 * 是系统原生的滚轮选择器，样式上只去掉默认的箭头图案换成Material Symbols的箭头图标，
 * 跟这一排其他行的图标风格统一 */
function SelectRow({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <SettingsRow icon={icon} label={label}>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent border-none text-body-md text-on-surface-variant focus:outline-none focus:ring-0 pr-5 text-right cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined text-[16px] pointer-events-none absolute right-0">expand_more</span>
      </div>
    </SettingsRow>
  )
}

/** 设置页——照design-assets-v2/_18的列表布局做。语言/货币都真实存进user_settings
 * (照旧App pushSettingsUpsert逻辑)，且经SettingsProvider(hooks/useSettings.tsx)
 * 全局共享——语言切换会立刻影响全局i18n(setLang本质是update({lang}))，货币切换会
 * 影响明细/仪表盘的金额换算显示(见data/currencyDisplay.ts)。Theme目前只有一套
 * Washi Ledger视觉，点进去是/theme子页面(照design-assets-v2/_25的Bento卡片
 * 布局)，只展示这一张真实存在的主题卡，没有编另外几张假主题 */
export function SettingsPage() {
  const navigate = useNavigate()
  const { lang, setLang, t } = useI18n()
  const { settings, update } = useSettings()

  return (
    <AppLayout title={t('settingsTitle')} leftButton="back">
      <div className="px-md pt-md flex flex-col gap-2">
        <SelectRow
          icon="language"
          label={t('langLabel')}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          options={[
            { value: 'zh', label: '中文' },
            { value: 'ja', label: '日本語' },
          ]}
        />

        <SelectRow
          icon="payments"
          label={t('currencyRowLabel')}
          value={settings.currency}
          onChange={(v) => update({ currency: v })}
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.zh} (${c.code})` }))}
        />

        <SettingsRow icon="palette" label={t('themeLabel')} onClick={() => navigate('/theme')}>
          <div className="flex items-center gap-1">
            {/* 之前这里写死显示"PigBang"，跟ThemePage.tsx选卡片切主题完全没接上——
                切完主题回设置页这一行还是那个死字符串，看起来像"没生效"。改成
                跟ThemePage.tsx同一套themeDefaultName/themeNostalgiaName翻译键，
                真实反映settings.themeSkin当前值 */}
            <span>{settings.themeSkin === 'nostalgia' ? t('themeNostalgiaName') : t('themeDefaultName')}</span>
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </div>
        </SettingsRow>

        <SettingsRow icon={APP_ICONS.account} label={t('accountTitle')} onClick={() => navigate('/account')}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </SettingsRow>

        <SettingsRow icon={APP_ICONS.about} label={t('aboutTitle')} onClick={() => navigate('/about')}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </SettingsRow>
      </div>
    </AppLayout>
  )
}
