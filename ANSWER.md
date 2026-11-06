# Cindy AI 工程实习生笔试答卷

- [Part 0：上手题](#part-0)
- [Part A：判断力](#part-a)
- [Part B：动手做](#part-b)
- [最后一题：你怎么用 AI](#ai-use)

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

### (c) 提交记录

| 提交 | 内容 |
| --- | --- |
| `61f553b` | 整理 Part 0 项目导览、插件能力及对应源码依据。 |
| `b416577` | 补充 Part 0 每日单词卡的模型调用、用户配置和凭证方案。 |

<a id="part-a"></a>

## Part A · 判断力

### A1：一个用户反馈和一个需求

#### (a) 是否同意这个方案？问题在哪？

不同意直接这样上线。用户需要正确的日期，但秒级时间戳每次请求都变，放进稳定的 system prompt，会影响后面内容的缓存。

使用前缀缓存的模型会复用前面相同的内容。时间一变，从这里往后就无法按原来的前缀命中；如果时间放得靠前，后面的长对话也可能受到影响。Cindy 的 [Agent 规则 §3.1](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/docs/dev-rules/maker-core-and-agent-behavior.md#L768-L779)明确要求缓存前缀稳定，时间戳等动态内容放在 per-call userPrompt。

还需要带上用户的时区，否则服务器和用户可能不在同一天。日期也不能只在新建会话时写一次，旧会话过了午夜还要更新。

#### (b) 上线后谁受影响、影响多大，能否发现？

长对话、请求频繁，而且依赖前缀缓存的用户更容易受影响。原本可以复用的历史需要重新处理，未缓存输入会增加，费用和首 token 延迟也可能上升。时间戳之前的相同内容仍可能命中缓存，不能直接说全部缓存都失效。

影响大小取决于时间戳的位置、后面的历史长度、模型和调用频率。

如果测试只看“今天几号有没有答对”，这个问题很容易漏掉。需要用相同的会话做前后对照，按模型比较缓存输入、未缓存输入、首 token 延迟和费用。时区和跨日问题再单独检查。

#### (c) 怎样解决用户的原始问题？

每次真正发请求前，由宿主生成用户当地日期、时区，以及任务需要的具体时刻，放进本轮的 per-call userPrompt。system 里保留解释时间的规则，前面的稳定内容和工具顺序保持不变。

问“这周”时，按用户当地日期和约定的周起点计算；问“过去 24 小时”时，再用精确时刻。恢复旧会话、跨日或排队后执行，都重新生成时间。这样模型每轮都有当前日期，用户不用再手动提醒。至于这周发生了什么事，仍要查实际来源。

上线前检查跨年、跨午夜、不同时区和旧会话恢复，再小范围上线观察缓存与延迟。

### A2：审阅一份 AI 给出的排查报告

#### 这份报告的问题

报告说清楚了这次配置为什么没更新：远端有 46 条，本地有 45 条，两份配置的 `updatedAt` 相同，客户端因此保留缓存。

还没回答的是：内容改了以后，`updatedAt` 本来该不该跟着改？这个约定没查清，就不能直接认定客户端有缺陷，更不能据此安排一周重写。

如果 `updatedAt` 用来表示配置版本，约定每次改内容都要递增，那这次就可能是发布时漏改了版本。客户端保留缓存符合这个约定。直接删掉比较，还会把防止旧配置覆盖新配置的保护一起删掉。

“影响所有用户”也说得太满。持有这份旧缓存的客户端会遇到问题，但没有缓存、缓存版本不同的客户端走什么路径，还没有确认。报告没有把影响范围分清，也没有说明为什么需要重写一周。

#### 采信报告前先做什么

先查版本约定和发布流程。当前源码的 [modelRegistry.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/packages/model-providers/src/modelRegistry.ts)区分新版本、旧版本和同版本冲突；[维护文档](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/docs/dev-rules/model-catalog-maintenance.md)要求发布时提升 revision，[source.ts](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/packages/model-providers/src/source.ts)保留有效快照。这些是查发布约定的入口；当前代码可能比题设版本新，题目给定的事实仍按原样分析。

在测试环境保留原来的 45 条缓存，用以下情况检查行为：

| 远端配置 | 要确认的行为 |
| --- | --- |
| 46 条，沿用原 updatedAt | 复现报告中的拒绝采用 |
| 同样的 46 条，只提高 updatedAt | 合法的新版本能否正常加载 |
| 低于缓存版本，或配置无效 | 是否保留有效缓存，避免回退或损坏 |

再检查没有缓存时如何启动，用这几种情况划清影响范围。

#### 根据结果决定修哪里

如果约定要求版本递增，改高 `updatedAt` 后也能正常加载，就先发布更高版本的正确配置，再加发布校验，避免下次又出现内容变了、版本没变的情况。

如果合法的新版本仍然被拒绝，再修具体的客户端分支。直接删掉比较会失去防回退保护，逐字段深比较也只知道内容不同，判断不了哪个版本该保留。等这些检查有了结果，再估修改范围和工期。

<a id="part-b"></a>

## Part B · 动手做

### B1：做一个插件

#### (a) 设计判断

##### 1. 纯工具、聊天卡片，还是常驻面板？

常驻面板。查 CI 时会在同一个 PR 的几项检查之间来回看，也会切换 PR，面板可以保留当前选择。布局分三栏：左边选 PR，中间选检查，右边看输出和发起分析。详情里放对应的 PR、提交和检查链接，方便回 GitHub 看原始内容。

##### 2. 联网属于哪种情况？是否需要提前声明？

这个面板属于插件主动联网。打开面板或点击刷新就要读 GitHub，不用等 Agent 调用工具，因此清单里声明 `network.hosts: ["api.github.com"]`，请求交给宿主的 `cindy.fetch`。

如果只是当前 Agent 调用工具时顺便联网，普通 HTTPS 请求可以带本次 `msg.callId`，不必额外声明 `network`。但这个 callId 只在本次工具调用结束前有效，不能存下来给面板或后台继续用。

凭证还要单独声明来源和允许注入的域名，带 callId 也不例外。因此这个插件同时声明了联网域名和 GitHub 凭证。依据见[在途调用说明](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-agent-call-context.md)与[网络代发说明](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-network.md)。

##### 3. GitHub Token 怎么来，存在哪？

先复用本机 GitHub CLI 的登录，清单里写 `source: "gh-cli"`。没有可用登录时，再让用户在设置页填备用 PAT，保存到宿主的 `/secrets`。宿主只给声明过的 `api.github.com` 请求加认证头，Token 不放进 `/kv`、面板消息或日志。

能读哪些仓库和检查，取决于账号和 Token 的权限。分析使用 Cindy 已配好的模型，不需要再填模型 Key。

##### 4. 点击 PR 后怎样把工作交给 AI？

用户从面板点分析时，没有正在等待结果的 Agent 工具调用，所以这里创建插件自己的任务。先重新读取 PR 的 head、检查状态和输出，确认仍然是用户选中的那次失败，再用 `cindy.tasks.create` / `send` 交给 AI。清单需要 `agent.tasks: true`，后续用 `readMessages` / `getRun` 读取进展。接口依据见[任务手册](https://github.com/makecindy/cindy/blob/3ee8ca120270e005403cacf6fdbd5c6abe546207/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-agent-tasks.md)。

把仓库、PR、完整 SHA、检查 ID、原始链接和失败输出一起交过去，让 AI 知道具体在查哪一次失败。只有退出码、没有详细报错时，就继续查日志或说明还缺什么，不能直接给根因。

同一份结果重复点击时复用任务。发送结果不明确时，先提示核对，不自动重发；如果已经有新提交或检查重跑，就让用户刷新后再分析。

#### (b) 做出来

做了一个叫 PR Dock 的插件，已经装进 Cindy。左边列出本人创建和待本人审阅的 PR，选中后可以看 CI、打开原始链接，或把失败检查交给 AI。[源码](b1-pr-dock/plugin/)和[安装方法](b1-pr-dock/README.md)都放在仓库里。

用[测试 PR #1](https://github.com/SocrAItes/cindy-ai-coding-assignment/pull/1)验证时，故意把 fork 的提交链接改成基础仓库，触发已有测试失败。Cindy 读了 CI 日志和 diff，找到了这个错误，但面板最初没有显示最终回复。查下来是因为只取了前 20 条任务消息，回复在后面的页。补上分页读取后，又处理了插件更新后已有任务的恢复，面板才正常显示出同一任务的回复。

GitHub 连接也遇到过问题：设备登录请求失败，用本机已有代理后连上了。分析任务中还补充了 GitHub CLI 路径和进程代理，并手动允许只读命令。

界面上另外修了两处容易误导用户的问题：连接失败曾被显示成“没有开放 PR”；切换 PR 后，旧请求可能晚回来覆盖新内容。现在分别显示连接错误和空列表，并忽略过期响应。

[运行截图](b1-pr-dock/screenshots/pr-dock.png)展示了面板里的分析回复，测试结果、版本和原始日志见[验证记录](b1-pr-dock/VALIDATION.md)。

### B2：写一个 Skill

#### (a) SKILL.md

完整指令在 [SKILL.md](b2-skill/wrap-up/SKILL.md)。说“收工”后，按测试、看完全部改动、检查临时调试代码、写摘要的顺序执行。

#### (b) 哪些写成固定动作，哪些交给 AI 判断？为什么？

| 固定动作 | 需要判断的内容 |
| --- | --- |
| 从项目规则和脚本确定测试入口，执行并记录结果 | 哪些现有测试覆盖本次改动；失败是否与改动有关 |
| 覆盖已暂存、未暂存和未跟踪文件；有任务基线时检查整个范围 | 改动是否满足需求，错误路径和调用关系是否正确 |
| 搜索并逐条检查调试痕迹 | `console.log` 是临时输出还是正式日志；常量是写死的返回值还是正常测试数据 |
| 按四步汇总检查结果 | 哪些问题影响交付，需要在摘要中说明 |

顺序和检查范围固定下来，可以少漏步骤。代码有没有问题仍要看上下文：`console.log` 可能是正式日志，测试里的常量也可能是正常数据，搜到后要判断用途。

测试失败也继续做后面能独立完成的检查，最后一起报告结果。

#### (c) 为什么适合做成 Skill，而不是插件？

这里需要的是让 AI 每次按同样的顺序收尾。测试、Git 和文件搜索都已有工具，一份 Skill 就能说明该怎么用，不需要再开发面板或后台服务。

<a id="ai-use"></a>

## 最后一题：你怎么用 AI

### (a) 最近完整交付了什么？你和 AI 分别做了什么？

最近在做个人开源项目 [Market-Impact-Radar](https://github.com/SocrAItes/Market-Impact-Radar/)，目前还没有实际运行。它想把可能影响 A 股股价的新闻整理成事件，做影响评分和中文分析，在 Dashboard 展示，并把符合条件的事件推送到企业微信。

主要负责确定关注哪些事件、怎样排序、什么情况下允许推送，以及检查实现是否符合这些要求。AI 协助编写采集、处理、接口和页面代码，项目结构和运行方式见 [README](https://github.com/SocrAItes/Market-Impact-Radar/blob/ef117cb3c5465fa7460b9d1bd72ec46246cdef2c/README.md)。

### (b) AI 有没有跑偏或给错结论？怎样发现的？

检查推送逻辑时发现，AI 给出的流程允许用规则评分或回退结果进入推送，即使预期的 API 分析还没有完成。这样就可能把没有经过分析的消息发出去。后来补上发送前的检查：分析完成才允许推送，没完成就跳过本轮；紧急事件优先分析。

### (c) 写过什么规则？为什么加这一条？

[收工 Skill](b2-skill/wrap-up/SKILL.md)里写了这一条：

> “收工”只启动检查，不自动修复、删除文件、commit、push、创建 PR 或发布。

检查结束后还要看一遍结果，再决定是否提交。把这条写进规则，可以防止 AI 收尾时顺手上传代码。测试失败或有步骤没跑，也要在摘要里说明。

### (d) 用了多少 token 或费用？什么模型？怎样控制用量？

没有完整记录这套题的 token 和费用，没法给出总量。Forge 制作插件时用了 Codex / GPT-6.1-Sol，CI 排查任务用了 Pi / DeepSeek V4 Flash。

用量主要靠控制读入的内容：先搜索相关文件，再读具体实现；已经查清楚的接口沿用前面的结果。遇到错误先跑本地检查，把报错范围缩小后再交给 AI。

### (e) 哪一题还不确定？为什么？

A1 的缓存影响有多大还不确定。时间戳每轮变化会影响前缀缓存，但实际增加多少费用和延迟，取决于模型、时间戳位置和会话长度。没有做过相同会话的对照测试，暂时给不出数字。
