"""
report.py — Terminal report printing & JSON export
===================================================
All presentation logic lives here — separated from calculations.

  fmt_inr(amount)   : format a number in Indian number system
  bar(pct, width)   : ASCII progress bar
  print_report(...) : full terminal report
  export_json(...)  : save finca_output.json
"""

import json


# ══════════════════════════════════════════════════════════════════════
# FORMATTING HELPERS
# ══════════════════════════════════════════════════════════════════════

def fmt_inr(amount):
    """
    Format a rupee amount in the Indian number system.
      >= 1 Cr  → Rs X.XX Cr
      >= 1 L   → Rs X.XX L
      else     → Rs X,XX,XXX
    """
    amount = round(abs(amount))
    if amount >= 10_000_000:
        return f"Rs {amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"Rs {amount / 100_000:.2f} L"

    s = str(amount)
    if len(s) <= 3:
        return f"Rs {s}"
    result = s[-3:]
    s = s[:-3]
    while len(s) > 2:
        result = s[-2:] + "," + result
        s = s[:-2]
    if s:
        result = s + "," + result
    return f"Rs {result}"


def bar(pct, width=20):
    """ASCII progress/allocation bar."""
    filled = int(width * pct / 100)
    return "█" * filled + "░" * (width - filled)


# ══════════════════════════════════════════════════════════════════════
# TERMINAL REPORT
# ══════════════════════════════════════════════════════════════════════

def print_report(inputs, calc, market, model_name):
    """
    Prints the full FinCA terminal report.

    Args:
      inputs     : dict from inputs.collect_user_inputs()
      calc       : dict of all computed values (see runner.py)
      market     : dict from market_data.get_all_market_data()
      model_name : str, e.g. 'Random Forest' or 'K-Means'
    """
    sep = "=" * 56

    print(f"\n{sep}")
    print(f"  FinCA Report — {inputs['name']}")
    print(sep)

    # Income & Expenses
    print(f"\n  Income & Expenses")
    print(f"     Monthly income           : {fmt_inr(inputs['monthly_income'])}")
    print(f"     Total expenses           : {fmt_inr(calc['total_expenses'])}")
    print(f"       Rent/EMI               : {fmt_inr(inputs['rent'] + inputs['emi'])}")
    print(f"       Groceries              : {fmt_inr(inputs['groceries'])}")
    print(f"       Utilities              : {fmt_inr(inputs['utilities'])}")
    print(f"       Lifestyle ({inputs['lifestyle']:8s})  : {fmt_inr(calc['lifestyle_spend'])}")
    print(f"       Dependents ({inputs['dependents']} x Rs 6K): {fmt_inr(calc['dependent_cost'])}")
    print(f"     Surplus                  : {fmt_inr(calc['surplus'])}")
    print(f"     Liquid buffer (20%)      : {fmt_inr(round(calc['surplus'] * 0.20))}")
    if calc['high_interest_loans']:
        print(f"     High-interest EMI deducted: {fmt_inr(calc['high_emi_total'])}")
    print(f"     Investable / month       : {fmt_inr(calc['investable'])}")

    # Emergency Fund
    ef_pct = calc['ef_pct']
    print(f"\n  Emergency Fund")
    print(f"     Target (6 months)        : {fmt_inr(calc['ef_required'])}")
    print(f"     Current savings          : {fmt_inr(inputs['savings'])}")
    print(f"     Progress                 : {bar(ef_pct)} {ef_pct}%")
    if inputs['savings'] < calc['ef_required']:
        months_left = round(
            (calc['ef_required'] - inputs['savings']) / max(calc['surplus'] * 0.20, 1)
        )
        print(f"     Shortfall: {fmt_inr(calc['ef_required'] - inputs['savings'])} (~{months_left} months)")
    else:
        print(f"     Complete!")

    # Risk Profile
    print(f"\n  ML Risk Profile ({model_name})")
    print(f"     Surplus ratio            : {calc['surplus_ratio']:.1%}")
    print(f"     ML suggested             : {calc['ml_risk'].upper()}")
    print(f"     Final profile            : {calc['final_risk'].upper()} ({calc['risk_source']})")

    # Market Data
    print(f"\n  Market Data (from DB)")
    print(f"     Nifty CAGR               : {market['nifty']}%")
    print(f"     Gold CAGR                : {market['gold']}%")
    print(f"     FD Rate                  : {market['fd']}%")
    print(f"     Debt MF Rate             : {market['debt_mf']}%")
    print(f"     Weighted return          : {calc['weighted_return'] * 100:.2f}%")

    # Corpus / Monte Carlo
    print(f"\n  Retirement Corpus — Monte Carlo (800 simulations)")
    max_v = max(calc['scenarios']['best_case'], inputs['goal_amount'])
    for label, val, ch in [
        ("Worst (10th %)", calc['scenarios']['worst_case'], "░"),
        ("Likely (50th %)", calc['scenarios']['likely'],    "▒"),
        ("Best  (90th %)", calc['scenarios']['best_case'],  "█"),
    ]:
        w = min(round(val / max_v * 30), 30)
        print(f"     {label} : {fmt_inr(val):>14}  {ch * w}")

    print(f"     With {inputs['income_growth']}% salary growth    : {fmt_inr(calc['corpus_growth'])}")
    print(f"     Inflation-adjusted       : {fmt_inr(calc['inflation_adjusted'])}")
    print(f"     Your goal                : {fmt_inr(inputs['goal_amount'])}")

    gap = inputs['goal_amount'] - calc['scenarios']['likely']
    if gap > 0:
        extra_sip = round(gap / (calc['years_to_retire'] * 12))
        print(f"\n  Gap: {fmt_inr(gap)}")
        print(f"     Increase SIP by {fmt_inr(extra_sip)}/month OR reduce expenses")
    else:
        print(f"\n  On track to meet {fmt_inr(inputs['goal_amount'])}!")

    # Tax
    print(f"\n  Tax ({inputs['regime'].upper()} REGIME — bracket {round(calc['bracket'] * 100)}%)")
    if inputs['regime'] == "old" and calc['elss_allowed']:
        print(f"     ELSS eligible/year       : {fmt_inr(calc['elss_amount'])}")
        print(f"     Tax saved via 80C        : {fmt_inr(calc['tax_saved'])}/year")
        print(f"     Extra via NPS 80CCD(1B)  : {fmt_inr(calc['nps_saving'])}/year")
    else:
        print(f"     Est. annual tax          : {fmt_inr(round(calc['tax_amount']))}")
        print(f"     80C/ELSS                 : Not available (new regime)")

    # Allocation
    print(f"\n  Allocation ({calc['final_risk'].upper()})")
    for asset, pct in calc['allocation'].items():
        monthly_amt = fmt_inr(round(calc['investable'] * pct / 100))
        print(f"     {asset:<22}: {pct:>3}%  {bar(pct, 15)}  {monthly_amt}/mo")

    # Loans
    if calc['high_interest_loans']:
        print(f"\n  High-Interest Loans — clear before investing more")
        for loan in calc['high_interest_loans']:
            print(f"     {loan['type']:15}: {loan['rate']}%  {fmt_inr(loan['emi'])}/month")

    print(f"\n{sep}\n")


# ══════════════════════════════════════════════════════════════════════
# JSON EXPORT
# ══════════════════════════════════════════════════════════════════════

def export_json(inputs, calc, market, model_name, path="finca_output.json"):
    """Saves complete run data to JSON for frontend consumption."""
    payload = {
        "name":                    inputs["name"],
        "age":                     inputs["age"],
        "monthly_income":          inputs["monthly_income"],
        "total_expenses":          calc["total_expenses"],
        "surplus":                 calc["surplus"],
        "surplus_ratio":           round(calc["surplus_ratio"], 4),
        "investable":              calc["investable"],
        "years_to_retire":         calc["years_to_retire"],
        "income_growth_pct":       inputs["income_growth"],
        "risk_profile":            calc["final_risk"],
        "risk_source":             calc["risk_source"],
        "ml_suggested":            calc["ml_risk"],
        "ml_model_used":           model_name,
        "tax_regime":              inputs["regime"],
        "tax_bracket_pct":         round(calc["bracket"] * 100),
        "elss_allowed":            calc["elss_allowed"],
        "elss_amount":             calc["elss_amount"],
        "tax_saved_80c":           calc["tax_saved"],
        "nps_saving_80ccd":        calc["nps_saving"],
        "weighted_return_pct":     round(calc["weighted_return"] * 100, 2),
        "nifty_real_volatility":   market["volatility"],
        "corpus_base":             calc["corpus"],
        "corpus_with_growth":      calc["corpus_growth"],
        "corpus_worst":            calc["scenarios"]["worst_case"],
        "corpus_likely":           calc["scenarios"]["likely"],
        "corpus_best":             calc["scenarios"]["best_case"],
        "inflation_adjusted":      calc["inflation_adjusted"],
        "goal":                    inputs["goal_amount"],
        "gap":                     round(max(inputs["goal_amount"] - calc["scenarios"]["likely"], 0)),
        "emergency_fund_required": round(calc["ef_required"]),
        "emergency_fund_savings":  inputs["savings"],
        "emergency_fund_pct":      calc["ef_pct"],
        "high_interest_loans":     calc["high_interest_loans"],
        "allocation":              calc["allocation"],
        "market_data_used": {
            "nifty_cagr_pct":    market["nifty"],
            "gold_cagr_pct":     market["gold"],
            "fd_rate_pct":       market["fd"],
            "debt_mf_rate_pct":  market["debt_mf"],
            "inflation_pct":     market["inflation"],
            "nifty_monthly_vol": market["volatility"],
        },
    }

    with open(path, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"  Report saved to {path}")
