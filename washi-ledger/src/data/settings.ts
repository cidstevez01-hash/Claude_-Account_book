import { supabase } from '../lib/supabase'
import type { UserSettings } from '../types'

interface UserSettingsRow {
  user_id: string
  lang: string
  currency: string
  theme_skin?: string | null
}

export const DEFAULT_SETTINGS: UserSettings = { lang: 'zh', currency: 'CNY', themeSkin: 'default' }

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as UserSettingsRow
  return {
    lang: row.lang === 'ja' ? 'ja' : 'zh',
    currency: row.currency ?? 'CNY',
    themeSkin: 'default',
  }
}

/** theme_skin这一列可能还没跑迁移SQL加上去，先带上试一次，失败就退回不带这个字段再试——
 * 照抄旧仓库index.html的pushSettingsUpsert()容错逻辑，不能让主题字段拖累语言/货币同步 */
export async function upsertUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const base = { user_id: userId, lang: settings.lang, currency: settings.currency }
  const { error } = await supabase.from('user_settings').upsert({ ...base, theme_skin: settings.themeSkin })
  if (!error) return
  const { error: fallbackError } = await supabase.from('user_settings').upsert(base)
  if (fallbackError) throw fallbackError
}
