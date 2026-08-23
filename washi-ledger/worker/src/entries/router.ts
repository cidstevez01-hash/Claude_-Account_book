import { Hono } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { listEntries, upsertEntries, deleteEntry } from './handlers'

const entries = new Hono<{ Bindings: Bindings }>()

entries.get('/', listEntries)
entries.post('/upsert-bulk', upsertEntries)
entries.delete('/:id', deleteEntry)

export default entries
