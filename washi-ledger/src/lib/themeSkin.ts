import type { ThemeSkin } from '../types'

/** Shared decoding for local and remote settings, including older/unknown clients. */
export function normalizeThemeSkin(value: unknown): ThemeSkin {
  return value === 'nostalgia' || value === 'summer' || value === 'autumn' ? value : 'default'
}
