


import {
  openMediDB,
  saveSetting,
  saveRemindersOffline,
  logMedicationOffline,
  getPendingLogs,
  markLogSynced,
  markReminderFired,
  wasReminderFired,
  cleanOldFiredRecords,
  queueOfflineAction,
  getPendingActions,
  deletePendingAction,
  cleanupCompletedReminders,
} from './indexedDB';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';




export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] ✅ Service Worker registered:', registration.scope);


    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New version available');

        }
      });
    });


    navigator.serviceWorker.addEventListener('message', handleSWMessage);


    await syncAuthTokenToSW();

    return registration;
  } catch (err) {
    console.error('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

function handleSWMessage(event) {
  const { type, count, reminderId, medicationName } = event.data || {};

  switch (type) {
    case 'SYNC_COMPLETE':
      console.log(`[PWA] ✅ Background sync complete: ${count} logs synced`);
      window.dispatchEvent(new CustomEvent('medicationSynced', { detail: { count } }));
      break;
    case 'MEDICATION_TAKEN':
      console.log(`[PWA] Medication taken from notification: ${medicationName}`);
      window.dispatchEvent(
        new CustomEvent('medicationTakenFromNotification', {
          detail: { reminderId, medicationName },
        })
      );
      break;
    default:
      break;
  }
}




export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const permission = await Notification.requestPermission();
  console.log('[PWA] Notification permission:', permission);
  return permission;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'not-supported';
  return Notification.permission;
}




export async function showMedicationNotification(reminder, scheduledTime) {
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;

  try {
    await registration.showNotification(`💊 ${reminder.medication_name}`, {
      body: `${reminder.dosage} • ${getTimeLabel(scheduledTime)}${
        reminder.notes ? `\n${reminder.notes}` : ''
      }`,
      icon: '/icons/pill-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: `reminder-${reminder.id}-${scheduledTime}`,
      requireInteraction: true,
      data: {
        reminderId: reminder.id,
        medicationName: reminder.medication_name,
        dosage: reminder.dosage,
        url: '/medicines',
      },
      actions: [
        { action: 'taken', title: '✅ Mark as Taken' },
        { action: 'snooze', title: '⏰ Snooze 15 min' },
        { action: 'skip', title: '❌ Skip' },
      ],
    });
    return true;
  } catch (err) {

    try {
      new Notification(`💊 ${reminder.medication_name}`, {
        body: `${reminder.dosage} — Time to take your medication`,
        icon: '/icons/pill-192.png',
        tag: `reminder-${reminder.id}`,
      });
      return true;
    } catch (e) {
      console.error('[PWA] Notification failed:', e);
      return false;
    }
  }
}




let schedulerInterval = null;
let soundEnabled = true;
let notificationSound = null;

export function startReminderScheduler(getReminders) {
  if (schedulerInterval) clearInterval(schedulerInterval);


  try {
    notificationSound = new Audio('/sounds/reminder.mp3');
    notificationSound.volume = 0.8;
  } catch (e) {
    console.warn('[PWA] Audio not available');
  }

  const checkNow = async () => {
    const now = new Date();
    const currentTime = formatTime(now);
    const today = now.toISOString().split('T')[0];

    const reminders = getReminders();

    for (const reminder of reminders) {
      if (!reminder.is_active) continue;
      if (!reminder.time_slots || !Array.isArray(reminder.time_slots)) continue;


      if (reminder.end_date && reminder.end_date < today) continue;

      for (const slot of reminder.time_slots) {
        if (slot !== currentTime) continue;

        const fireKey = `${reminder.id}_${today}_${slot}`;
        const alreadyFired = await wasReminderFired(fireKey);
        if (alreadyFired) continue;

        console.log(`[Scheduler] ⏰ Firing reminder: ${reminder.medication_name} at ${slot}`);


        await markReminderFired(fireKey);


        window.dispatchEvent(
          new CustomEvent('medicationReminderActive', {
            detail: { reminder, slot }
          })
        );


        await showMedicationNotification(reminder, slot);


        if (soundEnabled && notificationSound) {
          try {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(() => {
              playBeepSound();
            });
          } catch {
            playBeepSound();
          }
        }


        await logMedicationOffline({
          reminderId: reminder.id,
          status: 'pending',
          scheduledTime: `${today}T${slot}:00`,
        });
      }
    }
  };


  checkNow();


  schedulerInterval = setInterval(checkNow, 10 * 1000);
  console.log('[Scheduler] ✅ Started reminder scheduler');

  return () => {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  };
}

export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}


function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('[PWA] Could not play beep sound');
  }
}

export function setupOnlineOfflineHandlers(onOnline, onOffline) {
  const handleOnline = async () => {
    console.log('[PWA] 🌐 Back online - starting sync...');
    onOnline?.();
    await syncPendingData();
    await triggerBackgroundSync();
  };

  const handleOffline = () => {
    console.log('[PWA] 📵 Gone offline');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);


  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export async function triggerBackgroundSync() {
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('sync-medication-logs');
      console.log('[PWA] ✅ Background sync registered');
    }
  } catch (err) {
    console.warn('[PWA] Background sync not available, using manual sync');
    await syncPendingData();
  }
}

export async function syncPendingData() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const token = localStorage.getItem('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  let synced = 0, failed = 0;


  const pendingLogs = await getPendingLogs();
  if (pendingLogs.length > 0) {
    try {
      const res = await fetch(`${API_BASE}/medication-reminders/sync-logs/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          pendingLogs.map((log) => ({
            reminder_id: log.reminderId,
            status: log.status,
            scheduled_time: log.scheduledTime,
            taken_at: log.takenAt,
            notes: log.notes || '',
          }))
        ),
      });
      if (res.ok) {
        const data = await res.json();
        synced += data.synced;
        await Promise.all(pendingLogs.map((log) => markLogSynced(log.localId)));
      } else {
        failed += pendingLogs.length;
      }
    } catch {
      failed += pendingLogs.length;
    }
  }


  const pendingActions = await getPendingActions();
  for (const action of pendingActions) {
    try {
      let ok = false;

      if (action.type === 'LOG_INTAKE') {
        const { reminderId, ...payload } = action.payload;
        const res = await fetch(
          `${API_BASE}/medication-reminders/${reminderId}/log-intake/`,
          { method: 'POST', headers, body: JSON.stringify(payload) }
        );
        ok = res.ok;
      }

      if (ok) {
        await deletePendingAction(action.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }


  try {
    const cleanupRes = await fetch(
      `${API_BASE}/medication-reminders/cleanup-completed/`,
      { method: 'POST', headers }
    );
    if (cleanupRes.ok) {
      const { cleaned } = await cleanupRes.json();
      if (cleaned > 0) {
        console.log(`[PWA] Deactivated ${cleaned} completed reminder(s) on server.`);
      }
    }
  } catch (err) {
    console.warn('[PWA] Cleanup request failed:', err);
  }


  await cleanupCompletedReminders();

  return { synced, failed };
}




export async function syncAuthTokenToSW() {
  const token = localStorage.getItem('accessToken');
  if (token) {
    await saveSetting('accessToken', token);
  }
}




export async function registerPeriodicSync() {
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('periodicSync' in registration) {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });

      if (status.state === 'granted') {
        await registration.periodicSync.register('check-medication-reminders', {
          minInterval: 60 * 1000,
        });
        console.log('[PWA] ✅ Periodic sync registered');
      }
    }
  } catch (err) {
    console.warn('[PWA] Periodic sync not available:', err.message);
  }
}




function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function getTimeLabel(time) {
  const hour = parseInt(time?.split(':')[0] ?? '0');
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Night';
}

export function isOnline() {
  return navigator.onLine;
}

export function isPWAInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.getRegistration('/');
}