import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { logIfEnabled } from './appLog'

/** R-32二期：拍照页面改成自建取景界面——原来用@capacitor/camera的CameraSource.Prompt
 * 会弹系统原生相机，JS层完全拿不到实时画面，没法做后续可能的实时边界检测；换成
 * getUserMedia()+<video>自建取景器。这一步只做取景本身(暂不带实时检测框)，识别框
 * 留到这一步做完后单独评估是否可行。
 *
 * "从相册选择"跟拍照分开成两个独立入口，选图部分仍用@capacitor/camera的
 * CameraSource.Photos——Web端(沙盒/浏览器预览)没有原生相册，Capacitor会自动降级成
 * <input type="file" accept="image/*">这个网页兼容实现，行为等价。 */
export async function openCameraStream(): Promise<MediaStream> {
  logIfEnabled('调用getUserMedia()打开取景摄像头')
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  })
  logIfEnabled('getUserMedia()取景摄像头已就绪')
  return stream
}

export function stopCameraStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
  logIfEnabled('取景摄像头已关闭')
}

/** 把<video>当前帧画到canvas转成Blob——取代原来Camera.getPhoto()拍照返回的
 * dataUrl，跟下游(边缘检测/PDF生成)统一走Blob这个"货币" */
export function captureFrameFromVideo(video: HTMLVideoElement): Promise<Blob> {
  logIfEnabled(`捕获取景帧，videoWidth=${video.videoWidth}, videoHeight=${video.videoHeight}`)
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('无法创建canvas 2D上下文'))
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          logIfEnabled(`取景帧转Blob完成，blob.size=${blob.size}字节`)
          resolve(blob)
        } else {
          reject(new Error('取景帧转Blob失败'))
        }
      },
      'image/jpeg',
      0.9
    )
  })
}

/** 从系统相册选图——用户可能没随身带着レシート本体、想挑一张之前拍过的照片，
 * 不强制一定要现场拍 */
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
