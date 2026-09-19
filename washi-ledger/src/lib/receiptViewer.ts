import { FileViewer } from '@capacitor/file-viewer'
import { logIfEnabled } from './appLog'

/** R-32续：レシート凭证预览——之前用<iframe>内嵌PDF+自绘HTML弹层，真机反馈内容撑爆
 * 没有标题栏/圆角/遮罩，改过一次iframe定位(position:absolute+inset:0)仍然复现，
 * 调研确认根源是iOS WKWebView加载跨域内容(Supabase Storage签名URL跟App本身不同源)
 * 的iframe本身就有已知的渲染/尺寸问题，不是CSS没写对——这条技术路线在iOS Capacitor
 * App里从根上就不可靠。跟R-32扫描功能最早自建WebView方案反复修不好、最后换原生插件
 * (VisionKit)才彻底解决是同一类坑，这次同样换成原生插件：`@capacitor/file-viewer`
 * (ionic-team官方维护)调用系统原生QuickLook全屏预览器，`openDocumentFromUrl()`
 * 直接支持远程URL，不需要先手动下载到本地文件(不用额外装@capacitor/filesystem)。
 *
 * Web端(沙盒/浏览器预览)没有这个原生能力，插件的web stub会直接抛错——调用方要兜底
 * 改用ReceiptPreviewSheet.tsx那套HTML弹层，这也是沙盒/桌面浏览器开发调试时唯一能
 * 走通的路径，照抄receiptCamera.ts里scanDocumentNative()同一套"原生优先、web端兜底"
 * 的调用惯例，不新造一套模式 */
export async function openReceiptDocumentNative(url: string): Promise<boolean> {
  try {
    logIfEnabled(`调用FileViewer.openDocumentFromUrl() url=${url}`)
    await FileViewer.openDocumentFromUrl({ url })
    return true
  } catch (e) {
    logIfEnabled(`FileViewer.openDocumentFromUrl()失败(web端预期内会走到这里): ${e instanceof Error ? e.message : String(e)}`, 'error')
    return false
  }
}
