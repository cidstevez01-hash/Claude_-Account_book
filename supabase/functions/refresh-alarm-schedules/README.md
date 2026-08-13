# refresh-alarm-schedules

闹钟排程续期任务，见 `index.ts` 顶部注释。这个函数不是给 App 直接调用的接口，是给定时任务调用的，靠一个共享密钥鉴权（不是 Supabase 的用户登录体系）。

## 部署

需要先装 [Supabase CLI](https://supabase.com/docs/guides/cli)，登录并 link 到项目：

```bash
supabase login
supabase link --project-ref <项目ref，在Supabase Dashboard的Project Settings里能看到>
```

部署这个函数：

```bash
supabase functions deploy refresh-alarm-schedules
```

## 配置 Secrets

部署之后，在 Supabase Dashboard -> Edge Functions -> Secrets 里加（或用 CLI）：

```bash
supabase secrets set APNS_KEY_ID=xxxxxxxxxx
supabase secrets set APNS_TEAM_ID=xxxxxxxxxx
supabase secrets set APNS_BUNDLE_ID=com.cidstevez01.jiazhangbu
supabase secrets set APNS_ENVIRONMENT=sandbox   # 先用sandbox测试，确认没问题再切production
supabase secrets set REFRESH_TRIGGER_SECRET=<自己生成一个随机字符串，比如 openssl rand -hex 32>
supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
```

`APNS_KEY_ID` / `APNS_TEAM_ID` / `.p8` 私钥文件从 Apple Developer 后台 -> Certificates, Identifiers & Profiles -> Keys 里创建一个 APNs Auth Key 拿到（这个 Key 只能下载一次，下载后要妥善保存）。

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 不用手动配置，Supabase 会自动注入给每个 Edge Function。

## 怎么触发

不用 Supabase 自己的 Cron Trigger（那个底层是不是也走 `pg_net`、在这个项目的实例上会不会一样卡死，没有把握去验证）。改用仓库根目录 `.github/workflows/alarm-schedule-refresh.yml` 这个 GitHub Actions 定时任务去调用，完全不经过 Postgres，用的也是这个仓库已经很熟悉的模式（跟 `ios-release.yml`/`ios-test-build.yml` 一样是 GitHub Actions）。

需要在仓库的 Settings -> Secrets and variables -> Actions 里加两个 repo secret：

- `SUPABASE_FUNCTION_URL`：`https://<项目ref>.supabase.co/functions/v1/refresh-alarm-schedules`
- `REFRESH_TRIGGER_SECRET`：跟上面 `supabase secrets set REFRESH_TRIGGER_SECRET=...` 设的必须是同一个值

## 还没做的事（下一步）

- App 侧：AlarmKit 原生插件收到静默推送后，要真正调用 `AlarmManager.schedule()` 注册闹钟，并把成功注册到的最后日期回写到 `alarm_schedule_state.scheduled_until`（现在这版函数里是"乐观更新"，先假设推送发出去就会成功续期，不是真实状态，细调阶段要改成 App 侧调一个接口如实回写）
- APNs token 失效（410/BadDeviceToken）时自动清理 `device_push_tokens` 里的失效记录，现在只记日志
- 第04节提到的"AlarmKit 单个 App 能同时挂起多少个闹钟"这个数字实测出来之后，回来调整 `SCHEDULE_WINDOW_DAYS`
