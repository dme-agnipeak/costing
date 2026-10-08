/**
 * AgniPeak Costing — Google Drive & Google Sheets backend
 * ------------------------------------------------------------
 * Deploy this file as a Google Apps Script Web App (see SETUP.md in this folder).
 *
 *  • Every PDF report is saved in the Drive folder below
 *    (sub-folders: "Moulding Costing", "Welding Costing", "Custom Reports").
 *  • Every saved report is logged in the Google Sheet below:
 *      Reports  – one row per report (with PDF link and full snapshot for re-check)
 *      History  – one row per product line (inputs + all calculated figures)
 *      Users    – login accounts (passwords stored as salted hashes)
 *  • Costing master data (fixed costs, machines, products) is synced between devices.
 *
 * Default login created automatically on first use:
 *      Username: admin      Password: Admin@123   (you will be asked to change it)
 */

const FOLDER_ID = '1P9Ee7Ltlxj8vWb4u06-W45VsDwyp7agO';
const SPREADSHEET_ID = '1TygLnarJdA-aO2UtH7RCxpe-O0LLRXvjsc6glEdGdUU';

const API_VERSION = '3.0.0';
const SESSION_DAYS = 30;
const HASH_ROUNDS = 300;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const STATE_FILE = 'AgniPeak_App_Data.json';

const SHEETS = {
  Users: ['Username', 'Password Hash', 'Salt', 'Role', 'Active', 'Must Change Password', 'Created At', 'Last Login'],
  Reports: ['Report ID', 'Saved At', 'Costing Type', 'Report Kind', 'Title', 'Products', 'Product Names',
    'Fixed Cost / Machine / Day', 'Avg Final Cost / Unit', 'Avg Margin %', 'PDF File Name', 'PDF Link', 'Saved By', 'Source', 'Snapshot'],
  History: ['Report ID', 'Saved At', 'Costing Type', 'Product Name', 'Costing Date', 'Weight / Unit (g)', 'Rate / KG',
    'Raw Qty (KG)', 'GST %', 'Avg Production / Day', 'Fixed Cost / Machine / Day', 'Material (ex GST)', 'GST Amount',
    'Material incl GST', 'Fixed Cost / Unit', 'Additional Cost / Unit', 'Final Cost / Unit', 'Manual Override',
    'Selling Price', 'Profit / Unit', 'Margin %', 'Profit / Machine / Month', 'PDF Link', 'Saved By'],
};

// ============================================================ entry points
function doGet() {
  return json_({ ok: true, service: 'AgniPeak Costing API', version: API_VERSION, time: new Date().toISOString() });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request format.' });
  }
  try {
    ensureSetup_();
    const action = req.action;
    if (action === 'ping') return json_({ ok: true, version: API_VERSION, folderId: FOLDER_ID, spreadsheetId: SPREADSHEET_ID });
    if (action === 'login') return json_(login_(req));

    const user = verifyToken_(req.token);
    if (!user) return json_({ ok: false, code: 'AUTH', error: 'Your session has expired. Please sign in again.' });

    switch (action) {
      case 'changePassword': return json_(changePassword_(user, req));
      case 'saveReport': return json_(saveReport_(user, req.report));
      case 'listReports': return json_(listReports_(req));
      case 'getReport': return json_(getReport_(req.reportId));
      case 'deleteReport': requireAdmin_(user); return json_(deleteReport_(req.reportId));
      case 'getState': return json_(getState_());
      case 'putState': return json_(putState_(req.state));
      case 'getSettings': return json_(getSettings_());
      case 'putSettings': requireAdmin_(user); return json_(putSettings_(req.settings));
      case 'listUsers': requireAdmin_(user); return json_(listUsers_());
      case 'addUser': requireAdmin_(user); return json_(addUser_(req));
      case 'removeUser': requireAdmin_(user); return json_(removeUser_(user, req.username));
      case 'resetPassword': requireAdmin_(user); return json_(resetPassword_(req));
      case 'whoami': return json_({ ok: true, user: { username: user.username, role: user.role } });
      default: return json_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, code: err.code || 'ERROR', error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(message, code) {
  const e = new Error(message);
  e.code = code || 'ERROR';
  throw e;
}

// ============================================================ setup
/** Optional: run once from the editor to create sheets and grant permissions. */
function setup() {
  ensureSetup_(true);
  Logger.log('Setup complete. Folder: ' + DriveApp.getFolderById(FOLDER_ID).getName() +
    ' | Spreadsheet: ' + SpreadsheetApp.openById(SPREADSHEET_ID).getName());
}

function ensureSetup_(force) {
  const props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty('SETUP_DONE') === API_VERSION) return;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    const first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (first.join('') === '' || first[0] !== headers[0]) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const users = ss.getSheetByName('Users');
  if (users.getLastRow() < 2) {
    const salt = Utilities.getUuid();
    users.appendRow(['admin', hash_('Admin@123', salt), salt, 'admin', true, true, new Date(), '']);
  }
  props.setProperty('SETUP_DONE', API_VERSION);
}

function sheet_(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

// ============================================================ auth
function hash_(password, salt) {
  let h = salt + ':' + password;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function b64url_(s) {
  return Utilities.base64EncodeWebSafe(s).replace(/=+$/, '');
}

function sign_(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  return b64url_(Utilities.computeHmacSha256Signature(payload, secret));
}

function findUser_(username) {
  const sh = sheet_('Users');
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return {
        row: i + 1, username: String(values[i][0]).toLowerCase(), hash: values[i][1], salt: values[i][2],
        role: values[i][3] || 'user', active: values[i][4] !== false && String(values[i][4]).toUpperCase() !== 'FALSE',
        mustChange: values[i][5] === true || String(values[i][5]).toUpperCase() === 'TRUE',
      };
    }
  }
  return null;
}

function login_(req) {
  const username = String(req.username || '').trim().toLowerCase();
  const password = String(req.password || '');
  if (!username || !password) fail_('Please enter your username and password.');
  const cache = CacheService.getScriptCache();
  const key = 'fail_' + username;
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILED_LOGINS) fail_('Too many failed attempts. Please try again in ' + LOCK_MINUTES + ' minutes.', 'LOCKED');
  const u = findUser_(username);
  if (!u || !u.active || hash_(password, u.salt) !== u.hash) {
    cache.put(key, String(fails + 1), LOCK_MINUTES * 60);
    fail_('Incorrect username or password.', 'BADLOGIN');
  }
  cache.remove(key);
  sheet_('Users').getRange(u.row, 8).setValue(new Date());
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  const payload = b64url_(JSON.stringify({ u: u.username, r: u.role, e: expiresAt, v: String(u.hash).slice(0, 8) }));
  return { ok: true, token: payload + '.' + sign_(payload), expiresAt: expiresAt, user: { username: u.username, role: u.role, mustChange: u.mustChange } };
}

function verifyToken_(token) {
  if (!token || String(token).indexOf('.') < 0) return null;
  const parts = String(token).split('.');
  if (sign_(parts[0]) !== parts[1]) return null;
  let p;
  try {
    p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString());
  } catch (e) {
    return null;
  }
  if (!p || Date.now() > p.e) return null;
  const u = findUser_(p.u);
  // token is invalidated when the user is disabled or the password changes
  if (!u || !u.active || String(u.hash).slice(0, 8) !== p.v) return null;
  return u;
}

function requireAdmin_(user) {
  if (user.role !== 'admin') fail_('Only an administrator can do this.', 'FORBIDDEN');
}

function validatePassword_(pw) {
  if (!pw || pw.length < 8) fail_('Password must be at least 8 characters long.');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) fail_('Password must contain both letters and numbers.');
}

function changePassword_(user, req) {
  if (hash_(String(req.oldPassword || ''), user.salt) !== user.hash) fail_('Current password is incorrect.');
  validatePassword_(req.newPassword);
  const salt = Utilities.getUuid();
  sheet_('Users').getRange(user.row, 2, 1, 5).setValues([[hash_(req.newPassword, salt), salt, user.role, true, false]]);
  return { ok: true, message: 'Password changed. Please sign in again on your other devices.' };
}

function listUsers_() {
  const v = sheet_('Users').getDataRange().getValues();
  const users = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    users.push({ username: v[i][0], role: v[i][3], active: v[i][4] !== false, lastLogin: v[i][7] ? new Date(v[i][7]).toISOString() : '' });
  }
  return { ok: true, users: users };
}

function addUser_(req) {
  const username = String(req.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail_('Username must be 3–30 characters (letters, numbers, dot, dash, underscore).');
  if (findUser_(username)) fail_('This username already exists.');
  validatePassword_(req.password);
  const salt = Utilities.getUuid();
  sheet_('Users').appendRow([username, hash_(req.password, salt), salt, req.role === 'admin' ? 'admin' : 'user', true, true, new Date(), '']);
  return { ok: true };
}

function removeUser_(admin, username) {
  const u = findUser_(username);
  if (!u) fail_('User not found.');
  if (u.username === admin.username) fail_('You cannot remove your own account.');
  sheet_('Users').deleteRow(u.row);
  return { ok: true };
}

function resetPassword_(req) {
  const u = findUser_(req.username);
  if (!u) fail_('User not found.');
  validatePassword_(req.password);
  const salt = Utilities.getUuid();
  sheet_('Users').getRange(u.row, 2, 1, 5).setValues([[hash_(req.password, salt), salt, u.role, true, true]]);
  return { ok: true };
}

// ============================================================ drive helpers
function subFolder_(name) {
  const root = DriveApp.getFolderById(FOLDER_ID);
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

function folderForType_(type) {
  if (type === 'moulding') return subFolder_('Moulding Costing');
  if (type === 'welding') return subFolder_('Welding Costing');
  return subFolder_('Custom Reports');
}

// ============================================================ reports
function saveReport_(user, r) {
  if (!r || !r.reportId) fail_('Report data is missing.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const existing = findReportRow_(r.reportId);
    if (existing) {
      const row = sheet_('Reports').getRange(existing, 1, 1, SHEETS.Reports.length).getValues()[0];
      return { ok: true, duplicate: true, pdfUrl: row[11], fileId: '' };
    }
    let pdfUrl = '';
    let fileId = '';
    if (r.pdfBase64) {
      const blob = Utilities.newBlob(Utilities.base64Decode(r.pdfBase64), 'application/pdf', r.fileName || (r.reportId + '.pdf'));
      const file = folderForType_(r.type).createFile(blob);
      file.setDescription((r.title || '') + ' | ' + r.reportId + ' | saved by ' + user.username);
      pdfUrl = file.getUrl();
      fileId = file.getId();
    }
    // Large snapshots are stored as a JSON file (Sheets cells hold max 50,000 characters)
    let snap = JSON.stringify(r.snapshot || {});
    if (snap.length > 45000) {
      const f = subFolder_('_data').createFile(r.reportId + '.json', snap, 'application/json');
      snap = 'file:' + f.getId();
    }
    const now = new Date();
    const s = r.summary || {};
    sheet_('Reports').appendRow([
      r.reportId, now, label_(r.type), r.kind || 'module', r.title || '', r.productCount || 0, r.productNames || '',
      s.perMachinePerDay || '', s.avgFinalCost || '', s.avgMargin || '', r.fileName || '', pdfUrl, user.username, r.source || 'manual', snap,
    ]);
    const lines = r.lines || [];
    if (lines.length) {
      const rows = lines.map(function (l) {
        return [r.reportId, now, label_(r.type), l.productName, l.costingDate, l.weightGram, l.ratePerKg, l.rawQtyKg, l.gstPercent,
          l.avgProduction, l.fixedPerMachineDay, l.materialAmount, l.gstAmount, l.materialInclGst, l.fixedPerUnit, l.additionalCost,
          l.finalCost, l.manualOverride, l.sellingPrice, l.profit, l.margin, l.profitPerMachineMonth, pdfUrl, user.username];
      });
      const h = sheet_('History');
      h.getRange(h.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return { ok: true, pdfUrl: pdfUrl, fileId: fileId };
  } finally {
    lock.releaseLock();
  }
}

function label_(type) {
  return type === 'moulding' ? 'Moulding' : type === 'welding' ? 'Welding' : 'Custom';
}

function typeFromLabel_(l) {
  return l === 'Moulding' ? 'moulding' : l === 'Welding' ? 'welding' : 'custom';
}

function findReportRow_(reportId) {
  const sh = sheet_('Reports');
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === reportId) return i + 2;
  return 0;
}

function listReports_(req) {
  const sh = sheet_('Reports');
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, reports: [] };
  const values = sh.getRange(2, 1, last - 1, 14).getValues(); // snapshot column excluded for speed
  const q = String(req.query || '').toLowerCase();
  const type = req.type || '';
  const from = req.from ? new Date(req.from).getTime() : 0;
  const to = req.to ? new Date(req.to).getTime() + 86400000 : Infinity;
  const out = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (!v[0]) continue;
    const t = typeFromLabel_(v[2]);
    const ts = new Date(v[1]).getTime();
    if (type && t !== type) continue;
    if (ts < from || ts > to) continue;
    if (q && (v[0] + ' ' + v[4] + ' ' + v[6] + ' ' + v[12]).toLowerCase().indexOf(q) < 0) continue;
    out.push({
      reportId: v[0], savedAt: new Date(v[1]).toISOString(), type: t, kind: v[3], title: v[4], productCount: v[5], productNames: v[6],
      summary: { perMachinePerDay: v[7], avgFinalCost: v[8], avgMargin: v[9] }, fileName: v[10], pdfUrl: v[11], savedBy: v[12], source: v[13],
    });
    if (out.length >= (req.limit || 200)) break;
  }
  return { ok: true, reports: out };
}

function getReport_(reportId) {
  const row = findReportRow_(reportId);
  if (!row) fail_('Report not found.');
  const v = sheet_('Reports').getRange(row, 1, 1, SHEETS.Reports.length).getValues()[0];
  let snap = String(v[14] || '{}');
  if (snap.indexOf('file:') === 0) snap = DriveApp.getFileById(snap.slice(5)).getBlob().getDataAsString();
  return {
    ok: true,
    report: {
      reportId: v[0], savedAt: new Date(v[1]).toISOString(), type: typeFromLabel_(v[2]), kind: v[3], title: v[4], productCount: v[5],
      productNames: v[6], fileName: v[10], pdfUrl: v[11], savedBy: v[12], source: v[13], snapshot: JSON.parse(snap),
    },
  };
}

function deleteReport_(reportId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const row = findReportRow_(reportId);
    if (row) {
      const url = sheet_('Reports').getRange(row, 12).getValue();
      const m = String(url).match(/[-\w]{25,}/);
      if (m) { try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (e) { /* already removed */ } }
      sheet_('Reports').deleteRow(row);
    }
    const h = sheet_('History');
    const last = h.getLastRow();
    if (last >= 2) {
      const ids = h.getRange(2, 1, last - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === reportId) h.deleteRow(i + 2);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================ shared app data
function stateFile_() {
  const folder = subFolder_('_data');
  const it = folder.getFilesByName(STATE_FILE);
  return it.hasNext() ? it.next() : null;
}

function getState_() {
  const f = stateFile_();
  if (!f) return { ok: true, state: null };
  return { ok: true, state: JSON.parse(f.getBlob().getDataAsString() || 'null') };
}

function putState_(state) {
  if (!state || !state.modules) fail_('Invalid data.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const content = JSON.stringify(state);
    const f = stateFile_();
    if (f) f.setContent(content);
    else subFolder_('_data').createFile(STATE_FILE, content, 'application/json');
    return { ok: true, updatedAt: state.updatedAt };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================ settings (AI keys etc.)
function getSettings_() {
  const raw = PropertiesService.getScriptProperties().getProperty('APP_SETTINGS');
  return { ok: true, settings: raw ? JSON.parse(raw) : null };
}

function putSettings_(settings) {
  PropertiesService.getScriptProperties().setProperty('APP_SETTINGS', JSON.stringify(settings || {}));
  return { ok: true };
}
