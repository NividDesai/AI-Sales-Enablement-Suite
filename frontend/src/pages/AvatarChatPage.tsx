import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionCard } from '../components/ui/section-card'
import { AIButton } from '../components/ui/ai-button'
import { Input } from '../components/ui/input'
import { PageHeader } from '../components/ui/page-header'
import { 
  MessageSquare, Users, Send, Loader2, AlertCircle, 
  User, Video, Mic
} from 'lucide-react'
import AvatarScene from '../components/avatar/AvatarScene'
import ErrorBoundary from '../components/avatar/ErrorBoundary'
import { AIVoiceInput } from '../components/ui/ai-voice-input'

// Type declarations for Speech Recognition API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

interface Persona {
  id: string
  name: string
  role: string
  description?: string
  avatar_url?: string
  avatar_id?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

interface AvatarData {
  text: string
  audio_url?: string
  avatar_url?: string
  phonemes?: Array<{ start: number; end: number; value: string }>
  emotion?: string
}

export default function AvatarChatPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const getFullAvatarUrl = (url?: string) => {
    if (!url) return undefined
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/')) return `http://localhost:4000${url}`
    return `http://localhost:4000/${url}`
  }

  // Load personas on mount
  useEffect(() => {
    loadPersonas()
  }, [])
  
  // Handle persona selection from URL
  useEffect(() => {
    if (personas.length > 0 && !selectedPersona) {
      const urlParams = new URLSearchParams(window.location.search)
      const personaId = urlParams.get('persona')
      if (personaId) {
        const persona = personas.find((p) => p.id === personaId)
        if (persona) {
          setSelectedPersona(persona)
          createSession(persona.id)
        }
      }
    }
  }, [personas, selectedPersona])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionConstructor = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition ||
        (globalThis as any).SpeechRecognition ||
        (globalThis as any).webkitSpeechRecognition
      
      if (SpeechRecognitionConstructor) {
        const recognition = new SpeechRecognitionConstructor() as SpeechRecognition
        // Improved settings for better accuracy
        recognition.continuous = true // Keep listening for multiple phrases
        recognition.interimResults = true // Show interim results
        recognition.lang = 'en-US' // Set language
        // maxAlternatives may not be available in all browsers
        if ('maxAlternatives' in recognition) {
          (recognition as any).maxAlternatives = 1
        }
        
        // Additional settings if available
        if ('grammars' in recognition) {
          // Could add grammar hints here if needed
        }

        recognition.onstart = () => {
          setIsListening(true)
          setError(null)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = ''
          let interimTranscript = ''

          // Process all results, prioritizing final ones
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            const alternative = result[0]
            const transcript = alternative.transcript.trim()
            const confidence = alternative.confidence || 0

            // Only use results with reasonable confidence (filter out very low confidence)
            if (confidence < 0.3 && result.isFinal) {
              continue // Skip low confidence final results
            }

            if (result.isFinal) {
              // Only add final results with good confidence
              if (confidence >= 0.5 || transcript.length > 2) {
                finalTranscript += transcript + ' '
              }
            } else {
              interimTranscript += transcript
            }
          }

          // Add final transcript to input
          if (finalTranscript.trim()) {
            const cleanedTranscript = finalTranscript
              .trim()
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/[^\w\s.,!?;:'"-]/g, '') // Remove special characters except punctuation
            
            setInputMessage((prev) => {
              const newText = prev.trim() 
                ? prev + ' ' + cleanedTranscript 
                : cleanedTranscript
              return newText.trim()
            })
            
            // Auto-stop listening when text is loaded
            if (recognitionRef.current) {
              recognitionRef.current.stop()
              setIsListening(false)
            }
          }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error)
          
          // Don't stop listening for certain errors
          if (event.error === 'no-speech') {
            // Just show a subtle message, don't stop
            return
          }
          
          setIsListening(false)
          
          if (event.error === 'not-allowed') {
            setError('Microphone permission denied. Please enable it in your browser settings.')
          } else if (event.error === 'network') {
            setError('Network error. Please check your connection.')
          } else if (event.error === 'aborted') {
            // User stopped, don't show error
            return
          } else {
            setError('Speech recognition error. Please try again.')
          }
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        // onnomatch may not be available in all browsers
        if ('onnomatch' in recognition) {
          (recognition as any).onnomatch = () => {
            // No match found, but keep listening
            console.log('No speech match found')
          }
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const loadPersonas = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/avatar/personas')
      if (!res.ok) throw new Error('Failed to load personas')
      const data = await res.json()
      
      // Ensure avatar_url is set for each persona
      // Backend should already return cached URLs, but fallback to remote if needed
      const personasWithAvatars = data.map((p: Persona) => {
        let avatarUrl = p.avatar_url

        if (!avatarUrl) {
          if (p.avatar_id === 'nivid_tech_guy') {
            avatarUrl =
              'https://models.readyplayer.me/691384f1bafdabd2bace9f19.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024'
          }
        }

        return {
          ...p,
          avatar_url: getFullAvatarUrl(avatarUrl) || avatarUrl,
        }
      })
      
      setPersonas(personasWithAvatars)
    } catch (err: any) {
      setError(err?.message || 'Failed to load personas')
    }
  }

  const createSession = async (personaId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setMessages([])
      setAvatarData(null)
      setIsSpeaking(false)

      const res = await fetch('http://localhost:4000/api/avatar/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId }),
      })

      if (!res.ok) throw new Error('Failed to create session')
      const session = await res.json()
      setSessionId(session.id)
      
      // Update selected persona with avatar_url from session if available
      if (session.persona && selectedPersona) {
        setSelectedPersona({
          ...selectedPersona,
          avatar_url: getFullAvatarUrl(session.persona.avatar_url) || selectedPersona.avatar_url,
        })
      }
      
      connectWebSocket(session.id)
    } catch (err: any) {
      setError(err?.message || 'Failed to create session')
      setIsLoading(false)
    }
  }

  const connectWebSocket = (sessionId: string) => {
    // Connect to integrated backend WebSocket
    // Use query parameter for session ID to avoid path routing issues
    const wsUrl = `ws://localhost:4000/api/avatar/ws/chat/${sessionId}`
    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setIsLoading(false)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleWebSocketMessage(data)
    }

    websocket.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setError('Connection error. Please try again.')
      setIsConnected(false)
      setIsLoading(false)
    }

    wsRef.current = websocket
  }

  const handleWebSocketMessage = (data: any) => {
    console.log('Received:', data)

    switch (data.type) {
      case 'connected':
        console.log('WebSocket connected to session:', data.sessionId)
        break

      case 'text_response':
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.text, timestamp: new Date() },
        ])
        setIsLoading(false)
        break

      case 'avatar_response': {
        const normalizedAvatarUrl =
          getFullAvatarUrl(data.avatar_url) || selectedPersona?.avatar_url || undefined

        console.log('Avatar response:', data)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.text, timestamp: new Date() },
        ])

        // Set avatar data for 3D rendering
        setAvatarData({
          text: data.text,
          audio_url: data.audio_url,
          avatar_url: normalizedAvatarUrl,
          phonemes: data.phonemes || [],
          emotion: data.emotion || 'neutral',
        })

        // Play audio if available
        if (data.audio_url) {
          playAudio(data.audio_url)
        }
        setIsLoading(false)
        break
      }

      case 'processing':
        setIsLoading(true)
        break

      case 'error':
        setError(data.message || 'An error occurred')
        setIsLoading(false)
        break

      case 'pong':
        // Heartbeat response
        break

      default:
        console.log('Unknown message type:', data.type)
    }
  }

  const playAudio = (audioUrl: string) => {
    try {
      // Construct full URL
      const fullUrl = audioUrl.startsWith('http') 
        ? audioUrl 
        : `http://localhost:4000${audioUrl.startsWith('/') ? audioUrl : '/' + audioUrl}`

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.remove() // Remove old element
      }

      const audio = new Audio(fullUrl)
      audioRef.current = audio
      
      // Add to DOM so Avatar component can find it
      audio.style.display = 'none'
      document.body.appendChild(audio)

      audio.onplay = () => setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        // Clean up after a delay
        setTimeout(() => {
          if (audioRef.current === audio) {
            audio.remove()
            audioRef.current = null
          }
        }, 1000)
      }
      audio.onerror = () => {
        console.error('Audio playback error')
        setIsSpeaking(false)
      }

      audio.play().catch((err) => {
        console.error('Failed to play audio:', err)
        setIsSpeaking(false)
      })
    } catch (err) {
      console.error('Error setting up audio:', err)
      setIsSpeaking(false)
    }
  }

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || !isConnected) return

    const message = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message, timestamp: new Date() },
    ])

    // Send via WebSocket
    wsRef.current.send(
      JSON.stringify({
        type: 'user_message',
        message: message,
      })
    )
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.')
      return
    }

    try {
      if (isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      } else {
        setError(null)
        // Reset recognition state before starting
        recognitionRef.current.abort()
        // Small delay to ensure clean start
        setTimeout(() => {
          try {
            recognitionRef.current?.start()
          } catch (err) {
            // If already started, ignore the error
            if ((err as Error).message?.includes('already started')) {
              return
            }
            throw err
          }
        }, 100)
      }
    } catch (err) {
      console.error('Error starting speech recognition:', err)
      setError('Failed to start voice recognition. Please try again.')
      setIsListening(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Compact Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 backdrop-blur-xl">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">AI Avatar Practice</h1>
                <p className="text-white/50 text-sm mt-1">Practice interviews with AI-powered 3D avatars</p>
              </div>
            </div>
            {selectedPersona && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-white/80">{selectedPersona.name}</span>
              </motion.div>
            )}
          </motion.div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-xl p-4 flex items-center gap-3"
            >
                <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

          {/* Main Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left Side - Avatar Preview (Larger) */}
            <div className="xl:col-span-5 order-2 xl:order-1">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">3D Avatar</h3>
                      <p className="text-white/50 text-xs">Interactive preview</p>
                    </div>
                  </div>
                  {isSpeaking && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30 backdrop-blur-sm"
                    >
                      <Mic className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                      <span className="text-xs text-green-300 font-medium">Speaking</span>
                    </motion.div>
                  )}
                </div>
                <div className="relative w-full h-[500px] sm:h-[600px] lg:h-[700px] rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-black border border-white/10">
                  {selectedPersona && sessionId ? (
                    <ErrorBoundary>
                      <AvatarScene
                        avatarUrl={avatarData?.avatar_url || selectedPersona.avatar_url}
                        phonemes={avatarData?.phonemes || []}
                        audioUrl={avatarData?.audio_url}
                        emotion={avatarData?.emotion || 'neutral'}
                      />
                    </ErrorBoundary>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <Video className="w-10 h-10 text-white/30" />
                        </div>
                        <p className="text-white/40 text-sm">Select a persona to begin</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Right Side - Personas & Chat */}
            <div className="xl:col-span-7 order-1 xl:order-2 flex flex-col gap-6 h-[608px] sm:h-[708px] lg:h-[808px]">
              {/* Persona Selection - Horizontal Scroll */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex-shrink-0"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-white/5">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Select Persona</h3>
                    <p className="text-white/50 text-xs">Choose your practice partner</p>
                  </div>
                </div>
                {personas.length === 0 ? (
                  <div className="text-center py-12 text-white/60">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading personas...</p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {personas.map((persona) => (
                      <motion.button
                        key={persona.id}
                        onClick={() => {
                          setSelectedPersona(persona)
                          createSession(persona.id)
                        }}
                        disabled={isLoading}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className="min-w-[200px] sm:min-w-[240px] p-4 rounded-xl border backdrop-blur-sm text-left transition-all bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-lg bg-white/5">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold mb-1 text-sm">{persona.name}</h3>
                            <p className="text-white/60 text-xs mb-2">{persona.role}</p>
                            {persona.description && (
                              <p className="text-white/40 text-xs line-clamp-2">
                                {persona.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>

            {/* Chat Interface */}
            {sessionId && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex-1 flex flex-col min-h-0"
                >
                  <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                    <div className="p-2 rounded-lg bg-white/5">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Conversation</h3>
                      <p className="text-white/50 text-xs">Chat with your practice partner</p>
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-h-0">
                  {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="text-center py-16 text-white/50">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 opacity-50" />
                          </div>
                          <p className="text-sm">Start the conversation...</p>
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                              className={`max-w-[85%] rounded-2xl p-4 backdrop-blur-sm ${
                              msg.role === 'user'
                                  ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-500/30'
                                : 'bg-white/5 border border-white/10'
                            }`}
                          >
                              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                    {isLoading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex gap-2 items-center text-white/60"
                        >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                    {/* Input Area */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      {/* AI Voice Input Component */}
                      <AIVoiceInput
                        isListening={isListening}
                        onToggle={startListening}
                        onStart={() => {
                          // Voice input started
                        }}
                        onStop={(duration) => {
                          // Voice input stopped
                        }}
                        visualizerBars={32}
                        className="py-2"
                      />
                      
                      <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                            placeholder={isListening ? "Listening..." : "Type your message..."}
                        disabled={!isConnected || isLoading}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                          />
                    </div>
                    <AIButton
                      onClick={sendMessage}
                      disabled={!isConnected || isLoading || !inputMessage.trim()}
                      loading={isLoading}
                          className="h-12 px-6 rounded-xl"
                    >
                      <Send className="w-4 h-4" />
                    </AIButton>
                  </div>
                    </div>
                  </div>
                </motion.div>
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  )
}

