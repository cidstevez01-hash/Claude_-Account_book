-- 闹钟功能 · 重新建表脚本(v2,取代已回退的 sql/2026-08-13_alarm_tables.sql)
-- 背景：闹钟功能最初设计走 AlarmKit + 服务器推送续期这条路线，建了
-- alarms/device_push_tokens/alarm_schedule_state 三张表；后来发现 AlarmKit 和
-- Push Notification 都需要付费Apple开发者账号（$99/年）才能解锁的entitlement，
-- 这个项目一直用免费Apple ID + Sideloadly/AltStore 签的未签名ipa，用不了，已经用
-- sql/2026-08-13_drop_alarm_tables.sql 把那三张表全部回退删掉了。
--
-- 改走的新方案：不需要AlarmKit/Push，靠自研Capacitor原生插件(capacitor-alarm-ringer)
-- 在App后台声明 UIBackgroundModes:audio + AVAudioPlayer 不间断播放防止进程被系统挂起，
-- 到点切换成真实铃声循环播放做持续响铃——免费账号也能用。数据结构因此也比之前简单很多，
-- 只需要一张 alarms 表，不需要 device_push_tokens(不推送)、不需要 alarm_schedule_state
-- (排程判断整个下放到客户端自己算，不需要服务器续期)。
--
-- 用途：在 Supabase SQL Editor（或 DBeaver）里直接整段执行。
-- 幂等：可以安全重复执行。
--
-- 节假日数据复用现成的 jp_holidays 表，这里不重复创建。
--
-- 命名/RLS 写法照抄现有 entries / user_settings 表的约定：
--   - id 用 text（客户端生成，跟本地 ledger_alarms 里的 id 保持一致）
--   - RLS 一律先 drop policy if exists 再 create，脚本能重复跑
--   - 权限用 auth.uid() = user_id 判断

create table if not exists public.alarms (
  id                text primary key,          -- 客户端生成，跟本地 ledger_alarms 的 id 保持一致
  user_id           uuid not null references auth.users(id) on delete cascade,
  time              text not null,             -- 'HH:mm'
  label             text not null default '',
  repeat_type       text not null default 'weekly'
                      check (repeat_type in ('once', 'weekly')),
  once_date         date,                      -- repeat_type = 'once' 时用
  weekdays          int[],                     -- repeat_type = 'weekly' 时用；1=周一...7=周日
  skip_jp_holidays  boolean not null default false, -- 遇日本法定节假日自动跳过("祝日不响")
  sound_file        text,                      -- Supabase Storage(alarm-sounds桶)里的对象路径，空则用内置默认铃声
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
-- 铃声文件存储桶：私有桶，按 user_id/ 分文件夹隔离；上传前客户端已经校验过
-- 时长≤2分钟，这里的 file_size_limit 只是兜底防护
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alarm-sounds', 'alarm-sounds', false, 10485760, array['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/aac','audio/ogg'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "alarm_sounds_own" on storage.objects;
create policy "alarm_sounds_own" on storage.objects
  for all using (
    bucket_id = 'alarm-sounds' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'alarm-sounds' and (storage.foldername(name))[1] = auth.uid()::text
  );
