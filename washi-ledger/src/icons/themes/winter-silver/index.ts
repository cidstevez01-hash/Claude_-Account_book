import type { IconTheme } from '../types'
import book from './book.svg?raw'
import history from './history.svg?raw'
import barChart from './bar_chart.svg?raw'

export const winterSilverIconTheme: IconTheme = {
  navigation: { book, history, bar_chart: barChart }, icons: {},
  accent: '#D1D7DD', paper: '#F8FAFC', glow: false,
}
