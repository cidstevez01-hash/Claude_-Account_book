-- 新增支付方式：PayPay(ペイペイ)，默认还元率0.5%，预设值(is_preset=true,不挂具体用户)
--
-- 用途：在 Supabase SQL Editor 里直接整段执行。
-- 幂等：用where not exists兜底，可以安全重复执行。

insert into public.payment_methods (code, zh, ja, icon, is_preset, user_id, default_point_rate, sort_order)
select
  'paypay',
  'PayPay',
  'ペイペイ',
  'pm-paypay',
  true,
  null,
  0.005,
  (select coalesce(max(sort_order), 0) + 1 from public.payment_methods)
where not exists (
  select 1 from public.payment_methods where code = 'paypay'
);

select id, code, zh, ja, icon, is_preset, default_point_rate, sort_order
from public.payment_methods
where code = 'paypay';
