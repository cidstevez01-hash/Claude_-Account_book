import { supabase } from '../lib/supabase'

/** R-32：レシート存档PDF的Supabase Storage读写——这块直接走supabase-js(不经过
 * washi-ledger/worker/那个自建后端)，因为前后端分家目前只做了entries一个资源
 * (phase 1，见worker/README.md)，Storage这类非entries的数据这次不在改造范围内，
 * 照其它非entries数据(catalog/settings)的既有做法，继续直接连Supabase。
 *
 * bucket名字固定'receipts'，是private的(不是public bucket)——不能像public bucket
 * 那样拼一个固定URL直接访问，每次要看都得现签一个有效期内的URL(见getReceiptUrl)。
 * bucket本身、以及"用户只能读写自己文件夹下的文件"这条RLS策略，都需要在Supabase
 * 后台手动建一次(不是这里的代码能建的)，具体SQL见worker/RECEIPT_STORAGE_SETUP.md。
 *
 * 文件路径约定`${userId}/${entryId}/${uuid}.pdf`——R-41前是`${userId}/${entryId}.pdf`
 * (每条记录最多一份凭证，重新扫描覆盖同一路径)，多图上传后一条记录能有多张凭证，
 * 必须各自是独立文件名，不能再互相覆盖；多加一层entryId子目录纯粹是保持同一条
 * 记录的凭证归堆在一起方便人工在Supabase Storage后台找，不是权限需要——RLS策略
 * (见worker/RECEIPT_STORAGE_SETUP.md)只按第一级目录(userId)校验，这次路径改动
 * 不需要改权限策略 */
const BUCKET = 'receipts'

function pathFor(userId: string, entryId: string): string {
  return `${userId}/${entryId}/${crypto.randomUUID()}.pdf`
}

export async function uploadReceiptPdf(userId: string, entryId: string, pdf: Blob): Promise<string> {
  const path = pathFor(userId, entryId)
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
  })
  if (error) throw error
  return path
}

export async function deleteReceiptPdf(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

/** 签名URL——private bucket的正确打开方式，有效期内(这里给1小时，够用户点开看一眼)
 * 才能访问，不是永久有效的公开链接 */
export async function getReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
