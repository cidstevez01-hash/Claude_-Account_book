import type { HTMLAttributes } from 'react'

/** Font fallback shared by every screen. Keep existing size/layout classes intact. */
export function SymbolIcon({ icon, className, ...props }: HTMLAttributes<HTMLSpanElement> & { icon: string }) {
  return <span aria-hidden="true" {...props} className={`material-symbols-outlined ${className ?? ''}`}>{icon}</span>
}
