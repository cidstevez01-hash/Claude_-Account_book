# voltaction-blue-mercard-jcb

替换：左上 `MITSUI SUMITOMO CARD` + `©A/N` → mercard；右下 VISA → JCB。

- `final/card.webp`：成品，1536×969，与原图同尺寸、保留原图 alpha（无损 webp）
- `source/`：原图 `original.webp`、全身参考图 `reference-fullbody.webp`
- `history/v1-ai-full-redraw.webp`：`baoyu-image-gen`（openai / gpt-image-2，normal）整张改图的原始输出，只从中抠取了两个标志，不直接使用

## 做法
1. **VISA 擦除**：参考图用 SIFT 特征点对齐到卡面（541 个内点，相似变换），被 VISA 盖住的衣服直接取参考图像素补回；人物外圈白色发光按原图其他边缘实测的"距离→亮度"曲线重建；纯背景区域填原图底色。
2. **左上文字擦除**：该区域是纯色底 RGB(15,95,166)，整块填底色。
3. **新标志**：mercard、JCB 从 AI 输出中抠出（mercard 按背景色反预乘求 alpha，JCB 取白底圆角矩形轮廓），缩放后贴到原位置。
4. 校验：与原图逐像素比对，改动只落在三块区域（左上 logo/文字区、©A/N 区、右下 VISA/JCB 区），其余像素完全一致。
