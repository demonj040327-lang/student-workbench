#!/bin/sh
# Apple Silicon local evaluation only. Does not change the app's Node dependencies.
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
revision=eb92c115ee7abc1e161b0b2159da31785b0f5566
source_dir=.backups/open-source-review/WhisperLiveKit
command -v uv >/dev/null || { echo 'Install uv before running this script.' >&2; exit 1; }
[ "$(uname -m)" = arm64 ] && [ "$(uname -s)" = Darwin ] || { echo 'This recipe targets Apple Silicon macOS.' >&2; exit 1; }
if [ ! -d "$source_dir/.git" ]; then
  git clone --no-checkout https://github.com/QuentinFuxa/WhisperLiveKit.git "$source_dir"
  git -C "$source_dir" checkout --detach "$revision"
fi
[ "$(git -C "$source_dir" rev-parse HEAD)" = "$revision" ] || { echo 'Existing review checkout differs from the tested revision; preserved without resetting.' >&2; exit 1; }
if [ ! -x .backups/whisperlivekit-env/bin/python ]; then
  uv venv --python 3.12 .backups/whisperlivekit-env
fi
uv pip install --python .backups/whisperlivekit-env/bin/python -e "$source_dir[mlx-whisper]" truststore
command -v ffmpeg >/dev/null || { echo 'Install FFmpeg (brew install ffmpeg) before using encoded audio.' >&2; exit 1; }
mkdir -p .backups/speech-evaluation
uv pip freeze --python .backups/whisperlivekit-env/bin/python > .backups/speech-evaluation/environment.txt
printf '%s\n' 'Ready. Start with: tools/start-local-speech.sh'
