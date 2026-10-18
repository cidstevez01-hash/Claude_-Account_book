# voltaction-navy-mercard-jcb

深蓝底紫发角色卡。替换：左上 `MITSUI SUMITOMO CARD` + `©A/N` → mercard；右下 VISA → JCB。

- `final/card.webp`：成品，1536×969，与原图同尺寸、保留原图 alpha（无损 webp）
- `source/`：原图 `original.webp`、全身参考图 `reference-fullbody.webp`

## 做法
同 `voltaction-blue-mercard-jcb/`：
1. **VISA 擦除**：参考图 SIFT 对齐到卡面（483 个内点），被盖住的手臂/手套直接取参考图像素补回；人物外圈白色发光按原图实测"距离→亮度"曲线重建。
2. **左上文字擦除**：只擦白色文字像素（限定在 x≤465 内，避开右侧头发和发丝），填回底色。
3. **新标志**：直接复用蓝底卡那次 `baoyu-image-gen` 生成的 mercard / JCB（`../voltaction-blue-mercard-jcb/history/v1-ai-full-redraw.webp`），保证几张卡标志一致。
   - mercard 缩到 420px 宽（蓝底卡为 516px）：这张卡头发离左上文字区很近，原尺寸会压到头发。
   - JCB 尺寸、位置与蓝底卡相同（212px 宽，右下对齐原 VISA 边界）。
4. 校验：与原图逐像素比对，改动只落在三块区域（左上 logo/文字区、©A/N 区、右下 VISA/JCB 区）。
