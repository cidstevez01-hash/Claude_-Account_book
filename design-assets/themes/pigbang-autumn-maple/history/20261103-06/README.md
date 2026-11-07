# PigBang 线稿背景 · 两处侧裂片局部修正

输入为第五版线稿图。用户指定结余卡片水印和左下角大叶片的左右两瓣，要求沿各自中央主脉镜像、等大，其他内容保持。

- 首次尝试 Image 2 局部编辑，实际参数 `quality=low`，保留候选 `pigbang-lineart-local-edit-low.png`；模型没有严格满足镜像要求，未作为最终稿。
- 最终稿使用成对镜像的轮廓路径修整指定叶瓣，旋转轴跟随各叶中央主脉。采用局部像素修复处理旧轮廓，只回贴两个小区域；没有重新生成整页。
- `pigbang-lineart-two-leaves-final.png`：最终整页。
- `watermark-final.png` / `bottom-left-final.png`：局部放大。
- `symmetric-lobes-layer.svg`：镜像修正线条。
- 其余文件为中间尝试和定位记录，不作为最终设计。
- 未修改 App 代码。
