import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

/** 镜像旧仓库index.html里的cloudUser全局状态，但多了一层匿名兜底：完全没有session
 * (含从没登录过、含真实账户主动退出登录之后)时自动匿名登录(supabase.auth.signInAnonymously)，
 * 保证user.id永远存在，记账/设置等数据层(useEntries.ts/useSettings.tsx)不用等"真的登录"
 * 才写数据库，未登录状态下的记录也会落库，只是没有关联真实账户。真实登录/注册后，
 * 匿名session期间攒的本机独有记录会通过useEntries.ts里的mergeRemote合并逻辑自动带过去
 * (跟B-02修复同一套机制，不用另外写迁移代码)。
 *
 * 依赖Supabase项目开启"Anonymous Sign-ins"(Authentication设置里的开关)，这是我们这边
 * 代码改不了、需要用户自己去Supabase后台开一次的前置条件——如果没开，signInAnonymously()
 * 会报错，这里捕获后user保持null，等同于退回到没有这层兜底之前的行为，不会更差。
 *
 * signedIn特意只代表"真实账户"(排除is_anonymous)，UI上判断"是否已登录"要用signedIn，
 * 不能直接判断user是否存在——否则匿名session会被误判成已登录 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session?.user) {
        setUser(data.session.user)
        setLoading(false)
        return
      }
      try {
        const { data: anon, error } = await supabase.auth.signInAnonymously()
        if (cancelled) return
        if (error) throw error
        setUser(anon.user)
      } catch (e) {
        console.error('匿名登录失败(可能是Supabase项目还没开启Anonymous Sign-ins)', e)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ensureSession()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // 退出的是真实账户——重新匿名登录一次，保证退出登录之后新增的记录依然能落库
        ensureSession()
        return
      }
      setUser(session?.user ?? null)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const isAnonymous = !!user?.is_anonymous
  return { user, loading, signedIn: !!user && !isAnonymous, isAnonymous }
}
