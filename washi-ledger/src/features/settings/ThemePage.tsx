import { useNavigate } from 'react-router-dom'

/** 主题选择——独立整屏子页面，照design-assets-v2/_25的Bento卡片布局做，但只放了
 * "Washi Ledger"这一张真实存在的主题卡：_25设计稿里画了"Midnight Ink/Forest Moss/
 * Ocean Glass"另外三套配色，这些在真实代码里根本没有实现(整个App只有一套视觉)，
 * 照旧编几张能点但点了没有真实效果的假卡片会误导用户，所以没有照抄设计稿字面内容，
 * 只做了真实存在的这一套，选中态常驻显示 */
export function ThemePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-[480px] mx-auto min-h-screen relative flex flex-col bg-surface">
      <header className="flex items-center px-md h-16 w-full sticky top-0 z-30 bg-surface border-b-[1.5px] border-dashed border-outline-variant">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center font-serif text-headline-md text-on-surface tracking-tight -ml-10">
          主题
        </h1>
      </header>

      <main className="flex-1 px-md pt-lg">
        <div className="w-32 mx-auto">
          <div className="w-full text-center rounded-xl border-[1.5px] border-dashed border-primary bg-surface-container-highest p-3 flex flex-col items-center gap-2 shadow-sm">
            <div className="w-full aspect-[9/16] rounded-lg overflow-hidden border border-outline-variant shadow-inner flex flex-col gap-1">
              <div className="h-1/2 w-full" style={{ background: 'var(--color-primary)' }} />
              <div className="h-1/2 w-full flex">
                <div className="h-full w-1/2" style={{ background: 'var(--color-surface-dim)' }} />
                <div className="h-full w-1/2" style={{ background: 'var(--color-tertiary-fixed-dim)' }} />
              </div>
            </div>
            <span className="text-body-md text-on-surface leading-tight">Washi Ledger</span>
            <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check
              </span>
            </div>
          </div>
        </div>
        <p className="text-center text-body-md text-on-surface-variant mt-lg">
          目前只有这一套视觉主题，更多主题以后再加
        </p>
      </main>
    </div>
  )
}
