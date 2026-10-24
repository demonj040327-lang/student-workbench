# workbench · 高校课程学习工作台

TeachAthon 2026 本地原型：教师按课程上传并发布资料，学生查看学期作业进度、每周任务，使用已发布的学习指导与练习，并通过自己的 ELM 或 DeepSeek API 针对课件提问。

## 使用说明

完整操作步骤见 **[workbench 使用说明](docs/学生教师双视角说明.md)**，包括教师上传与发布、学生学习与问答、API 设置、资料保存和常见问题。

当前实现范围与主要代码见 **[学生端课件学习与个人 AI 接口代码说明](docs/学生端课件学习与个人AI接口代码说明.md)**。

- [学生演示](http://localhost:5175/?demo=1&role=student)
- [教师演示](http://localhost:5175/?demo=1&role=teacher)
- [正式教师工作区](http://localhost:5175/?role=teacher)
- [正式学生工作区](http://localhost:5175/?role=student)

右上角可切换中文 / EN；切换学生或教师身份时，退出后重新选择对应入口。演示和正式数据独立。正式工作区首次使用时，先由教师创建课程、上传课件并发布，再切换到学生视角学习。

界面沿用浅灰背景、白色面板、深色文字和蓝色主操作；课程保留各自的区分色。

## 本地整合与演示

- [整合核查与下一步分工](docs/整合核查与下一步分工.md)
- [演示资料精选与录屏路线](docs/演示资料精选与录屏路线.md)
- [本地实时语音部署与测试](docs/本地实时语音部署与测试.md) · [实测结果](docs/实时语音实测结果.md)（底层语音服务）
- [课堂录音与翻译使用说明](docs/课堂录音与翻译使用说明.md)（学生端顶部入口）

学习搭档在 `feat/peer-learning` 本地分支；匹配按课程、语言及时段进行。演示资料库按 `config/demo-library.json` 精选，原件与缓存保留，刷新演示页后生效。

## 本地启动

```sh
npm install
npm run dev -- --port 5175 --strictPort
```

需要课堂录音与实时转写时，运行 `npm run dev:classroom`，或另外启动 `tools/start-local-speech.sh`。学生端顶部“课堂录音”打开面板；翻页和收起面板不会停止录音。

双击 `student-workbench.code-workspace` 可在 VS Code 编辑。服务绑定本机地址，手机布局可通过浏览器设备模式查看。

## 个人 AI API 与教学 ELM 配置

学生在界面选择 ELM 或 DeepSeek，填写自己的 API Key 和模型名称；DeepSeek 默认模型为 `deepseek-flash`。Key 只存在页面内存中，刷新后清除。学生调用不会回退到教学凭据，也不会把一种提供方的 Key 发送给另一种提供方。DeepSeek 请求由本机后端固定发送至 `https://api.deepseek.com/chat/completions`，只包含当前课件的相关文字片段和学生的问题。使用 DeepSeek 可能产生 API 费用，模型与价格以 [DeepSeek 官方文档](https://api-docs.deepseek.com/quick_start/pricing/) 为准。

教师可以在界面填写独立 Key，或使用 `.env.local` 中已有的本机 ELM 配置。服务端环境变量见 `.env.example`，不要把真实密钥写入代码或使用 `VITE_` 前缀。

上传先进行本机文字解析，点击生成后才调用模型。问答只向当前选择的提供方发送当前课件中检索到的相关文字片段。

## 主要代码

| 文件 | 用途 |
|---|---|
| `src/CampusApp.tsx` | 双视角入口、作业进度、每周任务、提醒和 API 设置 |
| `src/CampusTeacher.tsx` | 教师上传、生成、审核编辑、发布和撤回 |
| `src/CampusLearning.tsx` | 学生指导、练习、问答和原文阅读 |
| `src/campusStore.ts` | 示例数据、课程归属、浏览器存储和个人进度 |
| `src/campus.css` | 页面布局、原有配色和响应式样式 |
| `src/SemesterOverview.tsx` | 学期时钟与课程作业时间轴 |
| `src/i18n.tsx`、`src/locales/` | 中英文界面文案 |
| `server/study-api.mjs` | 文件解析、来源检索、指导生成和 ELM 转发 |

旧版 `src/App.tsx`、`AssignmentPlanner.tsx` 和 `CourseQuestions.tsx` 保留作参考；当前入口为 `CampusApp.tsx`。

## 构建与测试

```sh
npm run build
node --test server/study-api.test.mjs
npm run preview -- --port 5175
```

服务端测试使用模拟模型响应。开发和预览服务会挂载本机 API，直接静态托管 `dist/` 不会提供这些接口。

当前资料和进度保存在浏览器中，演示与正式工作区独立。视角切换尚未接入学校身份认证、选课权限或多用户服务端数据；尚未实现跨设备同步和原生 App 打包。请统一使用同一个访问地址。

## Coursework 生成长度与失败恢复

作业步骤默认最多输出 6000 tokens，可通过服务端 `STUDY_COURSEWORK_MAX_TOKENS` 覆盖；其次使用 `STUDY_PLAN_MAX_TOKENS`。等待时间优先使用 `STUDY_COURSEWORK_TIMEOUT_MS`，默认 120000 ms。变量只能在服务端配置，修改后重启开发服务。模型若截断 JSON，仍拒绝采用，允许保留编辑内容后重试。

教师编辑窗口会将文件解析结果、日期和草稿自动保存到本机 IndexedDB，重新打开可恢复；演示与正式草稿独立，API Key 从不加入草稿。草稿不是已发布作业，浏览器清除站点数据后会丢失。

文件解析所选 Python 需要安装 pypdf；读取 YAML 凭据时还需要 PyYAML。通过本机 `STUDY_PYTHON_BIN` 指定带这些依赖的解释器，不要将某位组员的绝对路径写死到共享源码。

### 本机真实课程资料演示

`?demo=1` 在发现本机 `data/local-demo-library/manifest.json` 时，会导入经过筛选的课程资料。原件、解析文字、模型结果和报告都在 Git 忽略目录中，不随源码分发或生产构建发布。个人工作区不受此导入影响。

```bash
COURSE_LIBRARY_ROOT="/path/to/course-folders" node tools/test-local-course-library.mjs --ai
node tools/report-local-course-library.mjs
```

目录中应包含四门课对应的文件夹。需要配置现有 ELM 接口和文档解析所需 Python；`--ai` 会调用真实模型，已成功的同一文件会复用本机缓存。筛选规则在脚本中明确列出，个人答案、代码、实验结果、翻译和备份不会自动导入。普通上传仍限制 25 MB，超过上限的原件仅通过本机受限资料库导入。Coursework 作为待教师确认日期的草稿；没有明确时区或时刻时，不自动补日期。

测试报告：`data/local-demo-library/测试报告.md`。AI 流程成功表示结构和出处校验通过，不等于所有知识点均经人工核实。

### 教师后台任务与预览

课件的 AI 草稿、题目生成使用页面内队列，可连续提交文件，并在任务进行时切换课程或页面。任务面板显示等待、解析、生成、完成或失败；失败可单独重试，成功结果保存为草稿并提示教师。此队列尚不是服务端持久任务，刷新或关闭应用会中断未完成的工作。API 凭据只保留在内存中，不写入任务记录。

课件列表与已完成任务支持学生视角预览。预览中的练习进度只在弹窗内生效，不写入学生记录；预览不会调用学生 API。教师总览与导航显示所教课程的待回复问题数，可直接进入待回复列表。
