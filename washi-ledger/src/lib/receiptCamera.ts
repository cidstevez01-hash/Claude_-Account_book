import { DocumentScanner, ResponseType, ScanDocumentResponseStatus } from '@capgo/capacitor-document-scanner'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { logIfEnabled } from './appLog'

/** R-32三期：拍照页面改成调用系统原生文档扫描能力(iOS VisionKit/Android ML Kit)。
 * 排查确认OpenCV.js这条路径本身在这台设备的Worker环境里，运行时初始化(不是加载
 * 方式)就要超过35秒卡死——市面上真正的扫描App在iOS上根本不跑这类WASM库，直接调
 * VNDocumentCameraViewController这个系统原生能力：硬件加速、零加载时间、自带实时
 * 边缘检测/透视校正，用@capgo/capacitor-document-scanner这个维护中的Capacitor插件
 * 封装调用。前一版自建的webcam取景界面(getUserMedia+<video>)不再需要——原生扫描器
 * 自己就是一个完整的系统级全屏界面，取代了自建取景+OpenCV.js边缘检测这整套。
 *
 * Web端(沙盒/浏览器预览)没有这个原生能力，插件的web fallback会直接抛
 * "Document scanning is not supported on the web."——不是bug，是插件本身的
 * 设计，调用方要兜底改用相册选图，这也是沙盒/桌面浏览器开发调试时唯一能走通的路径 */
export async function scanDocumentNative(): Promise<Blob | null> {
  logIfEnabled('调用DocumentScanner.scanDocument()')
  const result = await DocumentScanner.scanDocument({
    responseType: ResponseType.Base64,
    letUserAdjustCrop: true,
    maxNumDocuments: 1,
  })
  if (result.status !== ScanDocumentResponseStatus.Success || !result.scannedImages?.length) {
    logIfEnabled('DocumentScanner返回取消/无结果')
    return null
  }
  logIfEnabled(`DocumentScanner扫描成功，图片base64长度=${result.scannedImages[0].length}字符`)
  const res = await fetch(`data:image/jpeg;base64,${result.scannedImages[0]}`)
  return await res.blob()
}

/** 从系统相册选图——用户可能没随身带着レシート本体、想挑一张之前拍过的照片；
 * 同时也是原生扫描器在Web端/权限被拒绝时的兜底路径。Web端(沙盒/浏览器预览)没有
 * 原生相册，Capacitor会自动降级成<input type="file" accept="image/*">这个网页
 * 兼容实现，行为等价。 */
export async function pickFromGallery(): Promise<Blob | null> {
  logIfEnabled('调用Camera.getPhoto()从相册选图')
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    quality: 85,
  })
  if (!photo.dataUrl) {
    logIfEnabled('Camera.getPhoto()返回无dataUrl(用户取消选图)')
    return null
  }
  logIfEnabled(`相册选图返回dataUrl，长度=${photo.dataUrl.length}字符，开始转Blob`)
  const res = await fetch(photo.dataUrl)
  const blob = await res.blob()
  logIfEnabled(`dataUrl转Blob完成，blob.size=${blob.size}字节`)
  return blob
}
