// Prescriptions.jsx - Modernized for Doctor Use with Tailwind CSS
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaHeartbeat, FaPills, FaPlus, FaTimes, FaDownload, FaEye,
  FaUserMd, FaCalendarAlt, FaFileMedical, FaPrint, FaQrcode,
  FaArrowLeft, FaSync, FaTrash, FaClipboardList, FaNotesMedical, FaLock
} from 'react-icons/fa';
import { prescriptionsAPI, appointmentsAPI, authAPI } from '../../services/api';
import { generatePrescriptionPDF } from '../video/generatePrescriptionPDF';
import Footer from '../Footer';
import './Prescriptions.css';

const Prescriptions = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  
  // Patient selection
  const [myPatients, setMyPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: '',
    patient_gender: '',
    patient_phone: '',
    diagnosis: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    notes: '',
    follow_up_date: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const user = authAPI.getCurrentUser();
    
    if (!user) {
      alert('Please login to access prescriptions');
      navigate('/auth?type=doctor&view=login');
      return;
    }

    // Only doctors can create prescriptions
    if (user.user_type !== 'doctor') {
      alert('Only doctors can create prescriptions');
      navigate('/');
      return;
    }

    console.log('[Prescriptions] Logged in doctor:', user);
    setCurrentUser(user);
    
    // Load doctor's prescriptions and patients
    await loadPrescriptions(user.id);
    await loadMyPatients(user.id);
  };

  const loadPrescriptions = async (doctorId) => {
    try {
      setLoading(true);
      console.log('[Prescriptions] Loading prescriptions for doctor:', doctorId);
      
      const response = await prescriptionsAPI.getDoctorPrescriptions(doctorId);
      const prescriptionsList = Array.isArray(response) ? response : (response.results || []);
      
      console.log('[Prescriptions] Loaded prescriptions:', prescriptionsList);
      setPrescriptions(prescriptionsList);
    } catch (error) {
      console.error('[Prescriptions] Error loading prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyPatients = async (doctorId) => {
    try {
      console.log('[Prescriptions] Loading patients for doctor:', doctorId);
      
      const response = await appointmentsAPI.getDoctorAppointments(doctorId);
      const appointments = Array.isArray(response) ? response : (response.results || []);
      
      console.log('[Prescriptions] Doctor appointments:', appointments);
      
      const uniquePatients = [];
      const patientPhones = new Set();
      
      appointments.forEach(apt => {
        if (apt.patient_phone && !patientPhones.has(apt.patient_phone)) {
          patientPhones.add(apt.patient_phone);
          uniquePatients.push({
            name: apt.patient_name,
            phone: apt.patient_phone,
            lastAppointment: apt.preferred_date,
            symptoms: apt.symptoms
          });
        }
      });
      
      console.log('[Prescriptions] Unique patients:', uniquePatients);
      setMyPatients(uniquePatients);
      
    } catch (error) {
      console.error('[Prescriptions] Error loading patients:', error);
    }
  };

  const openModal = () => {
    setShowModal(true);
    setFormData(prev => ({
      ...prev,
      date: new Date().toISOString().split('T')[0]
    }));
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPrescription(null);
    setSelectedPatient(null);
    setFormData({
      patient_name: '',
      patient_age: '',
      patient_gender: '',
      patient_phone: '',
      diagnosis: '',
      medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      notes: '',
      follow_up_date: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const selectPatient = (patient) => {
    console.log('[Prescriptions] Selected patient:', patient);
    setSelectedPatient(patient);
    setFormData(prev => ({
      ...prev,
      patient_name: patient.name,
      patient_phone: patient.phone
    }));
  };

  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    }));
  };

  const removeMedication = (index) => {
    if (formData.medications.length === 1) {
      alert('At least one medication is required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const updateMedication = (index, field, value) => {
    setFormData(prev => {
      const newMedications = [...prev.medications];
      newMedications[index][field] = value;
      return { ...prev, medications: newMedications };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_name || !formData.patient_phone) {
      alert('Please select a patient');
      return;
    }

    if (!formData.diagnosis) {
      alert('Please enter diagnosis');
      return;
    }

    const invalidMeds = formData.medications.filter(
      med => !med.name || !med.dosage || !med.frequency || !med.duration
    );

    if (invalidMeds.length > 0) {
      alert('Please fill all required medication fields (name, dosage, frequency, duration)');
      return;
    }

    try {
      setSaving(true);
      console.log('[Prescriptions] Creating prescription...');

      const doctorProfile = currentUser.doctor_profile || {};
      
      const prescriptionData = {
        patient_name: formData.patient_name,
        patient_age: formData.patient_age || '',
        patient_gender: formData.patient_gender || '',
        patient_phone: formData.patient_phone,
        
        doctor_name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.username,
        doctor_specialization: doctorProfile.specialization || 'General Physician',
        doctor_registration: doctorProfile.license_number || '',
        hospital_name: doctorProfile.hospital_name || 'Rural Health Center',
        
        diagnosis: formData.diagnosis,
        medications: formData.medications,
        notes: formData.notes,
        follow_up_date: formData.follow_up_date || null,
        date: formData.date,
      };

      console.log('[Prescriptions] Prescription data:', prescriptionData);
      
      const response = await prescriptionsAPI.createPrescription(prescriptionData);
      console.log('[Prescriptions] ✅ Created successfully:', response);
      
      alert('Digital prescription created successfully!');
      closeModal();
      await loadPrescriptions(currentUser.id);
      
    } catch (error) {
      console.error('[Prescriptions] ❌ Error creating prescription:', error);
      alert('Error creating prescription: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const viewPrescription = (prescription) => {
    setSelectedPrescription(prescription);
  };

  const deletePrescription = async (id) => {
    if (window.confirm('Are you sure you want to delete this prescription?')) {
      try {
        await prescriptionsAPI.deletePrescription(id);
        alert('Prescription deleted successfully!');
        await loadPrescriptions(currentUser.id);
      } catch (error) {
        alert('Error deleting prescription: ' + error.message);
      }
    }
  };

  const printPrescription = () => {
    window.print();
  };

  const downloadPrescription = async () => {
    if (!selectedPrescription) return;
    setPdfDownloading(true);
    try {
      await generatePrescriptionPDF(selectedPrescription);
    } catch (err) {
      console.error('[Prescriptions] PDF generation failed:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setPdfDownloading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <FaHeartbeat className="w-12 h-12 text-teal-600 animate-pulse mx-auto" />
          <h2 className="mt-6 text-xl font-bold text-slate-800">Rural HealthCare</h2>
          <p className="mt-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">Verifying Credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">
      
      {/* Top Branded Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/doctor-dashboard')}>
            <div className="w-9 h-9 bg-teal-600/10 text-teal-600 border border-teal-500/10 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Rural HealthCare</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/doctor-dashboard')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <FaArrowLeft /> Back to Dashboard
            </button>
            <button 
              onClick={() => loadPrescriptions(currentUser.id)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <FaSync className={loading ? 'animate-spin-slow' : ''} size={11} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Area */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Digital Prescriptions</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider">Create, dispatch, and review electronic prescription sheets</p>
          </div>
          <button 
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-4.5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer self-start sm:self-auto"
          >
            <FaPlus /> New Prescription
          </button>
        </div>

        {/* Content list */}
        {loading && prescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-150 rounded-3xl">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing prescriptions history...</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl max-w-lg mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-350 text-2xl">
              <FaFileMedical />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">No Prescriptions Logged</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                You haven't recorded any digital prescriptions yet. Click the button below to build an Rx sheet for a patient.
              </p>
            </div>
            <button 
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
            >
              <FaPlus /> Create Prescription
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prescriptions.map((prescription) => (
              <div 
                key={prescription.id} 
                className="bg-white border border-slate-200/80 hover:border-teal-500/40 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full group"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <span className="text-[10px] text-teal-650 font-black uppercase tracking-wider px-2 py-0.5 bg-teal-50 border border-teal-200 rounded-md">
                      Rx #{String(prescription.id).substring(0, 8)}
                    </span>
                    
                    <div className="flex gap-1">
                      <button 
                        onClick={() => viewPrescription(prescription)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                        title="View Full Sheet"
                      >
                        <FaEye size={11} />
                      </button>
                      <button 
                        onClick={() => deletePrescription(prescription.id)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg text-rose-605 transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-teal-600 transition-colors leading-tight">{prescription.patient_name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {prescription.patient_age ? `${prescription.patient_age} yrs` : ''} 
                      {prescription.patient_gender ? ` • ${prescription.patient_gender}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-450 font-semibold">📱 {prescription.patient_phone}</p>
                  </div>

                  <div className="my-4 border-t border-b border-slate-100 py-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <FaCalendarAlt className="text-slate-350" />
                      <span>Date: <strong className="text-slate-750 font-bold">{formatDate(prescription.date || prescription.created_at)}</strong></span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-1">Diagnosis</span>
                      <p className="text-slate-700 font-bold text-[11px] leading-relaxed line-clamp-2">{prescription.diagnosis}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block">Medications ({prescription.medications?.length || 0})</span>
                    {prescription.medications && prescription.medications.length > 0 ? (
                      <div className="space-y-1">
                        {prescription.medications.slice(0, 2).map((med, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] font-semibold text-slate-600">
                            <span className="text-slate-800 font-bold">{med.name}</span>
                            <span className="text-slate-450">{med.dosage}</span>
                          </div>
                        ))}
                        {prescription.medications.length > 2 && (
                          <div className="text-[10px] text-teal-600 font-extrabold italic pt-0.5">
                            + {prescription.medications.length - 2} more medications prescribed
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic font-semibold">No medications prescribed</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => viewPrescription(prescription)}
                  className="w-full mt-2 py-2.5 bg-slate-100 hover:bg-teal-650 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FaClipboardList /> View Case Sheet
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer component */}
      <Footer />

      {/* ── CREATE PRESCRIPTION MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={closeModal}>
          <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-teal-800 to-teal-700 text-white">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <FaNotesMedical className="text-teal-400" /> Create Digital Case Prescription
              </h2>
              <button 
                onClick={closeModal} 
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-50 text-white hover:text-red-650 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
              
              {/* Patient Selection */}
              <div className="space-y-3.5">
                <h3 className="text-[10px] font-black text-teal-655 uppercase tracking-widest pb-1 border-b border-slate-100">1. Select Patient</h3>
                
                {myPatients.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200/60 text-amber-850 rounded-2xl text-xs font-semibold">
                    ⚠️ No consultation records found. Patients who book telemetry slots with you will populate here.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {myPatients.map((patient, idx) => (
                      <div 
                        key={idx}
                        onClick={() => selectPatient(patient)}
                        className={`p-4 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                          selectedPatient?.phone === patient.phone 
                            ? 'bg-teal-50/50 border-teal-500 text-slate-800 shadow-sm' 
                            : 'bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-600'
                        }`}
                      >
                        <div className="font-extrabold text-slate-800 mb-1 flex items-center gap-1">
                          <FaUserMd className="text-teal-600" /> {patient.name}
                        </div>
                        <p className="text-[10px] text-slate-400">📱 {patient.phone}</p>
                        <p className="text-[10px] text-slate-450 italic mt-1.5">Last Visit: {formatDate(patient.lastAppointment)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient details edit fields if selected */}
              {selectedPatient && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Demographic Details */}
                  <div className="space-y-3.5">
                    <h3 className="text-[10px] font-black text-teal-655 uppercase tracking-widest pb-1 border-b border-slate-100">2. Demographics</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Patient Name *</label>
                        <input
                          type="text"
                          value={formData.patient_name}
                          onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Age (Years)</label>
                        <input
                          type="text"
                          value={formData.patient_age}
                          onChange={(e) => setFormData({ ...formData, patient_age: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                          placeholder="e.g., 34"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Gender</label>
                        <select
                          value={formData.patient_gender}
                          onChange={(e) => setFormData({ ...formData, patient_gender: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis details */}
                  <div className="space-y-3.5">
                    <h3 className="text-[10px] font-black text-teal-655 uppercase tracking-widest pb-1 border-b border-slate-100">3. Diagnostic Assessment</h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Diagnosis / Clinical Impression *</label>
                        <input
                          type="text"
                          value={formData.diagnosis}
                          onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                          placeholder="e.g., Acute Pharyngitis"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Prescription Date *</label>
                          <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Follow-up Date</label>
                          <input
                            type="date"
                            value={formData.follow_up_date}
                            onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                            min={formData.date}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Medications list edit */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                      <h3 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">4. Pharmacotherapy regimen</h3>
                      <button
                        type="button"
                        onClick={addMedication}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-650 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        <FaPlus /> Add Medication
                      </button>
                    </div>

                    <div className="space-y-4">
                      {formData.medications.map((med, index) => (
                        <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-teal-650 font-black uppercase tracking-wider">Medicine #{index + 1}</span>
                            {formData.medications.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMedication(index)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                              >
                                <FaTimes /> Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name *</label>
                              <input
                                type="text"
                                placeholder="e.g., Paracetamol"
                                value={med.name}
                                onChange={(e) => updateMedication(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dosage *</label>
                              <input
                                type="text"
                                placeholder="e.g., 500mg"
                                value={med.dosage}
                                onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frequency *</label>
                              <input
                                type="text"
                                placeholder="e.g., Twice daily"
                                value={med.frequency}
                                onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duration *</label>
                              <input
                                type="text"
                                placeholder="e.g., 5 days"
                                value={med.duration}
                                onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Special Intake Instructions</label>
                            <input
                              type="text"
                              placeholder="e.g., Take after meals with warm water"
                              value={med.instructions}
                              onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional notes */}
                  <div className="space-y-3.5">
                    <h3 className="text-[10px] font-black text-teal-655 uppercase tracking-widest pb-1 border-b border-slate-100">5. Observation notes</h3>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Dietary Advice / Clinical Remarks</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="e.g., strict bed rest for 3 days, drink lots of fluids..."
                        rows="3"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder-slate-400 min-h-[70px]"
                      />
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={closeModal} 
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
                      disabled={saving}
                    >
                      {saving ? 'Creating Prescriptions...' : 'Issue Prescription'}
                    </button>
                  </div>

                </div>
              )}

            </form>
          </div>
        </div>
      )}

      {/* ── VIEW PRESCRIPTION MODAL ── */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setSelectedPrescription(null)}>
          <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-teal-800 to-teal-700 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <FaFileMedical className="text-teal-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider">
                    Medical Case Sheet Record
                  </h2>
                </div>
                <div className="text-[10px] text-teal-100 font-semibold mt-1">Rx Ref: #{String(selectedPrescription.id).substring(0, 8)}</div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={printPrescription}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all cursor-pointer"
                  title="Print Document"
                >
                  <FaPrint size={13} />
                </button>
                <button 
                  onClick={downloadPrescription}
                  disabled={pdfDownloading}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Download Signed PDF"
                >
                  {pdfDownloading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <FaDownload size={13} />
                  )}
                </button>
                <button 
                  onClick={() => setSelectedPrescription(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-50 text-white hover:text-red-655 flex items-center justify-center transition-colors cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-6">
              
              {/* Document Header details */}
              <div className="flex justify-between items-start gap-6 border-b border-slate-100 pb-5">
                <div>
                  <h1 className="text-lg font-black text-teal-700 tracking-tight">
                    {selectedPrescription.hospital_name || 'Rural Healthcare Center'}
                  </h1>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1">Electronic Patient Care Record</p>
                </div>
                <div className="text-slate-300">
                  <FaQrcode size={54} />
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-500 space-y-1">
                  <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest mb-1.5">Patient Information</h4>
                  <p>Name: <strong className="text-slate-800 font-bold">{selectedPrescription.patient_name}</strong></p>
                  {selectedPrescription.patient_age && <p>Age: <strong className="text-slate-800 font-bold">{selectedPrescription.patient_age} yrs</strong></p>}
                  {selectedPrescription.patient_gender && <p>Gender: <strong className="text-slate-800 font-bold">{selectedPrescription.patient_gender}</strong></p>}
                  <p>Phone: <strong className="text-slate-800 font-bold">{selectedPrescription.patient_phone}</strong></p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-500 space-y-1">
                  <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest mb-1.5">Practitioner Information</h4>
                  <p>Name: <strong className="text-slate-800 font-bold">Dr. {selectedPrescription.doctor_name}</strong></p>
                  {selectedPrescription.doctor_specialization && (
                    <p>Department: <strong className="text-slate-800 font-bold">{selectedPrescription.doctor_specialization}</strong></p>
                  )}
                  {selectedPrescription.doctor_registration && (
                    <p>Reg License: <strong className="text-slate-800 font-bold">{selectedPrescription.doctor_registration}</strong></p>
                  )}
                </div>
              </div>

              {/* Diagnosis box */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Clinical Impression</h4>
                <div className="p-4 bg-teal-50/40 border-l-4 border-teal-600 rounded-r-xl text-xs font-bold text-slate-850 leading-relaxed">
                  {selectedPrescription.diagnosis}
                </div>
              </div>

              {/* Medications table */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">℞ Pharmacotherapy Regimen</h4>
                {selectedPrescription.medications && selectedPrescription.medications.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-550 border-b border-slate-200 font-extrabold text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Medicine Name</th>
                          <th className="py-3 px-4">Dosage</th>
                          <th className="py-3 px-4">Frequency</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                        {selectedPrescription.medications.map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 text-slate-450">{idx + 1}</td>
                            <td className="py-3 px-4 text-slate-900 font-extrabold">{med.name}</td>
                            <td className="py-3 px-4 text-teal-650">{med.dosage}</td>
                            <td className="py-3 px-4">{med.frequency}</td>
                            <td className="py-3 px-4">{med.duration}</td>
                            <td className="py-3 px-4 text-slate-500 italic">{med.instructions || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic font-semibold">No medications prescribed</p>
                )}
              </div>

              {/* Additional notes */}
              {selectedPrescription.notes && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-teal-655 uppercase tracking-widest">Clinician Remarks / Notes</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 leading-relaxed whitespace-pre-wrap">
                    {selectedPrescription.notes}
                  </div>
                </div>
              )}

              {/* Follow-up date */}
              {selectedPrescription.follow_up_date && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-700 font-bold flex items-center gap-2">
                  <FaCalendarAlt />
                  <span>Recommend Follow-up Visit: <strong>{formatDate(selectedPrescription.follow_up_date)}</strong></span>
                </div>
              )}

              {/* Signature block */}
              <div className="pt-6 border-t border-slate-100 flex flex-col items-end">
                <div className="text-center">
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Digitally Verified By</div>
                  <div className="font-extrabold text-teal-650 text-xs mt-1.5 font-mono italic">Dr. {selectedPrescription.doctor_name}</div>
                  <div className="w-32 h-[1px] bg-slate-200 my-1"></div>
                  <div className="text-[8px] text-slate-400 font-semibold">Verification Key: PP-DR-REF-{String(selectedPrescription.id).substring(0, 6).toUpperCase()}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Prescriptions;