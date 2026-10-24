export type ClassroomCapture = { stop: () => Promise<void>; abort: () => void };
export type CaptureCallbacks = {
  onText: (confirmed: string, interim: string) => void;
  onChunk: (blob: Blob) => void;
  onWarning: (message: string) => void;
  onDeviceEnded: () => void;
};
export async function beginClassroomCapture(
  transcribe: boolean,
  callbacks: CaptureCallbacks,
): Promise<{ capture: ClassroomCapture; mimeType: string }> {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  )
    throw Error(
      '此浏览器无法录音，请通过 HTTPS 或 localhost 使用支持录音的浏览器。',
    );
  let stream: MediaStream | undefined,
    recorder: MediaRecorder | undefined,
    socket: WebSocket | undefined,
    context: AudioContext | undefined,
    node: AudioWorkletNode | undefined;
  let closing = false,
    ready = false,
    finished = false;
  let resolveDrain: () => void = () => {};
  const drain = new Promise<void>((r) => {
    resolveDrain = r;
  });
  const release = () => {
    closing = true;
    node?.disconnect();
    void context?.close().catch(() => {});
    socket?.close();
    stream?.getTracks().forEach((t) => t.stop());
  };
  try {
    if (transcribe) {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/classroom/asr?language=en&context=university%20lecture`,
      );
      const ws = socket;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              Error(
                '实时转写服务未连接。请启动 tools/start-local-speech.sh，或选择仅录音。',
              ),
            ),
          10000,
        );
        const rejectConnection = () => {
          clearTimeout(timer);
          reject(
            Error(
              '实时转写服务未连接。请启动 tools/start-local-speech.sh，或选择仅录音。',
            ),
          );
        };
        ws.onerror = rejectConnection;
        ws.onclose = () => {
          if (!ready) rejectConnection();
          else if (!closing && !finished)
            callbacks.onWarning(
              '转写连接已断开，音频仍在录制。停止后可保留录音和已有文字。',
            );
          resolveDrain();
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'config') {
              clearTimeout(timer);
              if (!message.useAudioWorklet) {
                reject(Error('语音服务需使用 --pcm-input 启动。'));
                return;
              }
              ready = true;
              resolve();
            } else if (message.type === 'ready_to_stop') {
              finished = true;
              resolveDrain();
            } else if (message.error || message.status === 'error') {
              callbacks.onWarning('转写服务发生错误，音频仍在录制。');
              resolveDrain();
            } else if (Array.isArray(message.lines))
              callbacks.onText(
                message.lines
                  .map((l: { text?: string }) => l.text || '')
                  .filter(Boolean)
                  .join(' ')
                  .trim(),
                message.buffer_transcription || '',
              );
          } catch {
            callbacks.onWarning('无法读取转写结果，音频仍在录制。');
          }
        };
      });
    }
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    stream.getAudioTracks().forEach((track) =>
      track.addEventListener('ended', () => {
        if (!closing) callbacks.onDeviceEnded();
      }),
    );
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ].find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 64000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) callbacks.onChunk(e.data);
    };
    recorder.onerror = () => {
      callbacks.onWarning('录音设备发生错误，正在保留已收到的音频。');
      callbacks.onDeviceEnded();
    };
    if (transcribe) {
      context = new AudioContext({ sampleRate: 16000 });
      await context.audioWorklet.addModule('/classroom-pcm-worklet.js');
      await context.resume();
      node = new AudioWorkletNode(context, 'classroom-pcm');
      node.port.onmessage = (e) => {
        if (
          e.data instanceof ArrayBuffer &&
          socket?.readyState === WebSocket.OPEN
        ) {
          if (socket.bufferedAmount > 2_000_000) {
            callbacks.onWarning(
              '转写处理积压，已暂停发送音频；完整录音仍会保存。',
            );
            socket.close();
          } else socket.send(e.data);
        }
      };
      const mute = context.createGain();
      mute.gain.value = 0;
      context.createMediaStreamSource(stream).connect(node);
      node.connect(mute).connect(context.destination);
    }
    recorder.start(2000);
    const capture: ClassroomCapture = {
      abort: () => {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        release();
      },
      stop: async () => {
        if (closing) return;
        closing = true;
        if (node) {
          const n = node;
          await new Promise<void>((resolve) => {
            const done = () => {
              n.port.removeEventListener('message', listener);
              resolve();
            };
            const listener = (e: MessageEvent) => {
              if (e.data?.flushed) done();
            };
            n.port.addEventListener('message', listener);
            n.port.postMessage('flush');
            setTimeout(done, 500);
          });
        }
        if (recorder && recorder.state !== 'inactive') {
          const r = recorder;
          await new Promise<void>((resolve) => {
            r.addEventListener('stop', () => resolve(), { once: true });
            r.stop();
          });
        }
        node?.disconnect();
        await context?.close().catch(() => {});
        stream?.getTracks().forEach((t) => t.stop());
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(new ArrayBuffer(0));
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([
            drain,
            new Promise<void>((resolve) => {
              timer = setTimeout(() => {
                callbacks.onWarning(
                  '转写尾部处理尚未确认，已保留收到的文字和录音。',
                );
                resolve();
              }, 20000);
            }),
          ]);
          clearTimeout(timer);
        }
        release();
      },
    };
    return { capture, mimeType: recorder.mimeType || mimeType || 'audio/webm' };
  } catch (error) {
    release();
    if (error instanceof DOMException && error.name === 'NotAllowedError')
      throw Error('麦克风权限未获允许，请在浏览器设置中开启后重试。');
    throw error;
  }
}
