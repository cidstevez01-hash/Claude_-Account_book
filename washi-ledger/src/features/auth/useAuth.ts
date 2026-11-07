import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { logModule } from '../../lib/appLog'

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
 * 才写数据库，未登录状态下的记录也会落库，只是没有关联真实账户。用匿名账号注册时通过
 * updateUser保留同一个userId，因此缓存和云端数据继续归属该账号；登录到另一个已有账号
 * 则按userId切换隔离数据，不自动合并游客缓存，避免误传到其他账号。
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
    let pending: Promise<void> | null = null
    let epoch = 0
    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    async function restoreSession(requestEpoch: number) {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (cancelled || epoch !== requestEpoch) return
        // 刷新失败不等于没有会话；不能用匿名登录覆盖暂时无法恢复的真实账号。
        if (sessionError) throw sessionError
        if (data.session?.user) {
          setUser(data.session.user)
          retryCount = 0
          return
        }
        const { data: anon, error } = await supabase.auth.signInAnonymously()
        if (cancelled || epoch !== requestEpoch) return
        if (error) throw error
        setUser(anon.user)
        retryCount = 0
      } catch (e) {
        if (cancelled || epoch !== requestEpoch) return
        console.error('恢复登录会话失败', e)
        logModule('other', '登录会话恢复失败', 'error', {
          message: String((e as { message?: unknown } | null)?.message ?? e),
        })
        // 保留已有账号；冷启动的短暂网络失败会有限重试，恢复联网/回到前台也可重试。
        if (retryCount < 2) {
          const delay = [1000, 3000][retryCount++]
          retryTimer = setTimeout(() => { void ensureSession() }, delay)
        }
      } finally {
        if (!cancelled && epoch === requestEpoch) setLoading(false)
      }
    }

    function ensureSession(): Promise<void> {
      if (cancelled) return Promise.resolve()
      if (pending) return pending
      clearTimeout(retryTimer)
      pending = restoreSession(epoch).finally(() => { pending = null })
      return pending
    }

    void ensureSession()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        epoch += 1
        setUser(null)
        setLoading(true)
        // 退出的是真实账户——重新匿名登录一次，保证退出登录之后新增的记录依然能落库
        // SDK 回调内不调用其他 auth API；等旧恢复任务结束，再在下一任务中恢复。
        clearTimeout(retryTimer)
        retryTimer = setTimeout(() => {
          void (pending ?? Promise.resolve()).then(() => ensureSession())
        }, 0)
        return
      }
      if (session?.user) {
        epoch += 1
        retryCount = 0
        clearTimeout(retryTimer)
        setUser(session.user)
        setLoading(false)
      }
    })

    // App从后台切回前台时主动重新确认一次session，不被动等Supabase SDK自己后台的
    // 自动刷新定时器——iOS后台挂起太久这个定时器可能被系统冻结、没能按时触发，真正
    // 回到前台、JS又开始跑的这一刻才是最可靠的检查时机(照抄旧App index.html的
    // resyncCloudOnResume同一个思路，同一个真实事故B-02驱动的修复)
    let appStateHandle: { remove: () => void } | undefined
    let appStateCancelled = false
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        retryCount = 0
        void ensureSession()
      }
    }).then((h) => {
      if (appStateCancelled) h.remove()
      else appStateHandle = h
    })
    const onOnline = () => {
      retryCount = 0
      void ensureSession()
    }
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      appStateCancelled = true
      appStateHandle?.remove()
      sub.subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
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
