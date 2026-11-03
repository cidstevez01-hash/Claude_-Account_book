# PigBang 图标体系

页面使用 `src/icons/Icon.tsx` 的 `ThemeIcon`，固定入口名称来自 `catalog.ts`。
旧 `lib/appIcons`、`lib/iconGlyphs` 和 design-system 下的组件路径只是兼容导出。

| 路径 | 职责 |
| --- | --- |
| `catalog.ts` | 固定按钮的语义名称，底栏 dashboard 对应 book |
| `categoryMap.ts` | 旧分类/通用支付编号的兼容映射，不修改数据库 |
| `glyphs.ts` / `VectorIcon.tsx` | 原有主题 SVG 字形及渲染 |
| `SymbolIcon.tsx` / `fonts/` | 统一字体回退和自托管字体 |
| `themes/registry.ts` | 主题覆盖与默认图形回退、强调色和光效开关 |
| `themes/shared/navigation/` | 底栏共用的透明 SVG，本轮复用已选中的样本造型 |
| `Effects.tsx` | 原有 ring/bare 特效，保留动画相位机制 |
| `brands/` | 支付品牌原始 Logo，不随主题改品牌颜色 |
| `assets/` | 积分等独立图片 |

## 新主题

1. 在 `themes/` 中新建主题目录，加入需要替换的图形。
2. 在 `registry.ts` 登记该主题的 `navigation` 覆盖、强调色和光效开关。
   当前默认、怀旧、夏主题各有独立的 `themes/<主题>/index.ts`。`icons` 可按语义名称覆盖任意普通图标的 `symbol` 或 `glyph`，不仅限于底栏；缺项回退到默认主题，再回退到现有字形/字体。
3. 未覆盖的底栏图形自动回退到 shared，无需修改 BottomNav。
4. SVG 必须是仓库内受信任的静态资源；主题注册表不接受远端或用户上传的 SVG。
5. 底栏调用 `variant="navigation"`，其他位置维持原图形与尺寸。通用字体图标也统一经 ThemeIcon 渲染，后续扩展可在该入口实现，不能新增页面内的字体 span。

`CashPointToggle` 的复合布局和现金 SVG、支付方式的多色 SVG 保留其专门组件，避免把业务状态混入通用图标渲染；其素材和字体现已统一目录。图表、头像、收据不是按钮图标。

## 验收

- 三个主题、三个当前页签都显示新造型；选中状态由现有颜色和气泡表达。
- 夏主题每个底栏图标都使用 bare 发光，无额外圆圈；切 tab 保持 glowDelayMs 相位。
- 默认/怀旧不新增光晕；24px 外框不变。
- 带圈位置继续使用原有 ring 规则。
- 主题缺失时能回退到默认素材，品牌 Logo 保持原样。
