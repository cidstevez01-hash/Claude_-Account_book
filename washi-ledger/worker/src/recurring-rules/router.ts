import { Hono } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { listRules, upsertRules, deleteRule } from './handlers'

const recurringRules = new Hono<{ Bindings: Bindings }>()

recurringRules.get('/', listRules)
recurringRules.post('/upsert-bulk', upsertRules)
recurringRules.delete('/:id', deleteRule)

export default recurringRules
