const ALGORITHM  = 'AES-GCM'
const KEY_LENGTH = 256  
const SALT       = new TextEncoder().encode('rural-health-e2e-salt-v1')
const ITERATIONS = 100_000

let cachedKey = null
let cachedRoomId = null


/**
 * Derive a deterministic AES-GCM key from the room ID.
 * Both parties derive the same key because they share the same room_id.
 * @param {string} roomId
 * @returns {Promise<CryptoKey>}
 */
export async function deriveRoomKey(roomId) {
  // Return cached key if room hasn't changed
  if (cachedKey && cachedRoomId === roomId) return cachedKey

  const rawKeyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(roomId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )

  cachedRoomId = roomId
  return cachedKey
}

/**
 * Encrypt a plaintext string with the room key.
 * @param {string} plaintext
 * @param {CryptoKey} key
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 *   Both values are Base64-encoded for safe transmission over WebSocket JSON.
 */
export async function encryptMessage(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))  // 96-bit IV for AES-GCM

  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  )

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
  }
}

// ─── Decrypt ─────────────────────────────────────────────────────

/**
 * Decrypt a ciphertext string with the room key.
 * @param {string} ciphertext  Base64-encoded ciphertext
 * @param {string} ivBase64    Base64-encoded 12-byte IV
 * @param {CryptoKey} key
 * @returns {Promise<string>}  Plaintext
 */
export async function decryptMessage(ciphertext, ivBase64, key) {
  const iv          = base64ToBuffer(ivBase64)
  const cipherBuf   = base64ToBuffer(ciphertext)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    cipherBuf
  )

  return new TextDecoder().decode(decrypted)
}

// ─── Helpers ──────────────────────────────────────────────────────

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(base64) {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Check if the browser supports Web Crypto API (it should in all modern browsers).
 * @returns {boolean}
 */
export function isE2ESupported() {
  return !!(
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle
  )
}
