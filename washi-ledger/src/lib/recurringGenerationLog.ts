import { logIfEnabled } from './appLog'
import type { Entry } from '../types'

/** 固定收支记录的生成日志——每一笔真正写进云端的自动生成记录记一条(生成时间、来源、
 * 记录内容)，每次触发生成检查也记一条(规则数、待生成数)。写的是App本机的诊断日志。
 * 服务器定时任务(pg_cron)生成的记录不经过App，这里看不到。
 * 注意：这里有localStorage副作用，所以单独放在这个文件，recurringGeneration.ts保持纯函数 */

function formatLocalTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 每次触发生成检查记一条 */
export function logRecurringCheck(source: string, rulesCount: number, pendingCount: number): void {
  logIfEnabled(`[生成检查] 来源=${source} 规则=${rulesCount}条 待生成=${pendingCount}条`)
}

/** 每一笔新生成的记录记一条(写入云端成功之后调用) */
export function logRecurringEntryGenerated(entry: Entry, source: string): void {
  const category = entry.subCode ? `${entry.catCode}/${entry.subCode}` : entry.catCode
  logIfEnabled(
    `[生成记录] 来源=${source} 生成时间=${formatLocalTime(new Date())} id=${entry.id} 日期=${entry.date} ${entry.type} ${entry.amount} ${entry.currency} 分类=${category} 支付=${entry.paymentMethod ?? '-'} 备注=${entry.note ?? '-'} 规则=${entry.recurringId ?? '-'}`,
  )
}
