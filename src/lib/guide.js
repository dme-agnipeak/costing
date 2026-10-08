// "How to Use" guide. Shown in the Help tab and given to the AI assistant so it can
// answer questions about the app's features.

export const GUIDE = [
  {
    id: 'start',
    title: 'Getting started',
    body: `AgniPeak Costing calculates the exact cost, profit and margin of every product for two separate processes: Moulding and Welding.
1. Sign in with your username and password.
2. Open Moulding or Welding from the menu.
3. Check the Fixed Costs and Machine Setup sections once (they are saved automatically).
4. Add your products in the Products section.
5. Open the Report section and tap "Save PDF" — the PDF downloads, is saved in Google Drive and the record is added to History.`,
  },
  {
    id: 'modules',
    title: 'Moulding and Welding tabs',
    body: `Each tab is a complete, independent costing module with the same columns and formulas:
- Products — add, edit, duplicate, delete products and see live costing.
- Fixed Costs — monthly electricity, rent, operator salary, labour, miscellaneous and other fixed costs. Tap "Edit" to unlock, then "Done".
- Machine Setup — number of machines and working days per month. Gives the Fixed Cost per Machine per Day.
- Report — summary of all products with PDF export and Google Drive save.
Moulding and Welding keep separate fixed costs, machines and products, so welding machines and moulding machines are costed correctly.`,
  },
  {
    id: 'formula',
    title: 'How the cost is calculated',
    body: `- Total Monthly Fixed Cost = sum of all fixed cost heads.
- Fixed Cost per Machine per Day = Total Monthly Fixed Cost / Number of Machines / Working Days.
- Fixed Cost per Unit = Fixed Cost per Machine per Day / Avg Production per Machine per Day.
- Material Cost = Rate per KG / 1000 x Weight per Unit (grams).
- GST Amount = Material Cost x GST %.
- Final Cost per Unit = Fixed Cost per Unit + Material Cost incl. GST + Additional Cost per Unit (optional).
- Profit per Unit = Selling Price - Final Cost per Unit. Margin % = Profit / Selling Price x 100.
- Profit per Machine per Month = Profit per Unit x Avg Production x Working Days.
Raw Qty (KG) is for stock reference; the app shows how many units that stock can produce.
Manual Override: type a value in "Manual Override - Final Cost" to replace the automatic final cost for one product. It is marked "Manual" everywhere and with * in PDFs.`,
  },
  {
    id: 'pdf',
    title: 'PDF reports and Google Drive',
    body: `- Report section → "Save PDF" creates a professional PDF of all products (or only the ones you select).
- Each product card also has a "PDF" button for a detailed single-product costing sheet with step-by-step calculation.
- When Google Drive is connected, each PDF is uploaded automatically into your Drive folder (sub-folders "Moulding Costing", "Welding Costing" and "Custom Reports"), and a row is written to the Google Sheet (tabs "Reports" and "History").
- If you are offline, the report is kept as "Pending" and uploaded later from History → "Sync pending".`,
  },
  {
    id: 'history',
    title: 'History and re-check',
    body: `- History lists every saved report with date, type, products, who saved it and the Drive PDF link.
- Search by product name or report number, and filter by Moulding, Welding or Custom.
- Open a report to see the saved inputs and results.
- "Re-check" recalculates the saved inputs with the costing engine and confirms that every figure matches. It also shows how today's cost compares with the saved cost.
- "Download PDF" regenerates the same PDF; "Restore to calculator" copies the saved products back into the Moulding/Welding tab for editing.`,
  },
  {
    id: 'ai',
    title: 'AI Assistant (text and voice)',
    body: `The AI Assistant can do everything the tabs can do — just ask in plain language, typed or spoken.
Examples:
- "Add a moulding product 63 mm body, weight 42 grams, rate 118 per kg, production 2400 per day, selling price 12."
- "What is the final cost of 63 mm body if raw material rate becomes 125?"
- "Compare margin of all welding products and make a PDF."
- "Set moulding electricity to 3,80,000."
- "Show last week's reports for 75 mm body."
- "How do I change my password?"
Voice: tap the microphone, speak, and the assistant replies on screen and aloud. Turn on "Hands-free" to keep the conversation going without tapping.
The AI uses the app's own calculation engine for every number, so results always match the tabs and the PDFs.
Set up once in Settings → AI Assistant: choose Claude, ChatGPT or Gemini and paste the API key.`,
  },
  {
    id: 'settings',
    title: 'Settings',
    body: `- Company — name, address, GSTIN and contact shown on every PDF.
- Google Drive — the Apps Script web-app URL that connects the app to your Drive folder and Google Sheet. Use "Test connection" to verify.
- AI Assistant — provider, API keys, model and reply language. Admins can save the AI setup to the cloud so every device uses it automatically.
- Voice — recognition language (English India / Hindi / English US), speaking speed, voice and hands-free mode.
- Account — change password and sign out. Admins can add or remove users.
- Data — export a backup file, import a backup, or reset to defaults.`,
  },
  {
    id: 'mobile',
    title: 'Install on mobile',
    body: `- Android (Chrome): open the app link, tap the menu (⋮) → "Install app" / "Add to Home screen".
- iPhone (Safari): tap Share → "Add to Home Screen".
- The app opens full-screen like a native app and works offline for calculations. Google Drive saving and AI need internet.`,
  },
  {
    id: 'security',
    title: 'Login and security',
    body: `- Only users with a username and password can open the app.
- With Google Drive connected, users are stored in the "Users" tab of the Google Sheet (passwords are hashed, never stored as plain text). The first login is admin / Admin@123 and you are asked to change it immediately.
- After 5 wrong passwords an account is locked for 15 minutes.
- Sessions last 30 days with "Keep me signed in", otherwise 12 hours.
- API keys are stored on the device (and in your private Apps Script settings if you choose cloud sync). Never share screenshots of Settings.`,
  },
]

export function guideText() {
  return GUIDE.map((g) => `## ${g.title}\n${g.body}`).join('\n\n')
}
