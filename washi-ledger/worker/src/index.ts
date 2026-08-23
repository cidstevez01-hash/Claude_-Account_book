import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './_shared/supabaseClient'
import { ALLOWED_ORIGINS } from './_shared/cors'
import { HttpError } from './_shared/errors'
import entriesRouter from './entries/router'

const app = new Hono<{ Bindings: Bindings }>()

// CORS中间件要挂在最外层、最先跑——包括后面onError兜底的错误响应也要带上CORS头，
// 不然请求在鉴权/查询阶段失败时，浏览器端只会看到笼统的"network error"，看不到
// 真实的错误内容(这是Edge Function/Worker类项目很常见的一个坑)
app.use(
  '*',
  cors({
    origin: ALLOWED_ORIGINS,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  }),
)

app.route('/entries', entriesRouter)

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400 | 401 | 500)
  }
  console.error('未预期的错误', err)
  return c.json({ error: '服务器内部错误' }, 500)
})

export default app
