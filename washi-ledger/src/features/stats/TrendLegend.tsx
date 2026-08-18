import { ScrollLegendList } from '../../design-system/components/ScrollLegendList'
import type { TrendBucket, TrendLegendItem } from '../../data/summary'

interface TrendLegendProps {
  aggregate: TrendLegendItem[]
  selectedBucket: TrendBucket | null
  valuePrefix?: string
  onSelectCategory?: (catCode: string) => void
  onClosePoint?: () => void
  /** 聚合图例数据源整体切换时(比如切换按日/按月、切换收支类型、翻月年)传一个变化的
   * 值进来，图例滚动位置跟着回到顶部 */
  resetKey?: string | number
}

/** 趋势图下方的图例区——默认显示可见范围内的聚合图例(点一行钻取该分类明细)；点了某根
 * 柱子之后，切换成显示那一根柱子自己的分类拆分(替换掉聚合图例，不是弹窗)，逻辑照旧App
 * showTrendPointInfo()的"trendCatLegend隐藏、trendPointInfo顶上来"这套切换来 */
export function TrendLegend({
  aggregate,
  selectedBucket,
  valuePrefix = '¥',
  onSelectCategory,
  onClosePoint,
  resetKey,
}: TrendLegendProps) {
  if (selectedBucket) {
    return (
      <div className="mt-sm">
        <div className="flex items-center justify-between border-b border-dashed border-outline-variant pb-1 mb-2">
          <span className="text-body-lg text-on-surface">{selectedBucket.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-stat-figure text-primary">
              {valuePrefix}
              {selectedBucket.total.toLocaleString()}
            </span>
            <button type="button" onClick={onClosePoint} aria-label="关闭" className="text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
        {selectedBucket.detailSegments.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center py-2">这天还没有记录</p>
        ) : (
          <ScrollLegendList key={selectedBucket.label} rowHeight={30}>
            <div className="flex flex-col gap-1">
              {selectedBucket.detailSegments.map((seg) => (
                <div key={seg.key} className="flex items-center gap-2 py-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-body-md text-on-surface flex-1">{seg.label}</span>
                  <span className="text-body-md text-on-surface-variant">
                    {valuePrefix}
                    {seg.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollLegendList>
        )}
      </div>
    )
  }

  if (aggregate.length === 0) return null

  return (
    <ScrollLegendList key={resetKey} rowHeight={30}>
      <div className="flex flex-col gap-1 mt-sm">
        {aggregate.map((item) => (
          <div
            key={item.key}
            role={onSelectCategory ? 'button' : undefined}
            tabIndex={onSelectCategory ? 0 : undefined}
            onClick={onSelectCategory ? () => onSelectCategory(item.key) : undefined}
            className="flex items-center gap-2 py-1 text-left"
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-body-md text-on-surface flex-1">{item.label}</span>
            <span className="text-tab-label font-sans text-on-surface-variant mr-2">{Math.round(item.ratio * 100)}%</span>
            <span className="text-body-md text-on-surface-variant">
              {valuePrefix}
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </ScrollLegendList>
  )
}
