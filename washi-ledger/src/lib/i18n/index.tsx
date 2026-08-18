import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Lang } from '../../types'
import { dict } from './dict'
import { useSettings } from '../../hooks/useSettings'

export type TranslationKey = keyof typeof dict.zh

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** 语言状态不再自己单独维护——统一从SettingsProvider(hooks/useSettings.tsx)取
 * settings.lang，setLang本质是update({lang})，这样语言选择才会真正落地持久化
 * (本地缓存+登录后同步云端)，而不是只活在I18nProvider自己的一份内存state里、
 * 切页/重开App就丢。SettingsProvider必须包在I18nProvider外层(见App.tsx)。 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings()
  const value = useMemo<I18nContextValue>(
    () => ({
      lang: settings.lang,
      setLang: (lang) => update({ lang }),
      t: (key) => dict[settings.lang][key] ?? dict.zh[key] ?? key,
    }),
    [settings.lang, update]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n必须在I18nProvider内使用')
  return ctx
}
