# 图标/按钮特效规范（新增icon前必读，不能漏做）

## 为什么要这份文档

日历页「現金/積分」切换按钮这一轮一共踩了3个bug（B-53/B-54/B-55/B-56），其中两个
（B-54缺特效、B-56边距对不齐）都是因为做新icon时没有按`IconEffects.tsx`既有的
特效体系走，凭感觉现做了一套。这份文档把体系和checklist写死，以后新增任何
icon/按钮，照这个走，不要重新发明。

## 核心体系：两种特效类型，不是自己选风格

summer主题（「夏·花火」）下，**所有**icon/按钮都必须带呼吸发光特效，只有两种实现
方式，选哪种不是审美决定，是由**这个UI位置本来有没有常驻圆形背景容器**决定的：

| | 有圈 `RingIconEffect` | 裸 `BareIconEffect` |
|---|---|---|
| 用在哪 | 真实UI本来就有常驻圆形背景的位置：SettingsPage行、RateShortcutFab、头像、本轮新加的現金/積分切换徽章 | 真实UI这个位置没有圆形容器：AppLayout左右按钮、NavDrawer行、BottomNav tab |
| 发光画法 | 贴着那个真实圆形容器的外沿发光（画一个比容器更大的圆环） | 复制一份图标形状本身糊模糊当发光（光晕跟图标同尺寸，不画假圆圈） |
| CSS类 | `.icon-ring-glow`，`position:absolute; inset:-13px` | `.icon-bare-glow`，`position:absolute; inset:0` |
| 相对谁定位 | **必须**是那个真实圆形容器本身（`position:relative`），不能另外包一层不同尺寸的div | 图标本身的`.icon-bare-wrap`（`width/height = size`） |
| 实际渲染尺寸 | = 定位父容器尺寸 + 26px（不是`--icon-size`这个变量决定的，见下面"常见误解"） | = 图标尺寸，不会比图标本身更大 |

新增icon前先问自己一句：**这个位置本来是不是已经有一个实心/半透明的圆形底**
**（比如`rounded-full`+背景色）？** 有→用`RingIconEffect`／`ThemeIcon ... effect="ring"`；
没有→用`BareIconEffect`／`effect="bare"`。不要在没有常驻圆形容器的位置画一个假圆圈，
也不要在有圆形容器的位置只做图标本身的模糊而不贴圆圈外沿——两种都在`index.css`
`.icon-ring-glow`/`.icon-bare-glow`规则块开头的注释里写明了，改之前先读那段注释。

## 常见误解：`--icon-size`不控制光晕大小

`.icon-ring-glow`有一个`--icon-size`自定义属性（默认40px），**容易被误以为是用来**
**调光晕整体尺寸的**——不是。它只控制内部`mask-image`径向渐变从透明过渡到不透明的
位置（`calc(var(--icon-size)/2)`），也就是"圆圈本体多大一圈开始发光"。光晕这个
box本身的尺寸永远是`inset:-13px`相对**定位父容器**算出来的：`父容器尺寸+26px`。
这次B-55就是先改了`--icon-size`以为能让光晕变小，实测完全没变化，才发现这个坑。

如果需要控制光晕实际大小，要改**父容器尺寸**（比如本轮切换按钮在40px徽章外面
再包一层28px的定位容器，让光晕变成28+26=54px），不是改`--icon-size`。

## 新增icon的checklist

1. **判断ring/bare**：按上面的表，别凭感觉。
2. **真的接入特效，不要裸放一个`<img>`/`<svg>`就完事**——这是B-54的坑：切换按钮
   一开始完全没做summer主题的发光，直到用户拿NavDrawer的发光图标对比才发现漏做。
3. **贴近屏幕边缘的元素，必须实测光晕有没有溢出视口被截断**——ring效果会比容器
   本身大26px，如果这个按钮本来就贴着页头左右边缘放（比如用负margin"出血"到
   边缘），光晕很容易探出viewport外。不能靠眼睛看一眼截图判断，要跑Playwright量
   实际渲染的`.icon-ring-glow`/`.icon-bare-glow`元素的`boundingBox()`，跟
   viewport/header边界比较。这是B-55的坑。
4. **跟别的按钮做"视觉对称"比较时，比较基准是实际可见的光效边界，不是看不见的**
   **点击热区**——ring效果比热区大、bare效果跟热区内缩，两边即使热区对称
   （比如都用`-ml-2`/`-mr-2`留8px），肉眼看到的发光圆圈也可能完全不对称。改之前
   先用Playwright量两边`icon-ring-glow`/`icon-bare-glow`各自离边界的距离，不要
   只量按钮本身的`boundingBox()`。这是B-56的坑。
5. **非summer主题下这个元素的布局不能受影响**——summer主题才有发光层，默认/
   其他主题下这个位置只有裸的按钮本身。如果为了对齐summer主题下的光效而调整了
   margin，必须判断是否要用`isSummer`分支：summer下用新margin，非summer下保留
   原来的值，否则会在没有光效解释的情况下，在默认主题平白多出一截空隙。
6. **呼吸动画相位**：如果这个icon所在的组件会频繁销毁重建（比如tab切换），参照
   `BareIconEffect`的`glowDelayMs`机制用`Date.now()`算负delay锚定动画相位，不要
   让动画每次重新挂载都从0%重新开始跳一下（`IconEffects.tsx`里`BareIconEffect`
   上方注释有完整说明）。
7. **改完用Playwright实测，不要只靠视觉截图判断**：本地`vite --port 5180`起
   dev server，`localStorage`种`washi_ledger_settings_cache_v1`（含
   `themeSkin: 'summer'`）+`washi_ledger_catalog_cache_v1`+
   `washi_ledger_entries_cache_v1`三个cache key，跑Playwright量真实DOM坐标，
   不要只截图凭眼睛判断对称/溢出——这次三个bug里有两个（B-55/B-56）都是先凭
   视觉判断"看起来没问题"，后来精确测量才发现真实偏差。

## 参考实现

- `src/design-system/components/IconEffects.tsx`：`RingIconEffect`/`BareIconEffect`
  两个组件本体，顶部注释有完整设计原理。
- `src/index.css`：`.icon-ring-glow`/`.icon-bare-glow`具体CSS，大段注释记录了
  B-46前后好几轮踩坑细节（渐变相位、mask渐变起点、呼吸动画）。
- `src/design-system/components/CashPointToggle.tsx`：本轮新增的"有圈效果贴在
  非40px默认尺寸容器上、同时要跟相邻的裸效果按钮做可见边界对齐"的完整案例，
  代码里的注释记录了具体计算过程。
