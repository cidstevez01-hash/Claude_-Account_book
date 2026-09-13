import { AppLayout } from '../../design-system/components/AppLayout'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useSettings } from '../../hooks/useSettings'
import { useI18n } from '../../lib/i18n'
import { CURRENCIES } from '../../data/rate'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import type { Lang } from '../../types'

interface SettingsRowProps {
  icon: string
  /** R-29："夏 · 花火"下这个位置对应的旧App-fw图标资源路径，见ThemeIcon组件。跟
   * effect二选一，见ThemeIcon.tsx里两者的说明 */
  fwIcon?: string
  /** B-XX：这一行图标是否用新的"复用默认图标形状+单独发光"效果——这个圆形背景是
   * 真实UI常驻存在的(不是为了效果新画的)，所以传'ring'，见ThemeIcon.tsx */
  effect?: 'ring' | 'bare'
  /** 只对effect='ring'生效——萤火虫装饰，确认稿里只有语言/货币两行带，见ThemeIcon.tsx */
  fireflies?: boolean
  label: string
  children: React.ReactNode
  onClick?: () => void
}

function SettingsRow({ icon, fwIcon, effect, fireflies, label, children, onClick }: SettingsRowProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className="w-full flex items-center justify-between p-sm rounded-lg bg-surface-container-lowest border-b-2 border-outline-variant"
    >
      {/* B-XX：图标到文字间距从gap-sm(12px)提到gap-md(16px)——"夏·花火"主题下
          图标光晕视觉边界(66px发光盒子closest-side半径33px，减图标自身20px半径)
          有13px，比原来的12px间距还宽，肉眼看光晕已经贴到文字上了；提到16px能在
          光晕视觉边界外留出3-4px干净空隙。只改这一处，不动全局gap-sm这个token */}
      <div className="flex items-center gap-md">
        <div className="relative w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <ThemeIcon icon={icon} fw={fwIcon} className="w-6 h-6" effect={effect} fireflies={fireflies} />
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
 * 跟这一排其他行的图标风格统一
 *
 * B-XX：可见文字不再交给<select>自己渲染——用户反馈真机上言語行"日本語"和通貨行
 * "日元 (JPY)"这两个值的文字没有垂直对齐，根因是原生<select>的可见文字由系统/浏览器
 * 的表单控件外壳负责画，不完全受我们CSS控制，纯CJK文本("日本語")和CJK+英文括号混排
 * 文本("日元 (JPY)")在原生控件里可能不是同一套基线算法(iOS尤其明显，桌面Chromium
 * 复现不出这个差异，量出来是对齐的)。改成自己拿<span>画可见文字(照着せ替え那行本来
 * 就是自己画span的思路)，行高/垂直对齐完全自己控制，三行渲染方式统一；<select>本身
 * 保留，但改成盖在上面的透明交互层(不可见但仍可点击/仍会弹出系统原生选择器)，功能
 * 完全不变 */
function SelectRow({
  icon,
  fwIcon,
  effect,
  fireflies,
  label,
  value,
  options,
  onChange,
}: {
  icon: string
  fwIcon?: string
  effect?: 'ring' | 'bare'
  fireflies?: boolean
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? value
  return (
    <SettingsRow icon={icon} fwIcon={fwIcon} effect={effect} fireflies={fireflies} label={label}>
      {/* B-XX续：箭头跟文字的间距之前沿用原生select时代遗留的"pr-5撑开文字+
          chevron绝对定位贴right-0"这套写法，跟着せ替え那行(flex items-center
          gap-1的正常间距)不是同一套，看起来比那行挤。文字已经改成自己画的span了，
          没必要再保留这层absolute hack，直接改成同款flex+gap-1，三行箭头间距
          统一；select这个透明交互层继续用absolute inset-0盖住整块可点区域 */}
      <div className="relative flex items-center gap-1">
        <span className="text-body-md text-on-surface-variant">{selectedLabel}</span>
        <span className="material-symbols-outlined text-[16px] pointer-events-none">expand_more</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 opacity-0 cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
  const navigate = useAppNavigate()
  const { lang, setLang, t } = useI18n()
  const { settings, update } = useSettings()

  return (
    <AppLayout title={t('settingsTitle')} leftButton="back">
      <div className="px-md pt-md flex flex-col gap-2">
        <SelectRow
          icon="language"
          effect="ring"
          fireflies
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
          effect="ring"
          fireflies
          label={t('currencyRowLabel')}
          value={settings.currency}
          onChange={(v) => update({ currency: v })}
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.zh} (${c.code})` }))}
        />

        <SettingsRow icon="palette" effect="ring" label={t('themeLabel')} onClick={() => navigate('/theme')}>
          <div className="flex items-center gap-1">
            {/* 之前这里写死显示"PigBang"，跟ThemePage.tsx选卡片切主题完全没接上——
                切完主题回设置页这一行还是那个死字符串，看起来像"没生效"。改成
                跟ThemePage.tsx同一套themeDefaultName/themeNostalgiaName翻译键，
                真实反映settings.themeSkin当前值 */}
            <span>
              {settings.themeSkin === 'nostalgia'
                ? t('themeNostalgiaName')
                : settings.themeSkin === 'summer'
                  ? t('themeSummerName')
                  : t('themeDefaultName')}
            </span>
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </div>
        </SettingsRow>

        {/* R-32排查真机卡住问题新加——纯开发调试用途，不是普通用户需要的功能，
            暂时先放在设置页最后一行(不专门做隐藏手势，等这次问题查完/以后有需要
            再收起来) */}
        <SettingsRow icon="bug_report" label={t('debugLogRowLabel')} onClick={() => navigate('/settings/debug-log')}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </SettingsRow>

      </div>
    </AppLayout>
  )
}
