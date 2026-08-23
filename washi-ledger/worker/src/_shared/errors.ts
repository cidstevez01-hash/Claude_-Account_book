/** 统一的HTTP错误——handlers里throw这个，index.ts的错误处理中间件统一转成
 * {error: message}的JSON响应，不用每个handler自己拼错误响应格式 */
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
