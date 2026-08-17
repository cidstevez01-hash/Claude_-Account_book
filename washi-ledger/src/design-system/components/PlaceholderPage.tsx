import { AppLayout } from './AppLayout'

interface PlaceholderPageProps {
  title: string
  note?: string
}

/** 占位页——按用户"有不全的页面只做目录，后续再调整"的指示，先把路由/导航跑通，
 * 具体页面内容留到对应功能开发时再补，不要在这里瞎猜内容。 */
export function PlaceholderPage({ title, note }: PlaceholderPageProps) {
  return (
    <AppLayout title={title}>
      <div className="flex flex-col items-center justify-center py-24 px-md text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-3 opacity-40">construction</span>
        <p className="text-body-md">这个页面还没做</p>
        {note && <p className="text-body-md mt-1 opacity-70">{note}</p>}
      </div>
    </AppLayout>
  )
}
