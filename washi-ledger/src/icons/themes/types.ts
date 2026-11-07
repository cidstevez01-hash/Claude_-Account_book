import type { IconGlyph } from '../glyphs'

export type NavigationIconKey = 'book' | 'history' | 'bar_chart'
export interface IconTheme {
  navigation: Partial<Record<NavigationIconKey, string>>
  /** Override any semantic icon, not just bottom navigation. Missing entries fall back. */
  icons: Record<string, { symbol?: string; glyph?: IconGlyph }>
  accent: string
  paper: string
  glow: boolean
}
