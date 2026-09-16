# EPS Pension Verification Tool V1.0

Developed by **Tushar Pandey, RO Dadar**.

A static HTML/CSS/JavaScript web app based on the uploaded EPS-95 pension calculator workbook.

## Run locally
Open `index.html` in a browser. No build step or server is required.

## Publish on GitHub Pages
1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, and `app.js`.
3. Go to **Settings → Pages**.
4. Select **Deploy from a branch**, choose `main` and `/root`.
5. Save. GitHub will provide the public URL.

## Notes
- The calculator follows the workbook's broad logic: past-service benefit, Table B factor, pre/post-01-09-2014 service split, NCP deductions, formula pension and ₹1,000 minimum.
- It is an illustrative, privately made tool. It is not an official EPFO calculator or determination.
- Queries and feedback: tusharpandey@duck.com

Copyright © Tushar Pandey.

## V1.0.1 fix
- Restored the collapsible tools menu behavior.
- Calculator, Arrears, Reference tables and Read Me menu buttons now switch views.
- Menu closes after selection, outside click, or Escape.
- Existing initial example rows and calculation controls are preserved.
