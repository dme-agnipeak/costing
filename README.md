# AgniPeak Costing App

**Vinayak AgniPeak LLP** ke liye professional Product Body Costing web app — jo aapki Excel sheet ki calculation logic ko ek installable web/Android app me convert karta hai.

## App kya karta hai

- **Fixed Costs tab** — Electricity, Rent, Operator Salary, Labour, Misc, Other Fixed Cost — ek baar daalo, hamesha ke liye save ho jayega (browser me), jab chaho **Unlock** karke edit kar sakte ho.
- **Machine Setup tab** — Working days, machines/day, hours/machine — isse "Fixed Cost per Machine Hour" auto-calculate hota hai.
- **Products tab** — Har product/body ke liye Rate/KG, Raw Qty, Body Weight, GST%, Wastage%, Machine hours daalo — app automatically Material Cost, Fixed Cost allocation, aur **Final Cost per Body** nikal deta hai. Jitne chaho utne products add/edit/delete kar sakte ho.
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

## Costing formula (short summary)

```
Total Fixed Cost      = Electricity + Rent + Operator Salary + Labour + Misc + Other
Planned Machine Hours = Working Days x Avg Machines/Day x Avg Hours/Machine
Fixed Cost / Hour     = Total Fixed Cost / Planned Machine Hours

Material Amount       = Rate/KG x Raw Qty (KG)
GST Amount            = Material Amount x GST%
Material Total        = Material Amount + GST Amount

Net Material (KG)     = Raw Qty x (1 - Wastage%)
Theoretical Bodies    = Net Material (gram) / Body Weight (gram)
(Actual Good Bodies field se override bhi kar sakte ho)

Allocated Fixed Cost  = (Machines Run x Run Hours) x Fixed Cost/Hour
Material Cost / Body  = Material Total / Good Bodies
Fixed Cost / Body     = Allocated Fixed Cost / Good Bodies

FINAL COST / BODY     = Material Cost/Body + Fixed Cost/Body
Profit / Body         = Selling Price - Final Cost/Body
```

Agar aapki original Excel sheet ki koi specific formula isse thodi alag honi chahiye, batao — `src/lib/calculations.js` file me sirf ek jagah edit karke poori app update ho jayegi.

## Manual Override (jab formula se hat kar khud number dena ho)

Har product ke form me ek **yellow "Manual Override"** box hai — "Final Cost / Body". Khali chhodo to app automatic formula se calculate karega. Agar koi specific number khud dalna hai (jaise sheet me manually adjust karte the), to us box me type karo — app us value ko use karega aur "manual" tag dikhayega table me.

## Original Excel sheet me mili gadbad (fix kar di gayi hai app me)

Aapki bheji hui sheet check ki — usme 2 issues the:
1. Pehle "Amount (₹)" column (I15) ki formula `Rate/Gram × Body Weight` thi, jo galti se bahut chhota number de rahi thi (₹0.72 for 1kg raw material @ ₹165/kg) — ye batch ka total material cost nahi, balki kisi aur cheez ka calculation tha.
2. "Fixed Cost / Machine Hour" (R column) ki formula me `#REF!` error tha — broken reference.

Is app me maine sheet ke **doosre, zyada complete section** (jisme Machine Hours, Wastage%, aur Theoretical/Actual Bodies included hain) ki logic use ki hai — jo sahi aur consistent hai: total batch material cost ÷ bodies produced = material cost per body. Isliye app ke numbers upar wali buggy Excel formula se match nahi karenge, lekin actual sahi costing yahi hai.
