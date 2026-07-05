import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  FaVideo,
  FaCalendarCheck,
  FaPrescriptionBottle,
  FaChartLine,
  FaClock,
  FaUserMd,
  FaSignOutAlt,
  FaPhone,
  FaMapMarkerAlt,
  FaHeartbeat,
  FaBell,
  FaChevronDown,
  FaPills,
  FaNotesMedical,
  FaClipboardList,
  FaAward,
  FaEye,
  FaPlus,
  FaCheckCircle,
  FaTimesCircle,
  FaRobot,
  FaRunning,
  FaBullseye,
  FaTint,
  FaWeight,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
} from "react-icons/fa"
import { doctorRatingsAPI } from "../services/api"
import {
  authAPI,
  videoConsultationAPI,
  appointmentsAPI,
  prescriptionsAPI,
  healthTrackingAPI
} from "../services/api"
import LanguageSelector from './common/LanguageSelector'
import Footer from "./Footer"
import "./PatientDashboard.css"
import "./Dashboard.css"


const PatientDashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    totalAppointments: 0,
    activePrescriptions: 0,
    healthMetrics: 0,
    pendingConsultations: 0,
    completedConsultations: 0,
    activeGoals: 0,
    medicationReminders: 0,
  })
  const [myDoctors, setMyDoctors] = useState([])
  const [consultations, setConsultations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [ratingData, setRatingData] = useState({
    rating: 0,
    review: '',
    pros: '',
    cons: '',
    would_recommend: true,
  })

  useEffect(() => {
    const checkAuth = () => {
      console.log('[PatientDashboard] Checking authentication...')
      const userData = authAPI.getCurrentUser()
      console.log('[PatientDashboard] User data from localStorage:', userData)

      if (!userData) {
        console.log('[PatientDashboard] ❌ No user data found - redirecting to login')
        setIsCheckingAuth(false)
        navigate('/auth?type=patient&view=login')
        return
      }

      if (userData.user_type !== 'patient') {
        console.log('[PatientDashboard] ❌ User is not a patient, type:', userData.user_type)
        alert(`This is the patient dashboard. You are logged in as ${userData.user_type}. Please logout and login as a patient.`)
        setIsCheckingAuth(false)
        navigate('/')
        return
      }

      console.log('[PatientDashboard] ✅ Patient authenticated:', userData.first_name, userData.last_name)
      console.log('[PatientDashboard] Patient ID:', userData.id)
      setUser(userData)
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, [navigate])

  useEffect(() => {
    if (user && !isCheckingAuth) {
      console.log('[PatientDashboard] Loading dashboard data for patient:', user.id)
      loadDashboardData(user.id)
    }
  }, [user, isCheckingAuth])


  useEffect(() => {
    if (!user || isCheckingAuth) return

    const interval = setInterval(() => {
      console.log('[PatientDashboard] Auto-refreshing data...')
      loadDashboardData(user.id)
    }, 60000)

    return () => clearInterval(interval)
  }, [user, isCheckingAuth])

  const loadMyDoctors = async (patientId) => {
    try {
      console.log('[PatientDashboard] Loading my doctors for patient:', patientId)
      const response = await doctorRatingsAPI.getPatientDoctors(patientId)
      console.log('[PatientDashboard] Raw doctors response:', response)

      if (response && response.success && Array.isArray(response.doctors)) {
        setMyDoctors(response.doctors)
        console.log('[PatientDashboard] ✅ Loaded', response.doctors.length, 'doctors')
      } else if (Array.isArray(response)) {
        setMyDoctors(response)
        console.log('[PatientDashboard] ✅ Loaded', response.length, 'doctors (array format)')
      } else {
        console.log('[PatientDashboard] ⚠️ No doctors found in response')
        setMyDoctors([])
      }
    } catch (error) {
      console.error('[PatientDashboard] Error loading doctors:', error)
      setMyDoctors([])
    }
  }


  const loadDashboardData = async (patientId) => {
    try {
      setLoading(true)
      console.log('\n' + '='.repeat(60))
      console.log('LOADING PATIENT DASHBOARD DATA:', patientId)
      console.log('='.repeat(60))

      console.log('\n📹 Fetching video consultations...')
      let patientRoomsResponse = await videoConsultationAPI.getPatientRooms(patientId)
      let patientRooms = []

      if (Array.isArray(patientRoomsResponse)) {
        patientRooms = patientRoomsResponse
      } else if (patientRoomsResponse && Array.isArray(patientRoomsResponse.rooms)) {
        patientRooms = patientRoomsResponse.rooms
      }

      console.log('✅ Consultations count:', patientRooms.length)

      console.log('\n📅 Fetching appointments...')
      let patientAppointments = []

      try {
        let appointmentsResponse = await appointmentsAPI.getPatientAppointments(patientId)

        if (Array.isArray(appointmentsResponse)) {
          patientAppointments = appointmentsResponse
        } else if (appointmentsResponse && appointmentsResponse.results) {
          patientAppointments = appointmentsResponse.results
        }

        console.log('✅ Appointments count:', patientAppointments.length)
      } catch (error) {
        console.error('❌ Error fetching appointments:', error)
      }

      console.log('\n💊 Fetching prescriptions...')
      let patientPrescriptions = []

      try {
        let prescriptionsResponse = await prescriptionsAPI.getPatientPrescriptions(patientId)

        if (Array.isArray(prescriptionsResponse)) {
          patientPrescriptions = prescriptionsResponse
        } else if (prescriptionsResponse && prescriptionsResponse.results) {
          patientPrescriptions = prescriptionsResponse.results
        }

        console.log('✅ Prescriptions count:', patientPrescriptions.length)
      } catch (error) {
        console.error('❌ Error fetching prescriptions:', error)
      }

      console.log('\n❤️ Fetching health tracking data...')
      let dashboardData = null

      try {
        let healthResponse = await healthTrackingAPI.getDashboard(patientId)

        if (healthResponse && healthResponse.success && healthResponse.dashboard) {
          dashboardData = healthResponse.dashboard
          console.log('✅ Health data loaded')
        }
      } catch (error) {
        console.error('❌ Error fetching health data:', error)
      }

      await loadMyDoctors(patientId)

      const today = new Date().toDateString()

      const upcomingApts = patientAppointments.filter(apt =>
        new Date(apt.preferred_date) >= new Date() && apt.status !== 'cancelled'
      )

      const pendingConsults = patientRooms.filter(r =>
        r.status === 'scheduled' || r.status === 'waiting'
      )

      const completedConsults = patientRooms.filter(r =>
        r.status === 'completed'
      )

      const activePrescriptions = patientPrescriptions.filter(p =>
        p.status === 'active'
      )

      setStats({
        upcomingAppointments: upcomingApts.length,
        totalAppointments: patientAppointments.length,
        activePrescriptions: activePrescriptions.length,
        healthMetrics: dashboardData?.latest_metrics?.length || 0,
        pendingConsultations: pendingConsults.length,
        completedConsultations: completedConsults.length,
        activeGoals: dashboardData?.active_goals?.length || 0,
        medicationReminders: dashboardData?.medication_reminders?.length || 0,
      })

      setConsultations(patientRooms.sort((a, b) =>
        new Date(b.scheduled_time) - new Date(a.scheduled_time)
      ).slice(0, 5))

      setAppointments(patientAppointments.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 5))

      setPrescriptions(patientPrescriptions.slice(0, 5))
      setHealthData(dashboardData)

      console.log('\n' + '='.repeat(60))
      console.log('DASHBOARD DATA LOADED SUCCESSFULLY')
      console.log('='.repeat(60) + '\n')

    } catch (error) {
      console.error("\n❌ ERROR LOADING DASHBOARD DATA")
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    console.log('[PatientDashboard] Logging out...')
    authAPI.logout()
    navigate('/auth?type=patient&view=login')
  }

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return
    }

    try {
      await appointmentsAPI.cancelAppointment(appointmentId)
      alert('Appointment cancelled successfully!')

      if (user) {
        await loadDashboardData(user.id)
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      alert('Failed to cancel appointment: ' + error.message)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
      case 'pending':
        return '#4338ca'
      case 'waiting':
        return '#92400e'
      case 'ongoing':
      case 'confirmed':
      case 'active':
        return '#047857'
      case 'completed':
        return '#059669'
      case 'cancelled':
        return '#dc2626'
      default:
        return '#6b7280'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'scheduled': return 'Scheduled'
      case 'pending': return 'Pending Confirmation'
      case 'waiting': return 'Doctor Will Join Soon'
      case 'ongoing': return 'In Progress'
      case 'confirmed': return 'Confirmed'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      case 'active': return 'Active'
      default: return status
    }
  }

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleOpenRatingModal = (doctor) => {
    setSelectedDoctor(doctor)
    setRatingData({
      rating: doctor.my_rating || 0,
      review: doctor.my_review || '',
      pros: '',
      cons: '',
      would_recommend: true,
    })
    setShowRatingModal(true)
  }

  const handleCloseRatingModal = () => {
    setShowRatingModal(false)
    setSelectedDoctor(null)
    setRatingData({
      rating: 0,
      review: '',
      pros: '',
      cons: '',
      would_recommend: true,
    })
  }

  const handleSubmitRating = async () => {
    if (!selectedDoctor || ratingData.rating === 0) {
      alert('Please select a rating')
      return
    }

    try {
      const payload = {
        doctor_id: selectedDoctor.id,
        patient_id: user.id,
        rating: ratingData.rating,
        review: ratingData.review,
        pros: ratingData.pros,
        cons: ratingData.cons,
        would_recommend: ratingData.would_recommend,
      }

      await doctorRatingsAPI.createRating(payload)
      alert('Rating submitted successfully!')
      handleCloseRatingModal()

      if (user) {
        await loadMyDoctors(user.id)
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      alert('Failed to submit rating: ' + error.message)
    }
  }

  const renderStars = (rating, size = 16, interactive = false, onRate = null) => {
    const stars = []

    for (let i = 1; i <= 5; i++) {
      if (interactive) {
        stars.push(
          <button
            key={i}
            type="button"
            onClick={() => onRate && onRate(i)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {i <= rating ? (
              <FaStar size={size} style={{ color: '#fbbf24' }} />
            ) : (
              <FaRegStar size={size} style={{ color: '#d1d5db' }} />
            )}
          </button>
        )
      } else {
        const fullStars = Math.floor(rating)
        const hasHalfStar = rating % 1 >= 0.5

        if (i <= fullStars) {
          stars.push(<FaStar key={i} size={size} style={{ color: '#fbbf24' }} />)
        } else if (i === fullStars + 1 && hasHalfStar) {
          stars.push(<FaStarHalfAlt key={i} size={size} style={{ color: '#fbbf24' }} />)
        } else {
          stars.push(<FaRegStar key={i} size={size} style={{ color: '#d1d5db' }} />)
        }
      }
    }

    return <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>{stars}</div>
  }

  const quickActions = [
    {
      icon: <FaRobot size={24} />,
      title: "AI Health Assistant",
      description: "Get instant medical advice 24/7",
      path: "/chat",
      color: "#16a34a",
    },
    {
      icon: <FaCalendarCheck size={24} />,
      title: "Book Appointment",
      description: "Schedule a visit with a doctor",
      path: "/appointments",
      color: "#0070cd",
      badge: stats.upcomingAppointments || null,
    },
    {
      icon: <FaVideo size={24} />,
      title: "Video Consultation",
      description: "Connect with your doctor online",
      path: "/teleconsult",
      color: "#8b5cf6",
      urgent: stats.pendingConsultations > 0,
      badge: stats.pendingConsultations || null,
    },
    {
      icon: <FaChartLine size={24} />,
      title: "Health Tracking",
      description: "Monitor your vital signs & health",
      path: "/health-tracking",
      color: "#ff6b35",
    },
    {
      icon: <FaPrescriptionBottle size={24} />,
      title: "Prescriptions",
      description: "View your digital prescriptions",
      path: "/prescriptions",
      color: "#10b981",
    },
    {
      icon: <FaPills size={24} />,
      title: "Medicine Reminders",
      description: "Never miss your medication",
      path: "/medicines",
      color: "#f59e0b",
      badge: stats.medicationReminders || null,
    },
  ]

  if (isCheckingAuth) {
    return (
      <div className="patient-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="patient-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between patient-dashboard-container">

      {/* HEADER SECTION */}
      <header className="rural-topbar w-full">
        {/* Top Emergency Strip */}
        <div className="rural-info-strip hidden md:block py-2 bg-gradient-to-r from-green-800 to-green-700 text-white text-xs font-semibold">
          <div className="rural-wrapper max-w-7xl mx-auto px-4 md:px-8 flex justify-between items-center">
            <div className="rural-contact-info flex items-center gap-6">
              <span className="flex items-center gap-2"><FaPhone size={14} /> EMERGENCY HELPDESK: 108 / 102</span>
              <span className="flex items-center gap-2"><FaClock size={14} /> 24X7 AVAILABLE SUPPORT</span>
            </div>
            <div>
              <span className="flex items-center gap-2"><FaMapMarkerAlt size={14} /> SERVING RURAL INDIA</span>
            </div>
          </div>
        </div>

        {/* Navbar */}
        <div className="rural-navbar-wrap bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 py-2.5 md:py-4 shadow-sm">
          <div className="rural-wrapper max-w-7xl mx-auto px-4 md:px-8">
            <nav className="rural-navigation flex items-center justify-between w-full">
              <div className="rural-brand flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate("/patient-dashboard")}>
                <div className="rural-brand-icon bg-green-600 text-white p-2.5 rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center">
                  <FaHeartbeat size={24} />
                </div>
                <span className="rural-brand-name text-xl font-bold tracking-tight text-gray-800 inline-block">Rural HealthCare</span>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-gray-600">
                  <Link to="/" className="hover:text-green-600 transition-colors">Home</Link>
                  <Link to="/appointments" className="hover:text-green-600 transition-colors relative">
                    Appointments
                    {stats.upcomingAppointments > 0 && (
                      <span className="absolute -top-2.5 -right-3 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {stats.upcomingAppointments}
                      </span>
                    )}
                  </Link>
                  <Link to="/health-tracking" className="hover:text-green-600 transition-colors">Health Logs</Link>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-center">
                  <LanguageSelector />
                </div>

                {/* Profile Dropdown */}
                <div
                  className="rural-account-menu relative"
                  onMouseEnter={() => setShowProfileDropdown(true)}
                  onMouseLeave={() => setShowProfileDropdown(false)}
                >
                  <div className="user-profile-badge flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-all duration-200">
                    <div className="user-avatar-initials w-9 h-9 bg-green-600 text-white flex items-center justify-center font-bold text-xs rounded-full shadow-sm">
                      {user && user.first_name ? user.first_name.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                    <span className="user-name-label text-sm font-semibold text-gray-700 hidden lg:flex items-center gap-1">
                      {user && `${user.first_name} ${user.last_name || ''}`.trim()}
                      <FaChevronDown size={8} />
                    </span>
                  </div>

                  {showProfileDropdown && (
                    <ul className="header-dropdown__menu show" onClick={(e) => e.stopPropagation()}>
                      <li className="dropdown-section-title px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Signed in as</li>
                      <li className="px-4 pb-2 text-xs font-bold text-gray-700 truncate border-b border-gray-100">{user && user.username}</li>
                      <li>
                        <div
                          className="header-dropdown__item"
                          onClick={() => { setShowProfileDropdown(false); navigate('/patient-dashboard'); }}
                        >
                          Dashboard
                        </div>
                      </li>
                      <li>
                        <div
                          className="header-dropdown__item"
                          onClick={() => { setShowProfileDropdown(false); navigate('/patient-profile'); }}
                        >
                          My Profile
                        </div>
                      </li>
                      <li>
                        <div
                          className="header-dropdown__item text-red-600 hover:text-red-700"
                          onClick={() => {
                            setShowProfileDropdown(false)
                            authAPI.logout()
                            navigate('/')
                          }}
                        >
                          Logout
                        </div>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 text-center md:text-left z-10">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome Back, {user.first_name}!</h1>
            <p className="text-xs md:text-sm text-green-50 font-medium max-w-xl">
              Access your medical files, log vitals using AI, and join video consultations directly.
            </p>
          </div>
          <div className="text-white/20 z-0 pr-4 hidden md:block">
            <FaHeartbeat size={90} className="animate-pulse" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FaCalendarCheck size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-gray-900 block leading-tight">{stats.upcomingAppointments}</span>
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider block">Upcoming Visits</span>
            </div>
          </div>

          <div className={`rounded-2xl p-5 border shadow-sm flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300 relative ${stats.pendingConsultations > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-gray-200/85'}`}>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <FaVideo size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-gray-900 block leading-tight">{stats.pendingConsultations}</span>
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider block">Live Consults</span>
            </div>
            {stats.pendingConsultations > 0 && (
              <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> Live Now
              </span>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <FaPrescriptionBottle size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-gray-900 block leading-tight">{stats.activePrescriptions}</span>
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider block">Prescriptions</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <FaChartLine size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-gray-900 block leading-tight">{stats.healthMetrics}</span>
              <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider block">Vitals Logged</span>
            </div>
          </div>

        </div>

        {/* Quick Actions Panel */}
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <FaAward className="text-green-600" /> Digital Health Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, idx) => (
              <div
                key={idx}
                onClick={() => navigate(action.path)}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-green-500 hover:shadow-md cursor-pointer transition-all duration-300 relative group flex gap-4 items-start"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors ${action.color.split(' ')[0]} ${action.color.split(' ')[1]} ${action.color.split(' ')[2]}`}>
                  {action.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-900 group-hover:text-green-600 transition-colors">{action.title}</h3>
                  <p className="text-[11px] text-gray-400 font-medium leading-normal">{action.description}</p>
                </div>
                {action.badge && (
                  <span className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow">
                    {action.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs Control */}
        <div className="space-y-4">
          <div className="flex border-b border-gray-200 overflow-x-auto premium-dashboard-scroll pb-1 gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: <FaClipboardList /> },
              { id: 'appointments', label: 'My Appointments', icon: <FaCalendarCheck />, count: stats.upcomingAppointments },
              { id: 'consultations', label: 'Video Consults', icon: <FaVideo /> },
              { id: 'prescriptions', label: 'Prescriptions', icon: <FaPrescriptionBottle /> },
              { id: 'health', label: 'Health Summary', icon: <FaChartLine /> },
              { id: 'doctors', label: 'My Doctors', icon: <FaUserMd /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold whitespace-nowrap transition-all rounded-t-xl ${activeTab === tab.id ? 'border-green-600 text-green-700 bg-green-50/50' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* TAB RENDERPANELS */}
          <div className="min-h-[300px]">

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* Health Alerts */}
                {healthData?.alerts && healthData.alerts.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                      <FaBell className="animate-bounce" /> Clinical Health Alerts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {healthData.alerts.map((alert, index) => (
                        <div key={index} className="bg-white border border-rose-200/40 p-3.5 rounded-xl shadow-xs flex items-start gap-3">
                          <span className="w-2 h-2 mt-1.5 rounded-full bg-rose-500"></span>
                          <div>
                            <strong className="text-xs font-bold text-gray-800 block">{alert.message}</strong>
                            <span className="text-[10px] text-gray-400 font-semibold">{alert.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overview cards sub-grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Up apts */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <FaCalendarCheck className="text-green-600" /> Upcoming Visits
                    </h3>
                    {appointments.filter(apt => new Date(apt.preferred_date) >= new Date()).length > 0 ? (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto premium-dashboard-scroll pr-1">
                        {appointments
                          .filter(apt => new Date(apt.preferred_date) >= new Date())
                          .slice(0, 3)
                          .map(apt => (
                            <div key={apt.id} className="flex justify-between items-center bg-gray-50 hover:bg-gray-100/70 p-3 rounded-xl border border-gray-200 transition-colors">
                              <div>
                                <strong className="text-xs font-bold text-gray-800 block">Dr. {apt.doctor_details?.user?.first_name || 'Physician'}</strong>
                                <span className="text-[10px] text-gray-400 font-semibold">{formatDate(apt.preferred_date)} • {apt.preferred_time}</span>
                              </div>
                              <span
                                className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${getStatusColor(apt.status)}12`,
                                  color: getStatusColor(apt.status),
                                  border: `1px solid ${getStatusColor(apt.status)}25`
                                }}
                              >
                                {getStatusLabel(apt.status)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400 space-y-3">
                        <span className="text-xs font-semibold block">No upcoming visits booked</span>
                        <button onClick={() => navigate('/appointments')} className="text-xs text-green-600 hover:underline font-bold">
                          Book Now
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active Pres */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <FaPrescriptionBottle className="text-green-600" /> Active Prescriptions
                    </h3>
                    {prescriptions.filter(p => p.status === 'active').length > 0 ? (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto premium-dashboard-scroll pr-1">
                        {prescriptions
                          .filter(p => p.status === 'active')
                          .slice(0, 3)
                          .map(pres => (
                            <div key={pres.id} className="flex justify-between items-center bg-gray-50 hover:bg-gray-100/70 p-3 rounded-xl border border-gray-200 transition-colors">
                              <div>
                                <strong className="text-xs font-bold text-gray-800 block">{pres.medications?.length || 0} Medications</strong>
                                <span className="text-[10px] text-gray-400 font-semibold">Issued: {formatDate(pres.date)} • Dr. {pres.doctor_name}</span>
                              </div>
                              <button
                                onClick={() => navigate('/prescriptions')}
                                className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex items-center justify-center border border-green-200/50"
                              >
                                <FaEye size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-xs font-semibold">
                        No active prescription logs
                      </div>
                    )}
                  </div>

                  {/* Health Goals */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <FaBullseye className="text-green-600" /> Active Goals
                    </h3>
                    {healthData?.active_goals && healthData.active_goals.length > 0 ? (
                      <div className="space-y-3.5 max-h-[220px] overflow-y-auto premium-dashboard-scroll pr-1">
                        {healthData.active_goals.slice(0, 3).map(goal => (
                          <div key={goal.id} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-700 block truncate max-w-[150px]">{goal.title}</span>
                              <span className="text-green-600 font-extrabold">{Math.round(goal.progress_percentage)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-xs font-semibold">
                        No active medical goals configured
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* TAB: APPOINTMENTS */}
            {activeTab === 'appointments' && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <FaCalendarCheck className="text-green-600" /> Registered Appointments
                  </h3>
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    onClick={() => navigate('/appointments')}
                  >
                    <FaPlus /> Book New
                  </button>
                </div>

                {appointments.length > 0 ? (
                  <div className="overflow-x-auto premium-dashboard-scroll">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase font-extrabold tracking-wider text-[10px]">
                          <th className="p-4 rounded-l-xl">Doctor</th>
                          <th className="p-4">Preferred Time</th>
                          <th className="p-4">Symptoms</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 rounded-r-xl">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-105">
                        {appointments.map(apt => (
                          <tr key={apt.id} className="hover:bg-gray-50/50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200/50 text-green-700 font-extrabold flex items-center justify-center text-xs">
                                  {apt.doctor_details?.user?.first_name?.charAt(0) || 'D'}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800">
                                    Dr. {apt.doctor_details?.user?.first_name || 'Doctor'} {apt.doctor_details?.user?.last_name || ''}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium">
                                    {apt.doctor_details?.specialization_display || 'General Physician'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-semibold">
                              <div>{formatDate(apt.preferred_date)}</div>
                              <div className="text-gray-400 text-[10px]">{apt.preferred_time}</div>
                            </td>
                            <td className="p-4 text-gray-500 max-w-[200px] truncate" title={apt.symptoms}>
                              {apt.symptoms}
                            </td>
                            <td className="p-4">
                              <span
                                className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${getStatusColor(apt.status)}12`,
                                  color: getStatusColor(apt.status),
                                  border: `1px solid ${getStatusColor(apt.status)}25`
                                }}
                              >
                                {getStatusLabel(apt.status)}
                              </span>
                            </td>
                            <td className="p-4">
                              {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                                <button
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 active:scale-95"
                                  onClick={() => handleCancelAppointment(apt.id)}
                                >
                                  <FaTimesCircle /> Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <FaCalendarCheck size={40} className="mx-auto text-gray-300" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800">No Appointments Recorded</h4>
                      <p className="text-[11px] text-gray-400">Schedule your online or offline healthcare visit with our network specialists.</p>
                    </div>
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow"
                      onClick={() => navigate('/appointments')}
                    >
                      Schedule Appointment
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CONSULTATIONS */}
            {activeTab === 'consultations' && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <FaVideo className="text-green-600" /> Video Consulting Lobby
                  </h3>
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    onClick={() => navigate('/teleconsult')}
                  >
                    <FaPlus /> Start Consult
                  </button>
                </div>

                {consultations.length > 0 ? (
                  <div className="overflow-x-auto premium-dashboard-scroll">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase font-extrabold tracking-wider text-[10px]">
                          <th className="p-4 rounded-l-xl">Doctor</th>
                          <th className="p-4">Scheduled Time</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Duration</th>
                          <th className="p-4 rounded-r-xl">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {consultations.map(consult => (
                          <tr key={consult.id} className="hover:bg-gray-50/50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200/50 text-purple-700 font-extrabold flex items-center justify-center text-xs">
                                  {consult.doctor_details?.name?.charAt(0) || 'D'}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800">
                                    {consult.doctor_details?.name || 'Doctor'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium">
                                    {consult.doctor_details?.specialization || 'General Practitioner'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-semibold">{formatDateTime(consult.scheduled_time)}</td>
                            <td className="p-4">
                              <span
                                className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${getStatusColor(consult.status)}12`,
                                  color: getStatusColor(consult.status),
                                  border: `1px solid ${getStatusColor(consult.status)}25`
                                }}
                              >
                                {getStatusLabel(consult.status)}
                              </span>
                            </td>
                            <td className="p-4 font-semibold text-gray-500">
                              {consult.duration ? `${Math.floor(consult.duration / 60)} mins` : '-'}
                            </td>
                            <td className="p-4">
                              {(consult.status === 'scheduled' || consult.status === 'waiting') && (
                                <button
                                  className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow shadow-rose-600/10"
                                  onClick={() => navigate('/teleconsult')}
                                >
                                  <FaVideo /> Join Call
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <FaVideo size={40} className="mx-auto text-gray-300" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800">No Teleconsultation Records</h4>
                      <p className="text-[11px] text-gray-400 font-medium">Join live telemedicine clinics with registered MD specialists online.</p>
                    </div>
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow"
                      onClick={() => navigate('/teleconsult')}
                    >
                      Launch Teleconsult Room
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: PRESCRIPTIONS */}
            {activeTab === 'prescriptions' && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <FaPrescriptionBottle className="text-green-600" /> Digital Prescription Files
                  </h3>
                  <button
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-gray-200"
                    onClick={() => loadDashboardData(user.id)}
                  >
                    Refresh List
                  </button>
                </div>

                {prescriptions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prescriptions.map(pres => (
                      <div key={pres.id} className="bg-gray-50 border border-gray-200 hover:border-green-400 rounded-2xl p-5 flex flex-col justify-between transition-all group">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-2 border-b border-gray-200/50 pb-3">
                            <div>
                              <h4 className="font-bold text-gray-800 text-xs">Dr. {pres.doctor_name}</h4>
                              <span className="text-[10px] text-gray-400 font-semibold block">{formatDate(pres.date)}</span>
                            </div>
                            <span
                              className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${getStatusColor(pres.status || 'active')}12`,
                                color: getStatusColor(pres.status || 'active'),
                                border: `1px solid ${getStatusColor(pres.status || 'active')}25`
                              }}
                            >
                              {getStatusLabel(pres.status || 'active')}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <p className="text-gray-600 leading-normal"><strong className="text-gray-800">Diagnosis:</strong> {pres.diagnosis}</p>
                            <p className="text-gray-600"><strong className="text-gray-800">Medications:</strong> {pres.medications?.length || 0} drugs prescribed</p>
                          </div>
                        </div>

                        <button
                          className="w-full mt-4 bg-green-50 hover:bg-green-600 text-green-700 hover:text-white border border-green-200/50 hover:border-transparent py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          onClick={() => navigate('/prescriptions')}
                        >
                          <FaEye /> View Prescription
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <FaPrescriptionBottle size={40} className="mx-auto text-gray-300" />
                    <h4 className="font-bold text-gray-800 text-xs">No Active Prescriptions</h4>
                    <p className="text-[11px] text-gray-400">Prescription orders issued by physicians will display immediately here.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: HEALTH SUMMARY */}
            {activeTab === 'health' && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <FaChartLine className="text-green-600" /> Personal Vitals &amp; Activity Charts
                  </h3>
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    onClick={() => navigate('/health-tracking')}
                  >
                    <FaPlus /> Update Vitals
                  </button>
                </div>

                {healthData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Latest Metrics */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200/60 pb-2">
                        <FaHeartbeat className="text-green-600" /> Recent Vitals
                      </h4>
                      {healthData.latest_metrics && healthData.latest_metrics.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.latest_metrics.slice(0, 4).map(metric => (
                            <div key={metric.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200">
                              <span className="text-xs font-bold text-gray-700">{metric.metric_type_display}</span>
                              <span className="text-xs font-extrabold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200/40">
                                {metric.value} {metric.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No vitals uploaded yet.</p>
                      )}
                    </div>

                    {/* Goals Progress */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200/60 pb-2">
                        <FaBullseye className="text-green-600" /> Goal Success Rate
                      </h4>
                      {healthData.active_goals && healthData.active_goals.length > 0 ? (
                        <div className="space-y-3.5">
                          {healthData.active_goals.slice(0, 3).map(goal => (
                            <div key={goal.id} className="space-y-1 bg-white p-3 rounded-xl border border-gray-200">
                              <div className="flex justify-between items-center text-xs">
                                <strong className="text-gray-800 font-bold block truncate max-w-[200px]">{goal.title}</strong>
                                <span className="text-green-600 font-extrabold">{Math.round(goal.progress_percentage)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-green-600 rounded-full"
                                  style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No active targets set.</p>
                      )}
                    </div>

                    {/* Recent Activities */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-gray-905 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200/60 pb-2">
                        <FaRunning className="text-green-600" /> Workout &amp; Pose Routine
                      </h4>
                      {healthData.recent_activities && healthData.recent_activities.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.recent_activities.slice(0, 3).map(activity => (
                            <div key={activity.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                              <div>
                                <strong className="text-xs font-bold text-gray-800 block">{activity.title}</strong>
                                <span className="text-[10px] text-gray-400 font-semibold">{activity.activity_date}</span>
                              </div>
                              {activity.duration_minutes && (
                                <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                  {activity.duration_minutes} Mins
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No physiotherapy/activities completed.</p>
                      )}
                    </div>

                    {/* Medication Reminders */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-gray-905 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200/60 pb-2">
                        <FaPills className="text-green-600" /> Today's Pill Schedule
                      </h4>
                      {healthData.medication_reminders && healthData.medication_reminders.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.medication_reminders.slice(0, 3).map(reminder => (
                            <div key={reminder.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                              <div>
                                <strong className="text-xs font-bold text-gray-800 block">{reminder.medication_name}</strong>
                                <span className="text-[10px] text-gray-400 font-semibold">{reminder.dosage} • {reminder.frequency_display}</span>
                              </div>
                              <button
                                className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-600 text-green-700 hover:text-white flex items-center justify-center border border-green-200/50 hover:border-transparent transition-all"
                                onClick={() => navigate('/medicines')}
                              >
                                <FaCheckCircle size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No pill reminders registered.</p>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <FaChartLine size={40} className="mx-auto text-gray-300" />
                    <h4 className="font-bold text-gray-800 text-xs">No Health Logs Uploaded</h4>
                    <p className="text-[11px] text-gray-400 font-medium">Update vitals metrics, blood pressures, and body weight logs.</p>
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow"
                      onClick={() => navigate('/health-tracking')}
                    >
                      Start Tracking
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: MY DOCTORS */}
            {activeTab === 'doctors' && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                  <FaUserMd className="text-green-600" /> Medical Network Consulted Doctors
                </h3>

                {myDoctors.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myDoctors.map(doctor => (
                      <div key={doctor.id} className="bg-gray-50 border border-gray-200/70 hover:border-green-400 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between transition-all group">

                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 flex-shrink-0 bg-green-50 flex items-center justify-center">
                              {doctor.profile_picture_url ? (
                                <img src={doctor.profile_picture_url} alt={doctor.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-extrabold text-green-700 text-xs uppercase">
                                  {doctor.first_name?.charAt(0)}{doctor.last_name?.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800 text-xs">{doctor.name}</h4>
                              <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider block">{doctor.specialization_display}</span>
                              <span className="text-[10px] text-gray-400 font-medium block">{doctor.qualification}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-white border border-gray-200/60 p-2.5 rounded-xl">
                            <div>
                              <span className="text-gray-400 block font-medium">Experience</span>
                              <span className="font-bold text-gray-700">{doctor.experience_years} Years</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">Consults</span>
                              <span className="font-bold text-gray-700">{doctor.total_consultations}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">Fee</span>
                              <span className="font-bold text-gray-700">₹{doctor.consultation_fee}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                              {renderStars(doctor.average_rating, 12)}
                              <span className="text-[10px] font-semibold text-gray-500">
                                {doctor.average_rating.toFixed(1)} ({doctor.total_ratings} Reviews)
                              </span>
                            </div>

                            {doctor.my_rating ? (
                              <div className="bg-green-50 border border-green-200/50 p-2 rounded-xl text-[10px] font-bold text-green-800 flex items-center justify-center gap-1">
                                <FaStar className="text-amber-400" /> Rated {doctor.my_rating} / 5
                              </div>
                            ) : (
                              <button
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 border border-gray-300/40"
                                onClick={() => handleOpenRatingModal(doctor)}
                              >
                                <FaStar /> Submit Rating Review
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-semibold">Last consult: {formatDate(doctor.last_visit)}</span>
                          <button
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold transition-all active:scale-95 shadow shadow-green-600/10 flex items-center gap-1"
                            onClick={() => navigate('/appointments')}
                          >
                            <FaCalendarCheck size={10} /> Book
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <FaUserMd size={40} className="mx-auto text-gray-300" />
                    <h4 className="font-bold text-gray-800 text-xs">No Consulting Doctors Listed</h4>
                    <p className="text-[11px] text-gray-400 font-medium">Registered doctors will display immediately once you schedule visits.</p>
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow"
                      onClick={() => navigate('/appointments')}
                    >
                      Find Doctor
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Info Highlights Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 border border-green-200/50 flex items-center justify-center flex-shrink-0">
              <FaAward size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-900">Physiotherapy &amp; Posture Tracking</h3>
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                Log regular activity reports or click AI Exercise Coach inside health logs to track squats depth and posture using webcam sensors automatically.
              </p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 border border-green-200/50 flex items-center justify-center flex-shrink-0">
              <FaChartLine size={18} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-900">Secure Healthcare Records</h3>
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                Your medical files, diagnostic profiles, and prescription histories are fully encrypted and only shared with verified medical network clinicians.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* SUBMIT RATING MODAL */}
      {showRatingModal && selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-modal-fade"
          onClick={handleCloseRatingModal}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden w-full max-w-md animate-modal-scale flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xs font-extrabold text-gray-900 tracking-tight uppercase">Rate Doctor Review</h2>
              <button className="text-gray-400 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors" onClick={handleCloseRatingModal}>
                <FaTimesCircle size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto premium-dashboard-scroll">
              <div className="text-center space-y-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Doctor Rating</span>
                <div className="flex justify-center">
                  {renderStars(ratingData.rating, 26, true, (rating) => setRatingData({ ...ratingData, rating }))}
                </div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  {ratingData.rating > 0 ? `${ratingData.rating} out of 5 stars` : 'Tap to rate doctor'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Detailed Review</label>
                <textarea
                  rows="3"
                  className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Share your experience consulting this doctor..."
                  value={ratingData.review}
                  onChange={(e) => setRatingData({ ...ratingData, review: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">What went well? (Optional)</label>
                <textarea
                  rows="2"
                  className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="What were the positives?"
                  value={ratingData.pros}
                  onChange={(e) => setRatingData({ ...ratingData, pros: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Areas to improve? (Optional)</label>
                <textarea
                  rows="2"
                  className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="What could be improved?"
                  value={ratingData.cons}
                  onChange={(e) => setRatingData({ ...ratingData, cons: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="would_recommend"
                  checked={ratingData.would_recommend}
                  onChange={(e) => setRatingData({ ...ratingData, would_recommend: e.target.checked })}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4"
                />
                <label htmlFor="would_recommend" className="text-xs font-semibold text-gray-600 cursor-pointer">
                  I would recommend this doctor to others
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold transition-all"
                onClick={handleCloseRatingModal}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-xl text-xs font-bold transition-all shadow shadow-green-600/10"
                onClick={handleSubmitRating}
                disabled={ratingData.rating === 0}
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default PatientDashboard