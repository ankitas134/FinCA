# FinCA — Personal Investment Advisor for India

> **Know exactly where your money should go.**

FinCA is a personal investment advisor built specifically for India. It combines a browser-based frontend with a Python data engine — using 10 years of real Indian market data (Nifty 50, MCX gold, RBI CPI, AMFI mutual funds) to generate a personalised investment plan based on your actual income, expenses, and retirement goals.

🔗 **Live Demo:** [ankitas134.github.io/FinCA](https://ankitas134.github.io/FinCA)

![HTML](https://img.shields.io/badge/Frontend-HTML%2FCS%2FJS-orange?style=flat-square)
![Python](https://img.shields.io/badge/Backend-Python%203.12-blue?style=flat-square)
![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey?style=flat-square)
![ML](https://img.shields.io/badge/ML-scikit--learn%20%7C%20XGBoost%20%7C%20LightGBM-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Features

- **Real surplus calculation** — Actual investable amount after rent, EMIs, groceries, dependents, and lifestyle. No flat assumptions.
- **Monte Carlo engine** — 800 vectorized simulations (numpy cumprod) showing worst, likely, and best-case corpus using real Nifty 50 monthly volatility.
- **ML risk profiling** — Compares K-Means, Random Forest, XGBoost, LightGBM, SVM, and Logistic Regression. Best model (Random Forest, 98% CV accuracy) is auto-selected.
- **Income growth model** — Step-up SIP projection as salary grows, not a static SIP for 30 years.
- **Real market data** — All rates derived from 108 months of actual DB records, not hardcoded constants.
- **Tax optimisation** — Exact savings via ELSS (80C) and NPS (80CCD) for old regime; correct handling for new regime.
- **Loan detection** — Flags loans above 12% interest and deducts EMIs before computing investable surplus.
- **Firebase auth + report history** — Sign in to save and reload past reports (optional).
- **Three themes** — Light, Navy, and Green.
- **Fully private** — All frontend calculations run in the browser. No data sent to any server except optional Firebase save.

---

## Architecture

```
FinCA/
│
├── index.html               ← Frontend: complete single-file web app
│                              (HTML + CSS + JS + Chart.js + Firebase)
│
├── finca.py                 ← Backend entry point — run this in terminal
│                              Orchestrates all modules in 9 clear steps
│
├── finca_modules/           ← Python backend (modular)
│   ├── market_data.py       ← DB queries: Nifty, gold, FD, inflation, MF rates
│   ├── inputs.py            ← Terminal I/O and input validation
│   ├── risk_model.py        ← ML model load / K-Means fallback / prediction
│   ├── finance.py           ← Surplus, allocation, corpus, tax calculations
│   ├── simulation.py        ← Vectorized Monte Carlo (numpy cumprod)
│   └── report.py            ← Terminal report printing + JSON export
│
├── model_comparison.py      ← ML model comparison script
│                              Trains 6 models, evaluates, saves best to pkl
│                              Generates comparison_report.html
│
├── finca.db                 ← SQLite database (108 months of market data)
│
├── best_model.pkl           ← Saved best ML model (generated, gitignored)
├── comparison_report.html   ← Visual model comparison report (generated)
├── finca_output.json        ← Last backend run output (generated, gitignored)
│
├── requirements.txt
└── .gitignore
```

The frontend and backend are independent — the frontend runs fully in the browser, the backend runs locally in terminal. They share the same financial logic and the backend exports `finca_output.json` which can optionally feed the frontend.

---

## Quick Start

### Frontend (browser)

```bash
git clone https://github.com/your-username/FinCA.git
cd FinCA
open index.html       # macOS
# or: start index.html   (Windows)
# or: xdg-open index.html (Linux)
```

No build step, no npm, no server needed.

### Backend (Python terminal)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. (First time) Run model comparison to generate best_model.pkl
python3 model_comparison.py

# 3. Run the advisor
python3 finca.py
```

The backend reads from `finca.db`, profiles you with the best ML model, runs 800 Monte Carlo simulations, prints a full report, and saves `finca_output.json`.

---

## Database

`finca.db` is a SQLite database containing 108 months (2016–2025) of real Indian market data:

| Table | Contents | Source |
|---|---|---|
| `nifty50` | Monthly closing prices | NSE historical data |
| `gold_prices` | Monthly price per 10g (INR) | MCX historical data |
| `cpi_inflation` | Monthly CPI inflation % | RBI data |
| `fd_rates` | FD rate ranges by period | RBI benchmark rates |
| `mutual_funds` | Category AUM (12 debt categories) | AMFI data |

All market rates used in calculations are derived from this database — not hardcoded. This means rates update automatically as new data is added.

---

## ML Model Comparison

Run `model_comparison.py` to train and compare 6 models on 510 synthetic risk profiles:

```bash
python3 model_comparison.py
```

This generates:
- `best_model.pkl` — best model + scaler, auto-loaded by `finca.py`
- `comparison_report.html` — interactive visual report (open in browser)
- `comparison_results.json` — raw metrics

**Results (5-fold cross-validation):**

| Model | CV Accuracy | Notes |
|---|---|---|
| K-Means | 66.7% | Unsupervised baseline (original) |
| Logistic Regression | 96.7% | |
| SVM (RBF) | 96.9% | |
| XGBoost | 97.2% | |
| LightGBM | 97.8% | |
| **Random Forest** | **98.0%** | ← Auto-selected |

**Key finding:** `surplus_ratio` drives 64% of the prediction. `age` adds 29%. `dependents` and `has_emi` contribute the rest.

If `best_model.pkl` is not found, `finca.py` falls back to K-Means automatically.

---

## Market Data & Assumptions

All rates are computed from `finca.db` — not hardcoded:

| Asset | Rate | Method |
|---|---|---|
| Nifty 50 / Equity | ~12% CAGR | First/last price per calendar year (10Y avg) |
| Gold | ~12% CAGR | First date → last date compound growth |
| Fixed Deposits | ~6.9% | Recency-weighted average across periods |
| Debt Mutual Funds | ~7.1% | AUM-weighted across 12 AMFI debt categories |
| Inflation | ~5.0% | 10-year RBI CPI average |
| Nifty Volatility | 0.047 | Monthly std dev across 108 months |

Monte Carlo adds ±real Nifty monthly volatility as random noise around the weighted portfolio return across 800 simulation paths.

> **Disclaimer:** FinCA is not SEBI-registered. Recommendations are informational only. Past returns do not guarantee future performance. Consult a certified financial planner before making investment decisions.

---

## Firebase Setup (Optional — Frontend)

Firebase enables sign-in and report saving. Without it, the frontend works fully — users just can't save reports across sessions.

**To use your own Firebase project:**

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project
2. Enable **Authentication** → Email/Password and Google
3. Enable **Firestore Database**
4. Replace the `firebaseConfig` object near the top of `index.html`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

5. Add these Firestore security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend UI | Vanilla HTML + CSS + JS (zero frameworks) |
| Charts | Chart.js 4.4 |
| Auth & DB | Firebase (Auth + Firestore) |
| Fonts | Inter + Bricolage Grotesque |
| Hosting | GitHub Pages |
| Backend language | Python 3.12 |
| Database | SQLite (108 months of market data) |
| ML models | scikit-learn, XGBoost, LightGBM |
| Simulation | numpy (vectorized Monte Carlo) |
| Build tool | None |

---

## Project Structure (detailed)

```
finca_modules/
├── market_data.py   get_avg_nifty_return()       First/last price per year
│                    get_avg_gold_return()         First/last date CAGR
│                    get_avg_fd_rate()             Recency-weighted average
│                    get_debt_mf_rate()            AUM-weighted from AMFI table
│                    get_avg_inflation()           10Y RBI CPI average
│                    get_real_nifty_volatility()   Monthly std dev (108 months)
│
├── inputs.py        get_int_input()               Validated integer input
│                    get_float_input()             Validated float input
│                    get_lifestyle_input()         frugal/average/lavish
│                    get_regime_input()            new/old tax regime
│                    collect_user_inputs()         All inputs → single dict
│                    collect_loan_inputs()         High-interest loan details
│
├── risk_model.py    load_best_model()             Loads best_model.pkl
│                    train_kmeans_fallback()       48-profile K-Means fallback
│                    get_risk_model()              Entry point (pkl or fallback)
│                    predict_risk_profile()        Hard overrides + ML predict
│
├── finance.py       calculate_surplus()           Income minus all expenses
│                    get_allocation()              % per asset by risk profile
│                    get_weighted_return()         Excludes health_insurance
│                    project_corpus()              Flat SIP future value
│                    project_corpus_with_growth()  Step-up SIP (salary growth)
│                    calculate_tax()               New and old regime slabs
│
├── simulation.py    monte_carlo()                 Vectorized, numpy cumprod
│
└── report.py        fmt_inr()                     Indian number formatting
                     bar()                         ASCII progress bar
                     print_report()                Full terminal report
                     export_json()                 Saves finca_output.json
```

---

## Contributing

Contributions welcome. Open an issue before submitting large changes.

Ideas for improvement:
- [ ] PDF report export
- [ ] SWP (Systematic Withdrawal Plan) calculator for post-retirement
- [ ] EPF / PPF integration
- [ ] Multi-goal support (house, education, retirement)
- [ ] Real-time NAV lookup via AMFI API
- [ ] Frontend/backend data sync (pull rates from finca_output.json)

```bash
git clone https://github.com/your-username/FinCA.git
git checkout -b feat/your-feature
# make changes
git commit -m "feat: description"
git push origin feat/your-feature
# open a pull request
```

---

## License

MIT — free to use, modify, and distribute. Attribution appreciated but not required.

---

Built for Indian investors. If this helped you, consider starring ⭐
