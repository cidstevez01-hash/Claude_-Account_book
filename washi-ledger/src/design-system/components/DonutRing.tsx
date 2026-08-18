interface DonutRingProps {
  shares: { key: string; color: string; ratio: number }[]
  radius?: number
  strokeWidth?: number
}

const DEFAULT_RADIUS = 40

/** 纯SVG环状图圆环——只画圆环本身，不含图例/中心文字，由调用方组合。
 * 分类环状图(CategoryDonutCard)和积分环状图(PointsDonutCard)共用这份圆环数学，
 * 避免stroke-dasharray/stroke-dashoffset的累加逻辑在两处各写一遍。 */
export function DonutRing({ shares, radius = DEFAULT_RADIUS, strokeWidth = 12 }: DonutRingProps) {
  const circumference = 2 * Math.PI * radius
  let offsetAccum = 0
  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--color-surface-variant)" strokeWidth={strokeWidth} />
      {shares.map((share) => {
        const dash = share.ratio * circumference
        const el = (
          <circle
            key={share.key}
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={share.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={-offsetAccum}
          />
        )
        offsetAccum += dash
        return el
      })}
    </svg>
  )
}
