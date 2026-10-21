// Read-aloud for kids: browser speechSynthesis, output only. No microphone, nothing leaves the device.

import { useCallback, useEffect, useRef, useState } from 'react'

const RATE = 0.85 // a little slower than normal, friendly for 6-12
const PITCH = 1.1

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window

const localeFor = (lang?: string | null) => (lang === 'es' ? 'es-ES' : lang === 'zh-CN' ? 'zh-CN' : 'en-US')

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}

// `key` says which line is being read, so a screen can highlight that speaker button.
export function useSpeaker(lang?: string | null) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const current = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    current.current = null
    setActiveKey(null)
    stopSpeaking()
  }, [])

  const speak = useCallback(
    (key: string, text: string) => {
      if (!canSpeak() || !text.trim()) return
      stopSpeaking()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = localeFor(lang)
      utter.rate = RATE
      utter.pitch = PITCH
      const done = () => {
        if (current.current === utter) {
          current.current = null
          setActiveKey(null)
        }
      }
      utter.onend = done
      utter.onerror = done
      current.current = utter
      setActiveKey(key)
      window.speechSynthesis.speak(utter)
    },
    [lang],
  )

  useEffect(() => () => stopSpeaking(), [])

  return { supported: canSpeak(), activeKey, speak, stop }
}
