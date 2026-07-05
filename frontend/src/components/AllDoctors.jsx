import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaStar,
  FaUserMd,
  FaGraduationCap,
  FaBriefcase,
  FaMoneyBillWave,
  FaSearch,
  FaFilter,
  FaArrowLeft,
} from 'react-icons/fa';
import { doctorsAPI } from '../services/api';
import './AllDoctors.css';
import Footer from './Footer';

const AllDoctors = () => {
  const navigate = useNavigate();
  
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('all');
  const [sortBy, setSortBy] = useState('rating'); // rating, experience, fee
  
  // Specializations for filter
  const specializations = [
    { value: 'all', label: 'All Specializations' },
    { value: 'general', label: 'General Physician' },
    { value: 'cardiologist', label: 'Cardiologist' },
    { value: 'dermatologist', label: 'Dermatologist' },
    { value: 'pediatrician', label: 'Pediatrician' },
    { value: 'orthopedic', label: 'Orthopedic' },
    { value: 'gynecologist', label: 'Gynecologist' },
    { value: 'psychiatrist', label: 'Psychiatrist' },
    { value: 'neurologist', label: 'Neurologist' },
  ];

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    filterAndSortDoctors();
  }, [doctors, searchTerm, selectedSpecialization, sortBy]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      console.log('[AllDoctors] Loading all doctors...');
      
      const response = await doctorsAPI.getAllDoctors();
      console.log('[AllDoctors] Response:', response);
      
      let doctorsList = [];
      if (Array.isArray(response)) {
        doctorsList = response;
      } else if (response && Array.isArray(response.results)) {
        doctorsList = response.results;
      }
      
      console.log('[AllDoctors] Loaded doctors:', doctorsList.length);
      setDoctors(doctorsList);
      setError(null);
    } catch (err) {
      console.error('[AllDoctors] Error loading doctors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortDoctors = () => {
    let filtered = [...doctors];
    
    // Filter by search term (name)
    if (searchTerm) {
      filtered = filtered.filter(doctor => {
        const fullName = `${doctor.user?.first_name || ''} ${doctor.user?.last_name || ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      });
    }
    
    // Filter by specialization
    if (selectedSpecialization !== 'all') {
      filtered = filtered.filter(doctor => doctor.specialization === selectedSpecialization);
    }
    
    // Sort doctors
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (parseFloat(b.average_rating || 0) - parseFloat(a.average_rating || 0));
        case 'experience':
          return (b.experience_years || 0) - (a.experience_years || 0);
        case 'fee':
          return (parseFloat(a.consultation_fee || 0) - parseFloat(b.consultation_fee || 0));
        default:
          return 0;
      }
    });
    
    setFilteredDoctors(filtered);
  };

  const renderStars = (rating) => {
    const numericRating = parseFloat(rating || 0);
    const stars = [];
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<FaStar key={i} className="text-amber-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<FaStar key={i} className="text-amber-400/60" />);
      } else {
        stars.push(<FaStar key={i} className="text-slate-200" />);
      }
    }
    return stars;
  };

  const handleDoctorClick = (doctor) => {
    console.log('[AllDoctors] Doctor clicked:', doctor);
    navigate(`/doctor-detail/${doctor.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading doctors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 py-20 px-4 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl shadow-md">
          <FaUserMd />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Error Loading Doctors</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-md">{error}</p>
        </div>
        <button 
          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10" 
          onClick={loadDoctors}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="all-doctors-page min-h-screen bg-gradient-to-b from-teal-50/30 via-slate-50 to-white text-slate-800 flex flex-col justify-between">
      
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white py-16 md:py-20 px-4 md:px-8 shadow-lg shadow-teal-900/10">
        {/* Glow overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <button 
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-white text-xs font-bold transition-all hover:-translate-x-1 shadow-sm"
            onClick={() => navigate('/')}
          >
            <FaArrowLeft /> Back to Home
          </button>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mt-6 mb-2">Our Doctors</h1>
          <p className="text-sm md:text-lg text-teal-100 font-medium max-w-2xl">Find the right doctor for your healthcare needs and schedule a virtual or in-person consultation.</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 py-6 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Bar */}
            <div className="relative flex items-center">
              <FaSearch className="absolute left-4 text-teal-600 text-base pointer-events-none" />
              <input
                type="text"
                placeholder="Search by doctor name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all shadow-inner"
              />
            </div>

            {/* Specialization Filter */}
            <div className="relative flex items-center">
              <FaFilter className="absolute left-4 text-teal-600 text-base pointer-events-none" />
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all cursor-pointer appearance-none"
              >
                {specializations.map(spec => (
                  <option key={spec.value} value={spec.value}>
                    {spec.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 pointer-events-none border-l border-slate-200 pl-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Sort By */}
            <div className="relative flex items-center">
              <div className="w-full flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 focus-within:bg-white transition-all">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer w-full py-0.5 appearance-none"
                >
                  <option value="rating">Highest Rated</option>
                  <option value="experience">Most Experienced</option>
                  <option value="fee">Lowest Fee</option>
                </select>
                <div className="pointer-events-none border-l border-slate-200 pl-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-xs font-semibold text-slate-500">
            Showing <strong className="text-teal-600 font-extrabold">{filteredDoctors.length}</strong> of <strong className="text-slate-700 font-extrabold">{doctors.length}</strong> doctors
          </div>
        </div>
      </div>

      {/* Doctors Grid */}
      <div className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-12 w-full">
        {filteredDoctors.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner animate-pulse">
              <FaUserMd />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No doctors found</h3>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDoctors.map((doctor, index) => (
              <div
                key={doctor.id}
                className="bg-white rounded-3xl border border-slate-100/80 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-teal-500/30 transition-all duration-300 flex flex-col group cursor-pointer"
                onClick={() => handleDoctorClick(doctor)}
              >
                {/* Doctor Image */}
                <div className="relative w-full h-56 bg-gradient-to-br from-teal-50/50 to-emerald-50/50 overflow-hidden flex items-center justify-center border-b border-slate-50">
                  {doctor.user?.profile_picture_url ? (
                    <img
                      src={doctor.user.profile_picture_url}
                      alt={`Dr. ${doctor.user.first_name} ${doctor.user.last_name}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-full h-full flex items-center justify-center bg-teal-50/30 text-teal-600/30 text-5xl"
                    style={{ display: doctor.user?.profile_picture_url ? 'none' : 'flex' }}
                  >
                    <FaUserMd />
                  </div>

                  {/* Availability Badge */}
                  {doctor.is_available && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md shadow-emerald-500/25 tracking-wide animate-pulse">
                      Available
                    </div>
                  )}
                </div>

                {/* Doctor Info */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-600 transition-colors duration-200">
                    Dr. {doctor.user?.first_name} {doctor.user?.last_name}
                  </h3>
                  <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mt-1 mb-3">
                    {doctor.specialization_display}
                  </p>

                  {/* Rating */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2 mb-6 w-fit">
                    <div className="flex gap-0.5 text-amber-400 text-xs">
                      {renderStars(doctor.average_rating)}
                    </div>
                    <span className="text-xs font-extrabold text-slate-800">
                      {parseFloat(doctor.average_rating || 0).toFixed(1)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      ({doctor.total_consultations || 0} consultations)
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex flex-col items-center text-center p-2 bg-slate-50/60 rounded-2xl border border-slate-100/50">
                      <FaGraduationCap className="text-teal-600 text-base mb-1" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Degree</span>
                      <span className="text-xs font-extrabold text-slate-700 truncate w-full" title={doctor.qualification}>
                        {doctor.qualification}
                      </span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2 bg-slate-50/60 rounded-2xl border border-slate-100/50">
                      <FaBriefcase className="text-teal-600 text-base mb-1" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Experience</span>
                      <span className="text-xs font-extrabold text-slate-700 truncate w-full">
                        {doctor.experience_years}+ Years
                      </span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2 bg-slate-50/60 rounded-2xl border border-slate-100/50">
                      <FaMoneyBillWave className="text-teal-600 text-base mb-1" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Fee</span>
                      <span className="text-xs font-extrabold text-slate-700 truncate w-full">
                        ₹{doctor.consultation_fee}
                      </span>
                    </div>
                  </div>

                  {/* View Profile Button */}
                  <button className="w-full mt-4 py-3 bg-teal-600 group-hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 flex items-center justify-center gap-1.5">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AllDoctors;