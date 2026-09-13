import { dict } from './i18n/dict'
import type { TranslationKey } from './i18n'
import { loadCachedSettings } from './localSettings'

/** 给非React上下文用的同步翻译——`receiptEdgeDetect.ts`这类普通模块不在组件树里，
 * 拿不到`useI18n()`这个Context，之前图省事直接在代码里写死了中文错误提示，结果
 * 被发现"App语言设成日语，报错还是中文"这个bug(所有用户可见文字都要走i18n，这条
 * 规则不因为文件是不是React组件而有例外)。
 *
 * 直接读`localStorage`里缓存的当前语言——跟`I18nProvider`背后同一份数据源(见
 * `hooks/useSettings.tsx`→`lib/localSettings.ts`)，不经过React Context，普通模块
 * 也能用。
 *
 * ⚠️ Worker线程内不能用这个函数——Web Storage API(`localStorage`)只挂在`Window`
 * 接口上，Worker全局作用域访问不到，`receiptEdgeDetectWorker.ts`那边只能返回
 * 语言无关的错误码，由主线程(能调用这个函数的地方)负责翻译成用户可见文字。 */
export function tSync(key: TranslationKey, vars?: Record<string, string>): string {
  const lang = loadCachedSettings().lang
  let text: string = dict[lang][key] ?? dict.zh[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v)
    }
  }
  return text
}
