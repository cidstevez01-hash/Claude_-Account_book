interface MonthNavBarProps {
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
}

/** 单月导航条——照design-assets-v2/_12的"‹ October 2023 ›"胶囊样式，统计页的收支/积分
 * 两个分栏共用同一个月份状态，不用各自维护一份 */
export function MonthNavBar({ monthLabel, onPrevMonth, onNextMonth }: MonthNavBarProps) {
  return (
    <div className="mx-md flex items-center justify-between bg-surface-container-low border border-outline-variant rounded-xl px-md py-3">
      <button type="button" aria-label="上个月" onClick={onPrevMonth} className="text-on-surface-variant">
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <span className="font-serif text-body-lg text-on-surface">{monthLabel}</span>
      <button type="button" aria-label="下个月" onClick={onNextMonth} className="text-on-surface-variant">
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  )
}
