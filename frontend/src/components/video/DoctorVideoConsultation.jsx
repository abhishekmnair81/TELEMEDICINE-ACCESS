
import React, { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaVideo,
  FaArrowLeft,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideoSlash,
  FaPhoneSlash,
  FaDesktop,
  FaPaperPlane,
  FaComments,
  FaUserMd,
  FaCheckCircle,
  FaClock,
  FaUser,
  FaCalendarCheck,
  FaExclamationTriangle,
  FaRedo,
  FaPrescriptionBottle,
  FaPlus,
  FaTimes,
  FaFileMedical,
  FaSave,
  FaClinicMedical,
  FaHeartbeat,
  FaLock
} from "react-icons/fa"
import { videoConsultationAPI, authAPI, appointmentsAPI, prescriptionsAPI } from "../../services/api"
import { deriveRoomKey, encryptMessage, decryptMessage, isE2ESupported } from "../../services/e2eEncryption"
import Footer from "../Footer"
import "./DoctorVideoConsultation.css"

const DoctorVideoConsultation = () => {
  const navigate = useNavigate()
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const chatMessagesRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const websocketRef = useRef(null)
  const localStreamRef = useRef(null)
  const retryTimeoutRef = useRef(null)
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
  const currentUserRef = useRef(null)
  currentUserRef.current = currentUser
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [confirmedAppointments, setConfirmedAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [videoStarting, setVideoStarting] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { sender: "System", message: "Ready to accept consultation", timestamp: new Date() },
  ])
  const [chatInput, setChatInput] = useState("")


  const [cameraError, setCameraError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)


  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [prescriptionForm, setPrescriptionForm] = useState({
    patient_name: '',
    patient_age: '',
    patient_gender: '',
    diagnosis: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    notes: '',
    follow_up_date: '',
  })
  const [sendingPrescription, setSendingPrescription] = useState(false)


  const [showChat, setShowChat] = useState(true)
  const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(true)
  const [isRemoteMicOn, setIsRemoteMicOn] = useState(true)
  const [copilotData, setCopilotData] = useState(null)
  const [showCopilot, setShowCopilot] = useState(true)

  const getInitials = (firstName, lastName) => {
    const f = firstName ? firstName.charAt(0).toUpperCase() : ''
    const l = lastName ? lastName.charAt(0).toUpperCase() : ''
    return f + l || '?'
  }

  const getPatientInitials = (name) => {
    if (!name) return 'PT'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return parts[0].charAt(0).toUpperCase()
  }

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  }

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
    const checkAuth = async () => {
      const user = authAPI.getCurrentUser()
      if (!user || user.user_type !== 'doctor') {
        addChatMessage("System", "Doctors only - Please login as doctor")
        setTimeout(() => {
          navigate('/auth?type=doctor&view=login')
        }, 2000)
        return
      }
      setCurrentUser(user)
      await loadAppointments(user.id)


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
          console.error("[DoctorVideo] Error restoring active call session:", err)
        }
      }
    }

    checkAuth()

    const interval = setInterval(() => {
      if (currentUserRef.current) {
        loadAppointments(currentUserRef.current.id)
      }
    }, 30000)

    return () => {
      console.log('[DoctorVideo] Component unmounting, cleaning up...')
      clearInterval(interval)
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      closeConnection()
    }
  }, [navigate])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && localStreamRef.current) {
        console.log('[DoctorVideo] Tab hidden - pausing video')
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = false
        }
      } else if (!document.hidden && localStreamRef.current) {
        console.log('[DoctorVideo] Tab visible - resuming video')
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        if (videoTrack && isVideoOn) {
          videoTrack.enabled = true
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isVideoOn])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.play().catch(err => {
        console.error('[DoctorVideo] Error playing local video:', err)
      })
    }
  }, [localStream])

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.style.display = "block"
      remoteVideoRef.current.play().catch(err => {
        console.error('[DoctorVideo] Error playing remote video:', err)
      })
    }
  }, [remoteStream])

  const addChatMessage = (sender, message) => {
    setChatMessages((prev) => [
      ...prev,
      {
        sender,
        message,
        timestamp: new Date(),
      },
    ])
  }

  const forceReleaseCameraMultiple = async () => {
    console.log('[Camera Release] Starting camera release...')
    const attempts = 3
    for (let i = 0; i < attempts; i++) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
        tempStream.getTracks().forEach(track => {
          track.stop()
        })
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.log(`[Camera Release] Attempt ${i + 1} failed:`, error.message)
      }
    }
  }

  const startLocalVideoWithRetry = async (maxRetries = 3) => {
    setIsRetrying(true)
    let currentRetry = retryCount

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await forceReleaseCameraMultiple()
        await new Promise(resolve => setTimeout(resolve, 1000))
        const success = await startLocalVideo()

        if (success) {
          setCameraError(null)
          setRetryCount(0)
          setIsRetrying(false)
          return true
        }
      } catch (error) {
        currentRetry = attempt + 1
        setRetryCount(currentRetry)
        if (attempt < maxRetries - 1) {
          addChatMessage("System", `Retrying camera access... (${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }

    setIsRetrying(false)
    setCameraError({
      type: 'NotReadableError',
      message: 'Camera is in use by another application',
      attempts: maxRetries
    })

    return false
  }

  const loadAppointments = async (doctorId) => {
    try {
      setLoading(true)
      const response = await appointmentsAPI.getDoctorAppointments(doctorId)
      const appointments = Array.isArray(response) ? response : (response.results || [])
      const confirmed = appointments.filter(apt => apt.status === 'confirmed')
      setConfirmedAppointments(confirmed)
    } catch (error) {
      console.error("[DoctorVideo] Error loading appointments:", error)
      addChatMessage("System", "Error loading appointments: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const openPrescriptionModal = () => {
    if (!selectedAppointment) {
      alert('No active consultation')
      return
    }

    setPrescriptionForm({
      patient_name: selectedAppointment.patient_name,
      patient_age: selectedAppointment.patient_age || '',
      patient_gender: selectedAppointment.patient_gender || '',
      diagnosis: '',
      medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      notes: '',
      follow_up_date: '',
    })
    setShowPrescriptionModal(true)
  }

  const addMedication = () => {
    setPrescriptionForm(prev => ({
      ...prev,
      medications: [...prev.medications, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    }))
  }

  const removeMedication = (index) => {
    if (prescriptionForm.medications.length === 1) {
      alert('At least one medication is required')
      return
    }
    setPrescriptionForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }))
  }

  const updateMedication = (index, field, value) => {
    setPrescriptionForm(prev => {
      const newMedications = [...prev.medications]
      newMedications[index][field] = value
      return { ...prev, medications: newMedications }
    })
  }

  const updateFormField = (field, value) => {
    setPrescriptionForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const sendPrescription = async () => {
    try {
      if (!prescriptionForm.diagnosis.trim()) {
        alert('Please enter diagnosis')
        return
      }

      const invalidMeds = prescriptionForm.medications.filter(
        med => !med.name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()
      )

      if (invalidMeds.length > 0) {
        alert('Please fill all required medication fields (name, dosage, frequency, duration)')
        return
      }

      setSendingPrescription(true)
      const doctorProfile = currentUser.doctor_profile || {}

      const prescriptionData = {
        patient_name: prescriptionForm.patient_name,
        patient_age: prescriptionForm.patient_age,
        patient_gender: prescriptionForm.patient_gender,
        patient_phone: selectedAppointment.patient_phone,
        doctor_name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.username,
        doctor_specialization: doctorProfile.specialization || 'General Physician',
        diagnosis: prescriptionForm.diagnosis,
        medications: prescriptionForm.medications,
        notes: prescriptionForm.notes,
        follow_up_date: prescriptionForm.follow_up_date || null,
        date: new Date().toISOString().split('T')[0],
        appointment_id: selectedAppointment.id,
      }

      const response = await prescriptionsAPI.createPrescription(prescriptionData)
      addChatMessage("System", "✅ Prescription sent successfully to patient")

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(
          JSON.stringify({
            type: "prescription_sent",
            sender_id: currentUser.id,
            prescription_id: response.id,
            data: prescriptionData
          })
        )
      }

      setShowPrescriptionModal(false)
      alert('✅ Prescription sent successfully!')

    } catch (error) {
      console.error('[Prescription] Error:', error)
      alert('❌ Error sending prescription: ' + (error.message || 'Unknown error'))
    } finally {
      setSendingPrescription(false)
    }
  }

  const acceptConsultation = async (appointment) => {
    try {
      setSelectedAppointment(appointment)
      addChatMessage("System", `Starting consultation with ${appointment.patient_name}...`)

      const doctorId = currentUser.id
      let patientId = appointment.patient_id ||
        appointment.patient?.id ||
        appointment.patient_details?.id ||
        appointment.patient ||
        `appointment_${appointment.id}`

      let room = null
      try {
        const existingRoomsResponse = await videoConsultationAPI.getAllRooms(doctorId)
        let existingRooms = []
        if (Array.isArray(existingRoomsResponse)) {
          existingRooms = existingRoomsResponse
        } else if (existingRoomsResponse?.rooms) {
          existingRooms = existingRoomsResponse.rooms
        } else if (existingRoomsResponse?.results) {
          existingRooms = existingRoomsResponse.results
        }

        room = existingRooms.find(r =>
          r.appointment === appointment.id &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
        )

        if (room) {
          addChatMessage("System", "Rejoining existing consultation room...")
        }
      } catch (err) {
        console.log('[DoctorVideo] Error checking for existing room:', err.message)
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

        try {
          room = await videoConsultationAPI.createRoom(roomData)
          addChatMessage("System", "New consultation room created")
        } catch (createError) {
          const minimalRoomData = {
            doctor_id: doctorId,
            appointment_id: appointment.id,
            scheduled_time: new Date().toISOString(),
            chat_enabled: true,
            screen_share_enabled: true,
            recording_enabled: false,
          }
          room = await videoConsultationAPI.createRoom(minimalRoomData)
          addChatMessage("System", "Consultation room created - waiting for patient")
        }
      }

      if (!room) {
        throw new Error('Failed to create or find consultation room')
      }

      setCurrentRoom(room)

      sessionStorage.setItem("active_appointment", JSON.stringify(appointment))
      sessionStorage.setItem("active_room", JSON.stringify(room))

      await videoConsultationAPI.joinRoom({
        room_id: room.room_id,
        user_id: currentUser.id,
      })

      addChatMessage("System", `Connected to consultation room. Starting video...`)
      await startLocalVideo()
      initializeWebSocket(room.room_id, currentUser.id)
      await loadAppointments(currentUser.id)

    } catch (error) {
      console.error("[DoctorVideo] ❌ Error accepting consultation:", error)
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      alert("Error starting consultation: " + errorMsg)
      addChatMessage("System", "Failed to start consultation: " + errorMsg)
      setSelectedAppointment(null)
      setCurrentRoom(null)
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
      setIsConnected(true)
      addChatMessage("System", "🔒 Connected – waiting for patient to join...")


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
      setIsConnected(false)
      addChatMessage("System", "Disconnected from consultation room")
    }
  }

  const handleWebSocketMessage = async (data) => {
    const myId = currentUserRef.current?.id || currentUser?.id
    switch (data.type) {
      case "user_connected": {

        if (data.user_id === myId) break
        addChatMessage("System", `${data.user_name || 'Patient'} joined the room 🔒`)
        setIsRemoteVideoOn(true)
        setIsRemoteMicOn(true)

        remoteUserIdRef.current = data.user_id

        if (localStreamRef.current) {
          await createOffer(data.user_id)
        }
        break
      }

      case "user_disconnected": {
        if (data.user_id === myId) break
        addChatMessage("System", `${data.user_name || 'Patient'} left the room`)
        handleRemoteDisconnect()
        break
      }

      case "call_ended": {
        if (data.sender_id === myId) break
        alert("The conversation has been completed and ended by the patient.")
        sessionStorage.removeItem("active_appointment")
        sessionStorage.removeItem("active_room")
        closeConnection()
        setCurrentRoom(null)
        setSelectedAppointment(null)
        setCopilotData(null)
        setCameraError(null)
        setRetryCount(0)
        setIsMicOn(true)
        setIsVideoOn(true)
        if (myId) {
          await loadAppointments(myId)
        }
        break
      }

      case "webrtc_offer":
        if (data.receiver_id === myId) {
          remoteUserIdRef.current = data.sender_id
          await handleReceiveOffer(data.sdp, data.sender_id)
        }
        break

      case "webrtc_answer":
        if (data.receiver_id === myId) {
          await handleReceiveAnswer(data.sdp)
        }
        break

      case "ice_candidate":
        if (data.receiver_id === myId) {
          await handleReceiveIceCandidate(data.candidate)
        }
        break

      case "chat_message": {
        if (data.sender_id !== myId) {
          let displayText = data.content
          if (data.iv && e2eKeyRef.current) {
            try {
              displayText = await decryptMessage(data.content, data.iv, e2eKeyRef.current)
            } catch (err) {
              console.warn('[E2E] Decryption failed – showing raw:', err)
            }
          }
          addChatMessage(data.sender_name, displayText)
        }
        break
      }

      case "user_status":
        if (data.user_id !== myId) {
          if (data.video_enabled !== undefined) setIsRemoteVideoOn(data.video_enabled)
          if (data.audio_enabled !== undefined) setIsRemoteMicOn(data.audio_enabled)
        }
        break

      case "copilot_update":
        if (data.suggestions) {
          console.log("[Co-pilot] Received live symptom suggestions:", data)
          setCopilotData({
            transcript: data.transcript,
            suggestions: data.suggestions,
            detectedLanguage: data.detected_language,
            timestamp: data.timestamp
          })
        }
        break

      case "screen_share": {
        const action = data.action === "start" ? "started" : "stopped"
        addChatMessage("System", `Patient ${action} screen sharing`)
        break
      }

      default:
        console.log("[WebSocket] Unknown message type:", data.type)
    }
  }

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(iceServers)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current)
      })
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams
      setRemoteStream(stream)
      addChatMessage("System", "Patient connected to video call")
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          sendICECandidate(event.candidate)
        }
      }
    }

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        addChatMessage("System", "Peer-to-peer connection established")
      } else if (peerConnection.connectionState === "disconnected") {
        addChatMessage("System", "Connection interrupted")
      } else if (peerConnection.connectionState === "failed") {
        addChatMessage("System", "Connection failed - attempting to reconnect")
      }
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
        websocketRef.current.send(
          JSON.stringify({
            type: "webrtc_offer",
            sender_id: currentUserRef.current?.id || currentUser?.id,
            receiver_id: receiverId,
            sdp: offer,
          })
        )
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
        websocketRef.current.send(
          JSON.stringify({
            type: "webrtc_answer",
            sender_id: currentUserRef.current?.id || currentUser?.id,
            receiver_id: senderId,
            sdp: answer,
          })
        )
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
      websocketRef.current.send(
        JSON.stringify({
          type: "ice_candidate",
          sender_id: currentUserRef.current?.id || currentUser?.id,
          receiver_id: receiverId,
          candidate: candidate,
        })
      )
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
      navigate('/auth?type=doctor&view=login')
      return false
    }

    if (videoStarting) {
      return false
    }

    try {
      setVideoStarting(true)

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop()
        })
        localStreamRef.current = null
        setLocalStream(null)
      }

      addChatMessage("System", "Requesting camera access...")

      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
      } catch (error) {
        console.log('[DoctorVideo] HD failed, trying basic...')
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      setShowStatusBadge(true)
      setIsMicOn(true)
      setIsVideoOn(true)
      addChatMessage("System", "✅ Your video stream is active")
      return true

    } catch (error) {
      console.error("[DoctorVideo] ❌ Camera error:", error.name, error.message)
      let errorMessage = "Could not access camera/microphone. "
      if (error.name === "NotAllowedError") {
        errorMessage += "Please allow camera and microphone permissions."
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera or microphone found."
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera is being used by another application."
      } else {
        errorMessage += error.message
      }

      addChatMessage("System", "❌ " + errorMessage)
      throw error

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
          websocketRef.current.send(
            JSON.stringify({
              type: "user_status",
              user_id: currentUser.id,
              audio_enabled: audioTrack.enabled,
              video_enabled: isVideoOn,
            })
          )
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
          websocketRef.current.send(
            JSON.stringify({
              type: "user_status",
              user_id: currentUser.id,
              audio_enabled: isMicOn,
              video_enabled: videoTrack.enabled,
            })
          )
        }
      }
    }
  }

  const closeConnection = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      localStreamRef.current = null
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (websocketRef.current) {
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close()
      }
      websocketRef.current = null
    }

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
          await videoConsultationAPI.endConsultation({
            room_id: currentRoom.room_id,
            user_id: currentUser.id,
            duration: currentRoom.started_at
              ? Math.floor((new Date() - new Date(currentRoom.started_at)) / 1000)
              : 0
          })
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
        setCopilotData(null)
        setCameraError(null)
        setRetryCount(0)
        setIsMicOn(true)
        setIsVideoOn(true)
        await loadAppointments(currentUser.id)
      }
    }
  }

  const shareScreen = async () => {
    if (!localStreamRef.current) {
      alert("Please start your video first")
      return
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      })

      const screenTrack = screenStream.getVideoTracks()[0]

      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video")
        if (sender) {
          sender.replaceTrack(screenTrack)
        }
      }

      if (localVideoRef.current) {
        const newStream = new MediaStream([screenTrack, ...localStreamRef.current.getAudioTracks()])
        localVideoRef.current.srcObject = newStream
      }

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(
          JSON.stringify({
            type: "screen_share",
            user_id: currentUser.id,
            action: "start",
          })
        )
      }

      screenTrack.onended = () => {
        addChatMessage("System", "Screen sharing stopped")
        restoreCamera()
      }

      addChatMessage("System", "Screen sharing started")
    } catch (error) {
      console.error("Error sharing screen:", error)
      addChatMessage("System", "Screen sharing cancelled or failed")
    }
  }

  const restoreCamera = async () => {
    if (localStreamRef.current && peerConnectionRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video")

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack)
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }

      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(
          JSON.stringify({
            type: "screen_share",
            user_id: currentUser.id,
            action: "stop",
          })
        )
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

    websocketRef.current.send(
      JSON.stringify({
        type: "chat_message",
        sender_id: currentUser.id,
        sender_name: `Dr. ${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.username,
        content,
        iv,
        message_type: "text",
      })
    )

    addChatMessage("You", message)
    setChatInput("")
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full mx-4">
          <FaUserMd className="w-12 h-12 text-green-600 animate-pulse mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900">Authentication Required</h2>
          <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">Please sign in as a medical practitioner to launch consultations.</p>
          <button
            className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            onClick={() => navigate('/auth?type=doctor&view=login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${
      currentRoom
        ? 'fixed inset-0 overflow-hidden z-50 bg-slate-900'
        : 'min-h-screen bg-gradient-to-b from-green-50/20 via-slate-50 to-white'
    } text-slate-850 flex flex-col justify-between`}>

      {}
      <header className={`border-b sticky top-0 z-50 transition-colors flex-shrink-0 ${currentRoom ? 'bg-slate-900/95 border-white/10 backdrop-blur-md' : 'bg-white/80 border-slate-200/80 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/doctor-dashboard')}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform ${currentRoom ? 'bg-white/10 text-green-400 border border-white/10' : 'bg-green-600/10 text-green-600 border border-green-500/10'}`}>
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className={`text-lg font-black tracking-tight ${currentRoom ? 'text-white' : 'text-slate-955'}`}>Rural HealthCare</span>
          </div>

          <div className="flex items-center gap-2">
            {!currentRoom && (
              <button
                onClick={() => navigate('/doctor-dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <FaArrowLeft /> Dashboard
              </button>
            )}
            {showStatusBadge && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-full text-[11px] font-black uppercase tracking-wider ${currentRoom ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-600/10 text-green-600 border-green-500/20'}`}>
                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                <span>{isConnected ? "In Call" : "Connecting..."}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {}
      <main className={`flex-1 w-full flex flex-col min-h-0 ${currentRoom ? 'p-0 overflow-hidden h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>


        {!currentRoom ? (

          <div className="space-y-8 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FaClinicMedical className="text-green-600" /> Virtual Lobby
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Sync with incoming telemetry video slots and waiting patients</p>
              </div>

              <button
                onClick={() => loadAppointments(currentUser.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Refreshing Queue...' : 'Refresh Appointments'}
              </button>
            </div>

            {confirmedAppointments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {confirmedAppointments.map((appointment) => (
                  <div key={appointment.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs text-slate-500 font-extrabold uppercase">
                            {getPatientInitials(appointment.patient_name)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{appointment.patient_name}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold">{appointment.patient_phone}</p>
                          </div>
                        </div>
                        <span className="text-[9px] text-green-600 font-black uppercase tracking-wider px-2 py-0.5 bg-green-50 border border-green-200 rounded-md">
                          Confirmed
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
                        <p className="flex items-center gap-2">
                          <strong className="text-slate-450 uppercase text-[9px] tracking-wider block w-20">Appointment:</strong>
                          <span className="text-slate-800 font-bold">{formatDate(appointment.preferred_date)} @ {appointment.preferred_time}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <strong className="text-slate-450 uppercase text-[9px] tracking-wider block w-20 pt-0.5">Symptoms:</strong>
                          <span className="text-slate-700 flex-1 leading-relaxed">{appointment.symptoms}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => acceptConsultation(appointment)}
                      className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-green-600/10 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FaVideo /> Start consultation
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl max-w-md mx-auto flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-2xl border border-slate-150">
                  <FaCalendarCheck />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">Consultation List is Empty</h3>
                  <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">There are currently no confirmed telemedicine appointments waiting for you.</p>
                </div>
              </div>
            )}
          </div>
        ) : (

          <div className="flex h-full max-h-full min-h-0 overflow-hidden bg-slate-900">

            {}
            <div className="flex-1 relative overflow-hidden" style={{minWidth:0}}>

              {}
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center overflow-hidden">

                {}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 z-40 flex flex-col items-center justify-center p-6 text-center">
                    <FaExclamationTriangle className="text-amber-400 w-12 h-12 mb-4 animate-bounce" />
                    <h3 className="text-lg font-black text-white">Video Feed Failure</h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-2 font-semibold">Your web camera is blocked or currently occupied by another browser session.</p>

                    <div className="flex gap-3 mt-6 flex-wrap justify-center">
                      <button
                        onClick={() => startLocalVideoWithRetry(3)}
                        disabled={isRetrying}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <FaRedo className={isRetrying ? 'animate-spin' : ''} /> {isRetrying ? 'Retrying...' : 'Quick Reload'}
                      </button>
                      <button
                        onClick={endCall}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Leave consultation
                      </button>
                    </div>
                  </div>
                )}

                {}
                {isRetrying && !cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 z-30 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-green-400 rounded-full animate-spin mb-4"></div>
                    <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Acquiring media tracks... (Attempt {retryCount}/3)</p>
                  </div>
                )}

                {}
                {!localStream && !cameraError && !isRetrying ? (
                  <div className="text-center space-y-3 z-10">
                    <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 text-xl mx-auto animate-pulse">
                      <FaUserMd />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white">Opening Room Feed...</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Connecting client to {selectedAppointment?.patient_name}</p>
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
                            {getPatientInitials(selectedAppointment?.patient_name)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-white">{selectedAppointment?.patient_name || 'Patient'}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                              {!remoteStream ? 'Awaiting patient check-in...' : 'Patient has switched video off'}
                            </p>
                          </div>
                        </div>
                      )}

                      {remoteStream && (
                        <span className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white rounded-md">
                          {selectedAppointment?.patient_name} {!isRemoteMicOn && ' 🔇'}
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
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xs text-slate-700 font-extrabold border border-slate-300">
                            {getInitials(currentUser?.first_name, currentUser?.last_name)}
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
                  title="Screen Share"
                >
                  <FaDesktop />
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  disabled={!localStream}
                  className={`w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full flex items-center justify-center transition-all cursor-pointer ${showChat ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                    }`}
                  title="Toggle Chat"
                >
                  <FaComments />
                </button>
                <button
                  onClick={() => setShowCopilot(!showCopilot)}
                  disabled={!localStream}
                  className={`w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full flex items-center justify-center transition-all cursor-pointer ${showCopilot ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                    }`}
                  title="Toggle AI Co-Pilot"
                >
                  <span style={{ fontSize: '14px' }}>🧠</span>
                </button>
                <button
                  onClick={openPrescriptionModal}
                  disabled={!selectedAppointment}
                  className="w-9 h-9 sm:w-11 sm:h-11 text-sm rounded-full bg-green-500 hover:bg-green-600 text-white border border-green-400/30 flex items-center justify-center transition-all cursor-pointer"
                  title="Issue Prescription Sheet"
                >
                  <FaPrescriptionBottle />
                </button>
                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                <button
                  onClick={endCall}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Hang Up Consultation"
                >
                  <FaPhoneSlash /> Leave
                </button>
              </div>

            </div>

            {}
            {showChat && (
              <div className="w-80 flex-shrink-0 border-l border-white/10 bg-slate-900 flex flex-col overflow-hidden h-full max-h-full min-h-0">

                {}
                <div className="p-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-black text-green-400 uppercase tracking-widest">Active Consultation</h3>
                    <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs">✕</button>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1 text-xs">
                    <p className="text-slate-300">Patient: <strong className="text-white font-bold">{selectedAppointment?.patient_name}</strong></p>
                    <p className="text-slate-400 text-[10px]">Symptoms: {selectedAppointment?.symptoms}</p>
                  </div>
                </div>

                {}
                <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-green-400 uppercase tracking-widest">Consultation Chat</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/40 border border-green-500/30 text-green-400 rounded-full text-[9px] font-bold">
                      <FaLock style={{fontSize:'8px'}} /> E2E Encrypted
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

            {}
            {showCopilot && (
              <div className="w-80 flex-shrink-0 border-l border-white/10 bg-slate-950 flex flex-col overflow-hidden h-full max-h-full min-h-0 text-white">

                {}
                <div className="p-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      <h3 className="text-[10px] font-black text-green-400 uppercase tracking-widest">Symptom Co-Pilot</h3>
                    </div>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    Live patient audio is translated and analyzed automatically.
                  </p>
                </div>

                {}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0">
                  {!copilotData ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg mb-3 animate-pulse">
                        🎙️
                      </div>
                      <h4 className="text-xs font-bold text-slate-355">Listening for patient...</h4>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-[180px]">
                        Speak in Malayalam, Hindi, Tamil, Kannada, or English. Translated analysis will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      {}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-wider block">Live Translation</span>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-xs leading-relaxed italic text-slate-300">
                          "{copilotData.transcript}"
                        </div>
                      </div>

                      {}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Severity</span>
                          <span className={`text-[11px] font-extrabold mt-0.5 block capitalize ${
                            copilotData.suggestions?.severity === 'severe' ? 'text-rose-400' :
                            copilotData.suggestions?.severity === 'moderate' ? 'text-amber-400' : 'text-slate-200'
                          }`}>
                            {copilotData.suggestions?.severity || 'unknown'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Duration</span>
                          <span className="text-[11px] font-extrabold text-slate-200 mt-0.5 block capitalize">
                            {copilotData.suggestions?.duration || 'Not specified'}
                          </span>
                        </div>
                      </div>

                      {}
                      {copilotData.suggestions?.red_flags && (
                        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl space-y-1">
                          <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1">
                            ⚠️ Red Flag Alert
                          </span>
                          <p className="text-[10px] text-rose-200 leading-relaxed font-semibold">
                            {copilotData.suggestions.red_flags}
                          </p>
                        </div>
                      )}

                      {}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-wider block">Extracted Symptoms</span>
                        <div className="flex flex-wrap gap-1">
                          {copilotData.suggestions?.symptoms && copilotData.suggestions.symptoms.length > 0 ? (
                            copilotData.suggestions.symptoms.map((symptom, i) => (
                              <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-[10px] font-bold capitalize">
                                {symptom}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">No specific symptoms parsed yet</span>
                          )}
                        </div>
                      </div>

                      {}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-wider block">Recommended Questions</span>
                        <ul className="space-y-2">
                          {copilotData.suggestions?.suggested_questions?.map((q, i) => (
                            <li key={i} className="flex gap-2 text-[10px] leading-relaxed text-slate-300 p-2 bg-white/5 border border-white/5 rounded-xl">
                              <span className="text-green-500 font-extrabold">{i+1}.</span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-wider block">Differential Diagnoses</span>
                        <ul className="space-y-1.5">
                          {copilotData.suggestions?.possible_conditions?.map((cond, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-[10px] text-slate-350 px-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                              <span className="capitalize">{cond}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => !sendingPrescription && setShowPrescriptionModal(false)}>
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800" onClick={(e) => e.stopPropagation()}>

            {}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-green-800 to-green-700 text-white">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <FaFileMedical className="text-green-450" /> Create Digital Prescription
              </h2>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                disabled={sendingPrescription}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-50 text-white hover:text-red-655 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

              {}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest pb-1 border-b border-slate-100">1. Demographics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Name</label>
                    <input
                      type="text"
                      value={prescriptionForm.patient_name}
                      disabled
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Age</label>
                    <input
                      type="text"
                      value={prescriptionForm.patient_age}
                      onChange={(e) => updateFormField('patient_age', e.target.value)}
                      placeholder="Age"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gender</label>
                    <select
                      value={prescriptionForm.patient_gender}
                      onChange={(e) => updateFormField('patient_gender', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:border-green-500 cursor-pointer"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest pb-1 border-b border-slate-100">2. Diagnosis</h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Diagnosis / Clinical Findings *</label>
                  <input
                    type="text"
                    value={prescriptionForm.diagnosis}
                    onChange={(e) => updateFormField('diagnosis', e.target.value)}
                    placeholder="Enter diagnosis"
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              {}
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                  <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest">3. Medications</h3>
                  <button
                    type="button"
                    onClick={addMedication}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <FaPlus /> Add Medication
                  </button>
                </div>

                <div className="space-y-4">
                  {prescriptionForm.medications.map((med, index) => (
                    <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-green-600 font-black uppercase tracking-wider">Medicine #{index + 1}</span>
                        {prescriptionForm.medications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedication(index)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <FaTimes /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Medicine Name *</label>
                          <input
                            type="text"
                            placeholder="e.g., Paracetamol"
                            value={med.name}
                            onChange={(e) => updateMedication(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dosage *</label>
                          <input
                            type="text"
                            placeholder="e.g., 500mg"
                            value={med.dosage}
                            onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Frequency *</label>
                          <input
                            type="text"
                            placeholder="e.g., Twice daily"
                            value={med.frequency}
                            onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Duration *</label>
                          <input
                            type="text"
                            placeholder="e.g., 5 days"
                            value={med.duration}
                            onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Intake Instructions</label>
                        <input
                          type="text"
                          placeholder="e.g., Take after meals"
                          value={med.instructions}
                          onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-green-600 uppercase tracking-widest pb-1 border-b border-slate-100">4. Additional Notes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Follow-up Date</label>
                    <input
                      type="date"
                      value={prescriptionForm.follow_up_date}
                      onChange={(e) => updateFormField('follow_up_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-semibold">Special Notes / Diet Advice</label>
                    <textarea
                      value={prescriptionForm.notes}
                      onChange={(e) => updateFormField('notes', e.target.value)}
                      placeholder="Any additional remarks..."
                      rows="3"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none resize-none min-h-[60px]"
                    />
                  </div>
                </div>
              </div>

            </div>

            {}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setShowPrescriptionModal(false)}
                disabled={sendingPrescription}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={sendPrescription}
                disabled={sendingPrescription}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
              >
                {sendingPrescription ? 'Sending...' : <><FaSave /> Send Prescription</>}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

export default DoctorVideoConsultation