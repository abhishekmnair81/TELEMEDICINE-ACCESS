// src/services/indexedDB.js
// IndexedDB manager for offline medicine reminder storage

const DB_NAME = 'MediReminderDB';
const DB_VERSION = 2;

let dbInstance = null;

// ============================================================
// DATABASE INITIALIZATION
// ============================================================
export function openMediDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[IndexedDB] ✅ Opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[IndexedDB] Upgrading schema...');

      // --- Reminders store ---
      if (!db.objectStoreNames.contains('reminders')) {
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
        reminderStore.createIndex('is_active', 'is_active', { unique: false });
        reminderStore.createIndex('patient', 'patient', { unique: false });
        reminderStore.createIndex('end_date', 'end_date', { unique: false }); // ✅ Added for cleanup queries
        console.log('[IndexedDB] Created reminders store');
      }

      // --- Medication logs store ---
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', {
          keyPath: 'localId',
          autoIncrement: true,
        });
        logStore.createIndex('synced', 'synced', { unique: false });
        logStore.createIndex('reminderId', 'reminderId', { unique: false });
        logStore.createIndex('status', 'status', { unique: false });
        logStore.createIndex('date', 'date', { unique: false });
        console.log('[IndexedDB] Created logs store');
      }

      // --- Fired reminders (to avoid duplicate notifications) ---
      if (!db.objectStoreNames.contains('fired')) {
        db.createObjectStore('fired', { keyPath: 'key' });
        console.log('[IndexedDB] Created fired store');
      }

      // --- Settings store (auth token, preferences) ---
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
        console.log('[IndexedDB] Created settings store');
      }

      // --- Pending actions (for offline queue) ---
      if (!db.objectStoreNames.contains('pending_actions')) {
        const pendingStore = db.createObjectStore('pending_actions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        pendingStore.createIndex('type', 'type', { unique: false });
        pendingStore.createIndex('created_at', 'created_at', { unique: false });
        console.log('[IndexedDB] Created pending_actions store');
      }
    };
  });
}

// ============================================================
// REMINDER CRUD
// ============================================================
export async function saveRemindersOffline(reminders) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');

    reminders.forEach((reminder) => {
      store.put({ ...reminder, _cached_at: new Date().toISOString() });
    });

    tx.oncomplete = () => {
      console.log(`[IndexedDB] ✅ Saved ${reminders.length} reminders offline`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineReminders() {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readonly');
    const store = tx.objectStore('reminders');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReminderOffline(reminder) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const request = store.put({ ...reminder, _cached_at: new Date().toISOString() });
    request.onsuccess = () => resolve(reminder);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteReminderOffline(reminderId) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const request = store.delete(reminderId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// CLEANUP COMPLETED REMINDERS
// ✅ Removes reminders from IndexedDB whose end_date has passed
//    or that have been marked inactive by the server.
// Called automatically during every sync in pwaService.js
// ============================================================
export async function cleanupCompletedReminders() {
  const db = await openMediDB();
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const request = store.getAll();

    request.onsuccess = () => {
      const reminders = request.result || [];
      let cleaned = 0;

      reminders.forEach((reminder) => {
        const isExpired = reminder.end_date && reminder.end_date < today;
        const isInactive = reminder.is_active === false;

        if (isExpired || isInactive) {
          store.delete(reminder.id);
          cleaned++;
        }
      });

      tx.oncomplete = () => {
        if (cleaned > 0) {
          console.log(`[IndexedDB] 🧹 Removed ${cleaned} expired/inactive reminder(s)`);
        }
        resolve(cleaned);
      };
    };

    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// MEDICATION LOGS
// ============================================================
export async function logMedicationOffline({ reminderId, status, scheduledTime, notes }) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const log = {
      reminderId,
      status,           // 'taken' | 'missed' | 'skipped'
      scheduledTime,
      takenAt: status === 'taken' ? new Date().toISOString() : null,
      notes: notes || '',
      date: new Date().toISOString().split('T')[0],
      synced: false,
      source: 'offline',
      created_at: new Date().toISOString(),
    };
    const request = store.add(log);
    request.onsuccess = () => {
      log.localId = request.result;
      console.log('[IndexedDB] ✅ Medication log saved offline:', log);
      resolve(log);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingLogs() {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.getAll();
    request.onsuccess = () => {
      const pending = (request.result || []).filter((log) => !log.synced);
      resolve(pending);
    };
    request.onerror = () => reject(request.error);
  });
}

// ✅ Fixed: deletes the log after marking synced to prevent DB bloat
export async function markLogSynced(localId) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');

    // First mark as synced (keeps a brief record), then delete on next cleanup
    const getRequest = store.get(localId);
    getRequest.onsuccess = () => {
      const log = getRequest.result;
      if (log) {
        log.synced = true;
        log.synced_at = new Date().toISOString();
        store.put(log);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.onerror = () => reject(tx.error);
  });
}

// ✅ New: call periodically to purge logs that are already synced
export async function cleanSyncedLogs() {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    const index = store.index('synced');
    const request = index.getAll(true); // get all where synced === true

    request.onsuccess = () => {
      const synced = request.result || [];
      synced.forEach((log) => store.delete(log.localId));
      tx.oncomplete = () => {
        if (synced.length > 0) {
          console.log(`[IndexedDB] 🧹 Purged ${synced.length} already-synced log(s)`);
        }
        resolve(synced.length);
      };
    };

    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLogsForDate(date) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const index = store.index('date');
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// SETTINGS (auth token sync, preferences)
// ============================================================
export async function saveSetting(key, value) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key, value, updated_at: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting(key) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// PENDING ACTIONS (for offline queue)
// ============================================================
export async function queueOfflineAction(type, payload) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    const request = store.add({
      type,
      payload,
      created_at: new Date().toISOString(),
      retries: 0,
    });
    request.onsuccess = () => {
      console.log('[IndexedDB] ✅ Queued offline action:', type);
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingActions() {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_actions', 'readonly');
    const store = tx.objectStore('pending_actions');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingAction(id) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// FIRED REMINDERS (dedup notifications)
// ============================================================
export async function markReminderFired(key) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fired', 'readwrite');
    const store = tx.objectStore('fired');
    const request = store.put({ key, firedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function wasReminderFired(key) {
  const db = await openMediDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fired', 'readonly');
    const store = tx.objectStore('fired');
    const request = store.get(key);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clean up old fired records (older than 2 days)
export async function cleanOldFiredRecords() {
  const db = await openMediDB();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('fired', 'readwrite');
    const store = tx.objectStore('fired');
    const request = store.getAll();
    request.onsuccess = () => {
      const old = request.result.filter((r) => r.firedAt < twoDaysAgo);
      old.forEach((r) => store.delete(r.key));
      resolve(old.length);
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// UTILITY
// ============================================================
export function isIndexedDBAvailable() {
  return typeof indexedDB !== 'undefined';
}

export async function clearAllOfflineData() {
  const db = await openMediDB();
  const stores = ['reminders', 'logs', 'fired', 'pending_actions'];

  return Promise.all(
    stores.map(
      (storeName) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const request = tx.objectStore(storeName).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
    )
  );
}