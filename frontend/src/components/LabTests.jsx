import React, { useState, useEffect } from 'react';
import { 
  FaFlask, 
  FaSearch, 
  FaCalendarAlt, 
  FaClock, 
  FaHome, 
  FaBuilding, 
  FaUser, 
  FaPhone, 
  FaEnvelope, 
  FaMapMarkerAlt, 
  FaCheckCircle, 
  FaArrowRight, 
  FaArrowLeft, 
  FaTimes, 
  FaClipboardList, 
  FaDownload, 
  FaShieldAlt, 
  FaInfoCircle,
  FaHeartbeat,
  FaUserCheck,
  FaFileMedical,
  FaLock,
  FaVial,
  FaPlus,
  FaEdit,
  FaTrash
} from 'react-icons/fa';
import { labTestsAPI, authAPI } from '../services/api';
import './LabTests.css';

// Fallback Catalog of Available Lab Tests (used if backend is empty)
const FALLBACK_CATALOG = [
  {
    id: 'cbc-01',
    name: 'Complete Blood Count (CBC)',
    category: 'General Health',
    price: 299,
    description: 'Evaluates overall health and detects a wide range of disorders, including anemia, infection, and leukemia.',
    preparation: 'No fasting required. Avoid heavy meals 2 hours before.',
    parameters: 18,
    theme_color: 'teal',
    is_active: true
  },
  {
    id: 'lipid-02',
    name: 'Lipid Profile (Cholesterol)',
    category: 'Heart Health',
    price: 399,
    description: 'Measures cholesterol and triglyceride levels in your blood to assess cardiovascular health.',
    preparation: 'Overnight fasting required for 10-12 hours. Water is allowed.',
    parameters: 8,
    theme_color: 'rose',
    is_active: true
  },
  {
    id: 'hba1c-03',
    name: 'HbA1c & Blood Glucose',
    category: 'Diabetes Care',
    price: 349,
    description: 'Indicates average blood sugar levels over the past 2-3 months to diagnose and manage diabetes.',
    preparation: 'No fasting required. Can be done at any time of day.',
    parameters: 2,
    theme_color: 'amber',
    is_active: true
  },
  {
    id: 'thyroid-04',
    name: 'Thyroid Profile (T3, T4, TSH)',
    category: 'General Health',
    price: 499,
    description: 'Evaluates thyroid gland function and helps diagnose thyroid disorders like hypo/hyperthyroidism.',
    preparation: 'Overnight fasting recommended. Take sample in the morning.',
    parameters: 3,
    theme_color: 'teal',
    is_active: true
  },
  {
    id: 'kft-05',
    name: 'Kidney Function Test (KFT)',
    category: 'Kidney & Liver',
    price: 449,
    description: 'Evaluates kidney health by measuring urea, creatinine, uric acid, and key electrolytes.',
    preparation: 'No fasting required. Avoid high-protein meals before.',
    parameters: 9,
    theme_color: 'blue',
    is_active: true
  },
  {
    id: 'lft-06',
    name: 'Liver Function Test (LFT)',
    category: 'Kidney & Liver',
    price: 449,
    description: 'Measures liver enzymes, proteins, and bilirubin to evaluate general liver function and health.',
    preparation: 'Overnight fasting required for 10-12 hours.',
    parameters: 11,
    theme_color: 'blue',
    is_active: true
  },
  {
    id: 'basic-07',
    name: 'Basic Wellness Package',
    category: 'Wellness Packages',
    price: 999,
    description: 'Essential wellness check including CBC, Kidney Profile, Liver Profile, and Glucose levels.',
    preparation: 'Overnight fasting required (10-12 hours).',
    parameters: 45,
    theme_color: 'purple',
    is_active: true
  },
  {
    id: 'comp-08',
    name: 'Comprehensive Smart Health Package',
    category: 'Wellness Packages',
    price: 1499,
    description: 'Full body health screening including CBC, Lipid Profile, Thyroid, Kidney, Liver, and Urine Routine.',
    preparation: 'Overnight fasting required (10-12 hours).',
    parameters: 62,
    theme_color: 'indigo',
    is_active: true
  }
];

const TIME_SLOTS = [
  '07:00 AM - 09:00 AM',
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
  '05:00 PM - 07:00 PM'
];

export default function LabTests() {
  const currentUser = authAPI.getCurrentUser();
  const isAdmin = currentUser?.is_staff || currentUser?.is_superuser || currentUser?.user_type === 'admin';
  
  // Navigation states
  const [activeTab, setActiveTab] = useState('book'); // 'book', 'bookings', or 'manage'
  
  // Dynamic Catalog State
  const [labTestsCatalog, setLabTestsCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Cart & Booking Wizard states
  const [selectedTests, setSelectedTests] = useState([]);
  const [bookingStep, setBookingStep] = useState(1); // 1: Select, 2: Details, 3: Schedule, 4: Review, 5: Payment, 6: Success
  
  // Booking Form State
  const [patientDetails, setPatientDetails] = useState({
    name: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : '',
    phone: currentUser?.phone_number || '',
    email: currentUser?.email || '',
    age: '',
    gender: 'Male'
  });
  
  const [collectionDetails, setCollectionDetails] = useState({
    type: 'home', // 'home' or 'walk_in'
    address: currentUser?.address || '',
    pincode: currentUser?.pincode || ''
  });
  
  const [scheduleDetails, setScheduleDetails] = useState({
    date: '',
    timeSlot: ''
  });

  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle', 'processing', 'completed'
  const [successBookingData, setSuccessBookingData] = useState(null);
  
  // Bookings List States
  const [userBookings, setUserBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingDetailModal, setBookingDetailModal] = useState(null);
  const [guestPhoneSearch, setGuestPhoneSearch] = useState('');
  const [searchedGuestBookings, setSearchedGuestBookings] = useState(false);

  // Admin Catalog Management States
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null); // null if creating
  const [testForm, setTestForm] = useState({
    name: '',
    category: 'General Health',
    price: '',
    description: '',
    preparation: '',
    parameters: 1,
    theme_color: 'teal',
    is_active: true
  });

  // Fetch catalog on mount
  useEffect(() => {
    loadCatalog();
  }, []);

  // Load bookings if tab changes
  useEffect(() => {
    if (activeTab === 'bookings' && currentUser) {
      fetchBookings();
    }
  }, [activeTab]);

  const loadCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const response = await labTestsAPI.getAvailableTests();
      if (Array.isArray(response) && response.length > 0) {
        setLabTestsCatalog(response);
      } else {
        setLabTestsCatalog(FALLBACK_CATALOG);
      }
    } catch (err) {
      console.error("Error loading lab tests catalog:", err);
      setLabTestsCatalog(FALLBACK_CATALOG);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchBookings = async () => {
    setIsLoadingBookings(true);
    try {
      const response = await labTestsAPI.getBookings();
      setUserBookings(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const fetchGuestBookings = async () => {
    if (!guestPhoneSearch || guestPhoneSearch.length < 10) {
      alert("Please enter a valid 10-digit phone number");
      return;
    }
    setIsLoadingBookings(true);
    try {
      const response = await labTestsAPI.getBookings({ phone: guestPhoneSearch });
      setUserBookings(Array.isArray(response) ? response : []);
      setSearchedGuestBookings(true);
    } catch (err) {
      console.error("Error fetching guest bookings:", err);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Toggle test in selection
  const handleToggleTest = (test) => {
    if (selectedTests.some(t => t.id === test.id)) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const calculateTotal = () => {
    return selectedTests.reduce((sum, test) => sum + test.price, 0);
  };

  // Form Validations
  const handleNextStep = () => {
    if (bookingStep === 1) {
      if (selectedTests.length === 0) {
        alert("Please select at least one lab test to proceed.");
        return;
      }
      setBookingStep(2);
    } else if (bookingStep === 2) {
      if (!patientDetails.name.trim() || !patientDetails.phone.trim() || !patientDetails.age) {
        alert("Please fill in Name, Phone, and Age.");
        return;
      }
      if (patientDetails.phone.length < 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
      }
      setBookingStep(3);
    } else if (bookingStep === 3) {
      if (collectionDetails.type === 'home' && (!collectionDetails.address.trim() || !collectionDetails.pincode.trim())) {
        alert("Please fill in sample collection Address and Pincode.");
        return;
      }
      if (!scheduleDetails.date || !scheduleDetails.timeSlot) {
        alert("Please select a convenient Date and Time Slot.");
        return;
      }
      setBookingStep(4);
    }
  };

  // Handle Mock Payment & API Submission
  const handleConfirmAndPay = async () => {
    setBookingStep(5);
    setPaymentStatus('processing');
    
    // Simulate payment processing screen (2 seconds delay)
    setTimeout(async () => {
      try {
        const payload = {
          patient_name: patientDetails.name,
          patient_phone: patientDetails.phone,
          patient_email: patientDetails.email,
          patient_age: parseInt(patientDetails.age),
          patient_gender: patientDetails.gender,
          tests: selectedTests.map(t => ({ id: t.id, name: t.name, price: t.price, category: t.category })),
          booking_date: scheduleDetails.date,
          booking_time_slot: scheduleDetails.timeSlot,
          collection_type: collectionDetails.type,
          address: collectionDetails.type === 'home' ? collectionDetails.address : '',
          pincode: collectionDetails.type === 'home' ? collectionDetails.pincode : '',
          total_price: calculateTotal(),
          status: 'confirmed'
        };

        const response = await labTestsAPI.createBooking(payload);
        setSuccessBookingData(response);
        setPaymentStatus('completed');
        setBookingStep(6);
        
        setSelectedTests([]);
        setScheduleDetails({ date: '', timeSlot: '' });
      } catch (err) {
        console.error("Booking API error:", err);
        alert("Failed to submit booking request. Details: " + err.message);
        setBookingStep(4);
      }
    }, 2000);
  };

  const handleCancelBooking = async (id) => {
    if (window.confirm("Are you sure you want to cancel this lab test booking?")) {
      try {
        await labTestsAPI.cancelBooking(id);
        alert("Booking cancelled successfully.");
        if (bookingDetailModal) {
          setBookingDetailModal({ ...bookingDetailModal, status: 'cancelled' });
        }
        fetchBookings();
      } catch (err) {
        console.error("Error cancelling booking:", err);
        alert("Error: " + err.message);
      }
    }
  };

  // Admin Catalog CRUD operations
  const openManageModal = (test = null) => {
    if (test) {
      setEditingTest(test);
      setTestForm({
        name: test.name || '',
        category: test.category || 'General Health',
        price: test.price || '',
        description: test.description || '',
        preparation: test.preparation || '',
        parameters: test.parameters || 1,
        theme_color: test.theme_color || 'teal',
        is_active: test.is_active !== false
      });
    } else {
      setEditingTest(null);
      setTestForm({
        name: '',
        category: 'General Health',
        price: '',
        description: '',
        preparation: '',
        parameters: 1,
        theme_color: 'teal',
        is_active: true
      });
    }
    setManageModalOpen(true);
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (!testForm.name.trim() || !testForm.price || !testForm.category.trim()) {
      alert("Name, Price, and Category are required.");
      return;
    }
    try {
      const payload = {
        ...testForm,
        price: parseInt(testForm.price),
        parameters: parseInt(testForm.parameters)
      };

      if (editingTest) {
        await labTestsAPI.updateTest(editingTest.id, payload);
        alert("Lab test updated successfully.");
      } else {
        await labTestsAPI.createTest(payload);
        alert("Lab test created successfully.");
      }
      setManageModalOpen(false);
      loadCatalog();
    } catch (err) {
      console.error("Error saving test catalog item:", err);
      alert("Failed to save catalog item: " + err.message);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (window.confirm("Are you sure you want to permanently delete this lab test from the catalog?")) {
      try {
        await labTestsAPI.deleteTest(testId);
        alert("Lab test deleted successfully.");
        loadCatalog();
      } catch (err) {
        console.error("Error deleting test catalog item:", err);
        alert("Failed to delete catalog item: " + err.message);
      }
    }
  };

  // Filter Categories
  const categories = ['All', 'General Health', 'Diabetes Care', 'Heart Health', 'Kidney & Liver', 'Wellness Packages'];
  
  const filteredCatalog = labTestsCatalog.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          test.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || test.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeClass = (themeColor) => {
    switch (themeColor) {
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      default:
        return 'bg-teal-50 text-teal-700 border-teal-100';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      {/* Premium Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 px-4 py-8 sm:px-6 md:py-16 text-white rounded-b-[2rem] shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15)_0%,transparent_50%)] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-wide uppercase backdrop-blur-md mb-4 animate-pulse-border">
                <FaFlask /> No Circle Membership Required
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2 sm:mb-3">
                Diagnostic Lab Tests <span className="text-teal-200">& Packages</span>
              </h1>
              <p className="text-teal-50 text-sm sm:text-base md:text-lg max-w-2xl font-medium leading-relaxed">
                Book professional clinical laboratory tests from the comfort of your home. Free sample collection & certified smart reports within 24 hours.
              </p>
            </div>
            <div className="flex flex-wrap w-full lg:w-auto gap-2.5 sm:gap-4 mt-2 lg:mt-0">
              <button 
                onClick={() => { setActiveTab('book'); setBookingStep(1); }}
                className={`flex-1 lg:flex-none text-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'book' ? 'bg-white text-teal-800 shadow-md scale-105' : 'bg-teal-700/40 text-white border border-teal-500/20 hover:bg-teal-700'}`}
              >
                Book a Test
              </button>
              <button 
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 lg:flex-none text-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'bookings' ? 'bg-white text-teal-800 shadow-md scale-105' : 'bg-teal-700/40 text-white border border-teal-500/20 hover:bg-teal-700'}`}
              >
                My Bookings
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab('manage')}
                  className={`flex-1 lg:flex-none text-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${activeTab === 'manage' ? 'bg-white text-teal-800 shadow-md scale-105' : 'bg-teal-700/40 text-white border border-teal-500/20 hover:bg-teal-700'}`}
                >
                  Manage Catalog
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'book' && (
          <div>
            {bookingStep === 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Catalog Left */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Free Booking Banner */}
                  <div className="flex items-start sm:items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-lg flex-shrink-0">
                      <FaUserCheck />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-amber-950 text-xs sm:text-sm">Open Booking Policy</h4>
                      <p className="text-amber-800 text-[11px] sm:text-xs font-medium leading-relaxed">Unlike other services, this feature is accessible to all users. No circle membership, subscription, or registration card is required to place your booking.</p>
                    </div>
                  </div>

                  {/* Search and Category Filter Toolbar */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/60 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:flex-1">
                      <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-base" />
                      <input 
                        type="text" 
                        placeholder="Search for CBC, Blood Sugar, Cholesterol, etc..." 
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm sm:text-base bg-slate-50/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex w-full overflow-x-auto gap-2 py-1 scrollbar-none md:w-auto">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20' : 'bg-slate-100 text-slate-600 border border-slate-200/50 hover:bg-slate-200/50 hover:text-slate-800'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Test Cards Grid */}
                  {isLoadingCatalog ? (
                    <div className="text-center py-20">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600 mb-3"></div>
                      <p className="text-slate-500 text-sm font-semibold">Loading diagnostics catalog...</p>
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                      <FaFlask className="mx-auto text-4xl text-slate-300 mb-2" />
                      <h4 className="font-bold text-slate-700 text-base">No Matching Tests Found</h4>
                      <p className="text-slate-400 text-xs sm:text-sm mt-1">Try expanding your search query or choosing another category tab.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {filteredCatalog.map(test => {
                        const isSelected = selectedTests.some(t => t.id === test.id);
                        return (
                          <div key={test.id} className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 hover:border-teal-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
                            <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-slate-50/50 group-hover:bg-teal-50/30 transition-all duration-300 animate-ripple-circle pointer-events-none"></div>
                            
                            <div className="relative z-10">
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 border ${getCategoryBadgeClass(test.theme_color || test.themeColor)}`}>
                                {test.category}
                              </span>
                              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 group-hover:text-teal-800 transition-colors">{test.name}</h3>
                              <p className="text-slate-500 text-xs sm:text-sm mb-4 leading-relaxed">{test.description}</p>
                              
                              <div className="space-y-2 mb-5">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                                  <FaVial className="text-teal-600 flex-shrink-0" />
                                  <span>{test.parameters} Parameters Checked</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-500">
                                  <FaInfoCircle className="text-amber-500 mt-0.5 flex-shrink-0" />
                                  <span className="leading-tight">{test.preparation}</span>
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Price</span>
                                <span className="text-lg sm:text-xl font-extrabold text-slate-800">₹{test.price}</span>
                              </div>
                              <button
                                onClick={() => handleToggleTest(test)}
                                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all duration-200 ${isSelected ? 'bg-teal-700 border-teal-700 text-white shadow-md shadow-teal-700/20' : 'border-teal-600 text-teal-600 hover:bg-teal-600 hover:text-white'}`}
                              >
                                {isSelected ? 'Selected ✓' : 'Add Test'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Side Cart Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm lg:sticky lg:top-24 h-fit">
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                      <FaFlask className="text-teal-600" /> Selected Tests ({selectedTests.length})
                    </h3>
                    
                    {selectedTests.length === 0 ? (
                      <div className="text-center py-8 sm:py-12 text-slate-400">
                        <FaFlask className="mx-auto text-4xl mb-3 opacity-30 text-slate-300" />
                        <p className="font-semibold text-xs sm:text-sm">No tests selected yet.</p>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">Select diagnostic tests from the catalog to build your order.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="max-h-52 sm:max-h-60 overflow-y-auto pr-1 space-y-2">
                          {selectedTests.map(test => (
                            <div key={test.id} className="flex items-center justify-between py-2 border-b border-dashed border-slate-100 text-xs sm:text-sm">
                              <span className="font-semibold text-slate-700 max-w-[70%] truncate">{test.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-slate-900">₹{test.price}</span>
                                <button 
                                  onClick={() => handleToggleTest(test)}
                                  className="text-red-400 hover:text-red-600 transition p-1"
                                >
                                  <FaTimes size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 space-y-2">
                          <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-semibold">₹{calculateTotal()}</span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                            <span>Home sample collection</span>
                            <span className="text-teal-600 font-bold">FREE</span>
                          </div>
                          <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-sm sm:text-base font-extrabold text-slate-800">
                            <span>Total Payable</span>
                            <span className="text-teal-700">₹{calculateTotal()}</span>
                          </div>
                        </div>

                        <button
                          onClick={handleNextStep}
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          Proceed to Book <FaArrowRight />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Steps Booking Wizard Card */
              <div className="max-w-2xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-sm">
                  {/* Step indicators */}
                  <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${bookingStep >= 2 ? 'bg-teal-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      2
                    </div>
                    <div className={`h-0.5 flex-1 max-w-[40px] sm:max-w-[60px] transition-all ${bookingStep > 2 ? 'bg-teal-700' : 'bg-slate-200'}`}></div>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${bookingStep >= 3 ? 'bg-teal-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      3
                    </div>
                    <div className={`h-0.5 flex-1 max-w-[40px] sm:max-w-[60px] transition-all ${bookingStep > 3 ? 'bg-teal-700' : 'bg-slate-200'}`}></div>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${bookingStep >= 4 ? 'bg-teal-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      4
                    </div>
                  </div>

                  {/* Step 2: Patient Details */}
                  {bookingStep === 2 && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Patient Information</h3>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Enter the health record details for the patient undergoing the lab tests.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Patient Full Name *</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                            placeholder="Enter full name"
                            value={patientDetails.name}
                            onChange={(e) => setPatientDetails({ ...patientDetails, name: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Phone Number *</label>
                          <input 
                            type="tel" 
                            className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                            placeholder="10-digit mobile number"
                            maxLength={10}
                            value={patientDetails.phone}
                            onChange={(e) => setPatientDetails({ ...patientDetails, phone: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Age (Years) *</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                            placeholder="Patient age"
                            value={patientDetails.age}
                            onChange={(e) => setPatientDetails({ ...patientDetails, age: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Gender *</label>
                          <select 
                            className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50"
                            value={patientDetails.gender}
                            onChange={(e) => setPatientDetails({ ...patientDetails, gender: e.target.value })}
                          >
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs sm:text-sm font-bold text-slate-700">Email Address (Optional)</label>
                        <input 
                          type="email" 
                          className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                          placeholder="To receive soft copy report PDF"
                          value={patientDetails.email}
                          onChange={(e) => setPatientDetails({ ...patientDetails, email: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
                        <button
                          onClick={() => setBookingStep(1)}
                          className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition text-sm"
                        >
                          <FaArrowLeft /> Back to Catalog
                        </button>
                        <button
                          onClick={handleNextStep}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-sm shadow-md"
                        >
                          Continue <FaArrowRight />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Schedule & Collection Method */}
                  {bookingStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Collection & Schedule</h3>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Choose how the samples should be collected and select a preferred slot.</p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-bold text-slate-700 block">Sample Collection Method *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div 
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 flex items-center gap-4 ${collectionDetails.type === 'home' ? 'border-teal-600 bg-teal-50/30' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            onClick={() => setCollectionDetails({ ...collectionDetails, type: 'home' })}
                          >
                            <FaHome className={collectionDetails.type === 'home' ? 'text-teal-600' : 'text-slate-400'} size={24} />
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Home Blood Collection</h4>
                              <p className="text-slate-500 text-[10px] sm:text-xs mt-0.5">Phlebotomist visits your home.</p>
                            </div>
                          </div>

                          <div 
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 flex items-center gap-4 ${collectionDetails.type === 'walk_in' ? 'border-teal-600 bg-teal-50/30' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            onClick={() => setCollectionDetails({ ...collectionDetails, type: 'walk_in' })}
                          >
                            <FaBuilding className={collectionDetails.type === 'walk_in' ? 'text-teal-600' : 'text-slate-400'} size={24} />
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Walk-in to Lab Center</h4>
                              <p className="text-slate-500 text-[10px] sm:text-xs mt-0.5">Visit nearest rural center.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {collectionDetails.type === 'home' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <label className="text-xs sm:text-sm font-bold text-slate-700">Sample Collection Address *</label>
                            <input 
                              type="text" 
                              className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                              placeholder="House No, Road, Village/Sector"
                              value={collectionDetails.address}
                              onChange={(e) => setCollectionDetails({ ...collectionDetails, address: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs sm:text-sm font-bold text-slate-700">Pincode *</label>
                            <input 
                              type="text" 
                              className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                              placeholder="6-digit pincode"
                              maxLength={6}
                              value={collectionDetails.pincode}
                              onChange={(e) => setCollectionDetails({ ...collectionDetails, pincode: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Appointment Date *</label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm sm:text-base transition-all bg-slate-50/50" 
                            min={new Date().toISOString().split('T')[0]}
                            value={scheduleDetails.date}
                            onChange={(e) => setScheduleDetails({ ...scheduleDetails, date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-700">Select Time Slot *</label>
                          <div className="grid grid-cols-2 gap-2">
                            {TIME_SLOTS.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${scheduleDetails.timeSlot === slot ? 'bg-teal-700 border-teal-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600'}`}
                                onClick={() => setScheduleDetails({ ...scheduleDetails, timeSlot: slot })}
                              >
                                {slot.split(' - ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
                        <button
                          onClick={() => setBookingStep(2)}
                          className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition text-sm"
                        >
                          <FaArrowLeft /> Back to Details
                        </button>
                        <button
                          onClick={handleNextStep}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-sm shadow-md"
                        >
                          Continue <FaArrowRight />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Summary & Checkout Confirmation */}
                  {bookingStep === 4 && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Review & Confirm</h3>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Verify your details before scheduling secure checkout.</p>
                      </div>
                      
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 p-4 border-b border-slate-200">
                          <h4 className="font-bold text-slate-700 text-xs sm:text-sm">Booking Overview</h4>
                        </div>
                        
                        <div className="p-4 sm:p-5 space-y-4">
                          {/* Test list */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Tests</span>
                            <div className="space-y-1.5">
                              {selectedTests.map(t => (
                                <div key={t.id} className="flex justify-between text-xs sm:text-sm">
                                  <span className="font-semibold text-slate-700">{t.name}</span>
                                  <span className="font-extrabold text-slate-900">₹{t.price}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Patient info */}
                          <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patient Details</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-700 block mt-1">{patientDetails.name}</span>
                              <span className="text-[11px] text-slate-500">Age: {patientDetails.age} | {patientDetails.gender}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Number</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-700 block mt-1">{patientDetails.phone}</span>
                            </div>
                          </div>

                          {/* Slot info */}
                          <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Schedule Slot</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-700 block mt-1">{scheduleDetails.date}</span>
                              <span className="text-[11px] text-slate-500">{scheduleDetails.timeSlot}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sample Collection</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-700 block mt-1 capitalize">{collectionDetails.type.replace('_', ' ')}</span>
                              {collectionDetails.type === 'home' && (
                                <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">{collectionDetails.address} ({collectionDetails.pincode})</span>
                              )}
                            </div>
                          </div>

                          {/* Total block */}
                          <div className="bg-teal-50/50 rounded-xl p-3 sm:p-4 border border-teal-100/50 flex justify-between items-center mt-4">
                            <div>
                              <span className="text-xs sm:text-sm font-bold text-teal-800">Total Payable Amount</span>
                              <p className="text-[10px] text-teal-600 mt-0.5">Secure payment processing verified</p>
                            </div>
                            <span className="text-xl sm:text-2xl font-extrabold text-teal-700">₹{calculateTotal()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 text-slate-400 text-[11px] sm:text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                        <FaLock className="text-teal-600 mt-0.5 flex-shrink-0" />
                        <span>By confirming, you authorize Rural HealthCare diagnostics partners to collect blood samples at the scheduled time. Secure 256-bit SSL encryption.</span>
                      </div>

                      <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
                        <button
                          onClick={() => setBookingStep(3)}
                          className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition text-sm"
                        >
                          <FaArrowLeft /> Edit Schedule
                        </button>
                        <button
                          onClick={handleConfirmAndPay}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3 px-6 sm:px-8 rounded-xl transition shadow-lg shadow-teal-600/20 flex items-center gap-2 text-sm"
                        >
                          Confirm Booking <FaArrowRight />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Secure Payment Processing Overlay */}
                  {bookingStep === 5 && (
                    <div className="text-center py-12 sm:py-16 space-y-4">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-4 border-b-4 border-teal-600"></div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Processing Booking request</h3>
                      <p className="text-slate-500 text-xs sm:text-sm mt-2 max-w-sm mx-auto leading-relaxed">Please do not refresh or close this tab. We are validating laboratory availability and booking your slot...</p>
                    </div>
                  )}

                  {/* Step 6: Successful Booking Receipt */}
                  {bookingStep === 6 && successBookingData && (
                    <div className="text-center py-4 space-y-6">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto text-2xl sm:text-3xl">
                        <FaCheckCircle />
                      </div>
                      
                      <div className="space-y-1">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Booking Confirmed!</h2>
                        <p className="text-slate-500 text-xs sm:text-sm">Your Diagnostic Lab Test order has been successfully scheduled.</p>
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 text-left max-w-lg mx-auto space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between border-b border-slate-200 pb-3 mb-2 gap-1 sm:gap-0">
                          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Booking Reference ID</span>
                          <span className="text-xs font-mono font-bold text-slate-700 break-all">{successBookingData.id}</span>
                        </div>

                        <div className="space-y-2 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Patient Name:</span>
                            <span className="font-bold text-slate-800">{successBookingData.patient_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Appointment Date:</span>
                            <span className="font-bold text-slate-800">{successBookingData.booking_date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Time Slot:</span>
                            <span className="font-bold text-slate-800">{successBookingData.booking_time_slot}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Collection Type:</span>
                            <span className="font-bold text-slate-800 capitalize">{successBookingData.collection_type}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-2">
                            <span className="text-slate-500 font-medium">Total Price Paid:</span>
                            <span className="font-extrabold text-teal-700 text-base">₹{successBookingData.total_price}</span>
                          </div>
                        </div>

                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-[11px] sm:text-xs text-teal-800 flex gap-2.5">
                          <FaInfoCircle className="flex-shrink-0 mt-0.5 text-teal-600" />
                          <span>A phlebotomist will contact you on <strong>{successBookingData.patient_phone}</strong> to confirm the exact arrival time at your location.</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button
                          onClick={() => {
                            setActiveTab('bookings');
                            fetchBookings();
                          }}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 sm:py-3 px-6 rounded-xl transition text-sm shadow-md"
                        >
                          View My Bookings
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTests([]);
                            setBookingStep(1);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 sm:py-3 px-6 rounded-xl transition text-sm"
                        >
                          Book Another Test
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          /* Bookings History Tab */
          <div className="space-y-6">
            {/* If Guest, let them search by Phone Number */}
            {!currentUser && (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl">
                  <FaClipboardList />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">Track Guest Bookings</h4>
                  <p className="text-slate-500 text-[11px] sm:text-xs mt-1">Enter the patient mobile number used during booking to track status & download reports.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    className="flex-1 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs sm:text-sm bg-slate-50/50"
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    value={guestPhoneSearch}
                    onChange={(e) => setGuestPhoneSearch(e.target.value)}
                  />
                  <button
                    onClick={fetchGuestBookings}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
                  >
                    Track
                  </button>
                </div>
              </div>
            )}

            {isLoadingBookings ? (
              <div className="text-center py-16 sm:py-20 space-y-3">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-600"></div>
                <p className="text-slate-500 text-xs sm:text-sm font-semibold">Fetching booking history...</p>
              </div>
            ) : userBookings.length === 0 ? (
              <div className="max-w-md mx-auto text-center py-12 sm:py-16 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                <FaClipboardList className="mx-auto text-4xl sm:text-5xl text-slate-300" />
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800">No Bookings Found</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">
                    {searchedGuestBookings ? "No active lab test bookings associated with this phone number." : "You have not scheduled any lab test appointments yet."}
                  </p>
                </div>
                <button
                  onClick={() => { setActiveTab('book'); setBookingStep(1); }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-5 sm:px-6 rounded-xl transition text-xs sm:text-sm shadow-sm"
                >
                  Schedule Your First Test
                </button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="mb-6">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">My Appointment History</h3>
                  <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Click on any appointment to view complete details, status updates, or download digital report files.</p>
                </div>
                
                <div className="space-y-3">
                  {userBookings.map(booking => (
                    <div 
                      key={booking.id} 
                      onClick={() => setBookingDetailModal(booking)}
                      className="bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
                          <FaFlask />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-extrabold text-slate-800 text-sm sm:text-base truncate">
                            {booking.tests && booking.tests.length > 0 
                              ? booking.tests.map(t => t.name).join(', ') 
                              : 'Diagnostic Lab Test'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-2.5 text-[10px] sm:text-xs text-slate-400">
                            <span className="font-semibold text-slate-500">Ref: #{booking.id.substring(0, 8)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="flex items-center gap-1"><FaCalendarAlt /> {booking.booking_date}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="flex items-center gap-1"><FaClock /> {booking.booking_time_slot.split(' - ')[0]}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block sm:hidden">Price</span>
                          <span className="font-extrabold text-slate-800 text-sm sm:text-base">₹{booking.total_price}</span>
                        </div>
                        
                        <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold text-center capitalize min-w-[80px] ${
                          booking.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          booking.status === 'confirmed' ? 'bg-sky-100 text-sky-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && isAdmin && (
          /* Admin Catalog Management Tab */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800">Manage Diagnostics Catalog</h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Directly configure diagnostic catalog packages, pricing structures, and test metadata.</p>
              </div>
              <button
                onClick={() => openManageModal(null)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-xl transition text-xs sm:text-sm shadow-md flex items-center gap-2"
              >
                <FaPlus /> Add New Test
              </button>
            </div>

            {isLoadingCatalog ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600 mb-3"></div>
                <p className="text-slate-500 text-sm">Fetching catalog list...</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Test details</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Price</th>
                        <th className="p-4">Params Checked</th>
                        <th className="p-4">Catalog Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {labTestsCatalog.map(test => (
                        <tr key={test.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{test.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-sm sm:max-w-md">{test.description}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeClass(test.theme_color || 'teal')}`}>
                              {test.category}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-700">₹{test.price}</td>
                          <td className="p-4 text-slate-500 font-semibold">{test.parameters} Parameters</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${test.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                              {test.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2.5">
                              <button
                                onClick={() => openManageModal(test)}
                                className="text-teal-600 hover:text-teal-800 font-bold p-2 rounded-lg transition hover:bg-teal-50 flex items-center gap-1 text-xs"
                              >
                                <FaEdit /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTest(test.id)}
                                className="text-red-500 hover:text-red-700 font-bold p-2 rounded-lg transition hover:bg-red-50 flex items-center gap-1 text-xs"
                              >
                                <FaTrash /> Delete
                              </button>
                            </div>
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
      </div>

      {/* Booking Details Dialog Modal */}
      {bookingDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <FaFileMedical className="text-teal-600" /> Booking Details
              </h3>
              <button 
                onClick={() => setBookingDetailModal(null)}
                className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-100"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
              {/* Reference */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Reference ID</span>
                <span className="text-xs font-mono font-bold text-slate-700 break-all">{bookingDetailModal.id}</span>
              </div>

              {/* Status Tracker */}
              <div className="space-y-3">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Booking Status Timeline</span>
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center flex-1">
                    <div className="w-7 h-7 sm:w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">✓</div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 mt-1.5">Confirmed</span>
                  </div>
                  <div className="h-0.5 bg-teal-600 flex-1 mx-1.5"></div>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 sm:w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      ['completed'].includes(bookingDetailModal.status) ? 'bg-teal-600 text-white' : 
                      bookingDetailModal.status === 'cancelled' ? 'bg-red-400 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {['completed'].includes(bookingDetailModal.status) ? '✓' : '2'}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 mt-1.5">
                      {bookingDetailModal.status === 'cancelled' ? 'Cancelled' : 'In Progress'}
                    </span>
                  </div>
                  <div className={`h-0.5 flex-1 mx-1.5 ${bookingDetailModal.status === 'completed' ? 'bg-teal-600' : 'bg-slate-200'}`}></div>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 sm:w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      bookingDetailModal.status === 'completed' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {bookingDetailModal.status === 'completed' ? '✓' : '3'}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1.5">Report Ready</span>
                  </div>
                </div>
              </div>

              {/* Patient Details */}
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Patient</span>
                  <span className="font-bold text-slate-700 block mt-1">{bookingDetailModal.patient_name}</span>
                  <span className="text-[11px] text-slate-500">Age: {bookingDetailModal.patient_age} | {bookingDetailModal.patient_gender}</span>
                </div>
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Contact Phone</span>
                  <span className="font-bold text-slate-700 block mt-1">{bookingDetailModal.patient_phone}</span>
                </div>
              </div>

              {/* Slot & Collection Details */}
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Schedule</span>
                  <span className="font-bold text-slate-700 block mt-1">{bookingDetailModal.booking_date}</span>
                  <span className="text-[11px] text-slate-500">{bookingDetailModal.booking_time_slot}</span>
                </div>
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Collection Method</span>
                  <span className="font-bold text-slate-700 block mt-1 capitalize">{bookingDetailModal.collection_type.replace('_', ' ')}</span>
                  {bookingDetailModal.collection_type === 'home' && (
                    <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">{bookingDetailModal.address}</span>
                  )}
                </div>
              </div>

              {/* Tests */}
              <div className="space-y-2">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Booked Lab Tests</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs sm:text-sm">
                  {bookingDetailModal.tests && bookingDetailModal.tests.map(t => (
                    <div key={t.id} className="p-3 bg-slate-50/50 flex justify-between">
                      <span className="font-semibold text-slate-700">{t.name}</span>
                      <span className="font-bold text-slate-800">₹{t.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total block */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-100 gap-4">
                <div className="flex-1">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 block">Total Price Paid</span>
                  <span className="text-base sm:text-lg font-extrabold text-slate-900 block">₹{bookingDetailModal.total_price}</span>
                </div>

                {/* If completed, let them download mock report */}
                {bookingDetailModal.status === 'completed' ? (
                  <button 
                    onClick={() => {
                      alert("Downloading Digital Clinical Laboratory Report PDF...");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 sm:px-5 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-sm"
                  >
                    <FaDownload /> Download Report
                  </button>
                ) : bookingDetailModal.status !== 'cancelled' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancelBooking(bookingDetailModal.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2 px-3 sm:px-4 rounded-xl text-xs transition"
                    >
                      Cancel Booking
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const updated = await apiRequest(`/lab-test-bookings/${bookingDetailModal.id}/`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'completed' })
                          });
                          setBookingDetailModal(updated);
                          fetchBookings();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold py-2 px-3 sm:px-4 rounded-xl text-xs transition"
                    >
                      Complete Test (Demo)
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Catalog Item Modal */}
      {manageModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-filter backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <FaFlask className="text-teal-600" /> {editingTest ? 'Edit Lab Test Details' : 'Add New Lab Test'}
              </h3>
              <button 
                onClick={() => setManageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-100"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700">Lab Test / Package Name *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-medium"
                  placeholder="e.g. Complete Blood Count (CBC)"
                  value={testForm.name}
                  onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-bold text-slate-700">Category *</label>
                  <select 
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-medium"
                    value={testForm.category}
                    onChange={(e) => setTestForm({ ...testForm, category: e.target.value })}
                  >
                    <option>General Health</option>
                    <option>Diabetes Care</option>
                    <option>Heart Health</option>
                    <option>Kidney & Liver</option>
                    <option>Wellness Packages</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-bold text-slate-700">Price (INR) *</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-semibold"
                    placeholder="e.g. 299"
                    value={testForm.price}
                    onChange={(e) => setTestForm({ ...testForm, price: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-bold text-slate-700">Parameters Checked *</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-semibold"
                    placeholder="e.g. 18"
                    value={testForm.parameters}
                    onChange={(e) => setTestForm({ ...testForm, parameters: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-bold text-slate-700">Color Badge Theme *</label>
                  <select 
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-medium"
                    value={testForm.theme_color}
                    onChange={(e) => setTestForm({ ...testForm, theme_color: e.target.value })}
                  >
                    <option value="teal">Teal (General Health)</option>
                    <option value="rose">Rose (Heart Health)</option>
                    <option value="amber">Amber (Diabetes Care)</option>
                    <option value="blue">Blue (Kidney & Liver)</option>
                    <option value="purple">Purple (Wellness Basic)</option>
                    <option value="indigo">Indigo (Wellness Smart)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700">Description *</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-medium"
                  placeholder="Describe the diagnostic value and what this test evaluates..."
                  value={testForm.description}
                  onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
                ></textarea>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-700">Patient Preparation Instructions</label>
                <textarea 
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all bg-slate-50/50 font-medium"
                  placeholder="e.g. Overnight fasting recommended for 10-12 hours."
                  value={testForm.preparation}
                  onChange={(e) => setTestForm({ ...testForm, preparation: e.target.value })}
                ></textarea>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <input 
                  type="checkbox"
                  id="testActiveStatus"
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                  checked={testForm.is_active}
                  onChange={(e) => setTestForm({ ...testForm, is_active: e.target.checked })}
                />
                <label htmlFor="testActiveStatus" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Make active and visible in the public booking catalog immediately
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManageModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-md text-xs sm:text-sm"
                >
                  {editingTest ? 'Save Changes' : 'Create Lab Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Fetch helper using the default auth credentials
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`http://localhost:8000/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    ...options
  });
  return response.json();
}
