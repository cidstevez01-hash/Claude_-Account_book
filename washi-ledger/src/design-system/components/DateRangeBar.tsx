import { useRef } from 'react'
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
 * 文字必须自己生成、不能依赖原生渲染。展开态(选择器弹出的那一刻)的月份/星期文字是
 * 浏览器原生渲染的，没有API能改成跟App语言一致，这是原生控件本身的限制，R-27最终
 * 决定接受这个取舍(换一版自绘日历的方案被否了，见Smartsheet备注)。
 *
 * 校验规则用`min`/`max`属性在原生选择器层面就拦住不合规的选择(起始日不能选到晚于当前
 * 结束日、结束日不能选到早于当前起始日)，不需要选完了再弹提示——用户在原生选择器里
 * 根本看不到不合规的日期可选。onChange里再兜底一次校验+"不可为空"，双重保险。
 *
 * R-27：选完开始日期后自动弹出结束日期的原生选择器，不用用户再手动点第二个输入框——
 * `showPicker()`是iOS Safari 16.4+/现代浏览器才有的API，旧版本没有这个方法，调用前
 * 判断一下是不是function，没有就退化成只focus(不强制弹出，但至少把焦点给到第二个框，
 * 用户自己点一下也能弹出，不会比原来更差)。真机测试过在这层调用链里(上一个原生
 * 选择器onChange触发的这一刻)算用户交互链路内，WebKit没有拦截自动弹出的第二个picker。 */
export function DateRangeBar({ startDate, endDate, onChange }: DateRangeBarProps) {
  const endInputRef = useRef<HTMLInputElement>(null)

  function handleStartChange(value: string) {
    if (!value) return // 不可为空，忽略清空操作(原生日期输入清空后value会变成'')
    if (value > endDate) return // min/max属性已经在选择器层面拦住了，这里是双重保险
    onChange(value, endDate)
    const endInput = endInputRef.current
    if (endInput) {
      if (typeof endInput.showPicker === 'function') {
        try {
          endInput.showPicker()
        } catch (e) {
          console.error('自动弹出结束日期选择器失败', e)
          endInput.focus()
        }
      } else {
        endInput.focus()
      }
    }
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
          ref={endInputRef}
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
