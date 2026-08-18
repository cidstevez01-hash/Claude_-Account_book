interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** Material Symbols图标名，默认'delete'(删除确认场景) */
  icon?: string
  /** 顶部图标底色，默认'error'(删除这类破坏性操作)。退出登录这类中性操作用'neutral' */
  tone?: 'error' | 'neutral'
}

/** 通用确认弹窗——照design-assets-v2/_43(Confirm Delete)做，替换掉仪表盘/明细页
 * 删除记录时原本用的原生window.confirm()占位实现。icon/tone两个可选参数是后来
 * 加的，让这个弹窗也能给退出登录这类非破坏性确认场景复用，不用再单独做一个组件 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '删除',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  icon = 'delete',
  tone = 'error',
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-md">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[4px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[360px] bg-surface rounded-[20px] shadow-xl flex flex-col items-center p-lg">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-md ${
            tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        <h2 className="font-serif text-headline-md text-on-surface mb-1 text-center">{title}</h2>
        <p className="text-body-md text-on-surface-variant text-center mb-lg">{message}</p>
        <div className="w-full border-t-[1.5px] border-dashed border-outline-variant mb-md" />
        <div className="flex w-full gap-md">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-outline text-on-surface text-body-lg active:scale-95 transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary text-body-lg active:scale-95 transition-transform"
            style={{ boxShadow: '0 4px 0 var(--color-primary-container)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
