import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../../types'
import { dict } from './dict'

export type TranslationKey = keyof typeof dict.zh

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh')
  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key) => dict[lang][key] ?? dict.zh[key] ?? key,
    }),
    [lang]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n必须在I18nProvider内使用')
  return ctx
}
