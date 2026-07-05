import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPrescriptionsAPI } from '../../services/api';
import { generatePrescriptionPDF } from '../video/generatePrescriptionPDF';
import Footer from '../Footer';
import { FaHeartbeat, FaArrowLeft, FaFileMedical, FaPrescriptionBottle, FaPrint, FaDownload, FaCalendarAlt, FaCheck, FaTimes, FaSearch, FaUserMd, FaExclamationTriangle, FaLock, FaSync } from 'react-icons/fa';
import './Patientprescriptions.css';

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS = {
  active:    { label: 'Active',    badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  completed: { label: 'Completed', badge: 'bg-blue-50 text-blue-600 border border-blue-200' },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-50 text-slate-500 border border-slate-200' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysUntil = (date) => {
  if (!date) return null;
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000);
  return diff;
};

// ─── PrescriptionDownloadButton ──────────────────────────────────────────────
const PrescriptionDownloadButton = ({
  prescription,
  size = 'md',
  variant = 'primary',
  label,
  showIcon = true,
  className = '',
}) => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleDownload = async (e) => {
    e.stopPropagation(); // prevent card click / modal events bubbling
    if (status === 'loading') return;
    if (!prescription) {
      setErrorMsg('No prescription data available');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      await generatePrescriptionPDF(prescription);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('[PrescriptionDownloadButton] PDF generation failed:', err);
      setErrorMsg('Could not generate PDF. Please try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const getLabel = () => {
    if (status === 'loading') return 'Generating…';
    if (status === 'success') return 'Downloaded!';
    if (status === 'error')   return 'Retry';
    return label || 'Download PDF';
  };

  const btnClasses = size === 'sm' 
    ? 'px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg'
    : size === 'lg'
    ? 'w-full py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl justify-center'
    : 'px-4 py-2 text-xs font-bold rounded-xl';

  const variantClasses = status === 'success'
    ? 'bg-emerald-600 text-white border border-emerald-600'
    : status === 'error'
    ? 'bg-rose-600 text-white border border-rose-600'
    : variant === 'outline'
    ? 'bg-transparent border border-teal-600 text-teal-650 hover:bg-teal-50/50'
    : 'bg-teal-600 hover:bg-teal-700 text-white border border-teal-600 shadow-md shadow-teal-600/10';

  return (
    <div className="inline-flex flex-col items-start w-full md:w-auto">
      <button
        onClick={handleDownload}
        disabled={status === 'loading'}
        className={`inline-flex items-center gap-1.5 transition-all select-none cursor-pointer ${btnClasses} ${variantClasses} ${className}`}
        title="Download prescription as PDF"
      >
        {showIcon && (
          status === 'loading' ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : status === 'success' ? (
            <FaCheck size={11} />
          ) : status === 'error' ? (
            <FaExclamationTriangle size={11} />
          ) : (
            <FaDownload size={11} />
          )
        )}
        <span>{getLabel()}</span>
      </button>
      {status === 'error' && errorMsg && (
        <p className="text-[10px] text-rose-600 font-bold mt-1 leading-tight">{errorMsg}</p>
      )}
    </div>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, bg, text }) => (
  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${bg} ${text}`}>
      {icon}
    </div>
    <div>
      <div className="text-2xl font-black text-slate-900 block leading-tight">{value}</div>
      <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">{label}</div>
    </div>
  </div>
);

// ─── Prescription Card ──────────────────────────────────────────────────────
const PrescriptionCard = ({ rx, onClick }) => {
  const st = STATUS[rx.status] || STATUS.active;
  const days = daysUntil(rx.follow_up_date);
  const meds = rx.medications || [];

  return (
    <div 
      className="bg-white border border-slate-200/80 hover:border-teal-500/40 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between h-full group"
      onClick={() => onClick(rx)}
    >
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-teal-600 transition-colors leading-tight">{rx.diagnosis || 'General Consultation'}</h3>
            <p className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-1">
              <FaUserMd className="text-slate-350" /> {rx.doctor_name || 'Unknown Doctor'}
              {rx.doctor_specialization && <span> · {rx.doctor_specialization}</span>}
            </p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${st.badge}`}>
            {st.label}
          </span>
        </div>

        <div className="space-y-2 my-4 border-t border-b border-slate-100 py-4 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <FaPrescriptionBottle className="text-slate-350" />
            <span>{meds.length} medication{meds.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FaCalendarAlt className="text-slate-350" />
            <span>Date: <strong className="text-slate-750 font-bold">{fmt(rx.date)}</strong></span>
          </div>
          {rx.hospital_name && (
            <div className="flex items-center gap-1.5">
              <span>🏥 {rx.hospital_name}</span>
            </div>
          )}
        </div>

        {days !== null && days >= 0 && rx.status === 'active' && (
          <div className={`mb-4 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border ${
            days <= 7 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <FaExclamationTriangle />
            Follow-up: {fmt(rx.follow_up_date)}{days <= 7 ? ` (${days}d)` : ''}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
        <PrescriptionDownloadButton
          prescription={rx}
          size="sm"
          variant="outline"
          label="Download PDF"
        />
        <span className="text-[10px] text-teal-600 font-black uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
          View Case →
        </span>
      </div>
    </div>
  );
};

// ─── Prescription Modal ─────────────────────────────────────────────────────
const PrescriptionModal = ({ rx, onClose }) => {
  if (!rx) return null;
  const st = STATUS[rx.status] || STATUS.active;
  const meds = rx.medications || [];
  const vitals = rx.vital_signs || {};
  const days = daysUntil(rx.follow_up_date);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-teal-800 to-teal-700 text-white">
          <div>
            <div className="flex items-center gap-2">
              <FaFileMedical className="text-teal-400" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Case Prescription Detail
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/15 border border-white/20 text-white">
                <FaLock className="text-[8px]" /> Private
              </span>
            </div>
            <div className="text-[10px] text-teal-100 font-semibold mt-1">Prescribed: {fmt(rx.date)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all cursor-pointer"
              title="Print Case Sheet"
            >
              <FaPrint size={13} />
            </button>

            <PrescriptionDownloadButton
              prescription={rx}
              size="sm"
              variant="primary"
              label="PDF"
              className="bg-white/15 hover:bg-white/25 text-white border border-white/25 hover:border-white/40"
            />

            <button 
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-50 text-white hover:text-red-650 flex items-center justify-center transition-colors cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
          
          {/* Hospital Stamp */}
          {(rx.hospital_name || rx.doctor_name) && (
            <div className="relative p-5 bg-gradient-to-br from-teal-50/50 to-emerald-50/30 border border-teal-500/20 rounded-2xl">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-5xl font-black text-teal-600/5 select-none pointer-events-none">Rx</div>
              <h3 className="font-extrabold text-teal-700 text-base">{rx.hospital_name || 'Rural Health Clinic'}</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Doctor: {rx.doctor_name} {rx.doctor_specialization ? `(${rx.doctor_specialization})` : ''}
              </p>
              {rx.doctor_registration && (
                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1">Physician Reg No: {rx.doctor_registration}</p>
              )}
            </div>
          )}

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs font-semibold text-slate-500 space-y-1">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest mb-1.5">Patient Details</h4>
              <p>Name: <strong className="text-slate-800 font-bold">{rx.patient_name || '—'}</strong></p>
              {rx.patient_age && <p>Age: <strong className="text-slate-800 font-bold">{rx.patient_age}</strong></p>}
              {rx.patient_gender && <p>Gender: <strong className="text-slate-800 font-bold">{rx.patient_gender}</strong></p>}
              {rx.patient_phone && <p>Contact: <strong className="text-slate-800 font-bold">{rx.patient_phone}</strong></p>}
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs font-semibold text-slate-500 space-y-2">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Case Status</h4>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${st.badge}`}>{st.label}</span>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">Logged on: {fmt(rx.date)}</p>
            </div>
          </div>

          {/* Diagnosis */}
          {rx.diagnosis && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Clinical Diagnosis</h4>
              <div className="p-4 bg-teal-50/40 border-l-4 border-teal-600 rounded-r-xl text-xs font-bold text-slate-800 leading-relaxed">
                {rx.diagnosis}
              </div>
            </div>
          )}

          {/* Medications */}
          {meds.length > 0 && (
            <div className="space-y-3.5">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Prescribed Medications ({meds.length})</h4>
              <div className="space-y-3">
                {meds.map((med, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl hover:border-teal-500/20 hover:bg-teal-50/10 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-inner">
                      {i + 1}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{med.name}</span>
                        {med.dosage && (
                          <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-650 rounded-lg text-[10px] font-black uppercase tracking-wider">{med.dosage}</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-slate-500 font-semibold mt-2.5">
                        {med.frequency && <span>🕐 Frequency: {med.frequency}</span>}
                        {med.duration && <span>📅 Duration: {med.duration}</span>}
                        {med.instructions && <span>💊 Instructions: {med.instructions}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vitals */}
          {Object.keys(vitals).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Logged Vital Signs</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {Object.entries(vitals).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center hover:border-teal-500/25 transition-all">
                    <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">{k.replace(/_/g, ' ')}</div>
                    <div className="text-xs font-black text-slate-800">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab tests */}
          {rx.lab_tests && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Recommended Lab Diagnostics</h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {rx.lab_tests}
              </div>
            </div>
          )}

          {/* Notes */}
          {rx.notes && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Doctor's Observational Notes</h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 leading-relaxed whitespace-pre-wrap">
                {rx.notes}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {rx.follow_up_date && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3.5 ${
              days !== null && days <= 7 ? 'bg-rose-50 border-rose-200/80 text-rose-650' : 'bg-teal-50/50 border-teal-200/80 text-teal-700'
            }`}>
              <FaCalendarAlt size={18} className="flex-shrink-0" />
              <div>
                <div className="text-xs font-extrabold">Recommended Follow-up Visit</div>
                <div className="text-[11px] font-semibold mt-0.5">
                  {fmt(rx.follow_up_date)}
                  {days !== null && days >= 0 && (
                    <span> · {days === 0 ? 'Today!' : `${days} day${days !== 1 ? 's' : ''} remaining`}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Download Action */}
          <div className="pt-2 border-t border-slate-100 flex-shrink-0">
            <PrescriptionDownloadButton
              prescription={rx}
              size="lg"
              variant="primary"
              label="Download Signed PDF Case Sheet"
            />
          </div>

          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 justify-center">
            <FaLock /> Encrypted digital case sheet. Accessible only by primary healthcare provider and patient.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PatientPrescriptions() {
  const navigate = useNavigate();
  const { id: urlId } = useParams();

  const [prescriptions, setPrescriptions] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [selected, setSelected] = useState(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('');

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.user_type !== 'patient') {
      navigate('/auth?type=patient&view=login');
    }
  }, [navigate]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rxRes, statsRes] = await Promise.allSettled([
        patientPrescriptionsAPI.getMyPrescriptions(filter, search),
        patientPrescriptionsAPI.getPrescriptionStats(),
      ]);

      if (rxRes.status === 'fulfilled') {
        const data = rxRes.value;
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.prescriptions) ? data.prescriptions
          : Array.isArray(data?.results) ? data.results
          : [];
        setPrescriptions(list);
      } else {
        setError(rxRes.reason?.message || 'Failed to load prescriptions.');
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Open by URL param ─────────────────────────────────────────────────────
  useEffect(() => {
    if (urlId && prescriptions.length > 0) {
      const found = prescriptions.find(p => String(p.id) === String(urlId));
      if (found) setSelected(found);
    }
  }, [urlId, prescriptions]);

  // ── Debounced search ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Close modal on Escape ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">
      
      {/* Branded Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-teal-600/10 text-teal-600 border border-teal-500/10 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Rural HealthCare</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <FaArrowLeft /> Back
            </button>
            <button 
              onClick={fetchData}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all cursor-pointer"
              title="Refresh Prescriptions History"
            >
              <FaSync className={loading ? 'animate-spin-slow' : ''} size={11} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Area */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">My Prescriptions</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider">Your complete medical history &amp; prescription case sheets</p>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatCard icon="rx" value={stats.total} label="Total Logged" bg="bg-teal-50" text="text-teal-600" />
            <StatCard icon="check" value={stats.active} label="Active Cases" bg="bg-emerald-50" text="text-emerald-600" />
            <StatCard icon="pill" value={stats.completed} label="Completed Cases" bg="bg-blue-50" text="text-blue-600" />
            <StatCard icon="calendar" value={stats.recent_90_days ?? '—'} label="Last 90 Days" bg="bg-purple-50" text="text-purple-650" />
          </div>
        )}

        {/* Controls: Search + Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-8 relative flex items-center">
            <FaSearch className="absolute left-4 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search prescriptions by diagnosis, doctor name, medication name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400 shadow-sm"
            />
            {searchInput && (
              <button 
                onClick={() => setSearchInput('')}
                className="absolute right-4 text-slate-400 hover:text-slate-650"
              >
                ✕
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none transition-all cursor-pointer shadow-sm"
            >
              <option value="">All Case Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Content list */}
        {loading && prescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing Case Records...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white border border-rose-100 rounded-3xl max-w-md mx-auto flex flex-col items-center gap-4">
            <FaExclamationTriangle className="text-rose-600 w-12 h-12" />
            <div className="text-xs font-bold text-slate-800">{error}</div>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl max-w-lg mx-auto flex flex-col items-center gap-4">
            <span className="text-3xl text-slate-350">📋</span>
            <div>
              <h3 className="font-extrabold text-slate-900">No Prescriptions Registered</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                {search || filter 
                  ? 'Try matching other queries or clearing your current search string.' 
                  : 'Your digital prescriptions will appear dynamically here after consultations with doctors.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prescriptions.map((rx) => (
              <PrescriptionCard key={rx.id} rx={rx} onClick={setSelected} />
            ))}
          </div>
        )}

      </main>

      {/* Footer component */}
      <Footer />

      {/* Modal */}
      {selected && (
        <PrescriptionModal rx={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}