import type { IconTheme } from '../types'
import book from './book.svg?raw'
import history from './history.svg?raw'
import barChart from './bar_chart.svg?raw'

export const winterIconTheme: IconTheme = {
  navigation: { book, history, bar_chart: barChart }, icons: {},
  accent: '#F3D69D', paper: '#FFFBF3', glow: false,
}
