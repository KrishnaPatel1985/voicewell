// Playback queue for persona audio: Int16 LE mono 24 kHz chunks scheduled back to back.

const SAMPLE_RATE = 24000
const LEAD_SECONDS = 0.04

export class AudioPlayer {
  private ctx: AudioContext
  private nextTime = 0
  private sources = new Set<AudioBufferSourceNode>()
  private carry: number | null = null
  private onActive?: (active: boolean) => void

  // Create from a click handler so the context starts in the running state.
  constructor(onActive?: (active: boolean) => void) {
    try {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    } catch {
      this.ctx = new AudioContext()
    }
    void this.ctx.resume()
    this.onActive = onActive
  }

  enqueue(chunk: ArrayBuffer): void {
    let bytes = new Uint8Array(chunk)
    if (this.carry !== null) {
      const merged = new Uint8Array(bytes.length + 1)
      merged[0] = this.carry
      merged.set(bytes, 1)
      bytes = merged
      this.carry = null
    }
    if (bytes.length % 2 === 1) {
      this.carry = bytes[bytes.length - 1]
      bytes = bytes.subarray(0, bytes.length - 1)
    }
    const count = bytes.length / 2
    if (count === 0) return

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
    const floats = new Float32Array(count)
    for (let i = 0; i < count; i++) floats[i] = view.getInt16(i * 2, true) / 32768

    const buffer = this.ctx.createBuffer(1, count, SAMPLE_RATE)
    buffer.copyToChannel(floats, 0)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)

    const startAt = Math.max(this.ctx.currentTime + LEAD_SECONDS, this.nextTime)
    this.nextTime = startAt + buffer.duration
    const wasIdle = this.sources.size === 0
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      if (this.sources.size === 0) this.onActive?.(false)
    }
    source.start(startAt)
    if (wasIdle) this.onActive?.(true)
  }

  // Cut everything that is queued or playing (user started talking, or the reply was cancelled).
  stop(): void {
    const hadAudio = this.sources.size > 0
    for (const source of this.sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // already stopped
      }
      source.disconnect()
    }
    this.sources.clear()
    this.nextTime = 0
    this.carry = null
    if (hadAudio) this.onActive?.(false)
  }

  close(): void {
    this.stop()
    if (this.ctx.state !== 'closed') void this.ctx.close()
  }
}
