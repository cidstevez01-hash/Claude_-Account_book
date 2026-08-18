import type { Category, PaymentMethod, Subcategory, Tag, Lang } from '../types'

/** 分类/细分/支付方式/标签这些目录数据按当前语言取显示名——照旧仓库index.html的
 * catLabel()/subLabel()/tagLabel()/payLabel()真实逻辑(obj[lang] || obj.zh)，
 * 不管settings.lang是什么，缺失日文翻译时兜底显示中文，不会出现空白。
 * 新App之前所有用到这些名字的地方都直接硬编码读.zh字段，日语模式下分类/细分/
 * 支付方式全部还是中文，这个模块统一收口，以后要修（比如兜底策略要改）只用改这一处 */
export function catLabel(cat: Category | null | undefined, lang: Lang): string {
  if (!cat) return ''
  return (lang === 'ja' ? cat.ja : cat.zh) || cat.zh
}

export function subLabel(sub: Subcategory | null | undefined, lang: Lang): string {
  if (!sub) return ''
  return (lang === 'ja' ? sub.ja : sub.zh) || sub.zh
}

export function payLabel(pm: PaymentMethod | null | undefined, lang: Lang): string {
  if (!pm) return ''
  return (lang === 'ja' ? pm.ja : pm.zh) || pm.zh
}

export function tagLabel(tag: Tag | null | undefined, lang: Lang): string {
  if (!tag) return ''
  return (lang === 'ja' ? tag.ja : tag.zh) || tag.zh
}
