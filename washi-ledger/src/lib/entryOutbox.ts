import { upsertEntry } from '../data/catalog'
import type { Entry } from '../types'

// 待确认的保存：保存请求发出前先记到本机，服务器确认后再删掉。如果请求超时或页面被切走，
// 结果可能其实已经写进了服务器，下次打开时用同一个 id 重新提交，后端按 id 去重，不会多出一条
const KEY_PREFIX = 'washi-ledger-entry-outbox'

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`
}

export function loadOutbox(userId: string): Entry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

function saveOutbox(userId: string, list: Entry[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list))
  } catch {
    // 本机存储满了或被禁用时只能放弃这层保护，不能阻塞正常保存
  }
}

export function addToOutbox(userId: string, entry: Entry): void {
  saveOutbox(userId, [...loadOutbox(userId).filter((e) => e.id !== entry.id), entry])
}

export function removeFromOutbox(userId: string, id: string): void {
  saveOutbox(userId, loadOutbox(userId).filter((e) => e.id !== id))
}

// 逐条重新提交待确认的记录，成功一条删一条；遇到失败就停下，下次再试
export async function flushOutbox(userId: string): Promise<void> {
  for (const entry of loadOutbox(userId)) {
    try {
      await upsertEntry(entry, userId)
      removeFromOutbox(userId, entry.id)
    } catch (e) {
      console.error('待确认保存重新提交失败', e)
      return
    }
  }
}
