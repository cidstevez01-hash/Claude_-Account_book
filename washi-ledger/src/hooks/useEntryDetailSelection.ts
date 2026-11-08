import { useCallback, useEffect, useState } from 'react'
import type { Entry } from '../types'

/** Keep the selection by ID; detail contents always follow the latest unfiltered records. */
export function useEntryDetailSelection(entries: Entry[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const entry = selectedId ? entries.find((item) => item.id === selectedId) ?? null : null
  const selectEntry = useCallback((next: Entry | null) => setSelectedId(next?.id ?? null), [])

  // A real deletion closes the detail and prevents a later refresh reopening it.
  useEffect(() => {
    if (selectedId && !entry) setSelectedId(null)
  }, [selectedId, entry])

  return [entry, selectEntry] as const
}
