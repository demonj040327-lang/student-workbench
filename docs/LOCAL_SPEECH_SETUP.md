# Local speech setup

The optional local recognition service powers English live transcription inside Workbench. This installation recipe targets Apple Silicon macOS and uses WhisperLiveKit with a Whisper backend. Other platforms need a separately validated deployment.

## Install

Prepare `uv`, Python 3.12 and FFmpeg. From the project root:

```sh
tools/install-local-speech.sh
```

The script checks platform prerequisites, checks out the pinned upstream source and creates an isolated Python environment under `.backups/`. It does not replace the application's Node dependencies. Source, model weights and the environment are ignored by Git. Downloads require network access and disk space; first-time model loading can take time.

## Start with the application

```sh
npm run dev:classroom
```

This command reuses a ready speech service on port 8000 or starts one, then launches Workbench on port 5175. Open `http://localhost:5175/` and use **Class recording** in the student workspace. The browser-facing interface belongs to Workbench; the separate upstream page at port 8000 is not the course workspace.

Alternatively, use two terminals:

```sh
tools/start-local-speech.sh
```

```sh
npm run dev -- --port 5175 --strictPort
```

The default is the English `small.en` model. `SPEECH_MODEL=base.en tools/start-local-speech.sh` selects the smaller English model. The application proxy expects port 8000; a standalone `SPEECH_PORT` override does not automatically reconfigure the application.

## Use and troubleshoot

1. Wait until `http://127.0.0.1:8000/health` reports the service ready.
2. In Workbench, open a course, click **Class recording**, choose a microphone or supported shared-tab audio and allow capture.
3. Enable live recognition. Translation and explanation require the student's separately configured model API; local recognition does not itself supply translation.
4. If startup reports a missing environment, run the installation script. If port 8000 is occupied by another process, stop that process or reuse an already-ready compatible service.
5. If no audio is captured, verify the selected tab's audio-sharing checkbox or microphone permission. Where system audio is unsupported, play the recording in a browser tab. Audio-only recording can be used without live recognition.

The service binds to the local loopback interface. Do not assume a phone or another machine can reach it. The supplied configuration recognises English; it is not a Chinese speech model. Long-lecture reliability and mobile background capture are not established production capabilities.

[Recording instructions](课堂录音与翻译使用说明.md) · [User guide](USER_GUIDE.md) · [Third-party notices](../THIRD_PARTY_NOTICES.md)
