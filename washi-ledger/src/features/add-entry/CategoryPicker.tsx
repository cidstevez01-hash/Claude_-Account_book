import { useState } from 'react'
import { addCustomSubcategory, updateCustomSubcategory, deleteCustomSubcategory } from '../../data/catalog'
import type { Category } from '../../types'

interface CategoryPickerProps {
  categories: Category[]
  selectedCatCode: string | null
  selectedSubCode: string | null
  onSelectCat: (code: string) => void
  onSelectSub: (code: string | null) => void
  userId: string | null
  onCatalogChanged: () => void
}

/** 两级分类选择器——一级横向滚动分类chip，二级细分3列网格，照design-assets-v2/_21的
 * Bento Layout做。自定义细分支持内联新增/改名/删除，照旧仓库index.html的renderSubGrid()
 * "⋯"菜单逻辑搬：胶囊本体点击=选中，右上角"⋯"收纳编辑/删除，预设细分没有这个菜单
 * (数据库is_preset=true，不允许改/删)。 */
export function CategoryPicker({
  categories,
  selectedCatCode,
  selectedSubCode,
  onSelectCat,
  onSelectSub,
  userId,
  onCatalogChanged,
}: CategoryPickerProps) {
  const selectedCat = categories.find((c) => c.code === selectedCatCode) ?? categories[0] ?? null
  const subs = selectedCat?.subs ?? []

  const [editingCode, setEditingCode] = useState<string | null>(null) // 具体sub的id=改名，'__new__'=新增，null=都没有
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  function startAdd() {
    setEditingCode('__new__')
    setInputValue('')
    setOpenMenuCode(null)
  }
  function startEdit(subId: string, currentLabel: string) {
    setEditingCode(subId)
    setInputValue(currentLabel)
    setOpenMenuCode(null)
  }
  function cancelEdit() {
    setEditingCode(null)
    setInputValue('')
  }

  async function confirmEdit() {
    const label = inputValue.trim()
    if (!label || !userId || !selectedCat || saving) return
    setSaving(true)
    try {
      if (editingCode === '__new__') {
        const sub = await addCustomSubcategory(selectedCat.code, label, userId)
        onCatalogChanged()
        onSelectSub(sub.code)
      } else if (editingCode) {
        await updateCustomSubcategory(editingCode, label)
        onCatalogChanged()
      }
      cancelEdit()
    } catch (e) {
      console.error('自定义细分保存失败', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(subId: string, subCode: string) {
    if (!userId) return
    try {
      await deleteCustomSubcategory(subId)
      if (selectedSubCode === subCode) onSelectSub(null)
      onCatalogChanged()
    } catch (e) {
      console.error('自定义细分删除失败', e)
    }
    setOpenMenuCode(null)
  }

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

      <div className="px-md">
        <div className="flex flex-wrap gap-xs">
          {subs.map((sub) => {
            if (editingCode === sub.id) {
              return (
                <span key={sub.id} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                    className="py-2 px-3 rounded-xl border border-primary bg-surface text-body-md text-on-surface w-24 focus:outline-none"
                  />
                  <button type="button" onClick={confirmEdit} disabled={saving} className="text-primary">
                    <span className="material-symbols-outlined text-[20px]">check</span>
                  </button>
                </span>
              )
            }
            const active = sub.code === selectedSubCode
            if (sub.custom) {
              const menuOpen = openMenuCode === sub.code
              return (
                <span key={sub.id} className="relative">
                  <span className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectSub(active ? null : sub.code)}
                      className={`py-2 pl-3 pr-1.5 rounded-l-xl text-body-md font-sans text-center transition-colors border ${
                        active
                          ? 'border-primary bg-surface text-primary font-medium'
                          : 'border-outline-variant bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {sub.zh}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenMenuCode(menuOpen ? null : sub.code)}
                      className={`py-2 px-1.5 rounded-r-xl border border-l-0 text-on-surface-variant ${
                        active ? 'border-primary bg-surface' : 'border-outline-variant bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                    </button>
                  </span>
                  {menuOpen && (
                    <div className="absolute z-20 top-full left-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => startEdit(sub.id, sub.zh)}
                        className="flex items-center gap-2 px-3 py-2 text-body-md text-on-surface whitespace-nowrap w-full"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sub.id, sub.code)}
                        className="flex items-center gap-2 px-3 py-2 text-body-md text-primary whitespace-nowrap w-full"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        删除
                      </button>
                    </div>
                  )}
                </span>
              )
            }
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSub(active ? null : sub.code)}
                className={`py-2 px-3 rounded-xl text-body-md font-sans text-center transition-colors border ${
                  active
                    ? 'border-primary bg-surface text-primary font-medium'
                    : 'border-outline-variant bg-surface-container text-on-surface-variant'
                }`}
              >
                {sub.zh}
              </button>
            )
          })}

          {editingCode === '__new__' ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                placeholder="新细分"
                className="py-2 px-3 rounded-xl border border-primary bg-surface text-body-md text-on-surface w-24 focus:outline-none"
              />
              <button type="button" onClick={confirmEdit} disabled={saving} className="text-primary">
                <span className="material-symbols-outlined text-[20px]">check</span>
              </button>
              <button type="button" onClick={cancelEdit} className="text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </span>
          ) : (
            selectedCat &&
            userId && (
              <button
                type="button"
                onClick={startAdd}
                className="py-2 px-3 rounded-xl border border-dashed border-primary text-primary text-body-md font-sans flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                添加
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
