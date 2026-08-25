import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchUserSettings, upsertUserSettings } from '../data/settings'
import { loadCachedSettings, saveCachedSettings, loadLastSyncedUserId, saveLastSyncedUserId } from '../lib/localSettings'
import { useAuth } from '../features/auth/useAuth'
import type { UserSettings } from '../types'

interface SettingsContextValue {
  settings: UserSettings
  update: (patch: Partial<UserSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/** 语言/货币/主题设置——全局唯一状态源，照旧仓库index.html的settings/loadSettings()/
 * saveSettings()真实逻辑搬：本地缓存优先(初始state直接读缓存，不用等云端请求，App
 * 冷启动/切页都不会闪回默认值)，退出登录不清空本地设置，登录时云端有数据覆盖本地
 * 否则把本地设置推上去当种子数据(跟useEntries.ts同一套"从未登录变成已登录"同步模式)。
 * I18nProvider内部消费这个Context的settings.lang，不再自己单独维护一份language状态。 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(() => loadCachedSettings())
  // B-17根因修复：初始值不能是undefined——那样每次App冷启动都会被误判成"刚登录"，
  // 见localSettings.ts里loadLastSyncedUserId的详细说明
  const prevUserIdRef = useRef<string | null | undefined>(loadLastSyncedUserId())

  // R-14："怀旧"主题——切换的是根元素上的data-theme属性，index.css里
  // :root[data-theme="nostalgia"]那块覆盖token靠这个属性生效；写在Provider里而不是
  // 某个具体页面组件，这样切换主题设置后全局(包括不会重新挂载的AppLayout以外页面，
  // 比如登录页)立刻跟着变，不用等用户导航到某个特定页面才触发
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.themeSkin)
  }, [settings.themeSkin])

  useEffect(() => {
    // B-17根因(第二层)：useAuth()的user在session真正恢复完成前，每次冷启动都会先
    // 以null跑一轮(异步ensureSession()还没resolve)，这个effect本来会在那一轮就把
    // prevUserIdRef.current覆盖成null(在下面的!userId return之前)，等真实session
    // 恢复、user变成实际账号时，wasUserId读到的是这个被污染的null而不是localStorage
    // 里存的值，导致"冷启动恢复同一账号"又被误判成"刚登录了一个新账号"，重新触发一次
    // 用远端覆盖本地的同步——跟B-17原本要修的问题是同一个模式，只是从ref初始值的
    // undefined换成了运行期间被踩了一脚的null，绕开了第一轮加的localStorage兜底。
    // 加上loading判断：认证状态还没真正解析出来之前，这个effect完全不跑，等
    // useAuth()给出一个真正稳定的结果(真实账号/匿名账号/彻底失败后的null)才比较
    if (authLoading) return
    const userId = user?.id ?? null
    const wasUserId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (!userId) return // 退出登录：保留当前设置(内存+缓存)不变
    saveLastSyncedUserId(userId)
    // 同一账号的普通重渲染，或者App冷启动后session被supabase-js自动恢复回同一个
    // 账号——本地缓存已经是这个账号最新的真实设置(含刚切换、还没来得及推上云端的
    // 主题)，不用去同步，更不能被云端可能还没来得及更新的旧值覆盖
    if (wasUserId === userId) return

    // 真的换了个账号(不是同一个账号重启恢复)——同步一次
    fetchUserSettings(userId)
      .then(async (remote) => {
        if (remote) {
          setSettings(remote)
          saveCachedSettings(remote)
        } else {
          const local = loadCachedSettings()
          await upsertUserSettings(userId, local)
        }
      })
      .catch((e) => console.error('登录同步设置失败', e))
  }, [user, authLoading])

  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        saveCachedSettings(next)
        if (user) {
          upsertUserSettings(user.id, next).catch((e) => console.error('保存用户设置失败', e))
        }
        return next
      })
    },
    [user]
  )

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings必须在SettingsProvider内使用')
  return ctx
}
