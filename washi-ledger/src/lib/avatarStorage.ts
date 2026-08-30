import { AVATAR_PRESETS, DEFAULT_AVATAR_ID } from './avatarPresets'

/** 头像选择——纯本地偏好，不是UserSettings的一部分(不走useSettings.tsx的Supabase
 * lang/currency/theme_skin同步那一套)。这个功能范围就是"挑一个预设图案当头像"，
 * 没有涉及"多端同步头像"这个需求，不需要为此改user_settings表schema——按当前范围
 * 最小化实现，真要跨端同步再单独提需求接进设置同步 */
const STORAGE_KEY = 'washi_ledger_avatar_id_v1'

export function loadAvatarId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && AVATAR_PRESETS.some((p) => p.id === raw)) return raw
    return DEFAULT_AVATAR_ID
  } catch {
    return DEFAULT_AVATAR_ID
  }
}

export function saveAvatarId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch (e) {
    console.error('写入头像选择失败', e)
  }
}
