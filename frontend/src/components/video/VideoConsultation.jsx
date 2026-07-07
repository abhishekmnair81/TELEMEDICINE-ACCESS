import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { generatePrescriptionPDF } from './generatePrescriptionPDF'
import {
  FaVideo,
  FaArrowLeft,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideoSlash,
  FaPhoneSlash,
  FaDesktop,
  FaPaperPlane,
  FaCalendarCheck,
  FaComments,
  FaUser,
  FaClock,
  FaCheckCircle,
  FaPrescriptionBottle,
  FaTimes,
  FaFileMedical,
  FaPrint,
  FaFilePdf,
  FaSpinner,
  FaHeartbeat,
  FaLock
} from "react-icons/fa"
import { videoConsultationAPI, authAPI, appointmentsAPI, prescriptionsAPI, API_BASE_URL } from "../../services/api"
import { deriveRoomKey, encryptMessage, decryptMessage, isE2ESupported } from "../../services/e2eEncryption"
import Footer from "../Footer"
import "./VideoConsultation.css"




const PrescriptionDownloadButton = ({
  prescription,
  size = 'md',
  variant = 'primary',
  label,
  showIcon = true,
  style = {},
  className = '',
}) => {
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleDownload = async () => {
    if (status === 'loading') return
    if (!prescription) {
      setErrorMsg('No prescription data available')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      await generatePrescriptionPDF(prescription)
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      console.error('[PrescriptionDownloadButton] PDF generation failed:', err)
      setErrorMsg('Could not generate PDF. Please try again.')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  const sizeMap = {
    sm: { padding: '8px 14px', fontSize: '13px', iconSize: '14px' },
    md: { padding: '10px 18px', fontSize: '14px', iconSize: '16px' },
    lg: { padding: '13px 24px', fontSize: '15px', iconSize: '18px' },
  }

  const variantMap = {
    primary: {
      background: status === 'success' ? '#4CAF50' : status === 'error' ? '#f44336' : '#1a6b4a',
      color: '#fff',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: status === 'success' ? '#4CAF50' : status === 'error' ? '#f44336' : '#1a6b4a',
      border: `2px solid ${status === 'success' ? '#4CAF50' : status === 'error' ? '#f44336' : '#1a6b4a'}`,
    },
    ghost: {
      background: 'transparent',
      color: status === 'success' ? '#4CAF50' : status === 'error' ? '#f44336' : '#1a6b4a',
      border: 'none',
    },
  }

  const sz = sizeMap[size] || sizeMap.md
  const vr = variantMap[variant] || variantMap.primary

  const getIcon = () => {
    if (status === 'loading') return <FaSpinner style={{ animation: 'spin 1s linear infinite', fontSize: sz.iconSize }} />
    if (status === 'success') return <FaCheckCircle style={{ fontSize: sz.iconSize }} />
    if (status === 'error') return <FaTimes style={{ fontSize: sz.iconSize }} />
    return <FaFilePdf style={{ fontSize: sz.iconSize }} />
  }

  const getLabel = () => {
    if (status === 'loading') return 'Generating PDF…'
    if (status === 'success') return 'Downloaded!'
    if (status === 'error') return 'Retry Download'
    return label || 'Download PDF'
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={status === 'loading'}
        className={className}
        style={{
          ...sz,
          ...vr,
          borderRadius: '8px',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontFamily: 'inherit',
          transition: 'all 0.2s ease',
          opacity: status === 'loading' ? 0.8 : 1,
          ...style,
        }}
      >
        {showIcon && getIcon()}
        {getLabel()}
      </button>
      {status === 'error' && errorMsg && (
        <p style={{ color: '#f44336', fontSize: '12px', marginTop: '6px' }}>{errorMsg}</p>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
}

const VideoConsultation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const websocketRef = useRef(null)
  const localStreamRef = useRef(null)
  const e2eKeyRef = useRef(null)
  const remoteUserIdRef = useRef(null)

  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [showStatusBadge, setShowStatusBadge] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [userAppointments, setUserAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [videoStarting, setVideoStarting] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { sender: "System", message: "Select an appointment to start video consultation", timestamp: new Date() },
  ])
  const [chatInput, setChatInput] = useState("")


  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [receivedPrescriptions, setReceivedPrescriptions] = useState([])
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false)


  const [showChat, setShowChat] = useState(true)
  const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(true)
  const [isRemoteMicOn, setIsRemoteMicOn] = useState(true)

  const getInitials = (firstName, lastName) => {
    const f = firstName ? firstName.charAt(0).toUpperCase() : ''
    const l = lastName ? lastName.charAt(0).toUpperCase() : ''
    return f + l || '?'
  }

  useEffect(() => {
    const checkAuth = async () => {
      const user = authAPI.getCurrentUser()
      if (!user) {
        addChatMessage("System", "Please login to access video consultation")
        setTimeout(() => navigate('/auth?type=patient&view=login'), 2000)
        return
      }
      if (user.user_type === 'doctor') {
        navigate('/doctor-video')
        return
      }
      setCurrentUser(user)
      await loadAppointments(user)
      await loadPrescriptions(user.id)


      const savedAppointment = sessionStorage.getItem("active_appointment")
      const savedRoom = sessionStorage.getItem("active_room")
      if (savedAppointment && savedRoom) {
        try {
          const appointment = JSON.parse(savedAppointment)
          const room = JSON.parse(savedRoom)

          setSelectedAppointment(appointment)
          setCurrentRoom(room)

          addChatMessage("System", "Reconnecting to active conversation...")
          await startLocalVideo(user)
          initializeWebSocket(room.room_id, user.id)
        } catch (err) {
          console.error("[VideoConsultation] Error restoring active call session:", err)
        }
      }
    }

    checkAuth()

    if (location.state?.appointment) {
      setSelectedAppointment(location.state.appointment)
    }

    return () => {
      console.log('[VideoConsultation] Component unmounting - cleaning up')
      closeConnection()
    }
  }, [navigate, location])

  useEffect(() => {
    if (currentRoom) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [currentRoom]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])


  useEffect(() => {
    let intervalId = null
    let mediaRecorder = null
    let localStreamToRecord = null

    if (isConnected && localStreamRef.current && isMicOn) {
      console.log("[Co-pilot] Starting background audio recording loop...")

      const startRecording = () => {
        try {
          if (!localStreamRef.current || !isMicOn) return;
          const audioTracks = localStreamRef.current.getAudioTracks()
          if (audioTracks.length === 0 || !audioTracks[0].enabled) {
            console.log("[Co-pilot] Audio track is disabled or not found.")
            return
          }


          localStreamToRecord = new MediaStream([audioTracks[0]])

          let options = {}
          if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm')) {
              options = { mimeType: 'audio/webm' }
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
              options = { mimeType: 'audio/ogg' }
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: 'audio/mp4' }
            }
          }

          mediaRecorder = new MediaRecorder(localStreamToRecord, options)

          const chunks = []
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data)
            }
          }

          mediaRecorder.onstop = async () => {
            if (chunks.length === 0) return
            const blob = new Blob(chunks, { type: options.mimeType || 'audio/webm' })


            if (blob.size > 2000) {
              const formData = new FormData()
              formData.append('audio', blob, `copilot.${options.mimeType ? options.mimeType.split('/')[1] : 'webm'}`)
              formData.append('room_id', currentRoom?.room_id || '')

              try {
                const response = await fetch(`${API_BASE_URL}/video-consultations/process-copilot-audio/`, {
                  method: 'POST',
                  body: formData,
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                  }
                })
                const data = await response.json()
                console.log("[Co-pilot] Sent audio chunk successfully:", data)
              } catch (err) {
                console.error("[Co-pilot] Failed to send audio chunk:", err)
              }
            }
          }

          mediaRecorder.start()


          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop()
            }
          }, 8000)

        } catch (error) {
          console.error("[Co-pilot] Error recording audio chunk:", error)
        }
      }


      intervalId = setInterval(startRecording, 9000)


      startRecording()
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        try {
          mediaRecorder.stop()
        } catch (e) {}
      }
    }
  }, [isConnected, isMicOn, currentRoom])

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
      localVideoRef.current.play().catch(err =>
        console.error('[VideoConsultation] Error playing local video:', err)
      )
    }
  }, [localStream])

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.style.display = "block"
      remoteVideoRef.current.play().catch(err =>
        console.error('[VideoConsultation] Error playing remote video:', err)
      )
    }
  }, [remoteStream])

  const loadAppointments = async (user) => {
    try {
      setLoadingAppointments(true)
      const response = await appointmentsAPI.getPatientAppointments(user.id)
      const appointments = Array.isArray(response) ? response : (response.results || [])
      const confirmed = appointments.filter(apt => apt.status === 'confirmed')
      setUserAppointments(confirmed)
    } catch (error) {
      console.error('[VideoConsultation] Error loading appointments:', error)
      addChatMessage("System", "Failed to load appointments")
    } finally {
      setLoadingAppointments(false)
    }
  }

  const loadPrescriptions = async (patientId) => {
    try {
      setLoadingPrescriptions(true)
      const response = await prescriptionsAPI.getPatientPrescriptions(patientId)
      const prescriptions = Array.isArray(response) ? response : (response.results || [])
      setReceivedPrescriptions(prescriptions)
      return prescriptions
    } catch (error) {
      console.error('[Prescriptions] Error loading prescriptions:', error)
      return []
    } finally {
      setLoadingPrescriptions(false)
    }
  }

  const addChatMessage = (sender, message) => {
    setChatMessages(prev => [...prev, { sender, message, timestamp: new Date() }])
  }

  const startConsultation = async (appointment) => {
    if (!currentUser) { alert("Please login to start consultation"); return }

    try {
      setSelectedAppointment(appointment)
      addChatMessage("System", `Starting consultation with ${appointment.doctor_details?.user?.first_name || 'doctor'}...`)

      const patientId = currentUser.id
      let doctorId =
        appointment.doctor_details?.user?.id ||
        appointment.doctor?.id ||
        appointment.doctor

      if (!doctorId) throw new Error('Could not determine doctor ID from appointment')

      let room = null
      try {
        const existingRooms = await videoConsultationAPI.getPatientRooms(currentUser.id)
        const roomsList = existingRooms.rooms || existingRooms || []
        room = roomsList.find(r =>
          r.appointment === appointment.id &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
        )
        if (room) addChatMessage("System", "Rejoining existing consultation room...")
      } catch (err) {
        console.log('[VideoConsultation] Error checking for existing room:', err.message)
      }

      if (!room) {
        const roomData = {
          patient_id: patientId,
          doctor_id: doctorId,
          appointment_id: appointment.id,
          scheduled_time: new Date().toISOString(),
          chat_enabled: true,
          screen_share_enabled: true,
          recording_enabled: false,
        }
        room = await videoConsultationAPI.createRoom(roomData)
        addChatMessage("System", "New consultation room created")
      }

      setCurrentRoom(room)

      sessionStorage.setItem("active_appointment", JSON.stringify(appointment))
      sessionStorage.setItem("active_room", JSON.stringify(room))

      await videoConsultationAPI.joinRoom({ room_id: room.room_id, user_id: currentUser.id })
      addChatMessage("System", "Connected to consultation room. Starting video...")

      await startLocalVideo()
      initializeWebSocket(room.room_id, currentUser.id)
    } catch (error) {
      console.error("[VideoConsultation] ❌ Error starting consultation:", error)
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      alert("Error starting consultation: " + errorMessage)
      addChatMessage("System", "Failed to start consultation: " + errorMessage)
    }
  }

  const initializeWebSocket = async (roomId, userId) => {

    if (isE2ESupported()) {
      try {
        e2eKeyRef.current = await deriveRoomKey(roomId)
        console.log('[E2E] Room key derived ✅')
      } catch (err) {
        console.warn('[E2E] Key derivation failed – chat will be unencrypted:', err)
      }
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws/video/${roomId}/${userId}/`

    console.log('[WebSocket] Connecting to:', wsUrl)
    websocketRef.current = new WebSocket(wsUrl)

    websocketRef.current.onopen = () => {
      console.log("[WebSocket] ✅ Connected")
      setIsConnected(true)
      addChatMessage("System", "🔒 Connected – waiting for doctor to join...")


    }

    websocketRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        await handleWebSocketMessage(data)
      } catch (error) {
        console.error("[WebSocket] Error handling message:", error)
      }
    }

    websocketRef.current.onerror = (error) => {
      console.error("[WebSocket] Error:", error)
      addChatMessage("System", "Connection error occurred")
    }

    websocketRef.current.onclose = () => {
      console.log("[WebSocket] Disconnected")
      setIsConnected(false)
      addChatMessage("System", "Disconnected from consultation room")
    }
  }

  const handleWebSocketMessage = async (data) => {
    console.log("[WebSocket] Message received:", data.type)

    switch (data.type) {
      case "user_connected":

        if (data.user_id === currentUser?.id) break
        addChatMessage("System", `${data.user_name || 'Doctor'} joined the room 🔒`)
        setIsRemoteVideoOn(true)
        setIsRemoteMicOn(true)

        remoteUserIdRef.current = data.user_id

        if (localStreamRef.current) {
          await createOffer(data.user_id)
        }
        break

      case "user_disconnected":
        if (data.user_id === currentUser?.id) break
        addChatMessage("System", `${data.user_name || 'Doctor'} left the room`)
        handleRemoteDisconnect()
        break

      case "call_ended":
        if (data.sender_id === currentUser?.id) break
        alert("The conversation has been completed and ended by the doctor.")
        sessionStorage.removeItem("active_appointment")
        sessionStorage.removeItem("active_room")
        closeConnection()
        setCurrentRoom(null)
        setSelectedAppointment(null)
        setIsMicOn(true)
        setIsVideoOn(true)
        break

      case "webrtc_offer":
        if (data.receiver_id === currentUser?.id) {
          remoteUserIdRef.current = data.sender_id
          await handleReceiveOffer(data.sdp, data.sender_id)
        }
        break

      case "webrtc_answer":
        if (data.receiver_id === currentUser?.id) {
          await handleReceiveAnswer(data.sdp)
        }
        break

      case "ice_candidate":
        if (data.receiver_id === currentUser?.id) {
          await handleReceiveIceCandidate(data.candidate)
        }
        break

      case "chat_message": {
        if (data.sender_id !== currentUser?.id) {
          let displayText = data.content

          if (data.iv && e2eKeyRef.current) {
            try {
              displayText = await decryptMessage(data.content, data.iv, e2eKeyRef.current)
            } catch (err) {
              console.warn('[E2E] Decryption failed – showing raw content:', err)
            }
          }
          addChatMessage(data.sender_name, displayText)
        }
        break
      }

      case "prescription_sent":
        addChatMessage("System", "🩺 Doctor has sent you a prescription")
        const updatedPrescriptions = await loadPrescriptions(currentUser.id)
        if (updatedPrescriptions.length > 0) {
          setShowPrescriptionModal(true)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Prescription', {
              body: 'Your doctor has sent you a prescription',
              icon: '/prescription-icon.png',
            })
          }
        }
        break

      case "user_status":
        if (data.user_id !== currentUser?.id) {
          if (data.video_enabled !== undefined) setIsRemoteVideoOn(data.video_enabled)
          if (data.audio_enabled !== undefined) setIsRemoteMicOn(data.audio_enabled)
        }
        break

      case "screen_share": {
        const action = data.action === "start" ? "started" : "stopped"
        addChatMessage("System", `Doctor ${action} screen sharing`)
        break
      }

      default:
        console.log("[WebSocket] Unknown message type:", data.type)
    }
  }

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        peerConnection.addTrack(track, localStreamRef.current)
      )
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams
      setRemoteStream(stream)
      addChatMessage("System", "Doctor connected to video call")
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && websocketRef.current?.readyState === WebSocket.OPEN) {
        sendICECandidate(event.candidate)
      }
    }

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      if (state === "connected") addChatMessage("System", "Peer-to-peer connection established")
      else if (state === "disconnected") addChatMessage("System", "Connection interrupted")
      else if (state === "failed") addChatMessage("System", "Connection failed - attempting to reconnect")
    }

    peerConnectionRef.current = peerConnection
    return peerConnection
  }

  const createOffer = async (receiverId) => {
    try {
      const peerConnection = createPeerConnection()
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await peerConnection.setLocalDescription(offer)
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: "webrtc_offer",
          sender_id: currentUser.id,
          receiver_id: receiverId,
          sdp: offer,
        }))
      }
    } catch (error) {
      console.error("[WebRTC] Error creating offer:", error)
      addChatMessage("System", "Error establishing connection")
    }
  }

  const handleReceiveOffer = async (offer, senderId) => {
    try {
      const peerConnection = createPeerConnection()
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: "webrtc_answer",
          sender_id: currentUser.id,
          receiver_id: senderId,
          sdp: answer,
        }))
      }
    } catch (error) {
      console.error("[WebRTC] Error handling offer:", error)
    }
  }

  const handleReceiveAnswer = async (answer) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
      }
    } catch (error) {
      console.error("[WebRTC] Error handling answer:", error)
    }
  }

  const sendICECandidate = (candidate) => {
    const receiverId = remoteUserIdRef.current
    if (websocketRef.current?.readyState === WebSocket.OPEN && receiverId) {
      websocketRef.current.send(JSON.stringify({
        type: "ice_candidate",
        sender_id: currentUser.id,
        receiver_id: receiverId,
        candidate,
      }))
    }
  }

  const handleReceiveIceCandidate = async (candidate) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (error) {
      console.error("[WebRTC] Error adding ICE candidate:", error)
    }
  }

  const handleRemoteDisconnect = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
      remoteVideoRef.current.style.display = "none"
    }
    setRemoteStream(null)
    setIsRemoteVideoOn(false)
    setIsRemoteMicOn(false)
  }

  const startLocalVideo = async (user = null) => {
    const activeUser = user || currentUser
    if (!activeUser) {
      addChatMessage("System", "Please login to start video")
      navigate('/auth?type=patient&view=login')
      return
    }
    if (videoStarting) return

    try {
      setVideoStarting(true)
      addChatMessage("System", "Requesting camera and microphone access...")

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch (error) {
        console.log('[VideoConsultation] HD failed, trying basic...')
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        } catch (fallbackError) {
          console.warn("[VideoConsultation] ⚠️ Camera access completely failed:", fallbackError)
          let errorMessage = "Could not access camera/microphone. "
          if (fallbackError.name === "NotAllowedError") errorMessage += "Permissions denied."
          else if (fallbackError.name === "NotFoundError") errorMessage += "No hardware found."
          else errorMessage += fallbackError.message

          addChatMessage("System", "⚠️ " + errorMessage + " Proceeding without media.")
          stream = null;
        }
      }

      if (stream) {
        localStreamRef.current = stream
        setLocalStream(stream)
        setShowStatusBadge(true)
        setIsMicOn(true)
        setIsVideoOn(true)
        addChatMessage("System", "✅ Your video stream is active")
      } else {
        console.log('[VideoConsultation] Proceeding without camera/microphone')
        setShowStatusBadge(true)
        setIsMicOn(false)
        setIsVideoOn(false)
      }
    } catch (error) {
      console.error("[VideoConsultation] ❌ Unexpected Error:", error)
      addChatMessage("System", "❌ Failed to start video system: " + error.message)
    } finally {
      setVideoStarting(false)
    }
  }

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
        addChatMessage("System", audioTrack.enabled ? "Microphone enabled" : "Microphone muted")
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: "user_status",
            user_id: currentUser.id,
            audio_enabled: audioTrack.enabled,
            video_enabled: isVideoOn,
          }))
        }
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
        addChatMessage("System", videoTrack.enabled ? "Camera enabled" : "Camera disabled")
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: "user_status",
            user_id: currentUser.id,
            audio_enabled: isMicOn,
            video_enabled: videoTrack.enabled,
          }))
        }
      }
    }
  }

  const closeConnection = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null }
    if (websocketRef.current) { websocketRef.current.close(); websocketRef.current = null }
    setLocalStream(null)
    setRemoteStream(null)
    setShowStatusBadge(false)
    setIsConnected(false)
  }

  const endCall = async () => {
    if (window.confirm("Have you completed the conversation?")) {
      try {
        if (currentRoom) {
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: "call_ended",
              sender_id: currentUser.id
            }))
          }
          await videoConsultationAPI.endConsultation({ room_id: currentRoom.room_id, user_id: currentUser.id })
          addChatMessage("System", "Call ended successfully")
        }
      } catch (error) {
        console.error("Error ending call:", error)
      } finally {
        sessionStorage.removeItem("active_appointment")
        sessionStorage.removeItem("active_room")
        closeConnection()
        setCurrentRoom(null)
        setSelectedAppointment(null)
        setIsMicOn(true)
        setIsVideoOn(true)
      }
    }
  }

  const shareScreen = async () => {
    if (!localStreamRef.current) { alert("Please start your video first"); return }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false })
      const screenTrack = screenStream.getVideoTracks()[0]
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video")
        if (sender) sender.replaceTrack(screenTrack)
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([screenTrack, ...localStreamRef.current.getAudioTracks()])
      }
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: "screen_share", user_id: currentUser.id, action: "start" }))
      }
      screenTrack.onended = () => { addChatMessage("System", "Screen sharing stopped"); restoreCamera() }
      addChatMessage("System", "Screen sharing started")
    } catch (error) {
      console.error("Error sharing screen:", error)
      addChatMessage("System", "Screen sharing cancelled or failed")
    }
  }

  const restoreCamera = async () => {
    if (localStreamRef.current && peerConnectionRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video")
      if (sender && videoTrack) await sender.replaceTrack(videoTrack)
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: "screen_share", user_id: currentUser.id, action: "stop" }))
      }
    }
  }

  const sendChatMessage = async () => {
    const message = chatInput.trim()
    if (!message || websocketRef.current?.readyState !== WebSocket.OPEN) return

    let content = message
    let iv = null


    if (e2eKeyRef.current) {
      try {
        const encrypted = await encryptMessage(message, e2eKeyRef.current)
        content = encrypted.ciphertext
        iv = encrypted.iv
      } catch (err) {
        console.warn('[E2E] Encryption failed – sending plaintext:', err)
      }
    }

    websocketRef.current.send(JSON.stringify({
      type: "chat_message",
      sender_id: currentUser.id,
      sender_name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.username,
      content,
      iv,
      message_type: "text",
    }))
    addChatMessage("You", message)
    setChatInput("")
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage() }
  }

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })

  const viewPrescription = (prescription) => setSelectedPrescription(prescription)
  const printPrescription = () => window.print()

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full mx-4">
          <FaUser className="w-12 h-12 text-green-600 animate-pulse mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900">Authentication Required</h2>
          <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">Please sign in as a patient to access your consultation room.</p>
          <button
            className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            onClick={() => navigate('/auth?type=patient&view=login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${currentRoom
        ? 'fixed inset-0 overflow-hidden z-50 bg-slate-900'
        : 'min-h-screen bg-gradient-to-b from-green-50/20 via-slate-50 to-white'
      } text-slate-850 flex flex-col justify-between`}>


      {}
      <header className={`border-b sticky top-0 z-50 transition-colors flex-shrink-0 ${currentRoom ? 'bg-slate-900/95 border-white/10 backdrop-blur-md' : 'bg-white/80 border-slate-200/80 backdrop-blur-md'}`}>
        <div className="max-w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform ${currentRoom ? 'bg-white/10 text-green-400 border border-white/10' : 'bg-green-600/10 text-green-600 border border-green-500/10'}`}>
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className={`text-lg font-black tracking-tight ${currentRoom ? 'text-white' : 'text-slate-900'}`}>Rural HealthCare</span>
          </div>

          <div className="flex items-center gap-2">
            {!currentRoom && (
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <FaArrowLeft /> Back
              </button>
            )}
            {showStatusBadge && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-full text-[11px] font-black uppercase tracking-wider ${currentRoom ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-600/10 text-green-600 border-green-500/20'}`}>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>{isConnected ? "Connected" : "Connecting..."}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {}
      <main className={`flex-1 w-full flex flex-col min-h-0 ${currentRoom ? 'p-0 overflow-hidden h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>

        {!currentRoom ? (

          <div className="space-y-8 flex-1">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <FaVideo className="text-green-600" /> Video Consultations
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Select one of your confirmed medical appointments to start the call</p>
            </div>

            {loadingAppointments ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-green-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-450">Loading Confirmed Consultations...</p>
              </div>
            ) : userAppointments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userAppointments.map((apt) => {
                  const doctorName = apt.doctor_details?.user
                    ? `Dr. ${apt.doctor_details.user.first_name} ${apt.doctor_details.user.last_name}`
                    : 'Doctor'
                  return (
                    <div key={apt.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs text-slate-500 font-extrabold uppercase">
                              {getInitials(apt.doctor_details?.user?.first_name || 'D', apt.doctor_details?.user?.last_name || 'R')}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{doctorName}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold">{apt.doctor_details?.specialization || 'Medical Practitioner'}</p>
                            </div>
                          </div>
                          <span className="text-[9px] text-green-600 font-black uppercase tracking-wider px-2 py-0.5 bg-green-50 border border-green-200 rounded-md">
                            Confirmed
                          </span>
                        </div>

                        <div className="space-y-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
                          <p className="flex items-center gap-2">
                            <strong className="text-slate-400 uppercase text-[9px] tracking-wider block w-20">Time slot:</strong>
                            <span className="text-slate-850 font-bold"><FaClock className="inline mr-1 text-slate-400" /> {formatDate(apt.preferred_date)} @ {apt.preferred_time}</span>
                          </p>
                          <p className="flex items-start gap-2">
                            <strong className="text-slate-400 uppercase text-[9px] tracking-wider block w-20 pt-0.5">Symptoms:</strong>
                            <span className="text-slate-700 flex-1 leading-relaxed">{apt.symptoms}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => startConsultation(apt)}
                        className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FaVideo /> Join call room
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl max-w-md mx-auto flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-2xl border border-slate-150">
                  <FaCalendarCheck />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">No active calls scheduled</h3>
                  <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">Book a medical appointment and verify the details to begin a video consultation.</p>
                </div>
              </div>
            )}
          </div>
        ) : (

          <div className="flex h-full max-h-full min-h-0 overflow-hidden bg-slate-900">

            {}
            <div className="flex-1 relative overflow-hidden" style={{ minWidth: 0 }}>

              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center overflow-hidden">
                {!localStream ? (
                  <div className="text-center space-y-3 z-10">
                    <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 text-xl mx-auto animate-pulse">
                      <FaUser />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white">Opening Consultation Session...</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Acquiring room credentials</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">

                    {}
                    <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
                      {remoteStream && isRemoteVideoOn ? (
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-black text-2xl uppercase tracking-wider">
                            {getInitials(
                              selectedAppointment?.doctor_details?.user?.first_name || 'D',
                              selectedAppointment?.doctor_details?.user?.last_name || 'R'
                            )}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white">
                              {selectedAppointment?.doctor_details?.user
                                ? `Dr. ${selectedAppointment.doctor_details.user.first_name} ${selectedAppointment.doctor_details.user.last_name}`
                                : 'Doctor'}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                              {!remoteStream ? 'Awaiting doctor connection...' : 'Doctor has switched camera off'}
                            </p>
                          </div>
                        </div>
                      )}

                      {remoteStream && (
                        <span className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white rounded-md">
                          {selectedAppointment?.doctor_details?.user
                            ? `Dr. ${selectedAppointment.doctor_details.user.first_name} ${selectedAppointment.doctor_details.user.last_name}`
                            : 'Doctor'} {!isRemoteMicOn && ' 🔇'}
                        </span>
                      )}
                    </div>

                    {}
                    <div className="absolute bottom-24 right-4 w-36 h-24 sm:w-48 sm:h-32 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl z-20 group hover:border-green-400 transition-colors bg-slate-800">
                      {localStream && isVideoOn ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover mirror-feed"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xs text-slate-705 font-extrabold border border-slate-300">
                            {getInitials(currentUser?.first_name || 'P', currentUser?.last_name || 'T')}
                          </div>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-white/70 backdrop-blur-md text-[9px] font-bold text-slate-850 rounded border border-slate-200">
                        You {!isMicOn && ' 🔇'}
                      </span>
                    </div>

                  </div>
                )}
              </div>

              {}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-white/10 rounded-full px-3 py-2 sm:px-6 sm:py-3 flex items-center gap-2 sm:gap-3 z-30 shadow-2xl backdrop-blur-md max-w-[96vw]">
                <button
                  onClick={toggleMic}
                  disabled={!localStream}
                  className={`w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full flex items-center justify-center transition-all cursor-pointer ${isMicOn ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </button>
                <button
                  onClick={toggleVideo}
                  disabled={!localStream}
                  className={`w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full flex items-center justify-center transition-all cursor-pointer ${isVideoOn ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  title={isVideoOn ? "Stop Video" : "Start Video"}
                >
                  {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
                </button>
                <button
                  onClick={shareScreen}
                  disabled={!localStream}
                  className="w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Share Screen Feed"
                >
                  <FaDesktop />
                </button>
                {currentRoom && (
                  <button
                    onClick={() => setShowChat(!showChat)}
                    disabled={!localStream}
                    className={`w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full flex items-center justify-center transition-all cursor-pointer ${showChat ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                      }`}
                    title="Toggle Chat Sidebar"
                  >
                    <FaComments />
                  </button>
                )}
                {receivedPrescriptions.length > 0 && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full bg-green-500 hover:bg-green-600 border border-green-400/30 text-white flex items-center justify-center transition-all cursor-pointer relative"
                    title="View Prescriptions"
                  >
                    <FaPrescriptionBottle />
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white">
                      {receivedPrescriptions.length}
                    </span>
                  </button>
                )}
                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                <button
                  onClick={endCall}
                  disabled={!currentRoom}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FaPhoneSlash /> Leave
                </button>
              </div>

            </div>

            {}
            {currentRoom && showChat && (
              <div className="w-80 flex-shrink-0 border-l border-white/10 bg-slate-900 flex flex-col overflow-hidden">

                {}
                <div className="p-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black text-green-400 uppercase tracking-widest">Active Consultation</h3>
                    <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs">✕</button>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1 text-xs">
                    <p className="text-slate-300">Doctor: <strong className="text-white font-bold">{selectedAppointment?.doctor_details?.user ? `Dr. ${selectedAppointment.doctor_details.user.first_name} ${selectedAppointment.doctor_details.user.last_name}` : 'Doctor'}</strong></p>
                    <p className="text-slate-400 text-[10px]">Date: {formatDate(selectedAppointment?.preferred_date)} at {selectedAppointment?.preferred_time}</p>
                  </div>
                </div>

                {}
                <div className="flex-1 flex flex-col overflow-hidden p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-green-400 uppercase tracking-widest">Consultation Chat</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/40 border border-green-500/30 text-green-400 rounded-full text-[9px] font-bold">
                      <FaLock style={{ fontSize: '8px' }} /> E2E Encrypted
                    </span>
                  </div>

                  <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 overflow-y-auto custom-scrollbar space-y-2" ref={chatMessagesRef}>
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-2.5 rounded-xl text-xs max-w-[85%] ${msg.sender === 'You'
                            ? 'bg-green-600/30 border border-green-500/30 text-white ml-auto'
                            : msg.sender === 'System'
                              ? 'bg-white/5 text-slate-400 border-none mx-auto text-center italic text-[9px]'
                              : 'bg-white/10 border border-white/10 text-slate-200'
                          }`}
                      >
                        {msg.sender !== 'System' && (
                          <div className="flex justify-between items-baseline gap-2 mb-0.5">
                            <strong className={`text-[10px] font-extrabold ${msg.sender === 'You' ? 'text-green-400' : 'text-slate-400'}`}>{msg.sender}</strong>
                            <span className="text-[8px] text-slate-400">{formatTime(msg.timestamp)}</span>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>

                  {}
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      maxLength={500}
                      disabled={!isConnected}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || !isConnected}
                      className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FaPaperPlane size={11} />
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </main>


      {}
      {!currentRoom && <Footer />}

      {}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowPrescriptionModal(false)}>
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-800" onClick={(e) => e.stopPropagation()}>

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-green-800 to-green-700 text-white">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <FaPrescriptionBottle className="text-green-400" /> Digital Prescriptions Issued
              </h2>
              <button onClick={() => setShowPrescriptionModal(false)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-50 text-white hover:text-red-655 flex items-center justify-center transition-colors cursor-pointer text-xs">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {loadingPrescriptions ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-green-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs font-bold text-slate-400">Loading details...</p>
                </div>
              ) : receivedPrescriptions.length > 0 ? (
                <div className="space-y-4">
                  {receivedPrescriptions.map((prescription) => (
                    <div key={prescription.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between hover:border-green-500 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-green-600 font-black tracking-widest uppercase">Rx ID: #{prescription.id.toString().substring(0, 8)}</span>
                        <span className="text-[9px] text-slate-400 font-bold">{formatDate(prescription.date || prescription.created_at)}</span>
                      </div>
                      <div className="text-xs space-y-1 text-slate-600 font-semibold mb-4">
                        <p><strong className="text-slate-500 font-bold mr-1">Medical Officer:</strong> Dr. {prescription.doctor_name}</p>
                        <p><strong className="text-slate-500 font-bold mr-1">Diagnosis:</strong> {prescription.diagnosis}</p>
                        <p><strong className="text-slate-500 font-bold mr-1">Medicines:</strong> {prescription.medications?.length || 0} prescribed item(s)</p>
                      </div>

                      <button
                        onClick={() => { viewPrescription(prescription); setShowPrescriptionModal(false) }}
                        className="w-full py-2.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FaFileMedical /> View Full Rx Slip
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <FaPrescriptionBottle className="text-slate-300 w-10 h-10" />
                  <p className="text-xs text-slate-500 font-semibold">You have no prescription sheets uploaded in this call.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setSelectedPrescription(null)}>
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800" onClick={(e) => e.stopPropagation()}>

            {}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">

              {}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b-2 border-green-600 pb-4 gap-4">
                <div>
                  <h1 className="text-2xl font-black text-green-800 tracking-tight">{selectedPrescription.hospital_name || 'RURAL HEALTH CLINIC'}</h1>
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mt-0.5">Telemedicine electronic prescription sheet</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-black rounded-md inline-block">
                    Rx ID: #{selectedPrescription.id.toString().substring(0, 8)}
                  </span>
                </div>
              </div>

              {}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs font-semibold text-slate-600">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Patient Demographics</h4>
                  <p className="text-slate-800">Name: <strong className="font-extrabold text-slate-950">{selectedPrescription.patient_name}</strong></p>
                  {selectedPrescription.patient_age && (
                    <p>Age / Gender: {selectedPrescription.patient_age} yrs / {selectedPrescription.patient_gender}</p>
                  )}
                  <p>Date Issued: {formatDate(selectedPrescription.date || selectedPrescription.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Doctor Profile</h4>
                  <p className="text-slate-800">Name: <strong className="font-extrabold text-slate-950">Dr. {selectedPrescription.doctor_name}</strong></p>
                  {selectedPrescription.doctor_specialization && (
                    <p>Department: {selectedPrescription.doctor_specialization}</p>
                  )}
                </div>
              </div>

              {}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-slate-100 pb-1">Diagnosis</h4>
                <p className="text-xs font-semibold text-slate-800 bg-green-50/30 border border-green-500/10 rounded-xl p-3.5 leading-relaxed">{selectedPrescription.diagnosis}</p>
              </div>

              {}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-slate-100 pb-1">℞ Prescribed Medicines</h4>
                {selectedPrescription.medications?.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse text-xs font-semibold">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Medicine Name</th>
                          <th className="px-4 py-3">Dosage</th>
                          <th className="px-4 py-3">Frequency</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Intake Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {selectedPrescription.medications.map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 text-slate-450">{idx + 1}</td>
                            <td className="px-4 py-3.5 font-bold text-slate-900">{med.name}</td>
                            <td className="px-4 py-3.5">{med.dosage}</td>
                            <td className="px-4 py-3.5">{med.frequency}</td>
                            <td className="px-4 py-3.5">{med.duration}</td>
                            <td className="px-4 py-3.5 text-slate-600">{med.instructions || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No medications prescribed on this slip.</p>
                )}
              </div>

              {}
              {selectedPrescription.notes && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest border-b border-slate-100 pb-1">Remarks & Diet Advice</h4>
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">{selectedPrescription.notes}</p>
                </div>
              )}

              {}
              {selectedPrescription.follow_up_date && (
                <div className="p-3 bg-green-50/40 border border-green-500/10 rounded-xl flex justify-between items-center text-xs font-semibold">
                  <span className="text-green-700">Recommended Follow-up Consultation:</span>
                  <strong className="text-green-900 font-extrabold">{formatDate(selectedPrescription.follow_up_date)}</strong>
                </div>
              )}

            </div>

            {}
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
              <button
                onClick={printPrescription}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <FaPrint /> Print Slip
              </button>

              <div className="flex gap-2">
                <PrescriptionDownloadButton
                  prescription={selectedPrescription}
                  size="md"
                  variant="primary"
                  className="px-4 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                />
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )


}

export default VideoConsultation