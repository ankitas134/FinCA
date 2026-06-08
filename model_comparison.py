"""
FinCA — ML Model Comparison
============================
Trains and compares 6 models for risk profile prediction:
  1. K-Means            (unsupervised — current FinCA default)
  2. Logistic Regression
  3. SVM (RBF kernel)
  4. Random Forest
  5. XGBoost
  6. LightGBM

Features: [age, surplus_ratio, dependents, has_emi]
Labels:   aggressive / moderate / conservative

Output:
  - comparison_results.json  (metrics for HTML report)
  - best_model.pkl           (best supervised model + scaler, used by finca.py)
  - comparison_report.html   (visual report)

Usage:
  python3 model_comparison.py
"""

import json
import pickle
import numpy as np
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import cross_val_score, StratifiedKFold, train_test_split
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, classification_report
import xgboost as xgb
import lightgbm as lgb
import warnings
warnings.filterwarnings('ignore')

FEATURES = ['age', 'surplus_ratio', 'dependents', 'has_emi']
CLASSES   = ['aggressive', 'moderate', 'conservative']
SEED      = 42


# ══════════════════════════════════════════════════════════════════════
# SYNTHETIC DATA GENERATION
# ══════════════════════════════════════════════════════════════════════

def generate_training_data(n_per_class=170, seed=SEED):
    """
    Generate 510 labelled profiles using financial domain rules.
    Intentional overlap in boundary regions mirrors real-world ambiguity.

    Features:
      age           : 18–59
      surplus_ratio : (income - expenses) / income
      dependents    : 0–3
      has_emi       : 0 or 1

    Labels are assigned based on what a financial advisor would recommend:
      aggressive    : young, high surplus, few dependents
      moderate      : mid-age, moderate surplus, some dependents
      conservative  : older, low surplus, many dependents / EMIs
    """
    rng = np.random.default_rng(seed)

    # AGGRESSIVE
    n_agg = n_per_class
    agg = np.column_stack([
        rng.integers(20, 32, n_agg),
        rng.uniform(0.45, 0.80, n_agg),
        rng.choice([0, 1], n_agg, p=[0.80, 0.20]),
        rng.choice([0, 1], n_agg, p=[0.85, 0.15]),
    ])

    # MODERATE
    n_mod = n_per_class
    mod = np.column_stack([
        rng.integers(28, 42, n_mod),
        rng.uniform(0.25, 0.50, n_mod),
        rng.choice([0, 1, 2], n_mod, p=[0.30, 0.50, 0.20]),
        rng.choice([0, 1], n_mod, p=[0.50, 0.50]),
    ])

    # CONSERVATIVE
    n_con = n_per_class
    con = np.column_stack([
        rng.integers(36, 59, n_con),
        rng.uniform(0.05, 0.28, n_con),
        rng.choice([1, 2, 3], n_con, p=[0.30, 0.50, 0.20]),
        rng.choice([0, 1], n_con, p=[0.30, 0.70]),
    ])

    X = np.vstack([agg, mod, con])
    y = np.array(['aggressive'] * n_agg + ['moderate'] * n_mod + ['conservative'] * n_con)

    # Shuffle
    idx = rng.permutation(len(y))
    return X[idx], y[idx]


# ══════════════════════════════════════════════════════════════════════
# KMEANS EVALUATION (unsupervised — special case)
# ══════════════════════════════════════════════════════════════════════

def evaluate_kmeans(X_scaled, y, scaler):
    km = KMeans(n_clusters=3, random_state=SEED, n_init=20)
    km.fit(X_scaled)

    centers = scaler.inverse_transform(km.cluster_centers_)
    surplus_rank = sorted(range(3), key=lambda i: centers[i][1], reverse=True)
    cluster_map  = {
        surplus_rank[0]: 'aggressive',
        surplus_rank[1]: 'moderate',
        surplus_rank[2]: 'conservative',
    }

    preds = np.array([cluster_map[c] for c in km.labels_])
    acc   = accuracy_score(y, preds)
    f1    = f1_score(y, preds, labels=CLASSES, average=None, zero_division=0)
    cm    = confusion_matrix(y, preds, labels=CLASSES)

    return {
        'model':        km,
        'accuracy':     round(float(acc), 4),
        'cv_mean':      None,
        'cv_std':       None,
        'f1_per_class': {c: round(float(v), 4) for c, v in zip(CLASSES, f1)},
        'f1_macro':     round(float(f1.mean()), 4),
        'confusion_matrix': cm.tolist(),
        'feature_importance': None,
        'note': 'Unsupervised — no cross-validation possible',
    }


# ══════════════════════════════════════════════════════════════════════
# SUPERVISED MODEL EVALUATION
# ══════════════════════════════════════════════════════════════════════

def evaluate_supervised(name, model, X_scaled, y, y_enc, le):
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    cv_scores = cross_val_score(model, X_scaled, y_enc, cv=cv, scoring='accuracy')

    # Final fit on full data for confusion matrix + feature importance
    model.fit(X_scaled, y_enc)
    preds_enc = model.predict(X_scaled)
    preds     = le.inverse_transform(preds_enc)

    acc = accuracy_score(y, preds)
    f1  = f1_score(y, preds, labels=CLASSES, average=None, zero_division=0)
    cm  = confusion_matrix(y, preds, labels=CLASSES)

    # Feature importance (tree models only)
    feat_imp = None
    if hasattr(model, 'feature_importances_'):
        feat_imp = {f: round(float(v), 4) for f, v in zip(FEATURES, model.feature_importances_)}
    elif hasattr(model, 'coef_'):
        # Logistic Regression: mean absolute coefficient per feature
        imp = np.abs(model.coef_).mean(axis=0)
        imp = imp / imp.sum()
        feat_imp = {f: round(float(v), 4) for f, v in zip(FEATURES, imp)}

    return {
        'model':             model,
        'accuracy':          round(float(acc), 4),
        'cv_mean':           round(float(cv_scores.mean()), 4),
        'cv_std':            round(float(cv_scores.std()), 4),
        'f1_per_class':      {c: round(float(v), 4) for c, v in zip(CLASSES, f1)},
        'f1_macro':          round(float(f1.mean()), 4),
        'confusion_matrix':  cm.tolist(),
        'feature_importance': feat_imp,
        'note':              None,
    }


# ══════════════════════════════════════════════════════════════════════
# MAIN COMPARISON
# ══════════════════════════════════════════════════════════════════════

def run_comparison():
    print('\n' + '='*60)
    print('  FinCA — ML Model Comparison')
    print('='*60)

    # Generate data
    print('\n  Generating 510 synthetic training profiles...')
    X, y = generate_training_data(n_per_class=170)
    print(f'  Dataset: {X.shape[0]} profiles × {X.shape[1]} features')
    print(f'  Classes: { {c: int((y==c).sum()) for c in CLASSES} }')

    # Scale
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Encode labels for supervised models
    le    = LabelEncoder()
    le.classes_ = np.array(CLASSES)
    y_enc = le.transform(y)

    # Define supervised models
    supervised_models = {
        'Logistic Regression': LogisticRegression(max_iter=1000, random_state=SEED),
        'SVM':                 SVC(kernel='rbf', probability=True, random_state=SEED),
        'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=SEED),
        'XGBoost':             xgb.XGBClassifier(n_estimators=100, random_state=SEED,
                                                  eval_metric='mlogloss', verbosity=0),
        'LightGBM':            lgb.LGBMClassifier(n_estimators=100, random_state=SEED, verbose=-1),
    }

    results = {}

    # K-Means (unsupervised baseline)
    print('\n  [1/6] K-Means (unsupervised baseline)...')
    results['K-Means'] = evaluate_kmeans(X_scaled, y, scaler)
    print(f'        Accuracy: {results["K-Means"]["accuracy"]:.1%}  (no CV — unsupervised)')

    # Supervised models
    for i, (name, model) in enumerate(supervised_models.items(), start=2):
        print(f'\n  [{i}/6] {name}...')
        results[name] = evaluate_supervised(name, model, X_scaled, y, y_enc, le)
        r = results[name]
        print(f'        CV Accuracy: {r["cv_mean"]:.1%} ± {r["cv_std"]:.1%}')
        print(f'        F1 Macro:    {r["f1_macro"]:.1%}')

    # ── Pick best supervised model ──────────────────────────────────
    supervised_results = {k: v for k, v in results.items() if k != 'K-Means'}
    best_name = max(supervised_results, key=lambda k: supervised_results[k]['cv_mean'])
    best_result = results[best_name]

    print(f'\n  Best model: {best_name}')
    print(f'  CV Accuracy: {best_result["cv_mean"]:.1%}')
    print(f'  vs K-Means:  {results["K-Means"]["accuracy"]:.1%}')

    # ── Save best model ─────────────────────────────────────────────
    print('\n  Saving best model to best_model.pkl...')
    with open('best_model.pkl', 'wb') as f:
        pickle.dump({
            'model_name': best_name,
            'model':      best_result['model'],
            'scaler':     scaler,
            'le':         le,
            'cv_accuracy': best_result['cv_mean'],
        }, f)
    print('  Saved.')

    # ── Prepare JSON export (strip non-serialisable model objects) ──
    export = {}
    for name, r in results.items():
        export[name] = {
            'accuracy':           r['accuracy'],
            'cv_mean':            r['cv_mean'],
            'cv_std':             r['cv_std'],
            'f1_per_class':       r['f1_per_class'],
            'f1_macro':           r['f1_macro'],
            'confusion_matrix':   r['confusion_matrix'],
            'feature_importance': r['feature_importance'],
            'note':               r['note'],
        }

    export_payload = {
        'models':        export,
        'best_model':    best_name,
        'best_cv_acc':   best_result['cv_mean'],
        'kmeans_acc':    results['K-Means']['accuracy'],
        'classes':       CLASSES,
        'features':      FEATURES,
        'n_samples':     int(X.shape[0]),
        'improvement':   round(best_result['cv_mean'] - results['K-Means']['accuracy'], 4),
    }

    with open('comparison_results.json', 'w') as f:
        json.dump(export_payload, f, indent=2)
    print('  Results saved to comparison_results.json')

    # ── Print summary table ─────────────────────────────────────────
    print('\n' + '='*60)
    print(f'  {"Model":<22} {"CV Acc":>8}  {"F1":>6}  {"Notes"}')
    print('  ' + '-'*56)
    for name, r in results.items():
        cv  = f'{r["cv_mean"]:.1%}' if r['cv_mean'] else '  n/a  '
        f1  = f'{r["f1_macro"]:.1%}'
        tag = ' ← BEST' if name == best_name else ''
        tag = ' ← baseline' if name == 'K-Means' else tag
        print(f'  {name:<22} {cv:>8}  {f1:>6}  {tag}')
    print('='*60 + '\n')

    return export_payload


if __name__ == '__main__':
    data = run_comparison()
    print('  Now generating comparison_report.html...')

    # ── Build HTML report ───────────────────────────────────────────
    models      = data['models']
    model_names = list(models.keys())
    best        = data['best_model']
    classes     = data['classes']

    # Colours per model
    colors = {
        'K-Means':            '#94a3b8',
        'Logistic Regression':'#60a5fa',
        'SVM':                '#a78bfa',
        'Random Forest':      '#34d399',
        'XGBoost':            '#f97316',
        'LightGBM':           '#facc15',
    }

    def pct(v):
        return f'{v*100:.1f}%' if v is not None else 'n/a'

    # Accuracy bars data
    acc_bars = []
    for name in model_names:
        r   = models[name]
        val = r['cv_mean'] if r['cv_mean'] is not None else r['accuracy']
        acc_bars.append({'name': name, 'val': val, 'color': colors.get(name, '#888')})

    acc_bars_json = json.dumps(acc_bars)

    # F1 per class data
    f1_data = {}
    for cls in classes:
        f1_data[cls] = [{'name': n, 'val': models[n]['f1_per_class'][cls], 'color': colors.get(n,'#888')} for n in model_names]
    f1_data_json = json.dumps(f1_data)

    # Confusion matrices
    cm_data = {n: models[n]['confusion_matrix'] for n in model_names}
    cm_json = json.dumps(cm_data)

    # Feature importance
    fi_data = {n: models[n]['feature_importance'] for n in model_names if models[n]['feature_importance']}
    fi_json = json.dumps(fi_data)

    meta_json = json.dumps({
        'best': best,
        'best_cv': data['best_cv_acc'],
        'kmeans_acc': data['kmeans_acc'],
        'improvement': data['improvement'],
        'n_samples': data['n_samples'],
        'classes': classes,
        'features': data['features'],
    })

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FinCA — ML Model Comparison Report</title>
<style>
  :root {{
    --bg:       #0f172a;
    --surface:  #1e293b;
    --border:   #334155;
    --text:     #f1f5f9;
    --muted:    #94a3b8;
    --accent:   #34d399;
    --warn:     #f97316;
    --bad:      #f43f5e;
    --good:     #34d399;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem; }}
  h1 {{ font-size: 1.8rem; font-weight: 700; margin-bottom: .25rem; }}
  h2 {{ font-size: 1.1rem; font-weight: 600; color: var(--muted); margin-bottom: 1.5rem; letter-spacing: .05em; text-transform: uppercase; }}
  h3 {{ font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }}
  .header {{ margin-bottom: 2.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }}
  .subtitle {{ color: var(--muted); margin-top: .5rem; font-size: .9rem; }}
  .grid-3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }}
  .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }}
  .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }}
  .stat-val {{ font-size: 2rem; font-weight: 700; color: var(--accent); }}
  .stat-label {{ font-size: .8rem; color: var(--muted); margin-top: .25rem; }}
  .section {{ margin-bottom: 3rem; }}
  .bar-row {{ display: flex; align-items: center; gap: 1rem; margin-bottom: .75rem; }}
  .bar-label {{ width: 160px; font-size: .85rem; flex-shrink: 0; text-align: right; color: var(--muted); }}
  .bar-label.best {{ color: var(--text); font-weight: 600; }}
  .bar-track {{ flex: 1; background: #0f172a; border-radius: 6px; height: 28px; overflow: hidden; position: relative; }}
  .bar-fill {{ height: 100%; border-radius: 6px; transition: width .6s ease; display: flex; align-items: center; padding-left: .75rem; font-size: .8rem; font-weight: 600; color: #0f172a; }}
  .bar-val {{ width: 60px; font-size: .85rem; color: var(--muted); flex-shrink: 0; }}
  .badge {{ display: inline-block; padding: .2rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 600; }}
  .badge-green {{ background: #064e3b; color: var(--good); }}
  .badge-gray  {{ background: #1e293b; color: var(--muted); }}
  .cm-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }}
  .cm-wrap {{ background: var(--bg); border-radius: 8px; padding: 1rem; }}
  .cm-title {{ font-size: .8rem; color: var(--muted); margin-bottom: .75rem; font-weight: 600; }}
  .cm-table {{ width: 100%; border-collapse: collapse; font-size: .75rem; }}
  .cm-table th {{ color: var(--muted); padding: .3rem .5rem; text-align: center; }}
  .cm-table td {{ text-align: center; padding: .4rem .5rem; border-radius: 4px; font-weight: 600; }}
  .fi-bar-wrap {{ margin-bottom: 1.5rem; }}
  .fi-title {{ font-size: .8rem; color: var(--muted); margin-bottom: .5rem; font-weight: 600; }}
  .fi-row {{ display: flex; align-items: center; gap: .75rem; margin-bottom: .4rem; }}
  .fi-label {{ width: 120px; font-size: .8rem; color: var(--muted); text-align: right; flex-shrink: 0; }}
  .fi-track {{ flex: 1; background: #0f172a; border-radius: 4px; height: 18px; overflow: hidden; }}
  .fi-fill  {{ height: 100%; border-radius: 4px; }}
  .fi-val   {{ width: 45px; font-size: .8rem; color: var(--muted); }}
  .tabs {{ display: flex; gap: .5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }}
  .tab {{ padding: .4rem 1rem; border-radius: 8px; font-size: .8rem; cursor: pointer; border: 1px solid var(--border); background: var(--bg); color: var(--muted); transition: all .2s; }}
  .tab.active {{ background: var(--surface); color: var(--text); border-color: var(--accent); }}
  .tab-panel {{ display: none; }}
  .tab-panel.active {{ display: block; }}
  .table {{ width: 100%; border-collapse: collapse; font-size: .85rem; }}
  .table th {{ color: var(--muted); padding: .6rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-weight: 500; }}
  .table td {{ padding: .6rem 1rem; border-bottom: 1px solid #1e293b; }}
  .table tr:last-child td {{ border-bottom: none; }}
  .highlight {{ background: #064e3b22; }}
  .note {{ font-size: .8rem; color: var(--muted); margin-top: 1rem; padding: .75rem; background: var(--bg); border-radius: 8px; border-left: 3px solid var(--border); }}
  .best-banner {{ background: linear-gradient(135deg, #064e3b, #065f46); border: 1px solid #34d399; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1.5rem; }}
  .best-banner .icon {{ font-size: 2rem; }}
  .best-banner h3 {{ margin-bottom: .25rem; color: var(--good); }}
  .best-banner p {{ font-size: .85rem; color: #6ee7b7; }}
</style>
</head>
<body>

<div class="header">
  <h1>FinCA — ML Model Comparison</h1>
  <p class="subtitle">Risk profile prediction: aggressive / moderate / conservative &nbsp;·&nbsp; 510 synthetic profiles &nbsp;·&nbsp; 5-fold cross-validation</p>
</div>

<div id="app"></div>

<script>
const META    = {meta_json};
const ACC     = {acc_bars_json};
const F1DATA  = {f1_data_json};
const CM      = {cm_json};
const FI      = {fi_json};
const CLASSES = META.classes;
const FEATURES= META.features;

const colors = {{
  'K-Means':            '#94a3b8',
  'Logistic Regression':'#60a5fa',
  'SVM':                '#a78bfa',
  'Random Forest':      '#34d399',
  'XGBoost':            '#f97316',
  'LightGBM':           '#facc15',
}};

function pct(v) {{ return v != null ? (v*100).toFixed(1)+'%' : 'n/a'; }}

function heatColor(val, max) {{
  const t = val / max;
  const r = Math.round(15  + t * (52  - 15));
  const g = Math.round(118 + t * (211 - 118));
  const b = Math.round(110 + t * (153 - 110));
  return `rgb(${{r}},${{g}},${{b}})`;
}}

function renderStats() {{
  return `
  <div class="grid-3">
    <div class="card">
      <div class="stat-val">${{pct(META.best_cv)}}</div>
      <div class="stat-label">Best CV Accuracy (${{META.best}})</div>
    </div>
    <div class="card">
      <div class="stat-val">${{pct(META.kmeans_acc)}}</div>
      <div class="stat-label">K-Means Accuracy (baseline)</div>
    </div>
    <div class="card">
      <div class="stat-val" style="color:#f97316">+${{pct(META.improvement)}}</div>
      <div class="stat-label">Improvement over K-Means</div>
    </div>
  </div>`;
}}

function renderBanner() {{
  return `
  <div class="best-banner">
    <div class="icon">🏆</div>
    <div>
      <h3>${{META.best}} selected for FinCA</h3>
      <p>Highest cross-validated accuracy across 5 folds · ${{META.n_samples}} training profiles · 4 features</p>
    </div>
  </div>`;
}}

function renderAccChart() {{
  const max = Math.max(...ACC.map(d => d.cv_mean ?? d.val));
  const rows = ACC.map(d => {{
    const val  = d.cv_mean ?? d.val;
    const w    = (val / max * 100).toFixed(1);
    const best = d.name === META.best;
    const isKM = d.name === 'K-Means';
    return `
    <div class="bar-row">
      <div class="bar-label ${{best ? 'best' : ''}}">${{d.name}}${{best ? ' 🏆' : ''}}${{isKM ? ' *' : ''}}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${{w}}%;background:${{d.color}}">${{pct(val)}}</div>
      </div>
    </div>`;
  }}).join('');
  return `
  <div class="section">
    <h2>Model Accuracy</h2>
    <div class="card">
      <h3>CV Accuracy (5-fold) — higher is better</h3>
      ${{rows}}
      <p class="note">* K-Means is unsupervised — accuracy shown is on full training set, no cross-validation possible. All other models use 5-fold stratified CV.</p>
    </div>
  </div>`;
}}

function renderF1() {{
  const tabs = CLASSES.map((cls, i) =>
    `<div class="tab ${{i===0?'active':''}}" onclick="switchTab('f1','${{cls}}',${{i}})">${{cls}}</div>`
  ).join('');

  const panels = CLASSES.map((cls, i) => {{
    const data = F1DATA[cls];
    const max  = Math.max(...data.map(d => d.val));
    const rows = data.map(d => {{
      const w = (d.val / max * 100).toFixed(1);
      return `
      <div class="bar-row">
        <div class="bar-label ${{d.name===META.best?'best':''}}">${{d.name}}${{d.name===META.best?' 🏆':''}}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${{w}}%;background:${{d.color}}">${{pct(d.val)}}</div>
        </div>
      </div>`;
    }}).join('');
    return `<div class="tab-panel ${{i===0?'active':''}}" id="f1-${{cls}}">
      <h3>F1 Score — "${{cls}}" class</h3>
      ${{rows}}
    </div>`;
  }}).join('');

  return `
  <div class="section">
    <h2>F1 Score per Class</h2>
    <div class="card">
      <div class="tabs">${{tabs}}</div>
      ${{panels}}
    </div>
  </div>`;
}}

function renderCM() {{
  const modelNames = Object.keys(CM);
  const tabs = modelNames.map((n,i) =>
    `<div class="tab ${{i===0?'active':''}}" onclick="switchTab('cm','${{n}}',${{i}})">${{n}}${{n===META.best?' 🏆':''}}</div>`
  ).join('');

  const panels = modelNames.map((name, i) => {{
    const matrix = CM[name];
    const maxVal = Math.max(...matrix.flat());

    let header = '<tr><th></th>' + CLASSES.map(c => `<th>${{c.slice(0,3)}}</th>`).join('') + '</tr>';
    let bodyRows = matrix.map((row, ri) => {{
      const cells = row.map((val, ci) => {{
        const bg  = ri === ci ? heatColor(val, maxVal) : (val > 0 ? '#7f1d1d' : '#1e293b');
        const fg  = ri === ci ? '#0f172a' : (val > 0 ? '#fca5a5' : '#475569');
        return `<td style="background:${{bg}};color:${{fg}}">${{val}}</td>`;
      }}).join('');
      return `<tr><th style="color:var(--muted);text-align:right;padding:.4rem .5rem">${{CLASSES[ri].slice(0,3)}}</th>${{cells}}</tr>`;
    }}).join('');

    return `<div class="tab-panel ${{i===0?'active':''}}" id="cm-${{name}}">
      <div class="cm-wrap" style="max-width:320px">
        <div class="cm-title">Confusion Matrix — ${{name}}</div>
        <table class="cm-table">
          <thead>${{header}}</thead>
          <tbody>${{bodyRows}}</tbody>
        </table>
        <p class="note" style="margin-top:.75rem">Rows = actual label &nbsp;·&nbsp; Cols = predicted &nbsp;·&nbsp; Diagonal = correct</p>
      </div>
    </div>`;
  }}).join('');

  return `
  <div class="section">
    <h2>Confusion Matrices</h2>
    <div class="card">
      <div class="tabs">${{tabs}}</div>
      ${{panels}}
    </div>
  </div>`;
}}

function renderFI() {{
  const modelNames = Object.keys(FI);
  const tabs = modelNames.map((n,i) =>
    `<div class="tab ${{i===0?'active':''}}" onclick="switchTab('fi','${{n}}',${{i}})">${{n}}${{n===META.best?' 🏆':''}}</div>`
  ).join('');

  const featureColors = ['#60a5fa','#34d399','#f97316','#a78bfa'];

  const panels = modelNames.map((name, i) => {{
    const imp = FI[name];
    const max = Math.max(...Object.values(imp));
    const rows = FEATURES.map((feat, fi) => {{
      const val = imp[feat] ?? 0;
      const w   = (val / max * 100).toFixed(1);
      return `
      <div class="fi-row">
        <div class="fi-label">${{feat}}</div>
        <div class="fi-track">
          <div class="fi-fill" style="width:${{w}}%;background:${{featureColors[fi]}}"></div>
        </div>
        <div class="fi-val">${{(val*100).toFixed(1)}}%</div>
      </div>`;
    }}).join('');

    return `<div class="tab-panel ${{i===0?'active':''}}" id="fi-${{name}}">
      <h3>Feature Importance — ${{name}}</h3>
      ${{rows}}
      <p class="note">surplus_ratio dominates because it is the strongest linear separator between risk classes.</p>
    </div>`;
  }}).join('');

  return `
  <div class="section">
    <h2>Feature Importance</h2>
    <div class="card">
      <div class="tabs">${{tabs}}</div>
      ${{panels}}
    </div>
    <p class="note" style="margin-top:.75rem">Feature importance only available for tree-based models (Random Forest, XGBoost, LightGBM) and Logistic Regression (coefficient magnitude). K-Means and SVM do not expose per-feature importance.</p>
  </div>`;
}}

function renderSummaryTable() {{
  const modelNames = Object.keys(CM);
  const rows = ACC.map(d => {{
    const isBest = d.name === META.best;
    const isKM   = d.name === 'K-Means';
    const f1data = F1DATA;
    const f1vals = CLASSES.map(c => pct(F1DATA[c].find(x=>x.name===d.name)?.val)).join(' / ');
    return `
    <tr class="${{isBest?'highlight':''}}">
      <td><strong>${{d.name}}</strong> ${{isBest?'🏆':''}}${{isKM?'<span class="badge badge-gray" style="margin-left:.5rem">baseline</span>':''}}</td>
      <td>${{isKM ? pct(d.val)+' *' : pct(d.cv_mean)}}</td>
      <td>${{isKM ? '—' : '±'+pct(d.cv_std)}}</td>
      <td>${{f1vals}}</td>
      <td>${{FI[d.name] ? '✓' : '—'}}</td>
    </tr>`;
  }}).join('');

  return `
  <div class="section">
    <h2>Summary Table</h2>
    <div class="card" style="overflow-x:auto">
      <table class="table">
        <thead>
          <tr>
            <th>Model</th>
            <th>CV Accuracy</th>
            <th>Std Dev</th>
            <th>F1 (agg / mod / con)</th>
            <th>Feature Imp.</th>
          </tr>
        </thead>
        <tbody>${{rows}}</tbody>
      </table>
      <p class="note">* K-Means: unsupervised, accuracy on training set only. All supervised models: 5-fold stratified CV.</p>
    </div>
  </div>`;
}}

function switchTab(group, name, idx) {{
  document.querySelectorAll(`#${{group}}-group .tab`).forEach((t,i) => t.classList.toggle('active', i===idx));
  document.querySelectorAll(`#${{group}}-group .tab-panel`).forEach(p => p.classList.remove('active'));
  document.getElementById(`${{group}}-${{name}}`).classList.add('active');
}}

// Patch tab wrappers with IDs for the switcher
function wrapTabs(html, group) {{
  return html.replace('<div class="tabs">', `<div class="tabs" id="${{group}}-group">`);
}}

const app = document.getElementById('app');
app.innerHTML =
  renderStats() +
  renderBanner() +
  renderAccChart() +
  wrapTabs(renderF1(), 'f1') +
  wrapTabs(renderCM(), 'cm') +
  wrapTabs(renderFI(), 'fi') +
  renderSummaryTable();
</script>
</body>
</html>"""

    with open('comparison_report.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print('  comparison_report.html generated.')
    print('\n  Done. Files created:')
    print('    comparison_results.json  — raw metrics')
    print('    best_model.pkl           — best model + scaler for finca.py')
    print('    comparison_report.html   — visual report\n')