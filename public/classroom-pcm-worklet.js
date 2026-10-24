// One continuous stream; transport packets do not divide the user's recording.
class ClassroomPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(1600);
    this.count = 0;
    this.sum = 0;
    this.weight = 0;
    this.phase = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'flush') {
        this.flush();
        this.port.postMessage({ flushed: true });
      }
    };
  }
  flush() {
    if (this.count) {
      const data = this.samples.slice(0, this.count);
      this.port.postMessage(data.buffer, [data.buffer]);
      this.count = 0;
    }
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input)
      for (const sample of input) {
        this.sum += sample;
        this.weight++;
        this.phase += 16000;
        if (this.phase >= sampleRate) {
          this.phase -= sampleRate;
          const value = Math.max(-1, Math.min(1, this.sum / this.weight));
          this.samples[this.count++] =
            value < 0 ? value * 32768 : value * 32767;
          this.sum = 0;
          this.weight = 0;
          if (this.count === this.samples.length) this.flush();
        }
      }
    return true;
  }
}
registerProcessor('classroom-pcm', ClassroomPCM);
