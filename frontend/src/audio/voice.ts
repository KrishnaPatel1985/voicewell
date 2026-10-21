// Browser side of the voice protocol (BUILD_SPEC 6.2): mic frames up, persona audio and events down.

import { signalSignedOut, voiceUrl } from '../api'
import { MicCapture } from './mic'
import { AudioPlayer } from './player'

export type FallbackKind = 'connection' | 'server' | 'not-permitted'

export interface VoiceHandlers {
  onReady: () => void
  onUserSpeechStarted: () => void
  onUserTranscript: (text: string, final: boolean) => void
  onAssistantTranscript: (text: string, final: boolean) => void
  onCancelled: () => void
  onPlaying: (active: boolean) => void
  onSafetyStop: (message: string) => void
  onDone: () => void
  // The voice path cannot continue; the screen should switch to typed practice.
  onFallback: (kind: FallbackKind, reason?: string) => void
}

type ServerMessage =
  | { type: 'ready' }
  | { type: 'user_speech_started' }
  | { type: 'user_transcript'; text: string; final: boolean }
  | { type: 'assistant_transcript'; text: string; final: boolean }
  | { type: 'cancelled' }
  | { type: 'safety_stop'; message: string }
  | { type: 'done' }
  | { type: 'error'; code?: string; reason?: string; fallback?: string }

const NOT_PERMITTED_CLOSE = 4403
const NOT_AUTHENTICATED_CLOSE = 4401

export class VoiceSession {
  private handlers: VoiceHandlers
  private ws: WebSocket | null = null
  private mic: MicCapture | null = null
  private player: AudioPlayer | null = null
  private ready = false
  private muted = false
  private closedByUs = false // we ended it, so a close is expected
  private finished = false // server said done / safety_stop / error, so a close is expected
  private reconnected = false

  constructor(handlers: VoiceHandlers) {
    this.handlers = handlers
  }

  // Must be called directly from a click handler (AudioContexts are created before the first await).
  // Rejects with MicError if the microphone cannot be used; nothing is opened on the network in that case.
  async start(): Promise<void> {
    this.player = new AudioPlayer((active) => this.handlers.onPlaying(active))
    this.mic = new MicCapture((pcm) => this.sendFrame(pcm))
    try {
      await this.mic.start()
    } catch (error) {
      this.close()
      throw error
    }
    if (this.closedByUs) return
    this.openSocket()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  // "End & get feedback": tell the server, then close.
  end(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'end' }))
    this.close()
  }

  close(): void {
    this.closedByUs = true
    this.ready = false
    this.mic?.stop()
    this.mic = null
    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.player?.close()
    this.player = null
  }

  private openSocket(): void {
    const ws = new WebSocket(voiceUrl())
    ws.binaryType = 'arraybuffer'
    this.ws = ws
    this.ready = false
    ws.onmessage = (event) => this.handleMessage(event.data)
    ws.onclose = (event) => this.handleClose(ws, event)
  }

  private sendFrame(pcm: Int16Array): void {
    if (!this.ready || this.muted || this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(pcm.buffer as ArrayBuffer)
  }

  private handleClose(ws: WebSocket, event: CloseEvent): void {
    if (ws !== this.ws) return
    this.ready = false
    if (this.closedByUs || this.finished) return
    if (event.code === NOT_AUTHENTICATED_CLOSE) {
      this.finished = true
      this.close()
      signalSignedOut()
      return
    }
    if (event.code === NOT_PERMITTED_CLOSE) {
      this.finished = true
      this.handlers.onFallback('not-permitted')
      return
    }
    // Dropped without an `end`: reconnect once, then give up and fall back to typing.
    if (!this.reconnected) {
      this.reconnected = true
      this.openSocket()
      return
    }
    this.finished = true
    this.handlers.onFallback('connection')
  }

  private handleMessage(data: unknown): void {
    if (data instanceof ArrayBuffer) {
      this.player?.enqueue(data)
      return
    }
    if (typeof data !== 'string') return
    let message: ServerMessage
    try {
      message = JSON.parse(data) as ServerMessage
    } catch {
      return
    }
    switch (message.type) {
      case 'ready':
        this.ready = true
        this.handlers.onReady()
        break
      case 'user_speech_started':
        this.player?.stop()
        this.handlers.onUserSpeechStarted()
        break
      case 'user_transcript':
        this.handlers.onUserTranscript(message.text, !!message.final)
        break
      case 'assistant_transcript':
        this.handlers.onAssistantTranscript(message.text, !!message.final)
        break
      case 'cancelled':
        this.player?.stop()
        this.handlers.onCancelled()
        break
      case 'safety_stop':
        this.finished = true
        this.player?.stop()
        this.mic?.stop()
        this.mic = null
        this.handlers.onSafetyStop(message.message)
        this.ws?.close()
        break
      case 'done':
        // Let the last reply finish playing; stop listening.
        this.finished = true
        this.mic?.stop()
        this.mic = null
        this.handlers.onDone()
        this.ws?.close()
        break
      case 'error':
        this.finished = true
        if (message.code === 'not_authenticated') {
          this.close()
          signalSignedOut()
        } else if (message.code === 'not_permitted') {
          this.handlers.onFallback('not-permitted', message.reason)
        } else {
          this.handlers.onFallback('server', message.code)
        }
        break
    }
  }
}
