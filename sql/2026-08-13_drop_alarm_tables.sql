-- 回退闹钟相关的三张表（对应 sql/2026-08-13_alarm_tables.sql）
-- 原因：AlarmKit 和推送通知都需要付费Apple开发者账号才能解锁的entitlement，
-- 免费Apple ID(Sideloadly签名)用不了，之前那套"AlarmKit响铃+服务器推送续期"的方案站不住脚，先撤回建的表。
--
-- 用法：跟建表脚本一样，整段拿去 Supabase SQL Editor（或 DBeaver）执行。
-- 不影响 jp_holidays（那张表不是这次新建的，不在这个脚本里）。

drop table if exists public.alarm_schedule_state;
drop table if exists public.device_push_tokens;
drop table if exists public.alarms;
