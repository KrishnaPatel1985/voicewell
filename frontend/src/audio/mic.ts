// Microphone capture: AudioWorklet at 24 kHz, posted as ~40 ms Int16 LE frames (960 samples).

export const SAMPLE_RATE = 24000
const FRAME_MS = 40

export class MicError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MicError'
  }
}

// Collects 128-sample render quanta into fixed-size Float32 frames and posts them to the main thread.
const WORKLET_SOURCE = `
class VwCapture extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.size = options.processorOptions.frame
    this.buf = new Float32Array(this.size)
    this.fill = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.fill++] = ch[i]
        if (this.fill === this.size) {
          this.port.postMessage(this.buf)
          this.buf = new Float32Array(this.size)
          this.fill = 0
        }
      }
    }
    return true
  }
}
registerProcessor('vw-capture', VwCapture)
`

// Float32 [-1, 1] -> Int16 LE. If the browser would not give us a 24 kHz context, resample linearly.
function toInt16(input: Float32Array, srcRate: number): Int16Array {
  const outLength = srcRate === SAMPLE_RATE ? input.length : Math.round((input.length * SAMPLE_RATE) / srcRate)
  const out = new Int16Array(outLength)
  const ratio = srcRate / SAMPLE_RATE
  for (let i = 0; i < outLength; i++) {
    let sample: number
    if (ratio === 1) {
      sample = input[i]
    } else {
      const pos = i * ratio
      const lo = Math.floor(pos)
      const hi = Math.min(lo + 1, input.length - 1)
      sample = input[lo] + (input[hi] - input[lo]) * (pos - lo)
    }
    const clamped = Math.max(-1, Math.min(1, sample))
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return out
}

export class MicCapture {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private onFrame: (pcm: Int16Array) => void
  private stopped = false

  constructor(onFrame: (pcm: Int16Array) => void) {
    this.onFrame = onFrame
  }

  // Call straight from a click handler so the AudioContext is allowed to start.
  async start(): Promise<void> {
    this.stopped = false
    try {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    } catch {
      this.ctx = new AudioContext()
    }
    void this.ctx.resume()

    if (!navigator.mediaDevices?.getUserMedia) {
      this.stop()
      throw new MicError('This browser cannot use a microphone here.')
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
    } catch {
      this.stop()
      throw new MicError('Microphone access was not allowed.')
    }
    // Closed while the permission prompt was open: release the stream we just got.
    if (this.stopped) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
      return
    }

    try {
      const ctx = this.ctx
      const frame = Math.round((ctx.sampleRate * FRAME_MS) / 1000)
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
      try {
        await ctx.audioWorklet.addModule(url)
      } finally {
        URL.revokeObjectURL(url)
      }
      const source = ctx.createMediaStreamSource(this.stream)
      const node = new AudioWorkletNode(ctx, 'vw-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { frame },
      })
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        this.onFrame(toInt16(event.data, ctx.sampleRate))
      }
      // Route through a muted gain so the graph is pulled without playing the mic back.
      const silent = ctx.createGain()
      silent.gain.value = 0
      source.connect(node)
      node.connect(silent)
      silent.connect(ctx.destination)
      this.node = node
    } catch {
      this.stop()
      throw new MicError('The microphone could not be started.')
    }
  }

  stop(): void {
    this.stopped = true
    if (this.node) {
      this.node.port.onmessage = null
      this.node.disconnect()
      this.node = null
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close()
    this.ctx = null
  }
}
