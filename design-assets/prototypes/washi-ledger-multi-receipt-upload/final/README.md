# R-41 小票多图上传 · 设计记录

## 最终方案（已接入代码）

- `add-transaction-receipt-section.png`：记一笔页面小票区域——每张凭证一行，
  文字本身是虚线下划线+主色(`#d1665a`)高亮的超链接样式（没有文件类型图标，
  也没有真实文件名，按上传顺序编号"凭证1/凭证2..."即可），右侧小号删除图标，
  列表末尾"继续扫描"追加。行间距收紧（`py-1.5`）。
- `entry-detail-sheet-receipt-list.png`：查看详情弹层里的只读版本，同一套
  超链接样式，没有删除按钮。

代码位置：`washi-ledger/src/features/add-entry/AddTransactionPage.tsx`（小票区域）、
`washi-ledger/src/features/ledger/EntryDetailSheet.tsx`（只读列表）。

## 迭代过程（history/，按时间顺序）

1. `01-stitch-invented-page.png`——第一版直接丢Stitch文字描述生成，结果是
   Stitch自己凭空编了一整页全新设计（字体/配色/圆角全部跟真实App对不上）。
   用户反馈"我们页面不长这样，你要照着做只能改添加小票那部分"。
2. `02-dom-mockup-icon-cards.png`——改成在真实运行的页面上用Playwright直接
   替换DOM（保证其余部分100%不变），缩略图卡片+PDF图标的方案。用户反馈
   "这么难看？让stitch重新设计，按我们的页面做"。
3. `03-stitch-grounded-icon-cards.png`——把`index.css`里真实的色值/12px圆角/
   虚线边框规范整理成DESIGN.md喂给Stitch做约束，再按真实"记一笔"页面的实际
   顺序重新生成。效果上贴近真实App了，但依然是缩略图卡片+图标的形式。
4. `04-hyperlink-style-wide-spacing.png`——用户反馈"文件不用图标，我只需要
   一个文件名称就行"+"超链接样式"，改成跟App里已有"查看凭证"同款的虚线下划线
   文字链接，但行间距过大。
5. 最终版——收紧行间距，链接文字颜色从`text-on-surface`改成`text-primary`
   高亮（用户要求"一般我们文字要高亮显示"）。
