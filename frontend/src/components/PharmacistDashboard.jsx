import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  FaPills,
  FaBoxOpen,
  FaShoppingCart,
  FaTruck,
  FaChartLine,
  FaSignOutAlt,
  FaPhone,
  FaMapMarkerAlt,
  FaBell,
  FaChevronDown,
  FaPrescriptionBottle,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaClipboardList,
  FaSearch,
  FaPlus,
  FaEye,
  FaClock,
  FaWarehouse,
  FaMoon,
  FaSun,
  FaMedkit,
  FaUser
} from "react-icons/fa"
import { authAPI, pharmacyAPI } from "../services/api"
import LanguageSelector from './common/LanguageSelector'
import Footer from "./Footer"
import "./PharmacistDashboard.css"

const PharmacistDashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])


  // Dynamic stats from API
  const [stats, setStats] = useState({
    pendingOrders: 0,
    totalOrders: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    deliveriesInProgress: 0,
    totalMedicines: 0,
  })

  // Real data from API
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [analytics, setAnalytics] = useState(null)

  // ─── Auth Check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = () => {
      console.log("[PharmacistDashboard] Checking authentication...")
      const userData = authAPI.getCurrentUser()

      if (!userData) {
        console.log("[PharmacistDashboard] ❌ No user data - redirecting to login")
        setIsCheckingAuth(false)
        navigate("/auth?type=pharmacist&view=login")
        return
      }

      if (userData.user_type !== "pharmacist") {
        console.log("[PharmacistDashboard] ❌ Not a pharmacist:", userData.user_type)
        alert(
          `This is the pharmacist dashboard. You are logged in as ${userData.user_type}. Please logout and login as a pharmacist.`
        )
        setIsCheckingAuth(false)
        navigate("/")
        return
      }

      console.log("[PharmacistDashboard] ✅ Pharmacist authenticated:", userData.first_name, userData.last_name)
      setUser(userData)
      setIsCheckingAuth(false)
    }

    checkAuth()
  }, [navigate])

  // ─── Load Data when user is ready ──────────────────────────────────────────
  useEffect(() => {
    if (user && !isCheckingAuth) {
      loadDashboardData(user.id)
    }
  }, [user, isCheckingAuth])

  // ─── Auto-refresh every 30s ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || isCheckingAuth) return
    const interval = setInterval(() => {
      console.log("[PharmacistDashboard] Auto-refreshing...")
      loadDashboardData(user.id)
    }, 30000)
    return () => clearInterval(interval)
  }, [user, isCheckingAuth])

  // ─── Main Data Loader ───────────────────────────────────────────────────────
  const loadDashboardData = async (pharmacistId) => {
    try {
      setLoading(true)
      console.log("\n" + "=".repeat(60))
      console.log("LOADING PHARMACIST DASHBOARD DATA:", pharmacistId)
      console.log("=".repeat(60))

      // ── 1. Dashboard overview (inventory + revenue + order stats) ──────────
      console.log("\n📊 Fetching pharmacy dashboard...")
      let dashboardData = null
      try {
        const res = await pharmacyAPI.getDashboard(pharmacistId)
        if (res && res.dashboard) {
          dashboardData = res.dashboard
          console.log("✅ Dashboard data:", dashboardData)
        }
      } catch (err) {
        console.error("❌ Dashboard fetch error:", err)
      }

      // ── 2. Medicines / Inventory ───────────────────────────────────────────
      console.log("\n💊 Fetching inventory...")
      let medicines = []
      try {
        const res = await pharmacyAPI.getAllMedicines()
        medicines = Array.isArray(res) ? res : res?.results || []
        console.log("✅ Medicines count:", medicines.length)
      } catch (err) {
        console.error("❌ Inventory fetch error:", err)
      }

      // ── 3. Orders ─────────────────────────────────────────────────────────
      console.log("\n🛒 Fetching orders...")
      let allOrders = []
      try {
        const res = await pharmacyAPI.getAllOrders()
        allOrders = Array.isArray(res) ? res : res?.results || []
        console.log("✅ Orders count:", allOrders.length)
      } catch (err) {
        console.error("❌ Orders fetch error:", err)
      }

      // ── 4. Prescriptions ──────────────────────────────────────────────────
      console.log("\n📋 Fetching prescriptions...")
      let allPrescriptions = []
      try {
        const res = await pharmacyAPI.getPharmacistPrescriptions({ limit: 20 })
        allPrescriptions = Array.isArray(res)
          ? res
          : res?.prescriptions || res?.results || []
        console.log("✅ Prescriptions count:", allPrescriptions.length)
      } catch (err) {
        console.error("❌ Prescriptions fetch error:", err)
      }

      // ── 5. Analytics ──────────────────────────────────────────────────────
      console.log("\n📈 Fetching analytics...")
      let analyticsData = null
      try {
        const res = await pharmacyAPI.getAnalytics(30)
        if (res && res.analytics) analyticsData = res.analytics
        console.log("✅ Analytics loaded")
      } catch (err) {
        console.error("❌ Analytics fetch error:", err)
      }

      // ── 6. Compute Stats ──────────────────────────────────────────────────
      const lowStock = medicines.filter(
        (m) => m.stock_quantity > 0 && m.stock_quantity <= 50
      )
      const outOfStock = medicines.filter((m) => m.stock_quantity === 0)

      const pendingOrders = allOrders.filter((o) => o.order_status === "pending")
      const deliveryOrders = allOrders.filter((o) => o.order_status === "out_for_delivery")

      const today = new Date().toDateString()
      const todayOrders = allOrders.filter(
        (o) => new Date(o.created_at).toDateString() === today
      )
      const todayRevenue = todayOrders
        .filter((o) => o.payment_status === "completed")
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)

      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const monthlyRevenue = allOrders
        .filter(
          (o) =>
            o.payment_status === "completed" &&
            new Date(o.created_at) >= monthAgo
        )
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)

      setStats({
        pendingOrders: dashboardData?.orders?.pending_orders ?? pendingOrders.length,
        totalOrders: dashboardData?.orders?.total_orders ?? allOrders.length,
        lowStockItems: lowStock.length,
        outOfStockItems: dashboardData?.inventory?.out_of_stock_count ?? outOfStock.length,
        todayRevenue: dashboardData?.revenue?.today ?? todayRevenue,
        monthlyRevenue: dashboardData?.revenue?.month ?? monthlyRevenue,
        deliveriesInProgress: deliveryOrders.length,
        totalMedicines: dashboardData?.inventory?.total_medicines ?? medicines.length,
      })

      // Sort and slice for display
      setOrders(
        [...allOrders]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20)
      )
      setInventory(
        [...medicines].sort((a, b) => a.stock_quantity - b.stock_quantity)
      )
      setPrescriptions(
        [...allPrescriptions]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20)
      )
      setAnalytics(analyticsData)

      console.log("\n" + "=".repeat(60))
      console.log("PHARMACIST DASHBOARD LOADED SUCCESSFULLY")
      console.log("=".repeat(60) + "\n")
    } catch (error) {
      console.error("❌ ERROR LOADING PHARMACIST DASHBOARD:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authAPI.logout()
    navigate("/auth?type=pharmacist&view=login")
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    const map = {
      pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 border-amber-250",
      pending_verification: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 border-amber-250",
      confirmed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 border-emerald-250",
      verified: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 border-emerald-250",
      processing: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 border-blue-250",
      out_for_delivery: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 border-indigo-250",
      delivered: "bg-green-50 text-green-700 dark:bg-green-950/20 border-green-250",
      completed: "bg-green-50 text-green-700 dark:bg-green-950/20 border-green-250",
      cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 border-rose-250",
      low_stock: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 border-amber-250",
      out_of_stock: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 border-rose-250",
      in_stock: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 border-emerald-250",
    }
    return map[status] || "bg-slate-50 text-slate-700 dark:bg-slate-900 border-slate-200"
  }

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      pending_verification: "Pending Verification",
      verified: "Verified",
      low_stock: "Low Stock",
      out_of_stock: "Out of Stock",
      in_stock: "In Stock",
    }
    return labels[status] || status
  }

  const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN")}`

  const formatDateTime = (dateString) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStockStatus = (item) => {
    if (item.stock_quantity === 0) return "out_of_stock"
    if (item.stock_quantity <= 50) return "low_stock"
    return "in_stock"
  }

  // ─── Filtered views ────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.delivery_phone?.includes(q) ||
      o.delivery_address?.toLowerCase().includes(q)
    )
  })

  const filteredInventory = inventory.filter((m) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      m.name?.toLowerCase().includes(q) ||
      m.generic_name?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q)
    )
  })

  const filteredPrescriptions = prescriptions.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.prescription_number?.toLowerCase().includes(q) ||
      p.patient_name?.toLowerCase().includes(q) ||
      p.patient_phone?.includes(q)
    )
  })

  // ─── Order action handler ─────────────────────────────────────────────────
  const handleOrderAction = async (orderId, newStatus) => {
    try {
      console.log(`[PharmacistDashboard] Updating order ${orderId} → ${newStatus}`)
      await pharmacyAPI.updateOrderStatus(orderId, newStatus)
      console.log("✅ Order updated")
      await loadDashboardData(user.id)
      alert(`Order ${newStatus} successfully!`)
    } catch (error) {
      console.error("❌ Order update error:", error)
      alert(`Failed to update order: ${error.message}`)
    }
  }

  // ─── Quick Actions ─────────────────────────────────────────────────────────
  const quickActions = [
    {
      icon: <FaShoppingCart className="text-xl" />,
      title: "Process Orders",
      description: "View and process pending orders",
      onClick: () => setActiveTab("orders"),
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
      urgent: stats.pendingOrders > 0,
      badge: stats.pendingOrders || null,
    },
    {
      icon: <FaBoxOpen className="text-xl" />,
      title: "Inventory",
      description: "Manage stock and supplies",
      onClick: () => setActiveTab("inventory"),
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      urgent: stats.lowStockItems > 0 || stats.outOfStockItems > 0,
      badge: stats.lowStockItems + stats.outOfStockItems || null,
    },
    {
      icon: <FaPrescriptionBottle className="text-xl" />,
      title: "Prescriptions",
      description: "Verify and fill prescriptions",
      onClick: () => setActiveTab("prescriptions"),
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      icon: <FaTruck className="text-xl" />,
      title: "Deliveries",
      description: "Track ongoing deliveries",
      onClick: () => setActiveTab("orders"),
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      badge: stats.deliveriesInProgress || null,
    },
    {
      icon: <FaChartLine className="text-xl" />,
      title: "Analytics",
      description: "View revenue and reports",
      onClick: () => setActiveTab("analytics"),
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: <FaWarehouse className="text-xl" />,
      title: "Add Medicine",
      description: "Add new product to inventory",
      onClick: () => navigate("/pharmacy-home"),
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ]

  // ─── Loading / Auth Guard ──────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-550">Verifying authentication...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-550">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans bg-slate-50/50 text-slate-800 transition-colors duration-300">
      {/* Top Banner Info bar */}
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

      {/* Header */}
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
              onClick={() => setActiveTab("orders")}
              className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-green-600 transition-colors bg-transparent border-none cursor-pointer relative"
            >
              <span>Orders</span>
              {stats.pendingOrders > 0 && (
                <span className="absolute -top-3.5 -right-3 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black">
                  {stats.pendingOrders}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab("inventory")}
              className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-green-600 transition-colors bg-transparent border-none cursor-pointer relative"
            >
              <span>Inventory</span>
              {stats.lowStockItems + stats.outOfStockItems > 0 && (
                <span className="absolute -top-3.5 -right-3 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black">
                  {stats.lowStockItems + stats.outOfStockItems}
                </span>
              )}
            </button>

            <LanguageSelector />

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
                  <div className="p-2 space-y-0.5">
                    <button 
                      onClick={() => navigate('/pharmacist-profile')}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-650 dark:text-slate-350 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
                    >
                      <FaUser className="text-slate-400" /> My Profile
                    </button>
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

      {/* Main Wrapper */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md shadow-green-600/5 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Welcome back, {user.first_name}!</h2>
            <p className="text-sm font-medium text-green-50 max-w-xl">
              {stats.pendingOrders > 0
                ? `You have ${stats.pendingOrders} pending order${stats.pendingOrders !== 1 ? "s" : ""} waiting for processing. Let's get them prepared!`
                : "All patient orders are currently up to date. Excellent job keeping operations smooth!"}
            </p>
          </div>
          <div className="z-10 bg-white/10 p-5 rounded-2xl">
            <FaPills className="text-5xl text-white/90" />
          </div>
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          {[
            {
              title: "Pending Orders",
              value: stats.pendingOrders,
              icon: <FaShoppingCart className="text-amber-600" />,
              bg: "bg-amber-500/10",
              border: stats.pendingOrders > 0 ? "border-amber-500 bg-amber-50/30 dark:bg-amber-950/10" : "border-slate-100 dark:border-slate-800",
              badge: stats.pendingOrders > 0 ? "Process Now" : null,
              badgeBg: "bg-amber-500",
            },
            {
              title: "Stock Alerts",
              value: stats.lowStockItems + stats.outOfStockItems,
              icon: <FaExclamationTriangle className="text-rose-600" />,
              bg: "bg-rose-500/10",
              border: (stats.lowStockItems + stats.outOfStockItems) > 0 ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/10" : "border-slate-100 dark:border-slate-800",
              badge: (stats.lowStockItems + stats.outOfStockItems) > 0 ? "Restock Req." : null,
              badgeBg: "bg-rose-500",
            },
            {
              title: "Today's Revenue",
              value: formatCurrency(stats.todayRevenue),
              icon: <FaMoneyBillWave className="text-emerald-600" />,
              bg: "bg-emerald-500/10",
              border: "border-slate-100 dark:border-slate-800",
            },
            {
              title: "Active Deliveries",
              value: stats.deliveriesInProgress,
              icon: <FaTruck className="text-indigo-600" />,
              bg: "bg-indigo-500/10",
              border: "border-slate-100 dark:border-slate-800",
            },
            {
              title: "Total Products",
              value: stats.totalMedicines,
              icon: <FaBoxOpen className="text-blue-600" />,
              bg: "bg-blue-500/10",
              border: "border-slate-100 dark:border-slate-800",
            },
          ].map((card, i) => (
            <div 
              key={i} 
              className={`bg-white dark:bg-slate-900 border-2 ${card.border} rounded-2xl p-6 flex items-center gap-4 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md shadow-sm`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                {card.icon}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{card.value}</h4>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{card.title}</p>
              </div>
              {card.badge && (
                <span className={`absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider text-white ${card.badgeBg} px-2 py-0.5 rounded-md`}>
                  {card.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Quick Operations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {quickActions.map((action, idx) => (
              <div
                key={idx}
                onClick={action.onClick}
                className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all relative ${
                  action.urgent ? "border-amber-400" : "border-slate-100 dark:border-slate-800/80"
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  {action.icon}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-205 leading-snug">{action.title}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-semibold">{action.description}</p>
                </div>
                {action.badge && (
                  <span className="absolute top-4 right-4 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {action.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs System */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto pharmacist-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: <FaClipboardList /> },
            {
              id: "orders",
              label: `Orders`,
              icon: <FaShoppingCart />,
              badge: stats.pendingOrders,
            },
            {
              id: "inventory",
              label: `Inventory (${stats.totalMedicines})`,
              icon: <FaBoxOpen />,
              badge: stats.lowStockItems + stats.outOfStockItems || null,
            },
            {
              id: "prescriptions",
              label: "Prescriptions",
              icon: <FaPrescriptionBottle />,
            },
            { id: "analytics", label: "Analytics", icon: <FaChartLine /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchQuery("")
              }}
              className={`flex items-center gap-2 px-5 py-4 border-b-2 font-black text-xs uppercase tracking-wider bg-transparent border-none cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? "border-green-600 text-green-600 dark:text-green-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] rounded-full">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Revenue Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaMoneyBillWave className="text-green-600" /> Revenue Summary
                </h4>
                <div className="space-y-3">
                  {[
                    { label: "Today", value: formatCurrency(stats.todayRevenue), color: "text-green-605" },
                    { label: "This Month", value: formatCurrency(stats.monthlyRevenue), color: "text-green-605" },
                    { label: "Total Orders", value: stats.totalOrders, color: "text-slate-800 dark:text-slate-200" },
                    { label: "Total Products", value: stats.totalMedicines, color: "text-slate-800 dark:text-slate-200" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                      <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Alerts */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaExclamationTriangle className="text-rose-500" /> Stock Alerts
                </h4>
                
                {stats.lowStockItems === 0 && stats.outOfStockItems === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                    <FaCheckCircle className="text-lg flex-shrink-0" />
                    <div>
                      <h5 className="text-xs font-black">All Stock Levels Normal</h5>
                      <p className="text-[10px] font-bold mt-0.5 text-emerald-600 dark:text-emerald-500">No immediate restocking actions required.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.lowStockItems > 0 && (
                      <div className="flex items-center gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/50">
                        <FaExclamationTriangle className="text-lg flex-shrink-0" />
                        <div>
                          <h5 className="text-xs font-black">{stats.lowStockItems} Items Low Stock</h5>
                          <p className="text-[10px] font-bold mt-0.5 text-amber-600 dark:text-amber-550">Reorder soon to avoid stock depletion.</p>
                        </div>
                      </div>
                    )}
                    {stats.outOfStockItems > 0 && (
                      <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                        <FaTimesCircle className="text-lg flex-shrink-0" />
                        <div>
                          <h5 className="text-xs font-black">{stats.outOfStockItems} Items Out of Stock</h5>
                          <p className="text-[10px] font-bold mt-0.5 text-rose-600 dark:text-rose-500">Requires immediate attention to restock.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Pipeline */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaShoppingCart className="text-indigo-500" /> Order Summary
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "Pending", count: stats.pendingOrders, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
                    { label: "Processing", count: orders.filter((o) => o.order_status === "processing").length, cls: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
                    { label: "Out for Delivery", count: stats.deliveriesInProgress, cls: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" },
                    { label: "Total Completed", count: stats.totalOrders, cls: "text-green-600 bg-green-50 dark:bg-green-950/20" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2.5 px-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                      <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${item.cls}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            {orders.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <h3 className="text-xs font-black text-slate-405 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FaShoppingCart className="text-green-600" /> Recent Orders
                  </h3>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border-none cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                
                <div className="overflow-x-auto pharmacist-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-850">
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Order ID</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Phone</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850 text-sm font-semibold text-slate-700 dark:text-slate-205">
                      {orders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-4 px-4 font-black">{order.order_number || `#${order.id}`}</td>
                          <td className="py-4 px-4 font-mono text-xs">{order.delivery_phone || "—"}</td>
                          <td className="py-4 px-4 font-black">{formatCurrency(order.total_amount)}</td>
                          <td className="py-4 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(order.order_status)}`}>
                              {getStatusLabel(order.order_status)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-400">{formatDateTime(order.created_at)}</td>
                          <td className="py-4 px-4 text-right">
                            {order.order_status === "pending" && (
                              <button
                                onClick={() => handleOrderAction(order.id, "confirmed")}
                                className="px-3.5 py-1.5 bg-emerald-55 text-emerald-700 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <FaCheckCircle /> Confirm
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Orders Tab ────────────────────────────────────────────────────── */}
        {activeTab === "orders" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
                <FaShoppingCart className="text-green-600" /> Orders ({filteredOrders.length})
              </h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center max-w-xs w-full">
                  <FaSearch className="absolute left-3.5 text-slate-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search by order # or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                  />
                </div>
                
                <button
                  onClick={() => loadDashboardData(user.id)}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loading orders...</p>
              </div>
            ) : filteredOrders.length > 0 ? (
              <div className="overflow-x-auto pharmacist-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-850">
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Order ID</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Delivery Info</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Items</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Payment</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850 text-sm font-semibold text-slate-700 dark:text-slate-205">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="py-4 px-4 font-black">{order.order_number || `#${order.id}`}</td>
                        <td className="py-4 px-4 max-w-[200px]">
                          <div className="font-black text-xs text-slate-800 dark:text-slate-200">{order.delivery_phone || "—"}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{order.delivery_address || "—"}</div>
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-500">
                          {Array.isArray(order.order_items) ? `${order.order_items.length} item(s)` : "—"}
                        </td>
                        <td className="py-4 px-4 font-black">{formatCurrency(order.total_amount)}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(order.payment_status)}`}>
                            {order.payment_status || "—"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(order.order_status)}`}>
                            {getStatusLabel(order.order_status)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-400">{formatDateTime(order.created_at)}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {order.order_status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleOrderAction(order.id, "confirmed")}
                                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleOrderAction(order.id, "cancelled")}
                                  className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-[10px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {order.order_status === "confirmed" && (
                              <button
                                onClick={() => handleOrderAction(order.id, "processing")}
                                className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                              >
                                Process
                              </button>
                            )}
                            {order.order_status === "processing" && (
                              <button
                                onClick={() => handleOrderAction(order.id, "out_for_delivery")}
                                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                              >
                                Dispatch
                              </button>
                            )}
                            {order.order_status === "out_for_delivery" && (
                              <button
                                onClick={() => handleOrderAction(order.id, "delivered")}
                                className="px-3.5 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-xl text-[10px] font-black uppercase hover:bg-green-600 hover:text-white transition-all cursor-pointer"
                              >
                                Delivered
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
              <div className="py-12 text-center space-y-2">
                <FaShoppingCart className="text-4xl text-slate-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-805 dark:text-slate-205">No Orders Found</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold max-w-sm mx-auto">
                  {searchQuery
                    ? `No orders match "${searchQuery}"`
                    : "Active patient orders will display here once placed."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Inventory Tab ─────────────────────────────────────────────────── */}
        {activeTab === "inventory" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
                <FaBoxOpen className="text-green-600" /> Inventory ({filteredInventory.length})
              </h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center max-w-xs w-full">
                  <FaSearch className="absolute left-3.5 text-slate-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search medicines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                  />
                </div>
                
                <button
                  onClick={() => navigate("/pharmacy-home")}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer flex items-center gap-1.5"
                >
                  <FaPlus /> Add Medicine
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loading inventory...</p>
              </div>
            ) : filteredInventory.length > 0 ? (
              <div className="overflow-x-auto pharmacist-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-850">
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Medicine Name</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Stock Status</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Price / MRP</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Expiry</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Alert</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850 text-sm font-semibold text-slate-700 dark:text-slate-205">
                    {filteredInventory.map((item) => {
                      const stockStatus = getStockStatus(item)
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                            stockStatus === "out_of_stock" ? "bg-rose-50/20 dark:bg-rose-950/5" : ""
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="font-black text-slate-850 dark:text-slate-200">{item.name}</div>
                            {item.generic_name && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">{item.generic_name}</div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-500 capitalize">
                            {(item.category || "").replace(/_/g, " ")}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className={`font-black text-xs ${item.stock_quantity <= (item.min_stock || 10) ? "text-rose-500" : "text-slate-700 dark:text-slate-350"}`}>
                                {item.stock_quantity} units
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Min: {item.min_stock || 10}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs">
                              <span className="font-black text-slate-850 dark:text-slate-200">{formatCurrency(item.price)}</span>
                              {item.mrp && item.mrp !== item.price && (
                                <span className="block text-[10px] text-slate-400 line-through mt-0.5">MRP {formatCurrency(item.mrp)}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-500">
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getStatusColor(stockStatus)}`}>
                              {getStatusLabel(stockStatus)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => navigate(`/pharmacy/product/${item.id}`)}
                                className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <FaEye /> View
                              </button>
                              {item.stock_quantity <= (item.min_stock || 10) && (
                                <button
                                  onClick={() => navigate("/pharmacy-home")}
                                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <FaPlus /> Restock
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <FaBoxOpen className="text-4xl text-slate-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-805 dark:text-slate-205 font-bold">No Inventory Items Found</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold max-w-sm mx-auto">
                  {searchQuery
                    ? `No medicines match "${searchQuery}"`
                    : "Add pharmaceutical stock to your pharmacy database to get started."}
                </p>
                <button
                  onClick={() => navigate("/pharmacy-home")}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <FaPlus /> Add Medicine
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Prescriptions Tab ─────────────────────────────────────────────── */}
        {activeTab === "prescriptions" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
                <FaPrescriptionBottle className="text-green-600" /> Prescriptions ({filteredPrescriptions.length})
              </h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center max-w-xs w-full">
                  <FaSearch className="absolute left-3.5 text-slate-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search by patient or Rx#..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
                  />
                </div>
                
                <button
                  onClick={() => loadDashboardData(user.id)}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loading prescriptions...</p>
              </div>
            ) : filteredPrescriptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                {filteredPrescriptions.map((prescription) => (
                  <div 
                    key={prescription.id} 
                    className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-green-500 transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <h4 className="text-sm font-black text-slate-850 dark:text-slate-200">{prescription.prescription_number || `RX-${prescription.id}`}</h4>
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getStatusColor(prescription.status)}`}>
                          {getStatusLabel(prescription.status)}
                        </span>
                      </div>
                      
                      <div className="space-y-1.5 text-xs text-slate-650 dark:text-slate-350">
                        <p><strong className="text-slate-400">Patient:</strong> {prescription.patient_name || "—"}</p>
                        <p><strong className="text-slate-400">Phone:</strong> {prescription.patient_phone || "—"}</p>
                        <p><strong className="text-slate-400">Doctor:</strong> {prescription.doctor_name || "—"}</p>
                        {prescription.diagnosis && (
                          <p><strong className="text-slate-400">Diagnosis:</strong> {prescription.diagnosis}</p>
                        )}
                        
                        {Array.isArray(prescription.medications) && prescription.medications.length > 0 && (
                          <div className="pt-2">
                            <strong className="text-slate-400 block mb-1">Medications:</strong>
                            <ul className="list-disc pl-4 space-y-0.5 font-bold text-slate-700 dark:text-slate-300">
                              {prescription.medications.slice(0, 4).map((med, idx) => (
                                <li key={idx}>
                                  {typeof med === "object"
                                    ? `${med.name || ""} ${med.dosage || ""} – ${med.frequency || ""}`
                                    : med}
                                </li>
                              ))}
                              {prescription.medications.length > 4 && (
                                <li className="text-[10px] text-slate-400 list-none font-bold italic pt-0.5">
                                  +{prescription.medications.length - 4} more medicines
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <span className="text-[10px] font-bold text-slate-400">{formatDateTime(prescription.created_at)}</span>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase border-none cursor-pointer flex items-center gap-1">
                          <FaEye /> View
                        </button>
                        {(prescription.status === "pending_verification" || prescription.status === "active") && (
                          <button className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase border-none cursor-pointer flex items-center gap-1">
                            <FaCheckCircle /> Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <FaPrescriptionBottle className="text-4xl text-slate-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-850 dark:text-slate-205">No Prescriptions Found</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold max-w-sm mx-auto">
                  {searchQuery
                    ? `No prescriptions match "${searchQuery}"`
                    : "Prescriptions from consulting doctors will be visible here."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Revenue card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaChartLine className="text-green-600" /> Revenue Summary
                </h4>
                
                <div className="space-y-3">
                  {[
                    { label: "Today", value: formatCurrency(stats.todayRevenue) },
                    { label: "This Month (30d)", value: formatCurrency(stats.monthlyRevenue) },
                    { label: "Avg. Order Value", value: stats.totalOrders > 0 ? formatCurrency(stats.monthlyRevenue / stats.totalOrders) : "₹0" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                      <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      <span className="text-sm font-black text-slate-850 dark:text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock health card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaBoxOpen className="text-blue-600" /> Inventory Health
                </h4>
                
                <div className="space-y-3">
                  {[
                    { label: "Total Products", value: stats.totalMedicines, cls: "text-slate-700 dark:text-slate-300" },
                    { label: "Low Stock", value: stats.lowStockItems, cls: stats.lowStockItems > 0 ? "text-amber-500" : "text-green-600" },
                    { label: "Out of Stock", value: stats.outOfStockItems, cls: stats.outOfStockItems > 0 ? "text-rose-500" : "text-green-600" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                      <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      <span className={`text-sm font-black ${item.cls}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline summary card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaShoppingCart className="text-indigo-600" /> Order Pipeline
                </h4>
                
                <div className="space-y-2">
                  {[
                    { label: "Pending", status: "pending" },
                    { label: "Processing", status: "processing" },
                    { label: "Out for Delivery", status: "out_for_delivery" },
                    { label: "Delivered", status: "delivered" },
                    { label: "Cancelled", status: "cancelled" },
                  ].map((item) => (
                    <div key={item.status} className="flex justify-between items-center py-2.5 px-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                      <span className="text-xs font-bold text-slate-500">{item.label}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black border ${getStatusColor(item.status)}`}>
                        {orders.filter((o) => o.order_status === item.status).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category breakdown table */}
            {inventory.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm p-6 space-y-4">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FaBoxOpen className="text-green-600" /> Inventory by Category
                </h3>
                
                <div className="overflow-x-auto pharmacist-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-850">
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Products</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Stock</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Out of Stock</th>
                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Low Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850 text-sm font-semibold text-slate-700 dark:text-slate-205">
                      {Object.entries(
                        inventory.reduce((acc, m) => {
                          const cat = (m.category || "other").replace(/_/g, " ")
                          if (!acc[cat])
                            acc[cat] = {
                              total: 0,
                              stock: 0,
                              outOfStock: 0,
                              lowStock: 0,
                            }
                          acc[cat].total++
                          acc[cat].stock += m.stock_quantity || 0
                          if (m.stock_quantity === 0) acc[cat].outOfStock++
                          else if (m.stock_quantity <= (m.min_stock || 10))
                            acc[cat].lowStock++
                          return acc
                        }, {})
                      )
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([cat, data]) => (
                          <tr key={cat} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-4 px-4 capitalize font-black">{cat}</td>
                            <td className="py-4 px-4">{data.total}</td>
                            <td className="py-4 px-4 font-mono text-xs">{data.stock.toLocaleString()} units</td>
                            <td className="py-4 px-4">
                              <span className={data.outOfStock > 0 ? "text-rose-500 font-black" : "text-green-600"}>
                                {data.outOfStock}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={data.lowStock > 0 ? "text-amber-500 font-black" : "text-green-600"}>
                                {data.lowStock}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default PharmacistDashboard