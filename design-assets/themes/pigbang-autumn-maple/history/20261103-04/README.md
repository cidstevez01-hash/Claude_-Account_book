# PigBang 红叶主题 · 单一叶形复用第四版

本轮根据用户两张照片中的叶片结构重新描绘一份可复用轮廓：一个中央主裂片、两侧成对侧裂片、锯齿边缘与一个叶柄。不是照片自动描摹，也不声称是植物学精确复刻。多叶场景参考其垂挂、分布和连接方式。

## 生成与处理

- Image 2 的实际编辑请求明确为 `model=gpt-image-2`、`quality=low`、`size=1024x1536`、`n=1`。没有使用 medium/high。
- 模型只负责在遮罩区域清除旧叶片、恢复纸面，不负责逐片重新设计枫叶。
- 所有替换叶片和水印使用同一份 `maple-template.svg`，只作刚体旋转、等比缩放与透明度变化，保证不会各自长出不同轮廓。
- 叶柄末端用于枝头定位；前景头像、状态栏和日期控件受遮罩保护。
- 合成保留原设计的非编辑区域像素，原 App 代码未修改。

文件：`maple-template-preview.png` 为放大轮廓，`leaf-decoration-layer.svg` 为整页装饰层，`cleanup-mask.png` 为编辑遮罩，`edit-prompt.txt` 为实际请求提示词，`request-settings.json` 为参数与摆放记录，`pigbang-maple-home-unified-leaf-low.png` 为第四版。

实拍参考为上一版目录中的 `references/user-scene.png` 和 `references/user-leaf-detail.png`，原图版权归原权利人，仅用于用户指定的参考。
