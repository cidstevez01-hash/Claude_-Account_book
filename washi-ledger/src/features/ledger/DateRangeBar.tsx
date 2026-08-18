interface DateRangeBarProps {
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
}

/** 照design-assets-v2/_44：两个带日历图标的输入框+"~"分隔符。
 * 先做视觉+"点左/右字段切换上/下个月"这个最小可用交互，真正的日期范围选择器
 * (点开弹出日历/自定义起止)是后续工作，不在这一轮范围内。 */
export function DateRangeBar({ monthLabel, onPrevMonth, onNextMonth }: DateRangeBarProps) {
  return (
    <div className="mx-md mt-md mb-2">
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex-1 flex items-center gap-2 bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant text-left"
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
          <span className="font-serif text-body-lg text-on-surface">{monthLabel}</span>
        </button>
        <span className="text-on-surface-variant font-bold">~</span>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex-1 flex items-center gap-2 bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant text-left"
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
          <span className="font-serif text-body-lg text-on-surface">{monthLabel}</span>
        </button>
      </div>
    </div>
  )
}
