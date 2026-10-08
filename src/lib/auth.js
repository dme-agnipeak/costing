// Sign-in. Two modes:
//  • Cloud mode (recommended) — credentials are checked by the Google Apps Script
//    backend, which issues a signed session token. Users are managed in the "Users"
//    tab of the Google Sheet (or from Settings → Users).
//  • Local mode — when no Google connection is configured yet, an account is created
//    on this device and its password is stored only as a salted hash.
import { actions, getState } from './store'
import { callCloud, cloudConfigured, CloudError } from './cloud'
import { lsGet, lsSet } from './util'

const LOCAL_USERS = 'agnipeak_local_users_v1'
const OFFLINE_CACHE = 'agnipeak_offline_verifier_v1'
const SHORT = 12 * 3600 * 1000
const LONG = 30 * 24 * 3600 * 1000

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt() {
  const a = new Uint8Array(16)
  try {
    crypto.getRandomValues(a)
  } catch {
    for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256)
  }
  return hex(a)
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder()
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256)
    return 'pbkdf2$' + hex(bits)
  }
  // Fallback for non-HTTPS pages (crypto.subtle unavailable)
  let h = salt + ':' + password
  for (let i = 0; i < 2000; i++) h = sha256(h)
  return 'sha$' + h
}

export function localUsers() {
  return lsGet(LOCAL_USERS, [])
}

export function needsLocalSetup() {
  return !cloudConfigured() && localUsers().length === 0
}

export async function createLocalUser(username, password, role = 'admin') {
  const users = localUsers()
  const u = username.trim().toLowerCase()
  if (users.some((x) => x.username === u)) throw new Error('This username already exists.')
  const salt = randomSalt()
  users.push({ username: u, salt, hash: await hashPassword(password, salt), role, createdAt: Date.now() })
  lsSet(LOCAL_USERS, users)
}

export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters long.'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain both letters and numbers.'
  return ''
}

async function cacheOfflineVerifier(username, password, user) {
  const salt = randomSalt()
  lsSet(OFFLINE_CACHE, { username, salt, hash: await hashPassword(password, salt), role: user.role })
}

export async function login(username, password, remember = true) {
  const u = String(username || '').trim().toLowerCase()
  if (!u || !password) throw new Error('Please enter your username and password.')
  const ttl = remember ? LONG : SHORT

  if (cloudConfigured()) {
    try {
      const res = await callCloud('login', { username: u, password }, { auth: false })
      await cacheOfflineVerifier(u, password, res.user)
      const session = {
        username: res.user.username,
        role: res.user.role,
        mustChange: !!res.user.mustChange,
        token: res.token,
        mode: 'cloud',
        expiresAt: Math.min(Date.now() + ttl, res.expiresAt || Infinity),
      }
      actions.setSession(session)
      return session
    } catch (e) {
      if (e instanceof CloudError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) {
        const c = lsGet(OFFLINE_CACHE, null)
        if (c && c.username === u && (await hashPassword(password, c.salt)) === c.hash) {
          const session = { username: u, role: c.role, token: '', mode: 'offline', expiresAt: Date.now() + SHORT }
          actions.setSession(session)
          actions.toast('Signed in offline. Reports will sync to Google Drive when you are back online.', 'info', 6000)
          return session
        }
      }
      throw e
    }
  }

  const user = localUsers().find((x) => x.username === u)
  if (!user || (await hashPassword(password, user.salt)) !== user.hash) throw new Error('Incorrect username or password.')
  const session = { username: u, role: user.role, token: '', mode: 'local', expiresAt: Date.now() + ttl }
  actions.setSession(session)
  return session
}

export async function changePassword(oldPassword, newPassword) {
  const err = validatePassword(newPassword)
  if (err) throw new Error(err)
  const s = getState().session
  if (s?.mode === 'cloud') {
    await callCloud('changePassword', { oldPassword, newPassword })
    await cacheOfflineVerifier(s.username, newPassword, s)
    actions.setSession({ ...s, mustChange: false })
    return
  }
  const users = localUsers()
  const idx = users.findIndex((x) => x.username === s?.username)
  if (idx < 0) throw new Error('Account not found on this device.')
  if ((await hashPassword(oldPassword, users[idx].salt)) !== users[idx].hash) throw new Error('Current password is incorrect.')
  const salt = randomSalt()
  users[idx] = { ...users[idx], salt, hash: await hashPassword(newPassword, salt) }
  lsSet(LOCAL_USERS, users)
}

export function logout() {
  actions.logout()
}

// ---- compact SHA-256 (fallback only) ----
function sha256(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a))
  const maxWord = 2 ** 32
  let result = ''
  const words = []
  const asciiBitLength = ascii.length * 8
  const hash = []
  const k = []
  let primeCounter = 0
  const isComposite = {}
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate
      hash[primeCounter] = (candidate ** 0.5 * maxWord) | 0
      k[primeCounter++] = (candidate ** (1 / 3) * maxWord) | 0
    }
  }
  const bytes = unescape(encodeURIComponent(ascii)) + '\x80'
  let s = bytes
  while ((s.length % 64) - 56) s += '\x00'
  for (let i = 0; i < s.length; i++) {
    const j = s.charCodeAt(i)
    words[i >> 2] |= j << (((3 - i) % 4) * 8)
  }
  const bitLen = (bytes.length - 1) * 8 || asciiBitLength
  words[words.length] = (bitLen / maxWord) | 0
  words[words.length] = bitLen
  let H = hash.slice(0, 8)
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16))
    const oldHash = H
    H = H.slice(0, 8)
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15]
      const w2 = w[i - 2]
      const a = H[0]
      const e = H[4]
      const temp1 =
        H[7] +
        (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) +
        ((e & H[5]) ^ (~e & H[6])) +
        k[i] +
        (w[i] =
          i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0)
      const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]))
      H = [(temp1 + temp2) | 0].concat(H)
      H[4] = (H[4] + temp1) | 0
      H.length = 8
    }
    for (let i = 0; i < 8; i++) H[i] = (H[i] + oldHash[i]) | 0
  }
  for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) {
    const b = (H[i] >> (j * 8)) & 255
    result += (b < 16 ? '0' : '') + b.toString(16)
  }
  return result
}
