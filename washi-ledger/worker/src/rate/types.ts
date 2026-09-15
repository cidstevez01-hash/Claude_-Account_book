export interface RateHistoryPoint {
  date: string
  rate: number
}

/** GET /rate/history-stats的响应——除了原始逐日点位，还算好了RatePage走势图
 * 卡片要展示的三项衍生统计，前端不用再自己算(见worker/src/rate/handlers.ts
 * 里pctChange/high/low/volatilityPct的具体口径说明)。points长度<1时三项
 * 统计全是null，前端要处理这个"没数据"的展示态 */
export interface RateHistoryStatsResponse {
  base: string
  target: string
  points: RateHistoryPoint[]
  pctChange: number | null
  high: number | null
  low: number | null
  volatilityPct: number | null
}
