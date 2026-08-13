-- 闹钟功能 · 数据库建表脚本
-- 用途：在 Supabase SQL Editor（或 DBeaver，跟 accountbook-20260801_DBUpdate 那次一样）里直接整段执行。
-- 幂等：整个脚本可以安全重复执行（if not exists / drop policy if exists 都处理了），
--       重跑不会因为表/策略已存在而报错，方便调整后再跑一次。
--
-- 节假日数据不在这个脚本里新建：日本の祝日已经有现成的 jp_holidays 表 +
-- is_biz_day()/adjust_to_biz_day() 函数（給与日/家賃日营业日调整功能在用），闹钟直接复用，
-- 这里不重复创建。
--
-- 命名/RLS 写法照抄现有 entries / user_settings 表的约定：
--   - 表名/列名一律 snake_case
--   - id 用 text（客户端生成，跟本地 ledger_alarms 里的 id 保持一致，不用数据库自动生成的 uuid，
--     省掉本地↔云端两套 id 互相映射的麻烦）
--   - RLS 一律先 drop policy if exists 再 create，脚本能重复跑
--   - 权限用 auth.uid() = user_id 判断，anon key 配合 RLS 是安全的（现有约定）

create extension if not exists pgcrypto;  -- device_push_tokens.id 用 gen_random_uuid()，防止实例上还没开这个扩展


-- ============================================================
-- 1) 闹钟主表
--    App 增删改查用；服务器排程定时任务也读这张表算"该不该续期"
-- ============================================================
create table if not exists public.alarms (
  id                text primary key,          -- 客户端生成，跟本地 ledger_alarms 的 id 保持一致
  user_id           uuid not null references auth.users(id) on delete cascade,
  time              text not null,             -- 'HH:mm'
  repeat_mode       text not null default 'custom'
                      check (repeat_mode in ('once','daily','workday','holiday','custom')),
  repeat_weekdays   int[] not null default '{}',   -- 仅 custom 模式手选生效；0=周日...6=周六
  exclude_holidays  boolean not null default false, -- custom 模式下可选叠加；
                                                     -- workday 恒为 true，holiday/daily 恒为 false（应用层保证）
  once_date         date,                      -- repeat_mode = 'once' 时用
  label             text not null default '',
  tone_id           text,
  tone_name         text,
  tone_is_custom    boolean not null default false,
  vibrate           boolean not null default true,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.alarms enable row level security;

drop policy if exists "alarms_select_own" on public.alarms;
create policy "alarms_select_own" on public.alarms
  for select using (auth.uid() = user_id);

drop policy if exists "alarms_write_own" on public.alarms;
create policy "alarms_write_own" on public.alarms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_alarms_user_enabled
  on public.alarms(user_id) where enabled = true;


-- ============================================================
-- 2) 设备推送凭证
--    排程续期靠静默推送通知设备，得知道推给哪台设备
-- ============================================================
create table if not exists public.device_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  push_token  text not null,
  platform    text not null default 'ios',
  updated_at  timestamptz not null default now(),
  unique (user_id, push_token)
);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_own" on public.device_push_tokens;
create policy "device_push_tokens_own" on public.device_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================
-- 3) 排程续期状态
--    记录每条闹钟"设备上已经注册到哪天了"，定时任务靠这张表判断
--    谁快到期、该给谁推续期指令
-- ============================================================
create table if not exists public.alarm_schedule_state (
  alarm_id                text primary key references public.alarms(id) on delete cascade,
  scheduled_until         date,          -- App 侧汇报：AlarmKit 已注册到的最后一天
  last_refresh_pushed_at  timestamptz,   -- 最近一次服务器推送续期指令的时间
  updated_at              timestamptz not null default now()
);

alter table public.alarm_schedule_state enable row level security;

drop policy if exists "alarm_schedule_state_own" on public.alarm_schedule_state;
create policy "alarm_schedule_state_own" on public.alarm_schedule_state
  for all using (
    exists (select 1 from public.alarms a where a.id = alarm_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.alarms a where a.id = alarm_id and a.user_id = auth.uid())
  );


-- ============================================================
-- 到此为止：建表 + RLS。
--
-- 不在这个脚本里做的事（有意留到后面）：
--   - 排程续期的定时任务本身：不能照抄 generate_recurring_entries 那种纯 pg_cron SQL 函数，
--     因为要发 APNs 静默推送涉及出站 HTTP 请求，这个 Supabase 实例的 pg_net 已经踩过坑
--     （accountbook-20260801_DBUpdate 那次，pg_net 请求节假日 API 直接卡死）。
--     正确做法是写一个 Supabase Edge Function（真正的服务器运行时），
--     用 Supabase 自带的 Cron Trigger 定时调用它去查 alarms + alarm_schedule_state、
--     发推送——这部分是另一块工作，不是纯 SQL，等 Edge Function 项目搭起来了再单独交付。
--   - jp_holidays / is_biz_day() / adjust_to_biz_day()：已经存在，不用动。
-- ============================================================
