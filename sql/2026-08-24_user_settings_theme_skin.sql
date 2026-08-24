-- R-14："怀旧"主题——user_settings.theme_skin列，washi-ledger/src/data/settings.ts的
-- upsertUserSettings()已经在写这一列(带容错：列不存在时退回不写这一列)，跑完这条迁移后
-- 主题选择才能真正跨设备同步(不然只存在本地localStorage缓存里)
alter table public.user_settings add column if not exists theme_skin text;
