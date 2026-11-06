# PR Dock 故障案例

[fork-link-regression.patch](fork-link-regression.patch) 把 fork 提交链接中的 head 仓库替换为基础仓库，触发已有测试的链接断言。该故障用于[测试 PR #1](https://github.com/SocrAItes/cindy-ai-coding-assignment/pull/1)，分支为 `test/b1-failure-analysis`，远端 CI 结果为 13 项通过、1 项失败。插件正式源码没有应用此补丁。

以下命令从仓库根目录执行。

## 复现

1. 以测试通过的正常代码为起点，新建测试分支：

   ```sh
   git switch -c demo/fork-link-regression
   git apply demo/fork-link-regression.patch
   node --test b1-pr-dock/test/*.test.mjs
   ```

2. 测试应因 fork 提交链接不匹配而失败。将故障改动提交为测试 PR 后，GitHub Actions 会运行同一组测试。
3. 在 Cindy 的 PR Dock 中选择该 PR 和失败检查，打开 PR、提交及检查链接，再发起分析。

## 检查结果

- 三个来源链接分别对应选中的 PR、提交和检查。
- 分析引用实际 SHA 与失败断言，指出链接误用了基础仓库，并给出修复验证方法。只有退出码时，应继续读取日志。
- 重复点击复用同一任务；有新提交或检查重跑时，刷新后使用新结果。

已完成案例的截图、日志和分析回复见[验证记录](../b1-pr-dock/VALIDATION.md)。

## 撤销故障

在应用过补丁的测试分支执行：

```sh
git apply -R demo/fork-link-regression.patch
node --test b1-pr-dock/test/*.test.mjs
```
