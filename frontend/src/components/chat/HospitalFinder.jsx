
import { useState, useEffect } from 'react'
import { FaMapMarkerAlt, FaPhone, FaTimes, FaExclamationTriangle, FaCheck } from 'react-icons/fa'
import './HospitalFinder.css'

const HospitalFinder = ({ emergencyLevel, onClose }) => {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getLocation = () => {
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLoading(false)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setError('Unable to get your location. Please enable location access.')
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const openGoogleMaps = () => {
    if (location) {

      const url = `https://www.google.com/maps/search/hospitals/@${location.lat},${location.lng},15z`
      window.open(url, '_blank')
    } else {

      const url = 'https://www.google.com/maps/search/hospitals'
      window.open(url, '_blank')
    }
  }

  const callEmergency = () => {

    window.location.href = 'tel:108'
  }

  return (
    <div className="hospital-finder-overlay" onClick={onClose}>
      <div className="hospital-finder-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        {}
        {emergencyLevel === 'critical' && (
          <div className="emergency-alert critical">
            <FaExclamationTriangle size={24} />
            <div>
              <h3>CRITICAL EMERGENCY</h3>
              <p>Please call emergency services immediately or go to the nearest emergency room.</p>
            </div>
          </div>
        )}

        {emergencyLevel === 'urgent' && (
          <div className="emergency-alert urgent">
            <FaExclamationTriangle size={20} />
            <div>
              <h3>URGENT MEDICAL ATTENTION</h3>
              <p>Seek medical care within 24 hours.</p>
            </div>
          </div>
        )}

        {}
        <div className="hospital-finder-content">
          <h2>
            <FaMapMarkerAlt /> Find Nearby Hospitals
          </h2>

          {}
          {emergencyLevel === 'critical' && (
            <button
              className="emergency-call-btn"
              onClick={callEmergency}
            >
              <FaPhone /> Call Emergency (108)
            </button>
          )}

          {}
          {!location ? (
            <button
              className="get-location-btn"
              onClick={getLocation}
              disabled={loading}
            >
              {loading ? 'Getting your location...' : <span><FaMapMarkerAlt style={{ marginRight: '6px' }} /> Get My Location</span>}
            </button>
          ) : (
            <div className="location-success">
              <p><FaCheck style={{ marginRight: '6px', color: '#28a745' }} /> Location obtained</p>
              <button
                className="show-hospitals-btn"
                onClick={openGoogleMaps}
              >
                Show Nearby Hospitals on Map
              </button>
            </div>
          )}

          {}
          {error && (
            <div className="error-message">
              <p>{error}</p>
              <p className="error-help">
                You can manually search for hospitals on Google Maps.
              </p>
              <button
                className="manual-search-btn"
                onClick={openGoogleMaps}
              >
                Open Google Maps
              </button>
            </div>
          )}

          {}
          <div className="emergency-numbers">
            <h3>Emergency Contact Numbers</h3>
            <ul>
              <li>
                <span><FaPhone /> National Ambulance</span>
                <strong>108</strong>
              </li>
              <li>
                <span><FaPhone /> State Ambulance</span>
                <strong>102</strong>
              </li>
            </ul>
          </div>

          {}
          <div className="disclaimer">
            <p>
              <strong>Important:</strong> For critical emergencies, always call emergency services first
              before searching for hospitals. Your safety is the top priority.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HospitalFinder