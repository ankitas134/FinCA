# FinCA — Personal Investment Advisor

> **[Try it live →](https://ankitas34.github.io/FinCA/)**

FinCA is a data-driven investment recommendation engine built for Indian retail investors. It takes your income, expenses, dependents, loans, and goals — and tells you exactly where to put your money, how much to invest, and whether you will hit your retirement target.

---

## What it does

- Calculates your real investable surplus after all expenses (rent, EMIs, groceries, utilities, dependents, lifestyle)
- Recommends a personalised asset allocation across equity, gold, FD, debt MF, and health insurance
- Projects your retirement corpus using 800 Monte Carlo simulations showing worst / likely / best case outcomes
- Models corpus growth with annual income step-up (e.g. 8% salary growth each year)
- Flags high-interest loans (above 12%) and excludes their EMIs before computing your investable amount
- Checks if you have an adequate 6-month emergency fund
- **Recommends exact products** — specific mutual funds, stocks (with NSE tickers), Index ETFs, SGBs, FD options, and health insurance plans — matched to your risk profile
- **Generates a numbered Action Plan** showing what to do first, second, and third in priority order
- Calculates tax savings available via ELSS under Section 80C and NPS under Section 80CCD(1B)
- Inflation-adjusts your corpus to show purchasing power in today's rupees

---

## Screenshots

| Report & Corpus Projection | Where to Invest | Action Plan |
|---|---|---|
| Monte Carlo bars with goal marker | Risk-matched funds, stocks, ETFs | Step-by-step checklist with timelines |

---

## Data sources

| Dataset | Source |
|---|---|
| Nifty 50 historical prices | NSE India |
| Gold prices (INR/10g) | MCX India |
| CPI Inflation | Reserve Bank of India |
| FD interest rates | RBI / Major banks |
| Mutual fund AUM data | AMFI India (Feb 2026) |

All data is stored locally in `finca.db` (SQLite). No external API calls at runtime.

---

## How to use

### Option 1 — Web app (recommended, no setup needed)

Open **[https://ankitas34.github.io/FinCA/](https://ankitas34.github.io/FinCA/)** in any browser. Fill in your details and get your report instantly. Everything runs in the browser — no data is sent to any server.

### Option 2 — Python CLI

```bash
git clone https://github.com/ankitas34/FinCA.git
cd FinCA
python finca.py
```

Requirements: Python 3.x. No pip installs needed — uses only stdlib (`sqlite3`, `json`, `random`).

Place `finca.db` in the same folder as `finca.py` before running.

---

## Sample output (CLI)

```
FinCA Report for Ankita S
Years to retirement    : 35
Investable per month   : Rs 18,160
Portfolio return (est) : 13.68% per year
Likely corpus          : Rs 1,84,51,782
Goal                   : Rs 50,00,000
Status                 : On track
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Web frontend | Vanilla HTML + CSS + JavaScript (zero dependencies) |
| Calculations | Monte Carlo simulation in JS (800 runs) and Python |
| Database | SQLite via Python `sqlite3` |
| Hosting | GitHub Pages |
| Python backend | Pure Python 3 — no frameworks |

---

## Features in the web app

### 5 result tabs

| Tab | What it shows |
|---|---|
| **Corpus Projection** | Animated bars for worst / likely / best / with-income-growth scenarios |
| **Portfolio Allocation** | Asset class breakdown with percentage bars |
| **Income Breakdown** | Every rupee of your salary accounted for |
| **Tax Saving** | ELSS 80C calculation and NPS 80CCD benefit |
| **Where to Invest** | Specific funds, stocks, ETFs, SGBs, FDs, insurance plans |
| **Action Plan** | Numbered checklist — what to do this week, this month, month 2, every April |

### Where to Invest — what it recommends

- **Equity** — Mutual funds (Parag Parikh Flexi Cap, Nippon Small Cap, ICICI Bluechip), Index ETFs (NIFTYBEES, JUNIORBEES), direct stocks (HDFC Bank, TCS, Reliance, Asian Paints, ITC — with NSE tickers), ELSS for 80C
- **Gold** — Sovereign Gold Bonds (RBI), Gold ETF (GOLDBEES), Digital Gold — ranked by cost-efficiency
- **Fixed Income** — SBI FD, IDFC First Bank FD (8.25%), RBI Floating Rate Bond (8.05%), Post Office MIS
- **Debt MF** — HDFC Low Duration, Aditya Birla Money Market, ICICI Short Term, Nippon Gilt
- **Protection** — Niva Bupa ReAssure, Star Health, HDFC ERGO Optima Secure, NPS Tier-1

All recommendations shift based on the user's risk profile (aggressive / moderate / conservative).

### Action Plan — priority order

1. Clear high-interest loans (if any above 12%)
2. Build 6-month emergency fund
3. Buy health insurance
4. Start ELSS SIP (exhausts 80C, saves tax)
5. Add remaining equity SIP
6. Set up gold allocation (SGB or ETF)
7. Open RD or debt MF SIP
8. Open NPS for extra Rs 50,000 deduction
9. Set calendar reminders for annual SIP step-up and rebalancing
10. Close gap to retirement goal (if any)

---

## Project structure

```
FinCA/
├── index.html          # Full web app — all logic runs in browser
├── finca.py            # Python CLI — same logic, terminal output
├── finca.db            # SQLite database with 10 years of Indian market data
├── finca_output.json   # Generated after each CLI run
└── README.md           # This file
```

---

## Disclaimer

FinCA is not a SEBI-registered investment advisor. Product recommendations are for informational purposes only and based on publicly available data. Past returns are not guaranteed. Verify current rates, NAVs, and terms before investing. Consult a certified financial advisor (CFP/RIA) for personalised advice.

---

## Author

**Ankita S**  
[GitHub](https://github.com/ankitas134)
