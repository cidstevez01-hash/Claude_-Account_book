import { useEffect, useState, useCallback } from 'react'
import { fetchEntries } from '../data/catalog'
import type { Entry } from '../types'

export function useEntries(userId: string | null) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchEntries(userId)
      .then(setEntries)
      .catch((e) => console.error('拉取记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { entries, loading, reload }
}
