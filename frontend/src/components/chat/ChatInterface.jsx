import { useState, useEffect, useRef } from "react"
import { chatAPI, voiceAPI, authAPI } from "../../services/api"
import HealthReportModal from './HealthReportModal'
import ConversationSidebar from "../ConversationSidebar"
import HospitalFinder from './HospitalFinder'
import { 
  FaRobot, FaUser, FaCopy, FaVolumeUp, FaPaperPlane,
  FaCheck, FaStop, FaImage, FaTimes, FaFileMedical,
  FaGlobe, FaMicrophone, FaMicrophoneSlash,
} from "react-icons/fa"
import "./ChatInterface.css"

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [language, setLanguage] = useState("English")
  const [detectedLanguage, setDetectedLanguage] = useState(null)
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`)
  const [copiedId, setCopiedId] = useState(null)
  const [speakingId, setSpeakingId] = useState(null)
  const [ttsLoadingId, setTtsLoadingId] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showHealthReportModal, setShowHealthReportModal] = useState(false)
  
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [voiceError, setVoiceError] = useState(null)
  
  // Hospital Finder State
  const [showHospitalFinder, setShowHospitalFinder] = useState(false)
  const [hospitalEmergencyLevel, setHospitalEmergencyLevel] = useState(null)
  
  // Conversation management state
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [conversationsRefreshTrigger, setConversationsRefreshTrigger] = useState(0)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  
  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)
  const abortControllerRef = useRef(null)
  const fileInputRef = useRef(null)
  const hasLoadedInitialConversation = useRef(false)
  
  // ✅ NEW: Voice Recognition Ref
  const recognitionRef = useRef(null)

  const languages = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]

    useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceSupported(false)
      return
    }

    const langMap = {
      English: 'en-US', Hindi: 'hi-IN', Kannada: 'kn-IN',
      Tamil: 'ta-IN', Telugu: 'te-IN', Malayalam: 'ml-IN'
    }

    // Abort and discard previous instance before creating new one
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (_) {}
      recognitionRef.current = null
    }

    // Check microphone permission first
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then((permissionStatus) => {
        if (permissionStatus.state === 'denied') {
          setVoiceSupported(false)
          return
        }
        setVoiceSupported(true)
      }).catch(() => {
        setVoiceSupported(true) // assume supported if permissions API fails
      })
    } else {
      setVoiceSupported(true)
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = langMap[language] || 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
        }
      }
      if (finalText.trim()) {
        setInputMessage(prev => prev ? (prev + ' ' + finalText).trim() : finalText.trim())
      }
    }

    recognition.onerror = (event) => {
      console.error('[Voice] error:', event.error)
      setIsListening(false)

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setVoiceSupported(false)
        alert('Microphone access denied. Please allow microphone in browser settings and use http://localhost:3000.')
      } else if (event.error === 'network') {
        // network error = not HTTPS or mic blocked by browser policy
        alert(
          'Voice input requires HTTPS or localhost.\n\n' +
          'Please open the app at http://localhost:3000 (not 127.0.0.1 and not an IP address).\n\n' +
          'Also make sure your browser allows microphone access for this site.'
        )
        setVoiceSupported(false)
      } else if (event.error === 'no-speech') {
        // silent — user just didn't speak, don't alert
        setIsListening(false)
      } else if (event.error === 'aborted') {
        // intentional stop, ignore
      } else {
        console.warn('[Voice] unhandled error:', event.error)
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // If still supposed to be listening (continuous mode ended unexpectedly), restart
      setIsListening(prev => {
        if (prev) {
          // auto-restart on unexpected end
          try { recognition.start() } catch (_) {}
          return true
        }
        return false
      })
    }

    recognitionRef.current = recognition

    return () => {
      try { recognition.abort() } catch (_) {}
      recognitionRef.current = null
    }
  }, [language])

  const toggleVoiceInput = async () => {
  if (isListening) {
    if (recognitionRef.current?.mediaRecorder?.state === 'recording') {
      recognitionRef.current.mediaRecorder.stop()
    }
    setIsListening(false)
    return
  }

  setVoiceError(null)

  // Request microphone
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      }
    })
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setVoiceError('Mic blocked. Click 🔒 in address bar → allow microphone.')
    } else if (err.name === 'NotFoundError') {
      setVoiceError('No microphone found. Please connect one.')
    } else {
      setVoiceError('Cannot access microphone: ' + err.message)
    }
    return
  }

  // Pick best supported format
  const mimeType = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ].find(t => MediaRecorder.isTypeSupported(t)) || ''

  let mediaRecorder
  try {
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
  } catch (err) {
    mediaRecorder = new MediaRecorder(stream)
  }

  const audioChunks = []

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data)
    }
  }

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop())
    setIsListening(false)

    if (audioChunks.length === 0) {
      setVoiceError('No audio captured. Please try again.')
      return
    }

    const totalSize = audioChunks.reduce((sum, c) => sum + c.size, 0)
    console.log('[Voice] Total audio size:', totalSize, 'bytes, chunks:', audioChunks.length)

    if (totalSize < 1000) {
      setVoiceError('Recording too short. Please speak for 2-3 seconds.')
      return
    }

    const actualMime = mediaRecorder.mimeType || 'audio/webm'
    const audioBlob = new Blob(audioChunks, { type: actualMime })

    setIsLoading(true)
    setVoiceError(null)

    try {
      const formData = new FormData()
      const ext = actualMime.includes('ogg') ? 'ogg'
                : actualMime.includes('mp4') ? 'mp4'
                : 'webm'

      formData.append('audio', audioBlob, `voice.${ext}`)
      formData.append('language', language)
      formData.append('selected_language', language)

      console.log('[Voice] Sending:', actualMime, audioBlob.size, 'bytes')

      const response = await fetch('http://localhost:8000/api/voice/transcribe/', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      console.log('[Voice] Result:', data)

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`)
      }

      if (data.success && data.text && data.text.trim().length > 1) {
        // Update language if detected from voice
        if (data.language && data.language !== 'English') {
          setLanguage(data.language)
          setDetectedLanguage(data.language)
        }
        setIsLoading(false)
        handleSendVoiceMessage(data.text.trim(), data.language || language)
      } else {
        setIsLoading(false)
        setVoiceError(data.error || 'Could not understand. Please try again.')
      }

    } catch (error) {
      setIsLoading(false)
      console.error('[Voice] Error:', error)
      setVoiceError('Transcription failed: ' + error.message)
    }
  }

  mediaRecorder.onerror = (event) => {
    console.error('[Voice] MediaRecorder error:', event)
    stream.getTracks().forEach(t => t.stop())
    setIsListening(false)
    setVoiceError('Recording error. Please try again.')
  }

  // Store for stop button
  recognitionRef.current = { mediaRecorder }

  // Collect data every 250ms for better chunks
  mediaRecorder.start(250)
  setIsListening(true)
  console.log('[Voice] Recording started with:', mediaRecorder.mimeType)
}

  const handleSendVoiceMessage = async (text, voiceLanguage = null) => {
    if (!text || isLoading) return

    setInputMessage('')
    setIsLoading(true)

    // Use voice detected language or current selected language
    const msgLanguage = voiceLanguage || language

    const userMsgId = Date.now()
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, timestamp: new Date() }
    ])

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg: text,
          user_id: isAuthenticated ? currentUser.id : userId,
          language: msgLanguage,
          conversation_id: currentConversationId,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response || !response.body) throw new Error('No response')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      const assistantMsgId = Date.now() + 1

      setMessages(prev => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date(), streaming: true }
      ])

      let buffer = ''
      let fullResponseText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6).trim())
            if (data.chunk) {
              assistantMessage += data.chunk
              fullResponseText = assistantMessage
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: assistantMessage, streaming: true }
                    : msg
                )
              )
            }
            if (data.conversation_id) {
              setCurrentConversationId(data.conversation_id)
              setConversationsRefreshTrigger(prev => prev + 1)
            }
            if (data.detected_language) {
              setDetectedLanguage(data.detected_language)
              setLanguage(data.detected_language)
            }
            if (data.show_hospitals) {
              setShowHospitalFinder(true)
              setHospitalEmergencyLevel(data.emergency_level || null)
            }
            if (data.done) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId ? { ...msg, streaming: false } : msg
                )
              )
              setConversationsRefreshTrigger(prev => prev + 1)

              // Auto read aloud the response after voice input
              if (fullResponseText.trim()) {
                setTimeout(() => {
                  const ttsLanguage = detectedLanguage || language
                  const langMap = {
                    English: 'en-US', Hindi: 'hi-IN', Kannada: 'kn-IN',
                    Tamil: 'ta-IN', Telugu: 'te-IN', Malayalam: 'ml-IN'
                  }
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel()
                    const utterance = new SpeechSynthesisUtterance(fullResponseText)
                    utterance.lang = langMap[ttsLanguage] || 'en-US'
                    utterance.rate = 0.9
                    const voices = window.speechSynthesis.getVoices()
                    const preferred = voices.find(v =>
                      v.lang.startsWith((langMap[ttsLanguage] || 'en-US').split('-')[0])
                    )
                    if (preferred) utterance.voice = preferred
                    window.speechSynthesis.speak(utterance)
                  }
                }, 500)
              }
              break
            }
          } catch (_) {}
        }
      }
      try { reader.releaseLock() } catch (_) {}

    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          { id: Date.now() + 2, role: 'assistant', content: 'Sorry, error occurred. Please try again.', timestamp: new Date(), error: true }
        ])
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const readAloud = async (text, id) => {
    try {
      // Stop existing speech
      if (speakingId === id && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setSpeakingId(null)
        return
      }

      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      setTtsLoadingId(id)
      setSpeakingId(null)

      const ttsLanguage = detectedLanguage || language

      // ✅ TRY WEB SPEECH SYNTHESIS FIRST (No server needed, instant!)
      if ('speechSynthesis' in window) {
        try {
          // Stop any existing speech
          window.speechSynthesis.cancel()
          
          const utterance = new SpeechSynthesisUtterance(text)
          
          // Map language to voice
          const langMap = {
            'English': 'en-US',
            'Hindi': 'hi-IN',
            'Kannada': 'kn-IN',
            'Tamil': 'ta-IN',
            'Telugu': 'te-IN',
            'Malayalam': 'ml-IN'
          }
          
          utterance.lang = langMap[ttsLanguage] || 'en-US'
          utterance.rate = 0.9 // Slightly slower for better clarity
          utterance.pitch = 1.0
          utterance.volume = 1.0
          
          // Select best voice for language
          const voices = window.speechSynthesis.getVoices()
          const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(utterance.lang.split('-')[0])
          )
          if (preferredVoice) {
            utterance.voice = preferredVoice
          }
          
          utterance.onend = () => {
            setSpeakingId(null)
          }
          
          utterance.onerror = (event) => {
            if (event.error === 'interrupted' || event.error === 'canceled') {
              setSpeakingId(null)
              return
            }
            console.warn('[Voice] Synthesis error:', event.error)
            setSpeakingId(null)
          }
          
          window.speechSynthesis.speak(utterance)
          setSpeakingId(id)
          setTtsLoadingId(null)
          return
        } catch (synthError) {
          console.warn('[Voice] Web Speech Synthesis failed, falling back to server TTS')
        }
      }

      // ✅ FALLBACK: Server-based TTS
      const response = await voiceAPI.textToSpeech(text, ttsLanguage)
      
      if (!response?.success || !response?.audio) {
        throw new Error("Failed to generate speech")
      }

      const audio = new Audio(`data:audio/mp3;base64,${response.audio}`)
      audioRef.current = audio

      audio.onended = () => {
        setSpeakingId(null)
      }

      audio.onerror = (e) => {
        console.error("Audio error:", e)
        setSpeakingId(null)
      }

      await audio.play()
      setSpeakingId(id)
      
    } catch (error) {
      console.error("TTS error:", error)
      setSpeakingId(null)
    } finally {
      setTtsLoadingId(null)
    }
  }

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setSpeakingId(null)
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
    }
  }

  // PERSISTENCE - Save/Load current conversation
  const STORAGE_KEY = 'apollo_current_conversation'
  
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(STORAGE_KEY, currentConversationId)
    }
  }, [currentConversationId])

  useEffect(() => {
    if (voiceError) {
      const t = setTimeout(() => setVoiceError(null), 4000)
      return () => clearTimeout(t)
    }
  }, [voiceError])

  // Check authentication on mount
  useEffect(() => {
    const user = authAPI.getCurrentUser()
    if (user) {
      setCurrentUser(user)
      setIsAuthenticated(true)
    }
  }, [])

  const loadLastConversation = async () => {
    if (hasLoadedInitialConversation.current) return
    
    const savedConversationId = localStorage.getItem(STORAGE_KEY)
    if (!savedConversationId) {
      hasLoadedInitialConversation.current = true
      return
    }
    
    hasLoadedInitialConversation.current = true
    
    try {
      await handleSelectConversation(savedConversationId, true)
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY)
      setCurrentConversationId(null)
      setMessages([])
      setDetectedLanguage(null)
      setConversationsRefreshTrigger(prev => prev + 1)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause()
          audioRef.current.src = ""
        } catch (e) {}
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleSelectConversation = async (conversationId, isAutoLoad = false) => {
    if (conversationId === currentConversationId && messages.length > 0) {
      return
    }
    
    setCurrentConversationId(conversationId)
    setMessages([])
    setDetectedLanguage(null)
    setIsLoadingConversation(true)
    
    try {
      const requestUserId = isAuthenticated ? currentUser.id : userId
      const url = `http://localhost:8000/api/conversations/${conversationId}/?user_id=${requestUserId}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation not found')
        }
        throw new Error(`Failed to load: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.language) {
        setLanguage(data.language)
        setDetectedLanguage(data.language)
      }
      
      if (data.messages && Array.isArray(data.messages)) {
        const loadedMessages = data.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.message,
          timestamp: new Date(msg.created_at),
          has_image: msg.has_image,
          image_description: msg.image_description
        }))
        
        setMessages(loadedMessages)
      }
      
    } catch (error) {
      console.error("Load error:", error)
      setMessages([])
      setCurrentConversationId(null)
      setDetectedLanguage(null)
      localStorage.removeItem(STORAGE_KEY)
      setConversationsRefreshTrigger(prev => prev + 1)
      
      if (!isAutoLoad) {
        alert("This conversation no longer exists or you don't have access to it.")
      }
      
      if (!isAutoLoad) {
        throw error
      }
      
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const handleNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    setDetectedLanguage(null)
    setLanguage("English")
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG, PNG, or WebP)')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('Image size should be less than 10MB')
        return
      }

      setSelectedImage(file)
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedImage) || isLoading) return

    const userMessage = inputMessage.trim() || "Please analyze this medical image"
    setInputMessage("")
    setIsLoading(true)

    const userMsgId = Date.now()
    
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
        image: imagePreview,
        timestamp: new Date(),
      },
    ])

    abortControllerRef.current = new AbortController()

    try {
      let response

      if (selectedImage) {
        const formData = new FormData()
        formData.append('msg', userMessage)
        formData.append('user_id', isAuthenticated ? currentUser.id : userId)
        formData.append('language', language)
        formData.append('image', selectedImage)
        
        if (currentConversationId) {
          formData.append('conversation_id', currentConversationId)
        }

        response = await fetch('http://localhost:8000/api/chat/image/', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal,
        })
      } else {
        response = await fetch('http://localhost:8000/api/chat/stream/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            msg: userMessage,
            user_id: isAuthenticated ? currentUser.id : userId,
            language: language,
            conversation_id: currentConversationId,
          }),
          signal: abortControllerRef.current.signal,
        })
      }

      removeImage()
      setUploadProgress(0)

      if (!response || !response.body) {
        throw new Error("No response from server")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let assistantMessage = ""
      const assistantMsgId = Date.now() + 1

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          streaming: true,
        },
      ])

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue

          try {
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            const data = JSON.parse(jsonStr)

            if (data.chunk) {
              assistantMessage += data.chunk
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: assistantMessage, streaming: true }
                    : msg
                )
              )
            }

            if (data.conversation_id) {
              setCurrentConversationId(data.conversation_id)
              setConversationsRefreshTrigger(prev => prev + 1)
            }

            if (data.detected_language) {
              setDetectedLanguage(data.detected_language)
              setLanguage(data.detected_language)
            }

            if (data.show_hospitals) {
              setShowHospitalFinder(true)
              setHospitalEmergencyLevel(data.emergency_level || null)
            }

            if (data.done) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, streaming: false }
                    : msg
                )
              )
              setConversationsRefreshTrigger(prev => prev + 1)
              break
            }

            if (data.error) {
              throw new Error(data.error)
            }
          } catch (parseError) {
            console.error("Parse error:", parseError)
          }
        }
      }

      try {
        reader.releaseLock()
      } catch (e) {}

      if (!assistantMessage.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: "Sorry, I couldn't generate a response. Please try again.",
                  error: true,
                  streaming: false,
                }
              : msg
          )
        )
      }

    } catch (error) {
      console.error("Error sending message:", error)
      
      if (error.name === 'AbortError') {
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
          error: true,
        },
      ])
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      removeImage()
      setUploadProgress(0)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyToClipboard = async (text, id) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <div className="chat-container-wrapper">
      {isAuthenticated && (
        <ConversationSidebar
          currentConversationId={currentConversationId}
          onSelectConversation={(id) => handleSelectConversation(id, false)}
          onNewConversation={handleNewConversation}
          userId={currentUser?.id}
          refreshTrigger={conversationsRefreshTrigger}
        />
      )}
      
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-brand">
            <div className="chat-icon">
              <FaRobot size={24} />
            </div>
            <div className="chat-title">
              <h1>AI Medical Assistant</h1>
              <p>
                {isAuthenticated 
                  ? `Welcome, ${currentUser?.first_name || currentUser?.username}!` 
                  : 'Always here to help'}
              </p>
            </div>
          </div>
          <div className="chat-controls">
            {detectedLanguage && detectedLanguage !== language && (
              <div className="language-indicator">
                <FaGlobe size={14} />
                <span>Detected: {detectedLanguage}</span>
              </div>
            )}
            
            <button
              className="generate-report-btn"
              onClick={() => setShowHealthReportModal(true)}
              disabled={!currentConversationId || messages.length === 0}
              title="Generate Health Report"
            >
              <FaFileMedical />
              <span>Generate Health Report</span>
            </button>
            
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setDetectedLanguage(null)
              }}
              className="language-selector"
              disabled={isLoading}
              title="Select preferred language"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="chat-messages">
          {isLoadingConversation ? (
            <div className="loading-conversation">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon">
                <FaRobot size={48} />
              </div>
              <h2>Welcome to AI Medical Assistant</h2>
              <p>
                Ask me anything about symptoms, conditions, or wellness.
                Upload medical images for analysis.
              </p>

            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`message message-${msg.role} ${msg.error ? 'message-error' : ''}`}
              >
                <div className="message-avatar">
                  {msg.role === "user" ? <FaUser size={20} /> : <FaRobot size={20} />}
                </div>
                <div className="message-bubble">
                  {msg.image && (
                    <div className="message-image">
                      <img src={msg.image} alt="Medical scan" />
                    </div>
                  )}
                  {msg.streaming && !msg.content ? (
                    <p className="streaming-text">Analyzing...</p>
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  )}
                  
                  {msg.role === "assistant" && msg.content && !msg.streaming && (
                    <div className="message-actions">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className={`action-btn ${copiedId === msg.id ? 'action-success' : ''}`}
                      >
                        {copiedId === msg.id ? (
                          <>
                            <FaCheck size={14} /> Copied!
                          </>
                        ) : (
                          <>
                            <FaCopy size={14} /> Copy
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => 
                          speakingId === msg.id 
                            ? stopSpeaking() 
                            : readAloud(msg.content, msg.id)
                        }
                        disabled={ttsLoadingId === msg.id}
                        className={`action-btn ${speakingId === msg.id ? 'action-active' : ''}`}
                      >
                        {speakingId === msg.id ? (
                          <>
                            <FaStop size={14} /> Stop
                          </>
                        ) : ttsLoadingId === msg.id ? (
                          "Loading..."
                        ) : (
                          <>
                            <FaVolumeUp size={14} /> Read
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="typing-indicator">
              <div className="message-avatar">
                <FaRobot size={20} />
              </div>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          {imagePreview && (
            <div className="image-preview-container">
              <div className="image-preview">
                <img src={imagePreview} alt="Selected" />
                <button 
                  className="remove-image-btn"
                  onClick={removeImage}
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          )}
          
          <div className="input-wrapper">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
            />

            <button
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !!selectedImage}
              title="Upload medical image"
            >
              <FaImage size={18} />
            </button>

            <button
              className={`voice-btn ${isListening ? 'voice-active' : ''}`}
              onClick={toggleVoiceInput}
              disabled={isLoading}
              title={isListening ? 'Stop voice input' : 'Start voice input'}
            >
              {isListening ? <FaMicrophoneSlash size={18} /> : <FaMicrophone size={18} />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? '🎤 Listening... speak now'
                  : voiceError
                    ? voiceError
                    : selectedImage
                      ? 'Describe your concern (optional)'
                      : detectedLanguage
                        ? `Type or speak in ${detectedLanguage}...`
                        : 'Type your message or click mic to speak...'
              }
              disabled={isLoading}
              maxLength={500}
              className={`message-field ${voiceError ? 'message-field-error' : ''}`}
            />

            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={isLoading || (!inputMessage.trim() && !selectedImage)}
            >
              <FaPaperPlane size={16} />
            </button>
          </div>
        </div>
      </div>

      {showHealthReportModal && (
        <HealthReportModal
          conversationId={currentConversationId}
          userId={isAuthenticated ? currentUser?.id : userId}
          onClose={() => setShowHealthReportModal(false)}
        />
      )}

      {showHospitalFinder && (
        <HospitalFinder
          emergencyLevel={hospitalEmergencyLevel}
          onClose={() => {
            setShowHospitalFinder(false)
            setHospitalEmergencyLevel(null)
          }}
        />
      )}
    </div>
  )
}

export default ChatInterface
