# AgniPeak Costing v3.0

Professional product costing app for **Vinayak AgniPeak LLP** — separate **Moulding** and **Welding** costing, a voice- and text-driven **AI Assistant** (Claude, ChatGPT or Gemini), professional **PDF reports** saved to **Google Drive**, full **history in Google Sheets** with re-check, and **secure login**. Installable on Android, iPhone and desktop (PWA).

## Features

| Area | What it does |
|---|---|
| **Moulding Costing tab** | Products, Fixed Costs, Machine Setup and Report — the exact formula chain of the original Excel sheet. |
| **Welding Costing tab** | Same columns and formulas with its own fixed costs, machines and products. |
| **AI Assistant** | Type or speak (English / Hindi / Hinglish). Adds and updates products, changes fixed costs, runs what-if calculations, creates standard and custom PDFs, searches and re-checks history, and explains how to use the app. Every number comes from the app's own costing engine. |
| **Voice** | Microphone input, spoken replies, hands-free conversation mode and a floating mic button on every screen. |
| **PDF reports** | Module report (all or selected products), single-product costing sheet with step-by-step calculation, and AI-built custom reports. Page numbers, signature block, company details. |
| **Google Drive & Sheets** | PDFs saved in the Drive folder; every report logged in the Sheet (Reports + History tabs); costing data synced between devices. |
| **History & re-check** | Search and filter all reports, open the Drive PDF, regenerate the PDF, re-check every figure against a fresh calculation, compare with today's cost, restore to the calculator. |
| **Login** | Username + password for every user, admin/user roles, forced password change, lockout after 5 failed attempts, 30-day or 12-hour sessions. |
| **Settings** | Company details, Google Drive connection, AI providers & keys (one-time; admin can push to all devices), voice, account & users, backup/import. |
| **How to Use** | Built-in guide plus "Ask the AI" for any feature question. |
| **Mobile** | Bottom navigation, card layout for products, large touch targets, safe-area support, no zoom on input focus. |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # verifies the costing formulas
npm run build      # production build in dist/
```

## First-time setup

1. **Google Drive & Sheet** — follow [`google-apps-script/SETUP.md`](google-apps-script/SETUP.md) (about 5 minutes). Folder ID and Spreadsheet ID are already configured in `Code.gs`.
2. **Deploy** to Vercel (below) and set `VITE_APPS_SCRIPT_URL` so every device connects automatically.
3. **Sign in** with `admin / Admin@123`, set a new password, add users in Settings → Account.
4. **AI** — Settings → AI Assistant → choose Claude, ChatGPT or Gemini → paste the API key → **Test** → (admin) **Save AI setup for all devices**.
   - Claude: console.anthropic.com → API Keys
   - ChatGPT: platform.openai.com → API keys
   - Gemini: aistudio.google.com → Get API key
5. **Voice** — Settings → Voice: choose *English (India)* for mixed Hindi/English speech. Allow microphone access when the browser asks.

Without the Google connection, the app still works on one device: the first launch asks you to create a local administrator account, and reports are kept in on-device History.

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. vercel.com → **New Project** → import the repository (framework **Vite**, build `npm run build`, output `dist` — already in `vercel.json`).
3. **Settings → Environment Variables** → `VITE_APPS_SCRIPT_URL` = your Apps Script `/exec` URL → **Redeploy**.

## Install on a phone

- **Android (Chrome):** open the link → menu ⋮ → **Install app**.
- **iPhone (Safari):** Share → **Add to Home Screen**.

## Costing formula

```
Total Monthly Fixed Cost     = Electricity + Rent + Operator Salary + Labour + Misc + Other
Fixed Cost / Machine / Day   = Total Monthly Fixed Cost / Machines / Working Days
Fixed Cost / Unit            = Fixed Cost / Machine / Day / Avg Production per Machine per Day
Material Cost (ex GST)       = Rate per KG / 1000 x Weight per Unit (g)
GST Amount                   = Material Cost x GST %
FINAL COST / UNIT            = Fixed Cost / Unit + Material incl. GST + Additional Cost / Unit (optional)
GST Price                    = GST Amount + Fixed Cost / Unit          (sheet metric)
Without GST Price            = Fixed Cost / Unit + Material (ex GST) + Additional Cost
Profit / Unit                = Selling Price - Final Cost / Unit
Margin %                     = Profit / Selling Price x 100
Profit / Machine / Month     = Profit / Unit x Avg Production x Working Days
```

A **Manual Override** replaces the automatic final cost for one product; it is labelled "Manual" on screen and marked `*` in PDFs.

## Security notes

- Passwords are stored only as salted hashes (Google Sheet and device). Session tokens are HMAC-signed and are invalidated when a password changes or a user is disabled.
- AI API keys are stored on the device and sent only to the chosen AI provider. If an admin saves them for all devices, they are kept in the private Script Properties of your Apps Script project and delivered only to signed-in users.
- The Apps Script runs as the folder owner; only signed-in users can read or write data through it.

## Project structure

```
google-apps-script/   Code.gs (Drive/Sheets backend) + SETUP.md
scripts/              verify-calculations.mjs (npm test)
src/lib/
  calculations.js     costing engine (shared by screens, PDFs, history and AI)
  costingTypes.js     Moulding / Welding labels
  store.js            app state, settings, migration from v2 data
  auth.js             sign-in (cloud + device), password hashing
  cloud.js            Apps Script client, data sync
  reports.js          PDF → Drive → Sheet → History pipeline, re-check
  pdf.js              PDF layouts
  voice.js            speech recognition, transcription fallback, speech output
  guide.js            How to Use content (also given to the AI)
  ai/                 providers (Claude / OpenAI / Gemini), tools, agent loop
src/components/       screens and UI
```

Existing v2 data (fixed costs, machines, products) is migrated automatically into the Moulding tab on first launch.
