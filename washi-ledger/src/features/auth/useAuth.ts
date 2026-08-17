import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

/** 镜像旧仓库index.html里的cloudUser全局状态——signedIn/signedOut两态，
 * 没有做匿名/游客态的本地数据兜底(旧App离线也能记账，云同步是可选加成)，
 * 这部分本地优先的策略要等接entries数据层时一起设计，这里先只管认证状态本身。 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { user, loading, signedIn: !!user }
}
