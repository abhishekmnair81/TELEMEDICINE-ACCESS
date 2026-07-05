// sw.js - Service Worker for Medicine Reminder PWA
// Place this file in: public/sw.js

const CACHE_NAME = 'mediremind-v1';
const OFFLINE_URLS = [
  '/',
  '/medicines',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/manifest.json',
];

// ============================================================
// INSTALL - Cache critical assets
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching offline assets');
      return Promise.allSettled(
        OFFLINE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Could not cache ${url}:`, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE - Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH - Network first, fallback to cache
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache API calls or non-GET requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback to root for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ============================================================
// BACKGROUND SYNC - Sync offline logs when online
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-medication-logs') {
    console.log('[SW] Background sync: syncing medication logs...');
    event.waitUntil(syncMedicationLogs());
  }
  if (event.tag === 'sync-missed-reminders') {
    console.log('[SW] Background sync: syncing missed reminders...');
    event.waitUntil(syncMissedReminders());
  }
});

async function syncMedicationLogs() {
  try {
    // Open IndexedDB
    const db = await openDB();
    const pendingLogs = await getPendingLogs(db);

    if (pendingLogs.length === 0) {
      console.log('[SW] No pending logs to sync');
      return;
    }

    console.log(`[SW] Syncing ${pendingLogs.length} pending medication logs`);

    for (const log of pendingLogs) {
      try {
        const token = await getStoredToken();
        const response = await fetch('/api/medication-reminders/sync-logs/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(log),
        });

        if (response.ok) {
          await markLogSynced(db, log.localId);
          console.log('[SW] Log synced:', log.localId);
        }
      } catch (err) {
        console.error('[SW] Failed to sync log:', err);
      }
    }

    // Notify all clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETE', count: pendingLogs.length });
    });
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

async function syncMissedReminders() {
  try {
    const db = await openDB();
    const missedReminders = await getMissedReminders(db);

    if (missedReminders.length === 0) return;

    const token = await getStoredToken();
    const response = await fetch('/api/medication-reminders/sync-missed/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ missed: missedReminders }),
    });

    if (response.ok) {
      await clearMissedReminders(db);
    }
  } catch (err) {
    console.error('[SW] Missed reminder sync failed:', err);
  }
}

// ============================================================
// PUSH NOTIFICATIONS - Handle incoming push events
// ============================================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Time to take your medication',
    icon: '/icons/pill-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'medicine-reminder',
    requireInteraction: true,
    data: {
      reminderId: data.reminderId,
      medicationName: data.medicationName,
      dosage: data.dosage,
      url: '/medicines',
    },
    actions: [
      { action: 'taken', title: '✅ Mark as Taken' },
      { action: 'snooze', title: '⏰ Snooze 15 min' },
      { action: 'skip', title: '❌ Skip' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '💊 Medicine Reminder', options)
  );
});

// ============================================================
// NOTIFICATION CLICK - Handle action buttons
// ============================================================
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const { reminderId, medicationName, url } = notification.data || {};

  notification.close();

  if (action === 'taken') {
    event.waitUntil(
      handleMedicationAction(reminderId, 'taken').then(() => {
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          const existingClient = clients.find((c) => c.url.includes('/medicines'));
          if (existingClient) {
            existingClient.focus();
            existingClient.postMessage({
              type: 'MEDICATION_TAKEN',
              reminderId,
              medicationName,
            });
          } else {
            return self.clients.openWindow(url || '/medicines');
          }
        });
      })
    );
  } else if (action === 'snooze') {
    event.waitUntil(
      scheduleSnooze(reminderId, medicationName, 15)
    );
  } else if (action === 'skip') {
    event.waitUntil(
      handleMedicationAction(reminderId, 'skipped')
    );
  } else {
    // Default: open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const existingClient = clients.find((c) => c.url.includes('/medicines'));
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(url || '/medicines');
      })
    );
  }
});

// ============================================================
// MESSAGE HANDLER - Receive commands from React app
// ============================================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SCHEDULE_REMINDER':
      scheduleLocalReminder(payload);
      break;
    case 'CANCEL_REMINDER':
      cancelReminder(payload.reminderId);
      break;
    case 'TRIGGER_SYNC':
      syncMedicationLogs();
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    default:
      break;
  }
});

// ============================================================
// SCHEDULED NOTIFICATION (alarm-style via setTimeout)
// SW can't do this reliably; instead we use periodic sync
// ============================================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-medication-reminders') {
    event.waitUntil(checkAndFireReminders());
  }
});

async function checkAndFireReminders() {
  try {
    const db = await openDB();
    const reminders = await getAllActiveReminders(db);

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const reminder of reminders) {
      if (!reminder.is_active) continue;
      if (!reminder.time_slots || !reminder.time_slots.includes(currentTime)) continue;

      // Check if already taken today
      const todayKey = `${reminder.id}_${now.toISOString().split('T')[0]}_${currentTime}`;
      const alreadyFired = await getAlreadyFired(db, todayKey);
      if (alreadyFired) continue;

      // Fire notification
      await self.registration.showNotification(`💊 ${reminder.medication_name}`, {
        body: `${reminder.dosage} • ${reminder.notes || 'Time to take your medication'}`,
        icon: '/icons/pill-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [200, 100, 200],
        tag: `reminder-${reminder.id}-${currentTime}`,
        requireInteraction: true,
        data: {
          reminderId: reminder.id,
          medicationName: reminder.medication_name,
          dosage: reminder.dosage,
          url: '/medicines',
        },
        actions: [
          { action: 'taken', title: '✅ Taken' },
          { action: 'snooze', title: '⏰ Snooze' },
        ],
      });

      await markAsFired(db, todayKey);
    }
  } catch (err) {
    console.error('[SW] checkAndFireReminders error:', err);
  }
}

// ============================================================
// INDEXEDDB HELPERS (inside SW)
// ============================================================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MediReminderDB', 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('reminders')) {
        const store = db.createObjectStore('reminders', { keyPath: 'id' });
        store.createIndex('is_active', 'is_active', { unique: false });
      }

      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', {
          keyPath: 'localId',
          autoIncrement: true,
        });
        logStore.createIndex('synced', 'synced', { unique: false });
        logStore.createIndex('reminderId', 'reminderId', { unique: false });
      }

      if (!db.objectStoreNames.contains('fired')) {
        db.createObjectStore('fired', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

function getPendingLogs(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const index = store.index('synced');
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function markLogSynced(db, localId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const getRequest = store.get(localId);
    getRequest.onsuccess = () => {
      const log = getRequest.result;
      if (log) {
        log.synced = true;
        store.put(log);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function getMissedReminders(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.getAll();
    request.onsuccess = () => {
      const missed = request.result.filter(
        (log) => log.status === 'missed' && !log.synced
      );
      resolve(missed);
    };
    request.onerror = () => reject(request.error);
  });
}

function clearMissedReminders(db) {
  return new Promise((resolve) => resolve()); // handled by markLogSynced
}

function getAllActiveReminders(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readonly');
    const store = tx.objectStore('reminders');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getAlreadyFired(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fired', 'readonly');
    const store = tx.objectStore('fired');
    const request = store.get(key);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

function markAsFired(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fired', 'readwrite');
    const store = tx.objectStore('fired');
    const request = store.put({ key, firedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getStoredToken() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get('accessToken');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function handleMedicationAction(reminderId, status) {
  try {
    const db = await openDB();

    const log = {
      reminderId,
      status,
      timestamp: new Date().toISOString(),
      scheduledTime: new Date().toISOString(),
      synced: false,
      source: 'notification',
    };

    // Save to IndexedDB
    await new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      const request = store.add(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Try to sync immediately
    const token = await getStoredToken();
    if (token) {
      await fetch('/api/medication-reminders/sync-logs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(log),
      }).catch(() => {
        // Will be synced later via background sync
        console.log('[SW] Will retry sync later');
      });
    }
  } catch (err) {
    console.error('[SW] handleMedicationAction error:', err);
  }
}

async function scheduleSnooze(reminderId, medicationName, minutes) {
  // Store snooze intent - actual scheduling happens when app is open
  const db = await openDB();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({
    key: `snooze_${reminderId}`,
    value: {
      reminderId,
      medicationName,
      snoozeUntil: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    },
  });

  // Show a confirmation notification
  await self.registration.showNotification('⏰ Snoozed', {
    body: `${medicationName} reminder in ${minutes} minutes`,
    icon: '/icons/pill-192.png',
    tag: `snooze-confirm-${reminderId}`,
  });
}

function cancelReminder(reminderId) {
  // No-op in SW context, handled by app
  console.log('[SW] Cancel reminder:', reminderId);
}

function scheduleLocalReminder(payload) {
  // No-op in SW context - reminders are fired by the app scheduler
  // or via periodic sync. This is just a hook for future use.
  console.log('[SW] Schedule reminder (no-op):', payload);
}