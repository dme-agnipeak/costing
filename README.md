# AgniPeak Costing App

**Vinayak AgniPeak LLP** ke liye professional Product Body Costing web app — jo aapki Excel sheet ki calculation logic ko ek installable web/Android app me convert karta hai.

## App kya karta hai

- **Fixed Costs tab** — Electricity, Rent, Operator Salary, Labour, Misc, Other Fixed Cost — ek baar daalo, hamesha ke liye save ho jayega (browser me), jab chaho **Unlock** karke edit kar sakte ho.
- **Machine Setup tab** — Number of Machines, Working Days — isse "Fixed Cost per Machine / Day" auto-calculate hota hai.
- **Products tab** — Har product/body ke liye Body Weight, Rate/KG, Raw Qty, GST%, Avg Production, Selling Price daalo — app automatically Material Cost, Fixed Cost allocation, aur **Final Cost per Body** nikal deta hai — bilkul aapki Excel sheet ki formula chain jaisa. Jitne chaho utne products add/edit/delete kar sakte ho, har product ki apni Avg Production value ho sakti hai.
- **Final Report tab** — Sab products ka summary + totals, aur **Download PDF Report** button — ek professional PDF report seedha phone/laptop me download ho jata hai.
- **Installable App (PWA)** — Ye app "Add to Home Screen" se Android/iPhone/laptop me normal app jaisa install ho jata hai, apna icon milega, aur offline bhi chalega. (Play Store APK nahi hai — lekin use karne me bilkul native app jaisa hi lagega.)
- Sara data aapke apne browser/phone me hi save hota hai (localStorage) — koi server database nahi hai.

## Local me chalane ke liye

```bash
npm install
npm run dev
```

Browser me `http://localhost:5173` khol lo.

Production build banane ke liye:

```bash
npm run build
npm run preview
```

## GitHub par upload karna

```bash
git init
git add .
git commit -m "AgniPeak Costing App"
git branch -M main
git remote add origin https://github.com/<your-username>/agnipeak-costing.git
git push -u origin main
```

(GitHub par pehle ek naya empty repository bana lo, phir upar wali command me apna username/repo-name daal do.)

## Vercel par deploy karna

1. [vercel.com](https://vercel.com) par GitHub account se login karo.
2. **New Project** → apna `agnipeak-costing` GitHub repo select karo.
3. Framework auto-detect ho jayega (**Vite**) — Build Command: `npm run build`, Output Directory: `dist` (already `vercel.json` me set hai).
4. **Deploy** dabao — 1-2 minute me live URL mil jayega (e.g. `agnipeak-costing.vercel.app`).
5. Jab bhi GitHub par naya code push karoge, Vercel automatically re-deploy kar dega.

## Phone me "Android App" ki tarah install karna

1. Vercel wala live link Chrome (Android) me kholo.
2. Chrome menu (⋮) me **"Add to Home Screen"** / **"Install App"** option dikhega — tap karo.
3. App ka icon home screen par aa jayega, aur usse open karne par full-screen native-app jaisa experience milega — bina browser address bar ke.
4. iPhone par Safari me **Share → Add to Home Screen** se same tarike se install hota hai.
5. Laptop/desktop (Chrome/Edge) par address bar me install icon (⊕) dikhta hai, usse bhi ek click me install ho jata hai.

## Structure

```
src/
  components/     -> UI components (forms, tables, tabs)
  lib/
    calculations.js -> saari costing formulas (Excel logic ka JS version)
    storage.js       -> localStorage me data save/load
    pdfExport.js      -> Final PDF report generate karta hai
  App.jsx           -> main app + tabs
public/             -> PWA icons, manifest assets
```

## Costing formula (exact match to your Google Sheet)

```
Total Fixed Cost      = Electricity + Rent + Operator Salary + Labour + Misc + Other
Machine-Wise Fixed    = Total Fixed Cost / No. of Machines
Per-Day (per machine) = Machine-Wise Fixed / Working Days
Fixed Cost / Unit     = Per-Day (per machine) / Avg Production (units/machine/day)

Rate / Gram        = Rate per KG / 1000
Amount (Rs)        = Rate/Gram x Body Weight (gram)      -> material cost of ONE body
GST Amount (Rs)    = Amount x GST%
Material Total     = Amount + GST Amount

COST TOTAL PRICE   = Fixed Cost/Unit + Material Total     <- FINAL COST PER BODY
GST Price          = GST Amount + Fixed Cost/Unit
Without GST Price  = Fixed Cost/Unit + Amount
Final Profit       = Selling Price - Cost Total Price
```

No. of Machines, Working Days, aur Avg Production — teeno **Machine Setup tab** me editable hain (pehle sheet me ye 6 aur 26 hardcoded the, ab app me kabhi bhi change kar sakte ho).

"Raw Qty (KG)" field sirf reference/record ke liye hai — jaisa original sheet me hai, ye final cost calculation me directly use nahi hota (Rate/Gram hamesha Rate-per-KG/1000 hi rehta hai).

## Manual Override (jab formula se hat kar khud number dena ho)

Har product ke form me ek **yellow "Manual Override — Final Cost / Body"** box hai. Khali chhodo to app automatic formula se calculate karega (upar wale formula se). Agar koi specific number khud dalna hai, to us box me type karo — app us value ko use karega aur "manual" tag dikhayega table me. Isse kisi bhi product ki final calculation ko chaho to override kar sakte ho.
