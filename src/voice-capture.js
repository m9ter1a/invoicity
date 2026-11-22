// The AudioContext resamples the device stream to 16 kHz and mixes it down to mono.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(512)
    this.offset = 0
  }
  process(inputs) {
    const audio = inputs[0]?.[0]
    if (audio) {
      for (const value of audio) {
        this.buffer[this.offset++] = value
        if (this.offset === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer])
          this.buffer = new Float32Array(512)
          this.offset = 0
        }
      }
    }
    return true
  }
}
registerProcessor('voice-capture', VoiceCapture)
