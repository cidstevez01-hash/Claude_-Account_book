import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

const EVER_SIGNED_IN_KEY = 'washi_ledger_ever_real_signed_in'

/** 本机是否曾经真实登录过(排除匿名session)——只有"曾经真实登录过、现在却变成
 * 未登录/匿名"才该被当成"掉线"提醒，第一次打开App从没登录过是正常的未登录状态 */
export function hasEverSignedIn(): boolean {
  try {
    return localStorage.getItem(EVER_SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}

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

    // App从后台切回前台时主动重新确认一次session，不被动等Supabase SDK自己后台的
    // 自动刷新定时器——iOS后台挂起太久这个定时器可能被系统冻结、没能按时触发，真正
    // 回到前台、JS又开始跑的这一刻才是最可靠的检查时机(照抄旧App index.html的
    // resyncCloudOnResume同一个思路，同一个真实事故B-02驱动的修复)
    let appStateHandle: { remove: () => void } | undefined
    let appStateCancelled = false
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) ensureSession()
    }).then((h) => {
      if (appStateCancelled) h.remove()
      else appStateHandle = h
    })

    return () => {
      cancelled = true
      appStateCancelled = true
      appStateHandle?.remove()
      sub.subscription.unsubscribe()
    }
  }, [])

  const isAnonymous = !!user?.is_anonymous
  const signedIn = !!user && !isAnonymous
  useEffect(() => {
    // 只在真实账户(非匿名)登录成功时打这个标记——匿名session兜底登录不算
    if (signedIn) {
      try {
        localStorage.setItem(EVER_SIGNED_IN_KEY, '1')
      } catch {
        // localStorage不可用时静默跳过，不影响登录状态本身
      }
    }
  }, [signedIn])

  return { user, loading, signedIn, isAnonymous }
}
