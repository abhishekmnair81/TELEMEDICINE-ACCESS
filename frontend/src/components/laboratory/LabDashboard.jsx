import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaFlask,
  FaSignOutAlt,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaCheckCircle,
  FaClipboardList,
  FaFilePdf,
  FaFileUpload,
  FaUser,
  FaBoxes,
  FaArrowRight,
  FaChevronRight,
  FaSearch,
  FaVials
} from 'react-icons/fa';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const LabDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('unclaimed'); // unclaimed, active, completed
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Authenticate and fetch user profile
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (!storedUser || !token) {
      navigate('/auth?type=laboratory&view=login');
      return;
    }

    const userData = JSON.parse(storedUser);
    if (userData.user_type !== 'laboratory') {
      navigate('/auth?type=laboratory&view=login');
      return;
    }
    setUser(userData);
    fetchBookings();
  }, [navigate]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch bookings list
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/lab-test-bookings/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      } else {
        showNotification('Failed to load bookings list', 'error');
      }
    } catch (err) {
      console.error('Fetch bookings error:', err);
      showNotification('Server connection failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Claim a booking
  const handleClaim = async (bookingId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/lab-test-bookings/${bookingId}/claim/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showNotification('Task successfully claimed and added to your workload');
        fetchBookings();
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to claim task', 'error');
      }
    } catch (err) {
      showNotification('Network error while claiming task', 'error');
    }
  };

  // Mark sample collected
  const handleCollect = async (bookingId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/lab-test-bookings/${bookingId}/collect/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showNotification('Sample marked as successfully collected');
        fetchBookings();
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to update collection status', 'error');
      }
    } catch (err) {
      showNotification('Network error updating status', 'error');
    }
  };

  // Handle file select
  const handleFileChange = (e, bookingId) => {
    setSelectedFile(e.target.files[0]);
    setUploadingId(bookingId);
  };

  // Upload report and complete test
  const handleUploadReport = async (bookingId) => {
    if (!selectedFile) {
      showNotification('Please select a PDF report file first', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('report_file', selectedFile);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/lab-test-bookings/${bookingId}/upload-report/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        showNotification('Report PDF successfully uploaded. Booking completed!');
        setSelectedFile(null);
        setUploadingId(null);
        fetchBookings();
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to upload report file', 'error');
      }
    } catch (err) {
      showNotification('Network error uploading file', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/auth?type=laboratory&view=login');
  };

  // Filter bookings based on active tab and search
  const filteredBookings = bookings.filter(b => {
    // Tab check
    let matchesTab = false;
    if (activeTab === 'unclaimed') {
      matchesTab = b.collection_type === 'home' && !b.assigned_technician && (b.status === 'pending' || b.status === 'confirmed');
    } else if (activeTab === 'active') {
      matchesTab = b.assigned_technician === user?.id && (b.status === 'confirmed' || b.status === 'collected');
    } else if (activeTab === 'completed') {
      matchesTab = b.assigned_technician === user?.id && b.status === 'completed';
    }

    if (!matchesTab) return false;

    // Search query check
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      b.patient_name?.toLowerCase().includes(query) ||
      b.patient_phone?.includes(query) ||
      b.address?.toLowerCase().includes(query) ||
      b.pincode?.includes(query) ||
      (b.tests && b.tests.some(t => t.name?.toLowerCase().includes(query)))
    );
  });

  // Calculate statistics
  const unclaimedCount = bookings.filter(b => b.collection_type === 'home' && !b.assigned_technician && (b.status === 'pending' || b.status === 'confirmed')).length;
  const activeCount = bookings.filter(b => b.assigned_technician === user?.id && (b.status === 'confirmed' || b.status === 'collected')).length;
  const completedCount = bookings.filter(b => b.assigned_technician === user?.id && b.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md">
              <FaFlask className="text-xl animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-800">RHC Lab Diagnostics</span>
              <span className="ml-2 px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full uppercase tracking-wider">Technician Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">{user.full_name || user.username}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Enrolled Phlebotomist</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-200 cursor-pointer"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Notification banner */}
      {notification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
            notification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span className="text-xs font-bold leading-relaxed">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Section */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl flex items-center justify-center text-xl">
              <FaClipboardList />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unclaimed Pools</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{unclaimedCount}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-teal-50 text-teal-600 border border-teal-200 rounded-xl flex items-center justify-center text-xl">
              <FaVials />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Jobs</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{activeCount}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl flex items-center justify-center text-xl">
              <FaCheckCircle />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed Reports</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{completedCount}</h3>
            </div>
          </div>
        </section>

        {/* Tab Selection & Search bar */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl self-start">
            <button
              onClick={() => setActiveTab('unclaimed')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'unclaimed'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Unclaimed Tasks ({unclaimedCount})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              My Workload ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              My Archives ({completedCount})
            </button>
          </div>

          <div className="relative flex items-center max-w-sm w-full">
            <FaSearch className="absolute left-3.5 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search by patient, address, test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold focus:outline-none transition-all placeholder-slate-400"
            />
          </div>
        </section>

        {/* Task lists */}
        <section className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xs font-bold text-slate-500">Retrieving diagnostic data...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-2xl text-slate-400 mx-auto mb-4">
                <FaBoxes />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Collection Bookings Found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">There are no diagnostic tasks matching this status or filters in your region.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredBookings.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                  
                  <div>
                    {/* Header info */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                            <FaUser />
                          </span>
                          <h4 className="text-sm font-black text-slate-800">{b.patient_name}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {b.patient_gender ? `${b.patient_gender.toUpperCase()} • ` : ''}{b.patient_age ? `${b.patient_age} Years` : ''}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 text-[9px] font-extrabold rounded-full uppercase tracking-wider ${
                        b.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'collected'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : b.status === 'confirmed'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {b.status === 'collected' ? 'Sample Collected' : b.status}
                      </span>
                    </div>

                    {/* Schedule and tests */}
                    <div className="space-y-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-600">
                        <FaCalendarAlt className="text-xs flex-shrink-0" />
                        <span className="text-[11px] font-bold">{b.booking_date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <FaClock className="text-xs flex-shrink-0" />
                        <span className="text-[11px] font-bold">{b.booking_time_slot}</span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600 pt-1 border-t border-slate-200/60">
                        <FaMapMarkerAlt className="text-xs flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] font-semibold leading-relaxed">
                          {b.address || 'Walk-in to local facility'}, {b.pincode}
                        </span>
                      </div>
                    </div>

                    {/* Tests requested */}
                    <div className="mb-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prescribed Tests</p>
                      <div className="flex flex-wrap gap-1.5">
                        {b.tests && b.tests.map((t, idx) => (
                          <span key={idx} className="px-2 py-1 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-[10px] shadow-sm">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Patient Contacts */}
                    <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between gap-4 text-slate-500">
                      <div className="flex items-center gap-1">
                        <FaPhone className="text-[10px]" />
                        <a href={`tel:${b.patient_phone}`} className="text-[11px] font-semibold hover:underline text-slate-600">{b.patient_phone}</a>
                      </div>
                      {b.patient_email && (
                        <div className="flex items-center gap-1 truncate max-w-[150px]">
                          <FaEnvelope className="text-[10px]" />
                          <span className="text-[11px] font-semibold truncate">{b.patient_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Billing</span>
                      <span className="text-sm font-black text-slate-800">₹{b.total_price}</span>
                    </div>

                    {/* unclaimed actions */}
                    {activeTab === 'unclaimed' && (
                      <button
                        onClick={() => handleClaim(b.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        Claim Collection <FaArrowRight />
                      </button>
                    )}

                    {/* active actions */}
                    {activeTab === 'active' && b.status === 'confirmed' && (
                      <button
                        onClick={() => handleCollect(b.id)}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        Mark Collected <FaCheckCircle />
                      </button>
                    )}

                    {/* report upload actions */}
                    {activeTab === 'active' && b.status === 'collected' && (
                      <div className="flex flex-col items-end gap-2 w-full max-w-[220px]">
                        <input
                          type="file"
                          accept=".pdf"
                          id={`file-upload-${b.id}`}
                          className="hidden"
                          onChange={(e) => handleFileChange(e, b.id)}
                        />
                        <label
                          htmlFor={`file-upload-${b.id}`}
                          className="w-full text-center px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FaFileUpload /> {uploadingId === b.id && selectedFile ? selectedFile.name : 'Select PDF Report'}
                        </label>
                        {uploadingId === b.id && selectedFile && (
                          <button
                            onClick={() => handleUploadReport(b.id)}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            Submit & Complete <FaCheckCircle />
                          </button>
                        )}
                      </div>
                    )}

                    {/* completed actions */}
                    {activeTab === 'completed' && b.report_file && (
                      <a
                        href={b.report_file}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
                      >
                        <FaFilePdf className="text-red-500" /> View Report
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default LabDashboard;
