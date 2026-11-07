import book from './shared/navigation/book.svg?raw'
import history from './shared/navigation/history.svg?raw'
import barChart from './shared/navigation/bar_chart.svg?raw'
import { defaultIconTheme } from './default'
import { nostalgiaIconTheme } from './nostalgia'
import { summerIconTheme } from './summer'
import { autumnIconTheme } from './autumn'
import type { NavigationIconKey } from './types'
export type { NavigationIconKey } from './types'

/** Semantic key -> default artwork. A theme only needs to provide its overrides. */
const navigation = { book, history, bar_chart: barChart }
export const ICON_THEMES = {
  default: defaultIconTheme,
  nostalgia: nostalgiaIconTheme,
  summer: summerIconTheme,
  autumn: autumnIconTheme,
}

function resolveTheme(theme: string) {
  return Object.hasOwn(ICON_THEMES, theme) ? ICON_THEMES[theme as keyof typeof ICON_THEMES] : ICON_THEMES.default
}

export function resolveThemeIcon(theme: string, icon: string) {
  return resolveTheme(theme).icons[icon] ?? ICON_THEMES.default.icons[icon]
}

export function resolveNavigationIcon(theme: string, icon: NavigationIconKey) {
  const palette = resolveTheme(theme)
  const source = palette.navigation[icon] ?? navigation[icon]
  // Trusted, repository-owned SVG only; never insert API/user-provided markup here.
  return { ...palette, body: source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>')) }
}

export function isNavigationIcon(icon: string): icon is NavigationIconKey {
  return Object.hasOwn(navigation, icon)
}
