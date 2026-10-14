/** 跟sql/2026-10-14_recurring_rules.sql建的recurring_rules表逐字段一致——
 * 跟entries/types.ts同样的约定(这个Worker项目前后端分家，字段变了两边各自改，
 * 不共享一份.ts) */
export interface RecurringRuleRow {
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
  deleted_at: string | null
}

export type RecurringRuleRowInput = Omit<RecurringRuleRow, 'created_at' | 'updated_at' | 'deleted_at'>
