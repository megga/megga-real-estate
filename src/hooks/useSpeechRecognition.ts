import { useState, useCallback, useRef, useEffect } from 'react'

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined

interface UseSpeechRecognitionOptions {
  lang?: string
  onFinalTranscript?: (transcript: string) => void
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'fr-CH', onFinalTranscript } = options
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const manualStopRef = useRef(false)

  // Keep callback ref updated
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const isSupported = !!SpeechRecognitionAPI

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return

    // Clean up existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    let finalTranscript = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(finalTranscript + interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      const text = finalTranscript.trim()
      if (text && onFinalTranscriptRef.current) {
        onFinalTranscriptRef.current(text)
      }
      setTranscript('')
      finalTranscript = ''
    }

    recognition.onerror = (event: { error: string }) => {
      // 'no-speech' and 'aborted' are not real errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setIsListening(false)
        setTranscript('')
      }
    }

    recognitionRef.current = recognition
    manualStopRef.current = false
    setTranscript('')
    setIsListening(true)
    recognition.start()
  }, [lang])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      manualStopRef.current = true
      recognitionRef.current.stop()
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
  }
}
