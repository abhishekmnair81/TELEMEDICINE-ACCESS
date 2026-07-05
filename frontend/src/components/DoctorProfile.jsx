import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaUserMd,
  FaEdit,
  FaSave,
  FaTimes,
  FaPhone,
  FaEnvelope,
  FaBriefcase,
  FaGraduationCap,
  FaCertificate,
  FaClock,
  FaCalendarAlt,
  FaStar,
  FaAward,
  FaHeartbeat,
  FaChevronLeft,
  FaCamera,
  FaSearchPlus,
} from "react-icons/fa"
import { authAPI, doctorsAPI } from "../services/api"
import Footer from "./Footer"
import "./DoctorProfile.css"


const DoctorProfile = () => {
  const navigate = useNavigate()
  const [profilePictureInput, setProfilePictureInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [user, setUser] = useState(null)
  const [doctorProfile, setDoctorProfile] = useState(null)
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
    specialization: 'general',
    qualification: '',
    experience_years: 0,
    license_number: '',
    consultation_fee: 500,
    bio: '',
    available_days: [],
    available_time_slots: [],
  })

  const specializations = [
    { value: 'general', label: 'General Physician' },
    { value: 'cardiologist', label: 'Cardiologist' },
    { value: 'dermatologist', label: 'Dermatologist' },
    { value: 'pediatrician', label: 'Pediatrician' },
    { value: 'orthopedic', label: 'Orthopedic' },
    { value: 'gynecologist', label: 'Gynecologist' },
    { value: 'psychiatrist', label: 'Psychiatrist' },
    { value: 'neurologist', label: 'Neurologist' },
  ]

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const timeSlots = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM',
    '05:00 PM - 06:00 PM',
  ]

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      console.log('[DoctorProfile] 🔄 Loading profile...')
      
      const userData = authAPI.getCurrentUser()
      if (!userData) {
        console.log('[DoctorProfile] No user data - redirecting')
        navigate('/auth?type=doctor&view=login')
        return
      }

      if (userData.user_type !== 'doctor') {
        console.log('[DoctorProfile] Not a doctor - redirecting')
        navigate('/')
        return
      }

      console.log('[DoctorProfile] Current user from localStorage:', userData)
      setUser(userData)
      
      try {
        console.log('[DoctorProfile] 📡 Fetching profile from API for user:', userData.id)
        
        const profile = await doctorsAPI.getDoctorById(userData.id)
        console.log('[DoctorProfile] ✅ Got fresh profile from API:', profile)
        
        setDoctorProfile(profile)
        
        // Update profile picture from profile data
        if (profile.user?.profile_picture_url) {
          console.log('[DoctorProfile] Setting profile picture from user:', profile.user.profile_picture_url)
          setProfilePictureUrl(profile.user.profile_picture_url)
        } else if (profile.profile_picture_url) {
          console.log('[DoctorProfile] Setting profile picture from profile:', profile.profile_picture_url)
          setProfilePictureUrl(profile.profile_picture_url)
        }

        // Initialize form with data from API response
        const newFormData = {
          first_name: profile.user?.first_name || '',
          last_name: profile.user?.last_name || '',
          email: profile.user?.email || '',
          phone_number: profile.user?.phone_number || '',
          specialization: profile.specialization || 'general',
          qualification: profile.qualification || '',
          experience_years: profile.experience_years || 0,
          license_number: profile.license_number || '',
          consultation_fee: profile.consultation_fee || 500,
          bio: profile.bio || '',
          available_days: Array.isArray(profile.available_days) ? profile.available_days : [],
          available_time_slots: Array.isArray(profile.available_time_slots) ? profile.available_time_slots : [],
          profile_picture_url: profile.user?.profile_picture_url || profile.profile_picture_url || '',
        }
        
        console.log('[DoctorProfile] 📝 Setting formData:', newFormData)
        setFormData(newFormData)
        
      } catch (error) {
        console.log('[DoctorProfile] ⚠️ Error loading profile from API:', error)
        // Fallback to user data
        setFormData(prev => ({
          ...prev,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          phone_number: userData.phone_number || '',
        }))
      }

    } catch (error) {
      console.error('[DoctorProfile] ❌ Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    console.log(`[DoctorProfile] Input changed: ${name} = ${value}`)
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day]
    }))
  }

  const handleTimeSlotToggle = (slot) => {
    setFormData(prev => ({
      ...prev,
      available_time_slots: prev.available_time_slots.includes(slot)
        ? prev.available_time_slots.filter(s => s !== slot)
        : [...prev.available_time_slots, slot]
    }))
  }

  const handleProfilePictureClick = () => {
    if (!isEditing && profilePictureUrl) setShowImageModal(true)
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
      console.log('[DoctorProfile] 💾 Saving profile...')
      console.log('[DoctorProfile] Current formData:', formData)

      // Prepare complete profile data
      const profileData = {
        // User fields
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        profile_picture_url: formData.profile_picture_url || profilePictureUrl || '',
        
        // Profile fields
        specialization: formData.specialization,
        qualification: formData.qualification.trim(),
        experience_years: parseInt(formData.experience_years) || 0,
        license_number: formData.license_number.trim(),
        consultation_fee: parseFloat(formData.consultation_fee) || 500,
        bio: formData.bio.trim(),
        available_days: formData.available_days,
        available_time_slots: formData.available_time_slots,
      }

      console.log('[DoctorProfile] 📤 Sending update:', profileData)

      const response = await doctorsAPI.updateDoctorProfile(user.id, profileData)
      console.log('[DoctorProfile] ✅ Update response:', response)

      console.log('[DoctorProfile] 🔄 Fetching fresh data from backend...')
      const freshProfile = await doctorsAPI.getDoctorById(user.id)
      console.log('[DoctorProfile] ✅ Fresh profile loaded:', freshProfile)
      
      // Update all state with fresh data
      if (freshProfile.user) {
        const updatedUser = {
          ...user,
          first_name: freshProfile.user.first_name,
          last_name: freshProfile.user.last_name,
          email: freshProfile.user.email,
          phone_number: freshProfile.user.phone_number,
          profile_picture_url: freshProfile.user.profile_picture_url || freshProfile.profile_picture_url,
        }
        
        console.log('[DoctorProfile] 💾 Updating localStorage with fresh user:', updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        
        // Update profile picture URL
        if (freshProfile.user.profile_picture_url) {
          setProfilePictureUrl(freshProfile.user.profile_picture_url)
        } else if (freshProfile.profile_picture_url) {
          setProfilePictureUrl(freshProfile.profile_picture_url)
        }
      }
      
      // Update form with fresh data
      setFormData({
        first_name: freshProfile.user?.first_name || freshProfile.first_name || formData.first_name,
        last_name: freshProfile.user?.last_name || freshProfile.last_name || formData.last_name,
        email: freshProfile.user?.email || formData.email,
        phone_number: freshProfile.user?.phone_number || formData.phone_number,
        specialization: freshProfile.specialization || formData.specialization,
        qualification: freshProfile.qualification || formData.qualification,
        experience_years: freshProfile.experience_years || formData.experience_years,
        license_number: freshProfile.license_number || formData.license_number,
        consultation_fee: freshProfile.consultation_fee || formData.consultation_fee,
        bio: freshProfile.bio || formData.bio,
        available_days: freshProfile.available_days || formData.available_days,
        available_time_slots: freshProfile.available_time_slots || formData.available_time_slots,
        profile_picture_url: freshProfile.user?.profile_picture_url || freshProfile.profile_picture_url || '',
      })
      
      // Update doctor profile state
      setDoctorProfile(freshProfile)
      
      console.log('[DoctorProfile] ✅ All state updated with fresh data')
      
      alert('Profile updated successfully!')
      setIsEditing(false)

    } catch (error) {
      console.error('[DoctorProfile] ❌ Error saving:', error)
      alert('Failed to update profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    console.log('[DoctorProfile] ❌ Canceling edit')
    setIsEditing(false)
    loadProfile() // Reload to reset form
  }

  const getSpecializationLabel = (value) => {
    const spec = specializations.find(s => s.value === value)
    return spec ? spec.label : value
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-slate-650 font-semibold">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-800 to-green-700 text-white py-6 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center w-full">
          <button 
            className="flex items-center gap-2 text-green-100 hover:text-white font-bold text-xs bg-green-900/30 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
            onClick={() => navigate('/doctor-dashboard')}
          >
            <FaChevronLeft /> Dashboard
          </button>
          <h1 className="text-lg font-bold">My Profile</h1>
          <div className="w-20"></div> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Profile Card Container */}
      <div className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="space-y-8">
          
          {/* Photo & Main Details Section */}
          <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-slate-100">
            <div className="flex flex-col items-center">
              <div 
                className={`relative w-28 h-28 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center group ${!isEditing && profilePictureUrl ? 'cursor-pointer' : ''}`}
                onClick={handleProfilePictureClick}
              >
                {profilePictureUrl ? (
                  <>
                    <img 
                      src={profilePictureUrl} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display='none'; setProfilePictureUrl(null) }}
                    />
                    {!isEditing && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                        <FaSearchPlus size={20} />
                      </div>
                    )}
                  </>
                ) : (
                  <FaUserMd size={48} className="text-slate-400" />
                )}
              </div>

              {isEditing && (
                <div className="mt-3">
                  {!showUrlInput ? (
                    <button 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold text-xs rounded-xl border border-green-200 transition-colors"
                      onClick={() => { setShowUrlInput(true); setProfilePictureInput(profilePictureUrl || '') }}
                    >
                      <FaCamera /> Photo URL
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 items-center w-60">
                      <input
                        type="url"
                        value={profilePictureInput}
                        onChange={e => setProfilePictureInput(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] rounded-lg transition-colors" onClick={handleProfilePictureUrlSave}>Apply</button>
                        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-202 text-slate-600 font-bold text-[10px] rounded-lg transition-colors" onClick={() => { setShowUrlInput(false); setProfilePictureInput('') }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Info Text */}
            <div className="flex-1 text-center md:text-left space-y-2">
              {!isEditing ? (
                <>
                  <h2 className="text-2xl font-extrabold text-slate-850">Dr. {formData.first_name} {formData.last_name}</h2>
                  <p className="inline-flex px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                    {getSpecializationLabel(formData.specialization)}
                  </p>
                  {doctorProfile?.rating && parseFloat(doctorProfile.rating) > 0 && (
                    <div className="flex items-center justify-center md:justify-start gap-3 text-xs font-semibold text-slate-655 mt-1">
                      <span className="flex items-center gap-1"><FaStar className="text-yellow-450" /> {parseFloat(doctorProfile.rating).toFixed(1)} Rating</span>
                      <span className="text-slate-300">•</span>
                      <span>{doctorProfile.total_consultations || 0} Consultations</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4 w-full">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Doctor Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 items-start">
                      <label className="text-xs font-bold text-slate-600">First Name *</label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1 items-start">
                      <label className="text-xs font-bold text-slate-600">Last Name *</label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Action button */}
            <div className="md:self-start mt-4 md:mt-0">
              {!isEditing ? (
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-705 text-white font-bold text-xs rounded-xl shadow-md shadow-green-600/10 transition-all hover:-translate-y-0.5"
                  onClick={() => setIsEditing(true)}
                >
                  <FaEdit /> Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-705 text-white font-bold text-xs rounded-xl transition-all"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <FaSave /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button 
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-202 text-slate-707 font-bold text-xs rounded-xl transition-all"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Contact Details Grid - Simplified list layout, no gray box cards */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0">
                  <FaPhone size={14} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Number</span>
                  <span className="text-sm font-bold text-slate-750">{formData.phone_number || 'Not provided'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0">
                  <FaEnvelope size={14} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Email Address</span>
                  <span className="text-sm font-bold text-slate-750">{formData.email || 'Not provided'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information - Clean grid list layout, no gray box cards */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Professional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Specialization */}
              <div className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaBriefcase size={14} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Specialization</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-slate-750">{getSpecializationLabel(formData.specialization)}</span>
                  ) : (
                    <select 
                      name="specialization" 
                      value={formData.specialization} 
                      onChange={handleInputChange}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700 bg-white"
                    >
                      {specializations.map(spec => (
                        <option key={spec.value} value={spec.value}>{spec.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Qualification */}
              <div className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaGraduationCap size={14} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Qualification</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-slate-750">{formData.qualification || 'Not provided'}</span>
                  ) : (
                    <input 
                      type="text" 
                      name="qualification" 
                      value={formData.qualification} 
                      onChange={handleInputChange} 
                      placeholder="e.g., MBBS, MD" 
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                    />
                  )}
                </div>
              </div>

              {/* License Number */}
              <div className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaCertificate size={14} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">License Number</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-slate-750">{formData.license_number || 'Not provided'}</span>
                  ) : (
                    <input 
                      type="text" 
                      name="license_number" 
                      value={formData.license_number} 
                      onChange={handleInputChange} 
                      placeholder="Medical License Number" 
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                    />
                  )}
                </div>
              </div>

              {/* Experience */}
              <div className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaClock size={14} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Years of Experience</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-slate-750">{formData.experience_years} years</span>
                  ) : (
                    <input 
                      type="number" 
                      name="experience_years" 
                      value={formData.experience_years} 
                      onChange={handleInputChange} 
                      min="0" 
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                    />
                  )}
                </div>
              </div>

              {/* Consultation Fee */}
              <div className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-650 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FaAward size={14} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Consultation Fee</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-slate-750">₹{formData.consultation_fee}</span>
                  ) : (
                    <input 
                      type="number" 
                      name="consultation_fee" 
                      value={formData.consultation_fee} 
                      onChange={handleInputChange} 
                      min="0" 
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-semibold text-slate-700"
                    />
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* About Me Bio - Clean plain description, no gray cards */}
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">About Me</h3>
            <div className="py-1">
              {!isEditing ? (
                <p className="text-sm text-slate-655 leading-relaxed font-medium">
                  {formData.bio || 'No bio provided yet. Click "Edit Profile" to add your bio.'}
                </p>
              ) : (
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Write a brief bio about yourself, your experience, and your approach to patient care..."
                  rows="4"
                  className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-medium text-slate-655 bg-white"
                />
              )}
            </div>
          </div>

          {/* Availability Schedule */}
          <div className="border-t border-slate-100 pt-6 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Availability Schedule</h3>
            
            {/* Days Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 block">Available Days</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map(day => {
                  const isSelected = formData.available_days.includes(day)
                  return (
                    <button
                      key={day}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected 
                          ? 'bg-green-600 text-white shadow-md shadow-green-600/10' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      } ${!isEditing ? 'cursor-default opacity-85' : 'cursor-pointer hover:scale-103 active:scale-97'}`}
                      onClick={() => isEditing && handleDayToggle(day)}
                      disabled={!isEditing}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time Slots Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 block">Available Time Slots</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {timeSlots.map(slot => {
                  const isSelected = formData.available_time_slots.includes(slot)
                  return (
                    <button
                      key={slot}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                        isSelected 
                          ? 'bg-green-600 text-white shadow-md shadow-green-600/10' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      } ${!isEditing ? 'cursor-default opacity-85' : 'cursor-pointer hover:scale-103 active:scale-97'}`}
                      onClick={() => isEditing && handleTimeSlotToggle(slot)}
                      disabled={!isEditing}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Performance Statistics - Simple inline stats grid, no box card containers */}
          {doctorProfile && (
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Statistics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex items-center gap-3.5 py-1">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <FaHeartbeat size={16} />
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-800 leading-tight">{doctorProfile.total_consultations || 0}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Consultations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 py-1">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-500 flex items-center justify-center flex-shrink-0">
                    <FaStar size={16} />
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-800 leading-tight">{doctorProfile.rating ? parseFloat(doctorProfile.rating).toFixed(1) : '0.0'}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Avg Rating</p>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 py-1">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center flex-shrink-0">
                    <FaCalendarAlt size={16} />
                  </div>
                  <div>
                    <h4 className="text-xl font-extrabold text-slate-800 leading-tight">{formData.experience_years}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Years Experience</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Lightbox Modal */}
      {showImageModal && profilePictureUrl && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-modal cursor-pointer"
          onClick={() => setShowImageModal(false)}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-zoom-in cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">Dr. {formData.first_name} {formData.last_name}</h3>
              <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowImageModal(false)}>
                <FaTimes size={20} />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-slate-900 max-h-[70vh]">
              <img src={profilePictureUrl} alt="Profile" className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg" />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default DoctorProfile