import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUserPlus,
  FaVials,
  FaHeartbeat,
  FaUsers,
  FaHistory,
  FaClipboardList,
  FaPlus,
  FaFileMedical,
  FaSearch,
  FaChevronRight,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaCheckCircle,
  FaTimes,
  FaStethoscope,
  FaUserMd
} from 'react-icons/fa';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const AshaDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [poctHistory, setPoctHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const [registerForm, setRegisterForm] = useState({
    phone_number: '',
    first_name: '',
    last_name: '',
    email: '',
    gender: 'male',
    date_of_birth: '',
    blood_group: 'A+',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [testForm, setTestForm] = useState({
    patient_id: '',
    test_type: 'hemoglobin',
    results: {},
    notes: '',
    test_strip_image: null
  });

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState({
    booking_date: '',
    booking_time_slot: '09:00 - 10:00',
    reason: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/auth');
      return;
    }
    const userData = JSON.parse(storedUser);
    if (userData.user_type !== 'ashaworker') {
      navigate('/auth');
      return;
    }
    setUser(userData);
    fetchPatients();
    fetchDoctors();
  }, [navigate]);

  useEffect(() => {
    if (selectedPatient) {
      fetchPoctHistory(selectedPatient.id);
    }
  }, [selectedPatient]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/asha/patients/`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      } else {
        showNotification('Failed to fetch patients list', 'error');
      }
    } catch (err) {
      showNotification('Connection error while fetching patients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/doctors/`);
      if (response.ok) {
        const data = await response.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPoctHistory = async (patientId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/asha/patients/${patientId}/poct-history/`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setPoctHistory(data);
      }
    } catch (err) {
      showNotification('Failed to load patient test history', 'error');
    }
  };

  const handleRegisterChange = (e) => {
    setRegisterForm({
      ...registerForm,
      [e.target.name]: e.target.value
    });
  };

  const handleTestFormChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('result_')) {
      const field = name.replace('result_', '');
      setTestForm({
        ...testForm,
        results: {
          ...testForm.results,
          [field]: value
        }
      });
    } else {
      setTestForm({
        ...testForm,
        [name]: value
      });
    }
  };

  const handleFileChange = (e) => {
    setTestForm({
      ...testForm,
      test_strip_image: e.target.files[0]
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/asha/register-patient/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders()
        },
        body: JSON.stringify(registerForm)
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Patient enrolled successfully');
        fetchPatients();
        setRegisterForm({
          phone_number: '',
          first_name: '',
          last_name: '',
          email: '',
          gender: 'male',
          date_of_birth: '',
          blood_group: 'A+',
          address: '',
          city: '',
          state: '',
          pincode: ''
        });
        setActiveTab('patients');
      } else {
        showNotification(data.error || 'Failed to enroll patient', 'error');
      }
    } catch (err) {
      showNotification('Network error during patient registration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.append('patient_id', testForm.patient_id);
    formData.append('test_type', testForm.test_type);
    formData.append('results', JSON.stringify(testForm.results));
    formData.append('notes', testForm.notes);
    if (testForm.test_strip_image) {
      formData.append('test_strip_image', testForm.test_strip_image);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/asha/record-poct/`, {
        method: 'POST',
        headers: getHeaders(),
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Point-of-care test logged successfully');
        if (selectedPatient && selectedPatient.id === testForm.patient_id) {
          fetchPoctHistory(selectedPatient.id);
        }
        setTestForm({
          patient_id: '',
          test_type: 'hemoglobin',
          results: {},
          notes: '',
          test_strip_image: null
        });
        setActiveTab('patients');
      } else {
        showNotification(data.error || 'Failed to log test results', 'error');
      }
    } catch (err) {
      showNotification('Network error while logging test', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !selectedDoctor) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/appointments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders()
        },
        body: JSON.stringify({
          patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          patient_phone: selectedPatient.phone_number,
          doctor: selectedDoctor.id,
          preferred_date: appointmentForm.booking_date,
          preferred_time: appointmentForm.booking_time_slot,
          symptoms: appointmentForm.reason,
          status: 'pending'
        })
      });
      if (response.ok) {
        showNotification('Consultation appointment scheduled successfully');
        setSelectedDoctor(null);
        setAppointmentForm({
          booking_date: '',
          booking_time_slot: '09:00 - 10:00',
          reason: ''
        });
        setActiveTab('patients');
      } else {
        showNotification('Failed to book appointment', 'error');
      }
    } catch (err) {
      showNotification('Error scheduling appointment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/auth');
  };

  const filteredPatients = patients.filter(p => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const phone = p.phone_number.toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || phone.includes(query);
  });

  const getAlertStatus = (test) => {
    const type = test.test_type;
    const res = test.results;
    if (type === 'hemoglobin' && parseFloat(res.hemoglobin_level) < 10) {
      return 'critical';
    }
    if (type === 'glucose' && parseFloat(res.glucose_level) > 180) {
      return 'critical';
    }
    if (type === 'urine_protein' && res.protein !== 'Negative' && res.protein !== 'Trace') {
      return 'warning';
    }
    if (['malaria', 'covid', 'dengue'].includes(type) && res.result && res.result !== 'Negative') {
      return 'critical';
    }
    return 'normal';
  };

  const getTestLabel = (type) => {
    const labels = {
      hemoglobin: 'Hemoglobin (Hb)',
      glucose: 'Blood Glucose',
      urine_protein: 'Urine Protein',
      malaria: 'Malaria RDT',
      covid: 'COVID-19 RDT',
      dengue: 'Dengue RDT',
      pregnancy: 'Pregnancy Test (uHCG)'
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border transition-all duration-300 animate-slide-in ${
          notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {notification.type === 'error' ? <FaTimes className="text-rose-500" /> : <FaCheckCircle className="text-emerald-500" />}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      <header className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <FaStethoscope className="text-xl text-teal-300" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                ASHA Portal <span className="text-[10px] bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-400/30">Rural Access</span>
              </h1>
              {user && (
                <p className="text-[10px] sm:text-[11px] text-teal-200/80 font-medium mt-0.5 line-clamp-1">
                  Village: {user.village_name || 'Rural Health Unit'} | Block: {user.block_name || 'District Block'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold">{user.full_name}</p>
                <p className="text-[10px] text-teal-200/70 font-semibold">{user.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white hover:text-rose-300 border border-white/10 hover:border-rose-500/20 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer"
            >
              <FaSignOutAlt />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</h2>
            <nav className="flex flex-col sm:grid sm:grid-cols-3 lg:flex lg:flex-col gap-2">
              <button
                onClick={() => { setActiveTab('patients'); setSelectedPatient(null); }}
                className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'patients'
                    ? 'bg-teal-50 text-teal-700 border border-teal-500/20'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <FaUsers className="text-base" />
                <span>Patients List</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('register');
                  setSelectedPatient(null);
                }}
                className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-teal-50 text-teal-700 border border-teal-500/20'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <FaUserPlus className="text-base" />
                <span>Enroll Patient</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('poct');
                  setSelectedPatient(null);
                }}
                className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'poct'
                    ? 'bg-teal-50 text-teal-700 border border-teal-500/20'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <FaVials className="text-base" />
                <span>Log POCT Test</span>
              </button>
            </nav>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                <span className="text-2xl font-black text-slate-800">{patients.length}</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Patients</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                <span className="text-2xl font-black text-slate-800">
                  {patients.reduce((acc, p) => acc + (p.poct_tests?.length || 0), 0)}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Tests Logged</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 flex flex-col gap-6">
          {activeTab === 'patients' && (
            <>
              {!selectedPatient ? (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Assigned Rural Patients</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Enrolled patients from your assigned village area</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <FaSearch className="absolute left-3 text-slate-400 text-xs pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search patient name or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center text-xs font-bold text-slate-500">Loading patients list...</div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="p-12 text-center">
                      <FaUsers className="text-4xl text-slate-200 mx-auto mb-3" />
                      <h3 className="text-sm font-bold text-slate-700">No patients found</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Try typing a different name or enroll a new patient in the village</p>
                      <button
                        onClick={() => setActiveTab('register')}
                        className="mt-4 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
                      >
                        <FaUserPlus />
                        <span>Enroll New Patient</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="md:hidden divide-y divide-slate-100">
                        {filteredPatients.map(patient => (
                          <div key={patient.id} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{patient.first_name} {patient.last_name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{patient.gender.toUpperCase()} | DOB: {patient.date_of_birth || 'N/A'}</div>
                              </div>
                              <span className="bg-teal-50 border border-teal-100 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Blood: {patient.blood_group || 'N/A'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600 font-semibold bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Phone</span>
                                {patient.phone_number}
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Location</span>
                                {patient.city}, {patient.state}
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => setSelectedPatient(patient)}
                                className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-teal-600 text-slate-700 hover:text-white rounded-xl px-4 py-2.5 transition-all text-xs cursor-pointer font-bold"
                              >
                                <span>View History</span>
                                <FaChevronRight className="text-[9px]" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <th className="px-6 py-4">Name</th>
                              <th className="px-6 py-4">Contact</th>
                              <th className="px-6 py-4">Bio Info</th>
                              <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {filteredPatients.map(patient => (
                              <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-bold text-slate-900">{patient.first_name} {patient.last_name}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{patient.gender.toUpperCase()} | DOB: {patient.date_of_birth || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div>{patient.phone_number}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{patient.email || 'No email'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div>Blood: {patient.blood_group || 'N/A'}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{patient.city}, {patient.state}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => setSelectedPatient(patient)}
                                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-teal-600 text-slate-700 hover:text-white rounded-lg px-3 py-1.5 transition-all text-[11px] cursor-pointer font-bold"
                                  >
                                    <span>View History</span>
                                    <FaChevronRight className="text-[9px]" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                }
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-lg font-bold">
                        {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{selectedPatient.first_name} {selectedPatient.last_name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Phone: {selectedPatient.phone_number} | Blood: {selectedPatient.blood_group || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setTestForm({
                            ...testForm,
                            patient_id: selectedPatient.id
                          });
                          setActiveTab('poct');
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 flex items-center gap-1.5 text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
                      >
                        <FaPlus />
                        <span>Log POCT Test</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedDoctor(null);
                          setAppointmentForm({
                            booking_date: '',
                            booking_time_slot: '09:00 - 10:00',
                            reason: ''
                          });
                          setActiveTab('doctor-booking');
                        }}
                        className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-4 py-2 flex items-center gap-1.5 text-xs font-bold transition-all shadow-md shadow-sky-600/10 cursor-pointer"
                      >
                        <FaHeartbeat />
                        <span>Consult Doctor</span>
                      </button>

                      <button
                        onClick={() => setSelectedPatient(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <FaHistory className="text-teal-600" />
                        <span>Point-of-Care Test History</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">Logged rapid tests, values, and notes</p>
                    </div>

                    {poctHistory.length === 0 ? (
                      <div className="p-12 text-center text-xs font-bold text-slate-500">
                        No rapid diagnostics recorded for this patient yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {poctHistory.map(test => {
                          const alert = getAlertStatus(test);
                          return (
                            <div key={test.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-1.5 max-w-xl">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    {getTestLabel(test.test_type)}
                                  </span>
                                  {alert === 'critical' && (
                                    <span className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      <FaExclamationTriangle className="text-[9px]" /> Critical
                                    </span>
                                  )}
                                  {alert === 'warning' && (
                                    <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      <FaExclamationTriangle className="text-[9px]" /> Warning
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-800 font-bold">
                                  Results:{' '}
                                  {Object.entries(test.results).map(([key, val]) => (
                                    <span key={key} className="bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5 mr-2">
                                      {key.replace('_', ' ')}: {val}
                                    </span>
                                  ))}
                                </div>
                                {test.notes && <p className="text-xs text-slate-500 italic">Notes: {test.notes}</p>}
                                <div className="text-[10px] text-slate-400 font-bold">Logged at: {new Date(test.created_at).toLocaleString()}</div>
                              </div>
                              {test.test_strip_image && (
                                <div className="w-24 h-24 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner self-start sm:self-center">
                                  <img
                                    src={test.test_strip_image}
                                    alt="Test Strip"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'register' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FaUserPlus className="text-teal-600" />
                <span>Enroll Rural Patient</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-medium">Add patient details to register them under your care in the rural network</p>

              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                    <input
                      type="text"
                      name="phone_number"
                      value={registerForm.phone_number}
                      onChange={handleRegisterChange}
                      placeholder="10 digit phone number"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Email Address (Optional)</label>
                    <input
                      type="email"
                      name="email"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      placeholder="Email address"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">First Name</label>
                    <input
                      type="text"
                      name="first_name"
                      value={registerForm.first_name}
                      onChange={handleRegisterChange}
                      placeholder="Patient's first name"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Last Name</label>
                    <input
                      type="text"
                      name="last_name"
                      value={registerForm.last_name}
                      onChange={handleRegisterChange}
                      placeholder="Patient's last name"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Gender</label>
                    <select
                      name="gender"
                      value={registerForm.gender}
                      onChange={handleRegisterChange}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Date of Birth</label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={registerForm.date_of_birth}
                      onChange={handleRegisterChange}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Blood Group</label>
                    <select
                      name="blood_group"
                      value={registerForm.blood_group}
                      onChange={handleRegisterChange}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={registerForm.pincode}
                      onChange={handleRegisterChange}
                      placeholder="6 digit pincode"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Street Address</label>
                    <input
                      type="text"
                      name="address"
                      value={registerForm.address}
                      onChange={handleRegisterChange}
                      placeholder="House number, landmark, village area"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">City / Village</label>
                      <input
                        type="text"
                        name="city"
                        value={registerForm.city}
                        onChange={handleRegisterChange}
                        placeholder="Village or nearest city"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">State</label>
                      <input
                        type="text"
                        name="state"
                        value={registerForm.state}
                        onChange={handleRegisterChange}
                        placeholder="State"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('patients')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Registering...' : 'Complete Enrollment'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'poct' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FaVials className="text-teal-600" />
                <span>Log Point-of-Care Test (POCT)</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-medium">Record diagnostics results taken directly in the field using rapid screening kits</p>

              <form onSubmit={handleTestSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Select Patient</label>
                    <select
                      name="patient_id"
                      value={testForm.patient_id}
                      onChange={handleTestFormChange}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      required
                    >
                      <option value="">Choose a patient...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} ({p.phone_number})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Test Type</label>
                    <select
                      name="test_type"
                      value={testForm.test_type}
                      onChange={handleTestFormChange}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      required
                    >
                      <option value="hemoglobin">Hemoglobin (Hb)</option>
                      <option value="glucose">Blood Glucose</option>
                      <option value="urine_protein">Urine Protein</option>
                      <option value="malaria">Malaria RDT</option>
                      <option value="covid">COVID-19 RDT</option>
                      <option value="dengue">Dengue RDT</option>
                      <option value="pregnancy">Pregnancy Test (uHCG)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Result Parameters</h3>

                  {testForm.test_type === 'hemoglobin' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Hemoglobin Level (g/dL)</label>
                        <input
                          type="number"
                          step="0.1"
                          name="result_hemoglobin_level"
                          onChange={handleTestFormChange}
                          placeholder="e.g. 12.5"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {testForm.test_type === 'glucose' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Glucose Level (mg/dL)</label>
                        <input
                          type="number"
                          name="result_glucose_level"
                          onChange={handleTestFormChange}
                          placeholder="e.g. 110"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Measurement State</label>
                        <select
                          name="result_state"
                          onChange={handleTestFormChange}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          required
                        >
                          <option value="Random">Random (RBS)</option>
                          <option value="Fasting">Fasting (FBS)</option>
                          <option value="Post-Prandial">Post-Prandial (PPBS)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {testForm.test_type === 'urine_protein' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Protein Level</label>
                        <select
                          name="result_protein"
                          onChange={handleTestFormChange}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          required
                        >
                          <option value="Negative">Negative</option>
                          <option value="Trace">Trace</option>
                          <option value="1+">1+</option>
                          <option value="2+">2+</option>
                          <option value="3+">3+</option>
                          <option value="4+">4+</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {['malaria', 'covid', 'pregnancy'].includes(testForm.test_type) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Test Result</label>
                        <select
                          name="result_result"
                          onChange={handleTestFormChange}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          required
                        >
                          <option value="Negative">Negative</option>
                          <option value="Positive">Positive</option>
                          <option value="Invalid">Invalid / No Line</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {testForm.test_type === 'dengue' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Dengue Result</label>
                        <select
                          name="result_result"
                          onChange={handleTestFormChange}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          required
                        >
                          <option value="Negative">Negative</option>
                          <option value="NS1 Positive">NS1 Positive</option>
                          <option value="IgG Positive">IgG Positive</option>
                          <option value="IgM Positive">IgM Positive</option>
                          <option value="IgG/IgM Positive">IgG/IgM Positive</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Test Strip Image (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full text-xs font-semibold text-slate-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Notes / Clinical Observations</label>
                    <textarea
                      name="notes"
                      value={testForm.notes}
                      onChange={handleTestFormChange}
                      placeholder="Add any extra symptoms observed or advice given..."
                      rows="3"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('patients')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Log Test Results'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'doctor-booking' && selectedPatient && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FaStethoscope className="text-teal-600" />
                <span>Launch Teleconsultation Appointment</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Connect <span className="text-slate-950 font-bold">{selectedPatient.first_name} {selectedPatient.last_name}</span> with a remote physician
              </p>

              {!selectedDoctor ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Available Doctor</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doctors.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctor(doc)}
                        className="border border-slate-200 hover:border-teal-500/55 rounded-2xl p-4 flex gap-4 cursor-pointer hover:bg-slate-50/40 transition-all"
                      >
                        <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
                          <FaUserMd />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900">{doc.user.first_name} {doc.user.last_name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{doc.specialization_display}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{doc.qualification}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Selected Doctor</p>
                      <h3 className="text-xs font-bold text-slate-900">{selectedDoctor.user.first_name} {selectedDoctor.user.last_name}</h3>
                      <p className="text-[10px] text-slate-500">{selectedDoctor.specialization_display} | {selectedDoctor.qualification}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDoctor(null)}
                      className="text-xs text-rose-600 hover:underline font-bold"
                    >
                      Change Doctor
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Booking Date</label>
                      <input
                        type="date"
                        value={appointmentForm.booking_date}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, booking_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Time Slot</label>
                      <select
                        value={appointmentForm.booking_time_slot}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, booking_time_slot: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                        required
                      >
                        <option value="09:00 - 10:00">09:00 - 10:00</option>
                        <option value="10:00 - 11:00">10:00 - 11:00</option>
                        <option value="11:00 - 12:00">11:00 - 12:00</option>
                        <option value="14:00 - 15:00">14:00 - 15:00</option>
                        <option value="15:00 - 16:00">15:00 - 16:00</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Reason for Consultation</label>
                    <textarea
                      value={appointmentForm.reason}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                      placeholder="Mention chief complaints, symptoms, or POCT abnormalities..."
                      rows="3"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                      required
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab('patients')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Scheduling...' : 'Schedule Appointment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AshaDashboard;
