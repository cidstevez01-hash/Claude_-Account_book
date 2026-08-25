import { useRef, useState } from 'react'
import { addCustomTag, updateCustomTag, deleteCustomTag } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { tagLabel } from '../../lib/catalogLabel'
import type { EntryType, Tag } from '../../types'

interface TagPickerProps {
  tags: Tag[]
  type: EntryType
  selectedTagCode: string | null
  onSelectTag: (code: string | null) => void
  userId: string | null
  onCatalogChanged: () => Promise<void>
}

/** 标签选择——单选，再点一下已选中的会取消选中(照旧App"标签允许不选"的逻辑)。
 * 自定义标签支持内联新增/改名/删除，逻辑照旧仓库index.html的renderTagGrid()搬；
 * 预设标签(is_preset=true)显示锁形小图标，不给编辑/删除入口 */
export function TagPicker({ tags, type, selectedTagCode, onSelectTag, userId, onCatalogChanged }: TagPickerProps) {
  const { t, lang } = useI18n()
  const [editingCode, setEditingCode] = useState<string | null>(null) // tag.id 或 '__new__'
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  // 照旧仓库index.html的bindInlineTagInput()真实逻辑搬(跟CategoryPicker的子分类
  // 输入框是同一套写法)：确认按钮/回车/点别处失焦(blur)三条路都能提交，没有单独
  // 的取消按钮(旧App也没有)。同一次编辑只能真正提交一次——用settledRef挡住重复触发
  const settledRef = useRef(true)

  function startAdd() {
    settledRef.current = false
    setEditingCode('__new__')
    setInputValue('')
    setOpenMenuCode(null)
  }
  function startEdit(tagId: string, currentLabel: string) {
    settledRef.current = false
    setEditingCode(tagId)
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
    if (!label || !userId) {
      setEditingCode(null)
      setInputValue('')
      return
    }
    try {
      if (editingCode === '__new__') {
        const tag = await addCustomTag(type, label, userId)
        // 同CategoryPicker.tsx确认按钮那处修复：必须等catalog真刷新完再切回展示态，
        // 不然会先用刷新前的旧tags props闪一下错误内容，等网络请求落地才变成正确名字
        await onCatalogChanged()
        onSelectTag(tag.code)
      } else if (editingCode) {
        await updateCustomTag(editingCode, label)
        await onCatalogChanged()
      }
      setEditingCode(null)
      setInputValue('')
    } catch (e) {
      console.error('自定义标签保存失败', e)
    }
  }

  async function handleDelete(tagId: string, tagCode: string) {
    if (!userId) return
    try {
      await deleteCustomTag(tagId)
      if (selectedTagCode === tagCode) onSelectTag(null)
      onCatalogChanged()
    } catch (e) {
      console.error('自定义标签删除失败', e)
    }
    setOpenMenuCode(null)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        if (editingCode === tag.id) {
          return (
            <span key={tag.id} className="flex items-center gap-1">
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                onBlur={confirmEdit}
                className="py-1.5 px-2.5 rounded-lg border border-primary bg-surface text-tab-label font-sans w-20 focus:outline-none"
              />
              {/* 照旧App.sub-mini-btn.sub-confirm真实样式：22px圆形实心jade底(跟这套
                  主题token里的--color-secondary正好是同一个色值)+白色对勾；:active
                  scale(0.88)+opacity(0.7)也是旧App原有的按压反馈 */}
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
        const active = tag.code === selectedTagCode
        if (tag.custom) {
          // R-XX：跟CategoryPicker.tsx的子分类"⋯"菜单改成同一套结构/样式(照旧App
          // .sub-menu-btn/.sub-menu-popover真实值)——之前这里是"胶囊+分体more_horiz
          // 按钮"拼接样式，跟子分类那套18px浮动圆形"⋯"徽标完全是两套不同设计，用户
          // 反馈两处不搭调，统一成子分类那套(以旧App为准，两处本来就是同一个组件)
          const menuOpen = openMenuCode === tag.code
          return (
            <span key={tag.id} className="relative inline-flex">
              <button
                type="button"
                onClick={() => onSelectTag(active ? null : tag.code)}
                className={`py-1.5 px-2.5 rounded-lg text-tab-label font-sans border transition-colors ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container border-secondary/40'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}
              >
                #{tagLabel(tag, lang)}
              </button>
              <button
                type="button"
                onClick={() => setOpenMenuCode(menuOpen ? null : tag.code)}
                className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-on-surface-variant text-surface text-[11px] font-bold border-2 border-surface flex items-center justify-center leading-none"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute z-20 top-[22px] -right-1.5 bg-surface-container border border-outline-variant rounded-[10px] shadow-lg overflow-hidden min-w-[92px]">
                  <button
                    type="button"
                    onClick={() => startEdit(tag.id, tagLabel(tag, lang))}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-on-surface whitespace-nowrap w-full"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    {t('editLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tag.id, tag.code)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-primary whitespace-nowrap w-full"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    {t('deleteLabel')}
                  </button>
                </div>
              )}
            </span>
          )
        }
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(active ? null : tag.code)}
            className={`py-1.5 px-2.5 rounded-lg text-tab-label font-sans border transition-colors ${
              active
                ? 'bg-secondary-container text-on-secondary-container border-secondary/40'
                : 'bg-surface-container text-on-surface-variant border-outline-variant'
            }`}
          >
            #{tagLabel(tag, lang)}
          </button>
        )
      })}

      {editingCode === '__new__' ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            onBlur={confirmEdit}
            placeholder={t('newTagPlaceholder')}
            className="py-1.5 px-2.5 rounded-lg border border-primary bg-surface text-tab-label font-sans w-20 focus:outline-none"
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
        userId && (
          <button
            type="button"
            onClick={startAdd}
            className="py-1.5 px-2.5 rounded-lg border border-dashed border-primary text-primary text-tab-label font-sans flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            {t('tagsLabel')}
          </button>
        )
      )}
    </div>
  )
}
