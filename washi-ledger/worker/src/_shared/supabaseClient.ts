import { createClient } from '@supabase/supabase-js'
import { HttpError } from './errors'

/** wrangler.toml [vars]里声明的环境变量，Hono用这个类型做c.env的类型标注 */
export interface Bindings {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

/** 每个请求都新建一个绑定调用者自己access_token的Supabase客户端——用anon key
 * (不是service role key)，这样调用方在数据库那边的身份还是真实用户本人，
 * entries表原有的RLS策略原样生效，没有绕过任何权限检查。数据请求的传输路径变成
 * "前端 → 这个Worker → Supabase(PostgREST)"，安全模型完全不变，只是多转了一手。
 *
 * 不接受、也不信任客户端传来的user_id——所有需要按用户身份过滤的地方，都从这里
 * 拿到的、经过校验的token对应的身份为准，不管前端有没有传、传得对不对 */
export function getUserScopedClient(env: Bindings, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, '缺少Authorization头')

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** 拿到经过服务端校验的真实用户id——比如DELETE /entries/:id这类需要显式
 * .eq('user_id', ...)兜底过滤的地方要用这个，而不是相信客户端传来的任何字段 */
export async function getVerifiedUserId(
  client: ReturnType<typeof getUserScopedClient>
): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new HttpError(401, '登录状态无效或已过期')
  return data.user.id
}
