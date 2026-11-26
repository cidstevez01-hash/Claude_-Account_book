# 小票识别：本地 OCR 与可选 OpenAI

2026-11-26：本地准备 `1.0.0-20261126-dev.1`，新增手动触发的 OpenAI 重新识别。默认仍为免费本地识别；付费功能需要 Worker Secret、模型和账号授权列表配置。独立识别副本不改变 PDF 保存画质。配置及数据边界见 [OpenAI 接入说明](worker/OPENAI_RECEIPTS_SETUP.md)。尚未推送、部署或进行真实 API 准确率测试。

以下为本地 OCR 路径及历史记录。

2026-11-25：用户放弃 Azure，确认采用本地 ML Kit 方案。1.0.0-20261125-dev.2 已推送并启动 IPA 构建；首次原生链接失败，静态 framework 配置修复等待重新构建验证。真机识别准确率尚未验证。

## 扫描与回填

- iOS 仍使用现有系统扫描器拍摄、裁边，并复用原扫描预览和 PDF 确认界面。新建、编辑和复制共用此流程。
- 默认文字识别改为 Google ML Kit 的日文模型。使用完整文本行及坐标，转换为现有解析器的归一化 Y 向上坐标，保留不同字号、标签与金额分离的定位能力。
- 合计、日期、店名与明细仍由项目解析器处理。满额促销、预收、找零、税额、积分后实付不能直接替代合计；识别失败也不凭最大数字或仅凭小计加税生成总额。
- ML Kit 出错或无法确认合计时，使用同一原图调用已有 Apple Vision 路径。两个引擎各自完整解析，不拼接两套原始行，也不跨小票组合金额。仍不能确认时保留未确认状态；编辑原金额与手填金额、日期的保护规则不变。
- 用户点保存后，等待识别最多30秒，替代原5秒等待。超时仅保存安全的部分字段，忽略迟到结果。重扫、关闭或离开页面会取消 JS 等待，避免旧结果写入新扫描。原生已提交的识别任务可能仍会完成，但不会回填。
- 保存期间禁止重拍与关闭，避免识别、PDF 和上传对应不同票据。上传失败保留预览，可重试。

## 原生依赖

- 继续使用 Capacitor 7。通过现有 `patch-package` 补丁给 `@capacitor-community/image-to-text@7.0.0` 增加 `detectTextMlkit`，原 Vision 方法保留。
- 只引入 `GoogleMLKit/TextRecognitionJapanese` **8.0.0**，不接入 Firebase 或 Google Cloud，不需要云账号或 API Key。
- 插件本身按静态 framework 集成 ML Kit；默认动态 framework 会在链接时找不到 `MLKTextRecognizer`、`MLKJapaneseTextRecognizerOptions` 等类。构建123首轮已复现该链接错误，补齐此配置后须重新构建验证。
- 最低 iOS **15.5**，Google ML Kit 8 要求 Xcode **16**以上。现有测试工作流使用 macOS 15；实际 CocoaPods 解析与 Swift 编译仍须在 IPA 工作流验证。
- `capacitor:sync:before` 在首次 `cap add ios` 内部同步、安装 Pods 前，调整 Podfile 与 App 工程目标版本；不覆盖更高版本。使用真实 Capacitor iOS 模板验证过此配置路径。
- 官方说明的包体增量约38MB/文字模型，实际安装包变化以产物为准。

## 数据与费用

默认本地 OCR 的输入图片和识别文本在设备上处理；只有手动点击 AI 重新识别才会上传副本到 OpenAI。用户确认 PDF 后，现有凭证上传到 Supabase 的行为继续保留。ML Kit SDK 可向 Google 发送性能和使用指标，不能把“本地 OCR”表述成整个 SDK 永远不联网。

## 已验证与未验证

- 金额/日期、引擎选择与回退、等待/取消、首次原生目标配置：83项 Node 测试通过。
- 实际网页8项隔离回归通过：新建/编辑/复制、多票金额汇总、手填优先、同图回退、未确认金额保护、超过5秒等待、关闭/重扫旧结果丢弃、日文上传失败重试；所有云端写入拦截，仅使用本地测试响应。
- 网页构建、lint通过；保留6条既有 lint 提示。
- 原生补丁撤销与重新应用通过。
- Windows 环境没有执行 Apple SDK 编译或 ML Kit 图片识别。以上测试不代表真实小票金额正确率已经提升；待 IPA 编译和同图真机对比。

官方依据：

- https://developers.google.com/ml-kit/guides
- https://developers.google.com/ml-kit/vision/text-recognition/v2/ios
- https://developers.google.com/ml-kit/release-notes#march_25_2025
- https://developers.google.com/ml-kit/terms
- https://raw.githubusercontent.com/CocoaPods/Specs/master/Specs/b/e/b/GoogleMLKit/8.0.0/GoogleMLKit.podspec.json
