# Cindy AI 工程实习生笔试答卷

<a id="part-0"></a>

## Part 0 · 上手题

### (a) 项目导览

**这个项目做什么**

Cindy 是一个开源的 AI Agent 应用，可以通过对话让 AI 操作电脑上的文件、浏览器和应用。Claude Code、Codex、Pi 等 Agent 都接在同一个界面里，用户可以使用已有的模型和订阅，也能在连接好的电脑和手机上继续任务。项目介绍见 [README](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/README.zh-CN.md)。

**由哪些部分组成，各自负责什么**

这个仓库放的是桌面端、移动端和共享代码，后端服务在另一个仓库。

- **桌面端**：`apps/desktop` 用 Electron 实现，界面在 `src/renderer`，本机服务在 `src/main`。
- **移动端**：`apps/mobile` 用 Expo / React Native 实现，负责手机端界面。客户端目录见[根 README](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/README.md#for-developers)。
- **Agent 执行**：`packages/maker-core` 管理 Agent、会话和执行逻辑，其中 `src/agents` 适配不同 Agent。桌面端通过 [maker-host/index.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/src/main/maker-host/index.ts) 接入这些共享逻辑。
- **模型配置**：`packages/model-providers` 管理模型清单和供应商配置。[source.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/packages/model-providers/src/source.ts) 负责加载，`modelRegistry.ts` 负责版本判断。
- **插件宿主**：`apps/desktop/src/main/cindy-brain` 运行插件，处理插件与宿主之间的消息和能力请求，入口见 [cindySlot.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/src/main/cindy-brain/cindySlot.ts)。

**插件可以使用哪些能力**

- **保存数据和凭证**：普通设置和状态放在 `/kv`，Token 等凭证交给宿主的 `/secrets` 管理。见[plugin-settings.md §4.8](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-settings.md)。
- **访问外部服务**：通过 `cindy.fetch` 让宿主代发请求、注入凭证；插件自主联网要声明允许访问的域名。见[plugin-network.md §4.7](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-network.md)。
- **调用模型生成文本**：用 `oneshot_text` 调用宿主已有的文本模型，完成总结、改写或生成例句等工作。见[plugin-runtime.md §4.0.2](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md#L248-L295)。
- **把工作交给 Agent**：创建插件自己的任务，让 Agent 继续处理，并读取任务进展和回复。见[plugin-agent-tasks.md §4.11.3](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-agent-tasks.md#L197-L208)。
- **提供交互面板**：在 Cindy 中显示列表、详情和操作按钮，使用宿主提供的面板容器和主题。见[plugin-panels.md §5](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-panels.md)。

**阅读顺序和 AI 的使用**

开始时先让 AI 读 README 和目录，整理 Cindy 做什么、有哪些特点、哪些部分值得重点看。之后沿着题目往下查：单词卡需要生成例句，就读 `oneshot_text` 的手册和宿主处理代码；PR 看板需要联网、登录和派发任务，就读对应的网络、凭证与任务接口。

AI 帮忙找文件、解释实现和整理初稿。具体接口怎么调用、有哪些限制，再回到手册和源码核对。

### (b) 一个具体需求

#### 1. 这个插件应该怎么用上模型？

用 Cindy 已有的 `oneshot_text` 就够了。这里只需要根据单词生成例句，用不上 Agent 的工具执行能力。

仓库内的[插件运行手册 §4.0.2](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md#L248-L295)给出了用法：清单声明 `cindy.text: ["oneshot"]`，再通过 `cindy.send` 发出 `kind: "oneshot_text"` 的请求。宿主处理位于 [cindySlot.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/src/main/cindy-brain/cindySlot.ts)。

可以把当天的 10 个单词和工作场景一起发过去，要求每个单词对应一句例句。拿到结果后，还要检查有没有漏词、例句是否对应。即使设置了 `expectJson`，也只是保证 JSON 能解析，内容仍要由插件检查。

#### 2. 用户需要额外配置什么吗？为什么？

如果 Cindy 已经配好了可用的文本模型，插件就不需要再收一份模型 Key。用户需要提供的是工作场景，比如“产品经理，平时写需求、参加评审”，这样例句才知道往哪个方向写。

如果 Cindy 本身还没有可用模型，就要先完成 Cindy 的模型设置。手册里的 `NO_CANDIDATE` 表示没有可用候选通道。复用宿主能力也不代表模型调用免费，费用仍取决于已有配置。

#### 3. 怎样看待让用户填写 OpenAI API Key、插件直接调接口的方案？

不建议一开始就这样做。Cindy 已经能生成文本，再让用户填 OpenAI Key，会多一道配置，也要在插件里重新处理认证、模型选择和错误，还会把这个功能限定到 OpenAI。

如果以后确实需要 Cindy 暂时不支持的能力，再考虑单独接入。Key 也应交给宿主的秘密存储管理，不能放进前端代码、普通设置或日志。
