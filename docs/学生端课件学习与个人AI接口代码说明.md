# 学生端课件学习与个人 AI 接口：代码说明

更新日期：2026 年 10 月 24 日

功能分支：`feat/student-courseware-ai-chat`

对比基线：`demonj040327-lang/student-workbench` 的 `main`

## 这部分实现了什么

教师上传并发布课件后，学生可从课程资料卡片打开学习弹窗，在同一处阅读 PDF 或解析文字、查看分步指导与练习，并围绕当前课件提问。问答支持纯本机原文检索，也支持学生自行配置的 ELM 或 DeepSeek API。教师可先把原文件解析后保存为草稿，再决定是否生成 AI 指导、题目及发布。

这部分沿用项目已有的课程资料结构和本机存储；没有加入学校账号认证、跨设备同步或新的云端数据库。

## 从点击课件到得到回答

```text
教师上传文件 → 本机解析 → 保存草稿 → 审核 / 发布
                                  ↓
学生课程资料卡片 → 学习弹窗 → 原文 / 指导 / 练习 / 问答
                                           ↓
                          本机检索相关页 → 可选：个人 API 请求
                                           ↓
                              回答附来源页，学生核对原文
```

1. `src/CampusApp.tsx` 只把当前课程中已发布的资料提供给学生。点击资料卡片时记录触发按钮并设置 `materialId`；资料失效或撤回后，清除当前选择。
2. `src/StudentStudyModal.tsx` 用原生 `<dialog>` 打开课件。弹窗关闭时恢复页面滚动并把焦点送回刚才的卡片；按 Escape、点击弹窗外侧或点“关闭”均可退出。Tab 焦点限制在弹窗内；打开个人 API 设置窗口时暂时让该窗口接管焦点。
3. `src/CampusLearning.tsx` 承载四种学习内容。弹窗默认显示原文，同时保留问答栏。可翻页并定位回答引用的页码；PDF 用嵌入预览，非 PDF 显示解析文字及格式提示。分步指导和练习的完成状态通过 `onProgress` 更新。
4. 提问时 `CampusLearning` 调用 `studyRequest('ask', …)`。纯本机模式不发送个人 Key；AI 模式带上学生当前选定的个人 API 配置，并标记 `credentialScope: 'student'`。发送中用请求锁避免重复提交，组件卸载时取消未完成请求。回答记录保留本次使用的提供方标签。
5. `server/study-api.mjs` 的 `retrieveSources` 先从当前文档选择相关页，`askDocument` 再走本机检索或模型路径。AI 回答需要页码引用；`grounded` 表示引用格式与当前文档来源校验通过，不等于自动核实事实。

## 文件与职责

| 文件 | 本分支的主要内容 |
| --- | --- |
| `src/CampusApp.tsx` | 学生资料弹窗入口、个人 API 设置入口和 ELM / DeepSeek 选择 |
| `src/StudentStudyModal.tsx` | 学习弹窗、关闭方式、滚动与键盘焦点管理 |
| `src/CampusLearning.tsx` | 原文翻页、PDF / 文字预览、指导、练习、检索与问答 |
| `src/campus.css` | 弹窗、双栏学习区与响应式布局 |
| `src/CampusTeacher.tsx` | 原文草稿保存入口；沿用现有生成、编辑、发布、撤回流程 |
| `src/campusStore.ts` | `PersonalApi` 增加可选提供方字段，兼容原有 ELM 数据形状 |
| `server/study-api.mjs` | 文件解析、来源检索、个人凭据隔离、模型请求与回答验证 |
| `server/study-api.test.mjs` | 个人 Key 不回退到教学凭据、DeepSeek 固定端点等回归测试 |
| `src/locales/campus.en.json`、`src/locales/en.json` | 新增入口、提示和错误信息的英文文案 |
| `README.md`、`server/README.md`、`docs/学生教师双视角说明.md` | 运行配置与使用说明 |

## 教师端原文草稿

`CampusTeacher.saveSourceDraft` 检查文件类型和 25 MB 大小限制，调用 `sourcePayload` 和本机 `parse` API 提取内容，然后清空自动生成的 `units`，以 `draft` 状态保存原文件与解析结果。这样教师可以先保存并检查原文，再按需生成指导或题目。发布与撤回仍使用原有状态切换；草稿不出现在学生资料列表。文件和资料保存在当前浏览器的本机存储中。

## ELM 与 DeepSeek 的边界

- 学生在 `ApiSettings` 选择提供方，输入自己的 Key 与模型名。切换提供方时清空输入的 Key；DeepSeek 的默认模型名为 `deepseek-flash`。教师端仍仅使用 ELM。
- `PersonalApi` 保存在 React 页面状态中，不写入浏览器持久存储、课件或提交的代码。刷新页面会清除本次输入。保存配置只保存输入，不代表 Key 已通过实际服务验证。
- `personalModelEnv` 要求学生 AI 请求提供个人 Key，不能回退使用教师的服务端凭据。它拒绝未知提供方、格式无效的 Key / 模型名，以及教师范围的 DeepSeek 请求。
- DeepSeek 仅接受代码中列出的模型名；服务端固定请求 `https://api.deepseek.com/chat/completions`，忽略浏览器传来的地址。请求只含当前问题与从当前课件检索的相关文字片段；不会把完整原件自动上传给 DeepSeek。调用可能产生费用，使用前应确认课件内容适合发送给该服务。
- ELM 路径继续使用学校接口；DeepSeek 路径不会借用 ELM Key。教师的生成路径不因学生切换提供方而改变。

## 本地验证与仍需验证的部分

截至本文编写时，`npm run build` 通过；`server/study-api.test.mjs` 与 `server/coursework-api.test.mjs` 共 24 项通过；`git diff --check` 通过。浏览器中已检查学生资料弹窗、提供方切换及切换后 Key 清空。DeepSeek 端点和凭据隔离通过模拟响应验证。

尚未用真实 DeepSeek Key 进行付费请求，也未把学校 ELM Key 放进代码或仓库。因此这份验证不声称两个真实外部服务的额度、权限或模型可用性。项目仍是本地原型：正式部署前还需接入身份认证、课程访问权限、服务端持久化和跨设备同步。

## 给后续修改者的入口

- 调整学生弹窗和问答体验：先看 `StudentStudyModal.tsx` 与 `CampusLearning.tsx`。
- 调整个人 API 选择和提示：看 `CampusApp.tsx` 里的 `ApiSettings`。
- 调整安全校验、检索或模型协议：看 `server/study-api.mjs` 的 `personalModelEnv`、`retrieveSources`、`callModel`、`askDocument`，并更新对应测试。
- 调整教师上传和草稿流程：看 `CampusTeacher.tsx` 的 `saveSourceDraft`、`upload`、`generate`、`publish`。
- 调整中英文内容：同步检查 `src/locales/` 的文案。
