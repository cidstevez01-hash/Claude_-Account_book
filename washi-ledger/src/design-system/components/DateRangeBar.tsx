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
  // B-35：按钮宽度必须保持w-full(用户明确要求，要跟下方其它组件对齐，不能自适应
  // 内容缩窄)，但内容整体居中(justify-center)会把留白甩到最外圈两侧，也不对——
  // 用户参照的是R-27之前"两个独立输入框"那版观感：那时候起/止各自是一个约半宽的
  // 输入框，各自的文字在各自那半个框里居中，留白只跟"半个框的宽度-文字宽度"有关，
  // 不会像单框整组居中那样把一大块留白甩到整条最外侧。改成用两个flex-1的"半区"
  // (起区/止区)各自内部居中自己的内容，"~"卡在两个半区中间，模拟回"两个输入框
  // 各自居中"的比例观感，而不是把"起 ~ 止"当一整块拿去在整条按钮里居中 */
  const [startLabel, endLabel] = formatDateRangeLabel(startDate, endDate).split(' ~ ')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center w-full bg-surface-container-low rounded-lg p-3 border-[1.5px] border-dashed border-outline-variant"
      >
        <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">calendar_today</span>
          <span className="truncate font-serif text-body-lg text-on-surface">{startLabel}</span>
        </div>
        <span className="shrink-0 px-1 font-serif text-body-lg text-on-surface-variant">~</span>
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <span className="truncate font-serif text-body-lg text-on-surface">{endLabel}</span>
        </div>
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
