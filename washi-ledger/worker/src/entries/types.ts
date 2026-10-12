/** 跟washi-ledger/src/data/catalog.ts里的EntryRow保持逐字段一致——两边各自独立定义
 * (不是共享同一个类型文件)，是因为这个Worker项目本来就要跟前端在部署/依赖上彻底
 * 独立(这次前后端分家的初衷)，字段变了两边各自改一下，不追求共享一份.ts */
export interface EntryRow {
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
  points: number | null
  entry_date: string
  recurring_id: string | null
  created_at: string | null
  /** R-41：多张凭证场景下，前端把路径数组JSON.stringify后存进这个字段——数据库
   * schema没变(还是单个text)，这个Worker只做透传，不关心这个字符串里具体装的是
   * 旧版单路径还是新版JSON数组 */
  receipt_path: string | null
}

export type EntryRowInput = Omit<EntryRow, 'created_at'>
