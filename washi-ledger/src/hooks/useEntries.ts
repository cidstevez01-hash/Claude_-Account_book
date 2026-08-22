import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { fetchEntries, pushEntriesBulkUpsert, subscribeEntriesRealtime } from '../data/catalog'
import { supabase } from '../lib/supabase'
import { loadCachedEntries, saveCachedEntries } from '../lib/entriesCache'
import type { Entry } from '../types'

/** 记账记录数据层——照旧仓库index.html的真实缓存/同步逻辑搬，不是简单的"登录了就查库、
 * 没登录就清空"：
 * - 有本地缓存优先用缓存展示(初始state直接读缓存，不用等云端请求)，没缓存才是空列表
 * - 退出登录不清空当前数据(entries/缓存都保留原样，照旧App的cloudSignOutBtn真实
 *   处理——只清cloudUser、停实时订阅，从没碰过entries)，退出后应该还能正常看到之前的账目
 * - 每次"从未登录变成已登录"(含App冷启动时恢复已有会话)都做一次同步：云端已有数据就
 *   直接采用覆盖本地缓存(数据库是唯一权威源，不弹窗询问)；云端是空的就把本地现有缓存
 *   (可能是退出登录期间攒下的)推上去当种子数据。旧App里"冷启动静默恢复会话"
 *   (initCloudSync)和"交互式登录"(handleCloudSignedIn)是两条分开的代码路径，前者更
 *   简单粗暴(远端返回是空数组也会直接覆盖本地)；这里统一成后者这套更合理的逻辑，
 *   两种场景都不会把用户离线时的本地数据谁都不问就冲掉
 * - App重新回到前台时补一次同步(照旧App resyncCloudOnResume)，不是定时轮询，只在
 *   真的可能有新数据的时机(回到前台)才请求，省流量也更及时
 * - 常驻一条entries表的Realtime订阅(照旧App startCloudRealtime)：同一账号在别处(旧App/
 *   另一台设备)写入的新记录靠这条连接实时推过来，不依赖"这一端自己被唤醒才去拉"——这一层
 *   之前完全没做，只有上面那条"回前台补拉"，而visibilitychange/pageshow在iOS上不一定按预期
 *   触发(旧App代码里也这么写过)，两条腿都得有才不会出现"旧App一直在加数据、这边好几天都不更新"
 *   的情况。回前台时除了补拉一次，也重启一次这条订阅——iOS后台太久WebSocket可能被系统冻结，
 *   不指望它自己重连。 */
export function useEntries(userId: string | null) {
  const [entries, setEntries] = useState<Entry[]>(() => loadCachedEntries())
  const [loading, setLoading] = useState(false)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)

  const reload = useCallback(() => {
    if (!userId) return
    setLoading(true)
    fetchEntries(userId)
      .then((remote) => {
        setEntries(remote)
        saveCachedEntries(remote)
      })
      .catch((e) => console.error('拉取记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  const stopRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
  }, [])

  const startRealtime = useCallback(() => {
    if (!userId) return
    stopRealtime()
    realtimeChannelRef.current = subscribeEntriesRealtime(userId, (event) => {
      setEntries((prev) => {
        const next =
          event.type === 'delete'
            ? prev.filter((e) => e.id !== event.id)
            : prev.some((e) => e.id === event.entry.id)
              ? prev.map((e) => (e.id === event.entry.id ? event.entry : e))
              : [...prev, event.entry]
        saveCachedEntries(next)
        return next
      })
    })
  }, [userId, stopRealtime])

  useEffect(() => {
    if (!userId) {
      stopRealtime()
      return
    }
    startRealtime()
    return stopRealtime
  }, [userId, startRealtime, stopRealtime])

  useEffect(() => {
    const wasUserId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (!userId) return // 退出登录：保留当前entries(内存+缓存)不变，不清空、不请求
    if (wasUserId === userId) return // 同一账号的普通重渲染，交给reload()按需触发

    // 刚从未登录/其他账号切到这个已登录账号——同步一次
    setLoading(true)
    fetchEntries(userId)
      .then(async (remote) => {
        if (remote.length > 0) {
          setEntries(remote)
          saveCachedEntries(remote)
        } else {
          const local = loadCachedEntries()
          if (local.length > 0) {
            await pushEntriesBulkUpsert(local, userId)
            setEntries(local)
            saveCachedEntries(local)
          }
        }
      })
      .catch((e) => console.error('登录同步记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    // 用@capacitor/app的原生appStateChange事件，不是DOM的visibilitychange/pageshow——
    // 这两个web标准事件在Capacitor的WKWebView原生壳里不保证按预期触发(不是PWA场景，
    // 旧App那份注释是针对"添加到主屏幕"的PWA写的，跟这里的原生App壳是两种环境)，
    // 装了真机实测过一次"确认没有变化"才发现这个环境差异。App插件在纯浏览器/开发预览
    // 环境下也有内部的web兜底实现(同样基于visibilitychange)，两边行为一致，不用分别处理
    let handle: { remove: () => void } | undefined
    let cancelled = false
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        reload()
        startRealtime()
      }
    }).then((h) => {
      if (cancelled) h.remove()
      else handle = h
    })
    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [userId, reload, startRealtime])

  return { entries, loading, reload }
}
