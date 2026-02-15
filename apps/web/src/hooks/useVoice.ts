import { useState, useRef, useCallback } from 'react'

interface UseVoiceReturn {
  isListening: boolean
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  resetTranscript: () => void
}

export function useVoice(onTranscript?: (text: string) => void): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const isSupported = !!SpeechRecognition

  const startListening = useCallback(() => {
    if (!SpeechRecognition || isListening) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(finalTranscript + interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (finalTranscript.trim()) {
        onTranscript?.(finalTranscript.trim())
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
  }, [SpeechRecognition, isListening, onTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  }
}
