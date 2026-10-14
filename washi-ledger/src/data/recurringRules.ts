import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/apiClient'
import type { RecurringRule } from '../types'

/** 跟worker/src/recurring-rules/types.ts的RecurringRuleRow逐字段一致——
 * 照抄data/catalog.ts里EntryRow的做法，这个前端项目跟Worker各自独立定义 */
interface RecurringRuleRow {
  id: string
  user_id: string
  type: 'expense' | 'income'
  amount: number
  currency: string
  cat_code: string
  sub_code: string | null
  payment_method: string | null
  tag_code: string | null
  note: string | null
  rule_kind: 'day_of_month' | 'interval_days'
  day_of_month: string | null
  biz_day_adjust: 'before' | 'after' | null
  anchor_date: string | null
  interval_days: number | null
  enabled: boolean
  created_at: string | null
  updated_at: string | null
}

function dbRowToRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    catCode: row.cat_code,
    subCode: row.sub_code,
    paymentMethod: row.payment_method,
    tagCode: row.tag_code,
    note: row.note,
    ruleKind: row.rule_kind === 'day_of_month' ? 'dayOfMonth' : 'intervalDays',
    dayOfMonth: row.day_of_month,
    bizDayAdjust: row.biz_day_adjust,
    anchorDate: row.anchor_date,
    intervalDays: row.interval_days,
    enabled: row.enabled,
  }
}

function ruleToDbRow(rule: RecurringRule, userId: string): Omit<RecurringRuleRow, 'created_at' | 'updated_at'> {
  return {
    id: rule.id,
    user_id: userId,
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
    cat_code: rule.catCode,
    sub_code: rule.subCode,
    payment_method: rule.paymentMethod,
    tag_code: rule.tagCode,
    note: rule.note,
    rule_kind: rule.ruleKind === 'dayOfMonth' ? 'day_of_month' : 'interval_days',
    day_of_month: rule.dayOfMonth,
    biz_day_adjust: rule.bizDayAdjust,
    anchor_date: rule.anchorDate,
    interval_days: rule.intervalDays,
    enabled: rule.enabled,
  }
}

// 照抄data/catalog.ts的fetchEntries/upsertEntry/deleteEntry——读写全部经过
// 自建的Cloudflare Worker后端，userId参数保留只是不想改调用方签名，真正的身份
// 校验由Worker从access_token反推
export async function fetchRecurringRules(userId: string): Promise<RecurringRule[]> {
  void userId
  const { rules } = await apiClient.get<{ rules: RecurringRuleRow[] }>('/recurring-rules')
  return rules.map(dbRowToRule)
}

export async function upsertRecurringRule(rule: RecurringRule, userId: string) {
  await apiClient.post('/recurring-rules/upsert-bulk', { rules: [ruleToDbRow(rule, userId)] })
}

export async function deleteRecurringRule(id: string, userId: string) {
  void userId
  await apiClient.del(`/recurring-rules/${id}`)
}

export type RecurringRuleChangeEvent = { type: 'upsert'; rule: RecurringRule } | { type: 'delete'; id: string }

/** recurring_rules表的Realtime订阅——照抄data/catalog.ts的subscribeEntriesRealtime，
 * 同一账号在别的设备上改规则靠这条常驻WebSocket连接实时推过来 */
export function subscribeRecurringRulesRealtime(
  userId: string,
  onChange: (event: RecurringRuleChangeEvent) => void,
): RealtimeChannel {
  return supabase
    .channel('recurring_rules_changes_' + userId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recurring_rules', filter: 'user_id=eq.' + userId },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const delId = (payload.old as { id?: string } | null)?.id
          if (delId != null) onChange({ type: 'delete', id: delId })
          return
        }
        if (payload.new) onChange({ type: 'upsert', rule: dbRowToRule(payload.new as RecurringRuleRow) })
      },
    )
    .subscribe()
}

/** 登录时如果云端还没有规则数据，把本地缓存现有的规则批量推上去做种子数据——
 * 照抄catalog.ts的pushEntriesBulkUpsert */
export async function pushRulesBulkUpsert(rules: RecurringRule[], userId: string) {
  if (rules.length === 0) return
  await apiClient.post('/recurring-rules/upsert-bulk', { rules: rules.map((r) => ruleToDbRow(r, userId)) })
}
