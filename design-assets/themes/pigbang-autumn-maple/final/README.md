# 丹枫金秋 · 当前程序接入资源

采用设计：`../history/20261107-05/pigbang-tanfu-home-high.png`。

四张WebP派生资源同步到 `washi-ledger/src/assets/themes/autumn/`，合计124500字节。对应原图与SHA256见manifest.json。所有历史原图保持原样。

- paper.webp：原和纸纹理缩小压缩。
- foliage.webp：原Image2叶丛按线色分离浅底，派生透明层，不重画枝叶。
- corner.webp：原透明左下装饰缩小压缩。
- leaf.webp：原透明单叶，水印复用。

导航仍使用图标目录中现有的共享SVG轮廓，注册独立autumn配色/高光；原Image2图标三态表保留作设计依据，不把整张表或整页效果图作为运行时贴图。

实际页面截图见 `../history/20261107-06/`。本主题在设置→主题选择，不自动替换用户已有主题。
