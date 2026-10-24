# 学生端课程学习与个人 AI 接口：代码说明

更新日期：2026 年 10 月 24 日

## 功能范围

教师按课程和周次发布资料，学生通过“课程学习 / Coursework”标签切换内容。课件按周折叠；点击课件进入专用学习页面，可连续阅读 PDF、查看分步指导、完成练习并针对当前资料提问。Coursework 使用独立页面，支持原文阅读、个人步骤规划和资料问答。学期总览支持添加个人安排。

## 学习页面

- `CampusApp.tsx` 负责课程、资料与学习页面的选择，保留返回入口和页面参数。
- `StudentCourseContent.tsx` 提供每周资料折叠、课程学习与 Coursework 标签，保存本机选择状态。
- `ContinuousCourseReader.tsx` 使用 PDF.js 连续渲染 PDF；滚动时更新当前页，使页码、私人笔记及问答上下文对应当前阅读位置。DOCX、PPTX 等以解析文字呈现，不能保证还原原始排版。
- `CampusLearning.tsx` 提供原文、指导、练习和问答；桌面端可调整栏目宽度。私人笔记按资料和页码保存在本机，移动端采用适配布局。
- `StudentCourseworkPage.tsx` 提供作业专用页面、个人计划与评分要求分析；这些分析使用学生自己的 API。手动完成或提交标记不代表已向学校系统提交。
- `StudentStudyModal.tsx` 保留为旧版实现；学生打开课件的主要入口已改为专用页面。

## 资料与问答流程

教师上传文件 → 本机解析 → 草稿检查与编辑 → 发布 → 学生按课程和周次打开资料。

学生提问时，前端把当前文档、阅读页码与问题交给本机接口。`server/study-api.mjs` 从当前文档检索相关文字，再执行本机检索或个人 API 问答。当前页相关问题会利用阅读位置选择上下文，回答附来源页供学生核对。引用校验通过只表示页码来自当前资料，不保证回答内容完全正确。

教师可先保存原文草稿，再分别生成学习指导与练习；草稿不向学生展示。普通上传限制为 25 MB。资料、学习进度与笔记依赖本机浏览器存储，演示与正式工作区分别保存。

## 个人 API 与凭据

学生可选择 ELM 或 DeepSeek，并填写自己的 Key 和模型名。切换提供方会清空 Key；输入只保留在页面内存，刷新后清除。配置保存不等于真实接口验证成功。

学生请求不能回退到教师服务端凭据。教师端继续使用 ELM。DeepSeek 请求固定发送到 `https://api.deepseek.com/chat/completions`，模型受服务端白名单限制，默认值为 `deepseek-flash`。请求包含当前问题及当前资料的相关文字，不会自动向模型上传完整原件或执行图像理解。真实服务的模型、权限及费用需按账户核实。

## 主要文件

| 文件 | 职责 |
| --- | --- |
| `src/CampusApp.tsx` | 课程入口、页面选择、个人 API 设置 |
| `src/StudentCourseContent.tsx` | 周次折叠和学习 / Coursework 标签 |
| `src/ContinuousCourseReader.tsx` | 连续 PDF 阅读与滚动页码同步 |
| `src/CampusLearning.tsx` | 学习指导、练习、问答与私人笔记 |
| `src/StudentCourseworkPage.tsx` | 作业原文、个人规划与问答 |
| `src/SemesterOverview.tsx` | 学期与作业时间轴、个人安排 |
| `src/CampusTeacher.tsx` | 教师上传、生成、检查编辑、发布与撤回 |
| `src/campusStore.ts` | 本机资料与进度结构 |
| `src/campus.css`、`src/workbench-polish.css` | 响应式布局与交互样式 |
| `server/study-api.mjs` | 文档解析、检索、凭据隔离和模型请求 |
| `server/study-api.test.mjs`、`server/coursework-api.test.mjs` | 后端回归测试 |

## 验证与限制

本次主线整理通过生产构建、25 项后端测试，以及浏览器中的课程标签、周次折叠、连续阅读、页码同步和栏目调整检查。外部模型相关测试使用模拟响应，未使用真实 DeepSeek Key 验证付费请求。

当前版本尚未接入学校身份认证、选课权限、云端同步或原生 App 打包。教师与学生视角属于原型界面，不构成真实权限隔离。直接静态托管构建目录不包含本机 API 服务；实际部署需要单独配置后端和持久存储。
