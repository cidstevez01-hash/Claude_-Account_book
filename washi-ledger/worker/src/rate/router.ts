import { Hono } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { getHistoryStats } from './handlers'

const rate = new Hono<{ Bindings: Bindings }>()

rate.get('/history-stats', getHistoryStats)

export default rate
