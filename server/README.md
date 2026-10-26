# Local API configuration

The local API runs with Vite development and preview. Start the application from the repository root; a separate production API deployment is not supplied by a static `dist/` upload.

## Python document parsing

Create a Python environment with `pypdf`; `PyYAML` is also needed if reading a YAML credential configuration. Set `STUDY_PYTHON_BIN` in `.env.local` to the absolute path of that environment's interpreter. PDF references use extracted pages, PPTX references follow slide order, and DOCX text sections are not printed page numbers. Ordinary uploads are limited to 25 MB. Scans and image-only equations do not receive automatic OCR.

## Teacher ELM

Copy `.env.example` to `.env.local`, then provide the endpoint and model assigned to your account:

```dotenv
ELM_BASE_URL=https://your-approved-endpoint/api/v1
ELM_MODEL=your-account-supported-model
ELM_API_KEY=your-local-key
ELM_API_STYLE=chat
STUDY_PYTHON_BIN=/absolute/path/to/your/python
```

Keep `.env.local` private. Do not prefix keys with `VITE_`, paste credentials into source files or commit them. Restart the application after changing server configuration.

Instead of copying an existing credential, `ELM_CREDENTIAL_CONFIG` can refer to your local LiteLLM YAML configuration, with `ELM_CONFIG_PYTHON_BIN` pointing to an interpreter that has PyYAML. `ELM_MODEL` selects the entry. If an explicit base URL is also supplied, it must match that entry. An explicit `ELM_API_KEY` takes priority.

Only enable `ELM_JSON_MODE=json_object`, `ELM_ENABLE_THINKING=false` or a custom `ELM_API_KEY_HEADER` if your provider supports the option. The default chat interface uses Bearer authentication. The frontend also offers independent teacher credentials for the current session.

## Student personal API

Students choose ELM or DeepSeek in **My AI API** and enter their own key and supported model. DeepSeek requests are sent to the fixed DeepSeek endpoint. Credentials remain in page/request memory, clear on refresh and do not fall back to the teaching credentials. Source excerpts, questions or edited transcript text are sent for the requested operation; audio goes to the configured local speech service rather than the text-model provider.

## Request limits and recovery

Use server-side settings in `.env.local` when the selected model permits larger output or longer requests:

| Setting | Purpose |
|---|---|
| `STUDY_ANSWER_MAX_TOKENS` | Answer output limit |
| `STUDY_PLAN_MAX_TOKENS` | Learning-guide output limit |
| `STUDY_COURSEWORK_MAX_TOKENS` | Coursework-step limit, preferred over the general plan limit |
| `STUDY_ANSWER_TIMEOUT_MS` | Answer wait time |
| `STUDY_PLAN_TIMEOUT_MS` | Guide wait time |
| `STUDY_COURSEWORK_TIMEOUT_MS` | Coursework wait time |
| `STUDY_TRANSLATION_MAX_TOKENS` | Transcript-translation output limit |
| `STUDY_LECTURE_MAX_TOKENS` | Transcript-explanation output limit |

Incomplete or invalid model output is rejected. Keep the source, adjust scope or supported limits, restart when configuration changes, and retry. Structural validation does not verify subject accuracy. Teacher drafts use local browser storage; page-level generation jobs do not survive closing or refreshing the page.

## Storage and deployment

Reading, drafts and personal activity use browser storage. Local course data uses SQLite and peer records use local server files. These stores do not establish institutional accounts, course permissions or production multi-user isolation. Browser data belongs to the current origin. Do not expose the local prototype as a production service without access control, secure transport and managed storage.

## Verification

```sh
STUDY_PYTHON_BIN=/absolute/path/to/your/python node --test server/*.test.mjs
```

Model tests use controlled responses and do not spend model API credit. They check implementation behaviour, not actual teaching quality. See the [user guide](../docs/USER_GUIDE.md) for application operations and [speech setup](../docs/LOCAL_SPEECH_SETUP.md) for optional recognition.
