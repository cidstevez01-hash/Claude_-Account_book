# 设计资产存档

存放已确认的设计产出物本体（图片、SVG源码、HTML原型文件），规则见 `DEVLOG.md` 长期规则：设计类 Artifact 不许覆盖，每次新设计发布成新链接；用户确认定版后，资产本体必须同时提交进这里，不能只留在 Artifact 或聊天记录里——仓库是唯一能跨会话、跨上下文压缩幸存的地方。

- `icons/`：每个图标一个子文件夹（如 `icons/ic-alarm-fw/`），不直接把文件平铺在 `icons/` 下——图标一多、版本一多，平铺目录会没法看。每个图标子文件夹内部再按两级分：
  - `final/`：当前用户确认的定版文件，随时对应 `index.html` 里实际接入的内容，只保留当前这一份，不堆版本号
  - `history/`：被取代的历次尝试/迭代版本，只增不删，文件名按版本区分（`v2.svg`、`v4-traced.svg` 之类），供追溯设计过程用
- `prototypes/`：可点击的交互原型 HTML 文件（对应线上 Artifact 的存档副本）

## 当前内容

- `icons/ic-alarm-fw/`：闹钟图标（花火皮肤）的存档
  - `final/ic-alarm-fw.svg`、`final/ic-alarm-fw-symbol.txt`：找回的真原始定版文件（独立可渲染 SVG + 接入 index.html 用的 `<symbol>` 代码块），当前权威版本，已接入 `index.html`
  - `history/confirmed-reference.png`：早前对话生成的确认版参考图缩略图裁出版，原始高清/矢量源文件一度丢失后又找回（见 DEVLOG.md 相关记录）
  - `history/v2.svg`、`history/v3.svg`：手绘贝塞尔曲线尝试版本，已废弃
  - `history/v4-traced.svg`：potrace 逐像素描摹版本，技术上可用但已被找回的真原始文件取代
- `prototypes/tabbar-liquid-glass-prototype.html`：底部标签栏"液态玻璃"交互效果的原型存档，对应线上 Artifact `双主题UI原型`。
