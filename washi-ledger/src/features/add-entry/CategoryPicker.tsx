import { useRef, useState } from 'react'
import { addCustomSubcategory, updateCustomSubcategory, deleteCustomSubcategory } from '../../data/catalog'
import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { catLabel, subLabel } from '../../lib/catalogLabel'
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

/** 两级分类选择器——一级4列网格(照旧App`.cat-grid`的真实布局，不是Stitch稿的横向
 * 滚动chip；图标常态就带各自分类色的浅底+本色描边，不是只有选中才上色，同样照旧App
 * `catObj.color`+`tintColor()`真实逻辑搬)，二级细分左对齐flex-wrap胶囊(照旧App
 * `.sub-wrap`真实布局，Stitch稿写的"3列Bento网格"跟旧App实际不符，以旧App为准)。
 * 自定义细分支持内联新增/改名/删除，照旧仓库index.html的renderSubGrid()"⋯"菜单逻辑搬：
 * 胶囊本体点击=选中，右上角"⋯"收纳编辑/删除，预设细分没有这个菜单(数据库is_preset=true，
 * 不允许改/删)。 */
export function CategoryPicker({
  categories,
  selectedCatCode,
  selectedSubCode,
  onSelectCat,
  onSelectSub,
  userId,
  onCatalogChanged,
}: CategoryPickerProps) {
  const { t, lang } = useI18n()
  const selectedCat = categories.find((c) => c.code === selectedCatCode) ?? categories[0] ?? null
  const subs = selectedCat?.subs ?? []

  const [editingCode, setEditingCode] = useState<string | null>(null) // 具体sub的id=改名，'__new__'=新增，null=都没有
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  // 照旧仓库index.html的bindInlineSubInput()真实逻辑搬：确认按钮(mousedown阶段
  // preventDefault，不然点它第一下先让input失焦触发blur)、回车、点别处失焦(blur)
  // 三条路都能提交，但同一次编辑只能真正提交一次——用settledRef挡住"先blur commit
  // 一次、按钮的click紧接着又commit一次"这种重复请求。旧App注释里明确写过"不再只靠
  // 点别处自动保存"是因为用户反馈过找不到保存在哪，所以按钮必须留着，不是可以去掉的
  // 摆设——blur只是给按钮之外多一条顺手的路，不是替代按钮
  const settledRef = useRef(true)

  function startAdd() {
    settledRef.current = false
    setEditingCode('__new__')
    setInputValue('')
    setOpenMenuCode(null)
  }
  function startEdit(subId: string, currentLabel: string) {
    settledRef.current = false
    setEditingCode(subId)
    setInputValue(currentLabel)
    setOpenMenuCode(null)
  }
  function cancelEdit() {
    settledRef.current = true
    setEditingCode(null)
    setInputValue('')
  }

  async function confirmEdit() {
    if (settledRef.current) return
    settledRef.current = true
    const label = inputValue.trim()
    // 没输入内容/没登录/没选中分类——等同于取消，直接退出编辑态，不发请求存空值
    if (!label || !userId || !selectedCat) {
      setEditingCode(null)
      setInputValue('')
      return
    }
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
      setEditingCode(null)
      setInputValue('')
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
        <h2 className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">{t('categoryLabel')}</h2>
      </div>
      <div className="grid grid-cols-4 gap-sm px-md pb-4">
        {categories.map((cat) => {
          const active = cat.code === selectedCat?.code
          return (
            <button
              key={cat.code}
              type="button"
              onClick={() => onSelectCat(cat.code)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-2xl border-2 text-center transition-colors"
              style={
                active
                  ? { background: 'var(--color-primary-fixed)', borderColor: 'var(--color-primary)' }
                  : { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline-variant)' }
              }
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: tintColor(cat.color, 0.85) }}
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={{ color: cat.color, fontVariationSettings: "'FILL' 1" }}
                >
                  {cat.icon}
                </span>
              </span>
              <span
                className="text-[11px] font-sans truncate w-full"
                style={{ color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontWeight: active ? 600 : 400 }}
              >
                {catLabel(cat, lang)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-md">
        {/* R-09重新设计：完全照旧App index.html的.sub-pill/.sub-menu-btn真实结构搬，不是
            照TagPicker风格猜的split-button。旧App真实做法——"⋯"不是跟胶囊拼接的分体按钮，
            是绝对定位、悬浮压在胶囊右上角的一个18px小圆点(sub-menu-btn: position:absolute;
            top:-7px;right:-7px)，点开的编辑/删除菜单也是绝对定位悬浮在胶囊下方，不占布局
            空间；胶囊本身border-radius:20px(≈rounded-full)+13px字号，不是rounded-xl方角 */}
        <h2 className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase mb-sm">
          {t('subcategoryLabel')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {subs.map((sub) => {
            if (editingCode === sub.id) {
              return (
                <span key={sub.id} className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={confirmEdit}
                    className="py-2 px-3 rounded-full border border-primary bg-surface text-[13px] text-on-surface w-[118px] box-border focus:outline-none"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={confirmEdit}
                    disabled={saving}
                    className="text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  </button>
                </span>
              )
            }
            const active = sub.code === selectedSubCode
            const pill = (
              <button
                type="button"
                onClick={() => onSelectSub(active ? null : sub.code)}
                className={`py-2 px-3.5 rounded-full text-[13px] font-sans text-center transition-colors border ${
                  active
                    ? 'border-primary bg-primary-fixed text-primary font-semibold'
                    : 'border-outline-variant bg-surface-container text-on-surface-variant'
                }`}
              >
                {subLabel(sub, lang)}
              </button>
            )
            if (!sub.custom) return <span key={sub.id}>{pill}</span>

            const menuOpen = openMenuCode === sub.code
            return (
              <span key={sub.id} className="relative inline-flex">
                {pill}
                <button
                  type="button"
                  onClick={() => setOpenMenuCode(menuOpen ? null : sub.code)}
                  className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-on-surface-variant text-surface text-[11px] font-bold border-2 border-surface flex items-center justify-center leading-none"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="absolute z-20 top-[22px] -right-1.5 bg-surface-container border border-outline-variant rounded-[10px] shadow-lg overflow-hidden min-w-[92px]">
                    <button
                      type="button"
                      onClick={() => startEdit(sub.id, subLabel(sub, lang))}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-on-surface whitespace-nowrap w-full"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      {t('editLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sub.id, sub.code)}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-primary whitespace-nowrap w-full"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      {t('deleteLabel')}
                    </button>
                  </div>
                )}
              </span>
            )
          })}

          {editingCode === '__new__' ? (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={confirmEdit}
                placeholder={t('newSubPlaceholder')}
                className="py-2 px-3 rounded-full border border-primary bg-surface text-[13px] text-on-surface w-[118px] box-border focus:outline-none"
              />
              {/* 确认/取消按钮都要在mousedown阶段就preventDefault，不然点它们的第一下先让
                  input失焦触发上面的onBlur=confirmEdit，取消按钮会被抢先当成"确认"存下去
                  (confirmEdit内部靠settledRef挡了重复提交，但取消这个意图本身就没法达成了) */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={confirmEdit}
                disabled={saving}
                className="text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelEdit}
                className="text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </span>
          ) : (
            selectedCat &&
            userId && (
              <button
                type="button"
                onClick={startAdd}
                className="py-2 px-3.5 rounded-full border border-dashed border-outline-variant text-on-surface-variant text-[13px] font-sans"
              >
                ＋
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
