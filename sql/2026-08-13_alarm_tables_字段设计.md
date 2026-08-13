# 闹钟功能 · 表字段设计

对应建表脚本：`sql/2026-08-13_alarm_tables.sql`

## 1. `alarms` 闹钟主表

App 增删改查用，服务器排程定时任务也读这张表。

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|---|---|---|---|---|
| `id` | text | 否（主键） | — | 客户端生成，跟本地 `ledger_alarms` 里的 id 保持一致，不用数据库自动生成的 uuid，省掉本地↔云端两套 id 互相映射 |
| `user_id` | uuid | 否 | — | 外键 `auth.users(id)`，级联删除 |
| `time` | text | 否 | — | `'HH:mm'` 格式，如 `'07:00'` |
| `repeat_mode` | text | 否 | `'custom'` | `once` \| `daily` \| `workday` \| `holiday` \| `custom` 五选一，建了 check 约束 |
| `repeat_weekdays` | int[] | 否 | `'{}'` | 仅 `custom` 模式手选生效；0=周日...6=周六；其余模式由 `repeat_mode` 自动推算，不存手选值 |
| `exclude_holidays` | boolean | 否 | `false` | `custom` 模式下可选叠加"排除法定节假日"；`workday` 恒为 true、`holiday`/`daily` 恒为 false（应用层保证，不建 DB 约束） |
| `once_date` | date | 是 | — | 仅 `repeat_mode='once'` 时用 |
| `label` | text | 否 | `''` | 闹钟标签，如"起床""记账提醒" |
| `tone_id` | text | 是 | — | 铃声 ID |
| `tone_name` | text | 是 | — | 铃声显示名，如"猫叫.m4a" |
| `tone_is_custom` | boolean | 否 | `false` | 是否用户上传的自定义铃声 |
| `vibrate` | boolean | 否 | `true` | 响铃时是否震动 |
| `enabled` | boolean | 否 | `true` | 开关；关闭不清空其它字段 |
| `created_at` | timestamptz | 否 | `now()` | |
| `updated_at` | timestamptz | 否 | `now()` | 客户端每次 upsert 时手动带新值（沿用 `user_settings` 的做法，不建自动更新触发器） |

**索引**：`idx_alarms_user_enabled`，`(user_id) where enabled = true`，给排程任务查"哪些用户有启用中的闹钟"用。
**RLS**：`select`/`insert`/`update`/`delete` 都要求 `auth.uid() = user_id`。

---

## 2. `device_push_tokens` 设备推送凭证

排程续期靠静默推送触发 App 续期，得知道推给哪台设备。

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|---|---|---|---|---|
| `id` | uuid | 否（主键） | `gen_random_uuid()` | 这张表跟本地数据无对应关系，用数据库自动生成 |
| `user_id` | uuid | 否 | — | 外键 `auth.users(id)`，级联删除 |
| `push_token` | text | 否 | — | APNs 设备令牌 |
| `platform` | text | 否 | `'ios'` | 预留字段，目前只有 iOS |
| `updated_at` | timestamptz | 否 | `now()` | |

**唯一约束**：`(user_id, push_token)` 联合唯一，同一设备重复注册直接 upsert 覆盖。
**RLS**：增删改查都要求 `auth.uid() = user_id`。

---

## 3. `alarm_schedule_state` 排程续期状态

记录每条闹钟"设备上已经注册到哪天了"，定时任务靠这张表判断谁快到期、该推谁。

| 字段 | 类型 | 可空 | 默认值 | 说明 |
|---|---|---|---|---|
| `alarm_id` | text | 否（主键） | — | 外键 `alarms(id)`，级联删除；跟闹钟一对一 |
| `scheduled_until` | date | 是 | — | App 侧汇报：AlarmKit 已经注册到的最后一天 |
| `last_refresh_pushed_at` | timestamptz | 是 | — | 最近一次服务器推送续期指令的时间 |
| `updated_at` | timestamptz | 否 | `now()` | |

**RLS**：通过子查询判断 `alarms.user_id = auth.uid()` 间接限权（这张表本身没有 `user_id` 列）。

---

## 附：`jp_holidays`（已存在，不用改）

给「法定工作日/法定节假日」两个智能预设判断节假日用，原本是給与日/家賃日营业日调整功能在用。

| 字段 | 类型 | 说明 |
|---|---|---|
| `holiday_date` | date | 日本の祝日，由 `fetchJpHolidays()` 从 `holidays-jp.github.io` 抓取后 upsert 进来 |
