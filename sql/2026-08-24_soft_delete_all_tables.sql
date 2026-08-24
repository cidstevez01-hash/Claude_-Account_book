-- 软删除统一梳理——之前entries表已经在2026-08-23那次修复里改成软删除(deleted_at)，
-- 是因为发现"删除后被本地过期缓存的bulk upsert重新推回来"这个复活bug。这次盘点发现
-- alarms表是完全一样的同步模式(本地缓存整表bulk upsert+单条delete+一次性pull)，
-- 有一模一样的复活风险；subcategories/tags/alarm_sounds虽然没有bulk upsert整表重推
-- 的模式，但为了"删除操作统一走软删除"这个一致的策略，一并处理。
--
-- 每张表都是加一列，不改现有数据/不删列，可以安全地重复执行(if not exists)。

-- entries：已经在 2026-08-23_entries_soft_delete.sql 里加过了，这里不重复执行

-- subcategories（自定义细分）
alter table public.subcategories add column if not exists deleted_at timestamptz;

-- tags（自定义标签）
alter table public.tags add column if not exists deleted_at timestamptz;

-- alarms（闹钟）——跟entries同一种"本地缓存bulk upsert整表重推"同步模式，
-- 删除操作没做成软删除的话，理论上会复现entries那次遇到的复活bug
alter table public.alarms add column if not exists deleted_at timestamptz;

-- alarm_sounds（自定义铃声记录）——注意：这张表的删除操作会同时删掉Supabase Storage里
-- 真实的音频文件(alarm-sounds桶)，软删除只针对这一行数据库记录本身，音频文件依然会被
-- 物理删除(不然占用户的Storage空间没有意义)，这一点跟其它几张表不同
alter table public.alarm_sounds add column if not exists deleted_at timestamptz;
