-- R-44：固定收支规则改成前台可配置（之前完全硬编码在两个地方）
--
-- 背景：
-- 1) 旧App(index.html) RECURRING_RULES/RECURRING_BIWEEKLY_RULES——App打开时客户端
--    生成，写死在JS数组里，改一条规则都要改代码重新发版
-- 2) 2026-08-01那轮为了"不依赖App是否打开"另外在Supabase建的pg_cron定时任务
--    generate_recurring_entries()——每天跑一次，同样把那几条规则原样复制进SQL里，
--    写死绑定zero121235@outlook.com这一个账号，不是从表里读的
-- 这次要把两条路径背后的规则都改成从新建的recurring_rules表读，按user_id区分，
-- 前台增删改查，不再需要改代码/改SQL才能调整一条规则。
--
-- 用途：在 Supabase SQL Editor 里直接整段执行。
-- 幂等：create table/column if not exists、drop policy if exists、
--       insert ... on conflict do nothing 都处理了，可以安全重复执行。
--
-- ⚠️ 执行前请核对一件事：下面迁移旧规则那段用到的 cat_code/sub_code
-- (salary/salary_base、housing/rent、telecom/phone、hobby/video) 是旧App那边
-- 用的编码——washi-ledger是独立重写的项目，分类数据存在Supabase里（不是代码里
-- 写死的），我这边没有数据库读权限，没法直接确认这几个编码在你现在的分类表里
-- 是否还是同样的code。建议执行完这个脚本后，去前台"规则管理"页面里看一眼这4条
-- 迁移过来的月度规则，分类图标/名字显示是否正常；如果某条显示"未知分类"之类，
-- 去编辑这条规则重新选一次正确的分类即可，不影响其它规则。
--
-- ⚠️ 另一件事：下面的generate_recurring_entries()会调用is_biz_day()/
-- adjust_to_biz_day()这两个已经存在的函数(2026-08-01那轮建的，这次不用重建)。
-- 我没法直接查这两个函数现在的真实参数类型，下面按JS版isBizDay(dateStr)/
-- adjustToBizDay(dateStr, direction)的参数顺序推断出is_biz_day(date)/
-- adjust_to_biz_day(date, text)这个签名——如果执行这个脚本时报"函数不存在/
-- 参数类型不对"，麻烦截图函数报错信息给我，我再按真实签名调整这段。


-- ============================================================
-- 1) 规则表
-- ============================================================
create table if not exists public.recurring_rules (
  id              text primary key,          -- 客户端生成，跟entries同款约定
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('expense','income')),
  amount          numeric not null check (amount > 0),
  currency        text not null default 'JPY',
  cat_code        text not null,
  sub_code        text,
  payment_method  text,
  tag_code        text,
  note            text,
  -- 'day_of_month'：每月固定几号(day_of_month列)，可选节假日顺延(biz_day_adjust)
  -- 'interval_days'：从anchor_date起每隔interval_days天一次，不做节假日顺延
  rule_kind       text not null check (rule_kind in ('day_of_month','interval_days')),
  day_of_month    text,                      -- rule_kind='day_of_month'时必填：'1'~'31' 或 'last'
  biz_day_adjust  text check (biz_day_adjust in ('before','after')),  -- 只有day_of_month类型可能非空
  anchor_date     date,                      -- rule_kind='interval_days'时必填
  interval_days   int check (interval_days > 0), -- rule_kind='interval_days'时必填
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 软删除，跟entries表同一个理由(2026-08-23 entries_soft_delete.sql)：前端
  -- useRecurringRules要复用useEntries.ts那套"远端拉回来的数据跟本机合并，远端
  -- 没有的id当成本机独有再推上去"的逻辑，真删除会被这套合并逻辑误判成"还没同步
  -- 的新规则"又推回去，删了等于没删
  deleted_at      timestamptz,
  constraint recurring_rules_kind_fields_check check (
    (rule_kind = 'day_of_month' and day_of_month is not null and anchor_date is null and interval_days is null)
    or
    (rule_kind = 'interval_days' and anchor_date is not null and interval_days is not null and day_of_month is null and biz_day_adjust is null)
  )
);

alter table public.recurring_rules enable row level security;

drop policy if exists "recurring_rules_select_own" on public.recurring_rules;
create policy "recurring_rules_select_own" on public.recurring_rules
  for select using (auth.uid() = user_id);

drop policy if exists "recurring_rules_write_own" on public.recurring_rules;
create policy "recurring_rules_write_own" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_recurring_rules_user_enabled
  on public.recurring_rules(user_id) where enabled = true;


-- ============================================================
-- 2) 服务器端定时生成函数——替换掉旧的硬编码单账号版本
--
-- 用create or replace同名函数原地替换，不新建/不改cron.job那条定时任务的调度
-- 配置——pg_cron是按函数名调用的(select generate_recurring_entries())，函数体
-- 换掉之后，原有那条"每天跑一次"的定时任务下次触发时自动执行的就是这个新版本，
-- 不会出现新旧两套同时跑、重复写入的问题，也不用去猜原来那条cron.job叫什么名字
-- ============================================================
create or replace function public.generate_recurring_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
  target_date date;
  entry_id text;
  period_key text;
  d date;
begin
  period_key := to_char(current_date, 'YYYY-MM');

  for rule in select * from public.recurring_rules where enabled = true and deleted_at is null loop
    if rule.rule_kind = 'day_of_month' then
      if rule.day_of_month = 'last' then
        target_date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      else
        target_date := make_date(extract(year from current_date)::int, extract(month from current_date)::int, rule.day_of_month::int);
      end if;
      if rule.biz_day_adjust is not null then
        target_date := public.adjust_to_biz_day(target_date, rule.biz_day_adjust);
      end if;
      entry_id := 'recur_' || rule.id || '_' || period_key;

      insert into public.entries (
        id, user_id, type, amount, currency, cat_code, sub_code,
        payment_method, tag_code, note, points, entry_date, recurring_id, created_at
      ) values (
        entry_id, rule.user_id, rule.type, rule.amount, rule.currency, rule.cat_code, rule.sub_code,
        rule.payment_method, rule.tag_code, rule.note, null, target_date, rule.id, now()
      )
      on conflict (id) do nothing;

    elsif rule.rule_kind = 'interval_days' then
      d := rule.anchor_date;
      while d <= current_date loop
        entry_id := 'recur_' || rule.id || '_' || to_char(d, 'YYYY-MM-DD');

        insert into public.entries (
          id, user_id, type, amount, currency, cat_code, sub_code,
          payment_method, tag_code, note, points, entry_date, recurring_id, created_at
        ) values (
          entry_id, rule.user_id, rule.type, rule.amount, rule.currency, rule.cat_code, rule.sub_code,
          rule.payment_method, rule.tag_code, rule.note, null, d, rule.id, now()
        )
        on conflict (id) do nothing;

        d := d + rule.interval_days;
      end loop;
    end if;
  end loop;
end;
$$;


-- ============================================================
-- 3) 迁移旧App的5条硬编码规则，绑定到zero121235@outlook.com这个账号
--    (客户端生成逻辑/服务器定时任务共用这一张表，迁移完两边都会按这5条规则跑)
-- ============================================================
insert into public.recurring_rules (
  id, user_id, type, amount, currency, cat_code, sub_code, payment_method,
  note, rule_kind, day_of_month, biz_day_adjust, enabled
)
select
  v.id, u.id, v.type, v.amount, v.currency, v.cat_code, v.sub_code, v.payment_method,
  v.note, 'day_of_month', v.day_of_month, v.biz_day_adjust, true
from (values
  ('rule_salary_default', 'income',  289346, 'JPY', 'salary',  'salary_base', 'transfer', null,        '10',   'before'),
  ('rule_rent_default',   'expense', 73440,  'JPY', 'housing', 'rent',        'transfer', null,        '26',   'after'),
  ('rule_paidy_default',  'expense', 5272,   'JPY', 'telecom', 'phone',       'paidy',    'iPhone',    'last', 'after'),
  ('rule_amazon_prime',   'expense', 600,    'JPY', 'hobby',   'video',       'amazon',   'Amazon Prime', 'last', 'after')
) as v(id, type, amount, currency, cat_code, sub_code, payment_method, note, day_of_month, biz_day_adjust)
cross join (select id from auth.users where email = 'zero121235@outlook.com') as u
on conflict (id) do nothing;

insert into public.recurring_rules (
  id, user_id, type, amount, currency, cat_code, sub_code, payment_method,
  note, rule_kind, anchor_date, interval_days, enabled
)
select
  'rule_pili_video', u.id, 'expense', 300, 'JPY', 'hobby', 'video', 'merpay',
  'pili', 'interval_days', date '2026-08-14', 14, true
from (select id from auth.users where email = 'zero121235@outlook.com') as u
on conflict (id) do nothing;
