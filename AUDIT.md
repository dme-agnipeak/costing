# Audit Report — AgniPeak Costing v2 → v3.0

## Issues found in v2 and how they were fixed

| # | Area | Issue | Impact | Fix in v3 |
|---|---|---|---|---|
| 1 | Calculation | Rate/Gram was calculated as `Rate / RawQtyGram x RawQtyKg`, so a **blank Raw Qty made material cost ₹0**. | Final cost silently understated | Rate/Gram = Rate per KG / 1000 always; Raw Qty is reference only (and now shows how many units the stock covers). Covered by `npm test`. |
| 2 | Report | "Est. Monthly Profit" summed profit/body × avg production — that is **profit per machine per day**, not monthly. | Misleading figure | Replaced with Average Margin; per-product Profit / Machine / Day and / Month (× working days) added. |
| 3 | PDF | `₹` symbol printed through standard PDF fonts renders as garbage characters. | Unreadable amounts in fixed-cost table | All PDF amounts use "Rs." with Indian digit grouping; text sanitised for PDF fonts. |
| 4 | PDF | No page numbers, no report number, no footer, no signature area; long tables had no repeat header handling for notes; date text could overlap. | Unprofessional / hard to file | New layout: header band with company/GSTIN, report number, date, preparer; KPI boxes; side-by-side fixed cost & machine tables; page X of Y; signature block; formula notes; loss-making warning. |
| 5 | PDF | Only one PDF type; nothing saved anywhere. | No audit trail | Module report, single-product costing sheet (step-by-step), AI custom reports — all saved to Google Drive + Sheet + History. |
| 6 | Stability | `crypto.randomUUID()` crashes on non-HTTPS pages (e.g. LAN IP). | App crash when adding product | Safe ID generator with fallback. |
| 7 | Mobile | Wide tables (900–1100 px) required sideways scrolling; inputs used `type=number` (no decimal keypad on iOS, scroll-wheel changes values); suffix text overlapped typed numbers; `user-scalable=no` blocked zoom. | Hard to use on phone | Card layout on mobile, bottom navigation, decimal keypad, padded suffix/prefix, 16 px inputs (no iOS zoom), zoom allowed, safe-area insets. |
| 8 | UI | Sticky tab bar used hard-coded `top-[65px]`; `no-scrollbar` class was undefined. | Overlap/glitches | New header/nav layout; utility defined. |
| 9 | Validation | Products could be saved with no name, zero weight/rate/production, duplicate names, negative values. | Bad data / divide-by-zero | Required-field validation, duplicate-name check, negative values blocked. |
| 10 | UX | Browser `confirm()` dialogs and Hinglish messages. | Inconsistent | Custom confirm dialogs, toast notifications, all text in professional English. |
| 11 | Data | No backup, no multi-device sync, company details not editable. | Data loss risk | Export/import backup, cloud sync through Drive, editable company details. |
| 12 | Security | No login. | Anyone with the link could use/alter data | Login with hashed passwords, roles, lockout, session expiry, forced password change. |
| 13 | Code | Unused assets (`hero.png`, `vite.svg`), unused variables, duplicate imports. | Bundle bloat | Removed; lint clean. |

## Verification performed

- `npm test` — formula checks against hand-calculated sheet values (e.g. 63 mm body, 42 g, ₹118/kg, 2,400/day → Final cost ₹8.2893, margin 30.92%) plus edge cases (blank raw qty, override, additional cost, zero machines/days/production).
- End-to-end browser test on a 390 × 844 phone viewport and 1366 px desktop against a simulated Apps Script backend: sign-in, forced password change, add product, fixed costs, machines, PDF save to Drive + Sheet, welding tab, settings, AI assistant tool calls (save product → PDF), history, re-check, cross-device data sync.
- AI adapters tested with simulated Claude, OpenAI and Gemini responses including tool calls (Gemini thought signatures preserved).
- Generated PDFs inspected visually, including a 34-product, 3-page report.
- Production build and lint pass with no errors.

## What needs your real accounts

The Google Apps Script must be deployed under your Google account (see `google-apps-script/SETUP.md`), and AI keys must be pasted in Settings. Voice recognition uses the browser's built-in service (Chrome/Edge/Safari); on other browsers it falls back to OpenAI or Gemini transcription.
