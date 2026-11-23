import type { ThemeSkin } from '../types'

/** One label mapping for both the theme picker and the current settings value. */
export const THEME_NAME_KEYS = {
  default: 'themeDefaultName',
  nostalgia: 'themeNostalgiaName',
  summer: 'themeSummerName',
  autumn: 'themeAutumnName',
  winter: 'themeWinterName',
  'winter-silver': 'themeWinterSilverName',
} as const satisfies Record<ThemeSkin, string>

/** Shared decoding for local and remote settings, including older/unknown clients. */
export function normalizeThemeSkin(value: unknown): ThemeSkin {
  return value === 'nostalgia' || value === 'summer' || value === 'autumn' || value === 'winter' || value === 'winter-silver' ? value : 'default'
}

export function isWinterTheme(value: unknown): boolean {
  return value === 'winter' || value === 'winter-silver'
}
