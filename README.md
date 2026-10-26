# Workbench

A course-based learning workspace for university students and teachers. Teachers review and publish learning materials; students connect those resources with weekly study, coursework plans, source-grounded questions and human help.

[Demo video](https://github.com/demonj040327-lang/student-workbench/releases/tag/teachathon-2026-demo) · [User guide](docs/USER_GUIDE.md) · [中文使用说明](docs/学生教师双视角说明.md)

The video is a public GitHub Release attachment. [Download the MP4](https://github.com/demonj040327-lang/student-workbench/releases/download/teachathon-2026-demo/demo_video.mp4); no university account is needed. Open it in a video player if the browser does not play it directly.

## What you can do

- **Teacher workspace:** manage courses and weekly materials; generate guidance and questions separately; review, edit, preview, publish and withdraw resources; upload coursework briefs and confirm extracted dates.
- **Student workspace:** view semester and coursework progress, add personal plans, organise weekly tasks, read original documents, keep notes, complete practice and ask questions using a personal model connection.
- **Class recording:** record a microphone or supported shared-tab audio, edit live transcripts, translate text and generate explanations from corrected text.
- **Human support:** find study partners by course, language and availability; exchange invitations and messages; ask teachers questions in course discussions.
- **Language and layout:** English and Chinese interfaces with responsive desktop and mobile layouts.

## Run locally

Use Node.js 22.12 or newer and Python 3 with `pypdf`. The local course database uses Node’s SQLite support.

```sh
git clone https://github.com/demonj040327-lang/student-workbench.git
cd student-workbench
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install pypdf PyYAML
```

Create `.env.local` from `.env.example`. Set `STUDY_PYTHON_BIN` to the absolute path of `.venv/bin/python` in your checkout. Teacher AI generation also needs a valid ELM configuration; see [API setup](server/README.md). Keep keys local and never use a `VITE_` prefix for them.

```sh
npm run dev -- --port 5175 --strictPort
```

Open [Workbench](http://localhost:5175/), choose a role and select English or Chinese. For sample data, use the [student demo](http://localhost:5175/?demo=1&role=student) or [teacher demo](http://localhost:5175/?demo=1&role=teacher). These addresses work after starting the local server; they are not hosted application URLs.

In a new workspace, create a course in the teacher view, upload a document and publish it before switching to the student view. Demo and personal workspaces store separate records.

## Set up optional features

- **Personal AI:** students choose ELM or DeepSeek in **My AI API**, then enter their own key and an account-supported model. Keys stay in page memory and clear on refresh. Reading, published practice and local source search remain available without a personal model connection.
- **Speech:** follow [Local speech setup](docs/LOCAL_SPEECH_SETUP.md). The supplied installation recipe targets Apple Silicon macOS. Once installed, `npm run dev:classroom` starts the application and local recognition service. See [recording instructions](docs/课堂录音与翻译使用说明.md).
- **Course materials:** PDF, PPTX, DOCX, TXT and Markdown uploads are supported, with a 25 MB ordinary-upload limit. The private curated course corpus is not distributed with the repository. You can upload your own authorised materials.

## Build and verify

```sh
npm run build
STUDY_PYTHON_BIN="$(pwd)/.venv/bin/python" node --test server/*.test.mjs
npm run preview -- --port 5175 --strictPort
```

Use the Vite development or preview server for the local API. Hosting only the generated `dist/` files does not supply model, document, course-database or peer-learning endpoints. Automated model tests use controlled responses and do not establish educational effectiveness.

## Storage and current scope

Course resources, drafts and personal progress use browser storage; local course and peer services also retain records on this machine. API keys are not included in saved drafts. Use a consistent origin such as `localhost:5175`; `127.0.0.1:5175` has separate browser storage.

This is a local working prototype. Role selection is not institutional authentication; enrolment permissions, reliable multi-device course synchronisation and production deployment are not established. Mobile layout support does not imply a native app release. Recognition, translation, generated explanations and practice questions require checking against their sources. Recording and external model processing require appropriate permission.

[Third-party notices](THIRD_PARTY_NOTICES.md)
