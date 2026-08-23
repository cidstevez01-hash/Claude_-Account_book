import type { Context } from 'hono'
import { getUserScopedClient, getVerifiedUserId, type Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import type { EntryRow, EntryRowInput } from './types'

/** GET /entries——对应前端fetchEntries(userId)。userId不从请求里拿，从校验过的
 * token反推；RLS本身已经会把结果限制在调用者自己的行，这里的.eq('user_id', ...)
 * 是防御性的显式过滤，不是唯一的安全边界 */
export async function listEntries(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)

  const { data, error } = await client.from('entries').select('*').eq('user_id', userId)
  if (error) throw new HttpError(500, error.message)

  return c.json({ entries: (data ?? []) as EntryRow[] })
}

/** POST /entries/upsert-bulk——对应前端pushEntriesBulkUpsert(entries, userId)，
 * 单条upsertEntry也是传一个1元素数组复用同一个接口，不用另开一条路由。
 * 请求体里每一行的user_id一律用服务端校验出来的身份覆盖，不信任客户端传的值 */
export async function upsertEntries(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)

  const body = await c.req.json<{ entries?: EntryRowInput[] }>().catch(() => null)
  if (!body || !Array.isArray(body.entries)) {
    throw new HttpError(400, '请求体需要是 { entries: EntryRowInput[] }')
  }
  if (body.entries.length === 0) return c.json({ ok: true })

  const rows = body.entries.map((entry) => ({ ...entry, user_id: userId }))
  const { error } = await client.from('entries').upsert(rows)
  if (error) throw new HttpError(500, error.message)

  return c.json({ ok: true })
}

/** DELETE /entries/:id——对应前端deleteEntry(id, userId)。
 * 临时诊断：加.select()让PostgREST把实际被删掉的行返回回来，这样能从
 * deletedCount区分"删除语句执行成功但RLS/条件没匹配到任何行"(deletedCount:0，
 * 数据库那边悄悄过滤掉了，不会报错)和"真的删掉了"(deletedCount:1)——
 * 2026-08-23排查真机/本地测试"删除显示成功但刷新后数据还在"时加的，
 * 排查完确认原因后可以去掉 */
export async function deleteEntry(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)
  const id = c.req.param('id')

  const { data, error } = await client
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
  if (error) throw new HttpError(500, error.message)

  return c.json({ ok: true, deletedCount: (data ?? []).length, matchedUserId: userId, matchedId: id })
}
