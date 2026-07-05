import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaUser,
  FaEdit,
  FaSave,
  FaTimes,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaVenusMars,
  FaTint,
  FaWeight,
  FaRuler,
  FaHeartbeat,
  FaChevronLeft,
  FaClock,
  FaCamera,
  FaAllergies,
  FaPills,
  FaNotesMedical,
  FaUserInjured,
  FaSearchPlus,
} from "react-icons/fa"
import "./PatientProfile.css"
import "./Dashboard.css"
import Footer from "./Footer"
import { authAPI, patientsAPI } from "../services/api"


const PatientProfile = () => {
  const navigate = useNavigate()
  const [profilePictureInput, setProfilePictureInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [user, setUser] = useState(null)
  const [patientProfile, setPatientProfile] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profilePictureUrl, setProfilePictureUrl] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    height: '',
    weight: '',
    allergies: '',
    chronic_conditions: '',
    current_medications: '',
    medical_history: '',
  })

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  const genders = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ]

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      console.log('[PatientProfile] Loading profile...')
      
      const userData = authAPI.getCurrentUser()
      if (!userData) {
        console.log('[PatientProfile] No user data - redirecting')
        navigate('/auth?type=patient&view=login')
        return
      }

      if (userData.user_type !== 'patient') {
        console.log('[PatientProfile] Not a patient - redirecting')
        navigate('/')
        return
      }

      setUser(userData)

      try {
        console.log('[PatientProfile] Fetching profile for user:', userData.id)
        const profile = await patientsAPI.getPatientDetails(userData.id)
        console.log('[PatientProfile] ✅ Got profile:', profile)
        
        setPatientProfile(profile)
        
        // Set profile picture URL
        if (profile.profile_picture_url) {
          setProfilePictureUrl(profile.profile_picture_url)
        } else {
          setProfilePictureUrl(null)
        }
        
        setFormData({
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || '',
          phone_number: profile.phone_number || '',
          date_of_birth: profile.date_of_birth || '',
          gender: profile.gender || 'male',
          blood_group: profile.blood_group || '',
          address: profile.address || '',
          city: profile.city || '',
          state: profile.state || '',
          pincode: profile.pincode || '',
          emergency_contact_name: profile.emergency_contact_name || '',
          emergency_contact_number: profile.emergency_contact_number || '',
          height: profile.height || '',
          weight: profile.weight || '',
          allergies: profile.allergies || '',
          chronic_conditions: profile.chronic_conditions || '',
          current_medications: profile.current_medications || '',
          medical_history: profile.medical_history || '',
          profile_picture_url: profile.profile_picture_url || '',
        })
      } catch (error) {
        console.log('[PatientProfile] Error loading profile, using basic user data:', error)
        setFormData(prev => ({
          ...prev,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          phone_number: userData.phone_number || '',
        }))
      }

    } catch (error) {
      console.error('[PatientProfile] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleProfilePictureClick = () => {
    if (!isEditing && profilePictureUrl) {
      setShowImageModal(true)
    }
  }

  const handleProfilePictureUrlSave = () => {
    const url = profilePictureInput.trim()
    if (!url) { alert('Please enter a valid image URL'); return }
    if (!/^https?:\/\//i.test(url)) { alert('URL must start with http:// or https://'); return }
    setProfilePictureUrl(url)
    setFormData(prev => ({ ...prev, profile_picture_url: url }))
    setShowUrlInput(false)
    setProfilePictureInput('')
    alert('Profile picture URL set! Save the profile to apply.')
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      console.log('[PatientProfile] Saving profile:', formData)

      const profileData = {
        first_name: formData.first_name || '',
        last_name: formData.last_name || '',
        email: formData.email || '',
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || 'male',
        blood_group: formData.blood_group || '',
        address: formData.address || '',
        city: formData.city || '',
        state: formData.state || '',
        pincode: formData.pincode || '',
        emergency_contact_name: formData.emergency_contact_name || '',
        emergency_contact_number: formData.emergency_contact_number || '',
        height: formData.height || null,
        weight: formData.weight || null,
        allergies: formData.allergies || '',
        chronic_conditions: formData.chronic_conditions || '',
        current_medications: formData.current_medications || '',
        medical_history: formData.medical_history || '',
        profile_picture_url: formData.profile_picture_url || '',
      }

      console.log('[PatientProfile] Sending profile update:', profileData)
      const response = await patientsAPI.updatePatientProfile(user.id, profileData)
      console.log('[PatientProfile] ✅ Profile updated successfully:', response)

      const updatedUser = {
        ...user,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || '',
        gender: formData.gender || '',
        blood_group: formData.blood_group || '',
        city: formData.city || '',
        state: formData.state || '',
        profile_picture_url: response.profile_picture_url || formData.profile_picture_url || '',
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)

      alert('Profile updated successfully!')
      setIsEditing(false)
      await loadProfile()
    } catch (error) {
      console.error('[PatientProfile] Error saving:', error)
      alert('Failed to update profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    loadProfile()
  }

  const calculateAge = (dob) => {
    if (!dob) return null
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null
    const heightInMeters = height / 100
    const bmi = weight / (heightInMeters * heightInMeters)
    return bmi.toFixed(1)
  }

  const getBMICategory = (bmi) => {
    if (!bmi) return ''
    const bmiNum = parseFloat(bmi)
    if (bmiNum < 18.5) return 'Underweight'
    if (bmiNum < 25) return 'Normal weight'
    if (bmiNum < 30) return 'Overweight'
    return 'Obese'
  }

  const displayValue = (value) => {
    if (value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '')) {
      return 'Not provided'
    }
    return value
  }

  if (loading) {
    return (
      <div className="min-height-screen bg-gray-50 flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-semibold text-sm">Loading health profile details...</p>
      </div>
    )
  }

  const bmiVal = calculateBMI(formData.weight, formData.height)
  const bmiCategory = getBMICategory(bmiVal)

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between patient-profile-container">
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
          <div className="rural-wrapper max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                onClick={() => navigate('/patient-dashboard')}
              >
                <FaChevronLeft /> Dashboard
              </button>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">Patient Health Profile</h1>
            </div>
            <div>
              {!isEditing ? (
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  onClick={() => setIsEditing(true)}
                >
                  <FaEdit /> Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <FaSave /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button 
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: PROFILE CARD & STATS */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Primary Profile Card */}
            <div className="bg-white rounded-3xl border border-gray-200/70 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-br from-green-600 to-green-700 p-8 text-center text-white relative">
                
                {/* Photo wrapper */}
                <div className="relative w-28 h-28 mx-auto mb-4 group">
                  <div 
                    onClick={handleProfilePictureClick}
                    className={`w-full h-full rounded-full border-4 border-white bg-green-50/30 overflow-hidden flex items-center justify-center text-white shadow-md relative ${profilePictureUrl && !isEditing ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {profilePictureUrl ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={profilePictureUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          onError={() => setProfilePictureUrl(null)}
                        />
                        {!isEditing && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <FaSearchPlus size={20} className="text-white" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <FaUser className="text-4xl opacity-80" />
                    )}
                  </div>

                  {isEditing && (
                    <button 
                      onClick={() => { setShowUrlInput(true); setProfilePictureInput(profilePictureUrl || '') }}
                      className="absolute -bottom-1 -right-1 bg-white hover:bg-gray-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border border-gray-200 transition-transform hover:scale-105"
                      title="Set Photo URL"
                    >
                      <FaCamera size={13} />
                    </button>
                  )}
                </div>

                {showUrlInput && isEditing && (
                  <div className="absolute inset-0 bg-gray-900/95 p-4 flex flex-col justify-center items-center z-10 transition-all">
                    <span className="text-xs font-bold text-white mb-2">Provide Image Address URL</span>
                    <input 
                      type="url"
                      value={profilePictureInput}
                      onChange={e => setProfilePictureInput(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full text-gray-900 text-xs px-3 py-2 rounded-lg border border-gray-300 focus:outline-none mb-2"
                    />
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={handleProfilePictureUrlSave}
                        className="flex-1 bg-green-600 text-white text-[11px] font-bold py-1.5 rounded-md hover:bg-green-700"
                      >
                        Apply
                      </button>
                      <button 
                        onClick={() => { setShowUrlInput(false); setProfilePictureInput('') }}
                        className="flex-1 bg-gray-800 text-white text-[11px] font-bold py-1.5 rounded-md hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Patient Name / Badge */}
                {!isEditing ? (
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">{formData.first_name} {formData.last_name}</h2>
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-green-50/25 border border-green-400/30 text-[10px] uppercase font-bold tracking-widest rounded-full">
                      Patient Account
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <input 
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="First Name"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center text-sm placeholder-white/50 text-white focus:outline-none focus:border-white focus:bg-white/20"
                    />
                    <input 
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Last Name"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center text-sm placeholder-white/50 text-white focus:outline-none focus:border-white focus:bg-white/20"
                    />
                  </div>
                )}
              </div>

              {/* Patient Basic Quick Stats badges */}
              <div className="p-6 bg-gray-50/70 border-t border-gray-100 grid grid-cols-2 gap-3 text-center text-xs">
                {formData.date_of_birth && (
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Age</span>
                    <span className="font-extrabold text-gray-800 text-sm">{calculateAge(formData.date_of_birth)} Years</span>
                  </div>
                )}
                {formData.gender && (
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Gender</span>
                    <span className="font-extrabold text-gray-800 text-sm capitalize">{formData.gender}</span>
                  </div>
                )}
                {formData.blood_group && (
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Blood Type</span>
                    <span className="font-extrabold text-rose-600 text-sm">{formData.blood_group}</span>
                  </div>
                )}
                {bmiVal && (
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center col-span-1">
                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">BMI</span>
                    <span className="font-extrabold text-gray-800 text-sm">{bmiVal} <span className="text-[10px] font-normal text-gray-500">({bmiCategory.split(' ')[0]})</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Health summary / count indicators */}
            {patientProfile && patientProfile.statistics && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200/70 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <FaHeartbeat className="text-green-600" /> Medical Log Summary
                </h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <FaCalendarAlt className="text-gray-400" /> Appointments
                    </div>
                    <span className="text-sm font-extrabold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                      {patientProfile.statistics.total_appointments || 0}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <FaPills className="text-gray-400" /> Active Prescriptions
                    </div>
                    <span className="text-sm font-extrabold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                      {patientProfile.statistics.active_prescriptions || 0}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <FaNotesMedical className="text-gray-400" /> Consultations
                    </div>
                    <span className="text-sm font-extrabold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                      {patientProfile.statistics.total_consultations || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: FULL EDITABLE DETAILS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Contact & Personal details card */}
            <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-extrabold text-gray-900 text-sm tracking-tight flex items-center gap-2">
                  <FaUser className="text-green-600" /> Patient Contact &amp; Personal Info
                </h3>
              </div>

              <div className="p-6 space-y-6">
                
                {/* 2x2 Grid for Contact Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phone Number</label>
                    <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                      <FaPhone className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-bold">{displayValue(formData.phone_number)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                        <FaEnvelope className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-semibold">{displayValue(formData.email)}</span>
                      </div>
                    ) : (
                      <input 
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter email address"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Date of Birth</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                        <FaCalendarAlt className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-semibold">
                          {formData.date_of_birth 
                            ? new Date(formData.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                            : 'Not provided'}
                        </span>
                      </div>
                    ) : (
                      <input 
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleInputChange}
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Blood Group</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                        <FaTint className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-rose-600">{displayValue(formData.blood_group)}</span>
                      </div>
                    ) : (
                      <select 
                        name="blood_group"
                        value={formData.blood_group}
                        onChange={handleInputChange}
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select Blood Group</option>
                        {bloodGroups.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gender</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                        <FaVenusMars className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-semibold capitalize">{formData.gender || 'Not provided'}</span>
                      </div>
                    ) : (
                      <select 
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {genders.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Location (City, State)</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50/50 border border-gray-200 p-3 rounded-xl">
                        <FaMapMarkerAlt className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs font-semibold">
                          {formData.city || formData.state 
                            ? `${formData.city}${formData.city && formData.state ? ', ' : ''}${formData.state}`
                            : 'Not provided'}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="City"
                          className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input 
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="State"
                          className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete Address & Pincode */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Complete Address</label>
                    {!isEditing ? (
                      <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[50px]">
                        {displayValue(formData.address)}
                      </p>
                    ) : (
                      <textarea 
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter complete residential address"
                        rows="2"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pincode</label>
                    {!isEditing ? (
                      <div className="text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[50px] flex items-center">
                        {displayValue(formData.pincode)}
                      </div>
                    ) : (
                      <input 
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleInputChange}
                        placeholder="e.g. 600001"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contacts & Vitals card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Emergency Contact Card */}
              <div className="bg-white rounded-3xl border border-gray-200/70 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                  <FaUserInjured className="text-rose-600" /> Emergency Contact
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact Person</label>
                    {!isEditing ? (
                      <div className="text-xs font-bold text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {displayValue(formData.emergency_contact_name)}
                      </div>
                    ) : (
                      <input 
                        type="text"
                        name="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={handleInputChange}
                        placeholder="Contact Person Name"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact Number</label>
                    {!isEditing ? (
                      <div className="text-xs font-bold text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {displayValue(formData.emergency_contact_number)}
                      </div>
                    ) : (
                      <input 
                        type="tel"
                        name="emergency_contact_number"
                        value={formData.emergency_contact_number}
                        onChange={handleInputChange}
                        placeholder="Contact Number"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Physical Metrics Card */}
              <div className="bg-white rounded-3xl border border-gray-200/70 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
                  <FaRuler className="text-green-600" /> Physical Vitals
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Height (cm)</label>
                    {!isEditing ? (
                      <div className="text-xs font-extrabold text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {formData.height ? `${formData.height} cm` : 'Not provided'}
                      </div>
                    ) : (
                      <input 
                        type="number"
                        name="height"
                        value={formData.height}
                        onChange={handleInputChange}
                        placeholder="Height in cm"
                        min="0"
                        step="0.1"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Weight (kg)</label>
                    {!isEditing ? (
                      <div className="text-xs font-extrabold text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        {formData.weight ? `${formData.weight} kg` : 'Not provided'}
                      </div>
                    ) : (
                      <input 
                        type="number"
                        name="weight"
                        value={formData.weight}
                        onChange={handleInputChange}
                        placeholder="Weight in kg"
                        min="0"
                        step="0.1"
                        className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>
                </div>

                {bmiVal && (
                  <div className="bg-green-50/50 border border-green-200/50 p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-green-700">Body Mass Index (BMI):</span>
                    <span className="font-extrabold text-green-800 bg-white border border-green-200/60 px-2.5 py-0.5 rounded-md">
                      {bmiVal} - {bmiCategory}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Medical history & conditions card */}
            <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-extrabold text-gray-900 text-sm tracking-tight flex items-center gap-2">
                  <FaNotesMedical className="text-green-600" /> Patient Medical File
                </h3>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Allergies */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <FaAllergies className="text-rose-500" /> Allergies
                  </div>
                  {!isEditing ? (
                    <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200/70 border-l-4 border-l-rose-500 leading-relaxed">
                      {displayValue(formData.allergies) === 'Not provided' ? 'No known allergies reported' : formData.allergies}
                    </p>
                  ) : (
                    <textarea 
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleInputChange}
                      placeholder="List any medicine, food, or chemical allergies..."
                      rows="2"
                      className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

                {/* Chronic Conditions */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <FaUserInjured className="text-amber-500" /> Chronic Conditions
                  </div>
                  {!isEditing ? (
                    <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200/70 border-l-4 border-l-amber-500 leading-relaxed">
                      {displayValue(formData.chronic_conditions) === 'Not provided' ? 'No chronic medical conditions listed' : formData.chronic_conditions}
                    </p>
                  ) : (
                    <textarea 
                      name="chronic_conditions"
                      value={formData.chronic_conditions}
                      onChange={handleInputChange}
                      placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma..."
                      rows="2"
                      className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

                {/* Medications */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <FaPills className="text-green-600" /> Current Medications
                  </div>
                  {!isEditing ? (
                    <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200/70 border-l-4 border-l-green-500 leading-relaxed">
                      {displayValue(formData.current_medications) === 'Not provided' ? 'No active regular medications logged' : formData.current_medications}
                    </p>
                  ) : (
                    <textarea 
                      name="current_medications"
                      value={formData.current_medications}
                      onChange={handleInputChange}
                      placeholder="List name, dosage, and daily times of medicines..."
                      rows="2"
                      className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

                {/* Medical History */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <FaNotesMedical className="text-blue-500" /> Past Medical History
                  </div>
                  {!isEditing ? (
                    <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200/70 border-l-4 border-l-blue-500 leading-relaxed">
                      {displayValue(formData.medical_history) === 'Not provided' ? 'No historical operations or medical files uploaded' : formData.medical_history}
                    </p>
                  ) : (
                    <textarea 
                      name="medical_history"
                      value={formData.medical_history}
                      onChange={handleInputChange}
                      placeholder="List major past surgeries, hospitalizations, or illnesses..."
                      rows="3"
                      className="w-full text-xs font-medium bg-white border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* FULL PREVIEW MODAL */}
      {showImageModal && profilePictureUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in-modal"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="relative max-w-2xl w-full flex flex-col items-center animate-zoom-in"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors focus:outline-none"
            >
              <FaTimes size={20} />
            </button>
            <div className="bg-gray-900 p-4 rounded-t-2xl w-full border border-gray-800 text-center">
              <h3 className="text-sm font-bold text-white tracking-tight">{formData.first_name} {formData.last_name}</h3>
            </div>
            <div className="bg-gray-900 p-2 rounded-b-2xl w-full flex items-center justify-center border-x border-b border-gray-800">
              <img 
                src={profilePictureUrl} 
                alt="Profile View" 
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default PatientProfile