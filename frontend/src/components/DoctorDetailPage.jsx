import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaStar,
  FaGraduationCap,
  FaBriefcase,
  FaMoneyBillWave,
  FaClock,
  FaCalendarAlt,
  FaVideo,
  FaUserMd,
  FaArrowLeft,
  FaCheckCircle,
  FaAward,
  FaHeart,
  FaThumbsUp,
  FaThumbsDown,
  FaNotesMedical,
  FaEye,
} from 'react-icons/fa';
import { doctorsAPI } from '../services/api';
import './DoctorDetailPage.css';
import Footer from './Footer';


const DoctorDetailPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    loadDoctorDetails();
  }, [doctorId]);

  const loadDoctorDetails = async () => {
    try {
      setLoading(true);
      console.log('[DoctorDetail] Loading details for doctor:', doctorId);


      const doctorResponse = await doctorsAPI.getDoctorById(doctorId);
      console.log('[DoctorDetail] Doctor response:', doctorResponse);
      setDoctor(doctorResponse);


      const profileId = doctorResponse.id;
      try {
        const ratingsResponse = await doctorsAPI.getDoctorRatings(profileId);
        console.log('[DoctorDetail] Ratings response:', ratingsResponse);

        if (ratingsResponse.success) {
          setRatings(ratingsResponse.ratings || []);
          setRatingSummary(ratingsResponse.summary || null);
        }
      } catch (err) {
        console.error('[DoctorDetail] Error loading ratings:', err);
      }

      setError(null);
    } catch (err) {
      console.error('[DoctorDetail] Error loading doctor:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const numericRating = parseFloat(rating || 0);
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<FaStar key={i} className="text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<FaStar key={i} className="text-yellow-400 opacity-60" />);
      } else {
        stars.push(<FaStar key={i} className="text-slate-200" />);
      }
    }
    return stars;
  };

  const handleBookAppointment = () => {
    navigate('/appointments', { state: { selectedDoctor: doctor } });
  };

  const handleVideoConsult = () => {
    navigate('/teleconsult', { state: { selectedDoctor: doctor } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-semibold text-sm">Loading doctor details...</p>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-2">
          <FaUserMd size={36} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-850">Doctor Not Found</h2>
        <p className="text-sm text-slate-500 max-w-sm">{error || 'Unable to load doctor details'}</p>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors mt-2"
          onClick={() => navigate('/')}
        >
          <FaArrowLeft /> Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">

      {}
      <div className="bg-white border-b border-slate-100 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <button
            className="inline-flex items-center gap-2 text-slate-600 hover:text-green-600 font-bold text-xs bg-slate-100 hover:bg-green-50 px-3.5 py-1.5 rounded-xl transition-all"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft /> Back
          </button>
        </div>
      </div>

      {}
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-md">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">

              {}
              <div className="w-32 h-32 rounded-3xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center flex-shrink-0">
                {doctor.user?.profile_picture_url ? (
                  <img
                    src={doctor.user.profile_picture_url}
                    alt={`Dr. ${doctor.user.first_name} ${doctor.user.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-slate-400">
                    <FaUserMd size={64} />
                  </div>
                )}
              </div>

              {}
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-850">Dr. {doctor.user?.first_name} {doctor.user?.last_name}</h1>
                  <p className="inline-flex px-3 py-1 bg-green-50 text-green-755 text-xs font-bold rounded-full border border-green-100 mt-2">
                    {doctor.specialization_display}
                  </p>
                </div>

                {}
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <div className="flex gap-0.5 text-yellow-405">
                    {renderStars(doctor.average_rating || 0)}
                  </div>
                  <span className="text-sm font-extrabold text-slate-800 ml-1">{parseFloat(doctor.average_rating || 0).toFixed(1)}</span>
                  <span className="text-xs text-slate-400 font-semibold">
                    ({ratingSummary?.total_ratings || 0} reviews)
                  </span>
                </div>

                {}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-bold text-slate-600">
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <FaGraduationCap className="text-green-600" />
                    <span>{doctor.qualification}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <FaBriefcase className="text-green-600" />
                    <span>{doctor.experience_years}+ Years Experience</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <FaMoneyBillWave className="text-green-600" />
                    <span>₹{doctor.consultation_fee} Fee</span>
                  </div>
                </div>

                {}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                  <button
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-705 text-white font-bold text-xs rounded-xl shadow-md shadow-green-600/10 transition-all hover:-translate-y-0.5"
                    onClick={handleBookAppointment}
                  >
                    <FaCalendarAlt /> Book Appointment
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
                    onClick={handleVideoConsult}
                  >
                    <FaVideo /> Video Consult
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>
      </section>

      {}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            <button
              className={`px-2 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'about' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-505 hover:text-green-600'}`}
              onClick={() => setActiveTab('about')}
            >
              About
            </button>
            <button
              className={`px-2 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'reviews' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-505 hover:text-green-600'}`}
              onClick={() => setActiveTab('reviews')}
            >
              Reviews ({ratingSummary?.total_ratings || 0})
            </button>
            <button
              className={`px-2 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'availability' ? 'border-green-600 text-green-600 font-extrabold' : 'border-transparent text-slate-505 hover:text-green-600'}`}
              onClick={() => setActiveTab('availability')}
            >
              Availability
            </button>
          </div>
        </div>
      </section>

      {}
      <section className="py-8 flex-1">
        <div className="max-w-6xl mx-auto px-4">

          {}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-md">

            {}
            {activeTab === 'about' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-base font-extrabold text-slate-800">About Dr. {doctor.user?.last_name}</h3>
                    <p className="text-sm text-slate-655 leading-relaxed font-medium">
                      {doctor.bio || 'Experienced medical professional dedicated to providing quality healthcare.'}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Specialization</h4>
                      <p className="text-sm font-bold text-slate-700">{doctor.specialization_display}</p>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Experience</h4>
                      <p className="text-sm font-bold text-slate-700">{doctor.experience_years}+ years of professional experience</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Qualifications &amp; Education</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-650">
                      {doctor.qualification?.split(',').map((qual, idx) => (
                        <li key={idx} className="flex items-center gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                          <FaCheckCircle className="text-green-600" size={14} />
                          <span>{qual.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {}
                <div className="bg-slate-50/70 border border-slate-150/60 rounded-2xl p-6 space-y-5">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-200/60 pb-3">Consultation Overview</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consultation Fee</span>
                      <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">₹{doctor.consultation_fee}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                      <FaMoneyBillWave size={18} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Consultations</span>
                      <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">{doctor.total_consultations || 0}+ Completed</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
                      <FaAward size={18} />
                    </div>
                  </div>

                  {ratingSummary && (
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recommendation Rate</span>
                        <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">{ratingSummary.recommend_percentage || 0}% positive</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                        <FaHeart size={18} />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-705 text-white font-bold text-xs rounded-xl shadow shadow-green-600/15 transition-all hover:-translate-y-0.5 cursor-pointer"
                      onClick={handleBookAppointment}
                    >
                      <FaCalendarAlt size={12} /> Book Appointment
                    </button>
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow shadow-indigo-600/15 transition-all hover:-translate-y-0.5 cursor-pointer"
                      onClick={handleVideoConsult}
                    >
                      <FaVideo size={12} /> Video Consult
                    </button>
                  </div>
                </div>
              </div>
            )}

            {}
            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {ratingSummary && (
                  <div className="bg-slate-50/70 border border-slate-150/60 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-200/60">
                      <span className="text-5xl font-extrabold text-slate-800 leading-none mb-2">
                        {parseFloat(doctor.average_rating || 0).toFixed(1)}
                      </span>
                      <div className="flex gap-0.5 text-yellow-405 mb-2">
                        {renderStars(doctor.average_rating || 0)}
                      </div>
                      <span className="text-xs text-slate-500 font-semibold">
                        Based on {ratingSummary.total_ratings} reviews
                      </span>
                    </div>

                    <div className="md:col-span-2 space-y-2 p-2">
                      <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Rating Distribution</h4>
                      {[5, 4, 3, 2, 1].map(star => {
                        const count = ratingSummary.rating_distribution?.[star] || 0;
                        const percentage = ratingSummary.total_ratings > 0
                          ? (count / ratingSummary.total_ratings * 100).toFixed(0)
                          : 0;

                        return (
                          <div key={star} className="flex items-center gap-4 text-xs font-semibold text-slate-705">
                            <span className="w-8 flex items-center gap-1">
                              {star} <FaStar size={10} color="#fbbf24" />
                            </span>
                            <div className="flex-1 h-2 bg-slate-200/80 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-405 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="w-6 text-right text-slate-500">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {}
                <div className="space-y-6 mt-6">
                  <h3 className="text-base font-bold text-slate-800">Patient Reviews</h3>

                  {ratings.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <FaStar size={48} className="mx-auto mb-3 text-slate-350" />
                      <p className="text-sm font-semibold">No reviews yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {ratings.map(rating => (
                        <div key={rating.id} className="py-6 first:pt-0 last:pb-0 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-bold">
                                {rating.patient_name?.charAt(0) || 'P'}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{rating.patient_name || 'Anonymous'}</h4>
                                <span className="text-xs text-slate-400 font-semibold">
                                  {new Date(rating.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-0.5">
                              {renderStars(rating.rating)}
                            </div>
                          </div>

                          {rating.review && (
                            <p className="text-sm text-slate-655 font-medium leading-relaxed bg-slate-50/70 p-4 rounded-2xl border-l-4 border-green-500 italic">
                              "{rating.review}"
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                            {rating.pros && (
                              <div className="flex items-start gap-2 text-green-755 bg-green-50/50 px-3.5 py-2.5 rounded-xl border border-green-100">
                                <FaThumbsUp size={12} className="mt-0.5 flex-shrink-0" />
                                <div><strong className="text-green-950 font-bold">What they liked:</strong> {rating.pros}</div>
                              </div>
                            )}
                            {rating.cons && (
                              <div className="flex items-start gap-2 text-red-700 bg-red-50/50 px-3.5 py-2.5 rounded-xl border border-red-100">
                                <FaThumbsDown size={12} className="mt-0.5 flex-shrink-0" />
                                <div><strong className="text-red-955 font-bold">Areas to improve:</strong> {rating.cons}</div>
                              </div>
                            )}
                          </div>

                          {rating.would_recommend && (
                            <div className="flex justify-end pt-1">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-755 text-xs font-bold rounded-full border border-green-100">
                                <FaCheckCircle size={10} /> Recommends this doctor
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {}
            {activeTab === 'availability' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Available Days</h3>
                  <div className="flex flex-wrap gap-2">
                    {doctor.available_days && doctor.available_days.length > 0 ? (
                      doctor.available_days.map((day, idx) => (
                        <div key={idx} className="px-3.5 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-xl border border-green-100">
                          {day}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold">Contact for availability</p>
                    )}
                  </div>
                </div>

                {}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Available Time Slots</h3>
                  <div className="flex flex-col gap-2">
                    {doctor.available_time_slots && doctor.available_time_slots.length > 0 ? (
                      doctor.available_time_slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-650">
                          <FaClock className="text-green-600" /> {slot}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold">Contact for time slots</p>
                    )}
                  </div>
                </div>

                {}
                <div className="bg-green-50/30 border border-green-200/50 p-6 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-green-950">Book Your Appointment</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2">
                      Choose your preferred date and time to consult with Dr. {doctor.user?.last_name}
                    </p>
                  </div>
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-705 text-white font-bold text-xs rounded-xl shadow shadow-green-600/10 transition-all hover:-translate-y-0.5 cursor-pointer"
                    onClick={handleBookAppointment}
                  >
                    <FaCalendarAlt /> Book Now
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>
      </section>

      <Footer />

    </div>
  );
};

export default DoctorDetailPage;