# FinCA — Personal Investment Advisor

FinCA is a data-driven investment recommendation engine built for Indian retail investors.

It takes your income, expenses, dependents, loans, and goals — and tells you exactly where to put your money, how much to invest, and whether you will hit your retirement target.

---

## What it does

- Calculates your real investable surplus after all expenses
- Recommends a personalised asset allocation (equity, gold, FD, debt MF, insurance)
- Projects your retirement corpus using 10 years of real Indian market data
- Runs 1000 Monte Carlo simulations to show worst / likely / best case outcomes
- Flags high-interest loans that should be paid before investing
- Checks if you have an adequate emergency fund
- Projects education costs for child dependents using historical CPI inflation
- Shows how your corpus grows if your income grows at 8% annually
- Calculates tax savings available via ELSS under Section 80C

---

## Data sources

| Dataset | Source |
|---|---|
| Nifty 50 historical prices | NSE India |
| Gold prices (INR/10g) | MCX India |
| CPI Inflation | Reserve Bank of India |
| FD interest rates | RBI / Major banks |
| Mutual fund AUM data | AMFI India (Feb 2026) |

---

## How to run

1. Clone the repository
2. Make sure Python 3.x is installed
3. Place `finca.db` in the same folder as `finca.py`
4. Run:

```
python finca.py
```

---

## Sample output

```
FinCA Report for Ankita S
Years to retirement    : 35
Investable per month   : Rs 10,160
Portfolio return (est) : 13.68% per year
Likely corpus          : Rs 1,04,51,702
Goal                   : Rs 50,00,000
Status                 : On track
```

---

## Tech stack

- Python 3
- SQLite (via sqlite3)
- Monte Carlo simulation (pure Python)
- Data visualisation: Tableau Public (dashboard coming soon)

---

## Project structure

```
FinCA/
├── finca.py          # Main script — logic, calculations, report
├── finca.db          # SQLite database with all market data
├── finca_output.json # Generated after each run — used for Tableau
└── README.md         # This file
```

---

## Author

Built by Ankit as a fintech portfolio project.
Targeting data analyst roles in Indian fintech.
