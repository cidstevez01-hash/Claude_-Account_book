# レシート凭证PDF存档——Supabase端手动设置步骤

R-32（扫描レシート生成PDF存档）需要在Supabase后台做两件事，都是我(Claude)这边
沙盒连不上Supabase网络、没法代替你操作的：加一列数据库字段、建一个Storage bucket
（含访问权限策略）。做完这两步，代码这边（已经写好并会一起推送）才能正常工作。

按顺序做，两步都不复杂，全部在Supabase Dashboard里点几下 + 贴一段SQL。

---

## 步骤1【你做】给entries表加`receipt_path`列

打开你的Supabase项目 → 左侧菜单 **SQL Editor** → New query，贴入并执行：

```sql
alter table entries
  add column if not exists receipt_path text;
```

这一列存的是Storage里凭证PDF的路径（比如`<用户id>/<记录id>.pdf`），不是文件本身。
没有凭证的记录这一列就是`null`，不影响现有数据。

**验证成功的标志**：左侧 **Table Editor** → `entries`表 → 能看到新的`receipt_path`
列，类型是`text`，默认值`null`。

---

## 步骤2【你做】建`receipts` Storage bucket + 访问权限策略

### 2.1 建bucket

左侧菜单 **Storage** → **New bucket**：
- **Name**：`receipts`（必须完全一致，代码里硬编码了这个名字）
- **Public bucket**：**不要勾**（凭证是用户的私人账单信息，bucket必须是private，
  代码这边是通过"签名URL"临时授权访问，不是靠公开链接）

其余选项保持默认，点创建。

### 2.2 加RLS策略（限制"只能读写自己文件夹下的文件"）

还是 **SQL Editor**，贴入并执行：

```sql
-- 允许登录用户上传/覆盖自己文件夹下的文件
create policy "receipts: 本人可上传"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许登录用户读取自己文件夹下的文件（createSignedUrl需要这条）
create policy "receipts: 本人可读取"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许登录用户更新自己文件夹下的文件（重新扫描时upsert覆盖同名文件要用到）
create policy "receipts: 本人可更新"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许登录用户删除自己文件夹下的文件（App里"移除凭证"功能要用到）
create policy "receipts: 本人可删除"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

这四条策略的逻辑都一样：文件路径的第一段目录名（`(storage.foldername(name))[1]`）
必须等于当前登录用户自己的id，才允许操作——即使A用户知道B用户某个文件的完整路径，
A的请求也会被这层策略挡掉，读不到B的凭证。这跟`entries`表现有的RLS策略是同一套
思路，只是Storage这边配置策略的地方（`storage.objects`这张系统表）不一样。

**验证成功的标志**：**Storage** → `receipts`bucket → **Policies**标签页，能看到
上面四条策略都列在里面，状态是启用的。

---

## 完成之后

两步都做完、SQL都成功执行之后，跟我说一声"两步都做完了"，我这边确认没问题
就可以把代码推送上去了（照例会先报版本号等你确认"可以推"）。

如果SQL执行报错（比如`receipt_path`那步提示列已存在，或者建policy时提示
`storage.objects`没权限），把报错原文发给我，我帮你看是什么情况。
