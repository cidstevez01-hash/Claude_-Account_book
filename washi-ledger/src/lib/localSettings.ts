import type { UserSettings } from '../types'

const CACHE_KEY = 'washi_ledger_settings_cache_v1'

/** 语言/货币/主题设置的本地缓存——照旧仓库index.html的LocalStore('ledger_settings')
 * 真实逻辑：本地优先，App启动直接读缓存(不用等云端请求)，默认值也照旧App的
 * `let settings = {lang:'ja', currency:'JPY', themeSkin:'current'}`对齐(服务的是
 * 中日两地记账场景，不是想当然定成中文/人民币)。 */
export const DEFAULT_SETTINGS: UserSettings = { lang: 'ja', currency: 'JPY', themeSkin: 'default' }

export function loadCachedSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return {
      lang: parsed.lang === 'zh' ? 'zh' : parsed.lang === 'ja' ? 'ja' : DEFAULT_SETTINGS.lang,
      currency: parsed.currency ?? DEFAULT_SETTINGS.currency,
      themeSkin: 'default',
    }
  } catch (e) {
    console.error('读取本地设置缓存失败', e)
    return DEFAULT_SETTINGS
  }
}

export function saveCachedSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('写入本地设置缓存失败', e)
  }
}
