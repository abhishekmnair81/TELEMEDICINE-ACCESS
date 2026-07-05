import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  FaVideo,
  FaCalendarCheck,
  FaUsers,
  FaPrescriptionBottle,
  FaChartLine,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaUserMd,
  FaSignOutAlt,
  FaPhone,
  FaMapMarkerAlt,
  FaHeartbeat,
  FaBell,
  FaChevronDown,
  FaStethoscope,
  FaNotesMedical,
  FaAward,
  FaEye,
  FaStar,
  FaQuoteLeft,
  FaThumbsUp,
  FaThumbsDown,
} from "react-icons/fa"
import { authAPI, videoConsultationAPI, appointmentsAPI, prescriptionsAPI, patientsAPI, doctorsAPI } from "../services/api"
import LanguageSelector from './common/LanguageSelector'
import Footer from "./Footer"
import "./DoctorDashboard.css"


const DoctorDashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [stats, setStats] = useState({
    totalConsultations: 0,
    todayAppointments: 0,
    pendingConsultations: 0,
    completedToday: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    totalPrescriptions: 0,
    totalPatients: 0,
    averageRating: 0,
    totalRatings: 0,
  })
  const [consultations, setConsultations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [patients, setPatients] = useState([])
  const [ratings, setRatings] = useState([])
  const [ratingsSummary, setRatingsSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('consultations') // 'consultations', 'appointments', 'prescriptions', 'patients', 'ratings'

  // Auth check - runs once on mount
  useEffect(() => {
    const checkAuth = () => {
      console.log('[DoctorDashboard] Checking authentication...')
      const userData = authAPI.getCurrentUser()
      console.log('[DoctorDashboard] User data from localStorage:', userData)
      
      if (!userData) {
        console.log('[DoctorDashboard] ❌ No user data found - redirecting to login')
        setIsCheckingAuth(false)
        navigate('/auth?type=doctor&view=login')
        return
      }
      
      if (userData.user_type !== 'doctor') {
        console.log('[DoctorDashboard] ❌ User is not a doctor, type:', userData.user_type)
        alert(`This is the doctor dashboard. You are logged in as ${userData.user_type}. Please logout and login as a doctor.`)
        setIsCheckingAuth(false)
        navigate('/')
        return
      }
      
      console.log('[DoctorDashboard] ✅ Doctor authenticated:', userData.first_name, userData.last_name)
      console.log('[DoctorDashboard] Doctor ID:', userData.id)
      setUser(userData)
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, [navigate])

  // Load data when user is set
  useEffect(() => {
    if (user && !isCheckingAuth) {
      console.log('[DoctorDashboard] Loading dashboard data for doctor:', user.id)
      loadDashboardData(user.id)
    }
  }, [user, isCheckingAuth])

  // Auto-refresh
  useEffect(() => {
    if (!user || isCheckingAuth) return

    const interval = setInterval(() => {
      console.log('[DoctorDashboard] Auto-refreshing data...')
      loadDashboardData(user.id)
    }, 30000)

    return () => clearInterval(interval)
  }, [user, isCheckingAuth])

  const loadDashboardData = async (doctorId) => {
    try {
      setLoading(true)
      console.log('\n' + '='.repeat(60))
      console.log('LOADING DASHBOARD DATA FOR DOCTOR:', doctorId)
      console.log('='.repeat(60))

      console.log('\n📋 Fetching doctor profile to get DoctorProfile ID...')
      let doctorProfileId = null
      
      try {
        const doctorProfileResponse = await doctorsAPI.getDoctorById(doctorId)
        console.log('✅ Doctor profile response:', doctorProfileResponse)
        
        if (doctorProfileResponse && doctorProfileResponse.id) {
          doctorProfileId = doctorProfileResponse.id
          console.log(`✅ Found DoctorProfile ID: ${doctorProfileId}`)
        } else {
          console.error('❌ No DoctorProfile ID in response')
        }
      } catch (error) {
        console.error('❌ Error fetching doctor profile:', error)
      }

      // 1. GET VIDEO CONSULTATIONS
      console.log('\n📹 Fetching video consultations...')
      let allRoomsResponse = await videoConsultationAPI.getAllRooms(doctorId)
      console.log('✅ Raw video consultations response:', allRoomsResponse)
      
      let allRooms = []
      if (Array.isArray(allRoomsResponse)) {
        allRooms = allRoomsResponse
      } else if (allRoomsResponse && Array.isArray(allRoomsResponse.rooms)) {
        allRooms = allRoomsResponse.rooms
      } else if (allRoomsResponse && Array.isArray(allRoomsResponse.results)) {
        allRooms = allRoomsResponse.results
      }
      
      console.log('✅ Final consultations array length:', allRooms.length)

      // 2. GET APPOINTMENTS
      console.log('\n📅 Fetching appointments for doctor ID:', doctorId)
      let doctorAppointments = []
      
      try {
        let appointmentsResponse = await appointmentsAPI.getDoctorAppointments(doctorId)
        console.log('✅ Raw appointments response:', appointmentsResponse)
        
        if (Array.isArray(appointmentsResponse)) {
          doctorAppointments = appointmentsResponse
        } else if (appointmentsResponse && appointmentsResponse.results) {
          doctorAppointments = appointmentsResponse.results
        }
        
        console.log('✅ Number of appointments:', doctorAppointments.length)
      } catch (error) {
        console.error('❌ Error fetching appointments:', error)
        doctorAppointments = []
      }

      // 3. GET PRESCRIPTIONS
      console.log('\n💊 Fetching prescriptions for doctor ID:', doctorId)
      let doctorPrescriptions = []
      
      try {
        let prescriptionsResponse = await prescriptionsAPI.getDoctorPrescriptions(doctorId)
        console.log('✅ Raw prescriptions response:', prescriptionsResponse)
        
        if (Array.isArray(prescriptionsResponse)) {
          doctorPrescriptions = prescriptionsResponse
        } else if (prescriptionsResponse && prescriptionsResponse.results) {
          doctorPrescriptions = prescriptionsResponse.results
        }
        
        console.log('✅ Number of prescriptions:', doctorPrescriptions.length)
      } catch (error) {
        console.error('❌ Error fetching prescriptions:', error)
        doctorPrescriptions = []
      }

      // 4. GET RATINGS & REVIEWS
      console.log('\n⭐ Fetching ratings...')
      let doctorRatings = []
      let ratingSummary = null
      
      if (doctorProfileId) {
        try {
          console.log(`⭐ Using DoctorProfile ID: ${doctorProfileId}`)
          const ratingsResponse = await doctorsAPI.getDoctorRatings(doctorProfileId)
          console.log('✅ Raw ratings response:', ratingsResponse)
          
          if (ratingsResponse && ratingsResponse.success) {
            doctorRatings = ratingsResponse.ratings || []
            ratingSummary = ratingsResponse.summary || null
            console.log('✅ Number of ratings:', doctorRatings.length)
            console.log('✅ Rating summary:', ratingSummary)
          }
        } catch (error) {
          console.error('❌ Error fetching ratings:', error)
          doctorRatings = []
        }
      } else {
        console.warn('⚠️ Skipping ratings fetch - no DoctorProfile ID available')
      }

      // 5. GET UNIQUE PATIENTS
      console.log('\n👥 Extracting unique patients...')
      const uniquePatientIds = new Set()
      const patientMap = new Map()

      doctorAppointments.forEach(apt => {
        if (apt.patient_phone) {
          if (!uniquePatientIds.has(apt.patient_phone)) {
            uniquePatientIds.add(apt.patient_phone)
            patientMap.set(apt.patient_phone, {
              id: apt.patient_phone,
              name: apt.patient_name,
              phone: apt.patient_phone,
              lastVisit: apt.preferred_date,
              totalAppointments: 1,
              totalPrescriptions: 0,
            })
          } else {
            const patient = patientMap.get(apt.patient_phone)
            patient.totalAppointments++
          }
        }
      })

      doctorPrescriptions.forEach(pres => {
        if (pres.patient_phone && patientMap.has(pres.patient_phone)) {
          const patient = patientMap.get(pres.patient_phone)
          patient.totalPrescriptions++
        }
      })

      const uniquePatients = Array.from(patientMap.values())
      console.log('✅ Number of unique patients:', uniquePatients.length)

      // 6. CALCULATE STATS
      const today = new Date().toDateString()
      
      const pending = allRooms.filter(r => r.status === 'scheduled' || r.status === 'waiting')
      const completedToday = allRooms.filter(r => {
        if (!r.ended_at) return false
        return new Date(r.ended_at).toDateString() === today
      })
      const todayConsultations = allRooms.filter(r => {
        return new Date(r.scheduled_time).toDateString() === today
      })

      const pendingApts = doctorAppointments.filter(apt => apt.status === 'pending')
      const confirmedApts = doctorAppointments.filter(apt => apt.status === 'confirmed')
      const todayApts = doctorAppointments.filter(apt => {
        return new Date(apt.preferred_date).toDateString() === today
      })

      setStats({
        totalConsultations: allRooms.filter(r => r.status === 'completed').length,
        todayAppointments: todayConsultations.length,
        pendingConsultations: pending.length,
        completedToday: completedToday.length,
        pendingAppointments: pendingApts.length,
        confirmedAppointments: confirmedApts.length,
        todayAppointmentsCount: todayApts.length,
        totalPrescriptions: doctorPrescriptions.length,
        totalPatients: uniquePatients.length,
        averageRating: ratingSummary?.average_rating || 0,
        totalRatings: ratingSummary?.total_ratings || 0,
      })

      setConsultations(allRooms.sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time)).slice(0, 10))
      setAppointments(doctorAppointments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10))
      setPrescriptions(doctorPrescriptions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10))
      setPatients(uniquePatients.sort((a, b) => new Date(b.lastVisit) - new Date(a.lastVisit)))
      setRatings(doctorRatings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      setRatingsSummary(ratingSummary)

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
    console.log('[DoctorDashboard] Logging out...')
    authAPI.logout()
    navigate('/auth?type=doctor&view=login')
  }

  const handleAppointmentAction = async (appointmentId, action) => {
    try {
      console.log(`\n🔄 ${action}ing appointment ${appointmentId}`)
      
      let newStatus
      switch (action) {
        case 'confirm':
          newStatus = 'confirmed'
          break
        case 'complete':
          newStatus = 'completed'
          break
        case 'cancel':
          newStatus = 'cancelled'
          break
        default:
          return
      }

      console.log('  New status:', newStatus)
      await appointmentsAPI.updateAppointmentStatus(appointmentId, newStatus)
      console.log('  ✅ Status updated successfully')
      
      if (user) {
        await loadDashboardData(user.id)
      }
      
      alert(`Appointment ${action}ed successfully!`)
    } catch (error) {
      console.error(`❌ Error ${action}ing appointment:`, error)
      alert(`Failed to ${action} appointment: ${error.message}`)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
      case 'pending': 
        return '#0070cd'
      case 'waiting': 
        return '#d97706'
      case 'ongoing':
      case 'confirmed':
      case 'active':
        return '#059669'
      case 'completed': 
        return '#10b981'
      case 'cancelled': 
        return '#dc2626'
      default: 
        return '#6b7280'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'scheduled': return 'Scheduled'
      case 'pending': return 'Pending'
      case 'waiting': return 'Patient Waiting'
      case 'ongoing': return 'Ongoing'
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

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <FaStar
        key={index}
        size={16}
        color={index < rating ? '#fbbf24' : '#d1d5db'}
      />
    ))
  }

  const quickActions = [
    {
      icon: <FaVideo size={20} />,
      title: "Video Consultations",
      description: "Join or view pending consultations",
      path: "/doctor-video",
      color: "#059669",
      urgent: stats.pendingConsultations > 0,
      badge: stats.pendingConsultations || null,
    },
    {
      icon: <FaCalendarCheck size={20} />,
      title: "Appointments",
      description: "Manage your appointment schedule",
      onClick: () => setActiveTab('appointments'),
      color: "#0070cd",
      urgent: stats.pendingAppointments > 0,
      badge: stats.pendingAppointments || null,
    },
    {
      icon: <FaPrescriptionBottle size={20} />,
      title: "Prescriptions",
      description: "View and manage prescriptions",
      onClick: () => setActiveTab('prescriptions'),
      color: "#ea580c",
    },
    {
      icon: <FaUsers size={20} />,
      title: "My Patients",
      description: "View patient records and history",
      onClick: () => setActiveTab('patients'),
      color: "#7c3aed",
    },
  ]

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-green-650 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-semibold">Verifying authentication...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-green-650 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-semibold">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="w-full">
        {/* Info Strip */}
        <div className="bg-gradient-to-r from-green-800 to-green-700 text-white text-xs font-semibold py-2">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><FaPhone size={14} /> Emergency: 108 / 102</span>
              <span className="flex items-center gap-2"><FaClock size={14} /> 24/7 Support</span>
            </div>
            <div>
              <span className="flex items-center gap-2"><FaMapMarkerAlt size={14} /> Rural HealthCare Network</span>
            </div>
          </div>
        </div>

        {/* Navbar */}
        <div className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 py-3 md:py-4 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <nav className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate("/doctor-dashboard")}>
                <div className="bg-green-600 text-white p-2.5 rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center">
                  <FaHeartbeat size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-800">Doctor Portal</span>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
                  <Link to="/" className="hover:text-green-600 transition-colors">Home</Link>
                  <Link to="/doctor-video" className="hover:text-green-600 transition-colors relative">
                    Video Consultations
                    {stats.pendingConsultations > 0 && (
                      <span className="absolute -top-2.5 -right-3 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {stats.pendingConsultations}
                      </span>
                    )}
                  </Link>
                  <div 
                    className="hover:text-green-600 transition-colors relative cursor-pointer"
                    onClick={() => setActiveTab('appointments')}
                  >
                    Appointments
                    {stats.pendingAppointments > 0 && (
                      <span className="absolute -top-2.5 -right-3 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {stats.pendingAppointments}
                      </span>
                    )}
                  </div>
                  <div 
                    className="hover:text-green-600 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('patients')}
                  >
                    Patients
                  </div>
                </div>

                {/* Language Selector */}
                <div className="flex items-center justify-center">
                  <LanguageSelector />
                </div>

                {/* Profile Dropdown */}
                <div 
                  className="relative"
                  onMouseEnter={() => setShowProfileDropdown(true)}
                  onMouseLeave={() => setShowProfileDropdown(false)}
                >
                  <button className="flex items-center gap-2 cursor-pointer p-1.5 rounded-full hover:bg-slate-100 transition-all duration-200 border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <FaUserMd size={16} className="text-green-600" />
                    <span>Dr. {user.first_name} {user.last_name}</span>
                    <FaChevronDown size={8} />
                  </button>
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 w-48 animate-dropdown-fade z-55">
                      <Link to="/doctor-profile" className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors">
                        <FaUserMd size={14} /> My Profile
                      </Link>
                      <div className="border-t border-slate-100 my-1"></div>
                      <div className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-650 hover:bg-red-50 transition-colors cursor-pointer" onClick={handleLogout}>
                        <FaSignOutAlt size={14} /> Logout
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 text-center md:text-left z-10">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome back, Dr. {user.first_name} {user.last_name}!</h1>
            <p className="text-xs md:text-sm text-green-50 font-medium max-w-xl">
              You have {stats.todayAppointmentsCount || 0} appointment{stats.todayAppointmentsCount !== 1 ? 's' : ''} scheduled for today.
            </p>
          </div>
          <div className="text-white/20 z-0 pr-4 hidden md:block animate-pulse">
            <FaStethoscope size={90} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <FaUsers size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{stats.totalPatients}</span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Total Patients</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center flex-shrink-0">
              <FaCalendarCheck size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{stats.todayAppointmentsCount || 0}</span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Today's Visits</span>
            </div>
          </div>

          <div className={`rounded-2xl p-5 border shadow-sm flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300 relative ${stats.pendingAppointments > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200/80'}`}>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <FaClock size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{stats.pendingAppointments}</span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Pending Actions</span>
            </div>
            {stats.pendingAppointments > 0 && (
              <div className="absolute top-3 right-3 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <FaBell size={8} /> Action
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-green-400 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer" onClick={() => setActiveTab('ratings')}>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-500 flex items-center justify-center flex-shrink-0">
              <FaStar size={20} />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{stats.averageRating.toFixed(1)}/5.0</span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">{stats.totalRatings} Rating{stats.totalRatings !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
            {quickActions.map((action, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl p-6 border shadow-sm flex items-center gap-4 hover:-translate-y-1 transition-all duration-305 cursor-pointer ${action.urgent ? 'border-red-200 bg-red-50/20' : 'border-slate-200/80 hover:border-green-500'}`}
                onClick={() => action.path ? navigate(action.path) : action.onClick()}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${action.color}15`, color: action.color }}>
                  {action.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-855 leading-tight">{action.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
                </div>
                {action.badge && (
                  <span className="bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                    {action.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 pb-px overflow-x-auto">
          <button 
            className={`px-4 py-3 border-b-2 font-bold flex items-center gap-2 text-sm transition-all whitespace-nowrap ${activeTab === 'consultations' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-green-600'}`}
            onClick={() => setActiveTab('consultations')}
          >
            <FaVideo size={14} /> Video Consultations
          </button>
          <button 
            className={`px-4 py-3 border-b-2 font-bold flex items-center gap-2 text-sm transition-all whitespace-nowrap ${activeTab === 'appointments' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-green-600'}`}
            onClick={() => setActiveTab('appointments')}
          >
            <FaCalendarCheck size={14} /> Appointments
          </button>
          <button 
            className={`px-4 py-3 border-b-2 font-bold flex items-center gap-2 text-sm transition-all whitespace-nowrap ${activeTab === 'prescriptions' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-green-600'}`}
            onClick={() => setActiveTab('prescriptions')}
          >
            <FaPrescriptionBottle size={14} /> Prescriptions
          </button>
          <button 
            className={`px-4 py-3 border-b-2 font-bold flex items-center gap-2 text-sm transition-all whitespace-nowrap ${activeTab === 'patients' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-green-600'}`}
            onClick={() => setActiveTab('patients')}
          >
            <FaUsers size={14} /> Patients ({stats.totalPatients})
          </button>
          <button 
            className={`px-4 py-3 border-b-2 font-bold flex items-center gap-2 text-sm transition-all whitespace-nowrap ${activeTab === 'ratings' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-green-600'}`}
            onClick={() => setActiveTab('ratings')}
          >
            <FaStar size={14} /> Ratings & Reviews ({stats.totalRatings})
          </button>
        </div>

        {/* Consultations Tab */}
        {activeTab === 'consultations' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-805"><FaVideo className="text-green-600" /> Recent Video Consultations</h2>
              <button 
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-105 text-sm font-semibold rounded-xl border border-green-200 transition-colors disabled:opacity-50"
                onClick={() => loadDashboardData(user.id)}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {consultations.length > 0 ? (
              <div className="overflow-x-auto premium-dashboard-scroll">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                      <th className="px-6 py-4 rounded-l-2xl">Patient</th>
                      <th className="px-6 py-4">Scheduled Time</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4 rounded-r-2xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultations.map((consultation) => (
                      <tr key={consultation.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-750 flex items-center justify-center font-bold">
                              {consultation.patient_details?.name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{consultation.patient_details?.name || 'Unknown'}</div>
                              <div className="text-xs text-slate-400 font-semibold">{consultation.patient_details?.phone || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600">{formatDateTime(consultation.scheduled_time)}</td>
                        <td className="px-6 py-4">
                          <span 
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                            style={{ 
                              background: `${getStatusColor(consultation.status)}12`,
                              color: getStatusColor(consultation.status)
                            }}
                          >
                            {getStatusLabel(consultation.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">
                          {consultation.duration 
                            ? `${Math.floor(consultation.duration / 60)} min` 
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {(consultation.status === 'scheduled' || consultation.status === 'waiting') && (
                            <button
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-705 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-green-600/10 hover:-translate-y-0.5"
                              onClick={() => navigate('/doctor-video')}
                            >
                              <FaVideo size={10} /> Join Call
                            </button>
                          )}
                          {consultation.status === 'ongoing' && (
                            <button
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 hover:-translate-y-0.5"
                              onClick={() => navigate('/doctor-video')}
                            >
                              <FaVideo size={10} /> Rejoin
                            </button>
                          )}
                          {consultation.status === 'completed' && (
                            <button
                              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-202 text-slate-755 text-xs font-bold rounded-xl transition-colors"
                              onClick={() => {/* View details */}}
                            >
                              <FaNotesMedical size={10} /> View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FaVideo size={48} className="text-slate-300 mb-3 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-800">No Recent Consultations</h3>
                <p className="text-xs text-slate-505 mt-1">Your video consultations schedule will appear here</p>
              </div>
            )}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-805"><FaCalendarCheck className="text-green-600" /> Patient Appointments ({appointments.length})</h2>
              <button 
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-105 text-sm font-semibold rounded-xl border border-green-200 transition-colors disabled:opacity-50"
                onClick={() => loadDashboardData(user.id)}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {appointments.length > 0 ? (
              <div className="overflow-x-auto premium-dashboard-scroll">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                      <th className="px-6 py-4 rounded-l-2xl">Patient</th>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Symptoms</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 rounded-r-2xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-750 flex items-center justify-center font-bold">
                              {appointment.patient_name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{appointment.patient_name}</div>
                              <div className="text-xs text-slate-400 font-semibold">{appointment.patient_phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-700">{formatDate(appointment.preferred_date)}</div>
                          <div className="text-xs text-slate-400 font-semibold">{appointment.preferred_time}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-655 max-w-xs truncate font-medium">
                            {appointment.symptoms || 'No symptoms specified'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                            style={{ 
                              background: `${getStatusColor(appointment.status)}12`,
                              color: getStatusColor(appointment.status)
                            }}
                          >
                            {getStatusLabel(appointment.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex gap-2">
                            {appointment.status === 'pending' && (
                              <>
                                <button
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-705 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-green-600/10"
                                  onClick={() => handleAppointmentAction(appointment.id, 'confirm')}
                                >
                                  <FaCheckCircle size={10} /> Confirm
                                </button>
                                <button
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition-colors"
                                  onClick={() => handleAppointmentAction(appointment.id, 'cancel')}
                                >
                                  <FaTimesCircle size={10} /> Cancel
                                </button>
                              </>
                            )}
                            {appointment.status === 'confirmed' && (
                              <>
                                <button
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-705 text-white text-xs font-bold rounded-xl transition-all"
                                  onClick={() => handleAppointmentAction(appointment.id, 'complete')}
                                >
                                  <FaCheckCircle size={10} /> Complete
                                </button>
                                <button
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-55 text-red-655 hover:bg-red-100 text-xs font-bold rounded-xl transition-colors"
                                  onClick={() => handleAppointmentAction(appointment.id, 'cancel')}
                                >
                                  <FaTimesCircle size={10} /> Cancel
                                </button>
                              </>
                            )}
                            {appointment.status === 'completed' && (
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                                onClick={() => {/* View */}}
                              >
                                <FaNotesMedical size={10} /> View Details
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FaCalendarCheck size={48} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Appointments Found</h3>
                <p className="text-xs text-slate-500 mt-1">Booked patient appointments will appear here</p>
              </div>
            )}
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-805"><FaPrescriptionBottle className="text-green-600" /> Issued Prescriptions ({prescriptions.length})</h2>
              <button 
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-105 text-sm font-semibold rounded-xl border border-green-200 transition-colors disabled:opacity-50"
                onClick={() => loadDashboardData(user.id)}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {prescriptions.length > 0 ? (
              <div className="overflow-x-auto premium-dashboard-scroll">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                      <th className="px-6 py-4 rounded-l-2xl">Patient</th>
                      <th className="px-6 py-4">Date Issued</th>
                      <th className="px-6 py-4">Diagnosis</th>
                      <th className="px-6 py-4">Medications</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 rounded-r-2xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prescriptions.map((prescription) => (
                      <tr key={prescription.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-750 flex items-center justify-center font-bold">
                              {prescription.patient_name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{prescription.patient_name}</div>
                              <div className="text-xs text-slate-400 font-semibold">{prescription.patient_phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-600">{formatDate(prescription.date)}</td>
                        <td className="px-6 py-4">
                          <div className="text-slate-655 max-w-xs truncate font-medium">
                            {prescription.diagnosis || 'General checkup'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                            {prescription.medications?.length || 0} Meds
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-55/10 text-green-600">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                            onClick={() => {/* View details */}}
                          >
                            <FaEye size={10} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FaPrescriptionBottle size={48} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Prescriptions Found</h3>
                <p className="text-xs text-slate-505 mt-1">Prescriptions issued by you will appear here</p>
              </div>
            )}
          </div>
        )}

        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-805"><FaUsers className="text-green-600" /> My Patients ({patients.length})</h2>
              <button 
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-105 text-sm font-semibold rounded-xl border border-green-200 transition-colors disabled:opacity-50"
                onClick={() => loadDashboardData(user.id)}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {patients.length > 0 ? (
              <div className="overflow-x-auto premium-dashboard-scroll">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                      <th className="px-6 py-4 rounded-l-2xl">Patient Name</th>
                      <th className="px-6 py-4">Phone</th>
                      <th className="px-6 py-4">Last Visit</th>
                      <th className="px-6 py-4 text-center">Visits</th>
                      <th className="px-6 py-4 text-center">Prescriptions</th>
                      <th className="px-6 py-4 rounded-r-2xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((patient, index) => (
                      <tr key={patient.id || index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-750 flex items-center justify-center font-bold">
                              {patient.name?.charAt(0) || 'P'}
                            </div>
                            <span>{patient.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600">{patient.phone}</td>
                        <td className="px-6 py-4 font-semibold text-slate-550">{formatDate(patient.lastVisit)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 text-xs font-bold w-6 h-6 rounded-full border border-indigo-100">
                            {patient.totalAppointments}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-orange-50 text-orange-700 text-xs font-bold w-6 h-6 rounded-full border border-orange-100">
                            {patient.totalPrescriptions}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-xl transition-colors"
                            onClick={() => navigate(`/doctor-patient-health?patient=${patient.id}`)}
                          >
                            <FaEye size={10} /> Health Records
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FaUsers size={48} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Patients Found</h3>
                <p className="text-xs text-slate-500 mt-1">Your consultation patients will appear here</p>
              </div>
            )}
          </div>
        )}

        {/* Ratings & Reviews Tab */}
        {activeTab === 'ratings' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-805"><FaStar className="text-green-600" /> Ratings & Reviews</h2>
              <button 
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-105 text-sm font-semibold rounded-xl border border-green-200 transition-colors disabled:opacity-50"
                onClick={() => loadDashboardData(user.id)}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {ratingsSummary && ratings.length > 0 ? (
              <div className="space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score box */}
                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100 flex flex-col items-center justify-center">
                    <span className="text-5xl font-extrabold text-slate-800 tracking-tight leading-none mb-2">
                      {ratingsSummary.average_rating.toFixed(1)}
                    </span>
                    <div className="flex gap-1 mb-2">
                      {renderStars(Math.round(ratingsSummary.average_rating))}
                    </div>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Based on {ratingsSummary.total_ratings} reviews
                    </span>
                  </div>

                  {/* Distribution Bar */}
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 md:col-span-2 space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rating Distribution</h3>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingsSummary.rating_distribution[star] || 0
                      const percentage = ratingsSummary.total_ratings > 0 
                        ? (count / ratingsSummary.total_ratings) * 100 
                        : 0
                      
                      return (
                        <div key={star} className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                          <div className="flex items-center gap-1 w-8">
                            <span>{star}</span>
                            <FaStar size={10} color="#fbbf24" />
                          </div>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                          <div className="w-8 text-right text-slate-500">{count}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rating Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                      <FaThumbsUp size={20} />
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{ratingsSummary.recommend_percentage}%</span>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Recommend Rate</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-500 flex items-center justify-center flex-shrink-0">
                      <FaStar size={20} />
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{ratingsSummary.five_star_count}</span>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">5-Star Reviews</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
                      <FaUsers size={20} />
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 block leading-tight">{ratingsSummary.total_ratings}</span>
                      <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Total Reviews</span>
                    </div>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <FaQuoteLeft size={12} className="text-green-600" /> Patient Feedback
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ratings.map((rating) => (
                      <div key={rating.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold">
                                {rating.patient_name?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800">{rating.patient_name || 'Anonymous Patient'}</h4>
                                <span className="text-xs text-slate-405 font-semibold">{formatDate(rating.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex gap-0.5">
                              {renderStars(rating.rating)}
                            </div>
                          </div>

                          {rating.review && (
                            <div className="relative pl-6 pr-2 py-3 bg-slate-50 rounded-xl mb-4 text-sm text-slate-600 font-medium italic border-l-4 border-green-400">
                              <FaQuoteLeft size={12} className="absolute left-2 top-3 text-green-250" />
                              "{rating.review}"
                            </div>
                          )}

                          <div className="space-y-2 text-xs font-semibold">
                            {rating.pros && (
                              <div className="flex items-start gap-2 text-green-700 bg-green-50/50 px-3 py-2 rounded-xl border border-green-100">
                                <FaThumbsUp size={12} className="mt-0.5" />
                                <div><strong className="text-green-950 font-bold">What they liked:</strong> {rating.pros}</div>
                              </div>
                            )}
                            {rating.cons && (
                              <div className="flex items-start gap-2 text-red-700 bg-red-50/55 px-3 py-2 rounded-xl border border-red-100">
                                <FaThumbsDown size={12} className="mt-0.5" />
                                <div><strong className="text-red-955 font-bold">Areas to improve:</strong> {rating.cons}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {rating.would_recommend && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-755 text-xs font-bold rounded-full border border-green-100">
                              <FaThumbsUp size={10} /> Recommends Doctor
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FaStar size={48} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Ratings Yet</h3>
                <p className="text-xs text-slate-500 mt-1">Patient ratings and reviews will appear here</p>
              </div>
            )}
          </div>
        )}

      </main>

      <Footer />
    </div>
  )
}

export default DoctorDashboard