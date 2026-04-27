# FinCA — Personal Investment Advisor for India

> **Know exactly where your money should go.**

FinCA is a free, browser-based personal investment advisor built specifically for India. It uses 10 years of real Indian market data — Nifty 50, gold, RBI inflation, AMFI mutual funds — to generate a personalised investment plan based on your actual income, expenses, and retirement goals.

🔗 **Live Demo:** [ankitas134.github.io/finCA](https://ankitas134.github.io/finCA)

---

##  Features

- **Real surplus calculation** — Computes your actual investable amount after rent, EMIs, groceries, dependents, and lifestyle. No flat 20% assumptions.
- **Monte Carlo engine** — Runs 800 market simulations showing worst, likely, and best-case retirement outcomes based on real Nifty 50 volatility data.
- **Income growth model** — Projects corpus as your salary increases each year, not a static SIP for 35 years.
- **Loan detection** — Flags high-interest loans above 12% and factors them out before computing investable surplus.
- **Health & protection guidance** — Recommends specific health insurance plans matched to your age, dependents, and health profile.
- **Tax optimisation** — Detects your bracket and shows exact savings via ELSS (80C) and NPS (80CCD).
- **Where to invest** — Specific fund names, ETFs, stocks, SGBs, and FD options ranked by suitability per asset class.
- **Firebase auth + report history** — Optionally sign in to save and reload past reports.
- **Three themes** — Light, Navy, and Green.
- **Fully private** — All calculations run in your browser. No data is sent to any server (except optional Firebase save).

---

##  What FinCA Analyses

| Factor | Detail |
|---|---|
| Monthly surplus | Income minus all real expenses |
| Emergency fund gap | 6-month expense buffer check |
| High-cost loans | Flags any loan above 12% interest |
| Asset allocation | Equity, Gold, FD, Debt MF, Health Insurance |
| Retirement corpus | 10th / 50th / 90th percentile outcomes |
| Tax savings | 80C via ELSS + 80CCD(1B) via NPS |
| Financial health score | 0–100 score with grade |

---

##  Getting Started

### Option 1 — GitHub Pages (Recommended, free)

1. Fork or clone this repo
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch → `main` → `/ (root)`**
4. Your site will be live at `https://your-username.github.io/finca`

That's it. No build step, no dependencies, no server required.

### Option 2 — Run Locally

```bash
git clone https://github.com/your-username/finca.git
cd finca
# Just open index.html in your browser
open index.html
```

No npm, no bundler, no setup needed.

---

##  Project Structure

```
finca/
├── index.html        # Entire app — single self-contained file
└── README.md
```

The entire application is a single HTML file. All CSS, JavaScript, and logic live inline. Chart.js is loaded from CDN. Firebase is loaded from CDN.

---

##  Firebase Setup (Optional)

Firebase is used only for:
- Email / Google sign-in
- Saving reports to Firestore (so users can reload them later)

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

5. In Firestore, add these security rules:

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

> **Note:** If you don't set up Firebase, the app works fully — users just can't save reports across sessions.

---

## 📐 Market Data & Assumptions

| Asset | Return Used | Source |
|---|---|---|
| Nifty 50 / Equity | 20.65% CAGR | 10-year historical average |
| Gold | 10.8% CAGR | 10-year MCX average |
| Fixed Deposits | 7.0% p.a. | RBI benchmark |
| Debt Mutual Funds | 7.5% p.a. | AMFI category average |
| Inflation | 5.0% p.a. | RBI CPI average |

Monte Carlo simulations add ±8% random annual variance around the weighted portfolio return to model real-world uncertainty.

> **Disclaimer:** FinCA is not a SEBI-registered investment advisor. Recommendations are informational only. Past returns do not guarantee future performance. Always consult a certified financial planner before making investment decisions.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML + CSS + JS |
| Charts | Chart.js 4.4 |
| Auth & DB | Firebase (Auth + Firestore) |
| Fonts | Inter + Bricolage Grotesque (Google Fonts) |
| Hosting | GitHub Pages |
| Build tool | None |

---

##  Contributing

Contributions are welcome! Ideas for improvement:

- [ ] PDF report export
- [ ] SWP (Systematic Withdrawal Plan) calculator for post-retirement
- [ ] Step-up SIP visualiser
- [ ] EPF / PPF integration
- [ ] Multi-goal support (house, education, retirement)
- [ ] Real-time NAV lookup via AMFI API

To contribute:

```bash
git clone https://github.com/your-username/finca.git
# Make your changes to index.html
git add .
git commit -m "feat: your feature description"
git push origin main
```

Please open an issue before submitting large changes.

---

##  License

MIT License — free to use, modify, and distribute. Attribution appreciated but not required.

---



Built with  for Indian investors.

If this helped you, consider starring the repo ⭐ — it helps others find it.
