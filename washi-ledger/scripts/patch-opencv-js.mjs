// R-32：给node_modules里的@techstark/opencv-js打的字符串替换式补丁(不用patch-package，
// 因为要改的只有文件末尾一处初始化片段，直接字符串替换比维护一份二进制diff更直观、
// 更容易审查)。作为package.json的postinstall脚本，每次npm install/npm ci(含CI里)都会
// 自动重新应用，不用手动记得跑。
//
// 背景：真机日志实测确认，这个包加载OpenCV.js时会把内嵌约8MB base64编码的WASM数据
// 同步解码成二进制，这段同步解码会把执行它的线程完全占住(哪怕是Worker线程自己的
// setInterval心跳也完全插不进去)——不是"慢"，是这台设备上这段同步代码卡死不动。
// OpenCV.js官方发布默认也是这种SINGLE_FILE内嵌base64格式(build_js.py确认)，没有
// 现成的"独立.wasm异步加载"版本可以直接换。
//
// 这个包内部其实支持Emscripten标准的Module.instantiateWasm钩子(能完全接管WASM
// 实例化方式)，只是作者在文件末尾把Module写死成局部空对象、没给外部注入配置的口子：
//   if (typeof Module === 'undefined') var Module = {};
//   return cv(Module);
// 这个补丁把它改成优先读取self.__CV_MODULE_OVERRIDE__(如果调用方提前设置过的话)，
// 这样receiptEdgeDetectWorker.ts就能在import()之前注入自己的instantiateWasm实现，
// 改成fetch(''/opencv.wasm'')+WebAssembly.instantiateStreaming()真异步加载，不再
// 经过内嵌base64这条同步解码路径。public/opencv.wasm是从这同一个版本的opencv.js里
// 用脚本一次性提取出来的原始WASM二进制，跟包版本强绑定——升级这个npm包版本时要
// 重新提取一份新的public/opencv.wasm，不然WASM导出的函数签名可能跟JS glue代码对不上。

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetPath = path.resolve(__dirname, '../node_modules/@techstark/opencv-js/dist/opencv.js')

const OLD_TAIL = `  if (typeof Module === 'undefined')\n    var Module = {};\n  return cv(Module);\n}));\n`
const NEW_TAIL = `  if (typeof Module === 'undefined')\n    var Module = (typeof self !== 'undefined' && self.__CV_MODULE_OVERRIDE__) || {};\n  return cv(Module);\n}));\n`
// 补丁生效后文件里会有这段特征字符串，用来判断"已经打过补丁"，重复跑postinstall
// (比如同一次npm install触发多次)时直接跳过，不报错
const ALREADY_PATCHED_MARKER = '__CV_MODULE_OVERRIDE__'

let content
try {
  content = readFileSync(targetPath, 'utf8')
} catch (err) {
  console.error(`[patch-opencv-js] 找不到目标文件，跳过(可能@techstark/opencv-js还没装): ${targetPath}`, err)
  process.exit(0)
}

if (content.includes(ALREADY_PATCHED_MARKER)) {
  console.log('[patch-opencv-js] 已经打过补丁，跳过')
  process.exit(0)
}

if (!content.includes(OLD_TAIL)) {
  console.error(
    '[patch-opencv-js] 没找到预期的原始代码片段——@techstark/opencv-js版本可能变了，\n' +
      '这个字符串替换补丁需要重新对照新版本的文件末尾结构手动调整，不能直接套用。'
  )
  process.exit(1)
}

writeFileSync(targetPath, content.replace(OLD_TAIL, NEW_TAIL), 'utf8')
console.log('[patch-opencv-js] 补丁应用成功')
