import { useState } from 'react'
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
  onCatalogChanged: () => void
}

/** 标签选择——单选，再点一下已选中的会取消选中(照旧App"标签允许不选"的逻辑)。
 * 自定义标签支持内联新增/改名/删除，逻辑照旧仓库index.html的renderTagGrid()搬；
 * 预设标签(is_preset=true)显示锁形小图标，不给编辑/删除入口 */
export function TagPicker({ tags, type, selectedTagCode, onSelectTag, userId, onCatalogChanged }: TagPickerProps) {
  const { t, lang } = useI18n()
  const [editingCode, setEditingCode] = useState<string | null>(null) // tag.id 或 '__new__'
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  function startAdd() {
    setEditingCode('__new__')
    setInputValue('')
    setOpenMenuCode(null)
  }
  function startEdit(tagId: string, currentLabel: string) {
    setEditingCode(tagId)
    setInputValue(currentLabel)
    setOpenMenuCode(null)
  }
  function cancelEdit() {
    setEditingCode(null)
    setInputValue('')
  }

  async function confirmEdit() {
    const label = inputValue.trim()
    if (!label || !userId || saving) return
    setSaving(true)
    try {
      if (editingCode === '__new__') {
        const tag = await addCustomTag(type, label, userId)
        onCatalogChanged()
        onSelectTag(tag.code)
      } else if (editingCode) {
        await updateCustomTag(editingCode, label)
        onCatalogChanged()
      }
      cancelEdit()
    } catch (e) {
      console.error('自定义标签保存失败', e)
    } finally {
      setSaving(false)
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
                onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                className="py-1.5 px-2.5 rounded-lg border border-primary bg-surface text-tab-label font-sans w-20 focus:outline-none"
              />
              <button type="button" onClick={confirmEdit} disabled={saving} className="text-primary">
                <span className="material-symbols-outlined text-[18px]">check</span>
              </button>
            </span>
          )
        }
        const active = tag.code === selectedTagCode
        if (tag.custom) {
          const menuOpen = openMenuCode === tag.code
          return (
            <span key={tag.id} className="relative">
              <span className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectTag(active ? null : tag.code)}
                  className={`py-1.5 pl-2.5 pr-1 rounded-l-lg text-tab-label font-sans border ${
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
                  className={`py-1.5 px-1 rounded-r-lg border border-l-0 ${
                    active
                      ? 'bg-secondary-container text-on-secondary-container border-secondary/40'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">more_horiz</span>
                </button>
              </span>
              {menuOpen && (
                <div className="absolute z-20 top-full left-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => startEdit(tag.id, tagLabel(tag, lang))}
                    className="flex items-center gap-2 px-3 py-2 text-body-md text-on-surface whitespace-nowrap w-full"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    {t('editLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tag.id, tag.code)}
                    className="flex items-center gap-2 px-3 py-2 text-body-md text-primary whitespace-nowrap w-full"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
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
            onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
            placeholder={t('newTagPlaceholder')}
            className="py-1.5 px-2.5 rounded-lg border border-primary bg-surface text-tab-label font-sans w-20 focus:outline-none"
          />
          <button type="button" onClick={confirmEdit} disabled={saving} className="text-primary">
            <span className="material-symbols-outlined text-[18px]">check</span>
          </button>
          <button type="button" onClick={cancelEdit} className="text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
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
