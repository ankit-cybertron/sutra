// AudioWorklet: mic -> 16 kHz mono signed-16-bit PCM, emitted as EXACTLY 1024-byte frames
// (512 samples = 32 ms), which is what Gnani's realtime STT requires.
// Also posts the RMS level of the current render quantum so the UI can run a simple VAD.
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // input samples per output sample (1 if the context is already 16 kHz)
    this.pos = 0;
    this.acc = 0;
    this.cnt = 0;
    this.out = new Int16Array(512);
    this.n = 0;
    this.rmsSum = 0;
    this.rmsCnt = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      this.rmsSum += x * x;
      this.rmsCnt++;

      // Box-filter downsample: average the input samples that fall in each output sample.
      this.acc += x;
      this.cnt++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = this.acc / this.cnt;
        this.acc = 0;
        this.cnt = 0;
        const s = Math.max(-1, Math.min(1, v));
        this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.n === 512) {
          const rms = Math.sqrt(this.rmsSum / Math.max(1, this.rmsCnt));
          this.rmsSum = 0;
          this.rmsCnt = 0;
          this.port.postMessage({ frame: this.out.buffer.slice(0), rms });
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
