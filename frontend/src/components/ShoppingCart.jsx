import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaShoppingCart, FaTrash, FaPlus, FaMinus, FaArrowRight,
  FaTruck, FaShieldAlt, FaPercent, FaTag, FaExclamationTriangle,
  FaCreditCard, FaMoneyBillWave, FaBox, FaCheckCircle, FaChevronLeft,
  FaPills
} from 'react-icons/fa';
import './ShoppingCart.css';
import { cartAPI } from '../services/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:8000';

const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getMedicineImage = (medicine) => {
  if (!medicine) return null;
  if (medicine.primary_image) return resolveImageUrl(medicine.primary_image);
  if (medicine.images && medicine.images.length > 0) {
    const img = medicine.images.find(i => i.is_primary) || medicine.images[0];
    return resolveImageUrl(img.image_url || img.image);
  }
  return null;
};

const ShoppingCart = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imgErrors, setImgErrors] = useState({});

  const [checkoutForm, setCheckoutForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    payment_method: 'cash_on_delivery',
    prescription_file: null
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setCheckoutForm(prev => ({
        ...prev,
        full_name: `${parsedUser.first_name || ''} ${parsedUser.last_name || ''}`.trim(),
        phone: parsedUser.phone_number || '',
        email: parsedUser.email || '',
      }));
    }
    loadCart();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  const getSessionId = () => {
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  };

  const loadCart = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (!currentUser) {
        params.append('session_id', getSessionId());
      }

      const response = await fetch(`${API_BASE_URL}/cart/?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to load cart');

      const data = await response.json();
      console.log('[Cart] Loaded:', data);

      if (data.success && data.cart) {
        setCart(data.cart.items || []);
        if (data.cart.applied_coupon) {
          setAppliedCoupon({
            code: data.cart.applied_coupon,
            discount: data.cart.discount
          });
        }
      }
    } catch (err) {
      console.error('[Cart] Load error:', err);
      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (cartItemId, delta) => {
    try {
      const item = cart.find(i => i.id === cartItemId);
      if (!item) return;
      const newQuantity = item.quantity + delta;
      if (newQuantity < 1) return;

      const requestBody = { quantity: newQuantity };
      if (!user) requestBody.session_id = getSessionId();

      const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}/update_quantity/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update quantity');
      }

      await loadCart();
    } catch (err) {
      console.error('[Cart] Update error:', err);
      alert('Failed to update quantity: ' + err.message);
    }
  };

  const removeItem = async (cartItemId) => {
    try {
      const requestBody = {};
      if (!user) requestBody.session_id = getSessionId();

      const response = await fetch(`${API_BASE_URL}/cart/${cartItemId}/remove_item/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove item');
      }

      await loadCart();
    } catch (err) {
      console.error('[Cart] Remove error:', err);
      alert('Failed to remove item: ' + err.message);
    }
  };

  const clearCart = async () => {
    if (!window.confirm('Are you sure you want to clear your cart?')) return;
    try {
      const params = new URLSearchParams();
      if (!user) params.append('session_id', getSessionId());

      const response = await fetch(`${API_BASE_URL}/cart/clear/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to clear cart');

      setCart([]);
      setAppliedCoupon(null);
      setCouponCode('');
    } catch (err) {
      console.error('[Cart] Clear error:', err);
      alert('Failed to clear cart: ' + err.message);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) { alert('Please enter a coupon code'); return; }
    try {
      const requestBody = { coupon_code: couponCode.toUpperCase() };
      if (!user) requestBody.session_id = getSessionId();

      const response = await fetch(`${API_BASE_URL}/cart/apply_coupon/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid coupon code');
      }

      const data = await response.json();
      setAppliedCoupon({ code: data.coupon.code, discount: data.discount_amount });
      alert(`Coupon "${data.coupon.code}" applied successfully!`);
      await loadCart();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode('');
    await loadCart();
  };

  const calculateSubtotal = () =>
    cart.reduce((sum, item) => {
      const price = parseFloat(item.medicine_details?.price || item.price_at_addition || 0);
      return sum + price * item.quantity;
    }, 0);

  const calculateDiscount = () => parseFloat(appliedCoupon?.discount || 0);
  const calculateDeliveryFee = () => (calculateSubtotal() >= 500 ? 0 : 40);
  const calculateTotal = () => calculateSubtotal() - calculateDiscount() + calculateDeliveryFee();

  const hasPrescriptionItems = () =>
    cart.some(item => item.medicine_details?.requires_prescription || item.requires_prescription);

  const handleCheckoutFormChange = (e) => {
    const { name, value } = e.target;
    setCheckoutForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePrescriptionUpload = (e) => {
    const file = e.target.files[0];
    if (file) setCheckoutForm(prev => ({ ...prev, prescription_file: file }));
  };

  const validateCheckoutForm = () => {
    const errors = [];
    if (!checkoutForm.full_name?.trim())   errors.push('Full name is required');
    if (!checkoutForm.phone?.trim())        errors.push('Phone number is required');
    else if (!/^\d{10}$/.test(checkoutForm.phone.replace(/\D/g, '')))
      errors.push('Phone number must be 10 digits');
    if (!checkoutForm.address?.trim())      errors.push('Address is required');
    if (!checkoutForm.city?.trim())         errors.push('City is required');
    if (!checkoutForm.state?.trim())        errors.push('State is required');
    if (!checkoutForm.pincode?.trim())      errors.push('Pincode is required');
    else if (!/^\d{6}$/.test(checkoutForm.pincode))
      errors.push('Pincode must be 6 digits');
    if (hasPrescriptionItems() && !checkoutForm.prescription_file)
      errors.push('Prescription upload is required for prescription medicines');
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCheckoutForm()) return;
    try {
      setSubmitting(true);
      const subtotal    = calculateSubtotal();
      const discount    = calculateDiscount();
      const deliveryCharge = calculateDeliveryFee();
      const total       = calculateTotal();

      const orderData = {
        full_name: checkoutForm.full_name,
        delivery_address: `${checkoutForm.address}, ${checkoutForm.city}, ${checkoutForm.state} - ${checkoutForm.pincode}`,
        delivery_phone: checkoutForm.phone,
        payment_method: checkoutForm.payment_method,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        delivery_charge: deliveryCharge.toFixed(2),
        total_amount: total.toFixed(2)
      };

      if (!user) orderData.session_id = getSessionId();

      const headers = { 'Content-Type': 'application/json' };
      if (user) {
        const token = localStorage.getItem('accessToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/orders/create-from-cart/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to place order';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch { errorMessage = errorText || errorMessage; }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCart([]);
      setAppliedCoupon(null);
      localStorage.removeItem('applied_coupon');

      alert(
        `Order placed successfully!\n\nOrder Number: ${data.order.order_number}\nTotal: ₹${data.order.total_amount}\n\nYou will be redirected to your orders.`
      );
      navigate('/pharmacy/orders');
    } catch (err) {
      console.error('[Order] Error:', err);
      alert(`Failed to place order: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const CartItemImage = ({ item }) => {
    const medicine = item.medicine_details || {};
    const imgSrc   = getMedicineImage(medicine);
    const hasError = imgErrors[item.id];

    if (!imgSrc || hasError) {
      return (
        <div
          className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-350 cursor-pointer hover:border-green-600 border border-slate-100 transition-colors"
          onClick={() => navigate(`/pharmacy/product/${item.medicine}`)}
        >
          <FaPills className="text-2xl" />
        </div>
      );
    }

    return (
      <div
        className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer hover:border-green-600 border border-slate-100 transition-colors"
        onClick={() => navigate(`/pharmacy/product/${item.medicine}`)}
      >
        <img
          src={imgSrc}
          alt={medicine.name}
          className="w-full h-full object-cover p-1"
          onError={() => {
            console.warn('[Cart] Image failed to load:', imgSrc);
            setImgErrors(prev => ({ ...prev, [item.id]: true }));
          }}
        />
      </div>
    );
  };


  if (loading && cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loading your cart...</p>
        </div>
      </div>
    );
  }


  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex items-center justify-center px-4 py-20">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full border border-slate-100 dark:border-slate-800 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-350 dark:text-slate-600 text-3xl mx-auto">
            <FaShoppingCart />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-850 dark:text-white tracking-tight">Your Cart is Empty</h2>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 leading-relaxed">
              Looks like you haven't added any products yet. Browse our selection of medicines and healthcare products.
            </p>
          </div>
          <button
            onClick={() => navigate('/pharmacy/browse')}
            className="w-full py-3 bg-green-605 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-none cursor-pointer transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // ── Checkout form view ───────────────────────────────────────
  if (showCheckout) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-805 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center border-none cursor-pointer transition-colors"
                title="Back to Cart"
              >
                <FaChevronLeft />
              </button>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Checkout</h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Secure payment & shipping details</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Forms section */}
            <div className="lg:col-span-2 space-y-6">

              {/* Delivery Info */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                <h2 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/80 pb-3">
                  <FaBox className="text-green-600" /> Delivery Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">Full Name *</label>
                    <input
                      type="text"
                      name="full_name"
                      value={checkoutForm.full_name}
                      onChange={handleCheckoutFormChange}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={checkoutForm.phone}
                      onChange={handleCheckoutFormChange}
                      placeholder="10-digit mobile number"
                      maxLength="10"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={checkoutForm.email}
                      onChange={handleCheckoutFormChange}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">Delivery Address *</label>
                    <textarea
                      name="address"
                      value={checkoutForm.address}
                      onChange={handleCheckoutFormChange}
                      placeholder="House/Flat No., Building Name, Street"
                      rows="3"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">City *</label>
                    <input
                      type="text"
                      name="city"
                      value={checkoutForm.city}
                      onChange={handleCheckoutFormChange}
                      placeholder="City"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">State *</label>
                    <input
                      type="text"
                      name="state"
                      value={checkoutForm.state}
                      onChange={handleCheckoutFormChange}
                      placeholder="State"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-450 uppercase tracking-wider">Pincode *</label>
                    <input
                      type="text"
                      name="pincode"
                      value={checkoutForm.pincode}
                      onChange={handleCheckoutFormChange}
                      placeholder="6-digit pincode"
                      maxLength="6"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Prescription Needed */}
              {hasPrescriptionItems() && (
                <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950/20 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2 border-b border-rose-50 dark:border-rose-950/25 pb-3">
                    <FaExclamationTriangle /> Prescription Required
                  </h2>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                      One or more medicines in your cart require a valid doctor's prescription. Please upload a clear image/document.
                    </p>

                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handlePrescriptionUpload}
                      id="prescription-upload"
                      className="hidden"
                    />
                    <label
                      htmlFor="prescription-upload"
                      className="flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-green-600 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all text-center"
                    >
                      {checkoutForm.prescription_file ? (
                        <div className="space-y-2">
                          <FaCheckCircle className="text-3xl text-emerald-500 mx-auto" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block break-all">{checkoutForm.prescription_file.name}</span>
                        </div>
                      ) : (
                        <div className="space-y-2 text-slate-400 dark:text-slate-500">
                          <FaBox className="text-3xl mx-auto" />
                          <span className="text-xs font-black uppercase tracking-wider block">Upload Prescription</span>
                          <span className="text-[10px] font-semibold text-slate-400/80 block">Supports PDF, JPG, PNG files</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              {}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                <h2 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/80 pb-3">
                  <FaCreditCard className="text-green-605" /> Payment Method
                </h2>

                <div className="space-y-3">
                  <label className={`flex items-start gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${
                    checkoutForm.payment_method === 'cash_on_delivery'
                      ? 'border-green-600 bg-green-50/5 dark:bg-green-950/5'
                      : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
                  }`}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="cash_on_delivery"
                      checked={checkoutForm.payment_method === 'cash_on_delivery'}
                      onChange={handleCheckoutFormChange}
                      className="mt-1 cursor-pointer accent-green-600"
                    />
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-805 flex items-center justify-center text-green-600 text-lg">
                        <FaMoneyBillWave />
                      </div>
                      <div>
                        <strong className="text-xs font-black text-slate-800 dark:text-white block uppercase tracking-wider">Cash on Delivery</strong>
                        <span className="text-[11px] font-medium text-slate-450 dark:text-slate-500 mt-0.5 block">Pay securely at your doorstep using cash or cards</span>
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${
                    checkoutForm.payment_method === 'online'
                      ? 'border-green-600 bg-green-50/5 dark:bg-green-950/5'
                      : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
                  }`}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="online"
                      checked={checkoutForm.payment_method === 'online'}
                      onChange={handleCheckoutFormChange}
                      className="mt-1 cursor-pointer accent-green-605"
                    />
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-805 flex items-center justify-center text-green-600 text-lg">
                        <FaCreditCard />
                      </div>
                      <div>
                        <strong className="text-xs font-black text-slate-800 dark:text-white block uppercase tracking-wider">Online Payment</strong>
                        <span className="text-[11px] font-medium text-slate-450 dark:text-slate-500 mt-0.5 block">Pay via Credit/Debit Cards, UPI, Net Banking, or Wallets</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm sticky top-24 space-y-6">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/80 pb-3">Order Summary</h3>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60 pr-2 nms-stores-scrollbar">
                  {cart.map(item => {
                    const medicine = item.medicine_details || {};
                    const price = parseFloat(medicine.price || item.price_at_addition || 0);
                    return (
                      <div key={item.id} className="py-3 flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-755 dark:text-slate-350 truncate">{medicine.name || 'Product'}</h4>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mt-0.5">Qty: {item.quantity}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">₹{(price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 border-t border-slate-50 dark:border-slate-800/85 pt-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>₹{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-xs font-bold text-emerald-500">
                      <span>Discount ({appliedCoupon.code})</span>
                      <span>-₹{calculateDiscount().toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Delivery Fee</span>
                    <span>
                      {calculateDeliveryFee() === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-wider">FREE</span>
                      ) : (
                        `₹${calculateDeliveryFee()}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-black text-slate-850 dark:text-white border-t border-slate-50 dark:border-slate-800 pt-3 mt-1">
                    <span>Total</span>
                    <span className="text-base">₹{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md border-none cursor-pointer transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                >
                  {submitting ? 'Processing...' : <><FaCheckCircle /> Place Order</>}
                </button>

                <div className="flex justify-around items-center pt-4 border-t border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <div className="flex items-center gap-1"><FaShieldAlt /> Secure</div>
                  <div className="flex items-center gap-1"><FaTruck /> Fast Ship</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white text-xl shadow-md">
              <FaShoppingCart />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Shopping Cart</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Manage your selected items ({cart.length})</p>
            </div>
          </div>
          <button
            onClick={clearCart}
            disabled={loading}
            className="self-end sm:self-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100/60 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border-none cursor-pointer flex items-center gap-1.5"
          >
            <FaTrash /> Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {}
          <div className="lg:col-span-2 space-y-4">
            {cart.map(item => {
              const medicine = item.medicine_details || {};
              const price = parseFloat(medicine.price || item.price_at_addition || 0);
              const mrp   = parseFloat(medicine.mrp || 0);

              return (
                <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between relative group">
                  <div className="flex items-center gap-4 flex-1">
                    <CartItemImage item={item} />
                    <div className="space-y-1.5 min-w-0">
                      <h3
                        onClick={() => navigate(`/pharmacy/product/${item.medicine}`)}
                        className="text-xs font-black text-slate-800 dark:text-white truncate cursor-pointer hover:text-green-605 transition-colors uppercase tracking-tight"
                      >
                        {medicine.name || 'Product'}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {medicine.category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                            {medicine.category.replace(/_/g, ' ')}
                          </span>
                        )}
                        {medicine.requires_prescription && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900">
                            <FaExclamationTriangle /> Prescription Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-805 p-1 rounded-xl self-end sm:self-auto border border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={item.quantity <= 1 || loading}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-600 text-xs font-black flex items-center justify-center border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaMinus />
                    </button>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 min-w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={item.quantity >= (medicine.stock_quantity || 100) || loading}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-600 text-xs font-black flex items-center justify-center border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaPlus />
                    </button>
                  </div>

                  {}
                  <div className="flex flex-col items-end min-w-24 self-end sm:self-auto">
                    <span className="text-sm font-black text-slate-900 dark:text-white">₹{(price * item.quantity).toFixed(2)}</span>
                    {mrp > 0 && mrp > price && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold line-through mt-0.5">₹{(mrp * item.quantity).toFixed(2)}</span>
                    )}
                  </div>

                  {}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={loading}
                    className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center border-none cursor-pointer transition-colors"
                    title="Remove Item"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                </div>
              );
            })}
          </div>

          {}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm sticky top-24 space-y-6">
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/80 pb-3">Order Summary</h2>

              {}
              <div className="space-y-3 pb-5 border-b border-slate-50 dark:border-slate-800/80">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={appliedCoupon !== null}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-green-600 transition-all dark:text-white uppercase placeholder:normal-case"
                  />
                  {appliedCoupon ? (
                    <button
                      onClick={removeCoupon}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100/60 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={applyCoupon}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {appliedCoupon && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    <FaTag /> Coupon "{appliedCoupon.code}" Applied
                  </div>
                )}
              </div>

              {}
              <div className="space-y-2 pb-5 border-b border-slate-50 dark:border-slate-800/80">
                <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Subtotal ({cart.length} items)</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-xs font-bold text-emerald-500">
                    <span>Coupon Discount</span>
                    <span>-₹{calculateDiscount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Delivery Fee</span>
                  <span>
                    {calculateDeliveryFee() === 0 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-wider">FREE</span>
                    ) : (
                      `₹${calculateDeliveryFee()}`
                    )}
                  </span>
                </div>

                {calculateDeliveryFee() > 0 && calculateSubtotal() < 500 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-slate-800/40 text-blue-600 dark:text-blue-400 rounded-2xl text-[10px] font-semibold mt-3">
                    <FaTruck /> <span>Add ₹{(500 - calculateSubtotal()).toFixed(2)} more for FREE delivery</span>
                  </div>
                )}
              </div>

              {}
              <div className="flex justify-between items-center text-sm font-black text-slate-850 dark:text-white pt-1">
                <span>Total Amount</span>
                <span className="text-base">₹{calculateTotal().toFixed(2)}</span>
              </div>

              <button
                onClick={() => setShowCheckout(true)}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md border-none cursor-pointer transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                Proceed to Checkout <FaArrowRight />
              </button>

              {}
              <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <div className="flex items-center gap-2"><FaShieldAlt className="text-green-600 text-xs" /> 100% Authentic Products</div>
                <div className="flex items-center gap-2"><FaTruck className="text-green-600 text-xs" /> Fast & Secure Delivery</div>
                <div className="flex items-center gap-2"><FaPercent className="text-green-600 text-xs" /> Best Prices Guaranteed</div>
              </div>

              <button
                onClick={() => navigate('/pharmacy/browse')}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-805 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-400 font-black text-xs uppercase tracking-wider rounded-xl border-none cursor-pointer transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShoppingCart;