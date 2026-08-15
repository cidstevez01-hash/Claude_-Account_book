-- 闹钟铃声"我的铃声"列表 · 建表脚本
-- 背景：铃声之前是"每次选文件=直接上传一个新对象、跟当前这条闹钟绑死"，选完了下次
-- 想给另一条闹钟用同一个铃声还得重新选文件重新传一遍。改成"上传一次、存进一个可复用
-- 的铃声库，任意闹钟都能从库里挑"——需要一个地方记录每个上传对象对应的显示名字
-- (Supabase Storage 对象本身没有方便随时改的自定义名字字段，只能另建一张表存)。
--
-- 用途：在 Supabase SQL Editor 里直接整段执行。
-- 幂等：可以安全重复执行。

create table if not exists public.alarm_sounds (
  id            text primary key,          -- 客户端生成，跟alarms/entries等表统一用text id
  user_id       uuid not null references auth.users(id) on delete cascade,
  storage_path  text not null,             -- alarm-sounds桶里的对象路径(user_id/xxx.wav)，
                                            -- 跟alarms.sound_file存的是同一个值
  name          text not null default '',  -- 用户自己起的名字，上传时不填会落一个默认名，
                                            -- 之后可以改
  created_at    timestamptz not null default now()
);

alter table public.alarm_sounds enable row level security;

drop policy if exists "alarm_sounds_select_own" on public.alarm_sounds;
create policy "alarm_sounds_select_own" on public.alarm_sounds
  for select using (auth.uid() = user_id);

drop policy if exists "alarm_sounds_write_own" on public.alarm_sounds;
create policy "alarm_sounds_write_own" on public.alarm_sounds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_alarm_sounds_user
  on public.alarm_sounds(user_id, created_at desc);
