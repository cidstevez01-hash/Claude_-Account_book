interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** 通用确认弹窗——照design-assets-v2/_43(Confirm Delete)做，替换掉仪表盘/明细页
 * 删除记录时原本用的原生window.confirm()占位实现 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '删除',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-md">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[4px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[360px] bg-surface rounded-[20px] shadow-xl flex flex-col items-center p-lg">
        <div className="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-md">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            delete
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
