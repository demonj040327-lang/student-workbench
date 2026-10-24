# Third-party references and notices

## WhisperLiveKit local evaluation

The independent local speech service uses [WhisperLiveKit](https://github.com/QuentinFuxa/WhisperLiveKit), Apache-2.0, pinned at `eb92c115ee7abc1e161b0b2159da31785b0f5566` (version 0.2.26). Source, environment and downloaded model weights remain outside the distributed application in the ignored `.backups/` directory. The application has not copied its web UI or model implementation. Launch and evaluation scripts are project-specific. See the upstream [LICENSE](https://github.com/QuentinFuxa/WhisperLiveKit/blob/eb92c115ee7abc1e161b0b2159da31785b0f5566/LICENSE); dependencies and model weights retain their respective licenses.

The evaluation downloads the public JFK WAV from [whisper.cpp](https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav), pinned by SHA-256 in the fixture preparation script. Audio is not distributed with this repository. HCI and machine-learning test passages are synthesized locally with macOS voices and are not recordings of students or lecturers.
