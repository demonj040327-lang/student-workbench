# 学生规划产品前端参考：MyStudyLife 与 Shovel

观察日期：2026-10-13（Europe/London）。范围：两个公开官方营销页面及页面里展示的产品图片。使用 Chrome 读取公开 DOM 与截图；没有登录、注册、提交表单、购买、访问私有源码或实际操作产品账户。

**证据边界：下面所有产品截图均来自官方宣传页面中的界面图片或示意图，不是登录后实际观察。截图可以支持布局判断，不能证明交互的实际行为、性能、算法或产品技术栈。** 页面首页截图保留营销背景；产品图从页面实际图片元素裁切，未重绘。

## 1. MyStudyLife

官方页面：[App Tour](https://mystudylife.com/tour/)。公开入口指向 `web.mystudylife.com`，本次未登录该应用。

### 直接观察到的布局

- **课程身份稳定**：课程表图采用列表，每行以左侧细色条识别课程；课程名居上，学科和上课时间居下，周内日期靠右。顶部区分 Classes/Holidays、Active/Past，底部是明确的新增课程按钮。
- **本周是主要时间单位**：周历以星期分列，彩色课程块只保留短标题和时间；课程对应颜色跨列表、周历、待办保持一致。
- **任务可以未完成但有进展**：任务图上方有学科筛选，内容按 Today、Tomorrow、Later This Week 分组。任务行含选择圆圈、标题和课程信息，有 40%、20% 的局部进度示例。宣传说明明确强调部分完成。
- **AI 输出仍是可操作的课程对象**：Scout 宣传图是聊天界面，但回复中的待办是带课程颜色的独立卡片；动作结果用 “Added to your planner” 状态标注，下方保留快捷问题与输入框。没有看到它评定知识掌握。
- **视觉层级**：产品宣传图以白色/极浅蓝底、深蓝灰文字、亮蓝主操作为主；课程用多种柔和颜色。圆角、分组标题、分隔线承担信息结构，装饰集中在设备外框及营销说明气泡。

### 截图与适用范围

| 文件 | 图中可见内容 | 观察边界 |
|---|---|---|
| [mystudylife-official-page.png](assets/mystudylife-official-page.png) | 官方首屏、大标题、跨设备 Hero | 营销页面实际截图；Hero 为官方产品宣传图 |
| [mystudylife-product-hero.png](assets/mystudylife-product-hero.png) | 桌面 Schedule 与手机 Scout 的组合 | 官方产品宣传中的设备组合图，非实际登录观察 |
| [mystudylife-product-timetable.png](assets/mystudylife-product-timetable.png) | Schedule 课程列表、筛选、新增按钮 | 官方宣传中的手机界面截图，非实际登录观察；说明气泡为宣传标注 |
| [mystudylife-product-calendar.png](assets/mystudylife-product-calendar.png) | This week 周历、同步来源列表 | 官方宣传中的产品界面示意图，非实际登录观察；未验证同步 |
| [mystudylife-product-tasks.png](assets/mystudylife-product-tasks.png) | 按日期分组的任务、局部进度 | 官方宣传中的手机界面截图，非实际登录观察；未测试任务编辑 |
| [mystudylife-product-scout.png](assets/mystudylife-product-scout.png) | 对话内任务卡片、快捷问题、动作状态 | 官方宣传中的聊天 Mockup，非实际登录观察；未验证 AI 能力 |

上述产品图片的原始官方 URL 路径均位于 `https://mystudylife.com/wp-content/uploads/2026/08/`，对应文件名分别为 `MSL_Hero_Mockup_HD-scaled.png.webp`、`Timetable-classes-screenshot.png.webp`、`Calendar-sync-screenshot.png.webp`、`Homework-tasks-sceenshot.png.webp`、`MSL_Scout_Chat_Mockup_HD-scaled.png.webp`。

### 可确认的网页技术信号

公开 DOM 引用了 `wp-includes/js/jquery/jquery.min.js?ver=3.7.1`，并出现 `wp-content/themes/mystudylife/`、`wp-content/plugins/elementor/` 与 `elementor-pro/` 资源路径。`meta[name=generator]` 声明 Elementor；body 含 `wp-theme-mystudylife` 与 `elementor-page` 类。脚本标签还引用 Bootstrap、Flickity、Slick Carousel 路径。这些是**营销站的页面声明与资源引用**，没有核验每个库是否参与某项实际交互。

未知：产品应用的 React/Vue/Angular 等框架、组件库、状态管理、API、数据库、离线机制与真实响应速度。本次未发现这些证据，不从营销站 WordPress/Elementor 信号推导产品应用架构。

## 2. Shovel

官方页面：[Shovel 首页](https://shovelapp.io/)。公开登录入口指向 `dig.shovelapp.io`，本次未登录该应用。

### 直接观察到的布局

- **三栏工作台**：时间安排宣传图采用左侧 Events、中间周历、右侧 Tasks。课程/活动和任务沿用颜色，中间为星期列与小时轴，空闲时段以描边块突出。
- **任务与时间放在同一个空间中**：图片用箭头、手形和 “Read Chapter 3 / 45m” 卡片表达把任务安排进空闲时间的意图。此图有明显的宣传绘制元素，不能证明本次实际完成过拖拽。
- **时间约束可见**：Start Dates/Estimates 图片展示横向任务条与日期轴，任务旁出现 Cushion 标签。另一张 Cushion GIF 的截帧以零线区分绿色上方与红色下方，并展示关联任务提示卡，表达余量与风险。
- **视觉层级**：白底、灰网格与深色标签承担工作台结构；紫色主要用于导航/控件，课程或任务分色；绿色和红色用于余量/风险。首页品牌图插画较多，工作台本身更像紧凑规划工具。
- **操作叙事**：官方页面从上传 syllabus/同步教学平台，进入安排工作时间、查看剩余时间及任务估时。可确认的是页面如何讲述这条流程，未验证导入解析、学校平台同步或 Cushion 计算。

### 截图与适用范围

| 文件 | 图中可见内容 | 观察边界 |
|---|---|---|
| [shovel-official-page.png](assets/shovel-official-page.png) | 官网首屏、CTA、手机和周历插画 | 营销页面实际截图；内含官方产品宣传插画 |
| [shovel-product-timeblocking.png](assets/shovel-product-timeblocking.png) | Events／周历／Tasks、45m 卡片、箭头 | 官方宣传中的产品界面示意图，非实际登录观察；未测试拖拽 |
| [shovel-product-tasks.png](assets/shovel-product-tasks.png) | 日期轴、横向任务条、余量标签 | 官方宣传中的产品界面截图，非实际登录观察；源图较小，微小文字未据此推断 |
| [shovel-product-cushion.png](assets/shovel-product-cushion.png) | 余量曲线、零线、红绿风险区、任务提示 | 官方宣传 GIF 的一个截帧，非实际登录观察；不代表完整动画或计算行为 |

原始官方图片：[时间安排示意](https://shovelapp.io/wp-content/uploads/2025/10/Shovel-Study-Planner-Build-your-schedule-and-plan-tasks-into-free-study-times.png.webp)、[任务开始时间与估时](https://shovelapp.io/wp-content/uploads/2024/06/Task-Start-Dates-and-Estimates.jpg.webp)、[Cushion 宣传 GIF](https://shovelapp.io/wp-content/uploads/2024/08/Get-Stress-Free-As-Thanks-to-the-Cushion-Technology.gif)。

### 可确认的网页技术信号

公开 DOM 有 `wp-includes/` 与 `wp-content/` 路径；body 包含 `wp-theme-Divi`、`wp-child-theme-shovel-2021`、`et_divi_theme`、`et_pb_pagebuilder_layout`。脚本标签引用 `wp-content/themes/Divi/js/scripts.min.js`、jQuery、`wp-simple-pay-pro-3` 与 `https://js.stripe.com/v3/`。这支持“公开营销页带有 WordPress/Divi 和支付资源信号”，不能推出产品应用使用 Divi，亦未检查支付实现或安全性。

未知：`dig.shovelapp.io` 的产品应用框架、任务安排算法、Cushion 公式、同步后端、组件库和真实拖拽交互。本次没有读取登录后页面或付费源码。

## 3. 对 CourseQuest 的设计启发（建议，不是已验证效果）

1. **用课程颜色和稳定位置防止混淆。** 左栏保留学科→课程→周次；同门课程的材料、课堂疑问与关卡采用一致标识。课程名称必须持续可见，不能仅依赖颜色。
2. **首页回答“今天能继续哪一步”。** 显示最近学习位置、本周剩余短任务、预计用时与继续按钮。日历可以是可选视图，不应让学生先填写大量计划才能学习。
3. **将关卡放进现实时间。** 让学生知道下一关约 5–8 分钟，可安排到课后空闲段；借鉴 Shovel 的时间可见性，但不要在缺少估时数据时伪造精确的剩余余量。
4. **课程问答中的结果回到课程对象。** 回答附课件出处，并提供“存为疑问”“稍后练习”；像 Scout 的对象卡片一样，体现操作结果。生成关卡需要真实成功状态，不能只显示一句“已加入”。
5. **完成进度与掌握程度分开。** 借鉴 MSL 部分完成，使暂停自然；CourseQuest 还要分别显示关卡完成数、待复习知识、是否经过独立检验。规划工具的百分比不构成掌握证据。
6. **装饰不压过学习内容。** 任务主区保持白底、清楚标题和少量强调色；情境故事用于说明当前目标，跨课程常驻工作台承担导航。此处是视觉与产品建议，未对学习兴趣或学习成绩作效果承诺。

## 4. 证据状态

| 问题 | 状态 | 依据／剩余限制 |
|---|---|---|
| 官方页面是否可访问 | 已回答 | 实际访问与两个首页截图 |
| 产品图片里的布局、颜色、层级 | 已回答，限宣传图 | 已打开并逐张检查所列裁切图 |
| 实际登录后操作与交互 | 未回答 | 未登录、未执行产品任务 |
| 营销网页技术信号 | 已回答，限 DOM 引用 | 页面声明、资源路径及 body 类 |
| 产品应用技术栈 | 未回答 | 营销站与产品应用域名分离，不能外推 |
| 对本项目的启发 | 设计推论 | 尚需原型可用性与学习效果验证 |

本子任务未独立安装或诊断 REA；截图与公开 DOM 是本报告的本地证据，不冒充 REA 工具返回的 Evidence IDs。若主调查另有 REA 捕获，可在总报告中补充对应关系。
