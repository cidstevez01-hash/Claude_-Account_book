import { DonutRing } from '../../design-system/components/DonutRing'
import type { PaymentPointsShare } from '../../data/summary'

interface PointsDonutCardProps {
  shares: PaymentPointsShare[]
}

/** 积分内訳(按支付方式)——照旧仓库index.html的renderPointsDonut()真实逻辑做，不是
 * Stitch设计稿_39/_42里那个虚构的"Shopping Rewards/Travel Redemptions"分类(数据库里
 * 没有这个维度，积分数据只挂在支付方式上，不能瞎编一套假分类出来) */
export function PointsDonutCard({ shares }: PointsDonutCardProps) {
  const total = shares.reduce((sum, s) => sum + s.points, 0)

  return (
    <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
      <h3 className="font-serif text-headline-md text-on-surface mb-3">积分内訳(按支付方式)</h3>

      {shares.length === 0 ? (
        <p className="text-center text-body-md text-on-surface-variant py-8">这个月还没有积分记录</p>
      ) : (
        <div className="flex flex-col items-center py-2">
          <div className="relative w-48 h-48 mb-3">
            <DonutRing shares={shares.map((s) => ({ key: s.payCode, color: s.color, ratio: s.ratio }))} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-sans text-on-surface-variant uppercase">Total Points</span>
              <span className="font-serif text-stat-figure text-primary">{total.toLocaleString()} pt</span>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 w-full px-2 mt-2">
            {shares.map((share) => (
              <div
                key={share.payCode}
                className="flex items-center gap-3 py-1 border-b border-dashed border-outline-variant/30"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: share.color }} />
                <span className="text-body-md text-on-surface flex-1">{share.label}</span>
                <span className="text-stat-figure text-xs text-on-surface-variant mr-4">
                  {Math.round(share.ratio * 100)}%
                </span>
                <span className="font-serif text-stat-figure text-on-surface">+{share.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
