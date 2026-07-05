import { useState, useEffect, useRef } from "react"
import { chatAPI, voiceAPI, authAPI, API_BASE_URL } from "../../services/api"
import HealthReportModal from './HealthReportModal'
import ConversationSidebar from "../ConversationSidebar"
import HospitalFinder from './HospitalFinder'
import {
  FaRobot, FaUser, FaCopy, FaVolumeUp, FaPaperPlane,
  FaCheck, FaStop, FaImage, FaTimes, FaFileMedical,
  FaGlobe, FaMicrophone, FaMicrophoneSlash, FaBars,
  FaChevronDown, FaCog, FaCamera, FaPlus,
} from "react-icons/fa"
import "./ChatInterface.css"

const unlockAudio = () => {
  try {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('')
      window.speechSynthesis.speak(utterance)
    }
  } catch (_) { }
  try {
    const audio = new Audio()
    audio.play().catch(() => { })
  } catch (_) { }
}

const VoiceMessageBubble = ({ audioUrl, duration, text }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration || 0)
  const audioRef = useRef(null)

  useEffect(() => {
    // We intentionally DO NOT revoke the audioUrl here.
    // The parent component created it and React StrictMode or list re-renders 
    // can cause premature unmounting, leading to ERR_FILE_NOT_FOUND if revoked here.
  }, [audioUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(e => console.warn("Audio play interrupted:", e))
    }
  }

  const formatTime = (seconds) => {
    const s = Math.floor(seconds)
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[280px]">
      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => { setIsPlaying(false); setCurrentTime(0) }}
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            onLoadedMetadata={(e) => setTotalDuration(e.target.duration || duration || 0)}
          />
          <div className="flex items-center gap-2.5">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 text-white cursor-pointer flex items-center justify-center flex-shrink-0 text-sm transition-all active:scale-95"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <div className="flex-1 flex flex-col gap-1">
              {/* Waveform bars */}
              <div className="flex items-center gap-[2px] h-6 relative flex-shrink-0">
                {Array.from({ length: 28 }, (_, i) => {
                  const heights = [4, 8, 14, 10, 18, 12, 6, 16, 10, 20, 8, 14, 18, 6, 12, 16, 10, 20, 8, 14, 18, 10, 6, 16, 12, 8, 14, 4]
                  const h = heights[i] || 8
                  const barProgress = (i / 28) * 100
                  const filled = barProgress <= progressPercent
                  return (
                    <div
                      key={i}
                      style={{ height: `${h}px` }}
                      className={`w-[3px] rounded-sm transition-all duration-100 flex-shrink-0 ${filled ? 'bg-white/90' : 'bg-white/30'}`}
                    />
                  )
                })}
              </div>

              {/* Time */}
              <div className="text-[10px] text-white/80 font-medium tracking-wide tabular-nums">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transcribed text below the player */}
      {text && (
        <div className="text-xs md:text-sm text-white/90 mt-1 border-t border-white/20 pt-1.5 leading-relaxed">
          🎤 {text}
        </div>
      )}
    </div>
  )
}

const extractSuggestions = (content) => {
  if (!content || typeof content !== 'string') return [];
  const match = content.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i);
  if (match && match[1]) {
    return match[1].split('|').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const stripSuggestions = (content) => {
  if (!content || typeof content !== 'string') return "";
  let clean = content.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/gi, "");
  const index = clean.indexOf('[SUGGESTIONS]');
  if (index !== -1) {
    clean = clean.substring(0, index);
  }
  return clean.trim();
};

const renderMessageContent = (content) => {
  const cleanText = stripSuggestions(content);
  if (!cleanText) return null;

  // Clean raw bullet markers (*, -, •) that clutter output or appear outside/inside tags
  let cleanContent = cleanText;
  // 1. Remove markdown bullets followed by [BULLET]
  cleanContent = cleanContent.replace(/(?:^|\n)\s*(?:[\-•\u2022]|\*(?!\*))\s*(\[BULLET\])/g, '\n$1');
  // 2. Remove [BULLET] followed by markdown bullets inside the tag (avoid swallowing first char of bold **)
  cleanContent = cleanContent.replace(/\[BULLET\]\s*(?:[\-•\u2022]|\*(?!\*))\s*/g, '[BULLET]');
  // 3. Remove standalone bullet lines
  cleanContent = cleanContent.split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed !== '*' && trimmed !== '-' && trimmed !== '•' && trimmed !== '\u2022';
    })
    .join('\n');

  // Split content by disclaimer and bullet tag pairs
  const regex = /(\[DISCLAIMER\][\s\S]*?\[\/DISCLAIMER\]|\[BULLET\][\s\S]*?\[\/BULLET\])/g;
  const parts = cleanContent.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('[DISCLAIMER]') && part.endsWith('[/DISCLAIMER]')) {
      const text = part.slice(12, -13);
      return (
        <div key={index} className="message-disclaimer flex items-start gap-2 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 text-xs md:text-sm text-amber-800 mb-4 shadow-sm font-medium leading-relaxed">
          <strong>Disclaimer:</strong> {text}
        </div>
      );
    } else if (part.startsWith('[BULLET]') && part.endsWith('[/BULLET]')) {
      const text = part.slice(8, -9);
      const boldRegex = /\*\*(.*?)\*\*/g;
      const subParts = text.split(boldRegex);
      const formattedText = subParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          return <strong key={subIndex}>{subPart}</strong>;
        }
        return subPart;
      });
      return (
        <div key={index} className="message-bullet-item pl-2 mb-2 text-slate-700 leading-relaxed text-sm md:text-base">
          • {formattedText}
        </div>
      );
    } else {
      // Handle half-open tags during streaming to avoid displaying raw bracket tags
      let textToRender = part;
      let isHalfOpenDisclaimer = false;
      let isHalfOpenBullet = false;

      if (textToRender.includes('[DISCLAIMER]')) {
        isHalfOpenDisclaimer = true;
        textToRender = textToRender.replace('[DISCLAIMER]', '').replace('[/DISCLAIMER]', '');
      }
      if (textToRender.includes('[BULLET]')) {
        isHalfOpenBullet = true;
        textToRender = textToRender.replace('[BULLET]', '').replace('[/BULLET]', '');
      }

      if (isHalfOpenDisclaimer) {
        return (
          <div key={index} className="message-disclaimer flex items-start gap-2 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 text-xs md:text-sm text-amber-800 mb-4 shadow-sm font-medium leading-relaxed">
            <strong>Disclaimer:</strong> {textToRender}
          </div>
        );
      }

      if (isHalfOpenBullet) {
        const boldRegex = /\*\*(.*?)\*\*/g;
        const subParts = textToRender.split(boldRegex);
        const formattedText = subParts.map((subPart, subIndex) => {
          if (subIndex % 2 === 1) {
            return <strong key={subIndex}>{subPart}</strong>;
          }
          return subPart;
        });
        return (
          <div key={index} className="message-bullet-item pl-2 mb-2 text-slate-700 leading-relaxed text-sm md:text-base">
            • {formattedText}
          </div>
        );
      }

      const boldRegex = /\*\*(.*?)\*\*/g;
      const lines = textToRender.split('\n');
      return lines.map((line, lineIndex) => {
        const lineParts = line.split(boldRegex);
        const formattedLine = lineParts.map((linePart, subIndex) => {
          if (subIndex % 2 === 1) {
            return <strong key={subIndex}>{linePart}</strong>;
          }
          return linePart;
        });

        return (
          <span key={`${lineIndex}`} style={{ display: 'block', minHeight: line.trim() === '' ? '0.8em' : 'auto' }} className="text-slate-800 text-sm md:text-base leading-relaxed mb-1.5">
            {formattedLine}
          </span>
        );
      });
    }
  });
};

const StreamingMessage = ({ content, streaming, onComplete }) => {
  const [displayedWords, setDisplayedWords] = useState([]);
  const wordQueueRef    = useRef([]);   // words waiting to be shown
  const streamingRef    = useRef(streaming);
  const onCompleteRef   = useRef(onComplete);
  const prevContentRef  = useRef('');

  // Keep refs in sync with latest props
  streamingRef.current  = streaming;
  onCompleteRef.current = onComplete;

  // Whenever the parent appends new content, split the diff into words
  // and push them onto the queue — the interval drains the queue one
  // word per tick regardless of how fast new content arrives.
  useEffect(() => {
    const prev = prevContentRef.current;
    const curr = content || '';
    if (curr.length > prev.length) {
      const newText = curr.slice(prev.length);
      // Split on whitespace, keep separators so spacing is preserved
      const tokens = newText.split(/(\s+)/).filter(Boolean);
      wordQueueRef.current.push(...tokens);
    }
    prevContentRef.current = curr;
  }, [content]);

  // Drain one token per tick at a fixed Gemini-like rhythm (55 ms / word)
  useEffect(() => {
    const id = setInterval(() => {
      if (wordQueueRef.current.length > 0) {
        const next = wordQueueRef.current.shift();
        setDisplayedWords(prev => [...prev, next]);
      } else if (!streamingRef.current) {
        // Queue empty + stream finished → done
        clearInterval(id);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, 15);  // ← 15ms/word ≈ 0.9-1.5 s for a typical reply
    return () => clearInterval(id);
  }, []);

  const displayedContent = displayedWords.join('');

  return (
    <>
      {renderMessageContent(displayedContent)}
      {streaming && (
        <span className="streaming-cursor" aria-hidden="true" />
      )}
    </>
  );
};


const MedicalLoader = () => (
  <div className="medical-loader-container">
    <div className="medical-loader-heart-wrapper">
      <svg className="medical-loader-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="heart-ecg-mask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <path
              d="M 5 50 H 30 L 36 38 L 42 62 L 48 20 L 54 80 L 60 45 L 66 56 L 72 50 H 95"
              fill="none"
              stroke="black"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        <path
          d="M 50 20 C 38 2, 8 10, 8 39.5 C 8 69, 50 92, 50 92 C 50 92, 92 69, 92 39.5 C 92 10, 62 2, 50 20 Z"
          fill="#000000"
          mask="url(#heart-ecg-mask)"
        />
        <path
          className="ecg-pulse-line"
          d="M 5 50 H 30 L 36 38 L 42 62 L 48 20 L 54 80 L 60 45 L 66 56 L 72 50 H 95"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.25 }}
        />
        <path
          className="ecg-pulse-line-active"
          d="M 5 50 H 30 L 36 38 L 42 62 L 48 20 L 54 80 L 60 45 L 66 56 L 72 50 H 95"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  </div>
);

const getLangAbbreviation = (lang) => {
  const map = {
    English: 'EG',
    Hindi: 'HI',
    Kannada: 'KA',
    Tamil: 'TA',
    Telugu: 'TE',
    Malayalam: 'ML'
  }
  return map[lang] || 'EG'
}


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

  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraDevices, setCameraDevices] = useState([])
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState("")

  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const attachmentMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [voiceError, setVoiceError] = useState(null)
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0)  // seconds
  const [isTranscribing, setIsTranscribing] = useState(false)      // waiting for server
  const [audioVolume, setAudioVolume] = useState(0)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  const [audioDevices, setAudioDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('rural_mic_device_id') || '')
  const [showDeviceSelector, setShowDeviceSelector] = useState(false)
  const micSettingsDropdownRef = useRef(null)

  // Hospital Finder State
  const [showHospitalFinder, setShowHospitalFinder] = useState(false)
  const [hospitalEmergencyLevel, setHospitalEmergencyLevel] = useState(null)

  // Conversation management state
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [conversationsRefreshTrigger, setConversationsRefreshTrigger] = useState(0)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('rural_sidebar_collapsed')
    if (saved !== null) return saved === 'true'
    return window.innerWidth < 1024
  })

  useEffect(() => {
    localStorage.setItem('rural_sidebar_collapsed', isSidebarCollapsed)
  }, [isSidebarCollapsed])

  const languageDropdownRef = useRef(null)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

  const loadAudioDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(audioInputs)

      // If we don't have a selected device yet, pick the first one with a valid ID
      if (audioInputs.length > 0 && !localStorage.getItem('rural_mic_device_id')) {
        const defaultDev = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0]
        setSelectedDeviceId(defaultDev.deviceId)
      }
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e)
    }
  }

  useEffect(() => {
    loadAudioDevices()
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices)
    }
    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices)
      }
    }
  }, [])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target)) {
        setShowLanguageDropdown(false)
      }
      if (micSettingsDropdownRef.current && !micSettingsDropdownRef.current.contains(e.target)) {
        setShowDeviceSelector(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])


  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)
  const abortControllerRef = useRef(null)
  const fileInputRef = useRef(null)
  const docFileInputRef = useRef(null)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const hasLoadedInitialConversation = useRef(false)
  const timerRef = useRef(null)    // interval for recording timer
  const cameraVideoRef = useRef(null)
  const cameraStreamRef = useRef(null)

  // ✅ Voice Recording Ref
  const mediaRecorderRef = useRef(null)
  const utteranceRef = useRef(null)

  const languages = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setVoiceRecordingTime(0)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { })
    }
    setAudioVolume(0)

    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop()
      } catch (e) {
        console.warn('[Voice] stop() error:', e)
        setIsListening(false)
        setIsTranscribing(false)
      }
    } else {
      setIsListening(false)
      setIsTranscribing(false)
    }
  }

  const toggleVoiceInput = async () => {
    unlockAudio()

    if (isListening || isTranscribing) {
      stopRecording()
      return
    }

    setVoiceError(null)

    let stream
    try {
      const constraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      }
      stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Enumerate devices again to obtain labels (since permissions are now granted)
      loadAudioDevices()

      // Start Volume Visualizer
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        audioContextRef.current = audioCtx
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const updateVolume = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const average = sum / dataArray.length
          setAudioVolume(Math.min(100, Math.round((average / 255) * 100 * 2.0)))
          animationFrameRef.current = requestAnimationFrame(updateVolume)
        }
        updateVolume()
      } catch (e) {
        console.warn('Could not initialize audio visualizer:', e)
      }

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('🔒 Mic blocked — click the lock icon in your address bar and allow microphone.')
      } else if (err.name === 'NotFoundError') {
        setVoiceError('🎤 No microphone found. Please connect one.')
      } else {
        setVoiceError('Cannot access microphone: ' + err.message)
      }
      return
    }

    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ].find(t => {
      try { return MediaRecorder.isTypeSupported(t) } catch { return false }
    }) || ''

    let mediaRecorder
    try {
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    } catch (e) {
      try {
        mediaRecorder = new MediaRecorder(stream)
      } catch (e2) {
        setVoiceError('Recording not supported in this browser.')
        stream.getTracks().forEach(t => t.stop())
        return
      }
    }

    const audioChunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setVoiceRecordingTime(0)
      setIsListening(false)

      const totalSize = audioChunks.reduce((sum, c) => sum + c.size, 0)
      console.log('[Voice] Captured:', totalSize, 'bytes in', audioChunks.length, 'chunks')

      if (audioChunks.length === 0 || totalSize < 500) {
        setIsTranscribing(false)
        setVoiceError('Recording too short. Hold the mic button and speak clearly for at least 2 seconds.')
        return
      }

      const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm'
      const ext = actualMime.includes('ogg') ? 'ogg'
        : actualMime.includes('mp4') ? 'mp4'
          : 'webm'
      const audioBlob = new Blob(audioChunks, { type: actualMime })

      setIsTranscribing(true)
      setVoiceError(null)

      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, `voice.${ext}`)
        formData.append('language', language)
        formData.append('selected_language', language)
        formData.append('user_id', isAuthenticated ? (currentUser?.id || '') : userId)

        console.log('[Voice] Sending:', actualMime, audioBlob.size, 'bytes, lang:', language)

        const response = await fetch(`${API_BASE_URL}/voice/transcribe/`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Server error ${response.status}: ${errText.slice(0, 200)}`)
        }

        const data = await response.json()
        console.log('[Voice] Server response:', data)

        setIsTranscribing(false)

        if (data.success && data.text && data.text.trim().length > 1) {
          if (data.language && data.language !== language) {
            setLanguage(data.language)
            setDetectedLanguage(data.language)
          }
          setIsTranscribing(false)
          handleSendVoiceMessage(data.text.trim(), data.language || language, audioBlob, voiceRecordingTime)
        } else {
          const errMsg = data.error || 'Could not understand. Please speak clearly and try again.'
          console.warn('[Voice] Transcription failed:', errMsg)
          setVoiceError(errMsg)
        }
      } catch (error) {
        setIsTranscribing(false)
        console.error('[Voice] Fetch error:', error)
        if (error.message.includes('Server error')) {
          setVoiceError('Server error. Check Django logs.')
        } else {
          setVoiceError('Connection error. Please check your internet and try again.')
        }
      }
    }

    mediaRecorder.onerror = (event) => {
      console.error('[Voice] MediaRecorder error:', event.error)
      stream.getTracks().forEach(t => t.stop())
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setVoiceRecordingTime(0)
      setIsListening(false)
      setIsTranscribing(false)
      setVoiceError('Recording error. Please try again.')
    }

    mediaRecorderRef.current = mediaRecorder

    // Start recording without timeslice to ensure a single, valid Blob
    mediaRecorder.start()
    setIsListening(true)
    setVoiceRecordingTime(0)

    timerRef.current = setInterval(() => {
      setVoiceRecordingTime(prev => prev + 1)
    }, 1000)

    console.log('[Voice] Recording started:', mediaRecorder.mimeType)
  }


  const handleSendVoiceMessage = async (text, voiceLanguage = null, audioBlob = null, audioDuration = 0) => {
    if (!text || isLoading) return

    setInputMessage('')
    setIsLoading(true)

    const msgLanguage = voiceLanguage || language

    const userMsgId = Date.now()

    // Create local audio URL for playback
    let localAudioUrl = null
    if (audioBlob) {
      localAudioUrl = URL.createObjectURL(audioBlob)
    }

    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        isVoice: true,
        audioUrl: localAudioUrl,
        audioDuration: audioDuration,
      }
    ])

    abortControllerRef.current = new AbortController()

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`${API_BASE_URL}/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          msg: text,
          user_id: isAuthenticated ? currentUser.id : userId,
          language: msgLanguage,
          conversation_id: currentConversationId,
          is_voice: true,
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
              if (fullResponseText.trim()) {
                setTimeout(() => {
                  readAloud(fullResponseText, assistantMsgId)
                }, 500)
              }
              break
            }
          } catch (_) { }
        }
      }
      try { reader.releaseLock() } catch (_) { }

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

  const cleanTextForSpeech = (rawText) => {
    if (!rawText) return "";
    let clean = rawText;

    // Remove tags
    clean = clean.replace(/\[\/?BULLET\]/gi, "");
    clean = clean.replace(/\[\/?DISCLAIMER\]/gi, "");

    // Remove markdown bold/italic formatting symbols
    clean = clean.replace(/\*\*|__|\*|_/g, "");

    // Remove leading bullets/symbols (•, -, *) at the start of lines/sentences
    clean = clean.replace(/(?:^|\n)\s*[•\-\*\u2022]\s*/g, "\n");

    // Clean up any remaining double spaces or trailing whitespace
    clean = clean.replace(/ {2,}/g, " ").trim();

    return clean;
  };

  const readAloud = async (text, id) => {
    try {
      const cleanText = cleanTextForSpeech(text);
      if (!cleanText) return;

      // Stop existing speech
      if (speakingId === id) {
        stopSpeaking();
        return;
      }

      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      setTtsLoadingId(id);
      setSpeakingId(null);

      // Detect language on-the-fly based on text characters to be 100% correct across all languages
      let ttsLanguage = detectedLanguage || language;
      if (cleanText) {
        if (/[\u0900-\u097F]/.test(cleanText)) {
          ttsLanguage = 'Hindi';
        } else if (/[\u0B80-\u0BFF]/.test(cleanText)) {
          ttsLanguage = 'Tamil';
        } else if (/[\u0C00-\u0C7F]/.test(cleanText)) {
          ttsLanguage = 'Telugu';
        } else if (/[\u0C80-\u0CFF]/.test(cleanText)) {
          ttsLanguage = 'Kannada';
        } else if (/[\u0D00-\u0D7F]/.test(cleanText)) {
          ttsLanguage = 'Malayalam';
        }
      }
      console.log("[Voice] Speaking text language detected/mapped:", ttsLanguage);

      // ✅ TRY WEB SPEECH SYNTHESIS FIRST (For English and Hindi only to guarantee performance, fall back to server gTTS for other languages to ensure high-quality pronunciation and full reading)
      if ('speechSynthesis' in window) {
        try {
          // Force server-side TTS fallback for Kannada, Tamil, Telugu, and Malayalam
          if (ttsLanguage !== 'English' && ttsLanguage !== 'Hindi') {
            throw new Error(`Force server-side high-quality TTS for ${ttsLanguage}`);
          }

          // Stop any existing speech
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(cleanText);
          utteranceRef.current = utterance;

          // Map language to voice
          const langMap = {
            'English': 'en-US',
            'Hindi': 'hi-IN'
          };

          utterance.lang = langMap[ttsLanguage] || 'en-US';
          utterance.rate = 0.9; // Slightly slower for better clarity
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          // Select best voice for language
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(voice =>
            voice.lang.startsWith(utterance.lang.split('-')[0])
          );
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }

          // Chrome SpeechSynthesis garbage collection and 15s timeout workaround
          const resumeInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && utteranceRef.current === utterance) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            } else {
              clearInterval(resumeInterval);
            }
          }, 10000);

          utterance.onend = () => {
            clearInterval(resumeInterval);
            if (utteranceRef.current === utterance) {
              setSpeakingId(null);
              utteranceRef.current = null;
            }
          };

          utterance.onerror = (event) => {
            clearInterval(resumeInterval);
            if (utteranceRef.current === utterance) {
              if (event.error === 'interrupted' || event.error === 'canceled') {
                setSpeakingId(null);
                utteranceRef.current = null;
                return;
              }
              console.warn('[Voice] Synthesis error:', event.error);
              setSpeakingId(null);
              utteranceRef.current = null;
            }
          };

          window.speechSynthesis.speak(utterance);
          setSpeakingId(id);
          setTtsLoadingId(null);
          return;
        } catch (synthError) {
          console.warn('[Voice] Web Speech Synthesis failed or bypassed, falling back to server TTS:', synthError.message);
        }
      }

      // ✅ FALLBACK: Server-based TTS (gTTS)
      const response = await voiceAPI.textToSpeech(cleanText, ttsLanguage);

      if (!response?.success || !response?.audio) {
        throw new Error("Failed to generate speech");
      }

      const audio = new Audio(`data:audio/mp3;base64,${response.audio}`);
      audioRef.current = audio;

      audio.onended = () => {
        setSpeakingId(null);
      };

      audio.onerror = (e) => {
        console.error("Audio error:", e);
        setSpeakingId(null);
      };

      await audio.play();
      setSpeakingId(id);

    } catch (error) {
      console.error("TTS error:", error);
      setSpeakingId(null);
    } finally {
      setTtsLoadingId(null);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setSpeakingId(null);
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setSpeakingId(null);
    }
  };

  // PERSISTENCE - Save/Load current conversation
  const STORAGE_KEY = 'rural_current_conversation'

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
    } else {
      loadLastConversation()
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadLastConversation()
    }
  }, [isAuthenticated, currentUser])

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
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    if (isCameraActive && cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause()
          audioRef.current.src = ""
        } catch (e) { }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.stop() } catch (_) { }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (cameraStreamRef.current) {
        try {
          cameraStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) { }
      }
    }
  }, [])

  const handleSelectConversation = async (conversationId, isAutoLoad = false) => {
    if (conversationId === currentConversationId && messages.length > 0) {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true)
      }
      return
    }

    removeImage()
    setCurrentConversationId(conversationId)
    setMessages([])
    setDetectedLanguage(null)
    setIsLoadingConversation(true)
    
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true)
    }

    try {
      const requestUserId = isAuthenticated ? currentUser.id : userId
      const url = `http://localhost:8000/api/conversations/${conversationId}/?user_id=${requestUserId}`

      const token = localStorage.getItem('accessToken')
      const response = await fetch(url, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        }
      })

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
        const loadedMessages = data.messages.map(msg => {
          let imageUrl = null
          if (msg.has_image && msg.image_description) {
            imageUrl = msg.image_description.startsWith('http') 
              ? msg.image_description 
              : `http://localhost:8000${msg.image_description}`
          }
          return {
            id: msg.id,
            role: msg.role,
            content: msg.message,
            timestamp: new Date(msg.created_at),
            has_image: msg.has_image,
            image_description: msg.image_description,
            image: imageUrl
          }
        })

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
    removeImage()
    setCurrentConversationId(null)
    setMessages([])
    setDetectedLanguage(null)
    setLanguage("English")
    localStorage.removeItem(STORAGE_KEY)
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true)
    }
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
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDocumentSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Document must be less than 10 MB")
        return
      }
      setSelectedDocument(file)
      setSelectedImage(null)
      setImagePreview(null)
    }
  }

  const removeDocument = () => {
    setSelectedDocument(null)
    if (docFileInputRef.current) {
      docFileInputRef.current.value = ""
    }
  }

  const isDocumentFile = (fileUrl) => {
    if (!fileUrl) return false
    const urlLower = String(fileUrl).toLowerCase()
    return urlLower.endsWith('.pdf') || urlLower.endsWith('.doc') || urlLower.endsWith('.docx') || urlLower.endsWith('.txt')
  }

  const getFileName = (fileUrl) => {
    if (!fileUrl) return 'Document'
    try {
      const parts = fileUrl.split('/')
      const nameWithUuid = parts[parts.length - 1]
      const underscoreIndex = nameWithUuid.indexOf('_')
      if (underscoreIndex !== -1) {
        return nameWithUuid.substring(underscoreIndex + 1)
      }
      return nameWithUuid
    } catch (e) {
      return 'Document'
    }
  }

  const getDocumentInfo = (msg) => {
    if (msg.documentUrl) {
      return { url: msg.documentUrl, name: msg.documentName || "Document" }
    }
    if (msg.image) {
      const urlLower = String(msg.image).toLowerCase()
      if (urlLower.endsWith('.pdf') || urlLower.endsWith('.doc') || urlLower.endsWith('.docx') || urlLower.endsWith('.txt')) {
        return { url: msg.image, name: getFileName(msg.image) }
      }
    }
    return null
  }

  const startCamera = async () => {
    try {
      if (cameraStream) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      setCameraStream(stream);
      setIsCameraActive(true);

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          const currentId = selectedCameraDeviceId || videoDevices[0].deviceId;
          setSelectedCameraDeviceId(currentId);
        }
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Could not access camera. Please check camera permissions in your browser.");
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  }

  const switchCamera = async (deviceId) => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      setSelectedCameraDeviceId(deviceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.error("Switch camera error:", err);
    }
  }

  const capturePhoto = () => {
    if (cameraVideoRef.current) {
      const video = cameraVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
          setSelectedImage(file);
          setImagePreview(URL.createObjectURL(file));
        }
        stopCamera();
      }, 'image/jpeg', 0.95);
    }
  }

  const handleStopMessage = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch (e) {}
    }
    setIsLoading(false)
    setMessages(prev =>
      prev.map(msg =>
        msg.role === 'assistant' && (!msg.sseComplete || msg.displayed === false)
          ? { ...msg, sseComplete: true, displayed: true }
          : msg
      )
    )
  }

  const handleSendMessage = async (customText = null) => {
    const isCustomText = customText && typeof customText === 'string';
    const textToSend = isCustomText ? customText : inputMessage.trim();
    if ((!textToSend && !selectedImage && !selectedDocument) || isLoading) return
    // Block new messages while the animation is still playing
    if (messages.some(m => m.displayed === false)) return

    const userMessage = textToSend || (selectedDocument ? `Please analyze the uploaded document: ${selectedDocument.name}` : "Please analyze this medical image")
    if (!isCustomText) {
      setInputMessage("")
    }
    setIsLoading(true)

    // Capture file states to local variables
    const imageToSend = selectedImage
    const imagePreviewToSend = imagePreview
    const documentToSend = selectedDocument

    // Clear UI state immediately so the preview thumbnail collapses/disappears instantly
    setImagePreview(null)
    setSelectedImage(null)
    setSelectedDocument(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (docFileInputRef.current) {
      docFileInputRef.current.value = ""
    }

    const userMsgId = Date.now()
    const assistantMsgId = userMsgId + 1

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
        image: imagePreviewToSend,
        documentUrl: documentToSend ? URL.createObjectURL(documentToSend) : null,
        documentName: documentToSend ? documentToSend.name : null,
        timestamp: new Date(),
      },
    ])

    // ── UPLOAD: Show instant acknowledgement before the fetch ──
    if (imageToSend || documentToSend) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          streaming: true,
          sseComplete: false,   // network stream done?
          displayed: false,     // animation done?
          isImageAnalysis: !!imageToSend,
          isDocumentAnalysis: !!documentToSend,
        },
      ])
    }

    abortControllerRef.current = new AbortController()

    try {
      let response
      const token = localStorage.getItem('accessToken')

      if (imageToSend || documentToSend) {
        const formData = new FormData()
        formData.append('msg', userMessage)
        formData.append('user_id', isAuthenticated ? currentUser.id : userId)
        formData.append('language', language)
        formData.append('image', imageToSend || documentToSend)
        formData.append('elaborate', 'false')

        if (currentConversationId) {
          formData.append('conversation_id', currentConversationId)
        }

        response = await fetch(`${API_BASE_URL}/chat/image/`, {
          method: 'POST',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: formData,
          signal: abortControllerRef.current.signal,
        })
      } else {
        response = await fetch(`${API_BASE_URL}/chat/stream/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
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
      removeDocument()
      setUploadProgress(0)

      if (!response || !response.body) {
        throw new Error("No response from server")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let assistantMessage = ""

      // For text-only messages, inject the assistant bubble now
      if (!imageToSend && !documentToSend) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            streaming: true,
            sseComplete: false,   // network stream done?
            displayed: false,     // animation done?
          },
        ])
      }

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
              // Mark SSE network as complete — StreamingMessage will keep
              // draining its word queue at 130ms/word, then call onComplete
              // which sets displayed:true and switches to static render.
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, sseComplete: true }
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
      } catch (e) { }

      // For file upload endpoint: mark SSE complete after reading full body
      if ((imageToSend || documentToSend) && assistantMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, sseComplete: true }
              : msg
          )
        )
        setConversationsRefreshTrigger(prev => prev + 1)
      }

      if (!assistantMessage.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                ...msg,
                content: "Sorry, I couldn't generate a response. Please try again.",
                error: true,
                sseComplete: true,
                displayed: true,   // show immediately, no animation
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

      // Remove the analysis placeholder on error and show error message
      setMessages((prev) => [
        ...prev.filter(msg => msg.id !== assistantMsgId),
        {
          id: Date.now() + 2,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
          error: true,
          displayed: true,   // show immediately, no animation
        },
      ])
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      removeImage()
      removeDocument()
      setUploadProgress(0)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Don't send while the bot is still typing out its reply
      if (!isLoading && !messages.some(m => m.displayed === false)) {
        handleSendMessage()
      }
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

  const isLastAssistantMessage = (index) => {
    for (let i = index + 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant') {
        return false
      }
    }
    return true
  }

  // True while any assistant message is still typing out word-by-word.
  // Used to lock the input until the animation fully completes.
  const isAnimating = messages.some(m => m.displayed === false)

  return (
    <div className="chat-container-wrapper flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      {isAuthenticated && (
        <ConversationSidebar
          currentConversationId={currentConversationId}
          onSelectConversation={(id) => handleSelectConversation(id, false)}
          onNewConversation={handleNewConversation}
          userId={currentUser?.id}
          refreshTrigger={conversationsRefreshTrigger}
          language={language}
          languages={languages}
          onLanguageChange={(lang) => { setLanguage(lang); setDetectedLanguage(null); }}
          detectedLanguage={detectedLanguage}
          isLoading={isLoading}
          onGenerateReport={() => setShowHealthReportModal(true)}
          canGenerateReport={!!(currentConversationId && messages.length > 0)}
          currentUser={currentUser}
          isAuthenticated={isAuthenticated}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />
      )}

      <div className="chat-container flex-1 min-w-0 flex flex-col h-screen relative bg-gray-50">

        <div className={`chat-header bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-slate-100 flex flex-row justify-between items-center shadow-sm sticky top-0 z-30 w-full flex-shrink-0 ${isAuthenticated ? 'flex lg:hidden' : 'flex'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {isAuthenticated && (
              <button
                className="text-gray-600 hover:text-green-600 focus:outline-none lg:hidden flex-shrink-0 mr-1"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Open sidebar"
              >
                <FaBars size={18} />
              </button>
            )}
            <div className="w-9 h-9 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <FaRobot size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm md:text-base font-bold text-gray-900 leading-tight truncate">AI Medical Assistant</h1>
              <p className="text-[10px] md:text-xs text-gray-500 leading-none">Always here to help</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {detectedLanguage && detectedLanguage !== language && (
              <div className="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-[10px] md:text-xs font-semibold flex items-center gap-1.5 animate-slideInLanguage whitespace-nowrap">
                <FaGlobe size={11} />
                <span className="hidden xs:inline">Detected: </span><span>{detectedLanguage}</span>
              </div>
            )}
            <div className="relative inline-block" ref={languageDropdownRef}>
              <button
                className="px-2.5 py-1.5 border border-gray-200 rounded-full bg-white text-xs text-gray-800 font-semibold flex items-center justify-between gap-1.5 hover:border-green-600 hover:bg-gray-50 focus:outline-none shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => setShowLanguageDropdown(prev => !prev)}
                disabled={isLoading}
              >
                <div className="flex items-center gap-1">
                  <FaGlobe className="text-green-600 mt-0.5" size={12} />
                  <span className="font-bold text-[9px] md:text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">{getLangAbbreviation(language)}</span>
                </div>
                <FaChevronDown size={8} className={`transition-transform duration-200 text-gray-500 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showLanguageDropdown && (
                <div className="absolute top-[calc(100%+6px)] right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 min-w-[120px] animate-[dropdownFadeIn_0.15s_ease-out]">
                  {languages.map((lang) => (
                    <div
                      key={lang}
                      className={`px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-green-600 cursor-pointer text-left transition-colors duration-150 ${lang === language ? 'bg-green-50 text-green-700' : ''}`}
                      onClick={() => {
                        setLanguage(lang)
                        setDetectedLanguage(null)
                        setShowLanguageDropdown(false)
                      }}
                    >
                      {lang}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="chat-messages flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-6 pb-40 flex flex-col items-center gap-6 w-full scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-slate-50/50">
          {isLoadingConversation ? (
            <div className="loading-conversation flex flex-col items-center justify-center py-16 px-5 text-center text-gray-500">
              <MedicalLoader />
              <p className="text-sm md:text-base text-gray-400 mt-4">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto my-auto animate-[fadeInUp_0.4s_ease-out]">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-600/10">
                <FaRobot size={36} />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-3">AI Medical Assistant</h2>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed max-w-sm mb-8">
                Ask questions about symptoms, medications, or wellness. Upload scans or medical images for instant AI analysis.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                <button 
                  onClick={() => handleSendMessage("What are common symptoms of seasonal allergies?")}
                  className="px-4 py-3 bg-white hover:bg-green-50/50 border border-slate-100 hover:border-green-200 text-slate-700 hover:text-green-700 rounded-xl text-xs md:text-sm font-medium transition-all duration-250 shadow-sm text-left flex items-start gap-2.5"
                >
                  <span className="text-green-600">💡</span> Seasonal allergy symptoms?
                </button>
                <button 
                  onClick={() => handleSendMessage("How can I improve my daily water intake and hydration?")}
                  className="px-4 py-3 bg-white hover:bg-green-50/50 border border-slate-100 hover:border-green-200 text-slate-700 hover:text-green-700 rounded-xl text-xs md:text-sm font-medium transition-all duration-250 shadow-sm text-left flex items-start gap-2.5"
                >
                  <span className="text-green-600">💧</span> Tips for daily hydration?
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              msg.role === "user" ? (
                // ── USER bubble (no avatar, pill-shaped) ──
                <div
                  key={msg.id}
                  className={`w-full max-w-3xl flex gap-3 md:gap-4 mb-2 justify-end animate-[fadeInUp_0.3s_ease-out] ${msg.error ? 'message-error' : ''}`}
                >
                  <div className={`${(msg.image || getDocumentInfo(msg)) ? 'has-image-bubble bg-transparent shadow-none p-0 border-none flex flex-col items-end gap-2' : 'bg-gradient-to-br from-green-600 to-green-800 text-white rounded-2xl border-none shadow-none w-fit max-w-[75%] ml-auto text-sm py-2.5 px-4 leading-relaxed break-words'}`}>
                    {getDocumentInfo(msg) ? (
                      <div className="message-document-attachment mb-2 w-full">
                        <div className="document-attachment-box flex items-center gap-3.5 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-xl p-3 transition-all duration-200 max-w-full cursor-pointer shadow-sm">
                          <FaFileMedical size={28} className="doc-icon text-red-500 flex-shrink-0" />
                          <div className="doc-info flex flex-col gap-1 min-w-0 flex-1">
                            <span className="doc-name text-sm font-semibold text-white truncate">{getDocumentInfo(msg).name}</span>
                            <a href={getDocumentInfo(msg).url} target="_blank" rel="noopener noreferrer" className="doc-download-link text-xs font-semibold text-sky-300 hover:text-sky-200 underline mt-1 inline-block">
                              Open Document
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : msg.image ? (
                      <div className="message-image rounded-xl overflow-hidden max-w-full shadow-sm border border-gray-100">
                        <img className="w-full h-auto block max-h-[300px] md:max-h-[400px] object-contain bg-gray-50" src={msg.image} alt="Medical scan" />
                      </div>
                    ) : null}
                    {msg.isVoice && msg.audioUrl ? (
                      <VoiceMessageBubble
                        audioUrl={msg.audioUrl}
                        duration={msg.audioDuration}
                        text={msg.content}
                      />
                    ) : (msg.image || getDocumentInfo(msg)) ? (
                      <div className="user-text-content bg-gradient-to-br from-green-600 to-green-800 text-white rounded-2xl py-2.5 px-4 text-sm leading-relaxed w-fit shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      renderMessageContent(msg.content)
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`w-full max-w-3xl flex flex-col mb-6 pb-6 border-b border-slate-100 last:border-b-0 animate-[fadeInUp_0.3s_ease-out] ${msg.error ? 'bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600' : ''}`}
                >
                  {/* ── Assistant content: no card, raw text ── */}
                  <div className="assistant-message-content text-gray-800 text-sm md:text-[15px] leading-relaxed break-words w-full">
                    {msg.streaming && !msg.content ? (
                      <div className="streaming-loader-container flex items-center gap-2.5 py-1">
                        <MedicalLoader />
                        {msg.isImageAnalysis ? (
                          <span className="streaming-text-pulse image-analysis-pulse text-green-700 font-semibold text-sm">
                            🔍 Analyzing image, please wait
                            <span className="dot-anim">.</span>
                            <span className="dot-anim" style={{ animationDelay: '0.3s' }}>.</span>
                            <span className="dot-anim" style={{ animationDelay: '0.6s' }}>.</span>
                          </span>
                        ) : msg.isDocumentAnalysis ? (
                          <span className="streaming-text-pulse image-analysis-pulse text-green-700 font-semibold text-sm">
                            📄 Analyzing document, please wait
                            <span className="dot-anim">.</span>
                            <span className="dot-anim" style={{ animationDelay: '0.3s' }}>.</span>
                            <span className="dot-anim" style={{ animationDelay: '0.6s' }}>.</span>
                          </span>
                        ) : (
                          <span className="streaming-text-pulse text-gray-500 text-sm font-medium animate-[text-pulse-opacity_1.4s_infinite_ease-in-out]">Analyzing...</span>
                        )}
                      </div>
                    ) : msg.displayed === false ? (
                      <StreamingMessage
                        content={msg.content}
                        streaming={!msg.sseComplete}
                        onComplete={() => {
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.id === msg.id
                                ? { ...m, displayed: true }
                                : m
                            )
                          )
                        }}
                      />
                    ) : (
                      renderMessageContent(msg.content)
                    )}
                  </div>

                  {/* ── Action buttons: Copy + Read — always below content ── */}
                  {msg.content && msg.displayed && (
                    <>
                      <div className="message-actions flex gap-1 mt-3">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className={`action-btn flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all duration-150 border border-transparent hover:border-green-100 ${copiedId === msg.id ? 'text-green-600 bg-green-50 border-green-100' : ''}`}
                        >
                          {copiedId === msg.id ? <><FaCheck size={12} /> Copied!</> : <><FaCopy size={12} /> Copy</>}
                        </button>

                        <button
                          onClick={() => speakingId === msg.id ? stopSpeaking() : readAloud(msg.content, msg.id)}
                          disabled={ttsLoadingId === msg.id}
                          className={`action-btn flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all duration-150 border border-transparent hover:border-green-100 disabled:opacity-40 disabled:cursor-not-allowed ${speakingId === msg.id ? 'text-green-600 bg-green-50 border-green-100' : ''}`}
                        >
                          {speakingId === msg.id ? <><FaStop size={12} /> Stop</> : ttsLoadingId === msg.id ? 'Loading...' : <><FaVolumeUp size={12} /> Read</>}
                        </button>
                      </div>

                      {isLastAssistantMessage(index) && (() => {
                        const suggestions = extractSuggestions(msg.content);
                        if (suggestions.length === 0) return null;
                        return (
                          <div className="suggested-chips-container flex flex-wrap gap-2 mt-4 animate-[fadeInChips_0.4s_ease]">
                            {suggestions.map((suggestion, chipIdx) => (
                              <button
                                key={chipIdx}
                                className="suggested-chip bg-white border border-gray-200 rounded-full px-4 py-2 text-xs md:text-sm font-medium text-green-600 hover:bg-green-50 hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5"
                                onClick={() => handleSendMessage(suggestion)}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )
            ))
          )}

          {/* Standalone loader: only when no streaming animation is already visible */}
          {isLoading && !messages.some(m => m.role === 'assistant' && !m.displayed) && (
            <div className="typing-indicator flex w-full max-w-3xl items-center py-1 mb-4">
              <MedicalLoader />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input bg-gradient-to-b from-transparent via-gray-50/95 to-gray-50 border-t-0 pt-10 px-4 pb-6 flex flex-col items-center absolute bottom-0 left-0 right-0 z-10 pointer-events-none w-full">
          {imagePreview ? (
            <div className="image-preview-container p-3 bg-gray-50 border-t border-gray-200 pointer-events-auto rounded-t-2xl w-full max-w-3xl mb-[-1px] shadow-inner">
              <div className="image-preview relative inline-block max-w-[150px] md:max-w-[200px] rounded-xl overflow-hidden shadow-md">
                <img className="w-full h-auto block max-h-[120px] md:max-h-[150px] object-cover" src={imagePreview} alt="Selected" />
                <button
                  className="remove-image-btn absolute top-2 right-2 w-7 h-7 bg-red-600/90 text-white border-none rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red-600 hover:scale-110 shadow-md"
                  onClick={removeImage}
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          ) : selectedDocument ? (
            <div className="image-preview-container p-3 bg-gray-50 border-t border-gray-200 pointer-events-auto rounded-t-2xl w-full max-w-3xl mb-[-1px] shadow-inner">
              <div className="document-preview-box flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 pr-9 relative max-w-xs shadow-sm">
                <FaFileMedical size={24} className="doc-icon text-red-500 flex-shrink-0" />
                <span className="doc-preview-name text-xs md:text-sm font-medium text-gray-800 truncate">{selectedDocument.name}</span>
                <button
                  className="remove-image-btn absolute top-2 right-2 w-7 h-7 bg-red-600/90 text-white border-none rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red-600 hover:scale-110 shadow-md"
                  onClick={removeDocument}
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          ) : null}

          <div className="input-wrapper flex gap-3 items-center max-w-3xl w-full mx-auto bg-white border border-gray-200 focus-within:border-green-600 focus-within:ring-4 focus-within:ring-green-600/5 rounded-[28px] py-1.5 pl-4 pr-2 shadow-md hover:shadow-lg transition-all duration-300 relative pointer-events-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={docFileInputRef}
              onChange={handleDocumentSelect}
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              style={{ display: 'none' }}
            />

            {/* + Attachment Button and Dropdown */}
            <div className="attachment-container relative flex items-center" ref={attachmentMenuRef}>
              <button
                className={`attachment-toggle-btn bg-transparent border border-gray-200 hover:border-green-600 hover:bg-green-50 text-gray-500 hover:text-green-600 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 p-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${showAttachmentMenu ? 'active bg-white text-green-600 border-green-600' : ''}`}
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                disabled={isLoading || isAnimating || !!selectedImage || !!selectedDocument}
                title="Add attachment"
              >
                <FaPlus size={16} style={{ transform: showAttachmentMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {showAttachmentMenu && (
                <div className="attachment-dropdown absolute bottom-[calc(100%+12px)] left-0 bg-white border border-gray-200 rounded-xl p-2 flex flex-col gap-1 min-w-[160px] shadow-xl z-[1000] animate-[slideUpFade_0.2s_ease-out]">
                  <button
                    className="attachment-item-btn bg-transparent border-none text-gray-600 hover:bg-gray-50 hover:text-green-600 px-3.5 py-2.5 rounded-lg flex items-center gap-2.5 text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 w-full text-left"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      fileInputRef.current?.click();
                    }}
                    title="Upload Image"
                  >
                    <FaImage className="text-green-600" size={16} />
                    <span>Upload Image</span>
                  </button>
                  <button
                    className="attachment-item-btn bg-transparent border-none text-gray-600 hover:bg-gray-50 hover:text-green-600 px-3.5 py-2.5 rounded-lg flex items-center gap-2.5 text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 w-full text-left"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      docFileInputRef.current?.click();
                    }}
                    title="Upload Document"
                  >
                    <FaFileMedical className="text-green-600" size={16} />
                    <span>Upload Document</span>
                  </button>
                  <button
                    className="attachment-item-btn bg-transparent border-none text-gray-600 hover:bg-gray-50 hover:text-green-600 px-3.5 py-2.5 rounded-lg flex items-center gap-2.5 text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 w-full text-left"
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      startCamera();
                    }}
                    title="Camera Scan"
                  >
                    <FaCamera className="text-green-600" size={16} />
                    <span>Camera Scan</span>
                  </button>
                </div>
              )}
            </div>

            {/* Recording overlay shown above the input bar */}
            {(isListening || isTranscribing) && (
              <div className="voice-recording-overlay absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/95 backdrop-blur-md border border-red-500/40 rounded-full px-4 py-2 whitespace-nowrap z-50 shadow-lg shadow-red-500/10 animate-[overlay-pop_0.2s_ease]">
                <div className="voice-waveform flex items-center gap-0.5 h-5">
                  {isTranscribing ? (
                    <><span /><span /><span /><span /><span /></>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div style={{
                          width: `${audioVolume}%`,
                          height: '100%',
                          background: audioVolume > 5 ? '#4ade80' : '#f87171',
                          transition: 'width 0.1s, background 0.2s'
                        }} />
                      </div>
                      <div className="text-[10px] md:text-xs min-w-[95px]" style={{ color: audioVolume > 5 ? '#4ade80' : '#f87171' }}>
                        {audioVolume > 5 ? 'Mic active' : 'No sound detected'}
                      </div>
                    </div>
                  )}
                </div>
                <span className="voice-timer text-xs md:text-sm font-semibold text-slate-100 tracking-wide tabular-nums min-w-[80px] text-center">
                  {isTranscribing
                    ? 'Transcribing...'
                    : `🔴 ${Math.floor(voiceRecordingTime / 60).toString().padStart(2, '0')}:${(voiceRecordingTime % 60).toString().padStart(2, '0')}`
                  }
                </span>
                <button
                  className="voice-stop-btn flex items-center gap-1.5 bg-red-500/20 border border-red-500/50 rounded-full text-red-200 text-xs font-semibold px-2.5 py-1 hover:bg-red-500/40 hover:text-white hover:border-red-500 transition-all duration-150 cursor-pointer"
                  onClick={stopRecording}
                  title="Stop recording"
                >
                  <FaStop size={12} /> Stop
                </button>
              </div>
            )}

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
                    : isAnimating
                      ? 'Please wait for the reply to finish...'
                      : selectedImage
                        ? 'Describe your concern (optional)'
                        : selectedDocument
                          ? 'Ask something about this document (optional)'
                          : detectedLanguage
                            ? `Type or speak in ${detectedLanguage}...`
                            : 'Type your message or click mic to speak...'
              }
              disabled={isLoading || isAnimating}
              maxLength={500}
              className={`message-field flex-1 py-2 px-1 border-none bg-transparent text-sm md:text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70 ${voiceError ? 'message-field-error border-red-600 placeholder-red-600 font-semibold' : ''}`}
            />

            {/* Combined Voice, Send, or Stop Button */}
            {(isLoading || isAnimating) ? (
              <button
                className="send-btn stop-btn animate-pulse w-10 h-10 md:w-11 md:h-11 bg-red-500 text-white border-none rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={handleStopMessage}
                title="Stop generation"
              >
                <FaStop size={16} />
              </button>
            ) : (inputMessage.trim() !== '' || selectedImage !== null || selectedDocument !== null) ? (
              <button
                className="send-btn w-10 h-10 md:w-11 md:h-11 bg-gradient-to-br from-green-600 to-green-800 text-white border-none rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={() => handleSendMessage()}
              >
                <FaPaperPlane size={16} />
              </button>
            ) : (
              <div ref={micSettingsDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  id="voice-toggle-btn"
                  className={`voice-btn w-10 h-10 md:w-11 md:h-11 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 p-0 disabled:opacity-40 disabled:cursor-not-allowed ${isListening ? 'voice-recording' : isTranscribing ? 'voice-transcribing' : ''}`}
                  onClick={toggleVoiceInput}
                  disabled={(isLoading || isAnimating) && !isListening && !isTranscribing}
                  title={isListening ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
                >
                  {isTranscribing ? (
                    <span className="voice-spinner" />
                  ) : isListening ? (
                    <FaMicrophoneSlash size={18} />
                  ) : (
                    <FaMicrophone size={18} />
                  )}
                </button>

                {audioDevices.length > 0 && !isListening && !isTranscribing && (
                  <button
                    className="absolute right-[-2px] top-[-2px] w-4 h-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-colors z-10 border border-white p-0 focus:outline-none"
                    onClick={() => setShowDeviceSelector(!showDeviceSelector)}
                    title="Choose Microphone"
                  >
                    <FaCog size={8} />
                  </button>
                )}

                {showDeviceSelector && (
                  <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 min-w-[240px] shadow-xl z-[1000] text-white text-xs animate-[slideUpFade_0.2s_ease-out]">
                    <div className="font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                      <FaMicrophone size={12} className="text-green-500" />
                      <span>Select Microphone:</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                      {audioDevices.map((device, idx) => (
                        <button
                          key={device.deviceId || idx}
                          onClick={() => {
                            setSelectedDeviceId(device.deviceId)
                            localStorage.setItem('rural_mic_device_id', device.deviceId)
                            setShowDeviceSelector(false)
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border-none text-[11px] font-medium cursor-pointer transition-colors truncate ${
                            selectedDeviceId === device.deviceId
                              ? 'bg-blue-600/20 text-blue-400 font-semibold'
                              : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                          title={device.label || `Microphone ${idx + 1}`}
                        >
                          {device.label || `Microphone ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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

      {isCameraActive && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-[10000] animate-[fadeIn_0.3s_ease]">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-[90%] max-w-[550px] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-700 bg-slate-800 p-4">
              <h3 className="m-0 text-base text-white font-semibold">Capture Medical Scan / Report</h3>
              <button className="bg-transparent border-none text-slate-400 hover:text-white cursor-pointer text-lg flex items-center justify-center p-1 transition-colors duration-200" onClick={stopCamera}>
                <FaTimes />
              </button>
            </div>
            <div className="relative bg-black w-full aspect-video flex items-center justify-center">
              <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex justify-between items-center gap-3 bg-slate-900">
              {cameraDevices.length > 1 && (
                <select 
                  value={selectedCameraDeviceId}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg py-2 px-3 text-xs md:text-sm outline-none cursor-pointer max-w-[180px]"
                >
                  {cameraDevices.map((device, idx) => (
                    <option key={device.deviceId || idx} value={device.deviceId}>
                      {device.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
              <button className="bg-blue-500 hover:bg-blue-600 text-white border-none rounded-lg py-2.5 px-5 text-sm font-semibold cursor-pointer transition-all duration-200 active:scale-95 shadow-md shadow-blue-500/20 flex-grow text-center" onClick={capturePhoto}>
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface