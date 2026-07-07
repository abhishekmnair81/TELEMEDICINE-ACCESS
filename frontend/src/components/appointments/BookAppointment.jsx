'use client';

import React, { useState, useEffect } from 'react';
import { FaHeartbeat, FaArrowLeft, FaUserMd, FaStar, FaStarHalfAlt, FaCalendar, FaPhone, FaRegClock, FaClipboardList } from 'react-icons/fa';
import api from '../../services/api';
import './BookAppointment.css';

const BookAppointment = () => {
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_phone: '',
    preferred_date: '',
    symptoms: ''
  });

  const timeSlots = [
    { time: '09:00', display: '09:00 AM' },
    { time: '10:00', display: '10:00 AM' },
    { time: '11:00', display: '11:00 AM' },
    { time: '14:00', display: '02:00 PM' },
    { time: '15:00', display: '03:00 PM' },
    { time: '16:00', display: '04:00 PM' }
  ];


  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, preferred_date: today }));


    loadDoctors();


    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('[BookAppointment] Loaded user:', user);
        setCurrentUser(user);


        if (user.user_type === 'patient') {
          setFormData(prev => ({
            ...prev,
            patient_name: `${user.first_name} ${user.last_name}`.trim() || '',
            patient_phone: user.phone_number || user.username || ''
          }));
        }

        if (user && user.id) {
          loadAppointments(user);
        }
      } catch (error) {
        console.error('[BookAppointment] Error parsing user:', error);
        setCurrentUser(null);
      }
    } else {
      console.log('[BookAppointment] No user logged in');
      setCurrentUser(null);
    }
  }, []);

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      console.log('[BookAppointment] Loading doctors from API');

      const data = await api.doctorsAPI.getAllDoctors();
      console.log('[BookAppointment] Fetched doctors:', data);

      if (Array.isArray(data)) {
        setDoctors(data);
      } else if (data && data.results) {
        setDoctors(data.results);
      } else {
        console.warn('[BookAppointment] Unexpected doctors response format:', data);
        setDoctors([]);
      }
    } catch (error) {
      console.error('[BookAppointment] Error loading doctors:', error);
      setDoctors([
        {
          id: 1,
          user: { id: 1, first_name: 'Rajesh', last_name: 'Sharma' },
          specialization: 'General Physician',
          experience_years: 15,
          average_rating: 4.8,
          consultation_fee: 500,
        },
        {
          id: 2,
          user: { id: 2, first_name: 'Priya', last_name: 'Verma' },
          specialization: 'Pediatrician',
          experience_years: 10,
          average_rating: 5.0,
          consultation_fee: 600,
        },
        {
          id: 3,
          user: { id: 3, first_name: 'Amit', last_name: 'Kumar' },
          specialization: 'Cardiologist',
          experience_years: 20,
          average_rating: 4.9,
          consultation_fee: 800,
        }
      ]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadAppointments = async (user) => {
    try {
      console.log('[BookAppointment] Loading appointments for user:', user);

      let data;
      if (user.user_type === 'patient') {
        data = await api.appointmentsAPI.getPatientAppointments(user.id);
        console.log('[BookAppointment] Fetched patient appointments:', data);
      } else if (user.user_type === 'doctor') {
        data = await api.appointmentsAPI.getDoctorAppointments(user.id);
        console.log('[BookAppointment] Fetched doctor appointments:', data);
      } else {
        console.log('[BookAppointment] User type not patient/doctor, skipping appointments');
        setAppointments([]);
        return;
      }

      if (Array.isArray(data)) {
        setAppointments(data);
      } else if (data && data.results) {
        setAppointments(data.results);
      } else {
        console.warn('[BookAppointment] Unexpected appointments response format:', data);
        setAppointments([]);
      }
    } catch (error) {
      console.error('[BookAppointment] Error loading appointments:', error.message);
      setAppointments([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDoctor) {
      alert('Please select a doctor');
      return;
    }

    if (!selectedTimeSlot) {
      alert('Please select a time slot');
      return;
    }

    const appointmentData = {
      ...formData,
      doctor: selectedDoctor,
      preferred_time: selectedTimeSlot,
      status: 'pending'
    };

    try {
      await api.appointmentsAPI.createAppointment(appointmentData);
      alert('Appointment booked successfully! We will confirm your appointment soon.');
      setFormData({
        patient_name: currentUser?.user_type === 'patient'
          ? `${currentUser.first_name} ${currentUser.last_name}`.trim()
          : '',
        patient_phone: currentUser?.phone_number || currentUser?.username || '',
        preferred_date: new Date().toISOString().split('T')[0],
        symptoms: ''
      });
      setSelectedDoctor(null);
      setSelectedTimeSlot(null);

      if (currentUser) {
        loadAppointments(currentUser);
      }
    } catch (error) {
      alert('Error booking appointment: ' + error.message);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const numRating = Number(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FaStar key={i} className="text-amber-500" />);
    }

    if (hasHalfStar) {
      stars.push(<FaStarHalfAlt key="half" className="text-amber-500" />);
    }

    return stars;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">

      {}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.location.href = '/'}>
            <div className="w-9 h-9 bg-teal-600/10 text-teal-600 border border-teal-500/10 rounded-xl flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-inner">
              <FaHeartbeat className="animate-pulse" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Rural HealthCare</span>
          </div>
          <button
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold transition-all shadow-sm cursor-pointer"
            onClick={() => window.location.href = '/'}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
        </div>
      </header>

      {}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Book an Appointment</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider">Schedule a consult with expert doctors</p>
        </div>

        {}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5">
            <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
              Appointment Details
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">

              {}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Patient Name *</label>
                  <input
                    type="text"
                    value={formData.patient_name}
                    onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
                    required
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Phone Number *</label>
                  <div className="relative flex items-center">
                    <FaPhone className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
                    <input
                      type="tel"
                      value={formData.patient_phone}
                      onChange={(e) => setFormData({...formData, patient_phone: e.target.value})}
                      required
                      placeholder="Enter mobile number"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5 block">Select Doctor *</label>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                  {loadingDoctors ? (
                    <div className="text-center py-6 text-slate-500 font-semibold text-xs animate-pulse">Loading doctors list...</div>
                  ) : doctors.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">No doctors available currently</div>
                  ) : (
                    doctors.map((doctor) => {
                      const doctorName = doctor.user ?
                        `Dr. ${doctor.user.first_name} ${doctor.user.last_name}` :
                        doctor.name || 'Unknown Doctor';
                      const specialty = doctor.specialization || doctor.specialty || 'Specialist';
                      const experience = doctor.experience_years || 0;
                      const rating = Number(doctor.average_rating || doctor.rating || 0);
                      const isSelected = selectedDoctor === doctor.id;

                      return (
                        <div
                          key={doctor.id}
                          className={`flex gap-4 p-4 bg-white border rounded-2xl cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500 shadow-md shadow-teal-900/5'
                              : 'border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                          onClick={() => setSelectedDoctor(doctor.id)}
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                            <FaUserMd />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-slate-900">{doctorName}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{specialty} • {experience} years experience</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="flex gap-0.5 text-xs">
                                {renderStars(rating)}
                              </div>
                              <span className="text-[11px] text-slate-600 font-bold">{rating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Select Date *</label>
                <div className="relative flex items-center">
                  <FaCalendar className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
                  <input
                    type="date"
                    value={formData.preferred_date}
                    onChange={(e) => setFormData({...formData, preferred_date: e.target.value})}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5 block">Select Time Slot *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot.time;
                    return (
                      <div
                        key={slot.time}
                        className={`py-3 px-2 border rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                        onClick={() => setSelectedTimeSlot(slot.time)}
                      >
                        {slot.display}
                      </div>
                    );
                  })}
                </div>
              </div>

              {}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Symptoms / Reason for Visit *</label>
                <textarea
                  value={formData.symptoms}
                  onChange={(e) => setFormData({...formData, symptoms: e.target.value})}
                  required
                  placeholder="Describe your symptoms or reason for consultation..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400 min-h-[100px] resize-y"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-extrabold transition-all shadow-md shadow-teal-600/15 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <FaCalendar /> Book Appointment
              </button>
            </form>
          </div>

          {}
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 h-fit">
            <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
              Your Appointments
            </h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {!currentUser ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">
                  Please log in to view your appointments
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">
                  No appointments yet. Book your first consultation!
                </div>
              ) : (
                appointments.map((apt) => {
                  const doctorFirstName = apt.doctor?.user?.first_name || apt.doctor_details?.user?.first_name || 'Unknown';
                  const doctorLastName = apt.doctor?.user?.last_name || apt.doctor_details?.user?.last_name || 'Doctor';


                  let badgeClass = "bg-amber-50 text-amber-600 border border-amber-200/50";
                  if (apt.status === "confirmed") badgeClass = "bg-emerald-50 text-emerald-600 border border-emerald-200/50";
                  else if (apt.status === "cancelled") badgeClass = "bg-red-50 text-red-600 border border-red-200/50";
                  else if (apt.status === "completed") badgeClass = "bg-sky-50 text-sky-600 border border-sky-200/50";

                  return (
                    <div key={apt.id} className="p-4 bg-slate-50 hover:bg-white border border-slate-200/60 hover:border-teal-500/40 rounded-2xl transition-all duration-200 hover:-translate-x-0.5">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-600">
                          <FaCalendar className="text-teal-500" />
                          {apt.preferred_date} • {apt.preferred_time}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${badgeClass}`}>
                          {apt.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 mt-2">
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-400">Patient:</span>
                          <span className="font-bold text-slate-800">{apt.patient_name}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-400">Doctor:</span>
                          <span className="font-bold text-slate-800">Dr. {doctorFirstName} {doctorLastName}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="font-semibold text-slate-400">Phone:</span>
                          <span className="font-bold text-slate-800">{apt.patient_phone}</span>
                        </p>
                        {apt.symptoms && (
                          <div className="pt-2 border-t border-slate-200/60 mt-2">
                            <span className="font-semibold text-slate-400 block mb-1">Symptoms:</span>
                            <span className="text-slate-700 italic block bg-white border border-slate-100 p-2 rounded-xl text-[11px] leading-relaxed">{apt.symptoms}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default BookAppointment;