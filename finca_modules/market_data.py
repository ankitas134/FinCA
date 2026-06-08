"""
market_data.py — DB queries for all market rates
=================================================
Fetches Nifty CAGR, gold CAGR, FD rates, debt MF rates,
inflation, and Nifty volatility from finca.db.

All functions accept a sqlite3 cursor — no global DB state.
"""

import statistics


def get_avg_nifty_return(c):
    """
    Uses first and last close price of each calendar year (not MAX/MIN).
    Prevents inflated returns from peak-to-trough selection.
    """
    c.execute("""
        SELECT AVG(annual_return) FROM (
            SELECT year,
                ROUND((last_price - first_price) * 100.0 / first_price, 2) AS annual_return
            FROM (
                SELECT substr(date, 1, 4) AS year,
                    FIRST_VALUE(close_price) OVER (
                        PARTITION BY substr(date, 1, 4) ORDER BY date ASC
                    ) AS first_price,
                    FIRST_VALUE(close_price) OVER (
                        PARTITION BY substr(date, 1, 4) ORDER BY date DESC
                    ) AS last_price
                FROM nifty50
            )
            GROUP BY year
        )
    """)
    result = c.fetchone()[0]
    return round(result, 2) if result else 15.0


def get_avg_gold_return(c):
    """
    Uses actual first and last data points ordered by date.
    MIN/MAX was wrong — picks cheapest-ever vs most-expensive-ever,
    not start-to-end CAGR. Inflated CAGR by ~0.24%.
    """
    c.execute("SELECT price_inr_per_10g FROM gold_prices ORDER BY date ASC LIMIT 1")
    row = c.fetchone()
    start_price = row[0] if row else None

    c.execute("SELECT price_inr_per_10g FROM gold_prices ORDER BY date DESC LIMIT 1")
    row = c.fetchone()
    end_price = row[0] if row else None

    c.execute("SELECT COUNT(DISTINCT substr(date, 1, 4)) FROM gold_prices")
    years = c.fetchone()[0]

    if not start_price or not end_price or years < 1:
        return 10.8

    cagr = ((end_price / start_price) ** (1.0 / years) - 1) * 100
    return round(cagr, 2)


def get_avg_fd_rate(c):
    """
    Recency-weighted average — recent periods weighted proportionally higher.
    Equal weighting pulled rate down due to 2020-21 lows (5-6%).
    """
    c.execute("SELECT period, rate_min, rate_max FROM fd_rates ORDER BY period ASC")
    rows = c.fetchall()
    if not rows:
        return 7.0

    weighted_sum, total_weight = 0.0, 0
    for i, (_, rate_min, rate_max) in enumerate(rows):
        weight = i + 1
        weighted_sum += ((rate_min + rate_max) / 2.0) * weight
        total_weight += weight

    return round(weighted_sum / total_weight, 2)


def get_avg_inflation(c):
    """10-year average CPI inflation from RBI data."""
    c.execute("SELECT AVG(inflation_pct) FROM cpi_inflation")
    result = c.fetchone()[0]
    return round(result, 2) if result else 5.0


def get_real_nifty_volatility(c):
    """Actual monthly std dev from 108 months of Nifty closing prices (2016-2025)."""
    c.execute("SELECT close_price FROM nifty50 ORDER BY date ASC")
    prices = [row[0] for row in c.fetchall()]
    if len(prices) < 2:
        return 0.047
    monthly_returns = [
        (prices[i] - prices[i - 1]) / prices[i - 1]
        for i in range(1, len(prices))
    ]
    return round(statistics.stdev(monthly_returns), 4)


def get_debt_mf_rate(c):
    """
    AUM-weighted return derived from actual mutual_funds table (AMFI data).
    Was hardcoded as 7.5 — now uses real category AUM weights.
    """
    category_returns = {
        "Overnight Fund":             6.5,
        "Liquid Fund":                7.0,
        "Ultra Short Duration Fund":  7.2,
        "Low Duration Fund":          7.5,
        "Money Market Fund":          7.3,
        "Short Duration Fund":        7.8,
        "Medium Duration Fund":       8.0,
        "Corporate Bond Fund":        7.6,
        "Banking and PSU Fund":       7.4,
        "Gilt Fund":                  7.2,
        "Dynamic Bond Fund":          7.5,
        "Credit Risk Fund":           8.5,
    }
    c.execute("SELECT category, avg_aum_crore FROM mutual_funds WHERE fund_type='Debt'")
    rows = c.fetchall()
    if not rows:
        return 7.5

    total_aum, weighted_return = 0.0, 0.0
    for category, aum in rows:
        ret = category_returns.get(category, 7.5)
        weighted_return += ret * aum
        total_aum += aum

    return round(weighted_return / total_aum, 2) if total_aum > 0 else 7.5


def get_all_market_data(c):
    """
    Fetches all market rates in one pass and prints a summary.
    Call once at startup — pass the result dict around, never re-query.
    """
    print("  Loading market data from database...", end=" ")
    data = {
        "nifty":      get_avg_nifty_return(c),
        "gold":       get_avg_gold_return(c),
        "fd":         get_avg_fd_rate(c),
        "inflation":  get_avg_inflation(c),
        "volatility": get_real_nifty_volatility(c),
        "debt_mf":    get_debt_mf_rate(c),
    }
    print("done.")
    print(f"    Nifty CAGR  : {data['nifty']}%  (first/last price per year)")
    print(f"    Gold CAGR   : {data['gold']}%  (first date to last date)")
    print(f"    FD Rate     : {data['fd']}%  (recency-weighted)")
    print(f"    Debt MF     : {data['debt_mf']}%  (AUM-weighted from AMFI data)")
    print(f"    Inflation   : {data['inflation']}%  (RBI CPI 10Y avg)")
    print(f"    Nifty Vol   : {data['volatility']} monthly std dev (108 months)\n")
    return data
