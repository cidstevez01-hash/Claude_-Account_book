import { useLayoutEffect, useRef, useState } from 'react'
import { buildNewSubcategory, insertCustomSubcategory, updateCustomSubcategory, deleteCustomSubcategory } from '../../data/catalog'
import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { catLabel, subLabel } from '../../lib/catalogLabel'
import type { Category, Subcategory } from '../../types'

interface CategoryPickerProps {
  categories: Category[]
  selectedCatCode: string | null
  selectedSubCode: string | null
  onSelectCat: (code: string) => void
  onSelectSub: (code: string | null) => void
  userId: string | null
  onCatalogChanged: () => Promise<void>
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
  const rawSubs = selectedCat?.subs ?? []

  const [editingCode, setEditingCode] = useState<string | null>(null) // 具体sub的id=改名，'__new__'=新增，null=都没有
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  // 照旧仓库index.html的bindInlineSubInput()真实逻辑搬：确认按钮(mousedown阶段
  // preventDefault，不然点它第一下先让input失焦触发blur)、回车、点别处失焦(blur)
  // 三条路都能提交，没有单独的取消按钮(旧App也没有，只能清空文字再失焦，或者按
  // Escape)。同一次编辑只能真正提交一次——用settledRef挡住重复触发
  const settledRef = useRef(true)
  const subListRef = useRef<HTMLDivElement>(null)

  // "⋯"弹出菜单默认贴着胶囊右边缘往左展开(-right-1.5)，如果这个胶囊正好是当前
  // 这一行第一个/靠左的item，菜单(min-w-92px)会整个越过左边界——真机上被外层
  // <main overflow-x-hidden>裁掉看不见也点不到，这正是"点删除没反应"的真实原因。
  // 照旧App`.sub-menu-popover.flip-up`(超出底部翻上去)同一个思路，但这里要处理
  // 的是左边界：菜单渲染后量一次真实位置，超出所在容器左边界就贴左对齐展开，
  // 不再贴右
  useLayoutEffect(() => {
    if (!openMenuCode) return
    const container = subListRef.current
    const popover = container?.querySelector<HTMLElement>('[data-sub-menu-popover]')
    if (!container || !popover) return
    popover.style.right = ''
    popover.style.left = ''
    const containerRect = container.getBoundingClientRect()
    const popRect = popover.getBoundingClientRect()
    if (popRect.left < containerRect.left) {
      popover.style.right = 'auto'
      popover.style.left = '-6px'
    }
  }, [openMenuCode])

  // 乐观本地补丁——照旧App bindInlineSubInput()的commit()真实逻辑：改名/新增只
  // await单条写入本身(updateCustomSub/addCustomSub)，不等一次完整的目录重新拉取
  // 就切回展示态；本地直接把改好的名字/新建的项摆进去显示，onCatalogChanged()
  // (重新拉整个目录，比单条写入慢得多)放到后台不阻塞UI地跑，等它真的拉回来后
  // categories/tags这份props自然会带上正确数据，届时下面的合并逻辑用真实数据
  // 覆盖过去，这份本地补丁不需要手动清空
  const [renameOverrides, setRenameOverrides] = useState<Record<string, string>>({})
  // 按分类code分开存——CategoryPicker是切换分类tab时复用同一个组件实例(不重新
  // 挂载)，之前直接用一个不分类的Subcategory[]数组存待补丁项，导致刚在A分类新建
  // 的子分类切到B分类也会显示出来(合并逻辑不看这个新建项到底属于哪个分类)。按
  // 分类code分桶后，渲染时只取当前选中分类那一桶
  const [pendingSubsByCat, setPendingSubsByCat] = useState<Record<string, Subcategory[]>>({})
  const pendingSubs = (selectedCat && pendingSubsByCat[selectedCat.code]) || []
  // 删除也是乐观本地补丁——点删除立刻把id记进这个集合、从列表里过滤掉，不用等
  // deleteCustomSubcategory()真正写库+onCatalogChanged()整个目录重新拉回来才消失
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const subs = rawSubs
    .filter((s) => !deletedIds.has(s.id))
    .map((s) => (renameOverrides[s.id] ? { ...s, zh: renameOverrides[s.id], ja: renameOverrides[s.id] } : s))
    .concat(pendingSubs.filter((p) => !rawSubs.some((s) => s.code === p.code) && !deletedIds.has(p.id)))

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
    if (editingCode === '__new__') {
      // id/code本来就是纯本地生成，不用等insert请求真的落库就能先切回展示态、
      // 本地摆上新胶囊——insert在后台跑，失败再把这个乐观项撤回来
      const sub = buildNewSubcategory(label)
      const catCode = selectedCat.code
      setPendingSubsByCat((o) => ({ ...o, [catCode]: [...(o[catCode] ?? []), sub] }))
      onSelectSub(sub.code)
      setEditingCode(null)
      setInputValue('')
      insertCustomSubcategory(catCode, sub, userId)
        .then(() => onCatalogChanged().catch((e) => console.error('目录后台刷新失败', e)))
        .catch((e) => {
          console.error('自定义细分新增失败', e)
          setPendingSubsByCat((o) => ({ ...o, [catCode]: (o[catCode] ?? []).filter((s) => s.id !== sub.id) }))
        })
      return
    }
    if (!editingCode) return
    try {
      await updateCustomSubcategory(editingCode, label)
      setRenameOverrides((o) => ({ ...o, [editingCode]: label }))
      setEditingCode(null)
      setInputValue('')
      onCatalogChanged().catch((e) => console.error('目录后台刷新失败', e))
    } catch (e) {
      console.error('自定义细分保存失败', e)
    }
  }

  function handleDelete(subId: string, subCode: string) {
    if (!userId) return
    setDeletedIds((s) => new Set(s).add(subId))
    if (selectedSubCode === subCode) onSelectSub(null)
    setOpenMenuCode(null)
    deleteCustomSubcategory(subId)
      .then(() => onCatalogChanged())
      .catch((e) => {
        console.error('自定义细分删除失败', e)
        setDeletedIds((s) => {
          const next = new Set(s)
          next.delete(subId)
          return next
        })
      })
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
        <div className="flex flex-wrap gap-2" ref={subListRef}>
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
                  {/* 照旧App.sub-mini-btn.sub-confirm真实样式：22px圆形实心jade底(跟这套
                      主题token里的--color-secondary正好是同一个色值)+白色对勾，不是纯文字
                      色图标；:active scale(0.88)+opacity(0.7)也是旧App原有的按压反馈 */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={confirmEdit}
                    className="w-[22px] h-[22px] rounded-full border border-outline-variant bg-secondary text-on-secondary flex items-center justify-center shrink-0 active:scale-[0.88] active:opacity-70 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[13px]">check</span>
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
                  <div
                    data-sub-menu-popover
                    className="absolute z-20 top-[22px] -right-1.5 bg-surface-container border border-outline-variant rounded-[10px] shadow-lg overflow-hidden min-w-[92px]"
                  >
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
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={confirmEdit}
                className="w-[22px] h-[22px] rounded-full border border-outline-variant bg-secondary text-on-secondary flex items-center justify-center shrink-0 active:scale-[0.88] active:opacity-70 transition-transform"
              >
                <span className="material-symbols-outlined text-[13px]">check</span>
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
