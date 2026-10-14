import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { fetchRecurringRules, pushRulesBulkUpsert, subscribeRecurringRulesRealtime } from '../data/recurringRules'
import { supabase } from '../lib/supabase'
import { loadCachedRecurringRules, saveCachedRecurringRules } from '../lib/recurringRulesCache'
import type { RecurringRule } from '../types'

/** 固定收支规则数据层——R-44明确要求复用useEntries.ts那套缓存/合并/Realtime/
 * 回前台补拉的同步架构，这个文件是逐段照抄过来的，只把entries换成rules、
 * Entry换成RecurringRule，同步逻辑本身不做改动（连注释里的历史坑一并保留，
 * 这套架构已经踩过的坑没理由在这里重踩一遍）：
 * - 有本地缓存优先用缓存展示，没缓存才是空列表
 * - 退出登录不清空当前数据
 * - 挂载时有userId都做一次真实同步：远端拉到的数据按id跟本机合并，不是直接覆盖
 * - App重新回到前台时补一次同步+重启Realtime订阅
 * - 常驻一条recurring_rules表的Realtime订阅 */
export function useRecurringRules(userId: string | null) {
  const [rules, setRules] = useState<RecurringRule[]>(() => loadCachedRecurringRules())
  const [loading, setLoading] = useState(false)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const rulesRef = useRef(rules)
  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  const mergeRemote = useCallback(
    (remote: RecurringRule[]) => {
      const remoteIds = new Set(remote.map((r) => r.id))
      const localOnly = rulesRef.current.filter((r) => !remoteIds.has(r.id))
      const merged = remote.concat(localOnly)
      setRules(merged)
      saveCachedRecurringRules(merged)
      if (localOnly.length && userId) {
        pushRulesBulkUpsert(localOnly, userId).catch((e) => console.error('本机独有规则回推云端失败', e))
      }
    },
    [userId],
  )

  const reload = useCallback(() => {
    if (!userId) return Promise.resolve()
    setLoading(true)
    return fetchRecurringRules(userId)
      .then((remote) => mergeRemote(remote))
      .catch((e) => console.error('拉取固定收支规则失败', e))
      .finally(() => setLoading(false))
  }, [userId, mergeRemote])

  // 删除成功后调用方要先调这个把本地状态里的这条规则摘掉，再reload()——道理跟
  // useEntries.ts的removeLocal一样，不然mergeRemote会把"删除后不在最新远端列表
  // 里"误判成"本机独有、还没同步的新规则"，反手又把刚删掉的规则推回云端
  const removeLocal = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveCachedRecurringRules(next)
      return next
    })
  }, [])

  const stopRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
  }, [])

  const startRealtime = useCallback(() => {
    if (!userId) return
    stopRealtime()
    realtimeChannelRef.current = subscribeRecurringRulesRealtime(userId, (event) => {
      setRules((prev) => {
        const next =
          event.type === 'delete'
            ? prev.filter((r) => r.id !== event.id)
            : prev.some((r) => r.id === event.rule.id)
              ? prev.map((r) => (r.id === event.rule.id ? event.rule : r))
              : [...prev, event.rule]
        saveCachedRecurringRules(next)
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
    if (!userId) return

    setLoading(true)
    fetchRecurringRules(userId)
      .then(async (remote) => {
        if (remote.length > 0) {
          mergeRemote(remote)
        } else {
          const local = loadCachedRecurringRules()
          if (local.length > 0) {
            await pushRulesBulkUpsert(local, userId)
            setRules(local)
            saveCachedRecurringRules(local)
          }
        }
      })
      .catch((e) => console.error('登录同步固定收支规则失败', e))
      .finally(() => setLoading(false))
  }, [userId, mergeRemote])

  useEffect(() => {
    if (!userId) return
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

  return { rules, loading, reload, removeLocal }
}
