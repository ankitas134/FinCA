"""
server.py — FinCA Flask API server
====================================
Serves the connected frontend and exposes API endpoints.

Usage:
    python3 server.py

Then open: http://localhost:5000

Endpoints:
    GET  /                → serves app/app.html
    GET  /api/market-data → live rates from finca.db
    GET  /api/model-info  → active ML model name + accuracy
    POST /api/calculate   → full plan calculation, returns JSON
"""

import os, sys, sqlite3, json, pickle
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from finca_modules.market_data import get_all_market_data
from finca_modules.risk_model  import get_risk_model, predict_risk_profile
from finca_modules.finance     import (
    calculate_surplus, get_allocation, get_weighted_return,
    project_corpus, project_corpus_with_growth, calculate_tax,
)
from finca_modules.simulation import monte_carlo

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, 'app'))
CORS(app)
DB_PATH = os.path.join(BASE_DIR, 'finca.db')

# Load once at startup
print("Loading ML model...", end=" ", flush=True)
_model, _scaler, _le, _model_name = get_risk_model()
print("done.")

print("Loading market data...", end=" ", flush=True)
_conn = sqlite3.connect(DB_PATH)
_market = get_all_market_data(_conn.cursor())
_conn.close()
print("done.")


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'app.html')


@app.route('/css/<path:filename>')
def css_files(filename):
    return send_from_directory(os.path.join(app.static_folder, 'css'), filename)


@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory(os.path.join(app.static_folder, 'js'), filename)


@app.route('/api/market-data')
def market_data():
    return jsonify(_market)


@app.route('/api/model-info')
def model_info():
    pkl_path = os.path.join(BASE_DIR, 'best_model.pkl')
    cv_acc = None
    if os.path.exists(pkl_path):
        with open(pkl_path, 'rb') as f:
            cv_acc = pickle.load(f).get('cv_accuracy')
    return jsonify({
        'model_name': _model_name,
        'cv_accuracy': round(cv_acc, 4) if cv_acc else None,
        'fallback': _model_name == 'K-Means',
    })


@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        d = request.get_json(force=True)

        name          = str(d.get('name', 'Investor')).strip() or 'Investor'
        age           = int(d.get('age', 30))
        income        = float(d.get('monthly_income', 0))
        goal          = float(d.get('goal_amount', 10_000_000))
        savings       = float(d.get('savings', 0))
        income_growth = float(d.get('income_growth', 8))
        regime        = str(d.get('regime', 'new'))
        health_issue  = bool(d.get('health_issue', False))
        rent          = float(d.get('rent', 0))
        emi           = float(d.get('emi', 0))
        groceries     = float(d.get('groceries', 0))
        utilities     = float(d.get('utilities', 0))
        dependents    = int(d.get('dependents', 0))
        lifestyle     = str(d.get('lifestyle', 'average'))
        loans         = d.get('loans', [])
        risk_override = d.get('risk_override', None)

        if income <= 0:
            return jsonify({'error': 'Monthly income must be greater than 0.'}), 400
        if age < 18 or age > 59:
            return jsonify({'error': 'Age must be between 18 and 59.'}), 400
        if lifestyle not in ('frugal', 'average', 'lavish'):
            return jsonify({'error': 'Lifestyle must be frugal, average, or lavish.'}), 400

        has_emi = emi > 0 or any(l.get('emi', 0) > 0 for l in loans)
        surplus, total_expenses, lifestyle_spend, dependent_cost = calculate_surplus(
            income, rent, emi, groceries, utilities, dependents, lifestyle
        )

        if surplus <= 0:
            return jsonify({
                'error':          'negative_surplus',
                'message':        f'Monthly expenses exceed income by ₹{int(abs(surplus)):,}/month. Reduce expenses before investing.',
                'total_expenses': total_expenses,
                'income':         income,
                'deficit':        abs(surplus),
            }), 422

        high_cost      = [l for l in loans if float(l.get('rate', 0)) > 12 and float(l.get('emi', 0)) > 0]
        high_emi_total = sum(float(l['emi']) for l in high_cost)
        investable     = max(round((surplus - high_emi_total) * 0.80), 500)

        surplus_ratio = surplus / income if income > 0 else 0
        ml_risk = predict_risk_profile(
            age, surplus_ratio, dependents, has_emi,
            _model, _scaler, _le, _model_name
        )
        final_risk  = risk_override if risk_override in ('aggressive', 'moderate', 'conservative') else ml_risk
        risk_source = 'manual override' if risk_override in ('aggressive', 'moderate', 'conservative') else 'ml-predicted'

        years_to_retire = max(60 - age, 1)
        allocation      = get_allocation(age, final_risk, health_issue, dependents, has_emi)
        weighted_return = get_weighted_return(allocation, _market)
        corpus          = project_corpus(investable, years_to_retire, weighted_return)
        corpus_growth   = project_corpus_with_growth(investable, years_to_retire, weighted_return, income_growth)
        scenarios       = monte_carlo(investable, years_to_retire, weighted_return, _market['volatility'], simulations=800)
        inflation_adj   = round(scenarios['likely'] / ((1 + _market['inflation'] / 100) ** years_to_retire))

        ef_required = round(total_expenses * 6)
        ef_pct      = min(round((savings / ef_required) * 100), 100) if ef_required > 0 else 100

        tax_amount, bracket, elss_allowed = calculate_tax(income * 12, regime)
        if elss_allowed:
            monthly_eq_sip = round(investable * allocation['equity'] / 100)
            elss_amount    = min(monthly_eq_sip * 12, 150_000)
            tax_saved      = round(elss_amount * bracket)
            nps_saving     = round(50_000 * bracket)
        else:
            elss_amount = tax_saved = nps_saving = 0

        corpus_by_year = [
            {
                'year':   age + yr,
                'flat':   project_corpus(investable, yr, weighted_return),
                'growth': round(project_corpus_with_growth(investable, yr, weighted_return, income_growth)),
            }
            for yr in range(1, years_to_retire + 1)
        ]

        return jsonify({
            'name':              name,
            'age':               age,
            'years_to_retire':   years_to_retire,
            'monthly_income':    income,
            'total_expenses':    total_expenses,
            'lifestyle_spend':   lifestyle_spend,
            'dependent_cost':    dependent_cost,
            'surplus':           surplus,
            'surplus_ratio':     round(surplus_ratio, 4),
            'investable':        investable,
            'high_cost_loans':   high_cost,
            'high_emi_total':    high_emi_total,
            'ml_risk':           ml_risk,
            'final_risk':        final_risk,
            'risk_source':       risk_source,
            'model_name':        _model_name,
            'allocation':        allocation,
            'weighted_return':   round(weighted_return * 100, 2),
            'corpus_flat':       corpus,
            'corpus_growth':     corpus_growth,
            'corpus_worst':      scenarios['worst_case'],
            'corpus_likely':     scenarios['likely'],
            'corpus_best':       scenarios['best_case'],
            'inflation_adjusted': inflation_adj,
            'corpus_by_year':    corpus_by_year,
            'goal':              goal,
            'gap':               round(goal - scenarios['likely']),
            'on_track':          scenarios['likely'] >= goal,
            'ef_required':       ef_required,
            'ef_savings':        savings,
            'ef_pct':            ef_pct,
            'regime':            regime,
            'tax_amount':        round(tax_amount),
            'bracket':           round(bracket * 100),
            'elss_allowed':      elss_allowed,
            'elss_amount':       elss_amount,
            'tax_saved':         tax_saved,
            'nps_saving':        nps_saving,
            'market':            _market,
        })

    except (ValueError, TypeError, KeyError) as e:
        return jsonify({'error': f'Invalid input: {e}'}), 400
    except Exception as e:
        return jsonify({'error': f'Server error: {e}'}), 500


if __name__ == '__main__':
    print(f"\n  FinCA connected server → http://localhost:5000")
    print(f"  ML model : {_model_name}")
    print(f"  DB       : {DB_PATH}\n")
    app.run(debug=False, port=5000)
    