-- entries表sub_code列去掉NOT NULL约束
-- 背景：washi-ledger前后端分家(entries资源过Cloudflare Worker)回归测试时发现，
-- 记一笔/编辑时如果没有选细分(sub_code)，前端会传null，但数据库这一列目前是
-- NOT NULL，写入直接报错("null value in column \"sub_code\" ... violates
-- not-null constraint")。这不是这次改后端引入的新问题——前端本来就允许"只选大类、
-- 不选细分"这个状态(AddTransactionPage.tsx里`setSubCode(null)`是选大类后的默认值，
-- 不是bug)，是数据库这一列的约束跟应用层的数据模型对不上，只是这次测试才第一次
-- 真的写入一条没选细分的记录才暴露出来。
--
-- 用途：在 Supabase SQL Editor 里直接执行这一行。
-- 幂等：可以安全重复执行(列本来就允许null的话，这条语句不会报错)。

alter table public.entries alter column sub_code drop not null;
