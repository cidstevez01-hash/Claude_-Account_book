import { useState } from 'react'
import { formatDateRangeLabel } from '../../lib/date'
import { RangeCalendarPicker } from './RangeCalendarPicker'

interface DateRangeBarProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

/** 起止日期范围选择器——原来是原生<input type="date">两个框各自唤起系统选择器
 * (R-27第一版)，现在换成自绘日历(R-27最终版，见Smartsheet备注)：单个触发框(不再是
 * "起~止"两个框)，点开弹出RangeCalendarPicker真正做区间选择，起止两次点击都在
 * 同一个月历上完成，不用来回切换输入框。
 *
 * 换成自绘的原因：原生<input type="date">展开态的月份/星期文字跟随设备系统语言，
 * 没有API能改成跟App自己的中/日语言设置一致；而且原生选择器一次只能选一个日期，
 * 做不出"同一张月历上直接看到区间高亮"的效果，长区间(比如"过去一年")也没法在原生
 * 选择器里给一个直观的整体视图。自绘日历用--color-primary等主题token，怀旧主题
 * 换什么颜色这里的选中高亮跟着变，不是写死的颜色。 */
export function DateRangeBar({ startDate, endDate, onChange }: DateRangeBarProps) {
  const [open, setOpen] = useState(false)
  const label = formatDateRangeLabel(startDate, endDate)
  // "Y年M月"这种单一标签(没有~)整体居中就行；"起 ~ 止"这种两段式的，空白不该整体
  // 平分在两侧(那样看起来像文字随便贴在中间)，应该让~本身两边留白——起止两段文字
  // 各自紧贴左右两端天然的宽度，中间flex-1的~把剩余空间都吃掉，效果类似原来两个
  // 输入框中间那道分隔线的观感，不是新拍脑袋的样式
  const isRange = label.includes(' ~ ')
  const [startLabel, endLabel] = isRange ? label.split(' ~ ') : [label, null]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 w-full bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant ${
          isRange ? '' : 'justify-center'
        }`}
      >
        <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">calendar_today</span>
        {isRange ? (
          <>
            <span className="shrink-0 font-serif text-body-lg text-on-surface">{startLabel}</span>
            <span className="flex-1 text-center font-serif text-body-lg text-on-surface-variant">~</span>
            <span className="shrink-0 font-serif text-body-lg text-on-surface">{endLabel}</span>
          </>
        ) : (
          <span className="min-w-0 font-serif text-body-lg text-on-surface truncate">{startLabel}</span>
        )}
      </button>
      <RangeCalendarPicker
        open={open}
        startDate={startDate}
        endDate={endDate}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
