import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchUserSettings, upsertUserSettings } from '../data/settings'
import { loadCachedSettings, saveCachedSettings } from '../lib/localSettings'
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
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(() => loadCachedSettings())
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  // R-14："怀旧"主题——切换的是根元素上的data-theme属性，index.css里
  // :root[data-theme="nostalgia"]那块覆盖token靠这个属性生效；写在Provider里而不是
  // 某个具体页面组件，这样切换主题设置后全局(包括不会重新挂载的AppLayout以外页面，
  // 比如登录页)立刻跟着变，不用等用户导航到某个特定页面才触发
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.themeSkin)
  }, [settings.themeSkin])

  useEffect(() => {
    const userId = user?.id ?? null
    const wasUserId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (!userId) return // 退出登录：保留当前设置(内存+缓存)不变
    if (wasUserId === userId) return // 同一账号的普通重渲染

    // 刚从未登录/其他账号切到这个已登录账号——同步一次
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
  }, [user])

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
