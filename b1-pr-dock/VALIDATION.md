# PR Dock 验证记录

验证日期：2026-11-06。插件版本：0.1.5。宿主：Cindy 0.1.126。

## 真实 PR 分析

用[测试 PR #1](https://github.com/SocrAItes/cindy-ai-coding-assignment/pull/1)验证了从面板选择失败检查、创建分析任务、读取回复的完整流程。测试故意把 fork 提交链接指向基础仓库，触发已有断言失败。

| 检查 | 结果 |
| --- | --- |
| 正常代码的远端 CI | 14 项通过；提交 `4b84bceb1f7604994969afb940d931c92780458e` |
| 故障分支的远端 CI | 13 项通过、1 项失败；提交 `4fe1cba38280f9cf5733779b0e4a49cb8d9fa3b6` |
| PR 与检查列表 | 面板显示本人创建的 PR #1 及失败的 `unit-tests` |
| 来源链接 | 从面板打开 PR、提交和 Actions 检查，浏览器地址与对应记录一致 |
| AI 接手 | 创建任务 `4482fe93-9b24-4690-b92f-c2b491767ad1`，使用 Pi / DeepSeek V4 Flash（中） |
| 诊断结果 | 读取完整 CI 日志和 PR 差异，指出提交链接应使用 `pr.headRepo` |
| 回复回读 | 更新至 0.1.4 后恢复同一任务，刷新分析进展并读到最终回复，没有再次派发任务 |
| 本地检查 | 18 项行为测试、7 个 JS 文件语法检查、Playwright 界面回归通过 |

分析任务起初找不到 GitHub CLI，匿名请求又被限流。补充本机 CLI 路径和进程代理，并手动允许只读命令后完成诊断。Agent 没有独立重跑本地测试，因为任务环境的 PATH 中没有 Node；失败断言来自真实 CI 日志。

界面回归使用模拟数据，覆盖状态、分页、过滤、fork 链接、异步切换、四种窗口宽度，恢复已有任务时不再次派发，以及长回复不撑出右栏。新提交使旧分析失效、并发点击复用任务由本地测试覆盖。

## 任务回读修复

| 版本 | 改动 |
| --- | --- |
| 0.1.3 | 按 `nextCursor` 翻页读取任务消息；刷新时重读末页，接收同一条回复的流式更新。 |
| 0.1.4 | 读取插件保存的任务记录，恢复已有分析的只读刷新入口。 |
| 0.1.5 | 限制日志详情列的最小高度，长回复在右栏内滚动；增加长回复布局回归。 |

0.1.3 至 0.1.5 均通过 Forge 原位更新，GitHub 连接和任务记录保留。0.1.5 的实机截图展示了同一任务的回复，长回复滚动时 PR 列表和检查列保持可见。

## 截图与原始记录

- [PR、检查、输出与分析结果](screenshots/pr-dock.png)
- [完整失败日志](evidence/pr-1-unit-tests.log)
- [提交、任务、版本及验证范围](evidence/b1-live-2026-11-06.json)

## 公开 PR 读取

2026-11-05，已安装插件读取了 [makecindy/cindy#9038](https://github.com/makecindy/cindy/pull/9038)，head 仓库为 `Battleplus/cindy`，提交为 `e93150f0c04c1f008c25908675aeb921393ff80b`。当时共 14 项检查：2 项失败、10 项运行中、2 项通过，原始结果见 [pr-9038.json](evidence/pr-9038.json)。

两项失败中，Greptile 输出说明评分 3/5 低于仓库要求的 4/5；`check:pr-design-basis` 只返回退出码 1 和 runner 镜像迁移提示，这些信息不足以判断根因。已打开对应的[原始 job](https://github.com/makecindy/cindy/actions/runs/42032879721/job/127263466592)。

## 环境

| 项目 | 版本或标识 |
| --- | --- |
| 宿主 | 官方 Cindy 0.1.126，macOS arm64 |
| 安装包 sourceCommit | `a87d49a1a3bf1de408cfe44362f0fc78f1495deb` |
| 阅读使用的公开源码 | `3ee8ca120270e005403cacf6fdbd5c6abe546207` |
| 插件实例 | namespace `local`，instanceId `_ns__local__pr-workbench` |
| 本地行为测试 | Node.js 24.22.1 |

安装包与公开源码的提交不同，插件接口以随包手册和实际运行结果为准。

## 产物校验值

| 产物 | SHA-256 |
| --- | --- |
| Cindy 0.1.126 安装包 | `e0e43b6a9e1dfa4c4b35010ecbd102115ab0a1f863ffecc9d98bc4afa1b93abf` |
| 插件 0.1.0 | `e7081d1862fef21b347c09989e06a2e785535602d6554656ce0d351d5d4ec1d4` |
| 插件 0.1.1 | `069995a62ddd1ec606ddc70ed1fe24c1606a29a2b1fada53357b054c9af6b0ad` |
| 插件 0.1.2 | `abf049bd899470525e86f3f9b7176052c84298597092d7a58bd8242e722ed116` |
| 插件 0.1.3 | `d483a082adce0b8568b731e637bf54a38a6897d7737bf60d2e9e70fdf3be3ed2` |
| 插件 0.1.4 | `a4ab3470b1704bdeb006181a88ac09379ff5d75e7bbc95957d21fd3682ac7181` |
| 插件 0.1.5 | `0baf3eb6c75ae0e2b535033b8981204b867e8b34d23d212b8b4532ce88e7f6d7` |
