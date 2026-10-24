# Third-party references and notices

## Campus Skill Exchange

Source: https://github.com/Subankar-Dey/campus-skill-exchange
Reviewed commit: `0653636cb60574a574381f9b663bcbe4bfdc4bcd`

The peer-learning feature adapts the complementary teach/learn matching idea and invitation lifecycle. The UI, course-topic model, server storage, compatibility checks, participant authorization, state machine and messaging in this repository were implemented for Student Workbench. The upstream Express/MongoDB authentication, administrative interface and reputation system were not imported. This acknowledgment does not represent an upstream security audit or endorsement.

Upstream MIT notice retained below:

```text
MIT License

Copyright (c) 2026 SUBANKAR DEY

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Other reviewed projects

- OpenMAIC: https://github.com/THU-MAIC/OpenMAIC — architecture reference only; no code, generated classroom or asset imported in this change.
- DeepTutor: https://github.com/HKUDS/DeepTutor — comparative research only; no source, model or asset imported in this change.

Existing npm dependencies retain their own licenses in their distributions. This document records the scope of this peer-learning change, rather than claiming to be an exhaustive inventory of every dependency.

## WhisperLiveKit local evaluation

The independent local speech service uses [WhisperLiveKit](https://github.com/QuentinFuxa/WhisperLiveKit), Apache-2.0, pinned at `eb92c115ee7abc1e161b0b2159da31785b0f5566` (version 0.2.26). Source, environment and downloaded model weights remain outside the distributed application in the ignored `.backups/` directory. The application has not copied its web UI or model implementation. Launch and evaluation scripts are project-specific. The student classroom panel is implemented separately and consumes the local WebSocket protocol. See the upstream [LICENSE](https://github.com/QuentinFuxa/WhisperLiveKit/blob/eb92c115ee7abc1e161b0b2159da31785b0f5566/LICENSE); dependencies and model weights retain their respective licenses.

The evaluation downloads the public JFK WAV from [whisper.cpp](https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav), pinned by SHA-256 in the fixture preparation script. Audio is not distributed with this repository. HCI and machine-learning test passages are synthesized locally with macOS voices and are not recordings of students or lecturers.

## WebM recording duration

The classroom recording player uses `@fix-webm-duration/fix` 1.0.1 and its parser, by Yuri Sitnikov, under the MIT license: [source and license](https://github.com/yusitnikov/fix-webm-duration). It adds duration metadata to browser-generated WebM recordings for playback and seeking. It is loaded when preparing audio playback, not used for speech recognition or external uploads.
