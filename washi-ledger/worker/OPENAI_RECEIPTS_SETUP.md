# OpenAI 小票识别配置与验证

## 2026-11-28：R-60 发布准备（未部署）

当前本地准备版本为 `1.0.0-20261128-dev.2`。新严格协议增加 `itemDetails`（名称、单价、数量、行金额）、本次获得/使用积分数、实际抵扣金额、证据与上下文分类、`amountBasis`。模型读整票语义，排除广告、キャンペーン、累计/可用余额；区分抵扣前合计与已扣后净额，未知值为null，禁止默认1P=1円。客户端提供完整可编辑备注及字段草稿，保护手动修改，并将本次小票获得积分与付款规则积分相加。

发布顺序：在本次版本获用户推送授权后，核对远端、推送；部署本目录Worker时保留已有配置和Secret，再构建并交付App。已有Key/模型/授权列表不必重新输入，不应再次要求用户注册或创建资源。当前只做了Worker类型检查及dry-run，没有执行实际部署或真实付费识别。新版App兼容旧响应，新增单价/积分字段需新Worker才能取得。

既有`receipt_path`文本JSON内保存按张净额/积分元数据，数据库schema、RLS及现有凭证路径不变。单价未知不反推，多商品数量不混入包装规格。完整规则、测试及旧客户端降级保存限制见[小票说明](../RECEIPT_OCR.md)。

以下为已有接入与历史验证说明；较早的“金额写抵扣前总额”和“仅展示摘要”规则已由上述R-60规则取代。

`1.0.0-20261126-dev.1`已于2026-11-26配置三个服务端Secret并部署Worker，IPA126构建成功。无凭据请求已验证返回401；真实小票与OpenAI响应仍待安装后测试。以下为配置流程及边界；后续环境也须先配置和部署Worker，再安装含新按钮的App。

## 工作流程

- 拍照或相册选图完成后自动请求 OpenAI，付费调用不再依赖点击按钮；本机识别并行作为失败/缺失字段的兜底。
- 扫描预览显示自动识别状态及费用说明。「AI 重新识别」只在当前图片上重试，不必删除或重扫。
- 前端从扫描画布生成独立的 JPEG 副本：最长边不超过 3200px、最多约 3MB。原画布、现有 PDF 尺寸及 JPEG 0.85 保存逻辑不变。
- 前端携带当前 Supabase 会话访问 `POST /receipts/recognize`。Worker 复用现有 `getVerifiedUserId` 校验真实身份，并要求该 ID 在管理员配置的授权列表中。
- Worker 调用 OpenAI Responses API，使用图片输入、严格 JSON Schema、`store: false`、最多 4000 输出 token，不启用工具或任意 URL 抓取。模型名称只从服务端配置读取。
- 返回店名、日期、商品、总额、支付额、税额及票面证据。由模型根据整票语义和版面区分最终购买总额、预收、找零、实际支付、积分、折扣与税额。支付额不等于总额不再清空合计；预收减找零只作辅助核对，不要求固定字符或标签。只有总额本身不明确、无证据、币种不支持时保留未确认。
- AI 成功后展示最终选用字段摘要；空字段不会覆盖已有确认值。金额写优惠后含税购买总额（积分作为支付时，不误用积分后的现金实付）；日期写交易日期；备注写店名、商品、实际折扣、税额、积分抵扣和支付方式，不写预收找零、会员号、电话地址、条码或广告。保存 PDF 后沿用原表单确认入账，手填金额/日期优先。失败保留原有结果；关闭/重扫丢弃迟到响应。客户端取消不保证已经发出的供应商请求停止计费。

## 管理员配置

在 OpenAI API 平台为本 App 创建独立项目与 API Key，并开通 API 计费。不要粘贴 Key 到聊天、GitHub 或任何 `VITE_*` 配置。

在 Cloudflare Dashboard 中打开 **Workers & Pages → washi-ledger-api → Settings → Variables and Secrets**：

| 名称 | 类型 | 内容 |
|---|---|---|
| `OPENAI_API_KEY` | Secret | OpenAI 项目专用 Key |
| `OPENAI_RECEIPT_MODEL` | Variable 或 Secret | 有图片输入和 Structured Outputs 权限的模型 ID；初始候选 `gpt-6.2-sol`，需真实测试确认项目可用性 |
| `OPENAI_RECEIPT_USER_IDS` | Secret | 允许使用付费识别的 Supabase Auth User UUID，多账号用逗号分隔；从 Supabase Authentication → Users 核对当前 App 会话对应的用户，不能填写邮箱或聊天账号 ID |

三个值缺失时不开放付费调用。现有 Supabase 配置不变，不新增表或更改 RLS。

`wrangler.toml` 随本改动配置 `RECEIPT_AI_RATE_LIMIT`：每位用户每个 Cloudflare 地点 60 秒最多 5 次。授权列表外的账号（包括另行注册的匿名账号）不能调用。此限流不是全球调用总量或月度账单硬上限；不要把 OpenAI 项目预算提醒当作硬性停用开关。可删除授权 ID 或 Key 来关闭付费调用。

本地调试可以复制 `.dev.vars.example` 为 `.dev.vars`（已忽略），只在本地填写 Key，不能提交。生产部署必须使用 Worker 的 Secret。部署时保留 Dashboard 上三个参数。

前端继续使用现有 `VITE_API_BASE_URL`，不新增前端 Key。Worker 可用后再构建/安装 App，避免用户先看到未配置按钮。遵守仓库的版本号和推送确认流程。

## 数据边界

应用后端不把识别副本额外写入数据库/对象存储，也不记录图片、完整模型回答或密钥。后端和App诊断记录原始/最终金额、预收、找零及校验原因等必要数值，便于定位模型提取与程序处理的差异。`store: false` 关闭 Responses 的响应存储，不等同于供应商零保留；其他保留规则以 OpenAI 项目设置及数据政策为准。原有用户确认 PDF 后上传凭证的流程独立保留。

## 发布前真实验证（尚未执行）

1. 配置 Key、模型 ID 和本人授权 UUID，部署 Worker。
2. 用本人授权的完整小票原图测试：全家 258、超市含税/外税、促销阈值、积分扣减、多个合计和模糊票据。
3. 核对总额、日期、店名与商品；记录延迟和 OpenAI 实际 usage/费用。模拟响应测试不能证明模型准确率。
4. 检查无网络、未配置、未授权、限流、失败后本地保存、重扫取消和手填保护。
5. 实际 iOS 相机、IPA 编译与安装验证单独执行。

参考：[OpenAI 图片输入](https://developers.openai.com/api/docs/guides/images-vision)、[结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs)、[Cloudflare 限流](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。

## 2026-11-27 修复部署顺序

必须同时更新 Worker 与 App。旧 Worker 会在返回前清空不同支付额的合计，仅更新 App 无法恢复已经被旧后端丢失的金额。
先部署新 Worker（保留已有 Secret、模型与授权列表），再安装新 App；新解析器兼容旧响应缺少新增结算字段的情况。
本次补充验证覆盖合计1531/预收2031/找零500、积分及混合支付金额差异、空AI字段保留本地金额、首次自动调用与同图重试。模拟字段不代表对用户原图进行了真实模型准确率测试。
