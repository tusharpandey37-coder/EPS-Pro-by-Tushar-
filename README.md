# EPS-95 Pension Calculation Tool

A standalone, zero-dependency web tool for computing member pensions under the Employees' Pension Scheme 1995 (EPS-95). Works from a browser with no server, no build step, and no internet connection (after the initial font load).

## Files

| File | Purpose |
|---|---|
| `index.html` | UI — structure and markup |
| `styles.css` | Stylesheet |
| `engine.js` | Pure calculation engine (no DOM; works in Node.js too) |
| `app.js` | UI wiring — reads inputs, calls engine, renders results |
| `test.js` | Node.js test suite (46 assertions, no extra dependencies) |

## Running locally

Open `index.html` in any modern browser. No server or build step required.

## Hosting on GitHub Pages

1. Fork or copy this repository.
2. Go to **Settings → Pages**, set the source branch to `main` (or `master`), directory `/root`.
3. GitHub Pages will serve the site at `https://<username>.github.io/<repo>/`.

## Running the tests

```bash
npm test
# or
node test.js
```

Requires Node.js ≥ 16. No `npm install` needed — `test.js` only uses `engine.js`.

## What is calculated

- **Past service benefit** — for service before 16-11-1995: multiplier (from the wage-and-years slab table) × Table B factor (from the completed-years-of-actual-service table).
- **Formula pension** — for service from 16-11-1995: `[(pre-2014 pensionable days × min(avg salary, ceiling)) + (weightage days × min(avg salary, ceiling)) + (post-2014 pensionable days × avg salary)] / (365 × 70)`.
- **Total** = Past service benefit + Formula pension, subject to the ₹1,000 statutory minimum.
- **Arrears** = monthly pension × full months, plus a pro-rated commencement-month amount.

## Weightage

730 days are added when the member superannuates at 58 **and** has 20 or more years of post-1995 pensionable service (service after 16-11-1995, net of NCP). This is checked automatically when you select "Superannuation at age 58" as the reason for exit.

## Exit before 58

When a member leaves service before 58 (resignation, cessation, etc.), pension is not payable immediately. It commences on the date the member is deemed to attain 58 — the day before the 58th birthday anniversary (Indian legal convention). No weightage applies in this case.



*Engine returns ₹2,249 — within the documented ±₹1 rounding quirk; see Read Me in the app.

## Scope and limitations

- Member's own pension only (not family/widow/children/orphan pension)
- Normal superannuation at 58, or deferred to 58 after early exit
- Does not cover early pension (voluntarily drawn before 58 with reduction), deferred pension by choice, or the higher-wage-pension option
- Up to 10 employment spells in the ledger (continuous or non-continuous)
- Reference tables (Table B and multiplier) are editable in the UI

## Credits

Developed by Tushar Pandey, RO Dadar. Contact: [tusharpandey@duck.com](mailto:tusharpandey@duck.com)

This is a privately made tool with no connection to EPFO. It is an illustrative calculation aid, not an official determination of pension entitlement. Verify against applicable rules and official records before relying on it.

Copyright © Tushar Pandey.
