import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaHeart, FaRobot, FaVideo, FaShoppingCart, FaCalendarCheck, 
  FaFileMedical, FaAmbulance, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt,
  FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn, FaHeartbeat
} from 'react-icons/fa';
import './Footer.css';

export default function Footer() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  // Get user context if logged in
  let user = null;
  try {
    const userData = localStorage.getItem('user');
    if (userData) user = JSON.parse(userData);
  } catch (e) {
    // silent
  }

  const isDoctorLoggedIn = user?.user_type === 'doctor';
  const isPatientLoggedIn = user?.user_type === 'patient';

  return (
    <footer className="footer-container bg-slate-950 text-slate-300 border-t border-slate-900">
      
      {/* Emergency Response Alert Row */}
      <div className="emergency-bar rural-emergency-box max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-red-950/20 border border-red-900/30 rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-4 text-center lg:text-left flex-col lg:flex-row">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 text-xl animate-pulse">
              <FaAmbulance />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-red-400">Medical Emergency?</h3>
              <p className="text-xs md:text-sm text-slate-400">Call these helpline numbers immediately for urgent medical assistance</p>
            </div>
          </div>
          <div className="flex flex-row gap-4 w-full lg:w-auto">
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/90 border border-red-900/20 rounded-2xl px-4 py-3 min-w-[100px] shadow-sm hover:border-red-500/50 transition-all duration-300">
              <strong className="text-xl font-black text-red-500">108</strong>
              <span className="text-[9px] text-red-400/80 font-extrabold uppercase tracking-wider mt-0.5">Ambulance</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/90 border border-red-900/20 rounded-2xl px-4 py-3 min-w-[100px] shadow-sm hover:border-red-500/50 transition-all duration-300">
              <strong className="text-xl font-black text-red-500">102</strong>
              <span className="text-[9px] text-red-400/80 font-extrabold uppercase tracking-wider mt-0.5">Medical Help</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 border-b border-slate-900 pb-12 mb-8">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <FaHeartbeat className="text-2xl text-green-500" />
              <h3 className="text-lg font-extrabold text-white tracking-tight">Rural HealthCare</h3>
            </div>

            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Making quality healthcare accessible to everyone in rural India through technology, digital consultations, and genuine medicines.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="social-icon-link bg-slate-900 hover:bg-green-500 text-slate-400 hover:text-white transition-all">
                <FaFacebookF size={13} />
              </a>
              <a href="#" className="social-icon-link bg-slate-900 hover:bg-green-500 text-slate-400 hover:text-white transition-all">
                <FaTwitter size={13} />
              </a>
              <a href="#" className="social-icon-link bg-slate-900 hover:bg-green-500 text-slate-400 hover:text-white transition-all">
                <FaInstagram size={13} />
              </a>
              <a href="#" className="social-icon-link bg-slate-900 hover:bg-green-500 text-slate-400 hover:text-white transition-all">
                <FaLinkedinIn size={13} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest border-l-2 border-green-500 pl-3">Quick Links</h4>
            <ul className="space-y-3 mt-4 text-xs md:text-sm text-slate-400 p-0 m-0 list-none">
              <li>
                <span onClick={() => navigate('/')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Home</span>
              </li>
              <li>
                <span onClick={() => navigate('/')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Services &amp; Features</span>
              </li>
              <li>
                <span onClick={() => navigate('/chat')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">AI Chat Assistant</span>
              </li>
              <li>
                <span onClick={() => navigate(user?.user_type === 'pharmacist' ? '/pharmacy-home' : '/pharmacy/browse')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Pharmacy Shop</span>
              </li>
              {isPatientLoggedIn && (
                <li>
                  <span onClick={() => navigate('/patient/prescriptions')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">My Prescriptions</span>
                </li>
              )}
              {isDoctorLoggedIn && (
                <li>
                  <span onClick={() => navigate('/prescriptions')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Prescription Center</span>
                </li>
              )}
            </ul>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest border-l-2 border-green-500 pl-3">Services</h4>
            <ul className="space-y-3 mt-4 text-xs md:text-sm text-slate-400 p-0 m-0 list-none">
              <li className="flex items-center gap-2">
                <FaRobot className="text-green-500 text-xs flex-shrink-0" />
                <span onClick={() => navigate('/chat')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">AI Consultation</span>
              </li>
              <li className="flex items-center gap-2">
                <FaVideo className="text-green-500 text-xs flex-shrink-0" />
                <span onClick={() => navigate('/teleconsult')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Video Consult</span>
              </li>
              {!isDoctorLoggedIn && (
                <li className="flex items-center gap-2">
                  <FaCalendarCheck className="text-green-500 text-xs flex-shrink-0" />
                  <span onClick={() => navigate('/appointments')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Doctor Appointments</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <FaShoppingCart className="text-green-500 text-xs flex-shrink-0" />
                <span onClick={() => navigate('/pharmacy/browse')} className="hover:text-green-500 cursor-pointer transition-colors duration-150">Buy Medicines Online</span>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest border-l-2 border-green-500 pl-3">Get in Touch</h4>
            <ul className="space-y-3.5 mt-4 text-xs md:text-sm text-slate-400 p-0 m-0 list-none">
              <li className="flex items-start gap-3">
                <FaMapMarkerAlt className="text-green-500 flex-shrink-0 mt-0.5" />
                <span>123 Rural Healthcare HQ, Main Clinic Center, IN</span>
              </li>
              <li className="flex items-center gap-3">
                <FaPhoneAlt className="text-green-500 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3">
                <FaEnvelope className="text-green-500 flex-shrink-0" />
                <span>support@ruralhealthcare.org</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Copyright Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-2">
          <div>
            &copy; {currentYear} Rural HealthCare. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            Made with <FaHeart className="text-red-500 animate-pulse" /> for Rural Communities
          </div>
        </div>

      </div>
    </footer>
  );
}
