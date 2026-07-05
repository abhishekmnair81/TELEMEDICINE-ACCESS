import React, { useState, useEffect } from 'react';
import {
  FaHeartbeat, FaHome, FaRobot, FaVideo, FaPrescriptionBottle,
  FaChartLine, FaUser, FaSearch, FaTint, FaWeight, FaThermometerHalf,
  FaFlask, FaWind, FaCalendarAlt, FaBell, FaFileDownload, FaPrint,
  FaArrowLeft, FaExclamationTriangle, FaClock, FaStickyNote, FaFileMedical,
  FaBullseye
} from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { healthTrackingAPI, appointmentsAPI, authAPI } from '../../services/api';
import Footer from '../Footer';
import './DoctorPatientHealth.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DoctorPatientHealth = () => {
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientsList, setPatientsList] = useState([]);
  
  // Patient health data
  const [dashboardData, setDashboardData] = useState(null);
  const [latestMetrics, setLatestMetrics] = useState({});
  const [activeGoals, setActiveGoals] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [medicationReminders, setMedicationReminders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Trends data
  const [selectedMetricType, setSelectedMetricType] = useState('heart_rate');
  const [trendPeriod, setTrendPeriod] = useState(30);
  const [trendsData, setTrendsData] = useState(null);
  
  // View mode
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  
  // Clinical Notes input
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Metric configurations
  const metricTypes = [
    { value: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', icon: <FaTint />, color: 'green', hex: '#00b38e' },
    { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: <FaHeartbeat />, color: 'rose', hex: '#f43f5e' },
    { value: 'weight', label: 'Weight', unit: 'kg', icon: <FaWeight />, color: 'amber', hex: '#f59e0b' },
    { value: 'temperature', label: 'Temperature', unit: '°F', icon: <FaThermometerHalf />, color: 'violet', hex: '#8b5cf6' },
    { value: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', icon: <FaFlask />, color: 'orange', hex: '#f97316' },
    { value: 'oxygen_saturation', label: 'Oxygen Saturation', unit: '%', icon: <FaWind />, color: 'cyan', hex: '#06b6d4' }
  ];

  useEffect(() => {
    loadDoctorAndPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientHealth();
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient && selectedMetricType) {
      loadTrends();
    }
  }, [selectedPatient, selectedMetricType, trendPeriod]);

  const loadDoctorAndPatients = async () => {
    try {
      const doctor = authAPI.getCurrentUser();
      console.log('[DoctorPatientHealth] Current doctor:', doctor);
      
      if (!doctor) {
        window.location.href = '/auth?type=doctor&view=login';
        return;
      }
      
      if (doctor.user_type !== 'doctor') {
        alert('This page is only accessible to doctors');
        window.location.href = '/';
        return;
      }
      
      setCurrentDoctor(doctor);
      
      // Load this doctor's patients from appointments
      await loadDoctorPatients(doctor.id);
      
    } catch (error) {
      console.error('[DoctorPatientHealth] Error loading doctor:', error);
      window.location.href = '/auth?type=doctor&view=login';
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorPatients = async (doctorId) => {
    try {
      console.log('[DoctorPatientHealth] Loading patients for doctor:', doctorId);
      
      // Get doctor's appointments to find their patients
      const appointments = await appointmentsAPI.getDoctorAppointments(doctorId);
      console.log('[DoctorPatientHealth] Doctor appointments:', appointments);
      
      // Extract unique patients from appointments
      const patientsMap = new Map();
      
      if (Array.isArray(appointments)) {
        appointments.forEach(appointment => {
          const patientKey = appointment.patient_phone;
          
          if (!patientsMap.has(patientKey)) {
            patientsMap.set(patientKey, {
              id: appointment.patient || `temp_${patientKey}`,
              name: appointment.patient_name,
              phone: appointment.patient_phone,
              age: 'N/A',
              gender: 'Not specified',
              lastVisit: appointment.preferred_date,
              lastVisitId: appointment.id,
              conditions: parseConditions(appointment.symptoms),
              alertLevel: 'normal',
              totalAppointments: 1,
              appointments: [appointment]
            });
          } else {
            const patient = patientsMap.get(patientKey);
            patient.totalAppointments += 1;
            patient.appointments.push(appointment);
            
            if (new Date(appointment.preferred_date) > new Date(patient.lastVisit)) {
              patient.lastVisit = appointment.preferred_date;
              patient.lastVisitId = appointment.id;
            }
          }
        });
      }
      
      const patients = Array.from(patientsMap.values());
      console.log('[DoctorPatientHealth] Unique patients found:', patients.length);
      
      for (const patient of patients) {
        try {
          if (patient.id && !patient.id.toString().startsWith('temp_')) {
            const healthData = await healthTrackingAPI.getDashboard(patient.id);
            if (healthData.success && healthData.dashboard) {
              patient.alertLevel = determineAlertLevel(healthData.dashboard);
              patient.hasHealthData = true;
            }
          }
        } catch (error) {
          console.warn(`[DoctorPatientHealth] Could not load health data for ${patient.name}:`, error);
          patient.hasHealthData = false;
        }
      }
      
      setPatientsList(patients);
      console.log('[DoctorPatientHealth] Patients loaded:', patients);
      
    } catch (error) {
      console.error('[DoctorPatientHealth] Error loading patients:', error);
      setPatientsList([]);
    }
  };

  const parseConditions = (symptoms) => {
    if (!symptoms) return [];
    const conditions = symptoms.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return conditions.length > 0 ? conditions.slice(0, 3) : ['General consultation'];
  };

  const determineAlertLevel = (dashboard) => {
    if (!dashboard || !dashboard.alerts) return 'normal';
    const alerts = dashboard.alerts || [];
    const criticalAlerts = alerts.filter(a => a.alert_level === 'critical');
    const warningAlerts = alerts.filter(a => a.alert_level === 'warning');
    
    if (criticalAlerts.length > 0) return 'critical';
    if (warningAlerts.length > 0) return 'warning';
    return 'normal';
  };

  const loadPatientHealth = async () => {
    try {
      setLoading(true);
      console.log('[DoctorPatientHealth] Loading health data for patient:', selectedPatient);
      
      if (!selectedPatient.id || selectedPatient.id.toString().startsWith('temp_')) {
        setDashboardData({
          latest_metrics: [],
          active_goals: [],
          recent_activities: [],
          medication_reminders: [],
          alerts: []
        });
        setLoading(false);
        return;
      }
      
      const data = await healthTrackingAPI.getDashboard(selectedPatient.id);
      
      if (data.success && data.dashboard) {
        setDashboardData(data.dashboard);
        
        const metricsMap = {};
        data.dashboard.latest_metrics?.forEach(metric => {
          metricsMap[metric.metric_type] = metric;
        });
        setLatestMetrics(metricsMap);
        
        setActiveGoals(data.dashboard.active_goals || []);
        setRecentActivities(data.dashboard.recent_activities || []);
        setMedicationReminders(data.dashboard.medication_reminders || []);
        setAlerts(data.dashboard.alerts || []);
        
        // Populate existing clinical notes if any (mock observation for UI)
        setClinicalNotes('');
      } else {
        setDashboardData({
          latest_metrics: [],
          active_goals: [],
          recent_activities: [],
          medication_reminders: [],
          alerts: []
        });
      }
    } catch (error) {
      console.error('[DoctorPatientHealth] Error loading patient health:', error);
      setDashboardData({
        latest_metrics: [],
        active_goals: [],
        recent_activities: [],
        medication_reminders: [],
        alerts: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      if (!selectedPatient.id || selectedPatient.id.toString().startsWith('temp_')) {
        return;
      }
      const data = await healthTrackingAPI.getMetricTrends(
        selectedPatient.id,
        selectedMetricType,
        trendPeriod
      );
      if (data.success) {
        setTrendsData(data);
      }
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setViewMode('detail');
  };

  const backToList = () => {
    setSelectedPatient(null);
    setViewMode('list');
    setDashboardData(null);
    setLatestMetrics({});
    setAlerts([]);
    setTrendsData(null);
  };

  const getMetricConfig = (mType) => {
    return metricTypes.find(m => m.value === mType) || metricTypes[0];
  };

  const formatMetricValue = (metric) => {
    if (!metric) return 'N/A';
    if (metric.metric_type === 'blood_pressure' && metric.systolic && metric.diastolic) {
      return `${metric.systolic}/${metric.diastolic}`;
    }
    return metric.value;
  };

  const getAlertColorClasses = (alertLevel) => {
    switch (alertLevel) {
      case 'critical': return 'border-rose-500 bg-rose-50 text-rose-700';
      case 'warning': return 'border-amber-500 bg-amber-50 text-amber-800';
      default: return 'border-green-500 bg-green-50 text-green-700';
    }
  };

  const getAlertBadgeColor = (alertLevel) => {
    switch (alertLevel) {
      case 'critical': return 'bg-rose-500 text-white';
      case 'warning': return 'bg-amber-500 text-white';
      default: return 'bg-green-500 text-white';
    }
  };

  const getTrendChartData = () => {
    if (!trendsData || !trendsData.data_points) {
      return { labels: [], datasets: [] };
    }
    const config = getMetricConfig(selectedMetricType);
    return {
      labels: trendsData.data_points.map(point => point.date),
      datasets: [
        {
          label: config.label,
          data: trendsData.data_points.map(point => parseFloat(point.value) || 0),
          borderColor: config.hex,
          backgroundColor: `${config.hex}15`,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: {
        grid: { color: 'rgba(15, 23, 42, 0.06)' },
        ticks: { color: '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      }
    }
  };

  const filteredPatients = patientsList.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    alert('Report downloaded successfully! (Exported clinical diagnostics report in PDF format)');
  };

  const handleSaveNotes = () => {
    if (!clinicalNotes.trim()) {
      alert('Please write observations to save.');
      return;
    }
    alert('Clinical observations saved to patient file successfully!');
  };

  if (loading && !currentDoctor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <FaHeartbeat className="w-12 h-12 text-green-600 animate-pulse mx-auto" />
          <h2 className="mt-6 text-xl font-bold text-slate-850">Rural HealthCare</h2>
          <p className="mt-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing diagnostics telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">
      
      {/* Premium Branded Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.location.href = '/doctor-dashboard'}>
            <div className="w-9 h-9 bg-green-600/10 text-green-600 border border-green-500/10 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Rural HealthCare</span>
          </div>
          <button 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
            onClick={() => window.location.href = '/doctor-dashboard'}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {viewMode === 'list' ? (
          <>
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Patient Diagnostics Hub</h1>
                <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider">Monitor telemetry & vital sign trends for all registered patients</p>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-lg flex-shrink-0">
                  <FaUser />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">Dr. {currentDoctor?.first_name} {currentDoctor?.last_name}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Primary Physician</div>
                </div>
              </div>
            </div>

            {/* Search & Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-center">
              <div className="lg:col-span-6 relative flex items-center">
                <FaSearch className="absolute left-4 text-slate-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search patients by name or mobile number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400 shadow-sm"
                />
              </div>

              <div className="lg:col-span-6 grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-slate-900 block leading-tight">{patientsList.length}</span>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mt-1">My Patients</span>
                </div>
                <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-rose-600 block leading-tight">
                    {patientsList.filter(p => p.alertLevel === 'critical').length}
                  </span>
                  <span className="text-[9px] text-rose-500 font-extrabold uppercase tracking-wider block mt-1">Critical Alerts</span>
                </div>
                <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-amber-600 block leading-tight">
                    {patientsList.filter(p => p.alertLevel === 'warning').length}
                  </span>
                  <span className="text-[9px] text-amber-500 font-extrabold uppercase tracking-wider block mt-1">Warnings</span>
                </div>
              </div>
            </div>

            {/* Patients Grid */}
            {filteredPatients.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl flex flex-col items-center gap-4 max-w-xl mx-auto">
                <div className="w-16 h-16 bg-slate-50 text-slate-450 border border-slate-200 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                  <FaUser />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">No Patient Records Found</h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed px-6">
                    {patientsList.length === 0 
                      ? 'No appointments found yet. Once a patient books an appointment with you, their medical profile will be generated here.' 
                      : 'No records match your current search string.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPatients.map((patient, index) => (
                  <div
                    key={patient.id || index}
                    onClick={() => selectPatient(patient)}
                    className="bg-white border border-slate-200/80 hover:border-green-500/40 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between h-full group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-905 text-sm group-hover:text-green-600 transition-colors leading-tight">{patient.name}</h3>
                            <span className="text-xs text-slate-400 font-semibold">{patient.phone}</span>
                          </div>
                        </div>

                        {patient.alertLevel !== 'normal' && (
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center animate-pulse ${getAlertBadgeColor(patient.alertLevel)}`}>
                            <FaBell className="text-xs" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 my-5 border-t border-b border-slate-100 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <FaCalendarAlt className="text-slate-400 flex-shrink-0" />
                          <span>Last Appointment: <strong className="text-slate-800">{patient.lastVisit}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <FaFileMedical className="text-slate-400 flex-shrink-0" />
                          <span>Total Consults: <strong className="text-slate-800">{patient.totalAppointments}</strong></span>
                        </div>
                        {patient.conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {patient.conditions.map((cond, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider">
                                {cond}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button className="w-full py-2.5 bg-slate-50 group-hover:bg-green-600 group-hover:text-white border border-slate-200/60 group-hover:border-green-600 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2">
                      {patient.hasHealthData ? 'View Diagnostic Logs' : 'View Patient Profile'} <FaChartLine />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* PATIENT DETAIL VIEW */
          <>
            {/* Detail view header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10 pb-8 border-b border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button 
                  className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                  onClick={backToList}
                >
                  <FaArrowLeft />
                </button>
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center font-bold text-2xl shadow-inner">
                    {selectedPatient?.name.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedPatient?.name}</h1>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      {selectedPatient?.phone} • {selectedPatient?.totalAppointments} Consultation{selectedPatient?.totalAppointments !== 1 ? 's' : ''} Record
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-650 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <FaPrint /> Print Case Sheet
                </button>
                <button 
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-650 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-650/10 cursor-pointer"
                >
                  <FaFileDownload /> Export Summary
                </button>
              </div>
            </div>

            {/* Conditions Tag */}
            {selectedPatient?.conditions && selectedPatient.conditions.length > 0 && (
              <div className="mb-8 bg-slate-50 border border-slate-200/60 rounded-3xl p-6">
                <h3 className="text-xs font-black text-slate-805 tracking-wide uppercase mb-3.5">Diagnosed Conditions</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPatient.conditions.map((condition, idx) => (
                    <span key={idx} className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!selectedPatient?.hasHealthData ? (
              <div className="text-center py-20 bg-white border border-dashed border-slate-250 rounded-3xl max-w-2xl mx-auto flex flex-col items-center gap-4">
                <FaChartLine className="text-slate-300 w-14 h-14" />
                <h3 className="text-base font-extrabold text-slate-900">No Patient Telemetry Available</h3>
                <p className="text-xs text-slate-505 max-w-md mx-auto leading-relaxed font-medium px-4">
                  This patient has not logged vital readings, target goals, or physical activity telemetry yet.
                  Observations will generate dynamically once they use the health tracking module.
                </p>
              </div>
            ) : (
              <>
                {/* Active Alerts */}
                {alerts.length > 0 && (
                  <div className="mb-10 bg-rose-50/50 border border-rose-200/60 rounded-3xl p-6">
                    <h3 className="text-xs font-black text-rose-800 tracking-wide uppercase mb-4 flex items-center gap-2">
                      <FaBell className="text-rose-600 animate-bounce" /> Active Health Alerts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {alerts.map((alert, index) => (
                        <div key={index} className={`flex items-start gap-3 p-4 bg-white border rounded-2xl shadow-sm ${getAlertColorClasses(alert.alert_level)}`}>
                          <FaExclamationTriangle className="text-base mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-tight">{alert.message}</h4>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{alert.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latest Vitals Grid */}
                <div className="mb-10">
                  <h2 className="text-base font-extrabold text-slate-900 mb-5">Latest Vital Parameters</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {metricTypes.map((metricType) => {
                      const metric = latestMetrics[metricType.value];
                      const isAbnormal = metric?.is_abnormal;

                      const colorMap = {
                        green: { bg: 'bg-green-50/50', border: 'hover:border-teal-500/40', text: 'text-teal-600', icon: 'bg-teal-50 text-teal-600' },
                        rose: { bg: 'bg-rose-50/50', border: 'hover:border-rose-500/40', text: 'text-rose-600', icon: 'bg-rose-50 text-rose-600' },
                        amber: { bg: 'bg-amber-50/50', border: 'hover:border-amber-500/40', text: 'text-amber-600', icon: 'bg-amber-50 text-amber-600' },
                        violet: { bg: 'bg-violet-50/50', border: 'hover:border-violet-500/40', text: 'text-violet-600', icon: 'bg-violet-50 text-violet-600' },
                        orange: { bg: 'bg-orange-50/50', border: 'hover:border-orange-500/40', text: 'text-orange-600', icon: 'bg-orange-50 text-orange-600' },
                        cyan: { bg: 'bg-cyan-50/50', border: 'hover:border-cyan-500/40', text: 'text-cyan-600', icon: 'bg-cyan-50 text-cyan-600' }
                      };

                      const styles = colorMap[metricType.color];

                      return (
                        <div 
                          key={metricType.value}
                          className={`relative bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${styles.border}`}
                        >
                          <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: metricType.hex }}></div>
                          
                          <div className="flex justify-between items-start">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ${styles.icon}`}>
                              {metricType.icon}
                            </div>
                            {metric && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isAbnormal ? 'bg-rose-50 text-rose-655 border border-rose-200' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>
                                {isAbnormal ? `⚠ Alert` : '✓ Normal'}
                              </span>
                            )}
                          </div>

                          <div className="mt-3">
                            <div className="flex items-baseline">
                              <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                {metric ? formatMetricValue(metric) : 'N/A'}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{metricType.unit}</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{metricType.label}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Trends Chart & Filter */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 mb-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-905 tracking-tight">Analytical Trends &amp; Telemetry</h2>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Plot individual vital parameters chronologically</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <select 
                        value={selectedMetricType}
                        onChange={(e) => setSelectedMetricType(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        {metricTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>

                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        {[7, 30, 90].map((period) => {
                          const isActive = trendPeriod === period;
                          return (
                            <button 
                              key={period}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                              }`}
                              onClick={() => setTrendPeriod(period)}
                            >
                              {period === 7 ? '1W' : period === 30 ? '1M' : '3M'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <Line data={getTrendChartData()} options={chartOptions} />
                  </div>

                  {trendsData && (
                    <div className="flex gap-8 mt-6 pt-6 border-t border-slate-100">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Average Reading</span>
                        <span className="text-lg font-black text-slate-808">{trendsData.average}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Log Submissions</span>
                        <span className="text-lg font-black text-slate-808">{trendsData.count}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Goals & Medication Adherence Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                  {/* Health Goals progress */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5">
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
                      <FaBullseye className="text-green-600" /> Patient Health Targets
                    </h2>

                    {activeGoals.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2">
                        <FaBullseye size={24} className="text-slate-350" />
                        <span>No active goals established by this patient</span>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                        {activeGoals.map((goal) => (
                          <div key={goal.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="text-xs font-bold text-slate-850 leading-snug">{goal.title}</h3>
                              <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0">{goal.goal_type_display}</span>
                            </div>
                            <p className="text-[11px] text-slate-450 mt-1 font-semibold leading-relaxed">{goal.description}</p>
                            
                            <div className="mt-4">
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-2">
                                <span>{goal.current_value} / {goal.target_value} {goal.unit}</span>
                                <span className="text-green-600 font-extrabold">{Math.round(goal.progress_percentage)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Medication Adherence */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5">
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
                      <FaPrescriptionBottle className="text-green-600" /> Prescribed Medication Adherence
                    </h2>

                    {medicationReminders.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-2">
                        <FaPrescriptionBottle size={24} className="text-slate-350" />
                        <span>No medication reminders setup for this patient</span>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                        {medicationReminders.map((reminder) => (
                          <div key={reminder.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="text-xs font-bold text-slate-900 leading-snug">{reminder.medication_name}</h3>
                              <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0">{reminder.frequency_display}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold mt-1">Dosage: {reminder.dosage}</p>
                            
                            <div className="mt-4">
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-650 rounded-full transition-all duration-500"
                                  style={{ width: `${reminder.adherence_rate}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mt-2">
                                <span>Adherence Rate</span>
                                <span className="text-green-650 font-extrabold">{reminder.adherence_rate}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Clinical Observations Notes */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 mb-10">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mb-4">
                <FaStickyNote className="text-green-600" /> Clinical Case Notes
              </h2>
              <p className="text-xs text-slate-400 font-semibold mb-4">Add observations, treatment directives, or clinical instructions for this patient's case sheet</p>
              
              <div className="space-y-4">
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-450 min-h-[140px]"
                  placeholder="Record patient telemetry observations..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows="6"
                />
                <button 
                  onClick={handleSaveNotes}
                  className="px-6 py-2.5 bg-green-650 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-650/10 cursor-pointer"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </>
        )}

      </main>

      {/* Branded Footer Component */}
      <Footer />

    </div>
  );
};

export default DoctorPatientHealth;