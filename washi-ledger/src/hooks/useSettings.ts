import { useEffect, useState, useCallback } from 'react'
import { fetchUserSettings, upsertUserSettings, DEFAULT_SETTINGS } from '../data/settings'
import type { UserSettings } from '../types'

export function useSettings(userId: string | null) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchUserSettings(userId)
      .then((s) => setSettings(s ?? DEFAULT_SETTINGS))
      .catch((e) => console.error('拉取用户设置失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      if (!userId) return
      try {
        await upsertUserSettings(userId, next)
      } catch (e) {
        console.error('保存用户设置失败', e)
      }
    },
    [settings, userId]
  )

  return { settings, loading, update }
}
