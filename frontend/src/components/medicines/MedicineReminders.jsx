


import React, { useState, useEffect, useRef } from 'react';
import { healthTrackingAPI, authAPI } from '../../services/api';
import {
  saveRemindersOffline,
  getOfflineReminders,
  saveReminderOffline,
  deleteReminderOffline,
  logMedicationOffline,
  queueOfflineAction,
  getPendingLogs,
  openMediDB,
} from '../../services/indexedDB';
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  startReminderScheduler,
  stopReminderScheduler,
  setupOnlineOfflineHandlers,
  syncPendingData,
  syncAuthTokenToSW,
  setSoundEnabled,
} from '../../services/pwaService';
import { FaPlus, FaCheck, FaTrash, FaRobot, FaExclamationTriangle, FaHeartbeat, FaArrowLeft, FaClock, FaBell, FaVolumeMute, FaVolumeUp, FaCloudDownloadAlt, FaInfoCircle, FaEnvelope } from 'react-icons/fa';
import Footer from '../Footer';
import './MedicineReminders.css';




async function fetchAdherencePrediction(patientId, reminders) {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/medication-reminders/adherence-prediction/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ patient_id: patientId, reminders }),
      }
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}




const MedicineReminders = () => {
  const [showModal, setShowModal]               = useState(false);
  const [medicines, setMedicines]               = useState([]);
  const [selectedTimes, setSelectedTimes]       = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [isOffline, setIsOffline]               = useState(!navigator.onLine);
  const [pendingCount, setPendingCount]         = useState(0);
  const [syncing, setSyncing]                   = useState(false);
  const [lastSynced, setLastSynced]             = useState(null);
  const [notifPermission, setNotifPermission]   = useState(getNotificationPermission());
  const [soundOn, setSoundOn]                   = useState(true);
  const [swRegistered, setSwRegistered]         = useState(false);
  const [adherencePrediction, setAdherencePrediction] = useState(null);
  const [showAdherence, setShowAdherence]       = useState(false);
  const [insightsEmailLoading, setInsightsEmailLoading] = useState(false);
  const [insightsEmailSent, setInsightsEmailSent]       = useState(false);
  const [syncStatus, setSyncStatus]             = useState('');
  const [takenToday, setTakenToday]             = useState({});
  const [installPrompt, setInstallPrompt]       = useState(null);
  const [formData, setFormData] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    meal_timing: '',
    duration: '',
    notes: '',
    email_reminders_enabled: false,
  });
  const [testEmailLoading, setTestEmailLoading] = useState({});
  const [timeInput, setTimeInput] = useState('');
  const [activePopups, setActivePopups] = useState([]);

  const medicinesRef = useRef(medicines);
  useEffect(() => { medicinesRef.current = medicines; }, [medicines]);

  const user = authAPI.getCurrentUser();

  useEffect(() => {
    initPWA();
    loadMedicines();
    loadTodayLogs();
    checkPendingCount();

    const handleBeforeInstall = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleMedicationTaken = (e) => {
      const { reminderId } = e.detail;
      setTakenToday((prev) => ({ ...prev, [reminderId]: true }));
      setActivePopups((prev) => prev.filter(p => p.reminder.id !== reminderId));
    };
    window.addEventListener('medicationTakenFromNotification', handleMedicationTaken);

    const handleActiveReminder = (e) => {
      const { reminder, slot } = e.detail;
      const popupId = `${reminder.id}_${slot}`;
      setActivePopups((prev) => {
        if (prev.some((p) => p.id === popupId)) return prev;
        return [...prev, { reminder, slot, id: popupId }];
      });
    };
    window.addEventListener('medicationReminderActive', handleActiveReminder);

    const handleSynced = () => { checkPendingCount(); setLastSynced(new Date()); };
    window.addEventListener('medicationSynced', handleSynced);

    const cleanup = setupOnlineOfflineHandlers(
      async () => {
        setIsOffline(false);
        setSyncing(true);
        setSyncStatus('Syncing data...');
        const result = await syncPendingData();
        setSyncing(false);
        setSyncStatus(result.synced > 0 ? `Synced ${result.synced} records` : 'Up to date');
        setLastSynced(new Date());
        await checkPendingCount();
        await loadMedicines(true);
      },
      () => { setIsOffline(true); setSyncStatus('Offline mode'); }
    );

    return () => {
      stopReminderScheduler();
      cleanup();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('medicationTakenFromNotification', handleMedicationTaken);
      window.removeEventListener('medicationReminderActive', handleActiveReminder);
      window.removeEventListener('medicationSynced', handleSynced);
    };
  }, []);

  useEffect(() => {
    if (medicines.length > 0) {
      const stop = startReminderScheduler(() => medicinesRef.current);
      return stop;
    }
  }, [medicines]);

  async function initPWA() {
    const reg = await registerServiceWorker();
    if (reg) { setSwRegistered(true); await syncAuthTokenToSW(); }
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  }

  const loadMedicines = async (forceOnline = false) => {
    try {
      setLoading(true);
      if (navigator.onLine || forceOnline) {
        const response = await healthTrackingAPI.getReminders(user?.id, true);
        const data = Array.isArray(response) ? response : [];
        setMedicines(data);
        await saveRemindersOffline(data);
        setLastSynced(new Date());
        setSyncStatus('Data synced');
      } else {
        const cached = await getOfflineReminders();
        setMedicines(cached);
        setSyncStatus('Showing cached data');
      }
    } catch (error) {
      console.error('[MedicineReminders] Error loading:', error);
      try {
        const cached = await getOfflineReminders();
        setMedicines(cached);
        setSyncStatus('Using offline data');
      } catch { setMedicines([]); }
    } finally { setLoading(false); }
  };

  const loadTodayLogs = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const db = await openMediDB();
      const tx = db.transaction('logs', 'readonly');
      const store = tx.objectStore('logs');
      const dateIndex = store.index('date');
      const logs = await new Promise((resolve, reject) => {
        const req = dateIndex.getAll(today);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror  = () => reject(req.error);
      });
      const takenMap = {};
      logs.forEach((log) => { if (log.status === 'taken') takenMap[log.reminderId] = true; });
      setTakenToday(takenMap);
    } catch (err) { console.warn('[MedicineReminders] loadTodayLogs error:', err); }
  };

  const checkPendingCount = async () => {
    try { const logs = await getPendingLogs(); setPendingCount(logs.length); }
    catch { setPendingCount(0); }
  };

  const loadAdherencePrediction = async () => {
    if (!user || medicines.length === 0) return;
    setShowAdherence(true);
    setInsightsEmailSent(false);
    const prediction = await fetchAdherencePrediction(user.id, medicines);
    if (prediction) setAdherencePrediction(prediction);
  };

  const sendInsightsEmail = async () => {
    setInsightsEmailLoading(true);
    setInsightsEmailSent(false);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/medication-reminders/send-ai-insights-email/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      const data = await response.json();
      if (response.ok && data.success) {
        setInsightsEmailSent(data.email);
      } else {
        alert(`❌ ${data.error || 'Failed to send AI Insights email.'}`);
      }
    } catch (err) {
      alert('❌ Network error while sending AI Insights email.');
    } finally {
      setInsightsEmailLoading(false);
    }
  };

  const addMedicine = async (e) => {
    e.preventDefault();
    if (selectedTimes.length === 0) { alert('⚠️ Please select at least one reminder time'); return; }
    const durationDays = parseInt(formData.duration, 10);
    if (!durationDays || durationDays < 1) { alert('⚠️ Please enter a valid duration (at least 1 day)'); return; }
    if (!user) { alert('❌ Please log in to add medicine reminders'); return; }

    const startDate = new Date();
    const endDate   = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const reminderData = {
      patient: user.id,
      medication_name: formData.medication_name,
      dosage: formData.dosage,
      frequency: formData.frequency,
      time_slots: selectedTimes,
      start_date: startDate.toISOString().split('T')[0],
      end_date:   endDate.toISOString().split('T')[0],
      notes: formData.notes,
      meal_timing: formData.meal_timing,
      is_active: true,
      reminder_enabled: true,
      email_reminders_enabled: formData.email_reminders_enabled,
    };

    try {
      if (navigator.onLine) {
        const created = await healthTrackingAPI.createReminder(reminderData);
        setMedicines((prev) => [...prev, created]);
        await saveReminderOffline(created);
        setSyncStatus('Reminder saved');
      } else {
        const tempId = `temp_${Date.now()}`;
        const tempReminder = { ...reminderData, id: tempId, _is_offline: true };
        setMedicines((prev) => [...prev, tempReminder]);
        await saveReminderOffline(tempReminder);
        await queueOfflineAction('CREATE_REMINDER', reminderData);
        setPendingCount((c) => c + 1);
        setSyncStatus('Saved offline – will sync when connected');
        alert(`Saved offline! "${formData.medication_name}" will sync when you're back online.`);
      }
      closeModal();
    } catch (error) {
      console.error('[MedicineReminders] Error creating:', error);
      const tempId = `temp_${Date.now()}`;
      const tempReminder = { ...reminderData, id: tempId, _is_offline: true };
      setMedicines((prev) => [...prev, tempReminder]);
      await saveReminderOffline(tempReminder);
      await queueOfflineAction('CREATE_REMINDER', reminderData);
      setPendingCount((c) => c + 1);
      closeModal();
      setSyncStatus('Saved offline – will sync when connected');
    }
  };

  const markTaken = async (medicine) => {
    if (!medicine?.id) return;
    const now          = new Date();
    const todayStr     = now.toISOString().split('T')[0];
    const hh           = String(now.getHours()).padStart(2, '0');
    const mm           = String(now.getMinutes()).padStart(2, '0');
    const scheduledTime = `${todayStr}T${hh}:${mm}:00`;

    setTakenToday((prev) => ({ ...prev, [medicine.id]: true }));

    if (navigator.onLine) {
      try {
        await healthTrackingAPI.logMedicationIntake(medicine.id, {
          status: 'taken', taken_at: now.toISOString(), scheduled_time: scheduledTime,
        });
        setSyncStatus('Logged to server');
        await logMedicationOffline({ reminderId: medicine.id, status: 'taken', scheduledTime, takenAt: now.toISOString(), synced: true });
      } catch (err) {
        console.error('[markTaken] Server log failed:', err);
        await logMedicationOffline({ reminderId: medicine.id, status: 'taken', scheduledTime, takenAt: now.toISOString(), synced: false });
        await queueOfflineAction('LOG_INTAKE', { reminderId: medicine.id, status: 'taken', taken_at: now.toISOString(), scheduled_time: scheduledTime });
        setPendingCount((c) => c + 1);
        setSyncStatus('Server error — saved offline, will retry');
      }
    } else {
      try {
        await logMedicationOffline({ reminderId: medicine.id, status: 'taken', scheduledTime, takenAt: now.toISOString(), synced: false });
        await queueOfflineAction('LOG_INTAKE', { reminderId: medicine.id, status: 'taken', taken_at: now.toISOString(), scheduled_time: scheduledTime });
        setPendingCount((c) => c + 1);
        setSyncStatus('Logged offline — will sync when connected');
      } catch (offlineErr) {
        console.error('[markTaken] Offline save failed:', offlineErr);
        setTakenToday((prev) => ({ ...prev, [medicine.id]: false }));
        setSyncStatus('Could not save — please try again');
      }
    }
  };

  const deleteMedicine = async (medicineId) => {
    const medicine = medicines.find((m) => m.id === medicineId);
    if (!window.confirm(`Delete "${medicine?.medication_name}"?`)) return;
    setMedicines((prev) => prev.filter((m) => m.id !== medicineId));
    await deleteReminderOffline(medicineId);
    try {
      if (navigator.onLine && !String(medicineId).startsWith('temp_')) {
        await healthTrackingAPI.deleteReminder(medicineId);
        setSyncStatus('Deleted');
      } else if (!navigator.onLine) {
        await queueOfflineAction('DELETE_REMINDER', { id: medicineId });
        setPendingCount((c) => c + 1);
        setSyncStatus('Queued for deletion');
      }
    } catch (err) { console.error('[deleteMedicine] Error:', err); }
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) { setSyncStatus('No internet connection'); return; }
    setSyncing(true); setSyncStatus('Syncing...');
    const result = await syncPendingData();
    await loadMedicines(true);
    await checkPendingCount();
    setSyncing(false);
    setLastSynced(new Date());
    setSyncStatus(result.synced > 0 ? `Synced ${result.synced} records` : 'All up to date');
  };

  const requestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') setSyncStatus('Notifications enabled!');
  };

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstallPrompt(null); setSyncStatus('App installed!'); }
  };

  const openModal  = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    setFormData({
      medication_name: '',
      dosage: '',
      frequency: '',
      meal_timing: '',
      duration: '',
      notes: '',
      email_reminders_enabled: false,
    });
    setSelectedTimes([]);
    setTimeInput('');
  };

  const sendTestEmail = async (medicine) => {
    if (!medicine?.id || String(medicine.id).startsWith('temp_')) {
      alert('⚠️ Please sync this reminder before sending a test email.');
      return;
    }
    setTestEmailLoading((prev) => ({ ...prev, [medicine.id]: true }));
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/medication-reminders/${medicine.id}/send-test-email/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      const data = await response.json();
      if (response.ok && data.success) {
        alert(`✅ Test email sent to ${data.email}\n\nCheck your inbox!`);
      } else {
        alert(`❌ ${data.error || 'Failed to send email. Make sure your account has a valid email address.'}`);
      }
    } catch (err) {
      alert('❌ Network error while sending test email.');
    } finally {
      setTestEmailLoading((prev) => ({ ...prev, [medicine.id]: false }));
    }
  };

  const takenCount    = Object.values(takenToday).filter(Boolean).length;
  const totalDoses    = medicines.reduce((s, m) => s + (m.time_slots?.length || 0), 0);
  const adherenceRate = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 100;

  const addTime = () => {
    const t = timeInput.trim();
    if (!t) return;
    if (selectedTimes.includes(t)) return;
    setSelectedTimes((prev) => [...prev, t].sort());
    setTimeInput('');
  };

  const removeTime = (t) => setSelectedTimes((prev) => prev.filter((x) => x !== t));

  const getTimeLabel = (time) => {
    const h = parseInt(time?.split(':')[0] ?? '0');
    if (h < 6)  return 'Early';
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    if (h < 21) return 'Evening';
    return 'Night';
  };

  const formatMealTiming = (t) =>
    ({ before: '🍽 Before meals', after: '🍽 After meals', with: '🍽 With meals', anytime: '⏱ Anytime' })[t] || t;

  const formatLastSync = (d) => {
    if (!d) return 'Never';
    const diff = Date.now() - d.getTime();
    if (diff < 60000)   return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return d.toLocaleTimeString();
  };

  const colors = [
    'from-teal-500/20 to-emerald-500/10 border-teal-500/30',
    'from-rose-500/20 to-orange-500/10 border-rose-500/30',
    'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
    'from-violet-500/20 to-purple-500/10 border-violet-500/30',
    'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
    'from-cyan-500/20 to-teal-500/10 border-cyan-500/30'
  ];

  if (loading && medicines.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <FaHeartbeat className="w-12 h-12 text-teal-600 animate-pulse mx-auto" />
          <h2 className="mt-6 text-xl font-bold text-slate-850">Rural HealthCare</h2>
          <p className="mt-2 text-xs text-slate-505 font-semibold uppercase tracking-wider">Syncing PWA Reminders Cache...</p>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Medicine Reminders</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-2 font-bold uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              {isOffline ? (
                <span className="text-rose-650 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">📵 Working Offline</span>
              ) : (
                <span className="text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">🌐 PWA Online</span>
              )}
              <span>• Smart alerts • Offline sync support • AI adherence telemetry</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {notifPermission !== 'granted' && (
              <button
                onClick={requestPermission}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
              >
                <FaBell /> Enable Alerts
              </button>
            )}

            <button
              onClick={() => { setSoundOn(s => { setSoundEnabled(!s); return !s; }); }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
              title={soundOn ? 'Mute reminder sounds' : 'Enable sounds'}
            >
              {soundOn ? <FaVolumeUp size={13} /> : <FaVolumeMute size={13} />}
            </button>

            <button
              onClick={handleManualSync}
              disabled={syncing || isOffline}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-650 shadow-sm cursor-pointer disabled:opacity-50 ${syncing ? 'animate-pulse' : ''}`}
            >
              <FaCloudDownloadAlt className={syncing ? 'animate-spin-slow' : ''} /> {syncing ? 'Syncing...' : 'Sync Cache'}
            </button>

            {installPrompt && (
              <button
                onClick={handleInstallPWA}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                📲 Install App
              </button>
            )}

            <button
              onClick={loadAdherencePrediction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer shadow-sm"
            >
              <FaRobot className="text-teal-655" /> AI Insights
            </button>

            <button
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
            >
              <FaPlus /> Add Medicine
            </button>
          </div>
        </div>

        {}
        {syncStatus && (
          <div className={`mb-8 p-3 rounded-2xl text-xs font-bold text-center border ${
            isOffline ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-teal-50 border-teal-200 text-teal-600'
          }`}>
            {syncStatus}
          </div>
        )}

        {}
        {notifPermission === 'denied' && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200/60 text-amber-850 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
            <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Notifications are currently blocked.</strong> Please enable notifications in your browser's page settings to receive popups for your schedules.
            </div>
          </div>
        )}

        {/* Statistics Panels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg">💊</span>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">{medicines.length}</span>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">Medicines</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-lg">✓</span>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">{takenCount}</span>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">Taken Today</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">⏰</span>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">{totalDoses}</span>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">Daily Doses</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg">📊</span>
              <div>
                <span className="text-2xl font-black text-slate-900 block leading-tight">{adherenceRate}%</span>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">Adherence Rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Adherence Predictor Panel */}
        {showAdherence && (
          <div className="mb-10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 border border-slate-850 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none hidden md:block">
              <FaRobot size={120} />
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <FaRobot className="text-teal-400" /> AI Adherence Prediction Insights
              </h2>
              <div className="flex items-center gap-3">
                {adherencePrediction && (
                  <button
                    onClick={sendInsightsEmail}
                    disabled={insightsEmailLoading || !!insightsEmailSent}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      insightsEmailSent
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FaEnvelope /> {insightsEmailLoading ? 'Sending...' : insightsEmailSent ? 'Emailed!' : 'Email Report'}
                  </button>
                )}
                <button
                  onClick={() => { setShowAdherence(false); setInsightsEmailSent(false); }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {adherencePrediction ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                  <span className="text-4xl md:text-5xl font-black text-teal-400 block tracking-tight">
                    {adherencePrediction.predicted_adherence_rate?.toFixed(0) ?? '—'}%
                  </span>
                  <span className="text-[10px] text-slate-350 font-bold uppercase tracking-wider block mt-2">Predicted 30-day adherence</span>

                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-center items-center gap-2">
                    <span className="text-xs text-slate-400">Risk Assessment:</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      adherencePrediction.risk_level === 'high'
                        ? 'bg-rose-500/20 text-rose-350 border border-rose-500/40'
                        : adherencePrediction.risk_level === 'medium'
                        ? 'bg-amber-500/20 text-amber-350 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-350 border border-emerald-500/40'
                    }`}>
                      {adherencePrediction.risk_level?.toUpperCase() ?? 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  {adherencePrediction.recommendations?.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h4 className="text-xs font-black text-teal-450 uppercase tracking-widest mb-3">💡 AI Recommendations</h4>
                      <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 font-semibold">
                        {adherencePrediction.recommendations.map((r, i) => (
                          <li key={i} className="leading-relaxed">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {adherencePrediction.insights && (
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      {adherencePrediction.insights}
                    </p>
                  )}

                  {insightsEmailSent && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-450 font-bold">
                      📧 Full diagnostic adherence report sent to <strong>{insightsEmailSent}</strong>. Please check your spam folder if not received.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs font-bold text-slate-400 animate-pulse uppercase tracking-widest">
                🤖 Analyzing medication ingestion trends & patterns...
              </div>
            )}
          </div>
        )}

        {/* Medicines Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-900/5 mb-10">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-base font-extrabold text-slate-905 tracking-tight">Active Reminders</h2>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">{medicines.length} Tracked</span>
          </div>

          {medicines.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-4 max-w-lg mx-auto">
              <span className="text-3xl text-slate-300">💊</span>
              <div>
                <h3 className="font-extrabold text-slate-900">No Medicine Reminders Yet</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                  Log your prescribed medicines and times to setup alerts. Reminders synchronize across devices even when working offline.
                </p>
              </div>
              <button
                onClick={openModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-650 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
              >
                ➕ Add First Medicine
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {medicines.map((medicine, idx) => {
                const isTaken = takenToday[medicine.id];
                const isTemp  = String(medicine.id).startsWith('temp_');

                return (
                  <div
                    key={medicine.id}
                    className={`relative bg-gradient-to-br border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
                      colors[idx % colors.length]
                    } ${isTaken ? 'opacity-70' : ''}`}
                  >
                    {isTemp && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                        Offline Cache
                      </span>
                    )}

                    <div>
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{medicine.medication_name}</h3>
                          <span className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-1 block">Dosage: {medicine.dosage}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 flex-shrink-0">
                          {isTaken && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-bold rounded uppercase">Taken</span>
                          )}
                          {medicine.email_reminders_enabled && (
                            <span className="px-2 py-0.5 bg-teal-600 text-white text-[8px] font-bold rounded uppercase" title="Email Reminders On">📧 Email</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500 font-medium my-4">
                        <div className="flex items-center gap-1">
                          <span>🔁 Frequency:</span>
                          <strong className="text-slate-750 font-bold">{medicine.frequency}</strong>
                        </div>
                        {medicine.meal_timing && (
                          <div className="flex items-center gap-1">
                            <span>🍽 Meal Timing:</span>
                            <strong className="text-slate-750 font-bold">{formatMealTiming(medicine.meal_timing)}</strong>
                          </div>
                        )}
                        {medicine.start_date && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <span>📅 Schedule:</span>
                            <strong className="text-slate-750 font-bold">
                              {new Date(medicine.start_date).toLocaleDateString()} - {medicine.end_date ? new Date(medicine.end_date).toLocaleDateString() : 'Ongoing'}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Reminder times */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(medicine.time_slots || []).map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/70 border border-black/5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                            <FaClock className="text-slate-450" /> {t} ({getTimeLabel(t)})
                          </span>
                        ))}
                      </div>

                      {medicine.notes && (
                        <p className="text-[11px] text-slate-450 italic border-l-2 border-slate-300 pl-2 py-0.5 my-3 font-semibold">
                          Note: {medicine.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-black/5">
                      <button
                        onClick={() => !isTaken && markTaken(medicine)}
                        disabled={isTaken}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 ${
                          isTaken
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-teal-600/5'
                        }`}
                      >
                        {isTaken ? <><FaCheck size={10} /> Ingestion Logged</> : 'Mark as Taken'}
                      </button>

                      {!isTemp && (
                        <button
                          onClick={() => sendTestEmail(medicine)}
                          disabled={testEmailLoading[medicine.id]}
                          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-250 rounded-xl text-xs font-bold text-slate-650 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                          title="Trigger a test reminder email instantly"
                        >
                          <FaEnvelope /> {testEmailLoading[medicine.id] ? '...' : 'Test'}
                        </button>
                      )}

                      <button
                        onClick={() => deleteMedicine(medicine.id)}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center"
                        title="Delete reminder schedule"
                      >
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer component rendered fully below the main content */}
      <Footer />

      {/* ── ADD MEDICINE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={closeModal}></div>

          <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                ➕ Add Medicine Reminder
              </h2>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={addMedicine} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Medicine Name *</label>
                <input
                  type="text"
                  value={formData.medication_name}
                  onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                  placeholder="e.g., Paracetamol 500mg"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Dosage *</label>
                  <input
                    type="text"
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="e.g., 1 tablet"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Frequency *</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="">Select frequency</option>
                    <option value="daily">Once daily</option>
                    <option value="twice_daily">Twice daily</option>
                    <option value="three_times_daily">Three times daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="as_needed">As needed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block">Reminder Times * ({selectedTimes.length} added)</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTime())}
                    className="px-3 py-2 bg-white border border-slate-250 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer flex-1"
                  />
                  <button
                    type="button"
                    onClick={addTime}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    + Add Time
                  </button>
                </div>
                {selectedTimes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {selectedTimes.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm">
                        ⏰ {t} <span className="text-slate-400">({getTimeLabel(t)})</span>
                        <button
                          type="button"
                          onClick={() => removeTime(t)}
                          className="w-4 h-4 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-650 flex items-center justify-center ml-1 text-[9px] font-extrabold cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-450 font-semibold italic mt-1">Pick a time above and click "Add Time". You can setup multiple reminder times.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Meal Timing</label>
                  <select
                    value={formData.meal_timing}
                    onChange={(e) => setFormData({ ...formData, meal_timing: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="">Select timing</option>
                    <option value="before">Before meals</option>
                    <option value="after">After meals</option>
                    <option value="with">With meals</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Duration (days) *</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g., 30"
                    min="1"
                    max="365"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special instructions, e.g., take with warm water..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none transition-all placeholder-slate-400 min-h-[70px]"
                />
              </div>

              {/* EMAIL REMINDER TOGGLE */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <span className="text-lg">📧</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Email Reminders</div>
                    <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">Receive alerts in your inbox</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.email_reminders_enabled}
                    onChange={(e) => setFormData({ ...formData, email_reminders_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {formData.email_reminders_enabled && (
                <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-[10px] text-teal-600 font-bold uppercase tracking-wider">
                  ✓ Emails will send automatically to your registered address at each scheduled time slot.
                </div>
              )}

              {!navigator.onLine && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                  📵 Currently offline. This reminder will save locally and sync automatically when network returns.
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-teal-600/10 cursor-pointer"
              >
                ➕ Save Reminder Schedule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ACTIVE REMINDERS FLOATING NOTIFICATIONS ── */}
      {activePopups.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3.5 max-w-sm w-full">
          {activePopups.map((item) => {
            const isTaken = takenToday[item.reminder.id];
            if (isTaken) return null;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-2xl animate-bounce-short flex flex-col justify-between"
              >
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-10 h-10 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 animate-pulse">
                    <FaBell />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100">Medication Alert!</h4>
                    <p className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Scheduled for {item.slot}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-medium">
                  Take <strong className="text-white font-bold">{item.reminder.medication_name}</strong> ({item.reminder.dosage})
                </p>
                {item.reminder.notes && (
                  <p className="text-[11px] text-slate-400 italic mt-1 pl-2 border-l border-slate-700">
                    📝 {item.reminder.notes}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={async () => {
                      await markTaken(item.reminder);
                      setActivePopups((prev) => prev.filter((p) => p.id !== item.id));
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-600/10 cursor-pointer"
                  >
                    Mark as Taken
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MedicineReminders;