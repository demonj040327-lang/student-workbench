#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
python_bin="$project_root/.backups/whisperlivekit-env/bin/python"
if [ ! -x "$python_bin" ]; then
  echo 'Local speech environment is missing. See docs/本地实时语音部署与测试.md.' >&2
  exit 1
fi
export HF_HOME="$project_root/.backups/speech-models"
export TORCH_HOME="$project_root/.backups/speech-models/torch"
exec "$python_bin" tools/run-local-speech.py serve --host 127.0.0.1 --port "${SPEECH_PORT:-8000}" --backend mlx-whisper --model "${SPEECH_MODEL:-small.en}" --language en --model_cache_dir "$project_root/.backups/speech-models/whisper" --pcm-input --log-level INFO "$@"
