import type { Context } from 'hono'
import { getUserScopedClient, getVerifiedUserId, type Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import type { EntryRow, EntryRowInput } from './types'

/** GET /entries——对应前端fetchEntries(userId)。userId不从请求里拿，从校验过的
 * token反推；RLS本身已经会把结果限制在调用者自己的行，这里的.eq('user_id', ...)
 * 是防御性的显式过滤，不是唯一的安全边界。
 * .is('deleted_at', null)：entries表改成软删除(见deleteEntry注释)，已标记删除的行
 * 不能再出现在正常列表里 */
export async function listEntries(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)

  const { data, error } = await client
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) throw new HttpError(500, error.message)

  return c.json({ entries: (data ?? []) as EntryRow[] })
}

/** POST /entries/upsert-bulk——对应前端pushEntriesBulkUpsert(entries, userId)，
 * 单条upsertEntry也是传一个1元素数组复用同一个接口，不用另开一条路由。
 * 请求体里每一行的user_id一律用服务端校验出来的身份覆盖，不信任客户端传的值。
 * 请求体里不带deleted_at字段——PostgREST的upsert只会更新请求体里出现的列，这里
 * 故意不碰这一列：万一前端合并逻辑把一条刚被标记删除的记录误判成"本机独有"又
 * 推了上来，这行在数据库里还是保持"已删除"状态，不会被这次upsert悄悄复活 */
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
 * 改成软删除(标记deleted_at，不物理删除行)，不是真的DELETE语句——原因(2026-08-23
 * 回归测试真实复现过)：前端为了防止"本机离线期间攒的新记录被覆盖"，有一套按id
 * 合并远端/本机数据的逻辑，一旦远端GET拉不到某条id就当成"本机独有、还没同步"，
 * 反手把它重新推上云端。物理删除之后，这个合并逻辑没法区分"这条id从来没同步过"
 * 和"这条id刚被删除"，会把刚删的记录自己救活。改成标记删除后：
 * 1) GET /entries过滤掉deleted_at不为空的行，前端看到的列表跟真删除一样没有它了
 * 2) 就算前端合并逻辑还是误判、把这条id当"本机独有"又推了一次upsert，upsert的
 *    请求体里不含deleted_at字段(见upsertEntries)，不会改动这一列，这行还是保持
 *    "已删除"，救不活
 * 真正的物理清理(定期清掉deleted_at很久以前的行)这次没做，留到以后需要的时候再加 */
export async function deleteEntry(c: Context<{ Bindings: Bindings }>) {
  const client = getUserScopedClient(c.env, c.req.raw)
  const userId = await getVerifiedUserId(client)
  const id = c.req.param('id')

  const { error } = await client
    .from('entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new HttpError(500, error.message)

  return c.json({ ok: true })
}
