const LAST_SYNCED_USER_KEY = 'washi_ledger_settings_last_synced_user_v1'
const INITIAL_LEGACY_OWNER = readInitialOwner()

const LEGACY_CACHE_KEYS = [
  ['washi_ledger_entries_cache_v1', 'washi_ledger_entries_legacy_owner_v1'],
  ['washi_ledger_recurring_rules_cache_v1', 'washi_ledger_recurring_rules_legacy_owner_v1'],
  ['washi_ledger_catalog_cache_v1', 'washi_ledger_catalog_legacy_owner_v1'],
] as const

function readInitialOwner(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(LAST_SYNCED_USER_KEY)
  } catch {
    return null
  }
}

/** Capture ownership before SettingsProvider updates the last-synced user on account switch. */
export function tagLegacyCachesForUser(userId: string | null | undefined): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    for (const [cacheKey, ownerKey] of LEGACY_CACHE_KEYS) {
      if (localStorage.getItem(cacheKey) != null && localStorage.getItem(ownerKey) == null) {
        localStorage.setItem(ownerKey, userId)
      }
    }
  } catch (e) {
    console.error('标记旧缓存账号失败', e)
  }
}

/** Resolve from a durable marker or the owner captured once when the app loaded.
 * Never consult the mutable last-synced-user key after an account switch. */
export function getLegacyCacheOwner(ownerKey: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const stored = localStorage.getItem(ownerKey)
    if (stored != null) return stored
    if (!INITIAL_LEGACY_OWNER) return null
    localStorage.setItem(ownerKey, INITIAL_LEGACY_OWNER)
    return INITIAL_LEGACY_OWNER
  } catch {
    return null
  }
}
