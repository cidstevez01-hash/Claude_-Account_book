import { useState } from 'react'
import type { CategoryShare } from '../../data/summary'
import type { EntryType } from '../../types'

interface CategoryDonutCardProps {
  expenseShares: CategoryShare[]
  incomeShares: CategoryShare[]
}

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CategoryDonutCard({ expenseShares, incomeShares }: CategoryDonutCardProps) {
  const [tab, setTab] = useState<EntryType>('expense')
  const shares = tab === 'expense' ? expenseShares : incomeShares
  const total = shares.reduce((sum, s) => sum + s.amount, 0)

  let offsetAccum = 0

  return (
    <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
      <div className="flex border-b border-dashed border-outline-variant mb-3">
        {(['expense', 'income'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 font-serif text-headline-md transition-colors border-b-2 ${
              tab === key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'
            }`}
          >
            {key === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      {shares.length === 0 ? (
        <p className="text-center text-body-md text-on-surface-variant py-8">这个月还没有记录</p>
      ) : (
        <div className="flex flex-col items-center py-2">
          <div className="relative w-48 h-48 mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={RADIUS} fill="transparent" stroke="var(--color-surface-variant)" strokeWidth="12" />
              {shares.map((share) => {
                const dash = share.ratio * CIRCUMFERENCE
                const el = (
                  <circle
                    key={share.catCode}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="transparent"
                    stroke={share.color}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offsetAccum}
                  />
                )
                offsetAccum += dash
                return el
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-sans text-on-surface-variant uppercase">
                {tab === 'expense' ? 'Total Expenses' : 'Total Income'}
              </span>
              <span className="font-serif text-stat-figure text-primary">
                ¥{total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 w-full px-2 mt-2">
            {shares.map((share) => (
              <div
                key={share.catCode}
                className="flex items-center gap-3 py-1 border-b border-dashed border-outline-variant/30"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: share.color }} />
                <span className="text-body-md text-on-surface flex-1">{share.label}</span>
                <span className="text-stat-figure text-xs text-on-surface-variant mr-4">
                  {Math.round(share.ratio * 100)}%
                </span>
                <span className="font-serif text-stat-figure text-on-surface">¥{share.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
