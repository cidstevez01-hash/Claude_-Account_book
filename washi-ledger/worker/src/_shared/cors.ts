/** 允许调用这个Worker的origin列表——本地Vite dev(默认5173，vite.config.ts没有显式改端口)
 * + iOS Capacitor WebView(不同版本用capacitor://或ionic://前缀，两个都放行)。
 * 错误响应也要走这个origin白名单(见index.ts的onError统一处理)，不然请求在
 * 校验/查询阶段就失败时，浏览器端只会看到笼统的"network error"看不到真实报错内容 */
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'capacitor://localhost',
  'ionic://localhost',
]
