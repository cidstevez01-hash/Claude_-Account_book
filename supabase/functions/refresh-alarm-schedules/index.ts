// 闹钟排程续期任务（Supabase Edge Function）
//
// 干的事：定期扫一遍 alarms 表，找出"接下来该响的日期快排完了"的闹钟，
// 给对应用户的设备发一条静默推送，通知 App 打开原生 AlarmKit 续期。
//
// 为什么不是 pg_cron 里的一个纯 SQL 函数（像 generate_recurring_entries 那样）：
// 这里要发 APNs 请求，属于出站 HTTP 调用；这个项目的 Supabase 实例上 pg_net
// 已经在 accountbook-20260801_DBUpdate 那次踩过卡死的坑（抓节假日API时），
// 所以出站 HTTP 这部分挪到 Edge Function（真正的 Deno 服务器运行时）里做，
// 数据库那边只负责读/写表，不发请求。
//
// 怎么触发这个函数，见仓库根目录 .github/workflows/alarm-schedule-refresh.yml
// 的说明——用 GitHub Actions 定时调用，不依赖 Supabase 自己的 Cron Trigger
// (那个底层是否也走 pg_net、在这个实例上会不会一样卡死，没有把握，
//  GitHub Actions 这条路径完全不经过 Postgres，更保险，而且仓库里
//  已经有 ios-release.yml / ios-test-build.yml 两个先例，团队熟悉这个模式)。
//
// 需要在 Supabase 项目里配置的 secrets（Dashboard -> Edge Functions -> Secrets，
// 或用 `supabase secrets set` 命令）：
//   APNS_KEY_ID          Apple Developer后台生成的APNs Auth Key的Key ID(10位)
//   APNS_TEAM_ID         Apple Developer账号的Team ID(10位)
//   APNS_PRIVATE_KEY     APNs Auth Key的.p8文件内容(完整PEM文本，含BEGIN/END那两行)
//   APNS_BUNDLE_ID       App的Bundle ID，也就是APNs的apns-topic，如 com.cidstevez01.jiazhangbu
//   APNS_ENVIRONMENT     'production' 或 'sandbox'，测试阶段先用sandbox
//   REFRESH_TRIGGER_SECRET  外部调用方(GitHub Actions)必须带的共享密钥，防止这个函数URL被外部随便调用
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 是 Supabase 自动注入给每个 Edge Function 的，不用手动配置，
// 这里用 service role key 是因为要跨用户查表，必须绕过 RLS(RLS只允许查自己的数据)。

import { createClient } from "npm:@supabase/supabase-js@2";

// 续期窗口:提前多少天开始尝试续期,给推送延迟/续期失败留容错空间(第04节讨论过的"要留余量")
const REFRESH_LEAD_DAYS = 30;
// 每次续期实际往前排多少天:具体数值等第05节提到的"AlarmKit单个App能同时挂起多少个闹钟"实测出来后再调,
// 这里先给个保守的默认值,不是最终结论
const SCHEDULE_WINDOW_DAYS = 60;

interface AlarmRow {
  id: string;
  user_id: string;
  time: string;
  repeat_mode: string;
  repeat_weekdays: number[];
  exclude_holidays: boolean;
  once_date: string | null;
  enabled: boolean;
}

interface ScheduleStateRow {
  alarm_id: string;
  scheduled_until: string | null;
}

Deno.serve(async (req: Request) => {
  // 简单共享密钥鉴权,不是给终端用户调用的接口,只给固定的定时任务调用方用
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("REFRESH_TRIGGER_SECRET") ?? ""}`;
  if (!Deno.env.get("REFRESH_TRIGGER_SECRET") || authHeader !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const result = await refreshDueAlarms(supabase);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("refresh-alarm-schedules failed", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

async function refreshDueAlarms(supabase: ReturnType<typeof createClient>) {
  // 只有需要"逐日期展开注册"的模式才需要续期:
  // - workday / holiday:靠节假日日历算,不能一次性注册永久规则
  // - custom 且 exclude_holidays=true:同理
  // daily / once / custom(不排除节假日) 这几种在 AlarmKit 那边是一次性永久规则或单次闹钟,不需要续期
  const { data: alarms, error: alarmsErr } = await supabase
    .from("alarms")
    .select("id, user_id, time, repeat_mode, repeat_weekdays, exclude_holidays, once_date, enabled")
    .eq("enabled", true)
    .in("repeat_mode", ["workday", "holiday", "custom"]);
  if (alarmsErr) throw alarmsErr;

  const candidates = (alarms ?? []).filter(
    (a: AlarmRow) => a.repeat_mode === "workday" || a.repeat_mode === "holiday" || a.exclude_holidays
  );
  if (candidates.length === 0) return { checked: 0, refreshed: 0, pushed: 0 };

  const alarmIds = candidates.map((a: AlarmRow) => a.id);
  const { data: states, error: statesErr } = await supabase
    .from("alarm_schedule_state")
    .select("alarm_id, scheduled_until")
    .in("alarm_id", alarmIds);
  if (statesErr) throw statesErr;

  const stateByAlarmId = new Map<string, ScheduleStateRow>(
    (states ?? []).map((s: ScheduleStateRow) => [s.alarm_id, s])
  );

  const today = new Date();
  const dueThreshold = addDays(today, REFRESH_LEAD_DAYS);

  const dueAlarms = candidates.filter((a: AlarmRow) => {
    const state = stateByAlarmId.get(a.id);
    if (!state || !state.scheduled_until) return true; // 从没注册过,肯定需要
    return new Date(state.scheduled_until) < dueThreshold;
  });
  if (dueAlarms.length === 0) return { checked: candidates.length, refreshed: 0, pushed: 0 };

  // 日本の祝日:直接查现成的 jp_holidays 表,不重新抓 API(那是 App 客户端 fetchJpHolidays() 的活)
  const { data: holidayRows, error: holidayErr } = await supabase
    .from("jp_holidays")
    .select("holiday_date");
  if (holidayErr) throw holidayErr;
  const holidaySet = new Set((holidayRows ?? []).map((r: { holiday_date: string }) => r.holiday_date));

  // 按用户分组,一个用户可能有多条闹钟需要续期,合并成一次推送
  const byUser = new Map<string, AlarmRow[]>();
  for (const a of dueAlarms) {
    const list = byUser.get(a.user_id) ?? [];
    list.push(a);
    byUser.set(a.user_id, list);
  }

  let pushed = 0;
  const scheduledUntilStr = fmtDate(addDays(today, SCHEDULE_WINDOW_DAYS));

  for (const [userId, userAlarms] of byUser) {
    const { data: tokens, error: tokenErr } = await supabase
      .from("device_push_tokens")
      .select("push_token")
      .eq("user_id", userId);
    if (tokenErr) {
      console.error("查设备推送凭证失败", userId, tokenErr);
      continue;
    }
    if (!tokens || tokens.length === 0) continue; // 用户没有登录任何设备/没授权推送,跳过

    const alarmIdList = userAlarms.map((a) => a.id);
    let anySent = false;
    for (const t of tokens) {
      const ok = await sendRefreshPush(t.push_token as string, alarmIdList);
      if (ok) anySent = true;
    }
    if (!anySent) continue;

    pushed++;
    // 乐观更新:先假设 App 收到推送后会成功续期到这个日期;
    // 真实的 scheduled_until 应该由 App 侧在 AlarmKit 注册成功后另外调接口回写,
    // 这里先占个位,细调阶段再确认要不要保留这个乐观更新
    for (const a of userAlarms) {
      await supabase.from("alarm_schedule_state").upsert({
        alarm_id: a.id,
        last_refresh_pushed_at: new Date().toISOString(),
        scheduled_until: scheduledUntilStr,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { checked: candidates.length, refreshed: dueAlarms.length, pushed, holidaysLoaded: holidaySet.size };
}

// ---------------- APNs ----------------

async function sendRefreshPush(deviceToken: string, alarmIds: string[]): Promise<boolean> {
  const environment = Deno.env.get("APNS_ENVIRONMENT") === "production" ? "production" : "sandbox";
  const host = environment === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) throw new Error("缺少 APNS_BUNDLE_ID 环境变量");

  const jwt = await getCachedApnsJwt();

  const payload = {
    aps: { "content-available": 1 },
    type: "alarm-schedule-refresh",
    alarm_ids: alarmIds,
  };

  const resp = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "background", // 静默推送,不弹通知横幅/不出声/不震动
      "apns-priority": "5", // 静默推送必须是5,10会被拒
      "apns-expiration": "0",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("APNs 推送失败", resp.status, text, deviceToken);
    // 410/400 里 BadDeviceToken 这种代表 token 已经失效,细调阶段要补上"自动清理失效 token"的逻辑,
    // 这版先只记日志,不做自动清理(避免误删还没来得及验证过的新token)
    return false;
  }
  return true;
}

// ---- ES256 JWT(APNs Provider Token),用 Web Crypto,不依赖第三方JWT库 ----

let cachedJwt: { token: string; issuedAt: number } | null = null;
const JWT_MAX_AGE_SECONDS = 55 * 60; // APNs要求同一个provider token最长复用1小时,这里留5分钟余量提前刷新

async function getCachedApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < JWT_MAX_AGE_SECONDS) return cachedJwt.token;
  const token = await signApnsJwt(now);
  cachedJwt = { token, issuedAt: now };
  return token;
}

async function signApnsJwt(iat: number): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error("缺少 APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY 环境变量");
  }

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await importEcPrivateKey(privateKeyPem);
  const signatureBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64urlFromBuffer(signatureBuf)}`;
}

async function importEcPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function base64url(input: string): string {
  return base64urlFromBuffer(new TextEncoder().encode(input));
}

function base64urlFromBuffer(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------- 日期工具 ----------------

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
