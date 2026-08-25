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
      themeSkin: parsed.themeSkin === 'nostalgia' ? 'nostalgia' : 'default',
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

const LAST_SYNCED_USER_KEY = 'washi_ledger_settings_last_synced_user_v1'

/** 记住"上一次真正同步过设置的用户id"，且要跨App重启持久化(localStorage，不是
 * useSettings.tsx组件内部的useRef)——每次冷启动App整个React树都是全新挂载，纯
 * 组件内的ref必然从初始值(undefined)重新开始，没法区分"这次是刚换了个账号登录"
 * 还是"只是关掉App重开、session被supabase-js自动恢复回同一个账号"，会把后者也
 * 误判成"刚登录"，进而无条件用云端数据覆盖本地缓存——如果上一次切换主题后那次
 * fire-and-forget的推送还没来得及真的发到服务器App就被关掉了，云端还是旧值，
 * 每次冷启动就会被这个旧值"打回默认"，这正是主题切换后关闭App重进又变回默认的
 * 根因。跟useAuth.ts的EVER_SIGNED_IN_KEY是同一个技巧：用localStorage存一个跨
 * 重启存活的标记，把"真的换账号了"和"只是重启恢复了同一个session"这两种在
 * useEffect依赖数组层面看起来一样的情况区分开 */
export function loadLastSyncedUserId(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_USER_KEY)
  } catch {
    return null
  }
}

export function saveLastSyncedUserId(userId: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_USER_KEY, userId)
  } catch {
    // localStorage不可用时静默跳过，不影响设置本身的读写
  }
}
