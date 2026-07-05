'use client';
import { useNavigate, Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import {
  FaRobot,
  FaVideo,
  FaPrescriptionBottle,
  FaCalendarCheck,
  FaChartLine,
  FaPills,
  FaUserMd,
  FaUsers,
  FaClock,
  FaAward,
  FaPhone,
  FaMicrophone,
  FaMapMarkerAlt,
  FaHeartbeat,
  FaAmbulance,
  FaCalendarAlt,
  FaCheckCircle,
  FaLaptopMedical,
  FaShieldAlt,
  FaChevronDown,
  FaStar,
  FaArrowRight,
  FaArrowLeft,
  FaBars,
  FaSearch,
  FaShoppingCart,
  FaTags,
  FaPercentage,
  FaBox,
  FaStethoscope,
  FaFirstAid,
  FaThermometerHalf,
  FaBolt,
  FaFire,
  FaGift,
  FaFileMedical,
  FaCalculator,
  FaTint,
  FaRunning,
  FaWeight,
} from "react-icons/fa"

import { doctorsAPI, pharmacyAPI } from "../services/api"
import LanguageSelector from './common/LanguageSelector'
import Footer from "./Footer"
import "./Dashboard.css"


const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:8000';
const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getMedicineImage = (product) => {
  if (!product) return null;
  if (product.primary_image) return resolveImageUrl(product.primary_image);
  if (product.images && product.images.length > 0) {
    const img = product.images.find(i => i.is_primary) || product.images[0];
    return resolveImageUrl(img.image_url || img.image);
  }
  if (product.image) return resolveImageUrl(product.image);
  return null;
};

const useCountAnimation = (end, duration = 2000) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    let animationFrame;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const numericEnd = parseFloat(end.toString().replace(/[^0-9.]/g, ''));
      const currentCount = Math.floor(progress * numericEnd);

      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(numericEnd);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, end, duration]);

  return [count, ref];
};

const HERO_SLIDES = [
  {
    image: "/ai_diagnostics_realistic.png",
    alt: "AI Diagnostics",
    tag: "24/7 AI Health Chatbot",
    titleParts: [
      { text: "Healthcare at Your ", highlight: false },
      { text: "Doorstep", highlight: true, block: true }
    ],
    subtitle: "Experience quality medical care with our AI-powered platform. Consult our advanced MedAI chatbot to get instant diagnostics, symptom analysis, and answers to health questions.",
    buttonText: "Talk to AI Doctor",
    buttonIcon: "robot",
    action: "/chat",
    tabTitle: "AI Diagnostics",
    tabLabel: "Talk to MedAI 24/7",
    tabDesc: "Get Instant Symptom Analysis",
    badgeTop: "AI Chat Assistant",
    badgeBottom: "24/7 Response"
  },
  {
    image: "/doctor_appointments_realistic.png",
    alt: "Doctor Consultation",
    tag: "Verified Specialist Clinic",
    titleParts: [
      { text: "Consult Top ", highlight: false },
      { text: "Doctors ", highlight: true },
      { text: "Online", highlight: true, block: true }
    ],
    subtitle: "Book online video sessions or in-person physical appointments with leading verified medical specialists near you. Skip travel and clinic waiting times.",
    buttonText: "Book Appointment",
    buttonIcon: "calendar",
    action: "/appointments",
    tabTitle: "Doctor Appointments",
    tabLabel: "Schedule Consultation",
    tabDesc: "Connect with Verified Specialists",
    badgeTop: "VERIFIED SPECIALISTS",
    badgeBottom: "TOP CARE"
  },
  {
    image: "/digital_pharmacy_realistic.png",
    alt: "Online Pharmacy",
    tag: "Genuine Medical Store",
    titleParts: [
      { text: "Medicines Delivered ", highlight: false },
      { text: "To Your Door", highlight: true, block: true }
    ],
    subtitle: "Browse and order genuine drugs from local pharmacies. Enjoy flat 20% discount on first upload of prescriptions with super-fast delivery in your sector.",
    buttonText: "Order Medicines",
    buttonIcon: "pills",
    action: "#pharmacy-products",
    tabTitle: "Digital Pharmacy",
    tabLabel: "Genuine Medicines",
    tabDesc: "Express Home Delivery",
    badgeTop: "Flat 20% Discount",
    badgeBottom: "Home Delivery"
  }
]

const Dashboard = () => {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState({ aiChatbot: true, stats: true })
  const [user, setUser] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  // Interactive Carousel State and Timer for Hero Visual Banner
  const [currentSlide, setCurrentSlide] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  const [topDoctors, setTopDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [doctorsError, setDoctorsError] = useState(null)

  const [featuredProducts, setFeaturedProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  const searchInputRef = useRef(null)
  const mobileSearchInputRef = useRef(null)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [addingToCartId, setAddingToCartId] = useState(null)

  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    return localStorage.getItem('deliveryAddress') || 'Thrissur 678593'
  })
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [tempAddress, setTempAddress] = useState(deliveryAddress)
  const [cartCount, setCartCount] = useState(0)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState([])
  const [searchingMap, setSearchingMap] = useState(false)

  const leafletMapInstance = useRef(null)
  const markerInstance = useRef(null)

  // Smart Health Tools State
  const [activeTool, setActiveTool] = useState('bmi') // 'bmi' | 'water'
  
  // BMI Calculator State
  const [weight, setWeight] = useState(70) // kg
  const [height, setHeight] = useState(170) // cm
  
  // Water Calculator State
  const [userWeight, setUserWeight] = useState(70) // kg
  const [activityLevel, setActivityLevel] = useState('moderate') // 'sedentary' | 'moderate' | 'active'
  const [waterLogged, setWaterLogged] = useState(0) // ml

  // Close mobile actions and user dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowUserDropdown(false)
      setIsMobileMenuOpen(false)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Dynamically load Leaflet script & styling
  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if (!document.querySelector('script[src*="leaflet.js"]')) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  // Geocoding helper — uses Nominatim to get full detailed address for given coords
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      if (res.ok) {
        const data = await res.json()
        const addr = data.address || {}
        // Build address from granular components for maximum detail
        const parts = [
          addr.house_number,
          addr.road || addr.pedestrian || addr.footway || addr.path,
          addr.neighbourhood || addr.suburb || addr.quarter,
          addr.city_block || addr.city_district,
          addr.city || addr.town || addr.village || addr.hamlet,
          addr.county || addr.state_district,
          addr.state,
          addr.postcode,
        ].filter(Boolean)
        const formatted = parts.length > 0 ? parts.join(', ') : (data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        setTempAddress(formatted)
      }
    } catch (error) {
      setTempAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
  }

  // Location search helper
  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return
    setSearchingMap(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&countrycodes=in`)
      if (res.ok) {
        const data = await res.json()
        setMapSearchResults(data.slice(0, 5))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSearchingMap(false)
    }
  }

  const selectMapSearchResult = (result) => {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    const name = result.display_name
    
    // Clean up trailing ", India"
    const cleanedName = name.replace(/, India$/, '').trim()
    setTempAddress(cleanedName)
    setMapSearchResults([])
    setMapSearchQuery('')
    
    if (leafletMapInstance.current && window.L) {
      leafletMapInstance.current.setView([lat, lon], 19)
      if (markerInstance.current) {
        markerInstance.current.setLatLng([lat, lon])
      }
    }
  }

  const fallbackToIP = async () => {
    setIsLocating(true)
    try {
      const res = await fetch('https://ip-api.com/json/')
      if (res.ok) {
        const ipData = await res.json()
        if (ipData && ipData.status === 'success') {
          const { lat, lon } = ipData
          
          if (leafletMapInstance.current && window.L) {
            leafletMapInstance.current.setView([lat, lon], 19)
            if (markerInstance.current) {
              markerInstance.current.setLatLng([lat, lon])
            }
          }
          await reverseGeocode(lat, lon)
          showToast("📍 Location detected via network (approximate)", "success")
          return
        }
      }
    } catch (err) {
      console.error("IP fallback failed:", err)
    } finally {
      setIsLocating(false)
    }
    showToast("Unable to retrieve location. Please select on the map or search manually.", "error")
  }

  // Detect Current Location — progressive watchPosition, only moves pin when GPS is accurate
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      fallbackToIP()
      return
    }
    setIsLocating(true)
    showToast('🔍 Scanning for GPS signal...', 'success')
    let bestAccuracy = Infinity
    let watchId = null
    const stopTimer = setTimeout(() => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      setIsLocating(false)
      if (bestAccuracy > 500) {
        showToast('⚠️ GPS signal weak. Drag the pin to your exact location.', 'error')
      }
    }, 20000)

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        // Skip readings worse than what we already have
        if (accuracy >= bestAccuracy) return
        bestAccuracy = accuracy

        // Update the map view and RED pin ONLY when accuracy is good (under 200m)
        // This prevents wrong-location jumps from coarse Wi-Fi/IP positioning
        if (accuracy <= 200) {
          const zoom = accuracy <= 20 ? 19 : accuracy <= 80 ? 18 : accuracy <= 200 ? 16 : 14
          if (leafletMapInstance.current && window.L) {
            leafletMapInstance.current.setView([latitude, longitude], zoom)
            if (markerInstance.current) {
              markerInstance.current.setLatLng([latitude, longitude])
            }
          }
          await reverseGeocode(latitude, longitude)

          if (accuracy <= 50) {
            clearTimeout(stopTimer)
            navigator.geolocation.clearWatch(watchId)
            watchId = null
            setIsLocating(false)
            showToast(`📍 Live location found (±${Math.round(accuracy)}m)`, 'success')
          }
        }
      },
      async (error) => {
        clearTimeout(stopTimer)
        if (watchId !== null) navigator.geolocation.clearWatch(watchId)
        watchId = null
        console.warn('Geolocation API failed:', error)
        // If GPS is blocked (PERMISSION_DENIED = 1), tell user to allow it
        if (error.code === 1) {
          showToast('🚫 Location permission denied. Please allow location access in browser settings.', 'error')
          setIsLocating(false)
        } else {
          await fallbackToIP()
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  // Initialize/Teardown Leaflet Map on modal open/close
  useEffect(() => {
    if (!showAddressModal) {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove()
        leafletMapInstance.current = null
        markerInstance.current = null
      }
      return
    }

    const initTimer = setTimeout(() => {
      if (!window.L || !document.getElementById('rural-modal-map')) return

      const L = window.L

      // Default center: Thrissur area
      const lat = 10.5276
      const lng = 76.2144

      // --- Map init with zoom controls on bottom-right (like Google Maps) ---
      const map = L.map('rural-modal-map', {
        zoomControl: false,
        attributionControl: true,
        maxZoom: 22,
        minZoom: 3
      }).setView([lat, lng], 16)

      leafletMapInstance.current = map

      // --- OpenStreetMap (reliable, no API key, works at all zoom levels) ---
      const streetLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 22,
          maxNativeZoom: 19,
          subdomains: ['a', 'b', 'c'],
          detectRetina: true,
          crossOrigin: true
        }
      ).addTo(map)

      // --- ESRI World Imagery (Satellite — reliable, high zoom, no key required) ---
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics',
          maxZoom: 22,
          maxNativeZoom: 20,
          detectRetina: true
        }
      )

      let isSatellite = false
      // --- Layer toggle control (Street / Satellite) ---
      const layerToggle = L.control({ position: 'topright' })
      layerToggle.onAdd = () => {
        const btn = L.DomUtil.create('button', 'map-layer-toggle-btn')
        btn.innerHTML = '🛰 Satellite'
        btn.title = 'Toggle satellite view'
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e)
          if (isSatellite) {
            map.removeLayer(satelliteLayer)
            map.addLayer(streetLayer)
            btn.innerHTML = '🛰 Satellite'
          } else {
            map.removeLayer(streetLayer)
            map.addLayer(satelliteLayer)
            btn.innerHTML = '🗺 Street'
          }
          isSatellite = !isSatellite
        })
        return btn
      }
      layerToggle.addTo(map)

      // --- Zoom control — bottom right ---
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // --- Google Maps-style drop-pin (red teardrop) ---
      const dropPinIcon = L.divIcon({
        html: `
          <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 48 18 48C18 48 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="#EA4335"/>
            <circle cx="18" cy="18" r="7" fill="white"/>
          </svg>`,
        className: 'gmap-drop-pin',
        iconSize: [36, 48],
        iconAnchor: [18, 48],
        popupAnchor: [0, -48]
      })

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: dropPinIcon
      }).addTo(map)
      markerInstance.current = marker

      // --- Drag to update address ---
      marker.on('dragend', async () => {
        const pos = marker.getLatLng()
        map.panTo(pos)
        await reverseGeocode(pos.lat, pos.lng)
      })

      // --- Click map to drop pin ---
      map.on('click', async (e) => {
        marker.setLatLng(e.latlng)
        map.panTo(e.latlng)
        await reverseGeocode(e.latlng.lat, e.latlng.lng)
      })

      // --- Auto-locate on modal open ---
      // Blue dot = your device's approximate location (from GPS/WiFi)
      // Red pin  = your delivery address (only moves when GPS is accurate)
      if (navigator.geolocation) {
        let bestAccuracy = Infinity
        let myLocCircle = null
        let myLocDot = null
        let geoWatchId = null

        geoWatchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const { latitude, longitude, accuracy } = pos.coords
            if (accuracy >= bestAccuracy) return
            bestAccuracy = accuracy

            // Always update the blue "you are here" indicator dot
            if (myLocCircle) map.removeLayer(myLocCircle)
            if (myLocDot) map.removeLayer(myLocDot)

            myLocCircle = L.circle([latitude, longitude], {
              radius: Math.min(accuracy, 5000), // cap circle at 5km
              color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.08, weight: 1.5,
              interactive: false
            }).addTo(map)

            myLocDot = L.circleMarker([latitude, longitude], {
              radius: 8, color: 'white', fillColor: '#4285F4', fillOpacity: 1, weight: 2.5,
              interactive: false
            }).addTo(map)

            // Only move the red delivery pin and center the map when GPS accuracy is under 200m.
            // Without this threshold, a coarse Wi-Fi fix (accuracy=3000m) would jump the map
            // to a completely wrong area (e.g. southern tip of India instead of Palakkad).
            if (accuracy <= 200) {
              const zoom = accuracy <= 20 ? 19 : accuracy <= 80 ? 18 : accuracy <= 200 ? 16 : 14
              map.setView([latitude, longitude], zoom)
              marker.setLatLng([latitude, longitude])
              await reverseGeocode(latitude, longitude)

              if (accuracy <= 30 && geoWatchId !== null) {
                navigator.geolocation.clearWatch(geoWatchId)
                geoWatchId = null
              }
            }
          },
          () => {
            // GPS denied/failed — leave map at default, user can search manually
            console.warn('GPS unavailable on map init — user can search manually')
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        )
        map.on('remove', () => {
          if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId)
        })
      }
    }, 350)

    return () => clearTimeout(initTimer)
  }, [showAddressModal])

  const loadCartCount = () => {
    try {
      const localCart = JSON.parse(localStorage.getItem('pharmacy_cart') || '[]')
      const totalCount = localCart.reduce((sum, item) => sum + (item.quantity || 0), 0)
      setCartCount(totalCount)
    } catch (error) {
      setCartCount(0)
    }
  }

  useEffect(() => {
    loadCartCount()
    window.addEventListener('cartUpdated', loadCartCount)
    window.addEventListener('storage', loadCartCount)
    return () => {
      window.removeEventListener('cartUpdated', loadCartCount)
      window.removeEventListener('storage', loadCartCount)
    }
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    const handleScroll = () => {
      if (window.scrollY > 80) {
        document.body.classList.add('scrolled')
      } else {
        document.body.classList.remove('scrolled')
        document.body.classList.remove('mobile-search-open')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Simulated chat messages for the AI preview
  const [chatMessages, setChatMessages] = useState([
    { sender: 'user', text: "Hello! I have a sore throat and fever." },
    { sender: 'bot', text: "Hi! I can help you evaluate your symptoms. How long have you had the fever, and do you have any difficulty swallowing?" }
  ])
  const [chatIndex, setChatIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)

  const simulatedConvos = [
    [
      { sender: 'user', text: "I have a sharp pain in my lower back." },
      { sender: 'bot', text: "A sharp lower back pain can be due to strain or posture. Is the pain radiating down your legs, or worse when bending?" },
      { sender: 'user', text: "No, it's mostly when sitting for long hours." },
      { sender: 'bot', text: "This suggests postural muscle strain. I recommend standing up every 30 mins, gentle stretches, or booking an appointment with Dr. Sharma." }
    ],
    [
      { sender: 'user', text: "What are the first-aid steps for a minor burn?" },
      { sender: 'bot', text: "1. Run cool water over it for 10-15 mins.\n2. Do NOT apply ice or butter.\n3. Cover with a clean bandage. Avoid popping any blisters." }
    ],
    [
      { sender: 'user', text: "I need to check for side effects of Paracetamol." },
      { sender: 'bot', text: "Paracetamol is generally safe. Side effects are rare, but overdose can damage the liver. Do not combine with other medicines containing acetaminophen." }
    ]
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setChatIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % simulatedConvos.length
          setChatMessages(simulatedConvos[nextIndex])
          return nextIndex
        })
      }, 1500)
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadUser = () => {
      try {
        const userData = localStorage.getItem('user')
        if (userData) {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
        } else {
          setUser(null)
        }
      } catch (error) {
        setUser(null)
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()

    const handleStorageChange = (e) => {
      if (e.key === 'user') loadUser()
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    const fetchTopDoctors = async () => {
      try {
        setLoadingDoctors(true)
        const response = await doctorsAPI.getAllDoctors()

        let doctors = []
        if (Array.isArray(response)) {
          doctors = response
        } else if (response && Array.isArray(response.results)) {
          doctors = response.results
        }

        const sortedDoctors = doctors
          .sort((a, b) => {
            const ratingA = parseFloat(a.average_rating || 0)
            const ratingB = parseFloat(b.average_rating || 0)
            return ratingB - ratingA
          })
          .slice(0, 6)

        setTopDoctors(sortedDoctors)
        setDoctorsError(null)
      } catch (error) {
        setDoctorsError(error.message)
      } finally {
        setLoadingDoctors(false)
      }
    }

    fetchTopDoctors()
  }, [])

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoadingProducts(true)
        const response = await pharmacyAPI.getAllMedicines()

        let products = []
        if (Array.isArray(response)) {
          products = response
        } else if (response && Array.isArray(response.results)) {
          products = response.results
        }

        const availableProducts = products
          .filter(p => p.stock_quantity > 0)
          .slice(0, 8)

        setFeaturedProducts(availableProducts)
        setProductsError(null)
      } catch (error) {
        setProductsError(error.message)
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchFeaturedProducts()
  }, [])

  // Search Products
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        setShowSearchDropdown(false)
        return
      }

      try {
        setSearchLoading(true)
        const response = await pharmacyAPI.searchMedicines(searchQuery)

        let results = []
        if (Array.isArray(response)) {
          results = response
        } else if (response && Array.isArray(response.results)) {
          results = response.results
        }

        setSearchResults(results.slice(0, 5))
        setShowSearchDropdown(true)
      } catch (error) {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const doctorLoginStatus = user?.user_type === 'doctor' ? 'true' : 'false'
  const patientLoginStatus = user?.user_type === 'patient' ? 'true' : 'false'
  const pharmacistLoginStatus = user?.user_type === 'pharmacist' ? 'true' : 'false'

  const isAnyUserLoggedIn = doctorLoginStatus === 'true' || patientLoginStatus === 'true' || pharmacistLoginStatus === 'true'
  const isDoctorLoggedIn = doctorLoginStatus === 'true'
  const isPatientLoggedIn = patientLoginStatus === 'true'

  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [showPharmacistDropdown, setShowPharmacistDropdown] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    navigate('/')
  }

  const sectionRefs = {
    aiChatbot: useRef(null),
    stats: useRef(null),
  }

  useEffect(() => {
    const observers = {}

    Object.keys(sectionRefs).forEach((key) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible((prev) => ({ ...prev, [key]: true }))
            }
          })
        },
        { threshold: 0.1 }
      )

      if (sectionRefs[key].current) {
        observer.observe(sectionRefs[key].current)
        observers[key] = observer
      }
    })

    return () => {
      Object.keys(observers).forEach((key) => {
        if (observers[key]) observers[key].disconnect()
      })
    }
  }, [])


  const allFeatures = [
    {
      icon: <FaRobot size={32} />,
      title: "AI Medical Assistant",
      description: "Get instant medical advice from our intelligent AI chatbot available 24/7",
      path: "/chat",
      hideForDoctor: false,
      hideForPatient: false,
    },
    {
      icon: <FaCalendarCheck size={32} />,
      title: "Appointment Booking",
      description: "Schedule appointments with doctors at your preferred time",
      path: "/appointments",
      hideForDoctor: true,
      hideForPatient: false,
    },
    {
      icon: <FaVideo size={32} />,
      title: "Video Consultation",
      description: "Connect face-to-face with certified doctors through secure video calls",
      path: "/teleconsult",
      hideForDoctor: false,
      hideForPatient: false,
    },
    {
      icon: <FaPrescriptionBottle size={32} />,
      title: "Digital Prescriptions",
      description: "Write and manage patient prescriptions digitally with full records",
      path: "/prescriptions",
      doctorOnly: true,
      hideForDoctor: false,
      hideForPatient: true,
    },
    {
      icon: <FaFileMedical size={32} />,
      title: "My Prescriptions",
      description: "View all your prescriptions securely — only visible to you",
      path: "/patient/prescriptions",
      patientOnly: true,      //  visible ONLY for patients
      hideForDoctor: true,    //  hidden from doctors
      hideForPatient: false,
    },
    {
      icon: <FaChartLine size={32} />,
      title: "Health Tracking",
      description: "Monitor your vital signs and track health metrics over time",
      path: "/health-tracking",
      hideForDoctor: true,
      hideForPatient: false,
    },
    {
      icon: <FaChartLine size={32} />,
      title: "Patient Health Tracking",
      description: "Monitor patient's vital signs and track health metrics over time",
      path: "/doctor-patient-health",
      hideForDoctor: false,
      hideForPatient: true,
    },
    {
      icon: <FaPills size={32} />,
      title: "Medicine Reminders",
      description: "Never miss your medication with smart reminders",
      path: "/medicines",
      hideForDoctor: true,
      hideForPatient: false,
    },
  ]


  const features = (() => {
    if (isDoctorLoggedIn) {
      return allFeatures.filter(f => !f.hideForDoctor && !f.patientOnly)
    }
    if (isPatientLoggedIn) {
      return allFeatures.filter(f => !f.hideForPatient && !f.doctorOnly)
    }
    return allFeatures.filter(f => !f.doctorOnly && !f.patientOnly && !f.hideForDoctor && !f.hideForPatient)
  })()

  const stats = [
    { icon: <FaUserMd size={24} />, number: "50+", label: "Expert Doctors" },
    { icon: <FaUsers size={24} />, number: "5000+", label: "Happy Patients" },
    { icon: <FaClock size={24} />, number: "24/7", label: "Available Support" },
    { icon: <FaAward size={24} />, number: "100%", label: "Satisfaction Rate" },
  ]

  const chatbotFeatures = [
    {
      icon: <FaCheckCircle size={24} />,
      title: "Instant Medical Support",
      description: "Get immediate responses to your health queries anytime, anywhere"
    },
    {
      icon: <FaLaptopMedical size={24} />,
      title: "AI-Powered Diagnosis",
      description: "Receive preliminary diagnoses based on advanced AI algorithms"
    },
    {
      icon: <FaShieldAlt size={24} />,
      title: "Secure & Private",
      description: "Your health data is encrypted and completely confidential"
    }
  ]

  const healthConditions = [
    { name: "Diabetes Care", icon: <FaThermometerHalf />, query: "Diabetes", color: "#e8f5e9" },
    { name: "Cardiac Care", icon: <FaHeartbeat />, query: "Heart", color: "#e3f2fd" },
    { name: "Stomach Care", icon: <FaFirstAid />, query: "Stomach", color: "#fff3e0" },
    { name: "Pain Relief", icon: <FaPills />, query: "Pain", color: "#fce4ec" },
    { name: "Liver Care", icon: <FaFileMedical />, query: "Liver", color: "#efebe9" }
  ]

  const productCategories = [
    { icon: <FaPills />, name: "Medicines", color: "#22c55e", id: "medicines" },
    { icon: <FaStethoscope />, name: "Medical Devices", color: "#3b82f6", id: "medical-devices" },
    { icon: <FaFirstAid />, name: "First Aid", color: "#ef4444", id: "first-aid" },
    { icon: <FaThermometerHalf />, name: "Health Care", color: "#f59e0b", id: "health-care" },
  ]

  const renderStars = (rating) => {
    const numericRating = parseFloat(rating || 0)
    const stars = []
    const fullStars = Math.floor(numericRating)
    const hasHalfStar = numericRating % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<FaStar key={i} className="star-filled" />)
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<FaStar key={i} className="star-half" />)
      } else {
        stars.push(<FaStar key={i} className="star-empty" />)
      }
    }
    return stars
  }

  const handleDoctorClick = (doctor) => {
    navigate(`/doctor-detail/${doctor.id}`)
  }

  const handleProductClick = (product) => {
    navigate(`/pharmacy/product/${product.id}`)
  }

  const calculateDiscount = (mrp, price) => {
    if (!mrp || !price) return 0
    const discount = ((parseFloat(mrp) - parseFloat(price)) / parseFloat(mrp)) * 100
    return Math.round(discount)
  }

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-semibold text-sm">Loading...</p>
      </div>
    )
  }

  // Smart Health calculations
  const heightInMeters = height / 100
  const bmiScore = (weight / (heightInMeters * heightInMeters)).toFixed(1)
  
  let bmiCategory = ''
  let bmiColor = ''
  let bmiRecommendations = ''
  
  if (bmiScore < 18.5) {
    bmiCategory = 'Underweight'
    bmiColor = 'text-blue-650 bg-blue-50 border-blue-200'
    bmiRecommendations = 'Focus on nutrient-rich foods, healthy fats, and strength training to build lean muscle mass.'
  } else if (bmiScore >= 18.5 && bmiScore < 25) {
    bmiCategory = 'Normal Weight'
    bmiColor = 'text-green-605 bg-green-50 border-green-200'
    bmiRecommendations = 'Fantastic job! Keep up a balanced diet and aim for at least 150 minutes of moderate exercise weekly.'
  } else if (bmiScore >= 25 && bmiScore < 30) {
    bmiCategory = 'Overweight'
    bmiColor = 'text-orange-600 bg-orange-50 border-orange-200'
    bmiRecommendations = 'Incorporate daily cardio, reduce refined carbohydrates, and monitor portions to support weight balance.'
  } else {
    bmiCategory = 'Obese'
    bmiColor = 'text-red-605 bg-red-50 border-red-200'
    bmiRecommendations = 'Consult a professional dietician or doctor for a tailored dietary and active living plan.'
  }

  const baseTarget = userWeight * 35
  const activityBonus = activityLevel === 'sedentary' ? 0 : activityLevel === 'moderate' ? 350 : 700
  const waterTarget = baseTarget + activityBonus
  const waterProgress = Math.min((waterLogged / waterTarget) * 100, 100)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white pt-[72px] md:pt-[120px]">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-green-500/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-green-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(22,163,74,0.02)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(22,163,74,0.02)_1.5px,transparent_1.5px)] bg-[size:40px_40px] pointer-events-none -z-10"></div>

      <header className="fixed top-0 left-0 w-full z-50 shadow-sm bg-white">
        <div className="hidden md:block py-2 bg-gradient-to-r from-green-800 to-green-700 text-white text-xs font-semibold">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><FaPhone size={14} /> Emergency Helpdesk: 108 / 102</span>
              <span className="flex items-center gap-2"><FaClock size={14} /> 24x7 Available Support</span>
            </div>
            <div>
              <span className="flex items-center gap-2"><FaMapMarkerAlt size={14} /> Serving Rural India</span>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md border-b border-gray-100 py-2.5 md:py-4">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <nav className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-6">

              {/* Logo & Mobile Actions wrapper */}
              <div className="flex items-center justify-between w-full md:w-auto">
                <div className="flex items-center gap-1.5 sm:gap-3 cursor-pointer select-none" onClick={() => navigate("/")}>
                  <div className="bg-green-600 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center flex-shrink-0">
                    <FaHeartbeat className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] min-[375px]:text-xs sm:text-lg md:text-xl font-bold tracking-tight text-gray-800 notranslate whitespace-nowrap" translate="no">Rural HealthCare</span>
                </div>

                {/* Mobile & Tablet Actions (hidden on desktop) */}
                <div className="flex md:hidden items-center gap-2 sm:gap-3 justify-end">
                  {/* Mobile Search Icon */}
                  <div
                    className="p-2 hover:bg-gray-100 rounded-full cursor-pointer flex items-center justify-center text-gray-650 hover:text-green-600 transition-all duration-200"
                    onClick={() => {
                      setIsMobileSearchOpen(true)
                      setTimeout(() => mobileSearchInputRef.current?.focus(), 100)
                    }}
                    title="Search"
                  >
                    <FaSearch size={18} />
                  </div>

                  {/* Profile Dropdown */}
                  <div
                    className="relative"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowUserDropdown((prev) => !prev)
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    {user ? (
                      <div className="flex items-center gap-1 cursor-pointer p-0.5 rounded-full hover:bg-gray-100 transition-all duration-200">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs rounded-full shadow-sm notranslate overflow-hidden flex-shrink-0 select-none" translate="no">
                          <span className="notranslate whitespace-nowrap block" translate="no">
                            {(user.first_name
                              ? user.first_name.slice(0, 2).toUpperCase()
                              : user.username
                              ? user.username.slice(0, 2).toUpperCase()
                              : 'US'
                            ).split('').join('\u200B')}
                          </span>
                        </div>
                        <FaChevronDown size={7} className="text-gray-500" />
                      </div>
                    ) : (
                      <button className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-all duration-200 text-xs shadow-sm shadow-green-600/10">
                        <FaUserMd size={14} /> <FaChevronDown size={7} />
                      </button>
                    )}

                    {showUserDropdown && (
                      <ul className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-1.5 z-50 divide-y divide-gray-100 animate-dropdown-fade" onClick={(e) => e.stopPropagation()}>
                        {patientLoginStatus === 'true' && (
                          <div className="py-1">
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Patient Panel</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/patient-dashboard'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Dashboard
                              </div>
                            </li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center gap-1.5"
                                onClick={() => { setShowUserDropdown(false); navigate('/patient/prescriptions'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                <FaFileMedical size={10} /> My Prescriptions
                              </div>
                            </li>
                          </div>
                        )}
                        {doctorLoginStatus === 'true' && (
                          <div className="py-1">
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Doctor Panel</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/doctor-dashboard'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Dashboard
                              </div>
                            </li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center gap-1.5"
                                onClick={() => { setShowUserDropdown(false); navigate('/prescriptions'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                <FaPrescriptionBottle size={10} /> Prescriptions
                              </div>
                            </li>
                          </div>
                        )}
                        {pharmacistLoginStatus === 'true' && (
                          <div className="py-1">
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Pharmacist Panel</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/pharmacist-dashboard'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Dashboard
                              </div>
                            </li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/pharmacy-home'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Manage Pharmacy
                              </div>
                            </li>
                          </div>
                        )}
                        {!isAnyUserLoggedIn && (
                          <div className="py-1">
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Patient Portal</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/auth?type=patient&view=login'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Login as Patient
                              </div>
                            </li>
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-1">Doctor Portal</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/auth?type=doctor&view=login'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Login as Doctor
                              </div>
                            </li>
                            <li className="px-3.5 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-1">Pharmacist Portal</li>
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-green-650 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); navigate('/auth?type=pharmacist&view=login'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Login as Pharmacist
                              </div>
                            </li>
                          </div>
                        )}
                        {isAnyUserLoggedIn && (
                          <div className="py-1">
                            <li>
                              <div
                                className="px-3.5 py-2 text-xs font-bold text-red-650 hover:text-red-700 hover:bg-red-50 transition-colors duration-150 flex items-center"
                                onClick={() => { setShowUserDropdown(false); handleLogout(); }}
                                style={{ cursor: 'pointer' }}
                              >
                                Logout
                              </div>
                            </li>
                          </div>
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Mobile Menu Icon (Hamburger) for other actions */}
                  <div className="relative">
                    <div
                      className="p-2 hover:bg-gray-100 rounded-full cursor-pointer flex items-center justify-center text-gray-650 hover:text-green-600 transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsMobileMenuOpen((prev) => !prev)
                        setShowUserDropdown(false)
                      }}
                      title="Menu"
                    >
                      <FaBars size={18} />
                    </div>

                    {isMobileMenuOpen && (
                      <ul className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-1.5 z-50 divide-y divide-gray-100 animate-dropdown-fade" onClick={(e) => e.stopPropagation()}>
                        <div className="py-1">
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center justify-between"
                              onClick={() => {
                                setIsMobileMenuOpen(false)
                                navigate('/cart')
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="flex items-center gap-2">
                                <FaShoppingCart size={14} className="text-gray-500" /> My Cart
                              </span>
                              {cartCount > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] min-h-[16px] leading-none">
                                  {cartCount}
                                </span>
                              )}
                            </div>
                          </li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center gap-2"
                              onClick={() => {
                                setIsMobileMenuOpen(false)
                                navigate('/orders')
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <FaBox size={14} className="text-gray-500" /> My Orders
                            </div>
                          </li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center justify-between"
                              onClick={() => {
                                setIsMobileMenuOpen(false)
                                setShowAddressModal(true)
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <span className="flex items-center gap-2">
                                <FaMapMarkerAlt size={14} className="text-gray-500" /> Location
                              </span>
                              <span className="text-[10px] font-semibold text-green-750 truncate max-w-[80px] flex items-center gap-0.5">
                                {deliveryAddress} <FaChevronDown size={6} className="text-green-600" />
                              </span>
                            </div>
                          </li>
                        </div>
                        <div className="py-2 px-4 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language</span>
                          <LanguageSelector />
                        </div>
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Delivery Location Selector (hidden on mobile/tablet) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-green-100 bg-green-50/50 hover:bg-green-50 cursor-pointer transition-all duration-200" onClick={() => setShowAddressModal(true)}>
                <FaMapMarkerAlt className="text-green-600" size={16} />
                <span className="text-xs font-semibold text-green-950 truncate max-w-[200px] flex items-center gap-1">
                  {deliveryAddress} <FaChevronDown size={8} className="flex-shrink-0" />
                </span>
              </div>

              {/* Desktop Search Bar (hidden on mobile/tablet) */}
              <div className="hidden md:block relative flex-1 max-w-md my-0">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 hover:border-green-300 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all duration-200">
                  <FaSearch className="text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search medicines, devices (Press '/' to focus)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                    className="w-full bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 focus:ring-0 p-0"
                  />
                  {!searchQuery && (
                    <div className="hidden sm:inline-flex items-center justify-center bg-gray-200/70 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-300/40">
                      <span>/</span>
                    </div>
                  )}
                  {searchQuery && (
                    <button
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      onClick={() => {
                        setSearchQuery('')
                        setShowSearchDropdown(false)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {showSearchDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-gray-100 animate-dropdown-fade">
                    {searchLoading ? (
                      <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2 text-xs font-semibold">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-4 p-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                            onClick={() => {
                              handleProductClick(product)
                              setShowSearchDropdown(false)
                            }}
                          >
                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 overflow-hidden flex-shrink-0">
                              {getMedicineImage(product) ? (
                                <img src={getMedicineImage(product)} alt={product.name} className="w-full h-full object-contain" />
                              ) : (
                                <FaBox />
                              )}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="text-xs font-bold text-gray-800 truncate">{product.name}</div>
                              <div className="text-xs font-extrabold text-gray-900 mt-0.5 flex items-center gap-1.5">
                                ₹{product.price}
                                {product.mrp && product.mrp > product.price && (
                                  <>
                                    <span className="text-[10px] text-gray-400 line-through font-normal">₹{product.mrp}</span>
                                    <span className="text-[10px] text-red-500 font-bold">
                                      {calculateDiscount(product.mrp, product.price)}% OFF
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="p-3.5 text-center text-xs font-bold text-green-600 hover:text-green-700 bg-green-50/30 hover:bg-green-50/50 cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5" onClick={() => navigate(`/pharmacy/search?q=${searchQuery}`)}>
                          View all results for "{searchQuery}" <FaArrowRight size={12} />
                        </div>
                      </>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                        <FaBox size={32} />
                        <p className="text-xs font-semibold">No products found</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Desktop Actions (hidden on mobile/tablet) */}
              <div className="hidden md:flex items-center gap-3 sm:gap-4 md:gap-5 justify-end">
                {/* Cart Trigger with Badge Count */}
                <div className="p-2 hover:bg-green-50 rounded-full cursor-pointer flex items-center justify-center text-gray-700 hover:text-green-600 transition-all duration-200" onClick={() => navigate('/cart')} title="View Cart">
                  <div className="relative flex items-center justify-center">
                    <FaShoppingCart size={22} />
                    {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[18px] min-h-[18px] leading-none shadow-sm">{cartCount}</span>}
                  </div>
                </div>

                <a href="/orders" title="My Orders" className="p-2 hover:bg-gray-100 rounded-full cursor-pointer flex items-center justify-center text-gray-600 hover:text-green-600 transition-all duration-200">
                  <FaBox size={20} />
                </a>

                {/* Language Selector — next to profile */}
                <div className="flex items-center justify-center">
                  <LanguageSelector />
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setShowUserDropdown(true)}
                  onMouseLeave={() => setShowUserDropdown(false)}
                  onClick={() => setShowUserDropdown(prev => !prev)}
                >
                  {user ? (
                    <div className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-all duration-200" style={{ cursor: 'pointer' }}>
                      <div className="w-9 h-9 bg-green-600 text-white flex items-center justify-center font-bold text-xs rounded-full shadow-sm notranslate overflow-hidden flex-shrink-0 select-none" translate="no">
                        <span className="notranslate whitespace-nowrap block" translate="no">
                          {(user.first_name
                            ? user.first_name.slice(0, 2).toUpperCase()
                            : user.username
                            ? user.username.slice(0, 2).toUpperCase()
                            : 'US'
                          ).split('').join('\u200B')}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 hidden lg:flex items-center gap-1 notranslate" translate="no">
                        {user.first_name
                          ? `${user.first_name} ${user.last_name || ''}`.trim()
                          : user.username || 'User'}
                        <FaChevronDown size={8} />
                      </span>
                    </div>
                  ) : (
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-all duration-200 text-sm shadow-sm shadow-green-600/10">
                      <FaUserMd size={16} /> <span className="hidden sm:inline-block">Account</span> <FaChevronDown size={8} />
                    </button>
                  )}

                  {showUserDropdown && (
                    <ul className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 divide-y divide-gray-100 animate-dropdown-fade" onClick={(e) => e.stopPropagation()}>
                      {patientLoginStatus === 'true' && (
                        <div className="py-1">
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Patient Panel</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/patient-dashboard'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Dashboard
                            </div>
                          </li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center gap-2"
                              onClick={() => { setShowUserDropdown(false); navigate('/patient/prescriptions'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              <FaFileMedical size={12} /> My Prescriptions
                            </div>
                          </li>
                        </div>
                      )}
                      {doctorLoginStatus === 'true' && (
                        <div className="py-1">
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Doctor Panel</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/doctor-dashboard'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Dashboard
                            </div>
                          </li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center gap-2"
                              onClick={() => { setShowUserDropdown(false); navigate('/prescriptions'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              <FaPrescriptionBottle size={12} /> Prescriptions
                            </div>
                          </li>
                        </div>
                      )}
                      {pharmacistLoginStatus === 'true' && (
                        <div className="py-1">
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pharmacist Panel</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/pharmacist-dashboard'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Dashboard
                            </div>
                          </li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/pharmacy-home'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Manage Pharmacy
                            </div>
                          </li>
                        </div>
                      )}
                      {!isAnyUserLoggedIn && (
                        <div className="py-1">
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Patient Portal</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/auth?type=patient&view=login'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Login as Patient
                            </div>
                          </li>
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block mt-1">Doctor Portal</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/auth?type=doctor&view=login'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Login as Doctor
                            </div>
                          </li>
                          <li className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider block mt-1">Pharmacist Portal</li>
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-green-600 hover:bg-green-50/50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); navigate('/auth?type=pharmacist&view=login'); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Login as Pharmacist
                            </div>
                          </li>
                        </div>
                      )}
                      {isAnyUserLoggedIn && (
                        <div className="py-1">
                          <li>
                            <div
                              className="px-4 py-2.5 text-xs font-bold text-red-650 hover:text-red-700 hover:bg-red-50 transition-colors duration-150 flex items-center"
                              onClick={() => { setShowUserDropdown(false); handleLogout(); }}
                              style={{ cursor: 'pointer' }}
                            >
                              Logout
                            </div>
                          </li>
                        </div>
                      )}
                    </ul>
                  )}
                </div>
              </div>

            </nav>

            {/* Custom Mobile Search Overlay (slides in/out or absolute covers navbar) */}
            {isMobileSearchOpen && (
              <div className="absolute inset-0 bg-white z-50 flex items-center px-4 py-2 animate-dropdown-fade md:hidden">
                <button
                  className="p-2 hover:bg-gray-100 rounded-full cursor-pointer text-gray-650 transition-colors duration-200 mr-2"
                  onClick={() => {
                    setIsMobileSearchOpen(false)
                    setSearchQuery('')
                  }}
                  title="Close Search"
                >
                  <FaArrowLeft size={18} />
                </button>

                <div className="relative flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all duration-200">
                  <FaSearch className="text-gray-400" />
                  <input
                    ref={mobileSearchInputRef}
                    type="text"
                    placeholder="Search medicines, devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                    className="w-full bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 focus:ring-0 p-0"
                  />
                  {searchQuery && (
                    <button
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      onClick={() => {
                        setSearchQuery('')
                        setShowSearchDropdown(false)
                      }}
                    >
                      ×
                    </button>
                  )}

                  {showSearchDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto divide-y divide-gray-100 animate-dropdown-fade">
                      {searchLoading ? (
                        <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2 text-xs font-semibold">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <>
                          {searchResults.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center gap-4 p-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                              onClick={() => {
                                handleProductClick(product)
                                setShowSearchDropdown(false)
                                setIsMobileSearchOpen(false)
                              }}
                            >
                              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 overflow-hidden flex-shrink-0">
                                {getMedicineImage(product) ? (
                                  <img src={getMedicineImage(product)} alt={product.name} className="w-full h-full object-contain" />
                                ) : (
                                  <FaBox />
                                )}
                              </div>
                              <div className="flex-grow min-w-0">
                                <div className="text-xs font-bold text-gray-800 truncate">{product.name}</div>
                                <div className="text-xs font-extrabold text-gray-900 mt-0.5 flex items-center gap-1.5">
                                  ₹{product.price}
                                  {product.mrp && product.mrp > product.price && (
                                    <>
                                      <span className="text-[10px] text-gray-400 line-through font-normal">₹{product.mrp}</span>
                                      <span className="text-[10px] text-red-500 font-bold">
                                        {calculateDiscount(product.mrp, product.price)}% OFF
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="p-3.5 text-center text-xs font-bold text-green-600 hover:text-green-700 bg-green-50/30 hover:bg-green-50/50 cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5" onClick={() => {
                            navigate(`/pharmacy/search?q=${searchQuery}`)
                            setIsMobileSearchOpen(false)
                          }}>
                            View all results for "{searchQuery}" <FaArrowRight size={12} />
                          </div>
                        </>
                      ) : searchQuery.length >= 2 ? (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                          <FaBox size={32} />
                          <p className="text-xs font-semibold">No products found</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Primary Navigation strip */}
      <div className="rural-primary-nav-strip bg-gray-50 border-b border-gray-100 overflow-x-auto whitespace-nowrap scrollbar-none py-1 md:py-2">
        <div className="rural-wrapper max-w-7xl mx-auto px-4 md:px-8">
          <ul className="primary-nav-links flex items-center gap-4 md:gap-6 text-xs md:text-sm font-semibold text-gray-600">
            <li className="active text-green-600 py-1.5 md:py-2"><a href="#pharmacy-products" className="no-underline" style={{ textDecoration: 'none' }}>Buy Medicines</a></li>
            <li className="hover:text-green-600 py-1.5 md:py-2 transition-colors duration-150"><a href="#top-doctors" className="no-underline" style={{ textDecoration: 'none' }}>Find Doctors</a></li>
            <li className="hover:text-green-600 py-1.5 md:py-2 transition-colors duration-150"><a href="#lab-tests" className="no-underline" style={{ textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); showToast("🧪 Lab Test Booking coming soon to your rural sector!", "success"); }}>Lab Tests <span className="nav-new-badge bg-green-100 text-green-800 text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-bold">New</span></a></li>
            <li className="hover:text-green-600 py-1.5 md:py-2 transition-colors duration-150"><a href="#wellness-membership" className="no-underline" style={{ textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); showToast("💚 Circle Wellness Membership activated in test mode!", "success"); }}>Circle Membership</a></li>
            <li className="hover:text-green-600 py-1.5 md:py-2 transition-colors duration-150"><a href="/patient/prescriptions" className="no-underline" style={{ textDecoration: 'none' }}>Health Records</a></li>
            <li className="hover:text-green-600 py-1.5 md:py-2 transition-colors duration-150"><a href="#ai-chatbot" className="no-underline" style={{ textDecoration: 'none' }}>AI Diagnostics</a></li>
          </ul>
        </div>
      </div>


      <section className="rural-banner bg-gradient-to-b from-green-50/10 via-white to-white py-12 md:py-16 lg:py-24 overflow-hidden relative">
        {/* Background Decorative Blobs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-green-200/10 rounded-full blur-3xl pointer-events-none z-0 animate-blob-float-left" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-100/20 rounded-full blur-3xl pointer-events-none z-0 animate-blob-float-right" />

        <div className="rural-wrapper max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="rural-banner-grid grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-16">
            
            {/* Right Side (Image Slides Container): Positioned first on mobile, second on desktop */}
            <div className="rural-banner-visual-wrapper relative order-1 lg:order-2 flex items-center justify-center min-h-[260px] sm:min-h-[340px] lg:min-h-[440px] w-full">
              
              {/* Premium Clean Rounded Image Container with Soft Shadow */}
              <div className="relative z-10 w-full max-w-[480px] aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-gray-100 bg-white hover:scale-[1.01] transition-transform duration-500">
                
                {/* Images Slides Container */}
                <div 
                  className="w-full h-full cursor-pointer" 
                  onClick={() => {
                    const action = HERO_SLIDES[currentSlide].action;
                    if (action.startsWith('#')) {
                      const el = document.getElementById(action.slice(1));
                      el?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      navigate(action);
                    }
                  }}
                >
                  {HERO_SLIDES.map((slide, index) => (
                    <img 
                      key={index}
                      src={slide.image} 
                      alt={slide.alt} 
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                        index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                      }`}
                      loading="eager"
                    />
                  ))}
                </div>

                {/* Floating Top Badge */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-gray-100 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 z-20">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider">
                    {HERO_SLIDES[currentSlide].badgeTop}
                  </span>
                </div>

                {/* Floating Bottom Badge */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md border border-gray-100 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 z-20">
                  <span className="text-[10px] font-extrabold text-green-700 uppercase tracking-wider">
                    ★ {HERO_SLIDES[currentSlide].badgeBottom}
                  </span>
                </div>

              </div>
            </div>

            {/* Left Side (Animating Text Column): Positioned second on mobile, first on desktop */}
            <div key={currentSlide} className="rural-banner-content order-2 lg:order-1 space-y-6 text-center lg:text-left animate-hero-text">
              <div className="banner-tag inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100 shadow-sm mx-auto lg:mx-0">
                <span className="pulse-dot-green w-2.5 h-2.5 bg-green-500 rounded-full"></span> {HERO_SLIDES[currentSlide].tag}
              </div>
              
              {/* Dynamic word-level highlight heading */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-950 tracking-tight leading-[1.08]">
                {HERO_SLIDES[currentSlide].titleParts.map((part, pIdx) => (
                  <span 
                    key={pIdx} 
                    className={`${part.highlight ? 'text-green-600' : 'text-gray-950'} ${part.block ? 'block mt-1' : ''}`}
                  >
                    {part.text}
                  </span>
                ))}
              </h1>

              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed min-h-[64px]">
                {HERO_SLIDES[currentSlide].subtitle}
              </p>
              <div className="rural-action-btns flex flex-col sm:flex-row gap-4 justify-center lg:justify-start max-w-md mx-auto lg:mx-0">
                <button 
                  className="rural-primary-btn shine-button flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 hover:-translate-y-0.5 transition-all duration-200 shadow-lg shadow-green-600/20 text-sm w-full sm:w-auto" 
                  onClick={() => {
                    const action = HERO_SLIDES[currentSlide].action;
                    if (action.startsWith('#')) {
                      const el = document.getElementById(action.slice(1));
                      el?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      navigate(action);
                    }
                  }}
                >
                  {HERO_SLIDES[currentSlide].buttonIcon === 'robot' && <FaRobot size={16} />}
                  {HERO_SLIDES[currentSlide].buttonIcon === 'calendar' && <FaCalendarAlt size={16} />}
                  {HERO_SLIDES[currentSlide].buttonIcon === 'pills' && <FaPills size={16} />}
                  {HERO_SLIDES[currentSlide].buttonText}
                </button>
              </div>
            </div>

          </div>

          {/* Continuous Tab separator lines & tab controller */}
          <div className="relative border-t border-gray-200/60 pt-4 mt-8">
            <div className="flex lg:grid lg:grid-cols-3 overflow-x-auto no-scrollbar scroll-smooth gap-4 md:gap-10">
              {HERO_SLIDES.map((slide, index) => (
                <div 
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className="flex-shrink-0 min-w-[170px] sm:min-w-[200px] lg:min-w-0 flex flex-col pt-3 pb-3 px-3 cursor-pointer select-none text-left flex-1 relative group"
                >
                  {/* Active Indicator progress bar sitting perfectly on the continuous line */}
                  {index === currentSlide && (
                    <div className="absolute -top-[18px] left-0 right-0 h-[3px] bg-green-600 animate-hero-progress z-10" />
                  )}
                  
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider transition-colors duration-200 ${
                    index === currentSlide ? 'text-green-700 font-extrabold' : 'text-gray-400 group-hover:text-gray-600'
                  }`}>
                    {slide.tabTitle}
                  </span>
                  <span className={`text-xs md:text-sm font-bold mt-1 transition-colors duration-200 ${
                    index === currentSlide ? 'text-gray-950 font-extrabold' : 'text-gray-700 group-hover:text-gray-950'
                  }`}>
                    {slide.tabLabel}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium mt-0.5 leading-snug hidden sm:block">
                    {slide.tabDesc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-gradient-to-r from-green-900 to-green-950 text-white" ref={sectionRefs.stats}>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center">
            {stats.map((stat, index) => {
              const StatBox = () => {
                const numericValue = parseFloat(stat.number.replace(/[^0-9.]/g, ''));
                const suffix = stat.number.includes('+') ? '+' : stat.number.includes('%') ? '%' : '';
                const [count, ref] = useCountAnimation(numericValue, 2000);

                return (
                  <div ref={ref} className="flex flex-col items-center gap-2">
                    <div className="text-3xl text-green-400 mb-2 opacity-90">{stat.icon}</div>
                    <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                      {stat.number === '24/7' ? '24/7' : `${count}${suffix}`}
                    </div>
                    <div className="text-xs font-bold text-green-200/70 uppercase tracking-widest">{stat.label}</div>
                  </div>
                );
              };
              return <StatBox key={index} />;
            })}
          </div>
        </div>
      </section>

      {/* Our Healthcare Services Section */}
      <section className="py-16 bg-gray-50/40 border-y border-gray-100" id="features">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Our Healthcare Services</h2>
            <p className="text-sm md:text-base text-gray-500 mt-2">
              Comprehensive medical solutions designed for rural communities with advanced technology and expert care
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center gap-4 hover:-translate-y-1.5 hover:border-green-300 hover:shadow-2xl hover:shadow-gray-200/80 group"
                onClick={() => navigate(feature.path)}
              >
                <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 border border-green-200/30 flex items-center justify-center text-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600">{feature.icon}</div>
                <h3 className="text-sm font-bold text-gray-800 group-hover:text-green-600 transition-colors duration-200">{feature.title}</h3>
                <p className="text-xs text-gray-400 font-semibold leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Four Quick Promo Cards Section */}
      <section className="py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-5 p-6 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden shadow-sm border border-green-100 bg-green-50/50 hover:bg-green-50 hover:-translate-y-1 hover:shadow-md group" onClick={() => {
              const el = document.getElementById('pharmacy-products');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-green-600 shadow-sm transition-transform duration-300 group-hover:scale-110">
                <FaTags size={24} />
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-bold text-green-900 leading-snug">Get 20%* off on Medicines</h3>
                <span className="text-[10px] font-extrabold tracking-wider text-green-700 uppercase opacity-90">UPLOAD PRESCRIPTION</span>
              </div>
              <FaArrowRight className="text-green-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={14} />
            </div>

            <div className="flex items-center gap-5 p-6 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden shadow-sm border border-purple-100 bg-purple-50/50 hover:bg-purple-50 hover:-translate-y-1 hover:shadow-md group" onClick={() => navigate('/chat')}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-purple-600 shadow-sm transition-transform duration-300 group-hover:scale-110">
                <FaRobot size={24} />
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-bold text-purple-900 leading-snug">Talk to AI Doctor</h3>
                <span className="text-[10px] font-extrabold tracking-wider text-purple-700 uppercase opacity-90">START CONSULTATION</span>
              </div>
              <FaArrowRight className="text-purple-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={14} />
            </div>

            <div className="flex items-center gap-5 p-6 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden shadow-sm border border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50 hover:-translate-y-1 hover:shadow-md group" onClick={() => navigate('/appointments')}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-yellow-600 shadow-sm transition-transform duration-300 group-hover:scale-110">
                <FaUserMd size={24} />
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-bold text-yellow-900 leading-snug">Doctor Appointment</h3>
                <span className="text-[10px] font-extrabold tracking-wider text-yellow-700 uppercase opacity-90">BOOK ONLINE NOW</span>
              </div>
              <FaArrowRight className="text-yellow-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={14} />
            </div>

            <div className="flex items-center gap-5 p-6 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden shadow-sm border border-red-100 bg-red-50/50 hover:bg-red-50 hover:-translate-y-1 hover:shadow-md group" onClick={() => {
              const el = document.querySelector('.rural-emergency-box');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-red-600 shadow-sm transition-transform duration-300 group-hover:scale-110">
                <FaAmbulance size={24} />
              </div>
              <div className="flex-grow">
                <h3 className="text-sm font-bold text-red-900 leading-snug">Emergency Dispatch</h3>
                <span className="text-[10px] font-extrabold tracking-wider text-red-700 uppercase opacity-90">DIAL 108 / 102 IMMEDIATELY</span>
              </div>
              <FaArrowRight className="text-red-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={14} />
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Health Conditions Section */}
      <section className="py-12 bg-gray-50/50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-xl md:text-2xl font-extrabold text-gray-950 tracking-tight">Browse by Health Conditions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {healthConditions.map((condition, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center gap-3 hover:-translate-y-1.5 hover:border-green-600 hover:shadow-lg hover:shadow-green-600/5 group"
                onClick={() => {
                  setSearchQuery(condition.query)
                  const el = document.getElementById('pharmacy-products')
                  el?.scrollIntoView({ behavior: 'smooth' })
                  showToast(`🔍 Showing medicines for ${condition.name}`, 'success')
                }}
              >
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl text-green-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white"
                  style={{ backgroundColor: condition.color }}
                >
                  {condition.icon}
                </div>
                <span className="text-sm font-semibold text-gray-800 transition-colors duration-300 group-hover:text-green-600">{condition.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white" id="pharmacy-products">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Shop by Category</h2>
            <p className="text-sm md:text-base text-gray-500 mt-2">Quality healthcare products at your fingertips</p>
          </div>

          {/* Quick-filter Category Pills strip */}
          <div className="mb-10 overflow-x-auto whitespace-nowrap scrollbar-none py-1 border-y border-gray-100">
            <ul className="flex items-center justify-start lg:justify-center gap-2.5 text-xs font-semibold py-2">
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('')}>All Medicines</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Amoxicillin')}>Antibiotics</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Vitamins')}>Nutritional supplements</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Syrup')}>Cough & Cold</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Device')}>Health Devices</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Bandage')}>First Aid Kit</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Baby')}>Baby Care</button></li>
              <li><button className="px-4 py-2 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-full border border-gray-200 transition-all duration-150" onClick={() => setSearchQuery('Ayurveda')}>Ayurvedic Care</button></li>
            </ul>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 mb-16">
            {productCategories.map((cat, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center gap-3 hover:-translate-y-1 hover:border-green-600 hover:shadow-lg hover:shadow-green-600/5 group"
                onClick={() => navigate(`/pharmacy/browse?category=${cat.id}`)}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 text-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-green-50" style={{ color: cat.color }}>
                  {cat.icon}
                </div>
                <span className="text-sm font-semibold text-gray-800 transition-colors duration-300 group-hover:text-green-600">{cat.name}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 mb-8">
            <h3 className="text-lg md:text-xl font-bold text-gray-950 flex items-center gap-2"><FaFire className="text-red-500 animate-pulse" /> Featured Products</h3>
            <button
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-green-700 font-bold rounded-2xl border-2 border-green-600/20 hover:border-green-600 hover:bg-green-50 transition-all duration-200 text-xs shadow-sm shadow-green-950/5 self-start sm:self-auto"
              onClick={() => navigate('/pharmacy/browse')}
            >
              View All Products <FaArrowRight size={12} />
            </button>
          </div>

          {loadingProducts ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
              <p className="text-sm font-semibold">Loading products...</p>
            </div>
          ) : productsError ? (
            <div className="flex items-center justify-center py-16 text-red-650 font-semibold text-sm">
              <p>Error loading products: {productsError}</p>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <FaBox size={48} />
              <p className="text-sm font-semibold">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 4).map((product) => {
                const discount = calculateDiscount(product.mrp, product.price)
                return (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-3xl p-5 cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-green-300 hover:shadow-2xl hover:shadow-gray-200/80 flex flex-col justify-between group"
                    onClick={() => handleProductClick(product)}
                  >
                    {discount > 0 && (
                      <div className="absolute top-4 left-4 z-10 bg-red-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <FaPercentage size={8} /> {discount}% OFF
                      </div>
                    )}

                    <div className="w-full h-44 bg-gray-50/50 rounded-2xl flex items-center justify-center text-gray-400 overflow-hidden relative mb-4">
                      {getMedicineImage(product) ? (
                        <img
                          src={getMedicineImage(product)}
                          alt={product.name}
                          className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextElementSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-0 flex items-center justify-center text-3xl text-gray-300"
                        style={{ display: getMedicineImage(product) ? 'none' : 'flex' }}
                      >
                        <FaBox />
                      </div>
                    </div>

                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug group-hover:text-green-600 transition-colors duration-200">{product.name}</h4>
                        {product.generic_name && (
                          <p className="text-[11px] text-gray-400 font-semibold truncate mt-1">{product.generic_name}</p>
                        )}
                        {product.manufacturer && (
                          <p className="text-[10px] text-gray-405 flex items-center gap-1.5 mt-2">
                            <FaBox size={10} /> {product.manufacturer}
                          </p>
                        )}
                      </div>

                      <div className="flex items-end justify-between mt-5 pt-4 border-t border-gray-50">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 font-semibold leading-none">Price</span>
                          <span className="text-base font-extrabold text-gray-900 mt-1">
                            ₹{product.price}
                            {product.mrp && product.mrp > product.price && (
                              <span className="text-xs text-gray-400 line-through font-normal ml-1.5">₹{product.mrp}</span>
                            )}
                          </span>
                        </div>
                        <button
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-250 flex items-center gap-2 border ${
                            addingToCartId === product.id
                              ? 'bg-green-600 border-green-600 text-white shadow-sm'
                              : 'bg-white border-green-600/30 text-green-600 hover:bg-green-600 hover:text-white hover:border-green-600'
                          }`}
                          disabled={addingToCartId === product.id}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (addingToCartId) return
                            setAddingToCartId(product.id)
                            try {
                              let sessionId = localStorage.getItem('pharmacy_session_id')
                              if (!sessionId) {
                                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                                localStorage.setItem('pharmacy_session_id', sessionId)
                              }

                              const response = await fetch('http://localhost:8000/api/cart/add_item/', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(user ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } : {})
                                },
                                body: JSON.stringify({ medicine_id: product.id, quantity: 1, session_id: sessionId })
                              })

                              if (!response.ok) throw new Error('Failed to add to cart')

                              const localCart = JSON.parse(localStorage.getItem('pharmacy_cart') || '[]')
                              const existingIndex = localCart.findIndex(item => item.id === product.id)
                              if (existingIndex !== -1) {
                                localCart[existingIndex].quantity += 1
                              } else {
                                localCart.push({ ...product, quantity: 1 })
                              }
                              localStorage.setItem('pharmacy_cart', JSON.stringify(localCart))
                              showToast(`✅ ${product.name} added to cart!`, 'success')
                              window.dispatchEvent(new Event('cartUpdated'))
                            } catch (error) {
                              showToast('❌ Failed to add to cart. Please try again.', 'error')
                            } finally {
                              setTimeout(() => setAddingToCartId(null), 1200)
                            }
                          }}
                        >
                          {addingToCartId === product.id ? (
                            <>✓ Added</>
                          ) : (
                            <><FaShoppingCart /> Add</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-12 bg-gradient-to-r from-green-500 to-green-600 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 text-white shadow-xl shadow-green-600/10">
            <div className="flex items-center gap-4 text-center md:text-left flex-col sm:flex-row">
              <div className="bg-white/20 p-4 rounded-2xl flex items-center justify-center">
                <FaGift size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold">Special Offer!</h4>
                <p className="text-sm text-green-50">Get up to 25% OFF on your first medicine order</p>
              </div>
            </div>
            <button className="flex items-center gap-2 bg-white text-green-700 font-bold px-6 py-3 rounded-2xl shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm" onClick={() => navigate('/pharmacy/browse')}>
              <FaTags /> Shop Now
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50/50 border-y border-gray-100" id="top-doctors">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Our Top Rated Doctors</h2>
            <p className="text-sm md:text-base text-gray-500 mt-2">Meet our highly experienced medical professionals</p>
          </div>

          {loadingDoctors ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
              <p className="text-sm font-semibold">Loading doctors...</p>
            </div>
          ) : doctorsError ? (
            <div className="flex items-center justify-center py-16 text-red-650 font-semibold text-sm">
              <p>Error loading doctors: {doctorsError}</p>
            </div>
          ) : topDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <FaUserMd size={48} />
              <p className="text-sm font-semibold">No doctors available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {topDoctors.map((doctor, index) => (
                <div
                  key={doctor.id}
                  className="bg-white border border-gray-200 rounded-3xl p-5 text-center cursor-pointer transition-all duration-300 flex flex-col items-center gap-4 hover:-translate-y-1.5 hover:border-green-300 hover:shadow-xl hover:shadow-gray-200/80 group"
                  onClick={() => handleDoctorClick(doctor)}
                >
                  <div className="relative w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-green-500 to-green-600 shadow-md transition-transform duration-300 group-hover:scale-105">
                    {doctor.user?.profile_picture_url ? (
                      <img
                        src={doctor.user.profile_picture_url}
                        alt={`Dr. ${doctor.user.first_name} ${doctor.user.last_name}`}
                        className="w-full h-full rounded-full object-cover border-2 border-white"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div
                      className="absolute inset-0.5 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-3xl"
                      style={{ display: doctor.user?.profile_picture_url ? 'none' : 'flex' }}
                    >
                      <FaUserMd />
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-1 leading-snug group-hover:text-green-600 transition-colors duration-200">
                      Dr. {doctor.user?.first_name} {doctor.user?.last_name}
                    </h3>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <div className="flex text-amber-400 text-xs">{renderStars(doctor.average_rating)}</div>
                      <span className="text-xs font-bold text-gray-500">
                        {parseFloat(doctor.average_rating || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topDoctors.length > 0 && (
            <div className="flex justify-center mt-12">
              <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm" onClick={() => navigate("/doctors")}>
                View All Doctors <FaArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Smart Health Tools Section */}
      <section className="py-16 bg-white" id="health-tools">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight">Smart Health Tools</h2>
            <p className="text-sm md:text-base text-gray-500 mt-2">
              Track your vitals and estimate wellness targets with our interactive, easy-to-use health calculators
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-gray-50/50 border border-gray-150 rounded-3xl p-6 md:p-8 shadow-sm">
            {/* Tool Selector Tabs */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  activeTool === 'bmi'
                    ? 'bg-green-600 text-white shadow-md shadow-green-600/10'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTool('bmi')}
              >
                <FaWeight /> BMI Calculator
              </button>
              <button
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  activeTool === 'water'
                    ? 'bg-green-600 text-white shadow-md shadow-green-600/10'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTool('water')}
              >
                <FaTint /> Water Hydration Tracker
              </button>
            </div>

            {/* BMI Calculator Interface */}
            {activeTool === 'bmi' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                {/* Inputs Column */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><FaCalculator className="text-green-600" /> Enter Your Parameters</h3>
                    
                    {/* Weight Input & Slider */}
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-gray-500">Weight</span>
                        <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded">{weight} kg</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="180"
                        value={weight}
                        onChange={(e) => setWeight(parseInt(e.target.value))}
                        className="w-full accent-green-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                        <span>30 kg</span>
                        <span>180 kg</span>
                      </div>
                    </div>

                    {/* Height Input & Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-gray-500">Height</span>
                        <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded">{height} cm</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="220"
                        value={height}
                        onChange={(e) => setHeight(parseInt(e.target.value))}
                        className="w-full accent-green-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                        <span>100 cm</span>
                        <span>220 cm</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results Column */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 flex flex-col justify-between gap-6">
                  <div className="text-center">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Body Mass Index (BMI)</h4>
                    <div className="text-5xl font-black text-gray-950 mt-4 tracking-tight">{bmiScore}</div>
                    
                    {/* Category Badge */}
                    <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border mt-3 ${bmiColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {bmiCategory}
                    </div>
                  </div>

                  {/* BMI Progress bar visual representation */}
                  <div className="space-y-1">
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-400" style={{ width: '18.5%' }}></div>
                      <div className="h-full bg-green-500" style={{ width: '25%' }}></div>
                      <div className="h-full bg-orange-400" style={{ width: '15%' }}></div>
                      <div className="h-full bg-red-500" style={{ width: '41.5%' }}></div>
                    </div>
                    {/* Marker overlay */}
                    <div className="relative w-full h-4">
                      {(() => {
                        const scoreVal = parseFloat(bmiScore);
                        const percentage = Math.min(Math.max(((scoreVal - 15) / 25) * 100, 2), 98);
                        return (
                          <div 
                            className="absolute -top-1 w-2.5 h-2.5 bg-gray-950 border border-white rounded-full -translate-x-1/2 transition-all duration-300"
                            style={{ left: `${percentage}%` }}
                          ></div>
                        );
                      })()}
                      <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
                        <span>15 (Under)</span>
                        <span>18.5</span>
                        <span>25</span>
                        <span>30</span>
                        <span>40+ (Obese)</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Card */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <span className="text-[10px] font-extrabold tracking-widest text-green-700 uppercase block mb-1">Dietary & lifestyle tip</span>
                    <p className="text-xs text-gray-500 font-semibold leading-relaxed">{bmiRecommendations}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Water Tracker Interface */}
            {activeTool === 'water' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                {/* Inputs Column */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><FaRunning className="text-green-600" /> Adjust Body Parameters</h3>
                    
                    {/* Weight Input */}
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-gray-500">Weight</span>
                        <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded">{userWeight} kg</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="180"
                        value={userWeight}
                        onChange={(e) => setUserWeight(parseInt(e.target.value))}
                        className="w-full accent-green-600"
                      />
                    </div>

                    {/* Activity Level Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500">Daily Activity Level</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['sedentary', 'moderate', 'active'].map((level) => (
                          <button
                            key={level}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all capitalize ${
                              activityLevel === level
                                ? 'bg-green-50 border-green-300 text-green-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                            onClick={() => setActivityLevel(level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Water logging action buttons */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <button 
                      className="flex-grow flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-750 text-white font-bold py-3 rounded-2xl shadow-sm text-xs transition-colors"
                      onClick={() => setWaterLogged(prev => prev + 250)}
                    >
                      + 250ml Glass
                    </button>
                    <button 
                      className="flex-grow flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-2xl shadow-sm text-xs transition-colors"
                      onClick={() => setWaterLogged(prev => prev + 500)}
                    >
                      + 500ml Bottle
                    </button>
                    <button 
                      className="w-10 h-10 border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-2xl flex items-center justify-center transition-colors flex-shrink-0"
                      title="Reset Log"
                      onClick={() => setWaterLogged(0)}
                    >
                      ↺
                    </button>
                  </div>
                </div>

                {/* Results Visual Representation Column */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
                  <div className="text-center w-full">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hydration Progress</h4>
                    <div className="flex justify-center items-baseline gap-1 mt-2">
                      <span className="text-3xl font-black text-gray-950">{waterLogged}</span>
                      <span className="text-xs font-bold text-gray-400">/ {waterTarget} ml</span>
                    </div>
                  </div>

                  {/* visual Glass Cup that fills with blue water! */}
                  <div className="relative w-24 h-40 border-4 border-gray-300/80 rounded-b-2xl rounded-t-sm bg-gray-50/50 shadow-inner overflow-hidden flex items-end">
                    {/* blue water fill element */}
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-500 relative"
                      style={{ height: `${waterProgress}%` }}
                    >
                      {/* Animated wave effect on top of water */}
                      {waterProgress > 0 && waterProgress < 100 && (
                        <div className="absolute top-0 left-0 w-[200%] h-2 bg-blue-300/60 -translate-y-1 animate-pulse"></div>
                      )}
                    </div>
                    {/* glass reflection glare line */}
                    <div className="absolute top-0 right-1 w-2 h-full bg-white/10 rounded-full"></div>
                    {/* text overlay showing percentage */}
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-gray-800 drop-shadow-sm select-none">
                      {Math.round(waterProgress)}%
                    </div>
                  </div>

                  {/* Glasses Indicator */}
                  <div className="text-xs font-bold text-gray-500 text-center w-full">
                    {waterLogged >= waterTarget ? (
                      <span className="text-green-600 font-extrabold">🎉 Hydration target achieved for today!</span>
                    ) : (
                      <span>Need {Math.ceil((waterTarget - waterLogged) / 250)} more glasses to hit your goal.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-4.5 py-3 rounded-2xl shadow-xl transition-all duration-300 transform translate-y-0 scale-100 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {toast.type === 'success' ? '✓' : '✗'}
          </div>
          <div className="text-xs font-bold px-2">{toast.message}</div>
        </div>
      )}

      {showAddressModal && (
        <div className="loc-backdrop">
          <div className="loc-panel">

            {/* ── FULL MAP LAYER ── */}
            <div id="rural-modal-map" className="loc-map"></div>

            {/* ── GPS PULSE CENTER DOT ── */}
            {isLocating && (
              <div className="loc-gps-pulse">
                <div className="pulse-ring"></div>
                <div className="pulse-ring pulse-ring--delay"></div>
                <div className="pulse-dot"></div>
              </div>
            )}

            {/* ── TOP SEARCH FLOATING CARD ── */}
            <div className="loc-search-card">
              <div className="loc-search-header">
                <button className="loc-back-btn" onClick={() => setShowAddressModal(false)}>
                  ←
                </button>
                <div className="loc-search-input-wrap">
                  <FaSearch className="loc-search-icon" />
                  <input
                    type="text"
                    className="loc-search-input"
                    placeholder="Search area, street or PIN code..."
                    value={mapSearchQuery}
                    onChange={(e) => setMapSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleMapSearch() }}
                    autoFocus
                  />
                  {mapSearchQuery && (
                    <button className="loc-clear-btn" onClick={() => { setMapSearchQuery(''); setMapSearchResults([]) }}>×</button>
                  )}
                </div>
              </div>

              {/* Search Results Dropdown */}
              {mapSearchResults.length > 0 && (
                <div className="loc-results-list">
                  {mapSearchResults.map((res, i) => (
                    <div key={i} className="loc-result-item" onClick={() => selectMapSearchResult(res)}>
                      <div className="loc-result-icon">
                        <FaMapMarkerAlt size={13} />
                      </div>
                      <div className="loc-result-text">
                        <span className="loc-result-primary">{res.display_name.split(',')[0]}</span>
                        <span className="loc-result-secondary">{res.display_name.split(',').slice(1, 4).join(',').trim()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── GPS BUTTON FLOATING ── */}
            <button
              className={`loc-gps-btn ${isLocating ? 'locating' : ''}`}
              onClick={handleDetectLocation}
              disabled={isLocating}
              title="Use My Current Location"
            >
              {isLocating ? (
                <span className="loc-spinner"></span>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 2"/>
                </svg>
              )}
            </button>

            {/* ── BOTTOM CONFIRM CARD ── */}
            <div className="loc-confirm-card">
              <div className="loc-confirm-marker-row">
                <div className="loc-confirm-pin-icon">
                  <FaMapMarkerAlt size={18} />
                </div>
                <div className="loc-confirm-address-block">
                  <span className="loc-confirm-label">Deliver to</span>
                  <input
                    className="loc-confirm-address-input"
                    type="text"
                    value={tempAddress}
                    onChange={(e) => setTempAddress(e.target.value)}
                    placeholder="Tap map or use GPS to select location..."
                  />
                </div>
              </div>

              {/* Quick City Chips */}
              <div className="loc-quick-cities">
                <span className="loc-quick-label">Quick select:</span>
                <div className="loc-chip-row">
                  {['Thrissur - 678593', 'Kochi - 682020', 'Palakkad - 678001', 'Mankara - 678631'].map(city => (
                    <button
                      key={city}
                      className={`loc-chip ${tempAddress.includes(city.split(' - ')[1]) ? 'active' : ''}`}
                      onClick={() => {
                        setTempAddress(city)
                        const parts = city.split(' - ')
                        showToast(`📍 Location set to ${parts[0]}`, 'success')
                      }}
                    >
                      {city.split(' - ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="loc-confirm-btn"
                disabled={!tempAddress}
                onClick={() => {
                  localStorage.setItem('deliveryAddress', tempAddress)
                  setDeliveryAddress(tempAddress)
                  setShowAddressModal(false)
                  showToast(`📍 Delivery location saved!`, 'success')
                }}
              >
                <FaCheckCircle size={16} />
                Confirm This Location
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard