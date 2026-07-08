import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import DoctorDashboard from './components/DoctorDashboard';
import DoctorProfile from './components/DoctorProfile';
import ChatInterface from './components/chat/ChatInterface';
import BookAppointment from './components/appointments/BookAppointment';
import HealthTracking from './components/health/HealthTracking';
import MedicineReminders from './components/medicines/MedicineReminders';
import VideoConsultation from './components/video/VideoConsultation';
import DoctorVideoConsultation from './components/video/DoctorVideoConsultation';
import Prescriptions from './components/prescriptions/Prescriptions';
import AuthSystem from "./components/auth/AuthSystem";
import DoctorPatientHealth from './components/health/DoctorPatientHealth';
import PatientDashboard from './components/PatientDashboard';
import PatientProfile from './components/PatientProfile';
import DoctorDetailPage from './components/DoctorDetailPage';
import AllDoctors from './components/AllDoctors';
import LabTests from './components/LabTests';
import AshaDashboard from './components/asha/AshaDashboard';

import PharmacistDashboard from './components/PharmacistDashboard';
import PharmacistHomepage from './components/PharmacistHomepage';
import PharmacyProductDetail from './components/PharmacyProductDetail';
import ShoppingCart from './components/ShoppingCart';
import PharmacyBrowse from './components/PharmacyBrowse';
import Orders from './components/Orders';
import Patientprescriptions from './components/prescriptions/Patientprescriptions';
import PharmacistProfile from './components/PharmacistProfile';
import PharmacySearch from './components/PharmacySearch';


import './App.css';


function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

function setCookie(name, value) {
  const d = new Date()
  d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expires = "expires=" + d.toUTCString()


  document.cookie = `${name}=${value}; ${expires}; path=/`


  document.cookie = `${name}=${value}; ${expires}; path=/; domain=${window.location.hostname}`


  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    const parts = window.location.hostname.split('.')
    if (parts.length >= 2) {
      const mainDomain = parts.slice(-2).join('.')
      document.cookie = `${name}=${value}; ${expires}; path=/; domain=.${mainDomain}`
    }
  }
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    const parts = window.location.hostname.split('.')
    if (parts.length >= 2) {
      const mainDomain = parts.slice(-2).join('.')
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${mainDomain}`
    }
  }
}

function App() {
  useEffect(() => {

    const lang = localStorage.getItem('rhc_lang') || 'en';
    document.documentElement.setAttribute('data-lang', lang);


    const currentCookie = getCookie('googtrans');
    let cookieLang = 'en';
    if (currentCookie) {
      const parts = currentCookie.split('/');
      cookieLang = parts[parts.length - 1] || 'en';
    }

    if (cookieLang !== lang) {
      if (lang === 'en') {
        deleteCookie('googtrans');
        setCookie('googtrans', '/en/en');
      } else {
        setCookie('googtrans', `/en/${lang}`);
      }
      window.location.reload();
      return;
    }


    if (!document.getElementById('gte-script')) {
      window.googleTranslateElementInit = () => {
        try {
          if (!window.google?.translate) return;
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'ml,hi,ta,te,kn,mr,or,bn,gu,pa,ur,as,en',
              autoDisplay: false,
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
            },
            'gte-hidden'
          );
        } catch (_) {}
      };

      const s = document.createElement('script');
      s.id = 'gte-script';
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      s.defer = true;
      s.onerror = () => { console.warn('Google Translate script failed to load') };
      document.head.appendChild(s);
    }
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<AuthSystem />} />
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/appointments" element={<BookAppointment />} />
          <Route path="/medicines" element={<MedicineReminders />} />
          <Route path="/teleconsult" element={<VideoConsultation />} />
          <Route path="/health-tracking" element={<HealthTracking />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor-profile" element={<DoctorProfile />} />
          <Route path="/doctor-video" element={<DoctorVideoConsultation />} />
          <Route path="/doctor-patient-health" element={<DoctorPatientHealth />} />
          <Route path="/patient-profile" element={<PatientProfile />} />

          {}
          <Route path="/patient/prescriptions" element={<Patientprescriptions />} />
          <Route path="/patient/prescriptions/:id" element={<Patientprescriptions />} />

          {}
          <Route path="/pharmacist-dashboard" element={<PharmacistDashboard />} />
          <Route path="/pharmacist-profile" element={<PharmacistProfile />} /> {}
          <Route path="/pharmacy-home" element={<PharmacistHomepage />} />

          {}
          <Route path="/pharmacy/browse" element={<PharmacyBrowse />} />

          {}
          <Route path="/doctors" element={<AllDoctors />} />
          <Route path="/doctor-detail/:doctorId" element={<DoctorDetailPage />} />

          <Route path="/pharmacy/product/:productId" element={<PharmacyProductDetail />} />
          <Route path="/pharmacy/search" element={<PharmacySearch />} />
          <Route path="/cart" element={<ShoppingCart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/lab-tests" element={<LabTests />} />
          <Route path="/asha-dashboard" element={<AshaDashboard />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;