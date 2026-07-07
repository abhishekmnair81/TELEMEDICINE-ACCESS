import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  FaPills,
  FaUser,
  FaCamera,
  FaEdit,
  FaCheckCircle,
  FaTimesCircle,
  FaTruck,
  FaArrowLeft,
  FaPhone,
  FaMapMarkerAlt,
  FaClock,
  FaSignOutAlt,
  FaChevronDown,
  FaTimes,
  FaMoon,
  FaSun,
  FaMedkit
} from "react-icons/fa"
import { authAPI, pharmacistsAPI } from "../services/api"
import Footer from "./Footer"
import "./PharmacistProfile.css"

const PharmacistProfile = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const [pharmacistProfile, setPharmacistProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileEditData, setProfileEditData] = useState({})
  const [profileSuccess, setProfileSuccess] = useState("")
  const [profileError, setProfileError] = useState("")
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [photoUrlInput, setPhotoUrlInput] = useState('')


  useEffect(() => {
    const userData = authAPI.getCurrentUser()
    if (!userData) {
      navigate("/auth?type=pharmacist&view=login")
      return
    }
    if (userData.user_type !== "pharmacist") {
      navigate("/")
      return
    }
    setUser(userData)
    setIsCheckingAuth(false)
  }, [navigate])

  useEffect(() => {
    if (user) loadPharmacistProfile()
  }, [user])


  const loadPharmacistProfile = async () => {
    setProfileLoading(true)
    setProfileError("")
    try {
      const data = await pharmacistsAPI.getProfile(user.id)
      setPharmacistProfile(data)
    } catch (e) {
      setProfileError(e.message || "Failed to load profile")
    } finally {
      setProfileLoading(false)
    }
  }

  const p = pharmacistProfile || {}

  const startProfileEditing = () => {
    setProfileEditData({
      first_name:        p.first_name        || "",
      last_name:         p.last_name         || "",
      email:             p.email             || user?.email || "",
      phone_number:      p.phone_number      || "",
      gender:            p.gender            || "",
      date_of_birth:     p.date_of_birth     || "",
      city:              p.city              || "",
      state:             p.state             || "",
      pincode:           p.pincode           || "",
      address:           p.address           || "",
      pharmacy_name:      p.pharmacy_name      || "",
      pharmacy_license:   p.pharmacy_license   || "",
      pharmacy_address:   p.pharmacy_address   || "",
      pharmacy_phone:     p.pharmacy_phone     || "",
      pharmacy_email:     p.pharmacy_email     || "",
      delivery_available: p.delivery_available ?? true,
      delivery_radius_km: p.delivery_radius_km || "",
      profile_picture_url: p.profile_picture_url || "",
    })
    setProfileEditing(true)
    setProfileError("")
    setProfileSuccess("")
  }

  const cancelProfileEditing = () => {
    setProfileEditing(false)
    setProfileEditData({})
    setProfileError("")
  }

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target
    setProfileEditData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    setProfileError("")
    setProfileSuccess("")
    try {
      const payload = { ...profileEditData }
      if (payload.delivery_radius_km === "" || payload.delivery_radius_km === null) {
        delete payload.delivery_radius_km
      } else {
        payload.delivery_radius_km = parseInt(payload.delivery_radius_km, 10) || 0
      }

      await pharmacistsAPI.updateProfile(user.id, payload)
      await loadPharmacistProfile()
      setProfileEditing(false)
      setProfileSuccess("Profile updated successfully!")
      setTimeout(() => setProfileSuccess(""), 4000)
    } catch (e) {
      setProfileError(e.message || "Failed to save profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePhotoUrlSave = () => {
    const url = photoUrlInput.trim()
    if (!url) { setProfileError('Please enter a valid image URL'); return }
    if (!/^https?:\/\//i.test(url)) { setProfileError('URL must start with http:// or https://'); return }

    setPharmacistProfile(prev => prev ? { ...prev, profile_picture_url: url } : prev)
    setProfileEditData(prev => ({ ...prev, profile_picture_url: url }))
    setShowPhotoModal(false)
    setPhotoUrlInput('')
    setProfileSuccess('Profile picture URL set! Save the profile to apply.')
    setTimeout(() => setProfileSuccess(''), 5000)
  }

  const closePhotoModal = () => {
    setShowPhotoModal(false)
    setPhotoUrlInput('')
  }

  const handlePhotoClick = () => {
    if (profileEditing) {
      setShowPhotoModal(true)
    } else if (profilePicUrl) {
      setShowImageViewer(true)
    }
  }

  const renderStars = (rating) => {
    const r = parseFloat(rating) || 0
    return "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r))
  }

  const handleLogout = () => {
    authAPI.logout()
    navigate("/auth?type=pharmacist&view=login")
  }

  const displayEmail  = p.email || user?.email || ""
  const profilePicUrl = p.profile_picture_url || p.profile_picture || null

  if (isCheckingAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-550">Loading Auth...</p>
      </div>
    )
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50/50 text-slate-800'
    }`}>
      {}
      <div className="bg-green-600 text-white py-2.5 text-xs font-bold shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><FaPhone className="text-[10px]" /> Emergency support: 108</span>
            <span className="flex items-center gap-1.5"><FaClock className="text-[10px]" /> 24/7 Pharmacy Service</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            <FaMedkit /> Complete Medical Shop Solution
          </div>
        </div>
      </div>

      {}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/pharmacy-home')}>
            <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white text-xl shadow-md shadow-green-600/20 relative">
              <FaPills />
              <div className="absolute inset-0 bg-green-500 rounded-2xl blur-lg opacity-20 -z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-green-600 dark:text-green-400">
                PharmaCare
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Medical Shop Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <Link to="/pharmacy-home" className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-green-600 transition-colors">Home</Link>
            <button
              onClick={() => navigate('/pharmacist-dashboard')}
              className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-green-600 transition-colors bg-transparent border-none cursor-pointer"
            >
              Dashboard
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center text-sm border-none cursor-pointer transition-transform duration-300 hover:rotate-12"
            >
              {darkMode ? <FaSun className="text-amber-500" /> : <FaMoon />}
            </button>

            <div
              className="relative"
              onMouseEnter={() => setShowProfileDropdown(true)}
              onMouseLeave={() => setShowProfileDropdown(false)}
            >
              <div className="w-10 h-10 rounded-full bg-green-600 text-white font-black flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 transition-all select-none">
                {user.first_name.charAt(0)}
              </div>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-850 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-modal-in">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-600 text-white font-black flex items-center justify-center text-lg select-none">
                      {user.first_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{user.first_name} {user.last_name}</h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5">Pharmacist</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-700" />
                  <div className="p-2">
                    <button
                      className="w-full text-left px-3 py-2 bg-rose-50 hover:bg-rose-100/70 text-rose-605 rounded-lg text-xs font-black flex items-center gap-2 border-none cursor-pointer transition-colors"
                      onClick={handleLogout}
                    >
                      <FaSignOutAlt /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/pharmacist-dashboard")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 cursor-pointer"
            >
              <FaArrowLeft />
              <span>Dashboard</span>
            </button>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FaUser className="text-green-600" />
              <span>My Profile</span>
            </h2>
          </div>

          <div className="flex gap-2">
            {!profileEditing ? (
              <button
                onClick={startProfileEditing}
                disabled={profileLoading}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer flex items-center gap-1.5"
              >
                <FaEdit /> Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={cancelProfileEditing}
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer"
                >
                  {profileSaving ? "Saving…" : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>

        {}
        {profileSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-2xl mb-6 flex items-center gap-2.5 border border-emerald-100 dark:border-emerald-900/50 text-xs font-bold shadow-sm">
            <FaCheckCircle className="text-sm" /> <span>{profileSuccess}</span>
          </div>
        )}
        {profileError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 rounded-2xl mb-6 flex items-center gap-2.5 border border-rose-100 dark:border-rose-900/50 text-xs font-bold shadow-sm">
            <FaTimesCircle className="text-sm" /> <span>{profileError}</span>
          </div>
        )}

        {profileLoading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center gap-3 text-center shadow-sm">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loading profile details...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm transition-colors">
            {}
            <div className="relative py-10 bg-gradient-to-b from-green-50/50 to-transparent dark:from-green-950/10 dark:to-transparent flex flex-col items-center gap-4 border-b border-slate-100 dark:border-slate-800/60">
              <div
                className={`relative group ${profileEditing ? "cursor-pointer" : (profilePicUrl ? "cursor-zoom-in" : "cursor-default")}`}
                onClick={handlePhotoClick}
                title={profileEditing ? "Change profile photo" : (profilePicUrl ? "Click to zoom" : "")}
              >
                {profilePicUrl ? (
                  <img
                    src={profilePicUrl}
                    alt="Profile"
                    className="w-28 h-28 rounded-full object-cover border-4 border-green-600 shadow-md shadow-green-600/10 group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-green-50 dark:bg-green-950/20 border-4 border-green-650 flex items-center justify-center text-4xl shadow-md shadow-green-600/5">
                    🧑‍⚕️
                  </div>
                )}

                {}
                {profileEditing && (
                  <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md">
                    <FaCamera className="text-xs" />
                  </div>
                )}

                {}
                {!profileEditing && profilePicUrl && (
                  <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-slate-800/90 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                    👁
                  </div>
                )}
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-850 dark:text-slate-205 leading-snug">
                  {[p.first_name, p.last_name].filter(Boolean).join(" ") || `${user.first_name} ${user.last_name}`}
                </h3>
                <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1">
                  🏥 {p.pharmacy_name || "Pharmacy Name Not Set"}
                </p>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{displayEmail}</p>

                {p.rating && parseFloat(p.rating) > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-amber-500 text-sm tracking-wide">{renderStars(p.rating)}</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{parseFloat(p.rating).toFixed(1)} / 5.0</span>
                  </div>
                )}

                <div className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <FaTruck className="text-[9px]" />
                  <span>
                    {p.delivery_available
                      ? `Delivery up to ${p.delivery_radius_km || "?"} km`
                      : "No Delivery"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {}
              <div>
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <FaUser className="text-[10px] text-green-600" /> Personal Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {[
                    { label: "First Name",    field: "first_name" },
                    { label: "Last Name",     field: "last_name" },
                    { label: "Email",         field: "email",         type: "email",  rootValue: displayEmail },
                    { label: "Phone Number",  field: "phone_number",  type: "tel" },
                    { label: "Gender",        field: "gender",        type: "select",
                      options: [{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }] },
                    { label: "Date of Birth", field: "date_of_birth", type: "date" },
                    { label: "City",          field: "city" },
                    { label: "State",         field: "state" },
                    { label: "Pincode",       field: "pincode" },
                  ].map(({ label, field, type = "text", options, rootValue }) => {
                    const displayVal = rootValue !== undefined ? rootValue : p[field]
                    return (
                      <div key={field} className="flex flex-col">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                        {profileEditing ? (
                          type === "select" ? (
                            <select
                              name={field}
                              value={profileEditData[field] || ""}
                              onChange={handleProfileChange}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                            >
                              <option value="">Select…</option>
                              {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          ) : (
                            <input
                              type={type}
                              name={field}
                              value={profileEditData[field] || ""}
                              onChange={handleProfileChange}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                            />
                          )
                        ) : (
                          <div className={`px-1 py-2 border-b border-dashed border-slate-200 dark:border-slate-800 text-sm font-semibold min-h-[38px] flex items-center ${
                            displayVal ? 'text-slate-850 dark:text-slate-205' : 'text-slate-400 dark:text-slate-500 italic'
                          }`}>
                            {displayVal || "—"}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Street Address</label>
                  {profileEditing ? (
                    <textarea
                      name="address"
                      value={profileEditData.address || ""}
                      onChange={handleProfileChange}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white resize-none"
                    />
                  ) : (
                    <div className={`px-1 py-2 border-b border-dashed border-slate-200 dark:border-slate-800 text-sm font-semibold min-h-[38px] flex items-center ${
                      p.address ? 'text-slate-850 dark:text-slate-205' : 'text-slate-400 dark:text-slate-500 italic'
                    }`}>
                      {p.address || "—"}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800/80" />

              {}
              <div>
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <FaPills className="text-[10px] text-green-600" /> Pharmacy Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: "Pharmacy Name",    field: "pharmacy_name" },
                    { label: "License Number",   field: "pharmacy_license" },
                    { label: "Pharmacy Phone",   field: "pharmacy_phone",  type: "tel" },
                    { label: "Pharmacy Email",   field: "pharmacy_email",  type: "email" },
                  ].map(({ label, field, type = "text" }) => (
                    <div key={field} className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                      {profileEditing ? (
                        <input
                          type={type}
                          name={field}
                          value={profileEditData[field] || ""}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                        />
                      ) : (
                        <div className={`px-1 py-2 border-b border-dashed border-slate-200 dark:border-slate-800 text-sm font-semibold min-h-[38px] flex items-center ${
                          p[field] ? 'text-slate-850 dark:text-slate-205' : 'text-slate-400 dark:text-slate-500 italic'
                        }`}>
                          {p[field] || "—"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Pharmacy Address</label>
                  {profileEditing ? (
                    <textarea
                      name="pharmacy_address"
                      value={profileEditData.pharmacy_address || ""}
                      onChange={handleProfileChange}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white resize-none"
                    />
                  ) : (
                    <div className={`px-1 py-2 border-b border-dashed border-slate-200 dark:border-slate-800 text-sm font-semibold min-h-[38px] flex items-center ${
                      p.pharmacy_address ? 'text-slate-850 dark:text-slate-205' : 'text-slate-400 dark:text-slate-500 italic'
                    }`}>
                      {p.pharmacy_address || "—"}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800/80" />

              {}
              <div>
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <FaTruck className="text-[10px] text-green-600" /> Delivery Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Delivery Available</label>
                    {profileEditing ? (
                      <label className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          name="delivery_available"
                          checked={!!profileEditData.delivery_available}
                          onChange={handleProfileChange}
                          className="w-4.5 h-4.5 accent-green-650 rounded cursor-pointer"
                        />
                        <span>
                          {profileEditData.delivery_available ? "Available" : "Not Available"}
                        </span>
                      </label>
                    ) : (
                      <div className="py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          p.delivery_available
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
                        }`}>
                          {p.delivery_available ? "✓ Available" : "✗ Not Available"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Delivery Radius (km)</label>
                    {profileEditing ? (
                      <input
                        type="number"
                        name="delivery_radius_km"
                        value={profileEditData.delivery_radius_km || ""}
                        onChange={handleProfileChange}
                        min={0}
                        placeholder="e.g. 10"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                      />
                    ) : (
                      <div className={`px-1 py-2 border-b border-dashed border-slate-200 dark:border-slate-800 text-sm font-semibold min-h-[38px] flex items-center ${
                        p.delivery_radius_km ? 'text-slate-850 dark:text-slate-205' : 'text-slate-400 dark:text-slate-500 italic'
                      }`}>
                        {p.delivery_radius_km ? `${p.delivery_radius_km} km` : "—"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {}
      {showImageViewer && profilePicUrl && (
        <div
          onClick={() => setShowImageViewer(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative max-w-sm w-full flex flex-col items-center gap-4 animate-modal-in"
          >
            <button
              onClick={() => setShowImageViewer(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-500 hover:text-rose-605 flex items-center justify-center border-none cursor-pointer transition-colors"
            >
              <FaTimes />
            </button>
            <img
              src={profilePicUrl}
              alt="Profile"
              className="w-64 h-64 rounded-2xl object-contain bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
            />
            <div className="text-center space-y-0.5">
              <h4 className="text-sm font-black text-slate-850 dark:text-slate-205">
                {[p.first_name, p.last_name].filter(Boolean).join(" ") || `${user.first_name} ${user.last_name}`}
              </h4>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{p.pharmacy_name}</p>
            </div>
          </div>
        </div>
      )}

      {}
      {showPhotoModal && (
        <div
          onClick={(e) => e.target === e.currentTarget && closePhotoModal()}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-modal-in space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-205 uppercase tracking-wider">Set Profile Picture URL</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold leading-relaxed">Paste a direct image URL (from Cloudinary, Google, GitHub, or any public host).</p>
            </div>

            <input
              type="url"
              value={photoUrlInput}
              onChange={e => setPhotoUrlInput(e.target.value)}
              placeholder="https://example.com/your-photo.jpg"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-green-650 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
            />

            {photoUrlInput && /^https?:\/\//.test(photoUrlInput) && (
              <div className="flex justify-center border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950">
                <img
                  src={photoUrlInput}
                  alt="Preview"
                  onError={e => { e.target.style.display = 'none' }}
                  className="max-h-40 rounded-xl object-cover border border-slate-200 shadow-sm"
                />
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                onClick={closePhotoModal}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePhotoUrlSave}
                disabled={!photoUrlInput.trim()}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply URL
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default PharmacistProfile