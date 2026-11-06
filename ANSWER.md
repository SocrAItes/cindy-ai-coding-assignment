# Cindy AI 工程实习生笔试答卷

<a id="part-0"></a>

## Part 0 · 上手题（30 分）

### (a) 项目导览（10 分）

**这个项目做什么**

Cindy 是一个开源的 AI Agent 应用，用户可以通过对话让 AI 在自己的电脑上处理文件、使用浏览器和应用。它把 Claude Code、Codex、Pi 等 Agent 接到同一个界面里，也支持在连接好的电脑和手机上继续同一项任务。项目用途见仓库的 [README](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/README.zh-CN.md)。

**由哪些部分组成，各自负责什么**

这个仓库包含客户端和共享代码，完整后端在另一个仓库。主要分为以下几部分：

- **桌面端**：`apps/desktop` 是 Electron 应用。`src/renderer` 负责界面，`src/main` 负责本机服务。
- **移动端**：`apps/mobile` 是 Expo / React Native 应用，提供手机端的交互。两个客户端的目录划分见[根 README](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/README.md#for-developers)。
- **Agent 执行**：`packages/maker-core` 负责共享的 Agent、会话和执行逻辑；`src/agents` 适配不同 Agent。桌面端的 [maker-host/index.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/src/main/maker-host/index.ts) 把这些逻辑与 Electron 服务接起来。
- **模型配置**：`packages/model-providers` 管理模型清单和供应商配置。[source.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/packages/model-providers/src/source.ts) 负责加载，`modelRegistry.ts` 负责版本判断。
- **插件宿主**：`apps/desktop/src/main/cindy-brain` 负责运行插件、接收消息，并处理插件发来的能力请求，对应实现可看 [cindySlot.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/src/main/cindy-brain/cindySlot.ts)。

**插件可以使用哪些能力**

- **保存数据和凭证**：插件可以把普通设置、状态保存在 `/kv`，把 Token 等凭证交给宿主的 `/secrets` 管理，两者分开存储。依据：[plugin-settings.md §4.8](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-settings.md)。
- **访问外部服务**：插件可以用 `cindy.fetch` 请求 GitHub 等外部服务，由宿主代发并按声明注入凭证；插件自主联网时需要声明允许访问的域名。依据：[plugin-network.md §4.7](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-network.md)。
- **调用模型生成文本**：插件可以用 `oneshot_text` 调用宿主已有的文本模型，做总结、分类、改写或生成例句。依据：[plugin-runtime.md §4.0.2](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md#L248-L295)。
- **把工作交给 Agent**：插件可以创建自己的任务，让 Agent 排查 CI 等问题，并读取进展和回复。依据：[plugin-agent-tasks.md §4.11.3](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-agent-tasks.md#L197-L208)。
- **提供交互面板**：插件可以在 Cindy 中显示自己的面板，让用户浏览内容、点击操作，宿主提供面板容器和主题。依据：[plugin-panels.md §5](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-panels.md)。

**阅读顺序和 AI 的使用**

先让 AI 结合 README 和目录，总结项目做什么、有哪些特点、哪些部分值得重点看。得到整体认识后，再围绕题目读具体实现：单词卡查模型调用，PR 看板查联网、凭证和任务交接。

AI 帮忙找文件、解释代码和整理初稿，关键接口与限制再对照手册和源码确认。本次阅读基于 `3ee8ca1`。
