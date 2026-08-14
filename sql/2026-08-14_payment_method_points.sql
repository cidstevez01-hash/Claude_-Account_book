-- 支付方式默认还元率(积分比例) + 特殊日期规则 · 建表/加列脚本
-- 背景：记账表单里"获得积分"这个字段之前一直要手动填，现在改成按支付方式自动算——
-- 比如メルペイ/楽天ペイ默认还元率1%，选完支付方式、填了金额，积分自动算出来
-- (金额×还元率)，用户还能手动改；没有默认还元率的支付方式这个字段留空。
--
-- 特殊规则例子：メルペイ每月8日还元率变成9%(平时是1%)。这类"某天费率不一样"的规则
-- 单独放一张小表，不写死在程序代码里——这个App走Sideloadly/AltStore侧载分发，不是
-- App Store，每次发新版本都要走一遍"改代码→编译→发布→用户重新装"这一整套流程，
-- 而这类还元率活动规则本身就是会员日/大促这种会经常变的运营信息，写进数据库的话
-- 改一下数据库就立刻对所有人生效，不用因为"某个支付方式改了优惠日期"就得重新发一版App。
--
-- 用途：在 Supabase SQL Editor 里直接整段执行。
-- 幂等：可以安全重复执行。

-- 第一步：给payment_methods表加一列默认还元率(比如0.01表示1%),没有的留null
alter table public.payment_methods add column if not exists default_point_rate numeric;

-- 第二步：给メルペイ/楽天ペイ设成1%默认还元率——按显示名字(ja列)匹配，不是猜的code，
-- 执行完请看下面SELECT语句的结果，确认确实改到了这两个支付方式(如果显示0行说明
-- payment_methods表里的实际名字跟这里写的不完全一样，需要改一下WHERE条件里的文字)
update public.payment_methods
set default_point_rate = 0.01
where ja in ('メルペイ', '楽天ペイ');

select id, code, zh, ja, default_point_rate
from public.payment_methods
where ja in ('メルペイ', '楽天ペイ');

-- 第三步：特殊日期规则表——某个支付方式在每月固定某一天，还元率单独变成另一个数字
create table if not exists public.payment_method_point_rules (
  id                    text primary key,
  payment_method_code   text not null references public.payment_methods(code) on delete cascade,
  day_of_month          int not null check (day_of_month between 1 and 31),
  rate                  numeric not null,
  note                  text,
  created_at            timestamptz not null default now()
);

-- 这张表是跟categories/payment_methods一样的全局预设参考数据(不分用户)，只读給所有
-- 已登录用户，写入走这个SQL脚本/后台管理，不开放给客户端代码增删改
alter table public.payment_method_point_rules enable row level security;

drop policy if exists "payment_method_point_rules_read_all" on public.payment_method_point_rules;
create policy "payment_method_point_rules_read_all" on public.payment_method_point_rules
  for select using (true);

-- 第四步：插入メルペイ每月8日9%这条规则——如果上面第二步查出来メルペイ的code不是'merpay',
-- 这一步要跟着改成实际的code值
insert into public.payment_method_point_rules (id, payment_method_code, day_of_month, rate, note)
values ('rule_merpay_8th', 'merpay', 8, 0.09, 'メルペイ每月8日还元率提升到9%')
on conflict (id) do update set
  payment_method_code = excluded.payment_method_code,
  day_of_month = excluded.day_of_month,
  rate = excluded.rate,
  note = excluded.note;
