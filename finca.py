"""
finca.py — Entry point & orchestrator
======================================
Ties all modules together. Run this to start FinCA.

    python3 finca.py

Module layout:
    finca_modules/
      market_data.py  — DB queries (Nifty, gold, FD, inflation)
      inputs.py       — terminal input + validation
      risk_model.py   — ML risk profile prediction
      finance.py      — surplus, allocation, corpus, tax
      simulation.py   — Monte Carlo
      report.py       — terminal output + JSON export
"""

import sqlite3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from finca_modules.market_data import get_all_market_data
from finca_modules.inputs      import collect_user_inputs, collect_loan_inputs
from finca_modules.risk_model  import get_risk_model, predict_risk_profile
from finca_modules.finance     import (
    calculate_surplus,
    get_allocation,
    get_weighted_return,
    project_corpus,
    project_corpus_with_growth,
    calculate_tax,
)
from finca_modules.simulation  import monte_carlo
from finca_modules.report      import fmt_inr, print_report, export_json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finca.db")


def run_finca():
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()

    try:
        print("\n" + "=" * 56)
        print("           Welcome to FinCA")
        print("      Your Personal Investment Advisor")
        print("=" * 56 + "\n")

        # ── Step 1: Load market data from DB ─────────────────────────
        market = get_all_market_data(c)

        # ── Step 2: Load / train ML risk model ───────────────────────
        model, scaler, le_or_map, model_name = get_risk_model()
        print()

        # ── Step 3: Collect all user inputs ──────────────────────────
        inputs = collect_user_inputs()
        age     = inputs["age"]
        income  = inputs["monthly_income"]
        emi     = inputs["emi"]
        has_emi = emi > 0

        # ── Step 4: Calculate surplus; block if negative ──────────────
        surplus, total_expenses, lifestyle_spend, dependent_cost = calculate_surplus(
            income, inputs["rent"], emi, inputs["groceries"],
            inputs["utilities"], inputs["dependents"], inputs["lifestyle"]
        )

        if surplus <= 0:
            print(f"\n  {'=' * 52}")
            print(f"  CANNOT GENERATE PLAN")
            print(f"  {'=' * 52}")
            print(f"  Expenses ({fmt_inr(total_expenses)}) exceed income ({fmt_inr(income)}).")
            print(f"  Monthly deficit: {fmt_inr(abs(surplus))}")
            print(f"\n  Reduce expenses or increase income before investing.\n")
            return

        # ── Step 5: ML risk prediction ────────────────────────────────
        surplus_ratio = surplus / income if income > 0 else 0
        ml_risk = predict_risk_profile(
            age, surplus_ratio, inputs["dependents"], has_emi,
            model, scaler, le_or_map, model_name
        )

        print(f"\n  ML Risk Profile ({model_name})")
        print(f"     Surplus ratio     : {surplus_ratio:.1%}")
        print(f"     Suggested profile : {ml_risk.upper()}")
        override = input(
            "     Accept? [Enter / type: aggressive, moderate, conservative]: "
        ).strip().lower()

        final_risk  = override if override in ("aggressive", "moderate", "conservative") else ml_risk
        risk_source = "manual override" if override in ("aggressive", "moderate", "conservative") else "ml-predicted"

        # ── Step 6: Collect loan details ─────────────────────────────
        loans          = collect_loan_inputs(surplus)
        high_emi_total = sum(l["emi"] for l in loans)
        investable     = max(round((surplus - high_emi_total) * 0.80), 500)

        # ── Step 7: Core financial calculations ───────────────────────
        years_to_retire = max(60 - age, 1)
        allocation      = get_allocation(age, final_risk, inputs["health_issue"],
                                         inputs["dependents"], has_emi)
        weighted_return = get_weighted_return(allocation, market)
        corpus          = project_corpus(investable, years_to_retire, weighted_return)
        corpus_growth   = project_corpus_with_growth(
            investable, years_to_retire, weighted_return, inputs["income_growth"]
        )
        scenarios = monte_carlo(
            investable, years_to_retire, weighted_return,
            real_volatility=market["volatility"], simulations=800,
        )
        inflation_adjusted = round(
            scenarios["likely"] / ((1 + market["inflation"] / 100) ** years_to_retire)
        )

        ef_required  = total_expenses * 6
        ef_pct       = min(round((inputs["savings"] / ef_required) * 100), 100) if ef_required > 0 else 100
        annual_income = income * 12
        tax_amount, bracket, elss_allowed = calculate_tax(annual_income, inputs["regime"])

        if elss_allowed:
            monthly_eq_sip = round(investable * allocation["equity"] / 100)
            elss_amount    = min(monthly_eq_sip * 12, 150_000)
            tax_saved      = round(elss_amount * bracket)
            nps_saving     = round(50_000 * bracket)
        else:
            elss_amount = tax_saved = nps_saving = 0

        # ── Step 8: Bundle all computed values ────────────────────────
        calc = {
            "surplus":            surplus,
            "total_expenses":     total_expenses,
            "lifestyle_spend":    lifestyle_spend,
            "dependent_cost":     dependent_cost,
            "surplus_ratio":      surplus_ratio,
            "investable":         investable,
            "years_to_retire":    years_to_retire,
            "ml_risk":            ml_risk,
            "final_risk":         final_risk,
            "risk_source":        risk_source,
            "high_interest_loans": loans,
            "high_emi_total":     high_emi_total,
            "allocation":         allocation,
            "weighted_return":    weighted_return,
            "corpus":             corpus,
            "corpus_growth":      corpus_growth,
            "scenarios":          scenarios,
            "inflation_adjusted": inflation_adjusted,
            "ef_required":        ef_required,
            "ef_pct":             ef_pct,
            "tax_amount":         tax_amount,
            "bracket":            bracket,
            "elss_allowed":       elss_allowed,
            "elss_amount":        elss_amount,
            "tax_saved":          tax_saved,
            "nps_saving":         nps_saving,
        }

        # ── Step 9: Print report & export JSON ────────────────────────
        print_report(inputs, calc, market, model_name)
        export_json(inputs, calc, market, model_name)

    finally:
        conn.close()
        print("  Database connection closed.")


if __name__ == "__main__":
    run_finca()
