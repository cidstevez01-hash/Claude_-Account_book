import type { ThemeSkin } from '../types'

/** Shared decoding for local and remote settings, including older/unknown clients. */
export function normalizeThemeSkin(value: unknown): ThemeSkin {
  return value === 'nostalgia' || value === 'summer' || value === 'autumn' || value === 'winter' || value === 'winter-silver' ? value : 'default'
}

export function isWinterTheme(value: unknown): boolean {
  return value === 'winter' || value === 'winter-silver'
}
