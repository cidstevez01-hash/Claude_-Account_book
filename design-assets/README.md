# 设计资产存档

存放已确认的设计产出物本体（图片、SVG源码、HTML原型文件），规则见 `DEVLOG.md` 长期规则：设计类 Artifact 不许覆盖，每次新设计发布成新链接；用户确认定版后，资产本体必须同时提交进这里，不能只留在 Artifact 或聊天记录里——仓库是唯一能跨会话、跨上下文压缩幸存的地方。

- `icons/`：每个图标一个子文件夹（如 `icons/ic-alarm-fw/`），不直接把文件平铺在 `icons/` 下——图标一多、版本一多，平铺目录会没法看。每个图标子文件夹内部再按两级分：
  - `final/`：当前用户确认的定版文件，随时对应 `index.html` 里实际接入的内容，只保留当前这一份，不堆版本号
  - `history/`：被取代的历次尝试/迭代版本，只增不删，文件名按版本区分（`v2.svg`、`v4-traced.svg` 之类），供追溯设计过程用
- `prototypes/`：可点击的交互原型 HTML 文件（对应线上 Artifact 的存档副本）

## 当前内容

- `icons/ic-alarm-fw/`：闹钟图标（花火皮肤）的存档
  - `final/ic-alarm-fw.svg`、`final/ic-alarm-fw-symbol.txt`：当前权威版本，随时对应 `index.html` 实际接入的内容。在找回的真原始定版路径基础上：①给外轮廓补了描边（跟折扇/孔明灯等其他花火图标同款处理，让轮廓更粗更明显），配合 `index.html` 里单独放大到33px的图标框（另外两个头部图标是25.2px）；②"Zzz"睡眠字样按用户给的参考图整个换成粗体块状"Z"（`stroke`画的简单折线，不是potrace描出来的复合path），角度从~42°斜角改浅到20°，云朵/表盘/刻度几何数据从头到尾没动
  - `history/v7-before-bold-z.svg`、`history/v7-before-bold-z-symbol.txt`：换成粗体Z之前的版本（三个手写体z已经分开摆位，但字形还是原来手写体），已被当前 final 取代
  - `history/v6-before-zzz-respace.svg`、`history/v6-before-zzz-respace-symbol.txt`：Zzz重新排布之前的版本（已有描边放大，但三个z还挤在一起），已被取代
  - `history/v5-before-stroke-reinforcement.svg`、`history/v5-before-stroke-reinforcement-symbol.txt`：加描边、放大之前的版本（找回的真原始定版文件，无描边），已被取代
  - `history/confirmed-reference.png`：早前对话生成的确认版参考图缩略图裁出版，原始高清/矢量源文件一度丢失后又找回（见 DEVLOG.md 相关记录）
  - `history/v2.svg`、`history/v3.svg`：手绘贝塞尔曲线尝试版本，已废弃
  - `history/v4-traced.svg`：potrace 逐像素描摹版本，技术上可用但已被找回的真原始文件取代
- `prototypes/tabbar-liquid-glass-prototype.html`：底部标签栏"液态玻璃"交互效果的原型存档，对应线上 Artifact `双主题UI原型`。
