import { logModule } from './appLog'
import type { Entry } from '../types'

/** 固定收支的生成日志(模块'recurring')——每一笔真正写进云端的自动生成记录记一条(生成时间、
 * 来源、记录内容)，每次触发生成检查也记一条(规则数、待生成数)。写的是App本机的诊断日志。
 * 服务器定时任务(pg_cron)生成的记录不经过App，这里看不到。
 * 注意：这里有localStorage副作用，所以单独放在这个文件，recurringGeneration.ts保持纯函数 */

function formatLocalTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 每次触发生成检查记一条 */
export function logRecurringCheck(source: string, rulesCount: number, pendingCount: number): void {
  logModule('recurring', '生成检查', 'info', { 来源: source, 规则数: rulesCount, 待生成: pendingCount })
}

/** 每一笔真正插入云端的新记录记一条(只对返回的插入id调用，见catalog.ts的说明) */
export function logRecurringEntryGenerated(entry: Entry, source: string): void {
  logModule('recurring', '生成记录', 'info', {
    来源: source,
    生成时间: formatLocalTime(new Date()),
    id: entry.id,
    日期: entry.date,
    金额: `${entry.type} ${entry.amount} ${entry.currency}`,
    分类: entry.subCode ? `${entry.catCode}/${entry.subCode}` : entry.catCode,
    支付: entry.paymentMethod,
    备注: entry.note,
    规则: entry.recurringId,
  })
}

/** 云端已经有这一笔(写入被忽略，没有真正插入)，不算这次生成 */
export function logRecurringEntrySkipped(entryId: string, source: string): void {
  logModule('recurring', '已存在，跳过', 'info', { 来源: source, id: entryId })
}
