import { useI18n } from '../../lib/i18n'

interface CatalogLoadStateProps {
  loading: boolean
  onRetry: () => void
}

/** catalog(分类/支付方式/标签)还没就绪时的数据区域占位——之前只有"转圈圈"这一种
 * 状态，请求失败(比如网络断了)`loading`会变成false但catalog仍然是null，UI却一直
 * 停在转圈圈，用户看到的是"转不出数据"、没有任何能操作的东西。这里按loading拆成
 * 两种真实状态：请求还在进行中显示转圈圈；请求已经结束但没拿到数据(失败)显示错误
 * 提示+重试按钮，点了直接调CatalogProvider的reload()再试一次 */
export function CatalogLoadState({ loading, onRetry }: CatalogLoadStateProps) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-3xl text-outline">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-sm py-24 px-md text-center">
      <span className="material-symbols-outlined text-3xl text-outline">cloud_off</span>
      <p className="text-body-md text-on-surface-variant">{t('catalogLoadErrorHint')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 px-4 py-2 rounded-full border border-primary text-primary text-body-md active:opacity-60 transition-opacity"
      >
        {t('retryLabel')}
      </button>
    </div>
  )
}
