import sqlite3
import json
import random

print("FinCA starting...")

# ── Connect to database ──────────────────────────────────────────────
conn = sqlite3.connect("finca.db")
c = conn.cursor()

# ── Helpers: pull data from DB ───────────────────────────────────────
def get_avg_nifty_return():
    c.execute("""
        SELECT AVG(annual_return) FROM (
            SELECT 
                substr(date,1,4) as year,
                ROUND((MAX(close_price) - MIN(close_price)) * 100.0 / MIN(close_price), 2) as annual_return
            FROM nifty50
            GROUP BY substr(date,1,4)
        )
    """)
    return c.fetchone()[0] or 15.0

def get_avg_gold_return():
    c.execute("""
        SELECT ROUND((MAX(price_inr_per_10g) - MIN(price_inr_per_10g)) * 100.0 / MIN(price_inr_per_10g), 2)
        FROM gold_prices
    """)
    return (c.fetchone()[0] or 90.0) / 9  # total over 9 years → annualised

def get_avg_fd_rate():
    c.execute("SELECT AVG((rate_min + rate_max) / 2.0) FROM fd_rates")
    return c.fetchone()[0] or 7.0

def get_avg_inflation():
    c.execute("SELECT AVG(inflation_pct) FROM cpi_inflation")
    return c.fetchone()[0] or 5.5

# ── Core: calculate actual investable surplus ─────────────────────────
def calculate_surplus(income, rent, emi, groceries, utilities, dependents, lifestyle):
    lifestyle_spend = {
        "frugal":  income * 0.05,
        "average": income * 0.10,
        "lavish":  income * 0.20,
    }.get(lifestyle, income * 0.10)

    dependent_cost = dependents * 5000
    total_expenses = rent + emi + groceries + utilities + lifestyle_spend + dependent_cost
    surplus = income - total_expenses

    return round(surplus), round(total_expenses), round(lifestyle_spend), round(dependent_cost)

# ── Core: allocation based on profile ────────────────────────────────
def get_allocation(age, risk, has_health_issue, dependents, has_emi):
    years_to_retire = max(60 - age, 1)

    if has_health_issue:
        base = {"equity": 20, "gold": 10, "fd": 25, "debt_mf": 20, "health_insurance": 25}
    elif risk == "aggressive":
        base = {"equity": 60, "gold": 10, "fd": 10, "debt_mf": 15, "health_insurance": 5}
    elif risk == "moderate":
        base = {"equity": 40, "gold": 15, "fd": 20, "debt_mf": 20, "health_insurance": 5}
    else:
        base = {"equity": 20, "gold": 20, "fd": 35, "debt_mf": 20, "health_insurance": 5}

    if dependents >= 2:
        base["health_insurance"] = min(base["health_insurance"] + 5, 25)
        base["equity"] = max(base["equity"] - 5, 10)

    if has_emi:
        base["equity"] = max(base["equity"] - 5, 10)
        base["fd"] += 5

    if years_to_retire < 10:
        equity_cut = min(base["equity"], 20)
        base["equity"] -= equity_cut
        base["fd"] += equity_cut

    return base

# ── Core: project retirement corpus ──────────────────────────────────
def project_corpus(monthly_investment, years, allocation):
    avg_equity  = get_avg_nifty_return() / 100
    avg_gold    = get_avg_gold_return() / 100
    avg_fd      = get_avg_fd_rate() / 100
    avg_debt_mf = 0.075

    w = allocation
    total = sum(w.values())
    weighted_return = (
        (w["equity"]          / total) * avg_equity   +
        (w["gold"]            / total) * avg_gold      +
        (w["fd"]              / total) * avg_fd        +
        (w["debt_mf"]         / total) * avg_debt_mf  +
        (w["health_insurance"]/ total) * 0.0
    )

    r = weighted_return / 12
    n = years * 12
    if r == 0:
        corpus = monthly_investment * n
    else:
        corpus = monthly_investment * (((1 + r) ** n - 1) / r) * (1 + r)

    return round(corpus), round(weighted_return * 100, 2)

# ── Core: Monte Carlo simulation ──────────────────────────────────────
def monte_carlo(monthly_investment, years, weighted_return_pct, simulations=1000):
    results = []
    r_annual = weighted_return_pct / 100
    for _ in range(simulations):
        corpus = 0
        for month in range(years * 12):
            monthly_r = (r_annual + random.gauss(0, 0.04)) / 12
            corpus = (corpus + monthly_investment) * (1 + monthly_r)
        results.append(round(corpus))
    results.sort()
    return {
        "worst_case": results[int(simulations * 0.10)],
        "likely":     results[int(simulations * 0.50)],
        "best_case":  results[int(simulations * 0.90)],
    }

# ── Main ──────────────────────────────────────────────────────────────
def run_finca():
    print("\n" + "="*52)
    print("         Welcome to FinCA ")
    print("     Your Personal Investment Advisor")
    print("="*52 + "\n")

    name           = input("Your name: ")
    age            = int(input("Your age: "))
    monthly_income = float(input("Monthly income (₹): "))
    goal_amount    = float(input("Target retirement corpus (₹): "))
    risk           = input("Risk appetite [aggressive / moderate / conservative]: ").strip().lower()
    health_issue   = input("Any major health condition? [yes / no]: ").strip().lower() == "yes"

    print("\n--- Monthly Expenses ---")
    rent       = float(input("Rent / Home EMI (₹): "))
    emi        = float(input("Other EMIs - car, education etc (₹, enter 0 if none): "))
    groceries  = float(input("Groceries & food (₹): "))
    utilities  = float(input("Bills, transport, phone etc (₹): "))
    dependents = int(input("Number of dependents (children/parents): "))
    lifestyle  = input("Lifestyle [frugal / average / lavish]: ").strip().lower()

    years_to_retire = max(60 - age, 1)
    has_emi = emi > 0

    surplus, total_expenses, lifestyle_spend, dependent_cost = calculate_surplus(
        monthly_income, rent, emi, groceries, utilities, dependents, lifestyle
    )

    min_sip = 500
    if surplus < min_sip:
        print(f"\n    Warning: Your monthly surplus is ₹{surplus:,.0f}")
        print(f"  Your expenses (₹{total_expenses:,.0f}) are too close to your income.")
        print(f"  FinCA recommends reducing expenses before investing.")
        print(f"  Proceeding with minimum SIP of ₹{min_sip:,.0f}/month.\n")
        investable = min_sip
    else:
        investable = round(surplus * 0.80)

    allocation       = get_allocation(age, risk, health_issue, dependents, has_emi)
    corpus, w_return = project_corpus(investable, years_to_retire, allocation)
    scenarios        = monte_carlo(investable, years_to_retire, w_return)
    avg_inflation    = get_avg_inflation()

    inflation_adjusted = round(corpus / ((1 + avg_inflation / 100) ** years_to_retire))

    print("\n" + "="*52)
    print(f"  FinCA Report for {name}")
    print("="*52)

    print(f"\n   Income & Expenses")
    print(f"     Monthly income         : ₹{monthly_income:,.0f}")
    print(f"     Total expenses         : ₹{total_expenses:,.0f}")
    print(f"       → Rent/EMI           : ₹{rent + emi:,.0f}")
    print(f"       → Groceries & food   : ₹{groceries:,.0f}")
    print(f"       → Utilities          : ₹{utilities:,.0f}")
    print(f"       → Lifestyle          : ₹{lifestyle_spend:,.0f}")
    print(f"       → Dependents         : ₹{dependent_cost:,.0f}")
    print(f"     Monthly surplus        : ₹{surplus:,.0f}")
    print(f"     Liquid buffer (20%)    : ₹{round(surplus * 0.20):,.0f}")
    print(f"     Investable amount   : ₹{investable:,.0f}/month")

    print(f"\n   Projection")
    print(f"     Years to retirement    : {years_to_retire}")
    print(f"     Portfolio return (est) : {w_return}% per year")
    print(f"     Avg inflation (10yr)   : {avg_inflation:.1f}%")

    print(f"\n   Retirement Corpus Scenarios")
    print(f"     Worst case  (10th %)   : ₹{scenarios['worst_case']:,.0f}")
    print(f"     Likely      (50th %)   : ₹{scenarios['likely']:,.0f}")
    print(f"     Best case   (90th %)   : ₹{scenarios['best_case']:,.0f}")
    print(f"     Inflation-adjusted     : ₹{inflation_adjusted:,.0f}")
    print(f"      Your goal           : ₹{goal_amount:,.0f}")

    gap = goal_amount - scenarios['likely']
    if gap > 0:
        extra = gap / (years_to_retire * 12)
        print(f"\n    Gap to goal          : ₹{gap:,.0f}")
        print(f"  Increase SIP by      : ₹{extra:,.0f}/month to close gap")
        print(f"   Or reduce expenses by: ₹{round(extra / 0.80):,.0f}/month")
    else:
        print(f"\n  You're on track to meet your goal!")

    print(f"\n   Recommended Allocation")
    for asset, pct in allocation.items():
        bar = "" * (pct // 5)
        print(f"     {asset:<20}: {pct:>3}%  {bar}")

    export = {
        "name": name, "age": age,
        "monthly_income": monthly_income,
        "total_expenses": total_expenses,
        "surplus": surplus,
        "investable": investable,
        "years_to_retire": years_to_retire,
        "monthly_sip": investable,
        "weighted_return_pct": w_return,
        "corpus_worst": scenarios['worst_case'],
        "corpus_likely": scenarios['likely'],
        "corpus_best": scenarios['best_case'],
        "inflation_adjusted": inflation_adjusted,
        "goal": goal_amount,
        "gap": max(gap, 0),
        "allocation": allocation
    }
    with open("finca_output.json", "w") as f:
        json.dump(export, f, indent=2)

    print(f"\n  Saved to finca_output.json")
    print("="*52 + "\n")

if __name__ == "__main__":
    run_finca()
    conn.close()