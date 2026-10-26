import type { Context } from 'hono'
import { getUserScopedClient, getVerifiedUserId, type Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import type { RecurringRuleRow, RecurringRuleRowInput } from './types'

/** GET /recurring-rules——对应前端fetchRecurringRules(userId)，照抄
 * entries/handlers.ts的listEntries：userId从校验过的token反推，RLS已经限制在
 * 调用者自己的行，.eq('user_id', ...)是防御性的显式过滤，不是唯一边界；
 * .is('deleted_at', null)过滤掉软删除的行 */
export async function listRules(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)

  const { data, error } = await client
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new HttpError(500, error.message)

  return c.json({ rules: (data ?? []) as RecurringRuleRow[] })
}

/** POST /recurring-rules/upsert-bulk——对应前端pushRulesBulkUpsert(rules, userId)，
 * 新建/编辑单条规则也是传一个1元素数组复用同一个接口(照抄entries的upsertEntries，
 * 本质是同一套"useRecurringRules要复用useEntries.ts合并同步逻辑"要求下的必然结果——
 * 本机离线新建的规则也要能批量回推)。请求体里每一行的user_id一律用服务端校验出的
 * 身份覆盖，不信任客户端传的值；不碰deleted_at列，道理跟upsertEntries一样，避免
 * 误把已软删除的规则复活 */
export async function upsertRules(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)

  const body = await c.req.json<{ rules?: RecurringRuleRowInput[] }>().catch(() => null)
  if (!body || !Array.isArray(body.rules)) {
    throw new HttpError(400, '请求体需要是 { rules: RecurringRuleRowInput[] }')
  }
  if (body.rules.length === 0) return c.json({ ok: true })

  const rows = body.rules.map((rule) => ({ ...rule, user_id: userId, updated_at: new Date().toISOString() }))
  const { error } = await client.from('recurring_rules').upsert(rows)
  if (error) throw new HttpError(500, error.message)

  return c.json({ ok: true })
}

/** DELETE /recurring-rules/:id——软删除，照抄entries/handlers.ts的deleteEntry，
 * 不删掉这条规则已经生成出来的历史账目记录(entries里那些recurring_id指向这条
 * 规则的行不受影响，继续作为独立的正常记录存在)。
 * .is('deleted_at', null)：已经删除过的再删一次更新0行、直接返回成功，不覆盖第一次的删除时间 */
export async function deleteRule(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)
  const id = c.req.param('id')

  const { error } = await client
    .from('recurring_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) throw new HttpError(500, error.message)

  return c.json({ ok: true })
}
