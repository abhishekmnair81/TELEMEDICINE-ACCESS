import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaBox,
  FaCheckCircle,
  FaTruck,
  FaClock,
  FaTimes,
  FaEye,
  FaArrowLeft,
  FaMapMarkerAlt,
  FaPhone,
  FaReceipt,
  FaShoppingBag,
  FaHeartbeat,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaBoxOpen,
  FaTag,
} from 'react-icons/fa'
import './Orders.css'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api'

/* ── tiny helper: track steps ── */
const TRACK_STEPS = [
  { key: 'pending',          label: 'Order Placed',     icon: <FaReceipt /> },
  { key: 'confirmed',        label: 'Confirmed',         icon: <FaCheckCircle /> },
  { key: 'processing',       label: 'Processing',        icon: <FaBox /> },
  { key: 'out_for_delivery', label: 'Out for Delivery',  icon: <FaTruck /> },
  { key: 'delivered',        label: 'Delivered',         icon: <FaBoxOpen /> },
]

const STATUS_ORDER = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: -1,
}

const STATUS_COLOR_TW = {
  pending:          'bg-amber-50 text-amber-700 border-amber-200/30',
  confirmed:        'bg-blue-50 text-blue-700 border-blue-200/30',
  processing:       'bg-purple-50 text-purple-700 border-purple-200/30',
  out_for_delivery: 'bg-cyan-50 text-cyan-700 border-cyan-200/30',
  delivered:        'bg-emerald-50 text-emerald-700 border-emerald-200/30',
  cancelled:        'bg-rose-50 text-rose-700 border-rose-200/30',
}

const STATUS_ACTIVE_TW = {
  all:              'bg-emerald-600 shadow-emerald-600/10',
  pending:          'bg-amber-500 shadow-amber-500/10',
  confirmed:        'bg-blue-500 shadow-blue-500/10',
  processing:       'bg-purple-500 shadow-purple-500/10',
  out_for_delivery: 'bg-cyan-500 shadow-cyan-500/10',
  delivered:        'bg-emerald-500 shadow-emerald-500/10',
  cancelled:        'bg-rose-500 shadow-rose-500/10',
}

const STATUS_ICON = {
  pending:          <FaClock />,
  confirmed:        <FaCheckCircle />,
  processing:       <FaBox />,
  out_for_delivery: <FaTruck />,
  delivered:        <FaCheckCircle />,
  cancelled:        <FaTimes />,
}

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const fmtStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const fmtAmt   = (n) => `₹${parseFloat(n || 0).toFixed(2)}`

/* ═══════════════════════════════════════════════════════════════
   TRACK ORDER MODAL
   ═══════════════════════════════════════════════════════════════ */
function TrackOrderModal({ order, onClose }) {
  const currentStep = STATUS_ORDER[order.order_status] ?? 0
  const isCancelled = order.order_status === 'cancelled'

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-modal-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-955 text-white flex items-start justify-between gap-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-black text-white/95 flex items-center gap-2">
              <FaTruck className="text-emerald-400" />
              <span>Track Order</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Order #{order.order_number}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-600/90 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors border-none cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 nms-stores-scrollbar">
          {isCancelled ? (
            <div className="flex gap-4 items-start bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-800">
              <FaTimes className="text-xl mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <strong className="text-xs font-black uppercase tracking-wide">Order Cancelled</strong>
                <p className="text-xs text-rose-600 font-semibold leading-relaxed">This order has been cancelled. Any refund applicable will be processed to the original payment source within 5–7 business days.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {TRACK_STEPS.map((step, idx) => {
                const done    = idx <= currentStep
                const current = idx === currentStep
                const last    = idx === TRACK_STEPS.length - 1
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all z-[1] ${
                          current
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105'
                            : done
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-600'
                              : 'bg-white border-slate-200 text-slate-300'
                        }`}
                      >
                        {step.icon}
                      </div>
                      {!last && (
                        <div
                          className={`w-0.5 h-8 my-1 transition-all ${
                            done && idx < currentStep ? 'bg-emerald-600' : 'bg-slate-100'
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-1 flex flex-col gap-0.5 pb-4">
                      <span className={`text-xs uppercase tracking-wide font-black transition-colors ${
                        current
                          ? 'text-slate-900 font-black'
                          : done
                            ? 'text-slate-700 font-bold'
                            : 'text-slate-300'
                      }`}>
                        {step.label}
                      </span>
                      {current && (
                        <span className="inline-flex self-start px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 mt-1">
                          Current Status
                        </span>
                      )}
                      {step.key === 'pending' && (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Placed {formatDate(order.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Delivery Info */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-emerald-600" />
              <span>Delivery Information</span>
            </h4>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">{order.delivery_address}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
              <FaPhone className="text-emerald-600 text-[10px]" />
              <span>{order.delivery_phone}</span>
            </div>
          </div>

          {/* Status chip row */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${STATUS_COLOR_TW[order.order_status]}`}>
              {STATUS_ICON[order.order_status]}
              <span>{fmtStatus(order.order_status)}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
              Placed {formatDate(order.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ORDER DETAIL MODAL
   ═══════════════════════════════════════════════════════════════ */
function OrderDetailModal({ order, onClose, onTrack }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-modal-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-955 text-white flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm flex-shrink-0">
              <FaReceipt />
            </div>
            <div>
              <h2 className="text-base font-black text-white/95">Order Details</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">#{order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-600/90 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors border-none cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 nms-stores-scrollbar">
          {/* Status Banner */}
          <div className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border ${STATUS_COLOR_TW[order.order_status]}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">
                {STATUS_ICON[order.order_status]}
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-wide">
                  {fmtStatus(order.order_status)}
                </div>
                <div className="text-[11px] font-bold opacity-80 mt-0.5">
                  Payment: {fmtStatus(order.payment_status)} · {fmtStatus(order.payment_method || 'cash_on_delivery')}
                </div>
              </div>
            </div>
            <button
              onClick={() => { onClose(); onTrack(order) }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/60 hover:border-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none cursor-pointer"
            >
              <FaTruck className="text-emerald-600 text-[10px]" />
              <span>Track Order</span>
            </button>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Items */}
            <div className="md:col-span-7 space-y-3">
              <h4 className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Items Ordered</h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {order.order_items && order.order_items.length > 0 ? (
                  order.order_items.map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50/20 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
                        <FaBox />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.medicine_name || item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-black text-slate-800 flex-shrink-0">
                        {fmtAmt((parseFloat(item.price || 0) * item.quantity).toFixed(2))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold">No items found</div>
                )}
              </div>
            </div>

            {/* Right: Summary + Delivery */}
            <div className="md:col-span-5 space-y-6">
              <div className="space-y-3">
                <h4 className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Payment Summary</h4>
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                    <span>Subtotal</span>
                    <span>{fmtAmt(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                    <span>Delivery Charge</span>
                    <span>{fmtAmt(order.delivery_charge)}</span>
                  </div>
                  {parseFloat(order.discount) > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600">
                      <span>Discount</span>
                      <span>-{fmtAmt(order.discount)}</span>
                    </div>
                  )}
                  <div className="h-px bg-slate-200/60 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-800">Total</span>
                    <span className="text-sm font-black text-slate-900">{fmtAmt(order.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Delivery Info</h4>
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-slate-600 font-bold leading-relaxed">
                    <FaMapMarkerAlt className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>{order.delivery_address}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 font-bold">
                    <FaPhone className="text-emerald-600 flex-shrink-0" />
                    <span>{order.delivery_phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ORDERS PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Orders() {
  const navigate = useNavigate()
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [user,     setUser]     = useState(null)

  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')

  const [trackOrder,  setTrackOrder]  = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)

  /* ── load user ── */
  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    else    setLoading(false)
  }, [])

  /* ── fetch orders ── */
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('accessToken')
    setLoading(true)

    fetch(`${API_BASE_URL}/orders/my-orders/`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
      .then(r => r.json())
      .then(data => {
        setOrders(data.orders || data || [])
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user])

  /* ── filter + search ── */
  const visible = orders.filter(o => {
    const matchFilter = filter === 'all' || o.order_status === filter
    const matchSearch =
      !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      (o.order_items || []).some(i =>
        (i.medicine_name || i.name || '').toLowerCase().includes(search.toLowerCase())
      )
    return matchFilter && matchSearch
  })

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 font-sans text-slate-800">
      {/* ── Top Bar ── */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <FaHeartbeat className="text-lg" />
            </div>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">
              Rural HealthCare
            </span>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer"
          >
            <FaArrowLeft className="text-[10px]" />
            <span>Back</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {!user ? (
          <GuestPage navigate={navigate} />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading your orders...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-white border border-slate-100 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 text-3xl mb-2">
              <FaTimes />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Error Loading Orders</h3>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-2 border-none cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Page Heading ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <FaShoppingBag className="text-emerald-600" />
                  <span>My Orders</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-bold tracking-wide mt-1">
                  {orders.length} order{orders.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={() => navigate('/pharmacy/browse')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-lg transition-all border-none cursor-pointer"
              >
                <FaBox className="text-[10px]" />
                <span>Shop More</span>
              </button>
            </div>

            {/* ── Search + Filter Bar ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="relative flex-1 max-w-md w-full">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search by order number or medicine..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200/80 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-semibold placeholder:text-slate-400/80"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm transition-colors border-none cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 max-w-full no-scrollbar">
                {['all','pending','confirmed','processing','out_for_delivery','delivered','cancelled'].map(s => {
                  const isActive = filter === s
                  const colorClass = STATUS_ACTIVE_TW[s] || 'bg-slate-100 text-slate-700'
                  return (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all select-none border border-transparent cursor-pointer ${
                        isActive
                          ? `${colorClass} text-white shadow-sm`
                          : 'bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {s === 'all' ? 'All' : fmtStatus(s)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Orders List ── */}
            {visible.length === 0 ? (
              <EmptyState filter={filter} search={search} navigate={navigate} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visible.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onView={() => setDetailOrder(order)}
                    onTrack={() => setTrackOrder(order)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {trackOrder  && <TrackOrderModal  order={trackOrder}  onClose={() => setTrackOrder(null)} />}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onTrack={(o) => { setDetailOrder(null); setTrackOrder(o) }}
        />
      )}
    </div>
  )
}

/* ── Single Order Card ── */
function OrderCard({ order, onView, onTrack }) {
  const [expanded, setExpanded] = useState(false)
  const currentStep = STATUS_ORDER[order.order_status] ?? 0
  const isCancelled = order.order_status === 'cancelled'
  const progress = isCancelled ? 0 : Math.round((currentStep / (TRACK_STEPS.length - 1)) * 100)

  return (
    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg hover:border-slate-200/80 transition-all duration-300 p-6 flex flex-col gap-5 relative overflow-hidden order-card-item">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-black text-slate-800">#{order.order_number}</span>
          <span className="text-[11px] text-slate-400 font-bold tracking-wide uppercase">Placed {formatDate(order.created_at)}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${STATUS_COLOR_TW[order.order_status]}`}>
          <span className="text-[10px]">{STATUS_ICON[order.order_status]}</span>
          <span>{fmtStatus(order.order_status)}</span>
        </span>
      </div>

      {/* Progress Bar */}
      {!isCancelled && (
        <div className="flex flex-col gap-2">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-emerald-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {TRACK_STEPS.map((step, idx) => {
              const isDone = idx <= currentStep
              const isCurrent = idx === currentStep
              return (
                <span
                  key={step.key}
                  className={`${
                    isCurrent
                      ? 'text-slate-800 font-black'
                      : isDone
                        ? 'text-emerald-600'
                        : 'text-slate-300'
                  }`}
                >
                  {step.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Items preview */}
      <div className="space-y-2">
        {(order.order_items || []).slice(0, expanded ? undefined : 2).map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-dashed border-slate-100 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
              <FaBox />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{item.medicine_name || item.name}</p>
              <p className="text-[10px] text-slate-400 font-bold">Qty: {item.quantity}</p>
            </div>
            <span className="text-xs font-black text-slate-800">
              {fmtAmt((parseFloat(item.price || 0) * item.quantity).toFixed(2))}
            </span>
          </div>
        ))}
        {(order.order_items || []).length > 2 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(v => !v)
            }}
            className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 uppercase tracking-wide hover:text-emerald-700 transition-colors mt-2 border-none bg-transparent cursor-pointer"
          >
            {expanded ? (
              <>
                <FaChevronUp className="text-[9px]" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <FaChevronDown className="text-[9px]" />
                <span>+{order.order_items.length - 2} more items</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-100 mt-auto bg-slate-50/50 -mx-6 -mb-6 p-6 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">Total</span>
            <span className="text-base font-black text-slate-900">{fmtAmt(order.total_amount)}</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
            order.payment_status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/30'
              : 'bg-amber-50 text-amber-700 border-amber-200/30'
          }`}>
            <FaTag className="text-[8px]" />
            <span>{fmtStatus(order.payment_status)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <FaEye className="text-[10px] text-slate-400" />
            <span>Details</span>
          </button>
          {!isCancelled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTrack()
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <FaTruck className="text-[10px]" />
              <span>Track</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Guest Page ── */
function GuestPage({ navigate }) {
  return (
    <div className="max-w-md mx-auto my-24 bg-white border border-slate-100 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-4 animate-modal-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-3xl mb-2">
        <FaShoppingBag />
      </div>
      <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Please Log In</h3>
      <p className="text-xs text-slate-400 font-bold leading-relaxed">Please log in to your patient account to view your medical store orders and delivery tracking.</p>
      <button
        onClick={() => navigate('/auth?type=patient&view=login')}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/10 active:scale-[0.98] transition-all mt-2 border-none cursor-pointer"
      >
        Log In Now
      </button>
    </div>
  )
}

/* ── Empty State ── */
function EmptyState({ filter, search, navigate }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center flex flex-col items-center gap-4 shadow-sm max-w-md mx-auto my-12 animate-modal-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-3xl mb-2">
        <FaBoxOpen />
      </div>
      <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">
        {search ? 'No Match Found' : filter !== 'all' ? `No ${fmtStatus(filter)} Orders` : 'No Orders Yet'}
      </h3>
      <p className="text-xs text-slate-400 font-bold leading-relaxed">
        {search || filter !== 'all'
          ? 'Try adjusting your search query or choosing a different filter tab.'
          : "You haven't placed any pharmacy orders yet. Start searching for medicines!"}
      </p>
      <button
        onClick={() => navigate('/pharmacy/browse')}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/10 transition-all mt-2 border-none cursor-pointer"
      >
        Browse Pharmacy
      </button>
    </div>
  )
}