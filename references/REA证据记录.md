# REA 证据记录

复核日期：2026 年 10 月 14 日（Europe/London）。REA 原始记录保留 UTC 时间；例如 `2026-10-13T23:32:34Z` 对应英国当地 10 月 14 日。

## 1. 范围与方法

目标是为学生学习平台提供可追溯的公开前端参考。使用 [REA 技能](https://github.com/morluto/rea) 的被动浏览器观测流程与 `rea-agents@6.4.0` CLI；相关本地技能为 `/Users/jiangge/.agents/skills/reverse-engineer-anything/SKILL.md`。

- 仅观测 [Linear 官方设计文章](https://linear.app/now/how-we-redesigned-the-linear-ui) 与 [Structured 官网](https://structured.app/)。
- 使用本任务独立启动的临时 Chrome，CDP 在 `127.0.0.1:9238`，不连接用户主浏览器或账户。
- Playwright 负责访问、滚动公开页面及普通截图；**REA 只做被动页面观测和当前视口截图**，没有把这些导航行为归因给 REA。
- 没有登录、注册、购买、提交表单、调用产品 API 或访问私有源码；没有改变全局 REA 配置、MCP 注册或系统工具链。
- 保留完整 REA JSON，没有将被截断的控制台预览视为完整证据。截图从其 `data_base64` 解码，字节数与 SHA-256 均和 Evidence 内 artifact 字段核对一致。

## 2. 实际成功的 REA Evidence

| 操作／目标 | Evidence ID | 完整记录／可读图 |
|---|---|---|
| 新独立 Chrome 页面列表 | `ev_1563d7c06dc2f25b8840cc77b7a172abb57b69c98c5fadc39ce9760c7303521c` | [browser-targets-20261014.json](evidence/browser-targets-20261014.json) |
| Linear 官方文章页面 | `ev_1cbb643383e8e2f3dac78590633fa44d41604ffc9701f6a9ecb85409ac448314` | [linear-rea-page-20261014.json](evidence/linear-rea-page-20261014.json) |
| Structured 官网页面 | `ev_e04585820dee276c8f691ab38b77427290071fbc15f1c3c48166ac9a891a6097` | [structured-rea-page-20261014.json](evidence/structured-rea-page-20261014.json) |
| Linear 当前视口截图 | `ev_6e3d1ac2163694d826b3e8999189692b4000986119f2eef312cd85db5fb4e6c2` | [截图 Evidence](evidence/linear-rea-screenshot-20261014.json)／[PNG](assets/linear-rea-viewport.png) |
| Structured 当前视口截图 | `ev_7e5a861fae8e2df39916b0c065b39c37e53fee71150d9ad90af877dae185e2c5` | [截图 Evidence](evidence/structured-rea-screenshot-20261014.json)／[PNG](assets/structured-rea-viewport.png) |

页面目标 ID 分别为 `613FACC6D3B7368387E22D5600A31F70`（Linear）与 `EFFEDA0FFBC8CD771A1D618EA806A48D`（Structured）。观测浏览器报告为 Chrome/155.0.8059.41；REA 没有观察其宿主平台或 CPU 架构。

成功页面观测包含 DOM、可访问性信息和脚本／资源元数据。未请求脚本源码、存储键、存储值、Console 文本、JSON 或 WebSocket 正文。

## 3. 观察、推断和未知

| 问题 | 直接观察／厂商说明 | 合理推断 | 仍然未知 |
|---|---|---|---|
| 两个公开页面是否确实被调查 | REA 列表、页面 title／URL、DOM 与截图 Evidence 相互对应 | 无需额外推断 | 登录后 App 行为不在范围内 |
| Linear 布局 | 官方文章图可见侧栏、条目列表、详情；文章解释对齐、层级与视觉噪声 | 同类布局适合课程工作台 | 未测试 Linear 账户内导航与交互 |
| Linear 技术 | 普通公开 DOM 引用 `static.linear.app/web/_next/`；[2026 官方技术文](https://linear.app/now/styling-linear-for-the-future-stylex)说明 React 应用迁移到 StyleX | 文章页资源呈现 Next.js 特征 | 产品内部组件、状态管理、API、后端未恢复 |
| Structured 官网技术 | REA 同源脚本含 `_next/static/chunks/`、`app/layout`、`app/page`，并列出 73 条同源资源 | 官网呈现 Next.js 特征 | 手机原生 App、`web.structured.app` 的完整技术栈 |
| Structured 产品布局 | 独立检查官网已链接的 phone／MacBook 原图，可见任务 Inbox 和时间线 | 短学习任务可借鉴时长、待安排和继续状态 | 实际拖拽、同步、通知、AI 规划与性能 |
| MyStudyLife／Shovel | 已有普通 Chrome 截图及 DOM 子报告；来源链接在 [子报告](research-student-planners.md) | 可借鉴课程分色、周历、任务与时间同屏 | 本轮没有它们的 REA Evidence；不把普通截图冒称 REA |
| 学习兴趣与成效 | 本次没有学习效果试验 | 短任务可能降低开始学习的阻力，需验证 | 兴趣、理解、成绩和长期留存是否改善 |

**闭源真实 App 的完整源码没有恢复。** 公开营销 DOM 与官方宣传图不等于产品内部实现；读取脚本 URL 也不证明每个模块实际执行或能重建全部应用。

## 4. REA 覆盖限制

- 两份页面记录的完整性为 `policy_filtered`，同时带 `attach_limited`；“成功”不等于没有遗漏。
- 默认限定页面当前 origin。Linear 使用 `static.linear.app` 等 CDN，其部分脚本、资源和元数据被排除；本轮没有扩大到所有第三方域。Linear 的技术说明同时引用普通 DOM 记录和官方技术文章，并说明各自性质。
- Structured 的 23 条保留脚本和 73 条同源资源是该营销页面的观察范围，不是产品组件清单。部分跨域、URL 无法归因和不支持的 frame 仍被过滤。
- REA 附加前的网络和 Console 活动不可见；本轮短时观测不能说明完整加载链、所有错误或历史请求。
- REA 不保留 Cookies、授权头、存储值及原始网络正文；Source Map 只报告声明 URL，没有抓取。本轮也没有请求脚本源文本。
- 截图仅记录当前视口。Linear 截图在文章产品图附近，Structured 截图在官网团队区；它们用于证明页面观测，产品布局另引用公开原图。截图不是完整页面或登录后产品操作记录。
- 静态资源路径、DOM 类名和宣传图片均不能验证运行性能、服务端算法、同步可靠性或学习效果。

## 5. 失败与修复记录

### 保留的旧记录

旧浏览器列表 [browser-targets.json](evidence/browser-targets.json) 含真实 Evidence `ev_c643d3417956c1d4e86a833acf22573befc621761fb7f9797b569870b434fd6f`，指向先前 `9237` 浏览器。

旧文件 [linear-rea-page.json](evidence/linear-rea-page.json) 和 [structured-rea-page.json](evidence/structured-rea-page.json) 返回 `Browser observation failed / invalid_request / invalid_input`，**没有页面 Evidence ID**。外层 `ok: true` 不能把内层错误变成成功。这两份文件作为失败证据保留，不纳入成功页面调查。

### 本轮修复

先读取 6.4.0 的 `inspect-web-page --help` 与 `--schema`，确认该 CLI 使用 `endpoint` 与 `targetId` 两个位置参数。先前的 `9237` 已无法连接，因此按既定调查范围启动新的独立临时 Chrome，重新枚举并选择当前页面 ID。页面观测采用当前 origin 的默认范围，不需要错误的数组参数。成功命令形式如下：

```text
rea list-browser-targets http://127.0.0.1:9238 --format json
rea inspect-web-page http://127.0.0.1:9238 <targetId> --observation-ms 1000 --include-accessibility-text --format json
rea capture-web-screenshot http://127.0.0.1:9238 <targetId> --format json
```

实际通过带固定版本与任务缓存目录的 `npx ... rea-agents@6.4.0` 执行；未进行全局安装或 MCP 配置修复。沙箱访问需要升级时，仅为已授权的公开页面调查申请相应命令权限。

### 图片问题

旧 `structured-product-reference.png` 实为官网视频封面，不能用作产品 UI 证据。首次页面内 MacBook 元素截图又受滚动动画影响呈空白。已从官网链接确定 `/assets/phone-mockup.webp` 和 `/assets/macbook-mockup.webp`，在独立浏览器单独显示并截图；逐张查看后得到可读产品图。见 [素材来源记录](evidence/structured-image-source.json)。这些是普通浏览器截图，不伪造 REA Evidence ID。

## 6. 原始记录与素材对应

- REA 原始页面与截图：`evidence/*-rea-*-20261014.json`。
- 普通公开 DOM：`evidence/linear-public-dom-20261014.json`、`structured-public-dom-20261014.json`，包含 title、URL、脚本引用与图片来源。
- MyStudyLife／Shovel：`research-student-planners.md` 与 `assets/mystudylife-*`、`assets/shovel-*`。
- Linear 产品图：`assets/linear-product-reference.png`。
- Structured 产品图：`assets/structured-timeline-reference.png`、`assets/structured-web-reference.png`。
- REA 截图解码验证：Linear SHA-256 `07a522bf563d0f2be8a39ac91ebf0276e29e6a6864e0a11ed58fa3786b434d76`（113207 bytes）；Structured SHA-256 `f253e4eab05abc26d101e483fae7babf82f1d00299b1f64aabce9cf0b850f71f`（78001 bytes）。

## 7. 问题清单收尾

| 最初要回答的问题 | 状态 | 后续需要什么 |
|---|---|---|
| 能否找到可用的官方界面参考 | 已回答 | 已有四个产品的官方公开来源与可读图片 |
| 是否实际使用了 REA | 已回答 | 五个新的成功 Evidence，旧错误如实保留 |
| 能否说明公开网页技术信号 | 已回答，范围有限 | DOM／REA 元数据与 Linear 厂商说明；不外推完整产品 |
| 能否直接恢复闭源产品全部源码 | 未完成，现有材料不足 | 需要合法可用的实际代码／包及更明确分析范围；不从宣传页作承诺 |
| 是否测试了登录后真实产品行为 | 未完成，范围外 | 若以后需要，应另选授权账户与具体功能进行验证 |
| 是否能指导我们的前端改进 | 已给设计建议 | 用自己的 Demo 验证可用性和学习流程 |

