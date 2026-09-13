import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

/** R-32：拍照/选图入口——用@capacitor/camera，CameraSource.Prompt会弹系统原生的
 * "拍照/从相册选"选择框，用户可能没随身带着レシート本体、想挑一张之前拍过的照片，
 * 不强制一定要现场拍。Web端(沙盒/浏览器预览)没有原生相机，Capacitor会自动降级成
 * <input type="file" accept="image/*" capture>这个网页兼容实现，行为等价。
 *
 * 返回Blob而不是dataUrl字符串——上面这一层(lib/receiptOcr.ts的Tesseract.js、
 * data/receiptStorage.ts的Storage上传)都是直接吃Blob的标准Web API，用Blob做
 * 这一层的统一"货币"，不用调用方各自转换 */
export async function captureReceiptPhoto(): Promise<Blob | null> {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    quality: 85,
    // レシート是文字为主的静态照片，不需要按A4/4:3这类比例裁切，交给用户自己拍多少
    // 算多少，裁切反而可能把小票边角的金额裁掉
  })
  if (!photo.dataUrl) return null
  const res = await fetch(photo.dataUrl)
  return res.blob()
}
