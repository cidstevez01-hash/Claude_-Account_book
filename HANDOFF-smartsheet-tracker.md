# 交接：Smartsheet 需求/Bug 追踪表 — 待处理事项

> 这份文档是给**新会话**看的临时交接说明，不是长期规则。长期规则（表结构、字段、状态流转）已经写进根目录 `CLAUDE.md` 的「需求 / Bug 追踪表(Smartsheet)」一节，新会话正常就会自动加载到，不用重复贴。这份文档只补充：**为什么要交接**、**现在卡在哪**、**接手第一件事该干什么**。

## 为什么换到新会话

上一个会话建好了 Smartsheet 的两张表（`create_workspace`/`create_sheet`/`add_rows` 都成功跑过），但之后 Smartsheet 这个 connector 的工具在那个会话里突然拿不到了（`ListConnectors` 显示 `connected: true` 但 `enabledInChat: false`，且怎么重试、重新授权都没用）。判断是：连接器授权是**会话创建时**就定死的一次性快照，那个会话开始得早，Smartsheet 是中途才连上账号的，所以那个会话永远认领不到——不是 Smartsheet 不稳定，也不是账号授权有问题。新会话从一开始就应该能正常拿到 Smartsheet 的 51 个工具（参考用户截图确认过账号侧一切正常）。

**接手后第一步**：确认能不能正常调用 Smartsheet 工具（`get_resource_guide` 之类），能的话再往下看。

## 两张表（已建好，CLAUDE.md 里也有）

- workspace `washi-ledger 开发追踪`（id `3865640789403524`）：https://app.smartsheet.com/workspaces/J6JCcX7cf2WPj93CjWCgPm6Fg4Gj5hG8RXjRQC51
- 需求表（sheet id `4497306844876676`）：https://app.smartsheet.com/sheets/VJ6rc5vc57cH39pjhjgMVMRj3m8VgMm4qg6CWGh1
- Bug 表（sheet id `3927270329634692`）：https://app.smartsheet.com/sheets/fFVq6qrV62wwFGP64CxmH9PJ4V48FhhCpFJCjVj1

字段和状态流转规则见 `CLAUDE.md`，这里不重复。

## 待处理事项

1. **Bug 表里堆了一批空行**：用户直接在 Smartsheet 里加了不少新行，但 `id` 列（`AUTO_NUMBER` 系统列，前缀 `B-`）没有自动填上号——推测是"整行都是空白、没有任何实际数据"的新增行，Smartsheet 不会立刻盖章生成编号，要等这一行第一次有真实写入才会补上。**接手后先用 `get_sheet_summary` 拉一下 Bug 表实际状态**，确认：
   - 真的是空行（没有标题/模块/现象等任何字段）→ 直接 `delete_rows` 清掉，是误操作产生的空壳。
   - 如果有内容但 id 没编号 → 那就不是"纯空行不生成"的问题，需要再查（比如是不是那批行是用某种批量粘贴方式插入的，绕过了正常的单行提交流程）。
2. **确认修复方向**：清理+验证后，正常"手动加一行、填内容"的场景下 id 会不会自动生成。
   - 如果验证下来一切正常（只是空行的锅）→ 不用改列结构，告诉用户以后加行记得至少填一个字段，id 就会自动出现，清完空行即可收尾。
   - 如果 `AUTO_NUMBER` 列在正常填写场景下依然不可靠 → 用户明确说了备选方案："把 id 置灰打开，我手动填写"，即把 `id` 列从 `AUTO_NUMBER` 改成普通 `TEXT_NUMBER`（`update_column`），让用户自己手填 `R-xxx`/`B-xxx`。改了的话要同步更新 `CLAUDE.md` 里"两张表的 id 都是新增一行时 Smartsheet 自动生成"这句，因为就不再是真的了。
3. 处理完之后正常按 `CLAUDE.md` 里定的工作流走：读表 → 处理 → 状态改「处理中」→ 完成后改「已处理」/「已解决」并回填版本号。
