import { Hono } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { getHistoryStats, getCentralBankRates } from './handlers'

const rate = new Hono<{ Bindings: Bindings }>()

rate.get('/history-stats', getHistoryStats)
rate.get('/central-bank-rates', getCentralBankRates)

export default rate
