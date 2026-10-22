# workbench · 高校课程学习工作台

TeachAthon 2026 本地原型：教师按课程上传并发布资料，学生查看学期作业进度、每周任务，使用已发布的学习指导与练习，并通过自己的 ELM API 针对课件提问。

## 使用说明

完整操作步骤见 **[workbench 使用说明](docs/学生教师双视角说明.md)**，包括教师上传与发布、学生学习与问答、API 设置、资料保存和常见问题。

- [学生演示](http://localhost:5175/?demo=1&role=student)
- [教师演示](http://localhost:5175/?demo=1&role=teacher)
- [正式教师工作区](http://localhost:5175/?role=teacher)
- [正式学生工作区](http://localhost:5175/?role=student)

右上角切换学生 / 教师及中文 / EN。演示和正式数据独立。正式工作区首次使用时，先由教师创建课程、上传课件并发布，再切换到学生视角学习。

界面沿用浅灰背景、白色面板、深色文字和蓝色主操作；课程保留各自的区分色。

## 本地启动

```sh
npm install
npm run dev -- --port 5175 --strictPort
```

双击 `student-workbench.code-workspace` 可在 VS Code 编辑。服务绑定本机地址，手机布局可通过浏览器设备模式查看。

## ELM 配置

学生在界面填写自己的 API Key 和模型名称；Key 只存在页面内存中，刷新后清除。学生调用不会回退到教学凭据。

教师可以在界面填写独立 Key，或使用 `.env.local` 中已有的本机 ELM 配置。服务端环境变量见 `.env.example`，不要把真实密钥写入代码或使用 `VITE_` 前缀。

上传先进行本机文字解析，点击生成后才调用模型。问答只向 ELM 发送当前课件中检索到的相关文字片段。

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
