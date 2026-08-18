import type { Category } from '../../types'

interface CategoryPickerProps {
  categories: Category[]
  selectedCatCode: string | null
  selectedSubCode: string | null
  onSelectCat: (code: string) => void
  onSelectSub: (code: string | null) => void
}

/** 两级分类选择器——一级横向滚动分类chip，二级细分3列网格，照design-assets-v2/_21的
 * Bento Layout做。自定义细分的内联新增/改名/删除(旧仓库index.html的renderSubGrid里那套)
 * 这次没做，先只能选已有细分，跟明细页的"Filters"高级筛选一样是明确留到以后的deferred scope */
export function CategoryPicker({
  categories,
  selectedCatCode,
  selectedSubCode,
  onSelectCat,
  onSelectSub,
}: CategoryPickerProps) {
  const selectedCat = categories.find((c) => c.code === selectedCatCode) ?? categories[0] ?? null
  const subs = selectedCat?.subs ?? []

  return (
    <div className="py-md">
      <div className="flex items-center justify-between px-md mb-sm">
        <h2 className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">分类</h2>
      </div>
      <div className="flex overflow-x-auto px-md gap-sm pb-4 snap-x">
        {categories.map((cat) => {
          const active = cat.code === selectedCat?.code
          return (
            <button
              key={cat.code}
              type="button"
              onClick={() => onSelectCat(cat.code)}
              className="snap-start shrink-0 flex flex-col items-center justify-center gap-1 p-3 rounded-2xl min-w-[76px] border transition-colors"
              style={
                active
                  ? { background: cat.color, borderColor: cat.color, color: '#fff' }
                  : { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline-variant)' }
              }
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {cat.icon}
              </span>
              <span className="text-tab-label font-sans">{cat.zh}</span>
            </button>
          )
        })}
      </div>

      {subs.length > 0 && (
        <div className="px-md">
          <div className="grid grid-cols-3 gap-xs">
            {subs.map((sub) => {
              const active = sub.code === selectedSubCode
              return (
                <button
                  key={sub.code}
                  type="button"
                  onClick={() => onSelectSub(active ? null : sub.code)}
                  className={`py-2 px-3 rounded-xl text-body-md font-sans text-center transition-colors ${
                    active
                      ? 'border-2 border-primary bg-surface text-primary font-medium'
                      : 'border border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  {sub.zh}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
