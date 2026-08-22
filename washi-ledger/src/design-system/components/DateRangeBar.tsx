import { formatDateFull } from '../../lib/date'

interface DateRangeBarProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

/** 起止日期范围选择器——照design-assets-v2/_44的视觉(两个带日历图标的输入框+"~"分隔符)，
 * 但交互从"点左右字段切换上/下个月"换成真正能自由选起止日期的选择器。仪表盘顶部和明细页
 * 的日期范围筛选是同一个组件、同一套校验逻辑，不是各写一套(#8/#9这两项要求逻辑和样式完全
 * 一致)。
 *
 * 用原生`<input type="date">`触发点击/唤起系统选择器+做min/max校验，但输入框本身透明
 * (opacity:0，只留点击热区)，收起状态显示的文字改成上面盖一层`formatDateFull`生成的
 * "Y年M月D日"——原生输入框收起状态的文字是跟随**设备系统语言**的，跟App内自己切换的
 * 中/日语言设置是两回事，会出现"App设置成中文但选择器显示英文"的错位，所以收起态的
 * 文字必须自己生成、不能依赖原生渲染。
 *
 * 校验规则用`min`/`max`属性在原生选择器层面就拦住不合规的选择(起始日不能选到晚于当前
 * 结束日、结束日不能选到早于当前起始日)，不需要选完了再弹提示——用户在原生选择器里
 * 根本看不到不合规的日期可选。onChange里再兜底一次校验+"不可为空"，双重保险。 */
export function DateRangeBar({ startDate, endDate, onChange }: DateRangeBarProps) {
  function handleStartChange(value: string) {
    if (!value) return // 不可为空，忽略清空操作(原生日期输入清空后value会变成'')
    if (value > endDate) return // min/max属性已经在选择器层面拦住了，这里是双重保险
    onChange(value, endDate)
  }
  function handleEndChange(value: string) {
    if (!value) return
    if (value < startDate) return
    onChange(startDate, value)
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <label className="relative flex-1 flex items-center gap-2 bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">calendar_today</span>
        <span className="flex-1 min-w-0 font-serif text-body-lg text-on-surface truncate">{formatDateFull(startDate)}</span>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => handleStartChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0"
          aria-label="start date"
        />
      </label>
      <span className="text-on-surface-variant font-normal shrink-0">~</span>
      <label className="relative flex-1 flex items-center gap-2 bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">calendar_today</span>
        <span className="flex-1 min-w-0 font-serif text-body-lg text-on-surface truncate">{formatDateFull(endDate)}</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => handleEndChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0"
          aria-label="end date"
        />
      </label>
    </div>
  )
}
