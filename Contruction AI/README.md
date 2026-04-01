# Contruction AI (Company Registration Form)

This folder contains a standalone (no-build) HTML/CSS/JS mini-app for registering a construction company via a **16-step wizard**. It collects structured company data (legal, contact, operational areas, packages, materials, pricing, timelines, experience, etc.), then **exports the submission as a JSON download** and also saves a copy in `localStorage` (demo behavior).

## What’s here

- `index.html` — The 16-step registration wizard UI.
- `style.css` — Styling for the form, progress indicator, and layout.
- `script.js` — All dynamic logic: step navigation, validation, operational areas builder, autosave, and JSON export.
- `Contruction Company.json` — A dataset of companies (used as reference/demo data, and by `chech.py`). The registration form itself does **not** read this file.
- `chech.py` — A Python utility that analyzes `Contruction Company.json` for shared email domains, suggests fixes, and can write a “fixed” JSON file.

## What I understand this app does

### 1) Multi-step wizard (16 steps)
The UI is implemented as `.form-step` sections in `index.html`. Only one step is visible at a time.

The flow covers:

1. **Basic Company Information** (company name)
2. **Legal & Registration** (registered, SECP, NTN, year established)
3. **Contact** (phone/email/website)
4. **Operational Areas** (cities → societies/areas → phases/blocks, with per-package PKR/sq ft rates)
5. **Construction Capability** (plot sizes + custom sizes, max floors, basement, house types)
6. **Services Offered** (construction, design, approvals support, extras)
7. **Package Scope** (standard/premium/executive scope toggles & selections)
8. **Materials Used** (cement/steel/bricks/wiring/plumbing/paint, with “Other” text inputs)
9. **Estimated Total Cost Range** (min/max ranges for plot sizes and packages)
10. **Payment Terms** (advance %, installment type, price type, variation clause)
11. **Timeline Estimates** (months for single/double storey by plot size, plus reliability score)
12. **Experience & Track Record** (project ranges + specializations)
13. **Quality Control Practices** (engineer, verification, weekly reporting)
14. **After-Handover Support** (warranty/maintenance/response time)
15. **Legal & Contract Details** (contract/BOQ/penalty/warranty duration)
16. **Ideal Customer Profile** (best for / not ideal for + accept terms)

### 2) Dynamic operational areas builder (cities → societies → phases)
Step 4 is built dynamically in JavaScript:

- `addNewCity()` creates a “City” section.
- Each city can contain multiple societies via `addSociety(cityId)`.
- Each society can contain multiple phases via `addPhase(societyId)`.
- Each phase captures **3 package rates**: `standard`, `premium`, `executive` (PKR/sq ft).
- There are “Other” options for city/society/phase, which reveal a text input.

A built-in city lookup exists in `script.js` as `appState.cities` with predefined societies and phases for major cities (Karachi/Lahore/Islamabad/etc.).

### 3) Validation + autosave
- Navigation buttons (`.btn-next`, `.btn-prev`) move between steps.
- Validation is performed by `validateCurrentStep()`.
  - Checks required inputs.
  - Special format checks for NTN (`1234567-8`) and phone (`+92-300-1234567`).
  - Enforces at least one city and at least one society in Step 4.
  - Enforces at least one plot size and one house type in Step 5.
  - Enforces at least one construction service in Step 6.
- Autosave: on input changes, the app saves the current step’s values into `localStorage` keys like `step1`, `step2`, … using `saveStepData()`.
- When you revisit a step, it restores data via `loadStepData(stepNumber)`.

### 4) Submission output (JSON download + demo localStorage)
On final submission (`handleFormSubmit`):

- It builds a single structured object using `buildFormData()`.
- It triggers `exportDataAsJSON(formData)`, which downloads a JSON file named:
  - `construction-company-<timestamp>.json`
- It simulates an API call (`simulateSubmission`) and (on success) stores the submission into:
  - `localStorage['constructionSubmissions']` (array)
- It then clears step-level storage (`step1`..`step16`) and resets the form.

## Output JSON shape (high level)
The JSON produced by `buildFormData()` is roughly:

```jsonc
{
  "companyName": "...",
  "legalRegistration": {
    "isLegallyRegistered": true,
    "secpRegistered": true,
    "ntnNumber": "1234567-8",
    "yearEstablished": 2020
  },
  "contact": {
    "phone": "+92-300-1234567",
    "email": "...",
    "website": "..."
  },
  "operationalAreas": [
    {
      "city": "Lahore",
      "societies": [
        {
          "societyName": "Bahria Town",
          "phases": [
            {
              "phaseName": "Phase 1",
              "rates": { "standard": 1800, "premium": 2200, "executive": 2800 }
            }
          ]
        }
      ]
    }
  ],
  "constructionCapability": {
    "plotSizes": ["5 Marla", "10 Marla"],
    "maxFloors": 3,
    "basementSupported": false,
    "houseTypes": ["Residential"]
  },
  "servicesOffered": {
    "constructionServices": ["Turnkey"],
    "designServices": ["Architectural"],
    "approvalSupport": ["LDA"],
    "extraServices": ["Solar"]
  },
  "packageScope": {
    "standard": { "designIncluded": true, "fixturesQuality": "Local", "ceilingType": "Simple POP", "kitchenType": "Basic", "bathroomFittings": "Standard" },
    "premium": { "designIncluded": true, "fixturesQuality": "Branded", "ceilingType": "Designer POP", "kitchenType": "Modular", "bathroomFittings": "Branded" },
    "executive": { "designIncluded": true, "fixturesQuality": "Branded (International)", "ceilingType": "Designer POP (Premium)", "kitchenType": "Custom (Designer)", "bathroomFittings": "Branded (Luxury)" }
  },
  "materialsUsed": {
    "standard": { "cementBrand": "Bestway", "cementBrandOther": "", "steelGrade": "60 Grade", "steelGradeOther": "", "bricksType": "A+ Bricks", "bricksTypeOther": "", "wiringBrand": "Pak Cable", "wiringBrandOther": "", "plumbingBrand": "Ashir", "plumbingBrandOther": "", "paintBrand": "Berger", "paintBrandOther": "" },
    "premium": { "...": "..." },
    "executive": { "...": "..." }
  },
  "estimatedCostRange": {
    "3Marla": { "standard": {"min": 0, "max": 0}, "premium": {"min": 0, "max": 0}, "executive": {"min": 0, "max": 0} },
    "5Marla": { "...": "..." },
    "10Marla": { "...": "..." },
    "1Kanal": { "...": "..." },
    "2Kanal": { "...": "..." }
  },
  "paymentTerms": {
    "advancePercentage": 30,
    "installmentType": "Stage-wise",
    "priceType": "Fixed",
    "variationClauseExists": true
  },
  "timelineEstimates": {
    "3Marla": { "singleStorey": {"minTime": 4, "typicalTime": 6, "maxTime": 8}, "doubleStorey": {"minTime": 6, "typicalTime": 9, "maxTime": 12} },
    "5Marla": { "...": "..." },
    "10Marla": { "...": "..." },
    "1Kanal": { "...": "..." },
    "2Kanal": { "...": "..." }
  },
  "experience": {
    "totalProjectsCompleted": "21-50",
    "housesCompleted": "31-100",
    "ongoingProjects": "4-10",
    "specializations": ["Economy Housing", "Small Plots"]
  },
  "qualityControl": {
    "siteEngineerAssigned": true,
    "materialVerification": true,
    "weeklyReporting": true
  },
  "afterHandoverSupport": {
    "defectLiabilityPeriod": 12,
    "maintenanceSupport": true,
    "supportResponseTime": 3
  },
  "legalAndContract": {
    "writtenContractProvided": true,
    "boqProvided": true,
    "penaltyForDelay": true,
    "warrantyDuration": 2
  },
  "idealCustomerProfile": {
    "bestFor": ["First Time Builders"],
    "notIdealFor": ["Luxury Homes"]
  },
  "submissionDate": "2026-...",
  "status": "pending"
}
```

## How to run

This is a static app.

Option A (simplest):
- Open `index.html` in a browser.

Option B (recommended):
- Use VS Code “Live Server” extension or any static server.

The page pulls libraries via CDN:
- Font Awesome
- Google Fonts
- jQuery
- Select2

## Notes / small inconsistencies

- The JS updates a CSS variable `--progress-width` on the progress bar, but `style.css` currently sets `.progress-bar::after { width: 6.25%; }` and does not use the variable. So the progress bar fill may not reflect the current step unless CSS is updated.
- Select2 is included, but the current `script.js` appears to use vanilla `<select>` logic and does not initialize Select2 (no `$(...).select2()` calls).
- Auto-save uses a simple `{ [input.name]: value }` object per step. For checkbox groups that share the same `name` (e.g., `plotSizes`, `houseTypes`, etc.), later checkboxes overwrite earlier ones, so restoring multi-select checkbox groups may be incomplete.
- Phase defaults are chosen based on the selected city, but `addPhase()` derives a “city id” by splitting the society id string, which likely fails to locate the real city select element. As a result, phase options may fall back to Karachi defaults more often than intended.

## `chech.py` (Python) utility

`chech.py` reads a company JSON dataset and:
- Groups companies by email domain to detect duplicates/shared domains.
- Prints similarity heuristics (same cities/services/pricing range).
- Generates suggested unique emails.
- Optionally writes a “fixed” JSON output.

Note: it currently hard-codes Windows absolute paths in `__main__`. You’ll likely want to change those to relative paths before running it in another environment.
