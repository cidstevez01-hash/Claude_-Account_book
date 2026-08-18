import type { TrendBucket } from '../../data/summary'

interface TrendBarChartProps {
  buckets: TrendBucket[]
  height?: number
}

const BAR_W = 20
const BAR_GAP = 10
const GROUP_W = BAR_W + BAR_GAP
const GRID_STEPS = 4

/** 横向可滚动的分段堆叠柱状图——照旧仓库index.html的renderTrendChart()做，但做了
 * 简化：纵轴刻度用"这段时间(整月/整年)里的最大值"算一次固定死，不像旧App那样跟着
 * 横向滚动视口实时重算刻度(那套逻辑接近200行，且需要监听scroll事件动态改DOM属性，
 * 这次没有照搬)；也没有点柱子弹出单日明细的交互(旧App的showTrendPointInfo)。
 * 分段堆叠、颜色、横向滚动这些核心视觉/数据层面照旧App来，不是瞎画的。 */
export function TrendBarChart({ buckets, height = 180 }: TrendBarChartProps) {
  const top = 14
  const base = height - 40
  const maxVal = Math.max(1, ...buckets.map((b) => b.total))
  const totalW = Math.max(300, buckets.length * GROUP_W + 20)

  const gridTicks = Array.from({ length: GRID_STEPS + 1 }, (_, s) => {
    const gy = base - (s / GRID_STEPS) * (base - top)
    const gv = Math.round((s / GRID_STEPS) * maxVal)
    return { gy, label: gv >= 1000 ? `${(gv / 1000).toFixed(1)}k` : String(gv) }
  })

  return (
    <div className="flex" style={{ height }}>
      <div className="relative shrink-0 w-8">
        {gridTicks.map((tick, i) => (
          <span
            key={i}
            className="absolute -translate-y-1/2 text-[10px] font-sans text-on-surface-variant"
            style={{ top: tick.gy }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div className="flex-1 overflow-x-auto">
        <svg viewBox={`0 0 ${totalW} ${height}`} width={totalW} height={height} style={{ display: 'block' }}>
          {gridTicks.map((tick, i) => (
            <line
              key={i}
              x1={0}
              y1={tick.gy}
              x2={totalW - 8}
              y2={tick.gy}
              stroke="var(--color-outline-variant)"
              strokeWidth={1}
              strokeDasharray="2,3"
            />
          ))}
          {buckets.map((b, i) => {
            const x0 = 10 + i * GROUP_W
            let stackTop = base
            return (
              <g key={b.key}>
                {b.segments.map((seg) => {
                  const h = Math.min((seg.value / maxVal) * (base - top), base - top)
                  const y = stackTop - h
                  stackTop = y
                  return <rect key={seg.key} x={x0} y={y} width={BAR_W} height={h} rx={3} fill={seg.color} />
                })}
                <text x={x0 + BAR_W / 2} y={base + 16} fontSize={10} fill="var(--color-on-surface-variant)" textAnchor="middle">
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
