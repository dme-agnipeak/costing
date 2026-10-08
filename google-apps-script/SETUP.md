# Google Drive & Google Sheet Setup (one time, about 5 minutes)

This connects AgniPeak Costing to:

| Item | ID |
|---|---|
| Google Drive folder (PDFs) | `1P9Ee7Ltlxj8vWb4u06-W45VsDwyp7agO` |
| Google Sheet (history, users) | `1TygLnarJdA-aO2UtH7RCxpe-O0LLRXvjsc6glEdGdUU` |

Both IDs are already written at the top of `Code.gs`.

## Steps

1. Sign in to Google with the account that **owns** (or can edit) the Drive folder and the Google Sheet.
2. Open the Google Sheet → menu **Extensions → Apps Script**.
3. Delete the sample code in `Code.gs`, paste the full contents of `google-apps-script/Code.gs`, and click **Save**.
4. In the function drop-down choose **`setup`** and click **Run**. Click **Review permissions → choose your account → Advanced → Go to project → Allow**.
   The execution log shows "Setup complete". The Sheet now has three tabs: **Reports**, **History**, **Users**.
5. Click **Deploy → New deployment** → gear icon → **Web app**:
   - Description: `AgniPeak Costing API`
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends with `/exec`).
6. Give the URL to the app — choose one:
   - **Every device automatically (recommended):** in Vercel → Project → Settings → Environment Variables add `VITE_APPS_SCRIPT_URL` = the URL, then redeploy.
   - **Per device:** on the sign-in screen tap **Connection**, or in the app go to **Settings → Google Drive & Google Sheet**, paste the URL, tap **Test connection**, then **Save**.
7. Sign in with **admin / Admin@123**. You are asked to choose a new password immediately.
8. Add your team in **Settings → Account → Manage users**.

## What gets saved

- **Drive folder** → sub-folders `Moulding Costing`, `Welding Costing`, `Custom Reports` (PDFs) and `_data` (shared costing data and large report snapshots — do not delete).
- **Reports tab** → one row per saved report: report number, date, type, products, average cost/margin, PDF link, saved by, source (Manual / AI) and a full snapshot used for re-checking.
- **History tab** → one row per product per report: every input and every calculated figure plus the PDF link — easy to filter, pivot or chart in Sheets.
- **Users tab** → usernames, roles and salted password hashes (never plain text). To disable a user without deleting, set **Active** to `FALSE`.

## Updating the script later

Paste the new code, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same, so no change is needed in the app.

## Troubleshooting

| Message in app | Fix |
|---|---|
| "Unexpected server response…" | Deployment access must be **Anyone**. Re-deploy a new version. |
| "Cannot reach Google server" | Check internet; the URL must end with `/exec` (not `/dev`). |
| "Too many failed attempts" | Wait 15 minutes, or an admin resets the password from Manage users. |
| Forgot admin password | Another admin can reset it from Manage users. If there is no other user, delete the admin row in the Users tab and run `setup` again — a fresh `admin / Admin@123` is created. |
| Signed out on all devices after password change | Expected — changing a password invalidates old sessions. |
