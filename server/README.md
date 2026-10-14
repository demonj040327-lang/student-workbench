# 本地课件学习接口

本接口随 Vite 开发服务器和预览服务器运行，只接受本机同源请求。`npm run dev` 启动后，浏览器无需访问另一端口。

## 当前能力

- 原有课件或新上传 PDF / PPTX / DOCX / UTF-8 TXT / Markdown 实际解析文字。
- PDF 用阅读器页序；PPTX 沿实际播放顺序解析，因此重排后的幻灯片引用仍与 PowerPoint 中的页序一致；Word、文本按文字长度分节，不能当作排版页码。
- 本地模式按页序分成最多 5 节，包含来源摘句、阅读动作和原文定位自检。不会把这种规则处理称为 AI 讲解。
- 问答检索严格限定当前文件，支持英文词项、中文双字词项及课程术语双语别名，包含神经网络、隐藏层、学习率、梯度下降、透视投影和观察法等。中文问题可匹配这些术语在英文课件中的原文；未命中明确说明无法确定，不为翻译词项额外调用模型。
- 图片、扫描件和图片公式未做 OCR。没有可读文字时返回明确提示，不生成假知识点。
- ELM 可根据明确授权的文字片段生成中文学习导读、四选一题与来源页，以及对当前文件做概念讲解。返回 JSON 后在服务端检查页码、选项、答案索引和分节覆盖；格式校验不能证明事实正确。

## 请求

`GET /api/study/status`

```json
{"localParsing":true,"aiConfigured":false,"provider":"ELM","model":"由学校提供并在服务端指定的模型名"}
```

`POST /api/study/parse`

```json
{"courseId":"hci","name":"lecture.pdf","materialId":"hci-lecture","url":"/course-materials/hci-week-2.pdf"}
```

上传文件用 `contentBase64` 替代 `url`，`mimeType` 可以传入但判断格式以受支持的文件扩展名和实际解析结果为准。最大原始文件 25 MB；内置较大的原 PPTX 走受控本地 URL。

上述接口默认本地解析。只有显式增加 `"mode":"ai","allowExternal":true` 才会请求模型生成学习计划。

`POST /api/study/ask`

```json
{"document":{"id":"解析响应中的标识","courseId":"hci","name":"lecture.pdf","pages":[]},"question":"什么是半结构化访谈？","mode":"local"}
```

实际传回完整的 `StudyDocument`，或当前服务端缓存中仍存在的文档标识和课程标识。ELM 问答需 `mode: "ai"` 和 `allowExternal: true`；只发送当前文件最多四个检索片段。没有来源命中时不调用模型。

响应含 `mode`、`answer`、`sources: [{page,title,excerpt}]` 和 `grounded`。`grounded: true` 表示有当前文件来源并通过引用格式检查，不能视为自动事实核查。

## ELM 配置

在服务端 `.env.local` 或环境变量中提供（密钥绝不能加 `VITE_` 前缀）：

```dotenv
ELM_BASE_URL=https://学校提供的接口地址/api/v1
ELM_MODEL=学校提供的模型名称
ELM_API_KEY=仅由本人填入的凭据
ELM_API_STYLE=chat
```

如果用户已有 LiteLLM `proxy-config.yaml`，可使用 `ELM_CREDENTIAL_CONFIG=/absolute/path/to/proxy-config.yaml`、`ELM_CONFIG_PYTHON_BIN=/path/to/python-with-pyyaml`，并指定 `ELM_MODEL`。仅从用户指定的文件读取该模型的 `api_key` / `api_base`，密钥只进入服务端内存，不复制到前端或新的配置文件。若同时指定 `ELM_BASE_URL`，它必须与现有配置中的接口完全匹配，避免向错误端点发送凭据。直接提供 `ELM_API_KEY` 优先。

默认采用 OpenAI 兼容 `chat/completions` 和 Bearer 认证。只有服务提供方明确要求时设置 `ELM_API_KEY_HEADER`；不猜测学校专有认证。ELM JSON 输出由本地验证，不假定网关支持 OpenAI 的 strict schema。当前学校 Qwen 网关已实际验证 JSON object 模式，可设置 `ELM_JSON_MODE=json_object` 约束计划输出；其他网关需先验证兼容性。当前选定的学校 Qwen 模型已实测支持 `chat_template_kwargs.enable_thinking=false`；本机设置 `ELM_ENABLE_THINKING=false` 用于限制交互等待，其他模型不自动套用此参数。问答输出上限默认 2200 tokens、计划 7000 tokens，可用 `STUDY_ANSWER_MAX_TOKENS` 与 `STUDY_PLAN_MAX_TOKENS` 调整。问答等待默认 60 秒，计划默认 120 秒；可用 `STUDY_ANSWER_TIMEOUT_MS` / `STUDY_PLAN_TIMEOUT_MS` 调整，最长 180 秒。失败时界面保留已有路线，便于稍后重试。参数依据见 [Qwen 官方模型卡](https://huggingface.co/Qwen/Qwen3.5-397B-A17B)。

也支持 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 与 `API_STYLE=responses|chat` 作为另一种明确配置；没有配置时仍可使用本地功能。

Python 解析器默认使用此电脑的 Codex bundled Python；迁移机器时设置 `STUDY_PYTHON_BIN` 并安装 `pypdf`。读取 YAML 的 Python 还需 `PyYAML`。启动服务不自动发送课件；只有用户明确点击 ELM 操作才调用模型。

## 运行边界与实现

- `parseDocument(payload, {projectRoot, env})` / `askDocument(payload, {env})` 可直接从 `study-api.mjs` 导入测试。
- 固定内置课件白名单绑定四门课程；不能传任意文件路径、远程 URL 或越级路径。
- 临时上传文件只保存在系统临时目录，解析成功或失败都会清理。Python 子进程限时，文字长度、页数、XML 单页大小和请求体均有上限。
- 接口不把密钥、供应商错误全文或本地路径返回到客户端；阻止非本机、跨站 Origin 和非 JSON POST。
- 目前文档缓存仅存服务端内存，最多 40 份；客户端传回已保存的文档页作为刷新后备。正式多用户版本仍需账户、数据库隔离、存储管理及授权。
- 一般浏览器 IndexedDB / localStorage 是此电脑中的数据，不代表已建立多人共享或永久云端数据。

实现参考：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[Text generation](https://developers.openai.com/api/docs/guides/text)。官方结构化输出约束格式；引用内容仍需评估与核对。

## 验证

`node --test server/study-api.test.mjs` 验证真实 PDF / PPTX 提取、完整页序覆盖、新 TXT / DOCX、空白 PDF 的 OCR 提示、当前文件检索、越级路径和课程混用拦截、同源请求、ELM 授权门槛及模型输出引用校验。模型部分使用本地 mock；此测试不会发送原课件至外部服务。
