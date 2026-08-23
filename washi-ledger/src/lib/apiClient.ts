import { supabase } from './supabase'

/** 前后端分家(phase 1: entries资源)——自建后端跑在Cloudflare Worker上(见
 * washi-ledger/worker/)，这个文件是前端唯一跟那个Worker打交道的入口。
 * base URL不能像Supabase Edge Functions方案那样从VITE_SUPABASE_URL拼出来——
 * Cloudflare Worker是完全独立的平台，URL要单独配置(VITE_API_BASE_URL) */
const API_BASE = import.meta.env.VITE_API_BASE_URL

if (!API_BASE) {
  throw new Error('缺少 VITE_API_BASE_URL，检查 .env 文件')
}

/** 从supabase-js的session里取当前access_token塞进Authorization头——直接复用
 * 今天(2026-08-22)才加固过的session管理(ensureSession/匿名登录兜底那一整套)，
 * 这里不重新造一套token获取/刷新逻辑。getSession()只在token确实需要刷新时才
 * 发请求，日常调用很轻量 */
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('未登录，无法调用后端接口')
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? `接口请求失败：${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
