import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { 
  FaUser, 
  FaUserMd, 
  FaPills, 
  FaPhone, 
  FaLock, 
  FaEnvelope, 
  FaIdCard, 
  FaArrowLeft, 
  FaHeartbeat, 
  FaKey,
  FaShieldAlt,
  FaUserShield,
  FaStethoscope
} from "react-icons/fa"
import "./AuthSystem.css"

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api'

const AuthSystem = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentView, setCurrentView] = useState("select")
  const [userType, setUserType] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // OTP states
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState("")
  const [tempPhone, setTempPhone] = useState("")
  const [tempEmail, setTempEmail] = useState("")
  
  const [loginForm, setLoginForm] = useState({ phone: "" })
  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "", 
    phone: "", 
    email: "", 
    password: "", 
    confirmPassword: "", 
    licenseNumber: "",
    specialization: "",
    qualification: "",
    pharmacyName: "",
    pharmacyAddress: ""
  })

  // Handle URL parameters for direct navigation from dropdowns
  useEffect(() => {
    const type = searchParams.get('type')
    const view = searchParams.get('view')
    
    if (type && ['patient', 'doctor', 'pharmacist'].includes(type)) {
      setUserType(type)
      if (view === 'login' || view === 'register') {
        setCurrentView(view)
      } else {
        setCurrentView('login')
      }
    }
  }, [searchParams])

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value })
    setError("")
  }

  const handleRegisterChange = (e) => {
    setRegisterForm({ ...registerForm, [e.target.name]: e.target.value })
    setError("")
  }

  const handleOtpChange = (e) => {
    setOtpValue(e.target.value)
    setError("")
  }

  // ============================================================================
  // OTP LOGIN FLOW
  // ============================================================================

  const handleRequestLoginOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const phoneNumber = loginForm.phone.trim()

    if (!phoneNumber || phoneNumber.length !== 10) {
      setError("Please enter a valid 10-digit phone number")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp-login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber }),
      })

      const data = await response.json()
      console.log('[AuthSystem] Send OTP response:', data)

      if (response.ok && data.success) {
        setOtpSent(true)
        setTempPhone(phoneNumber)
        setError("")
        
        if (data.otp) {
          console.log("🔐 OTP (DEBUG):", data.otp)
        }
      } else {
        if (data.requires_registration) {
          setError("No account found. Please register first.")
          setTimeout(() => {
            setCurrentView("register")
            setRegisterForm({ ...registerForm, phone: phoneNumber })
          }, 2000)
        } else {
          setError(data.error || "Failed to send OTP. Please try again.")
        }
      }
    } catch (err) {
      console.error('Request OTP error:', err)
      setError("Server error. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyLoginOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!otpValue || otpValue.length !== 6) {
      setError("Please enter the 6-digit OTP")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp-login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: tempPhone,
          otp: otpValue,
        }),
      })

      const data = await response.json()
      console.log('[AuthSystem] Login OTP verification response:', data)

      if (response.ok && data.success) {
        const userData = {
          id: data.user.id,
          phone_number: data.user.phone_number || tempPhone,
          email: data.user.email,
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          user_type: data.user.user_type,
          profile_picture_url: data.user.profile_picture_url || null,
          ...data.user
        }
        
        console.log('[AuthSystem] Storing user data:', userData)
        
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('accessToken', data.tokens?.access)
        localStorage.setItem('refreshToken', data.tokens?.refresh)
        
        window.dispatchEvent(new Event('storage'))
        
        setTimeout(() => {
          const loginUserType = data.user.user_type
          if (loginUserType === 'patient') {
            navigate('/')
          } else if (loginUserType === 'doctor') {
            navigate('/doctor-dashboard')
          } else if (loginUserType === 'pharmacist') {
            navigate('/pharmacy-home')
          } else {
            navigate('/')
          }
        }, 100)
      } else {
        setError(data.error || "Invalid OTP. Please try again.")
      }
    } catch (err) {
      console.error('[AuthSystem] Verify OTP error:', err)
      setError("Server error. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // OTP REGISTRATION FLOW
  // ============================================================================

  const handleRequestRegisterOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const phoneNumber = registerForm.phone.trim()
    const email = registerForm.email.trim()

    if (!phoneNumber || phoneNumber.length !== 10) {
      setError("Please enter a valid 10-digit phone number")
      setLoading(false)
      return
    }

    if (!email || !email.includes('@')) {
      setError("Please enter a valid email address")
      setLoading(false)
      return
    }

    if (!registerForm.firstName) {
      setError("Please enter your first name")
      setLoading(false)
      return
    }

    if (registerForm.password.length < 6) {
      setError("Password must be at least 6 characters long")
      setLoading(false)
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords don't match!")
      setLoading(false)
      return
    }

    if (userType === 'doctor' && !registerForm.licenseNumber) {
      setError("Medical license number is required")
      setLoading(false)
      return
    }

    if (userType === 'pharmacist' && !registerForm.licenseNumber) {
      setError("Pharmacy license is required")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp-register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          email: email,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setOtpSent(true)
        setTempPhone(phoneNumber)
        setTempEmail(email)
        setError("")
        
        if (data.otp) {
          console.log("🔐 OTP (DEBUG):", data.otp)
        }
      } else {
        setError(data.error || "Failed to send OTP. Please try again.")
      }
    } catch (err) {
      console.error('Request registration OTP error:', err)
      setError("Server error. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyRegisterOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!otpValue || otpValue.length !== 6) {
      setError("Please enter the 6-digit OTP")
      setLoading(false)
      return
    }

    try {
      const registrationData = {
        phone_number: tempPhone,
        otp: otpValue,
        user_type: userType,
        first_name: registerForm.firstName,
        last_name: registerForm.lastName,
        email: tempEmail,
        password: registerForm.password
      }

      if (userType === 'doctor') {
        registrationData.license_number = registerForm.licenseNumber
        registrationData.specialization = registerForm.specialization || 'general'
        registrationData.qualification = registerForm.qualification || 'MBBS'
      } else if (userType === 'pharmacist') {
        registrationData.pharmacy_license = registerForm.licenseNumber
        registrationData.pharmacy_name = registerForm.pharmacyName || 'Pharmacy'
        registrationData.pharmacy_address = registerForm.pharmacyAddress || ''
      }

      const response = await fetch(`${API_BASE_URL}/auth/verify-otp-register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const userData = {
          id: data.user.id,
          phone_number: data.user.phone_number || tempPhone,
          email: data.user.email || tempEmail,
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          user_type: userType,
          profile_picture_url: data.user.profile_picture_url || null,
          ...data.user
        }
        
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('accessToken', data.tokens?.access)
        localStorage.setItem('refreshToken', data.tokens?.refresh)

        window.dispatchEvent(new Event('storage'))

        if (userType === 'patient') navigate('/')
        else if (userType === 'doctor') navigate('/doctor-dashboard')
        else if (userType === 'pharmacist') navigate('/pharmacy-home')
      } else {
        setError(data.error || 'Invalid OTP or registration failed. Please try again.')
      }
    } catch (err) {
      console.error('Verify registration OTP error:', err)
      setError('Server error. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  const selectUserType = (type) => { 
    setUserType(type)
    setCurrentView("login")
    setError("")
    setOtpSent(false)
    setOtpValue("")
  }

  const resetView = () => {
    setCurrentView("select")
    setUserType("")
    setError("")
    setOtpSent(false)
    setOtpValue("")
    setTempPhone("")
    setTempEmail("")
    setLoginForm({ phone: "" })
    setRegisterForm({ 
      firstName: "",
      lastName: "",
      phone: "", 
      email: "", 
      password: "", 
      confirmPassword: "", 
      licenseNumber: "",
      specialization: "",
      qualification: "",
      pharmacyName: "",
      pharmacyAddress: ""
    })
  }

  const getUserIcon = () => {
    if (userType === "doctor") return <FaUserMd size={32} className="text-teal-600" />
    if (userType === "pharmacist") return <FaPills size={32} className="text-emerald-600" />
    return <FaUser size={32} className="text-sky-600" />
  }

  const getUserTitle = () => {
    if (userType === "doctor") return "Doctor"
    if (userType === "pharmacist") return "Pharmacist"
    return "Patient"
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/40 via-slate-50 to-white flex flex-col items-center justify-center py-6 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {currentView === "select" && (
        <div className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl flex flex-col items-center">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-teal-600/10 text-teal-600 border border-teal-500/10 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Rural HealthCare</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-semibold">Your health, our priority</p>
          </div>

          <h2 className="text-base font-bold text-slate-800 mb-1.5">Select Account Type</h2>
          <p className="text-[10px] text-slate-400 mb-6 text-center font-bold uppercase tracking-wider">Choose your role to get started</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
            <button 
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-sky-500/30 rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-pointer" 
              onClick={() => selectUserType("patient")}
            >
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 shadow-sm mb-4">
                <FaUser />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">Patient Portal</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">Book appointments, order medications & consult doctors</p>
            </button>

            <button 
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-teal-500/30 rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-pointer" 
              onClick={() => selectUserType("doctor")}
            >
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-teal-500 group-hover:text-white transition-all duration-300 shadow-sm mb-4">
                <FaUserMd />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-600 transition-colors">Doctor Portal</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">Consult patients, generate medical prescriptions & schedules</p>
            </button>

            <button 
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-pointer" 
              onClick={() => selectUserType("pharmacist")}
            >
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm mb-4">
                <FaPills />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Pharmacist Portal</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">Verify scripts, manage inventory & handle orders</p>
            </button>
          </div>
        </div>
      )}

      {(currentView === "login" || currentView === "register") && (
        <div className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row my-auto">
          
          {/* Info Card Column (Zero Images, beautiful gradient, spacious yet optimized) */}
          <div className="w-full md:w-5/12 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
            {/* Soft decorative background circles */}
            <div className="absolute -top-10 -left-10 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2">
                <FaHeartbeat className="text-2xl text-teal-200 animate-pulse" />
                <span className="text-base font-black tracking-tight text-white">Rural HealthCare</span>
              </div>
              
              <div className="space-y-1.5">
                <h2 className="text-2xl font-black leading-tight text-white tracking-tight">Access Digital Healthcare</h2>
                <p className="text-xs text-teal-100/90 leading-relaxed font-semibold">
                  Connecting remote villages with instant online clinical consults, certified pharmacists, and smart AI medical monitoring.
                </p>
              </div>
              
              {/* Value list */}
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-200 flex-shrink-0 text-sm shadow-sm">
                    <FaStethoscope />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">Top Doctors Consult</h4>
                    <p className="text-[10px] text-teal-100/80 font-medium mt-0.5">Video/voice link directly with medical specialists across India.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-200 flex-shrink-0 text-sm shadow-sm">
                    <FaShieldAlt />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">Genuine Pharmacy</h4>
                    <p className="text-[10px] text-teal-100/80 font-medium mt-0.5">Order verified medicines securely directly from local retail stores.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-200 flex-shrink-0 text-sm shadow-sm">
                    <FaUserShield />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">Encrypted Security</h4>
                    <p className="text-[10px] text-teal-100/80 font-medium mt-0.5">Your prescription history, charts, and biometric logs are 100% secure.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-8 text-[10px] text-teal-200/60 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Rural HealthCare. Trusted by over 50k+ users.
            </div>
          </div>

          {/* Form Column */}
          <div className="w-full md:w-7/12 p-8 md:p-10 bg-white flex flex-col justify-center relative">
            <div>
              <button 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 text-xs font-bold transition-all mb-4 cursor-pointer"
                onClick={resetView}
              >
                <FaArrowLeft /> Switch Role
              </button>

              <div className="mb-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0">
                  {getUserIcon()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {currentView === "login" ? `${getUserTitle()} Login` : `${getUserTitle()} Registration`}
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                    {currentView === "login" 
                      ? (otpSent ? "Verify code sent to email" : "Enter phone to log in") 
                      : (otpSent ? "Verify code sent to email" : "Create your medical account")
                    }
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm animate-shake">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                  {error}
                </div>
              )}

              {/* LOGIN FORM */}
              {currentView === "login" && !otpSent && (
                <form className="space-y-4" onSubmit={handleRequestLoginOTP}>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                    <div className="relative flex items-center">
                      <FaPhone className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
                      <input
                        type="tel"
                        name="phone"
                        value={loginForm.phone}
                        onChange={handleLoginChange}
                        placeholder="Enter 10-digit number"
                        pattern="[0-9]{10}"
                        maxLength="10"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all shadow-sm placeholder-slate-400"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button 
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 font-semibold">
                      New user? <span className="text-teal-600 hover:text-teal-700 cursor-pointer underline transition-colors" onClick={() => setCurrentView("register")}>Register here</span>
                    </p>
                  </div>
                </form>
              )}

              {/* OTP VERIFICATION FOR LOGIN */}
              {currentView === "login" && otpSent && (
                <form className="space-y-4" onSubmit={handleVerifyLoginOTP}>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-semibold text-slate-600 space-y-0.5 shadow-sm">
                    <p>OTP sent to your registered email</p>
                    <p className="text-teal-600 font-bold">Phone: {tempPhone}</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Enter OTP</label>
                    <div className="relative flex items-center">
                      <FaKey className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
                      <input
                        type="text"
                        value={otpValue}
                        onChange={handleOtpChange}
                        placeholder="Enter 6-digit OTP"
                        pattern="[0-9]{6}"
                        maxLength="6"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-bold tracking-widest text-teal-600 focus:outline-none transition-all shadow-inner placeholder-slate-400"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button 
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 disabled:opacity-50" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 font-semibold">
                      Didn't receive OTP? <span className="text-teal-600 hover:text-teal-700 cursor-pointer underline transition-colors" onClick={() => {
                        setOtpSent(false)
                        setOtpValue("")
                      }}>Resend</span>
                    </p>
                  </div>
                </form>
              )}

              {/* REGISTRATION FORM */}
              {currentView === "register" && !otpSent && (
                <form className="space-y-3" onSubmit={handleRequestRegisterOTP}>
                  {/* Grid layout for fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    
                    {/* First Name */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={registerForm.firstName}
                        onChange={handleRegisterChange}
                        placeholder="First name"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                        required
                        disabled={loading}
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={registerForm.lastName}
                        onChange={handleRegisterChange}
                        placeholder="Last name"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                        disabled={loading}
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Phone Number</label>
                      <div className="relative flex items-center">
                        <FaPhone className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                        <input
                          type="tel"
                          name="phone"
                          value={registerForm.phone}
                          onChange={handleRegisterChange}
                          placeholder="10-digit number"
                          pattern="[0-9]{10}"
                          maxLength="10"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Email Address</label>
                      <div className="relative flex items-center">
                        <FaEnvelope className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                        <input
                          type="email"
                          name="email"
                          value={registerForm.email}
                          onChange={handleRegisterChange}
                          placeholder="Enter email"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Create Password */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Create Password</label>
                      <div className="relative flex items-center">
                        <FaLock className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                        <input
                          type="password"
                          name="password"
                          value={registerForm.password}
                          onChange={handleRegisterChange}
                          placeholder="Min 6 characters"
                          minLength="6"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Confirm Password</label>
                      <div className="relative flex items-center">
                        <FaLock className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                        <input
                          type="password"
                          name="confirmPassword"
                          value={registerForm.confirmPassword}
                          onChange={handleRegisterChange}
                          placeholder="Confirm password"
                          minLength="6"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* DOCTOR-SPECIFIC FIELDS */}
                    {userType === "doctor" && (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">License Number</label>
                          <div className="relative flex items-center">
                            <FaIdCard className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                            <input
                              type="text"
                              name="licenseNumber"
                              value={registerForm.licenseNumber}
                              onChange={handleRegisterChange}
                              placeholder="License number"
                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Specialization</label>
                          <select
                            name="specialization"
                            value={registerForm.specialization}
                            onChange={handleRegisterChange}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none transition-all cursor-pointer"
                            disabled={loading}
                          >
                            <option value="">Select spec</option>
                            <option value="general">General Physician</option>
                            <option value="cardiologist">Cardiologist</option>
                            <option value="dermatologist">Dermatologist</option>
                            <option value="pediatrician">Pediatrician</option>
                            <option value="orthopedic">Orthopedic</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Qualification</label>
                          <input
                            type="text"
                            name="qualification"
                            value={registerForm.qualification}
                            onChange={handleRegisterChange}
                            placeholder="e.g., MBBS, MD"
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}

                    {/* PHARMACIST-SPECIFIC FIELDS */}
                    {userType === "pharmacist" && (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">License Number</label>
                          <div className="relative flex items-center">
                            <FaIdCard className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                            <input
                              type="text"
                              name="licenseNumber"
                              value={registerForm.licenseNumber}
                              onChange={handleRegisterChange}
                              placeholder="License number"
                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Pharmacy Name</label>
                          <input
                            type="text"
                            name="pharmacyName"
                            value={registerForm.pharmacyName}
                            onChange={handleRegisterChange}
                            placeholder="Pharmacy name"
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                            disabled={loading}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Pharmacy Address</label>
                          <input
                            type="text"
                            name="pharmacyAddress"
                            value={registerForm.pharmacyAddress}
                            onChange={handleRegisterChange}
                            placeholder="Pharmacy store full address"
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}

                  </div>

                  <button 
                    className="w-full py-2.5 mt-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 font-semibold">
                      Already have an account? <span className="text-teal-600 hover:text-teal-700 cursor-pointer underline transition-colors" onClick={() => setCurrentView("login")}>Login here</span>
                    </p>
                  </div>
                </form>
              )}

              {/* OTP VERIFICATION FOR REGISTRATION */}
              {currentView === "register" && otpSent && (
                <form className="space-y-4" onSubmit={handleVerifyRegisterOTP}>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 space-y-0.5 shadow-sm">
                    <p>OTP sent to your registered email: <span className="text-slate-950 font-bold">{tempEmail}</span></p>
                    <p className="text-teal-600 font-bold">Phone: {tempPhone}</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Enter OTP</label>
                    <div className="relative flex items-center">
                      <FaKey className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
                      <input
                        type="text"
                        value={otpValue}
                        onChange={handleOtpChange}
                        placeholder="Enter 6-digit OTP"
                        pattern="[0-9]{6}"
                        maxLength="6"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-bold tracking-widest text-teal-600 focus:outline-none transition-all shadow-inner placeholder-slate-400"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button 
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 disabled:opacity-50" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Verify & Create Account'}
                  </button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-slate-500 font-semibold">
                      Didn't receive OTP? <span className="text-teal-600 hover:text-teal-700 cursor-pointer underline transition-colors" onClick={() => {
                        setOtpSent(false)
                        setOtpValue("")
                      }}>Resend</span>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuthSystem