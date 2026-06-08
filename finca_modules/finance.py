"""
finance.py — Core financial calculations
=========================================
Everything that turns raw inputs into financial numbers:
  - Surplus & expense breakdown
  - Asset allocation by risk profile
  - Weighted portfolio return
  - Corpus projection (flat SIP and with salary growth)
  - Tax calculation (new and old regime)

No DB access, no I/O — pure functions, easy to unit test.
"""


def calculate_surplus(income, rent, emi, groceries, utilities, dependents, lifestyle):
    """
    Breaks down monthly income into expenses and investable surplus.

    Lifestyle spend is a % of income:
      frugal  = 5%   (minimal eating out, no luxuries)
      average = 10%  (occasional dining, subscriptions)
      lavish  = 20%  (frequent dining, travel, gadgets)

    Dependent cost: Rs 6,000/dependent/month (aligned with JS frontend).

    Returns: (surplus, total_expenses, lifestyle_spend, dependent_cost)
    """
    lifestyle_pct = {"frugal": 0.05, "average": 0.10, "lavish": 0.20}
    lifestyle_spend = income * lifestyle_pct[lifestyle]
    dependent_cost  = dependents * 6_000
    total_expenses  = rent + emi + groceries + utilities + lifestyle_spend + dependent_cost
    surplus         = income - total_expenses

    return (
        round(surplus),
        round(total_expenses),
        round(lifestyle_spend),
        round(dependent_cost),
    )


def get_allocation(age, risk, has_health_issue, dependents, has_emi):
    """
    Returns recommended % allocation across 5 asset classes.

    Base allocations by risk profile:
      aggressive  : 60% equity, 10% gold, 10% FD, 15% debt MF, 5% health
      moderate    : 40% equity, 15% gold, 20% FD, 20% debt MF, 5% health
      conservative: 20% equity, 20% gold, 35% FD, 20% debt MF, 5% health
      health flag : 20% equity, 10% gold, 25% FD, 20% debt MF, 25% health

    Adjustments (applied in order, each capped to avoid negatives):
      - 2+ dependents      → +5% health, -5% equity
      - Has EMI            → -5% equity, +5% FD
      - <10 years to retire→ -20% equity → +20% FD (capital preservation)
    """
    years_to_retire = max(60 - age, 1)

    if has_health_issue:
        base = {"equity": 20, "gold": 10, "fd": 25, "debt_mf": 20, "health_insurance": 25}
    elif risk == "aggressive":
        base = {"equity": 60, "gold": 10, "fd": 10, "debt_mf": 15, "health_insurance": 5}
    elif risk == "moderate":
        base = {"equity": 40, "gold": 15, "fd": 20, "debt_mf": 20, "health_insurance": 5}
    else:  # conservative
        base = {"equity": 20, "gold": 20, "fd": 35, "debt_mf": 20, "health_insurance": 5}

    if dependents >= 2:
        base["health_insurance"] = min(base["health_insurance"] + 5, 25)
        base["equity"]           = max(base["equity"] - 5, 10)

    if has_emi:
        base["equity"] = max(base["equity"] - 5, 10)
        base["fd"]    += 5

    if years_to_retire < 10:
        cut            = min(base["equity"], 20)
        base["equity"] -= cut
        base["fd"]     += cut

    return base


def get_weighted_return(allocation, market):
    """
    Computes weighted portfolio return excluding health_insurance.

    Health insurance is a cost, not an asset — its 0% return was
    silently dragging down the weighted return and underestimating
    corpus by ~Rs 1.74 Cr on a 30-year moderate profile.

    Formula: sum(asset_pct / investable_total * asset_return)
    where investable_total excludes health_insurance %.
    """
    investable = {k: v for k, v in allocation.items() if k != "health_insurance"}
    total      = sum(investable.values())

    returns_map = {
        "equity":  market["nifty"]   / 100,
        "gold":    market["gold"]    / 100,
        "fd":      market["fd"]      / 100,
        "debt_mf": market["debt_mf"] / 100,
    }

    weighted = sum(
        (pct / total) * returns_map[asset]
        for asset, pct in investable.items()
    )
    return round(weighted, 6)


def project_corpus(monthly_investment, years, weighted_return):
    """
    Standard SIP future value formula (flat SIP — no salary growth).

    FV = SIP * [((1+r)^n - 1) / r] * (1+r)
    where r = monthly rate, n = total months.
    """
    r = weighted_return / 12
    n = years * 12
    if r == 0:
        return round(monthly_investment * n)
    return round(monthly_investment * (((1 + r) ** n - 1) / r) * (1 + r))


def project_corpus_with_growth(monthly_investment, years, weighted_return, income_growth_pct):
    """
    Corpus projection with annual salary growth (step-up SIP).

    More realistic than flat SIP — as salary grows, so does the
    monthly investment. Each month the SIP compounds by g_monthly.

    JS frontend had growC() for this; Python backend was missing it.
    """
    r_monthly = weighted_return / 12
    g_monthly = (income_growth_pct / 100) / 12
    corpus    = 0.0
    sip       = monthly_investment

    for _ in range(years * 12):
        corpus = (corpus + sip) * (1 + r_monthly)
        sip   *= (1 + g_monthly)

    return round(corpus)


def calculate_tax(annual_income, regime="new"):
    """
    Computes income tax under new or old Indian tax regime.

    Returns: (tax_amount, marginal_bracket_rate, elss_allowed)

    New regime (post-2023 default):
      - Lower slab rates
      - No 80C/ELSS deductions allowed

    Old regime:
      - Higher slab rates
      - 80C (ELSS, PPF etc.) and NPS 80CCD(1B) deductions available
    """
    if regime == "new":
        if annual_income <= 300_000:
            return 0.0, 0.0, False
        elif annual_income <= 700_000:
            return (annual_income - 300_000) * 0.05, 0.05, False
        elif annual_income <= 1_000_000:
            return 20_000 + (annual_income - 700_000) * 0.10, 0.10, False
        elif annual_income <= 1_200_000:
            return 50_000 + (annual_income - 1_000_000) * 0.15, 0.15, False
        elif annual_income <= 1_500_000:
            return 80_000 + (annual_income - 1_200_000) * 0.20, 0.20, False
        else:
            return 140_000 + (annual_income - 1_500_000) * 0.30, 0.30, False
    else:  # old regime
        if annual_income <= 250_000:
            return 0.0, 0.0, True
        elif annual_income <= 500_000:
            return (annual_income - 250_000) * 0.05, 0.05, True
        elif annual_income <= 1_000_000:
            return 12_500 + (annual_income - 500_000) * 0.20, 0.20, True
        else:
            return 112_500 + (annual_income - 1_000_000) * 0.30, 0.30, True
